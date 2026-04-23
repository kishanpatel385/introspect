import type { RepoFile, Rule, Issue } from '@introspect/core-types';
import type { GitHistoryData } from '../ingestion/gitHistory';
import { runRegexRules } from './regexAnalyzer';
import { runQualityChecks } from './qualityAnalyzer';
import { runSecretsAnalyzer } from './secretsAnalyzer';
import { runDependencyAnalyzer } from './dependencyAnalyzer';
import { runDeadCodeAnalyzer } from './deadCodeAnalyzer';
import { runDocsAnalyzer } from './docsAnalyzer';
import { runGitAnalyzer } from './gitAnalyzer';

export async function runAnalyzers(
  files: RepoFile[],
  rules: Rule[],
  gitData?: GitHistoryData,
): Promise<Issue[]> {
  const issues: Issue[] = [];

  // 1. Regex-based rules (security, performance patterns from YAML)
  const regexRules = rules.filter((r) => r.pattern && r.pattern.length > 0);
  issues.push(...runRegexRules(files, regexRules));

  // 2. Structural quality checks (line counts, complexity, nesting, magic numbers)
  issues.push(...runQualityChecks(files));

  // 3. Secrets scanner (100+ patterns — AWS, GCP, Stripe, etc.)
  issues.push(...runSecretsAnalyzer(files));

  // 4. Dependency audit (deprecated, vulnerable, unpinned)
  issues.push(...runDependencyAnalyzer(files));

  // 5. Dead code detection (unused imports, empty files, commented-out code)
  issues.push(...runDeadCodeAnalyzer(files));

  // 6. Documentation & test gaps (README completeness, missing tests)
  issues.push(...runDocsAnalyzer(files));

  // 7. Git intelligence (bus factor, hotspots, velocity, stale code, team balance)
  if (gitData) {
    issues.push(...runGitAnalyzer(gitData));
  }

  // Deduplicate by file + line + ruleId
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.ruleId}:${issue.file}:${issue.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
