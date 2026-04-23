import type { ZipSource, RepoFile } from '@introspect/core-types';

// ZIP extraction will be implemented in Phase 1
// For now, this is a placeholder that throws a clear error
export async function extractFromZip(_source: ZipSource): Promise<RepoFile[]> {
  throw new Error('ZIP upload support coming in Phase 1. Use GitHub URL or local path for now.');
}
