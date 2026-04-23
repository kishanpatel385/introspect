import { v4 as uuid } from 'uuid';
import type { RepoFile, Issue } from '@introspect/core-types';

export function runDeadCodeAnalyzer(files: RepoFile[]): Issue[] {
  const issues: Issue[] = [];

  for (const file of files) {
    issues.push(...checkUnusedImports(file, files));
    issues.push(...checkEmptyFiles(file));
    issues.push(...checkCommentedOutCode(file));
  }

  return issues;
}

function checkUnusedImports(file: RepoFile, allFiles: RepoFile[]): Issue[] {
  const issues: Issue[] = [];
  if (!file.language || !['javascript', 'typescript'].includes(file.language)) return issues;

  const lines = file.content.split('\n');
  const importedNames: { name: string; line: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Match: import { Foo, Bar } from '...'
    const namedMatch = line.match(/import\s+\{([^}]+)\}\s+from/);
    if (namedMatch) {
      const names = namedMatch[1]!.split(',').map((n) => n.trim().split(/\s+as\s+/).pop()?.trim()).filter(Boolean);
      for (const name of names) {
        if (name) importedNames.push({ name, line: i + 1 });
      }
    }

    // Match: import Foo from '...'
    const defaultMatch = line.match(/import\s+(\w+)\s+from/);
    if (defaultMatch && defaultMatch[1] !== 'type') {
      importedNames.push({ name: defaultMatch[1]!, line: i + 1 });
    }
  }

  // Check if imported names are used in file body (excluding import lines)
  const bodyContent = lines
    .filter((l) => !(l ?? '').trim().startsWith('import '))
    .join('\n');

  for (const imported of importedNames) {
    const usageRegex = new RegExp(`\\b${imported.name}\\b`);
    if (!usageRegex.test(bodyContent)) {
      issues.push({
        id: uuid(),
        ruleId: 'unused-import',
        type: 'dead_code',
        severity: 'low',
        title: `Unused import: ${imported.name}`,
        description: 'This import is not referenced in the file body. Remove it to keep the codebase clean.',
        file: file.path,
        line: imported.line,
        language: file.language,
      });
    }
  }

  return issues;
}

function checkEmptyFiles(file: RepoFile): Issue[] {
  const trimmed = file.content.trim();
  const lineCount = trimmed.split('\n').length;

  // Skip README, config files, etc.
  if (file.path.endsWith('.md') || file.path.endsWith('.json') || file.path.endsWith('.yaml') || file.path.endsWith('.yml')) {
    return [];
  }

  if (lineCount <= 3 && trimmed.length < 50) {
    return [{
      id: uuid(),
      ruleId: 'empty-file',
      type: 'dead_code',
      severity: 'low',
      title: `Nearly empty file (${lineCount} lines)`,
      description: 'This file has almost no content. Consider removing or merging with another module.',
      file: file.path,
      line: 1,
      language: file.language,
    }];
  }

  return [];
}

function checkCommentedOutCode(file: RepoFile): Issue[] {
  const issues: Issue[] = [];
  const lines = file.content.split('\n');
  let commentBlock = 0;
  let blockStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();

    // Detect blocks of commented-out code (3+ consecutive commented lines that look like code)
    const isCommentedCode =
      (line.startsWith('//') && /[{};()=]/.test(line)) ||
      (line.startsWith('#') && /[{};()=]|def |class |import /.test(line));

    if (isCommentedCode) {
      if (commentBlock === 0) blockStart = i;
      commentBlock++;
    } else {
      if (commentBlock >= 3) {
        issues.push({
          id: uuid(),
          ruleId: 'commented-out-code',
          type: 'dead_code',
          severity: 'low',
          title: `${commentBlock} lines of commented-out code`,
          description: 'Remove dead commented code. Use version control to track history instead.',
          file: file.path,
          line: blockStart + 1,
          language: file.language,
        });
      }
      commentBlock = 0;
    }
  }

  return issues;
}
