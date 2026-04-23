import { v4 as uuid } from 'uuid';
import type { RepoFile, Issue } from '@introspect/core-types';

const README_SECTIONS = [
  { pattern: /^#+\s*(install|setup|getting\s*started)/im, name: 'Installation' },
  { pattern: /^#+\s*(usage|how\s*to|quick\s*start)/im, name: 'Usage' },
  { pattern: /^#+\s*(api|reference|docs)/im, name: 'API Reference' },
  { pattern: /^#+\s*(contribut|development)/im, name: 'Contributing' },
  { pattern: /^#+\s*(licen[sc]e)/im, name: 'License' },
  { pattern: /!\[.*\]\(.*\)|<img\s/im, name: 'Images/Diagrams' },
  { pattern: /```/m, name: 'Code Examples' },
  { pattern: /\[!\[.*\]\(https:\/\/img\.shields/im, name: 'Badges' },
];

export function runDocsAnalyzer(files: RepoFile[]): Issue[] {
  const issues: Issue[] = [];

  // Check README
  const readme = files.find(
    (f) => /^readme(\.(md|rst|txt))?$/i.test(f.path.split('/').pop() ?? ''),
  );

  if (!readme) {
    issues.push({
      id: uuid(),
      ruleId: 'missing-readme',
      type: 'docs',
      severity: 'high',
      title: 'No README file found',
      description: 'A README is the first thing users and contributors see. Add at least: project description, installation, usage, and license.',
      file: 'README.md',
    });
  } else {
    issues.push(...checkReadmeCompleteness(readme));
  }

  // Check for test files
  const codeFiles = files.filter(
    (f) => f.language && !f.path.includes('node_modules') && !f.path.endsWith('.d.ts'),
  );
  const testFiles = files.filter(
    (f) =>
      f.path.includes('.test.') ||
      f.path.includes('.spec.') ||
      f.path.includes('__test__') ||
      f.path.includes('/test/') ||
      f.path.includes('/tests/'),
  );

  if (codeFiles.length > 5 && testFiles.length === 0) {
    issues.push({
      id: uuid(),
      ruleId: 'no-tests',
      type: 'docs',
      severity: 'high',
      title: 'No test files found',
      description: `${codeFiles.length} code files but zero test files. Add unit/integration tests for reliability.`,
    });
  } else if (codeFiles.length > 0 && testFiles.length > 0) {
    const ratio = testFiles.length / codeFiles.length;
    if (ratio < 0.2) {
      issues.push({
        id: uuid(),
        ruleId: 'low-test-ratio',
        type: 'docs',
        severity: 'medium',
        title: `Low test coverage: ${testFiles.length} tests for ${codeFiles.length} source files (${Math.round(ratio * 100)}%)`,
        description: 'Aim for at least 1 test file per 3-5 source files. Focus on business logic and API endpoints first.',
      });
    }
  }

  return issues;
}

function checkReadmeCompleteness(readme: RepoFile): Issue[] {
  const issues: Issue[] = [];
  const content = readme.content;
  const missingSections: string[] = [];

  for (const section of README_SECTIONS) {
    if (!section.pattern.test(content)) {
      missingSections.push(section.name);
    }
  }

  // Short README
  if (content.length < 200) {
    issues.push({
      id: uuid(),
      ruleId: 'short-readme',
      type: 'docs',
      severity: 'medium',
      title: 'README is very short',
      description: 'A good README should have at least: project description, installation steps, usage examples, and license info.',
      file: readme.path,
    });
  }

  if (missingSections.length > 3) {
    issues.push({
      id: uuid(),
      ruleId: 'incomplete-readme',
      type: 'docs',
      severity: 'medium',
      title: `README missing sections: ${missingSections.join(', ')}`,
      description: 'A complete README improves adoption and contributor experience. Add the missing sections.',
      file: readme.path,
    });
  }

  return issues;
}
