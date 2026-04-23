import type { GitHubSource, RepoFile } from '@introspect/core-types';
import { LANGUAGE_EXTENSIONS } from '@introspect/core-types';

const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', 'vendor', '__pycache__', '.next', 'venv', '.venv', 'coverage', '.cache'];
const MAX_FILE_SIZE = Infinity; // no limit — scan everything
const CONCURRENT_DOWNLOADS = 40;

interface TreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  url: string;
}

interface TreeResponse {
  tree: TreeItem[];
  truncated: boolean;
}

export type DownloadProgress = (downloaded: number, total: number) => void;

function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL. Expected: https://github.com/owner/repo');
  }
  return { owner: match[1]!, repo: match[2]!.replace(/\.git$/, '') };
}

function isScannable(filePath: string): boolean {
  if (SKIP_DIRS.some((dir) => filePath.split('/').includes(dir))) return false;
  const ext = '.' + (filePath.split('.').pop()?.toLowerCase() ?? '');
  return ext in LANGUAGE_EXTENSIONS || ['.md', '.json', '.yaml', '.yml', '.toml', '.env', '.sql'].includes(ext);
}

async function downloadBatch(
  urls: { path: string; url: string; size: number }[],
  headers: Record<string, string>,
  onProgress?: DownloadProgress,
): Promise<RepoFile[]> {
  const results: RepoFile[] = [];
  const total = urls.length;

  for (let i = 0; i < urls.length; i += CONCURRENT_DOWNLOADS) {
    const batch = urls.slice(i, i + CONCURRENT_DOWNLOADS);
    const fetched = await Promise.all(
      batch.map(async ({ path, url, size }) => {
        try {
          const res = await fetch(url, { headers });
          if (!res.ok) return null;
          const content = await res.text();
          return { path, content, size } as RepoFile;
        } catch {
          return null;
        }
      }),
    );
    for (const f of fetched) {
      if (f) results.push(f);
    }
    onProgress?.(results.length, total);
  }
  return results;
}

export const repoMeta = { totalFiles: 0 };

export async function fetchFromGitHub(
  source: GitHubSource,
  onProgress?: DownloadProgress,
): Promise<RepoFile[]> {
  const { owner, repo } = parseRepoUrl(source.url);
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Introspect-Scanner',
  };

  if (source.token) {
    headers.Authorization = `Bearer ${source.token}`;
  }

  // Step 1: Get full repo tree in ONE API call
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers },
  );

  if (!treeRes.ok) {
    if (treeRes.status === 404) {
      throw new Error('Repository not found. Make sure the URL is correct and the repo is public.');
    }
    if (treeRes.status === 403) {
      throw new Error('Access denied. Only public repositories can be scanned.');
    }
    throw new Error(`GitHub API error: ${treeRes.status} ${treeRes.statusText}`);
  }

  const tree = (await treeRes.json()) as TreeResponse;
  const allFiles = tree.tree.filter((item) => item.type === 'blob');
  repoMeta.totalFiles = allFiles.length;

  // Step 2: Filter scannable files
  const candidates = tree.tree
    .filter((item) => item.type === 'blob' && isScannable(item.path) && (item.size ?? 0) <= MAX_FILE_SIZE)
    .map((item) => ({
      path: item.path,
      url: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${item.path}`,
      size: item.size ?? 0,
    }));

  // Report total found immediately
  onProgress?.(0, candidates.length);

  // Step 3: Download files in parallel batches with progress
  return downloadBatch(candidates, {}, onProgress);
}
