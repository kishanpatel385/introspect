import type { Issue, CategoryScores, IssueType } from '@introspect/core-types';

const SEVERITY_WEIGHTS = {
  critical: 15,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
} as const;

const CATEGORY_MAP: Record<IssueType, keyof CategoryScores> = {
  security: 'security',
  performance: 'performance',
  quality: 'quality',
  duplication: 'duplication',
  dead_code: 'deadCode',
  dependency: 'dependencies',
  docs: 'docs',
  git: 'gitHealth',
};

export function scoreFromIssues(issues: Issue[], totalFiles: number): CategoryScores {
  const penalties: Record<keyof CategoryScores, number> = {
    security: 0,
    performance: 0,
    quality: 0,
    duplication: 0,
    deadCode: 0,
    dependencies: 0,
    docs: 0,
    gitHealth: 0,
  };

  for (const issue of issues) {
    const category = CATEGORY_MAP[issue.type];
    if (category) {
      penalties[category] += SEVERITY_WEIGHTS[issue.severity];
    }
  }

  // Normalize: penalty relative to file count (bigger repos = higher tolerance)
  const fileFactor = Math.max(1, Math.log2(totalFiles + 1));

  const scores: CategoryScores = {
    security: 100,
    performance: 100,
    quality: 100,
    duplication: 100,
    deadCode: 100,
    dependencies: 100,
    docs: 100,
    gitHealth: 100,
  };

  for (const key of Object.keys(scores) as (keyof CategoryScores)[]) {
    const normalizedPenalty = penalties[key] / fileFactor;
    scores[key] = Math.max(0, Math.round(100 - normalizedPenalty));
  }

  return scores;
}
