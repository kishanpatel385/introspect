import { readFile } from 'fs/promises';
import fg from 'fast-glob';
import type { LocalSource, RepoFile } from '@introspect/core-types';
import { LANGUAGE_EXTENSIONS } from '@introspect/core-types';

const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', 'vendor', '__pycache__', '.next', 'venv'];
const MAX_FILES = Infinity; // no limit

const SCANNABLE_EXTENSIONS = [
  ...Object.keys(LANGUAGE_EXTENSIONS),
  '.md', '.json', '.yaml', '.yml', '.toml', '.env', '.sql',
];

export async function readFromLocal(source: LocalSource): Promise<RepoFile[]> {
  const patterns = SCANNABLE_EXTENSIONS.map((ext) => `**/*${ext}`);
  const ignorePatterns = SKIP_DIRS.map((dir) => `**/${dir}/**`);

  const paths = await fg(patterns, {
    cwd: source.path,
    ignore: ignorePatterns,
    absolute: false,
    dot: false,
    stats: true,
  });

  const files: RepoFile[] = [];

  for (const entry of paths) {
    if (files.length >= MAX_FILES) break;

    const filePath = typeof entry === 'string' ? entry : entry.path;
    const fullPath = `${source.path}/${filePath}`;

    try {
      const content = await readFile(fullPath, 'utf-8');

      files.push({
        path: filePath,
        content,
        size: content.length,
      });
    } catch {
      // Skip unreadable files
    }
  }

  return files;
}
