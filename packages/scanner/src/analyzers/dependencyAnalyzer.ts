import { v4 as uuid } from 'uuid';
import type { RepoFile, Issue } from '@introspect/core-types';

const DEPRECATED_PACKAGES: Record<string, string> = {
  // Node.js
  'request': 'Use axios, node-fetch, or undici instead',
  'node-uuid': 'Renamed to uuid',
  'nomnom': 'Use commander or yargs',
  'node-sass': 'Use sass (dart-sass) instead',
  'tslint': 'Migrated to eslint with @typescript-eslint',
  'istanbul': 'Use nyc or c8',
  'mocha': 'Consider vitest or jest for modern projects',
  'bower': 'Use npm/pnpm instead',
  'gulp': 'Consider modern bundlers (Vite, esbuild)',
  'webpack': 'Consider Vite or Turbopack for new projects',
  'create-react-app': 'Deprecated — use Vite or Next.js',
  'react-scripts': 'Deprecated — use Vite or Next.js',
  'querystring': 'Use URLSearchParams (built-in)',
  'left-pad': 'Use String.prototype.padStart()',
  'moment': 'Use date-fns, dayjs, or Temporal API',
  'underscore': 'Use native JS methods or lodash-es',

  // Python
  'nose': 'Use pytest instead',
  'distribute': 'Use setuptools',
  'pep8': 'Renamed to pycodestyle',

  // PHP
  'phpunit/dbunit': 'Abandoned, use alternative',
};

const KNOWN_VULNERABLE_PATTERNS: { name: string; versions: string; cve: string; severity: string }[] = [
  { name: 'lodash', versions: '<4.17.21', cve: 'CVE-2021-23337', severity: 'high' },
  { name: 'minimist', versions: '<1.2.6', cve: 'CVE-2021-44906', severity: 'critical' },
  { name: 'json5', versions: '<2.2.2', cve: 'CVE-2022-46175', severity: 'high' },
  { name: 'express', versions: '<4.19.2', cve: 'CVE-2024-29041', severity: 'medium' },
  { name: 'axios', versions: '<1.6.0', cve: 'CVE-2023-45857', severity: 'medium' },
  { name: 'jsonwebtoken', versions: '<9.0.0', cve: 'CVE-2022-23529', severity: 'high' },
  { name: 'semver', versions: '<7.5.2', cve: 'CVE-2022-25883', severity: 'medium' },
  { name: 'tar', versions: '<6.2.1', cve: 'CVE-2024-28863', severity: 'high' },
];

export function runDependencyAnalyzer(files: RepoFile[]): Issue[] {
  const issues: Issue[] = [];

  for (const file of files) {
    const fileName = file.path.split('/').pop() ?? '';

    if (fileName === 'package.json') {
      issues.push(...analyzePackageJson(file));
    } else if (fileName === 'requirements.txt') {
      issues.push(...analyzeRequirementsTxt(file));
    } else if (fileName === 'composer.json') {
      issues.push(...analyzeComposerJson(file));
    } else if (fileName === 'Gemfile') {
      issues.push(...analyzeGemfile(file));
    }
  }

  return issues;
}

function analyzePackageJson(file: RepoFile): Issue[] {
  const issues: Issue[] = [];

  try {
    const pkg = JSON.parse(file.content) as Record<string, unknown>;
    const allDeps = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      ...(pkg.devDependencies as Record<string, string> | undefined),
    };

    for (const [name, version] of Object.entries(allDeps)) {
      // Check deprecated
      if (DEPRECATED_PACKAGES[name]) {
        issues.push({
          id: uuid(),
          ruleId: 'deprecated-package',
          type: 'dependency',
          severity: 'medium',
          title: `Deprecated: ${name}`,
          description: DEPRECATED_PACKAGES[name]!,
          file: file.path,
          badCode: `"${name}": "${version}"`,
          goodCode: DEPRECATED_PACKAGES[name],
        });
      }

      // Check known vulnerabilities
      for (const vuln of KNOWN_VULNERABLE_PATTERNS) {
        if (name === vuln.name) {
          issues.push({
            id: uuid(),
            ruleId: 'vulnerable-package',
            type: 'dependency',
            severity: vuln.severity as 'critical' | 'high' | 'medium' | 'low',
            title: `Known vulnerability: ${name} (${vuln.cve})`,
            description: `${name}@${version} may be affected. Vulnerable versions: ${vuln.versions}. Update to the latest version.`,
            file: file.path,
            badCode: `"${name}": "${version}"`,
            goodCode: `"${name}": "latest" — run npm audit for details`,
          });
        }
      }

      // Check wildcard versions
      if (version === '*' || version === 'latest') {
        issues.push({
          id: uuid(),
          ruleId: 'wildcard-version',
          type: 'dependency',
          severity: 'medium',
          title: `Wildcard version: ${name}@${version}`,
          description: 'Unpinned versions can break builds. Pin to a specific semver range.',
          file: file.path,
          badCode: `"${name}": "${version}"`,
          goodCode: `"${name}": "^x.y.z"`,
        });
      }
    }

    // Check for missing lock file indicators
    if (!pkg.packageManager && !pkg.engines) {
      issues.push({
        id: uuid(),
        ruleId: 'missing-engine-pin',
        type: 'dependency',
        severity: 'low',
        title: 'No engines or packageManager field',
        description: 'Pin Node.js version in "engines" or use "packageManager" field to ensure consistent builds.',
        file: file.path,
      });
    }
  } catch {
    // Skip malformed JSON
  }

  return issues;
}

function analyzeRequirementsTxt(file: RepoFile): Issue[] {
  const issues: Issue[] = [];
  const lines = file.content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (!line || line.startsWith('#')) continue;

    const nameMatch = line.match(/^([a-zA-Z0-9_-]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1]!;

    // Check deprecated
    if (DEPRECATED_PACKAGES[name]) {
      issues.push({
        id: uuid(),
        ruleId: 'deprecated-package',
        type: 'dependency',
        severity: 'medium',
        title: `Deprecated: ${name}`,
        description: DEPRECATED_PACKAGES[name]!,
        file: file.path,
        line: i + 1,
      });
    }

    // Check unpinned
    if (!line.includes('==') && !line.includes('>=') && !line.includes('~=')) {
      issues.push({
        id: uuid(),
        ruleId: 'unpinned-version',
        type: 'dependency',
        severity: 'low',
        title: `Unpinned version: ${name}`,
        description: 'Pin dependency versions for reproducible builds (use ==x.y.z).',
        file: file.path,
        line: i + 1,
        badCode: name,
        goodCode: `${name}==x.y.z`,
      });
    }
  }

  return issues;
}

function analyzeComposerJson(file: RepoFile): Issue[] {
  const issues: Issue[] = [];

  try {
    const pkg = JSON.parse(file.content) as Record<string, unknown>;
    const deps = pkg.require as Record<string, string> | undefined;
    if (!deps) return issues;

    for (const [name, version] of Object.entries(deps)) {
      if (version === '*' || version === 'dev-master') {
        issues.push({
          id: uuid(),
          ruleId: 'wildcard-version',
          type: 'dependency',
          severity: 'medium',
          title: `Unpinned version: ${name}@${version}`,
          description: 'Pin to a specific semver range for reproducible builds.',
          file: file.path,
          badCode: `"${name}": "${version}"`,
          goodCode: `"${name}": "^x.y.z"`,
        });
      }
    }
  } catch {
    // Skip malformed JSON
  }

  return issues;
}

function analyzeGemfile(file: RepoFile): Issue[] {
  const issues: Issue[] = [];
  const lines = file.content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (!line || line.startsWith('#')) continue;

    const gemMatch = line.match(/gem\s+['"]([^'"]+)['"]\s*$/);
    if (gemMatch) {
      issues.push({
        id: uuid(),
        ruleId: 'unpinned-version',
        type: 'dependency',
        severity: 'low',
        title: `Unpinned gem: ${gemMatch[1]}`,
        description: 'Pin gem versions for reproducible builds.',
        file: file.path,
        line: i + 1,
      });
    }
  }

  return issues;
}
