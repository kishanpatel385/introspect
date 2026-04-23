import { mkdir, readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import type { ScanResult } from '@introspect/core-types';

const INTROSPECT_DIR = join(homedir(), '.introspect');
const LAST_SCAN_PATH = join(INTROSPECT_DIR, 'last-scan.json');

export async function saveLastScan(result: ScanResult): Promise<void> {
  await mkdir(INTROSPECT_DIR, { recursive: true });
  await writeFile(LAST_SCAN_PATH, JSON.stringify(result, null, 2), 'utf-8');
}

export async function loadLastScan(): Promise<ScanResult> {
  const raw = await readFile(LAST_SCAN_PATH, 'utf-8');
  return JSON.parse(raw) as ScanResult;
}
