import type { GitHubSource, ZipSource, LocalSource, RepoFile } from '@introspect/core-types';
import { LANGUAGE_EXTENSIONS } from '@introspect/core-types';
import { fetchFromGitHub } from './github';
import type { DownloadProgress } from './github';
import { readFromLocal } from './local';
import { extractFromZip } from './zip';

export type Source = GitHubSource | ZipSource | LocalSource;

export async function ingest(source: Source, onProgress?: DownloadProgress): Promise<RepoFile[]> {
  let files: RepoFile[];

  switch (source.type) {
    case 'github':
      files = await fetchFromGitHub(source, onProgress);
      break;
    case 'local':
      files = await readFromLocal(source);
      break;
    case 'zip':
      files = await extractFromZip(source);
      break;
  }

  return files.map((f) => ({
    ...f,
    language: f.language || detectLanguage(f.path),
  }));
}

function detectLanguage(filePath: string): string | undefined {
  const ext = '.' + filePath.split('.').pop()?.toLowerCase();
  return LANGUAGE_EXTENSIONS[ext];
}
