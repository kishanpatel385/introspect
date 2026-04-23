import type { GitHubSource } from '@introspect/core-types';

export interface GitCommit {
  sha: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}

export interface GitHistoryData {
  commits: GitCommit[];
  fileAuthors: Map<string, Set<string>>;
  fileLastTouch: Map<string, Date>;
  fileChangeCount: Map<string, number>;
  authorCommitCount: Map<string, number>;
  authorFiles: Map<string, Set<string>>;
  totalContributors: number;
  repoAgeWeeks: number;
  weeklyCommitCounts: number[];
}

interface GitHubCommitItem {
  sha: string;
  commit: {
    author: { name: string; date: string };
    message: string;
  };
  files?: { filename: string }[];
}

interface GitHubContributor {
  login?: string;
  contributions: number;
}

function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (!match) throw new Error('Invalid GitHub URL');
  return { owner: match[1]!, repo: match[2]!.replace(/\.git$/, '') };
}

export async function fetchGitHistory(source: GitHubSource): Promise<GitHistoryData> {
  const { owner, repo } = parseRepoUrl(source.url);
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Introspect-Scanner',
  };
  if (source.token) headers.Authorization = `Bearer ${source.token}`;

  // Fetch last 50 commits (1 API call)
  const commits: GitCommit[] = [];
  const commitRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=50`,
    { headers },
  );
  if (commitRes.ok) {
    const items = (await commitRes.json()) as GitHubCommitItem[];
    for (const item of items) {
      commits.push({
        sha: item.sha,
        author: item.commit.author.name,
        date: item.commit.author.date,
        message: item.commit.message,
        files: [],
      });
    }
  }

  // Fetch file details for top 10 commits only (speed vs coverage tradeoff)
  const detailBatch = commits.slice(0, 10);
  const detailResults = await Promise.all(
    detailBatch.map(async (c) => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits/${c.sha}`,
          { headers },
        );
        if (!res.ok) return null;
        const data = (await res.json()) as GitHubCommitItem;
        return { sha: c.sha, files: (data.files ?? []).map((f) => f.filename) };
      } catch {
        return null;
      }
    }),
  );

  for (const detail of detailResults) {
    if (!detail) continue;
    const commit = commits.find((c) => c.sha === detail.sha);
    if (commit) commit.files = detail.files;
  }

  // Fetch contributor count
  let totalContributors = 0;
  try {
    const contribRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1&anon=true`,
      { headers },
    );
    if (contribRes.ok) {
      const linkHeader = contribRes.headers.get('link') ?? '';
      const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
      totalContributors = lastMatch ? parseInt(lastMatch[1]!, 10) : 1;
    }
  } catch {
    totalContributors = new Set(commits.map((c) => c.author)).size;
  }

  // Build derived maps
  const fileAuthors = new Map<string, Set<string>>();
  const fileLastTouch = new Map<string, Date>();
  const fileChangeCount = new Map<string, number>();
  const authorCommitCount = new Map<string, number>();
  const authorFiles = new Map<string, Set<string>>();

  for (const commit of commits) {
    authorCommitCount.set(commit.author, (authorCommitCount.get(commit.author) ?? 0) + 1);

    if (!authorFiles.has(commit.author)) authorFiles.set(commit.author, new Set());

    for (const file of commit.files) {
      // File → authors
      if (!fileAuthors.has(file)) fileAuthors.set(file, new Set());
      fileAuthors.get(file)!.add(commit.author);

      // File → last touch
      const commitDate = new Date(commit.date);
      const existing = fileLastTouch.get(file);
      if (!existing || commitDate > existing) fileLastTouch.set(file, commitDate);

      // File → change count
      fileChangeCount.set(file, (fileChangeCount.get(file) ?? 0) + 1);

      // Author → files
      authorFiles.get(commit.author)!.add(file);
    }
  }

  // Weekly commit distribution (last 12 weeks)
  const now = Date.now();
  const weeklyCommitCounts = new Array(12).fill(0) as number[];
  for (const commit of commits) {
    const weeksAgo = Math.floor((now - new Date(commit.date).getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeksAgo >= 0 && weeksAgo < 12) weeklyCommitCounts[weeksAgo]!++;
  }

  // Repo age in weeks
  const oldestCommit = commits.length > 0
    ? new Date(commits[commits.length - 1]!.date)
    : new Date();
  const repoAgeWeeks = Math.max(1, Math.floor((now - oldestCommit.getTime()) / (7 * 24 * 60 * 60 * 1000)));

  return {
    commits,
    fileAuthors,
    fileLastTouch,
    fileChangeCount,
    authorCommitCount,
    authorFiles,
    totalContributors,
    repoAgeWeeks,
    weeklyCommitCounts,
  };
}
