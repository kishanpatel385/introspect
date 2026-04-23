import { v4 as uuid } from 'uuid';
import type { RepoFile, Issue } from '@introspect/core-types';

const MAX_FILE_LINES = 800;
const MAX_FUNCTION_LINES = 50;
const MAX_NESTING_DEPTH = 4;

const SKIP_QUALITY = ['.md', '.json', '.yaml', '.yml', '.toml', '.lock', '.csv', '.svg', '.txt', '.log', '.env', '.sql'];
const SKIP_PATHS = ['test', 'tests', '__tests__', 'spec', 'fixtures', 'benchmark', 'benchmarks', 'examples', 'example'];

export function runQualityChecks(files: RepoFile[]): Issue[] {
  const issues: Issue[] = [];

  for (const file of files) {
    const ext = '.' + (file.path.split('.').pop()?.toLowerCase() ?? '');
    if (SKIP_QUALITY.includes(ext)) continue;
    if (SKIP_PATHS.some((p) => file.path.split('/').includes(p))) continue;

    issues.push(...checkFileLength(file));
    issues.push(...checkFunctionLength(file));
    issues.push(...checkNestingDepth(file));
    issues.push(...checkMagicNumbers(file));
  }

  return issues;
}

function checkFileLength(file: RepoFile): Issue[] {
  const lineCount = file.content.split('\n').length;
  if (lineCount <= MAX_FILE_LINES) return [];

  return [{
    id: uuid(),
    ruleId: 'file-too-long',
    type: 'quality',
    severity: 'medium',
    title: `File has ${lineCount} lines (max recommended: ${MAX_FILE_LINES})`,
    description: 'Large files are harder to navigate, test, and review. Split into smaller, focused modules.',
    file: file.path,
    line: 1,
    language: file.language,
  }];
}

function checkFunctionLength(file: RepoFile): Issue[] {
  const issues: Issue[] = [];
  const lines = file.content.split('\n');

  // Simple heuristic: track opening/closing braces after function-like declarations
  const funcPattern = /^\s*(export\s+)?(async\s+)?function\s+\w+|^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(|^\s*(public|private|protected)?\s*(async\s+)?\w+\s*\(/;

  let funcStart = -1;
  let braceDepth = 0;
  let funcName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    if (funcStart === -1 && funcPattern.test(line)) {
      funcStart = i;
      braceDepth = 0;
      const nameMatch = line.match(/function\s+(\w+)|(\w+)\s*[=(]/);
      funcName = nameMatch?.[1] ?? nameMatch?.[2] ?? 'anonymous';
    }

    if (funcStart !== -1) {
      braceDepth += (line.match(/{/g) ?? []).length;
      braceDepth -= (line.match(/}/g) ?? []).length;

      if (braceDepth <= 0 && i > funcStart) {
        const length = i - funcStart + 1;
        if (length > MAX_FUNCTION_LINES) {
          issues.push({
            id: uuid(),
            ruleId: 'long-function',
            type: 'quality',
            severity: 'medium',
            title: `Function "${funcName}" is ${length} lines (max: ${MAX_FUNCTION_LINES})`,
            description: 'Long functions are hard to test and understand. Extract sub-routines.',
            file: file.path,
            line: funcStart + 1,
            language: file.language,
          });
        }
        funcStart = -1;
      }
    }
  }

  return issues;
}

function checkNestingDepth(file: RepoFile): Issue[] {
  const issues: Issue[] = [];
  const lines = file.content.split('\n');
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    depth += (line.match(/{/g) ?? []).length;
    depth -= (line.match(/}/g) ?? []).length;

    if (depth > MAX_NESTING_DEPTH) {
      issues.push({
        id: uuid(),
        ruleId: 'deep-nesting',
        type: 'quality',
        severity: 'medium',
        title: `Nesting depth ${depth} exceeds max ${MAX_NESTING_DEPTH}`,
        description: 'Deep nesting makes code hard to read. Use early returns, guard clauses, or extract functions.',
        file: file.path,
        line: i + 1,
        language: file.language,
      });
      break; // One warning per file
    }
  }

  return issues;
}

function checkMagicNumbers(file: RepoFile): Issue[] {
  const issues: Issue[] = [];
  const lines = file.content.split('\n');
  const allowedNumbers = new Set([
    '0', '1', '2', '3', '4', '5', '10', '16', '32', '64', '128', '256', '512',
    '-1', '100', '200', '201', '204', '301', '302', '304',
    '400', '401', '403', '404', '405', '406', '409', '422', '429',
    '500', '502', '503', '504',
    '200', '201', '202', '204', '205', '206',
    '1000', '1024', '2048', '3000', '3001', '4000', '5000', '8000', '8080', '9000',
    '2024', '2025', '2026',
  ]);

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();

    // Skip comments, imports, constants declarations
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('import')) continue;
    if (/^\s*(const|let|var|export)\s+[A-Z_]+\s*=/.test(line)) continue;

    const matches = line.match(/(?<!\w)\d{3,}(?!\w)/g);
    if (!matches) continue;

    const magicNumbers = matches.filter((n) => !allowedNumbers.has(n));
    if (magicNumbers.length > 0) {
      issues.push({
        id: uuid(),
        ruleId: 'magic-number',
        type: 'quality',
        severity: 'low',
        title: `Magic number(s) ${magicNumbers.join(', ')} — use named constants`,
        description: 'Magic numbers make code harder to understand and maintain. Extract to named constants.',
        file: file.path,
        line: i + 1,
        language: file.language,
      });
    }
  }

  return issues;
}
