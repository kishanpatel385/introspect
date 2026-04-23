import type {
  ScanRequest,
  ScanResult,
  Issue,
  RepoFile,
} from '@introspect/core-types';
import { ingest } from './ingestion';
import { repoMeta } from './ingestion/github';
import { loadRules, loadCustomRulesFromFiles, loadCustomRulesFromLocal } from './rules/loader';
import { runAnalyzers } from './analyzers';
import { scoreFromIssues } from './scoring/calculator';
import { fetchGitHistory } from './ingestion/gitHistory';
import { fetchLocalGitHistory } from './ingestion/gitLocal';
import type { GitDetailedData } from './ingestion/gitLocal';
import { parseIgnoreFile, shouldIgnoreFile, shouldIgnoreRule } from './ignore';

export type ProgressCallback = (step: string, meta?: Record<string, unknown>) => void;

export async function scan(
  request: ScanRequest,
  onProgress?: ProgressCallback,
): Promise<ScanResult> {
  const startTime = Date.now();
  const emit = onProgress ?? (() => {});

  // Step 1: Ingest files + git history in PARALLEL
  emit('Fetching repository contents', { filesScanned: 0, totalFiles: 0 });

  const gitPromise = request.source.type === 'github'
    ? fetchGitHistory(request.source).catch(() => undefined)
    : request.source.type === 'local'
    ? fetchLocalGitHistory(request.source.path).then((r) => r ?? undefined).catch(() => undefined)
    : Promise.resolve(undefined);

  const [files, gitData] = await Promise.all([
    ingest(request.source, (downloaded, total) => {
      emit('Fetching repository contents', { filesScanned: downloaded, totalFiles: total });
    }),
    gitPromise,
  ]);

  const totalRepoFiles = request.source.type === 'github' ? repoMeta.totalFiles : undefined;

  // Step 2: Parse .introspectignore (if present)
  const ignoreFile = files.find((f) => f.path === '.introspectignore');
  const ignoreConfig = ignoreFile
    ? parseIgnoreFile(ignoreFile.content)
    : { rules: [] as string[], paths: [] as string[] };

  // Filter out ignored files
  const filteredFiles = ignoreConfig.paths.length > 0
    ? files.filter((f) => !shouldIgnoreFile(f.path, ignoreConfig.paths))
    : files;

  // Step 3: Load rules (built-in + custom)
  emit('Scanning for security vulnerabilities', { filesScanned: filteredFiles.length, totalFiles: totalRepoFiles });
  const detectedLanguages = detectLanguages(filteredFiles);
  const builtInRules = await loadRules(detectedLanguages);

  const customRules = request.source.type === 'local'
    ? await loadCustomRulesFromLocal(request.source.path, detectedLanguages)
    : loadCustomRulesFromFiles(files, detectedLanguages);

  const allRules = [...builtInRules, ...customRules];

  // Filter out ignored rules
  const activeRules = ignoreConfig.rules.length > 0
    ? allRules.filter((r) => !shouldIgnoreRule(r.id, ignoreConfig.rules))
    : allRules;

  // Step 4: Run analyzers
  emit('Detecting performance issues', { filesScanned: filteredFiles.length, totalFiles: totalRepoFiles });
  emit('Analyzing code quality');
  emit('Checking dependencies');
  emit('Reviewing documentation');
  const rawIssues = await runAnalyzers(filteredFiles, activeRules, gitData);

  // Filter out issues from ignored rules (for non-regex analyzers that don't use Rule objects)
  const issues = ignoreConfig.rules.length > 0
    ? rawIssues.filter((i) => !shouldIgnoreRule(i.ruleId, ignoreConfig.rules))
    : rawIssues;

  // Step 5: Build report
  emit('Building report', { issuesFound: issues.length });
  const scores = scoreFromIssues(issues, filteredFiles.length);

  const overallScore = Math.round(
    Object.values(scores).reduce((sum, s) => sum + s, 0) / Object.values(scores).length,
  );

  // Build git intelligence data if available
  const detailedGit = gitData as GitDetailedData | undefined;
  const gitIntelligence = detailedGit?.authorStats ? {
    branches: detailedGit.branches ?? [],
    currentBranch: detailedGit.currentBranch ?? 'unknown',
    totalCommits: detailedGit.totalCommits ?? detailedGit.commits.length,
    contributors: detailedGit.authorStats ?? [],
    recentCommits: (detailedGit.recentCommits ?? []).slice(0, 20).map((c) => ({
      sha: c.sha, shortSha: c.shortSha, author: c.author,
      date: c.date, message: c.message,
      filesChanged: c.filesChanged, insertions: c.insertions, deletions: c.deletions,
    })),
    timeline: detailedGit.commitTimeline ?? [],
    fileBlame: Object.fromEntries(detailedGit.fileBlame ?? new Map()),
  } : undefined;

  return {
    repoName: getRepoName(request),
    scannedAt: new Date().toISOString(),
    overallScore,
    scores,
    summary: buildSummary(issues, overallScore),
    issues,
    totalFiles: filteredFiles.length,
    totalRepoFiles,
    totalLines: filteredFiles.reduce((sum, f) => sum + f.content.split('\n').length, 0),
    languages: detectedLanguages,
    scanMode: request.mode,
    scanDurationMs: Date.now() - startTime,
    gitIntelligence,
  };
}

export function detectLanguages(files: RepoFile[]): string[] {
  const langs = new Set(files.map((f) => f.language).filter(Boolean) as string[]);
  return [...langs];
}

export function getRepoName(request: ScanRequest): string {
  const { source } = request;
  if (source.type === 'github') {
    const match = source.url.match(/github\.com\/([^/]+\/[^/]+)/);
    return match?.[1] ?? source.url;
  }
  if (source.type === 'local') {
    return source.path.split(/[\\/]/).pop() ?? source.path;
  }
  return 'uploaded-repo';
}

export function buildSummary(issues: Issue[], overallScore: number): string {
  const critical = issues.filter((i) => i.severity === 'critical').length;
  const high = issues.filter((i) => i.severity === 'high').length;
  const medium = issues.filter((i) => i.severity === 'medium').length;
  const low = issues.filter((i) => i.severity === 'low').length;
  const total = issues.length;

  const bySev = `${critical} critical, ${high} high, ${medium} medium, ${low} low severity issues detected.`;

  const types = new Map<string, number>();
  for (const i of issues) types.set(i.type, (types.get(i.type) ?? 0) + 1);
  const topTypes = [...types.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, c]) => `${t.replace('_', ' ')} (${c})`)
    .join(', ');

  const topFiles = new Map<string, number>();
  for (const i of issues) { if (i.file) topFiles.set(i.file, (topFiles.get(i.file) ?? 0) + 1); }
  const hotFiles = [...topFiles.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([f]) => f.split('/').pop())
    .join(', ');

  const lines: string[] = [];

  if (overallScore >= 90) {
    lines.push(`Excellent codebase health with a score of ${overallScore}/100.`);
  } else if (overallScore >= 70) {
    lines.push(`Good shape overall — scored ${overallScore}/100.`);
  } else if (overallScore >= 50) {
    lines.push(`Needs attention — scored ${overallScore}/100.`);
  } else {
    lines.push(`Significant issues found — scored ${overallScore}/100. Immediate action recommended.`);
  }

  lines.push(`Found ${total} issues across the codebase: ${bySev}`);

  if (topTypes) lines.push(`Most affected areas: ${topTypes}.`);
  if (hotFiles) lines.push(`Files with most issues: ${hotFiles}.`);

  if (critical > 0) {
    lines.push(`Priority: Fix ${critical} critical issue${critical > 1 ? 's' : ''} first — these represent security risks or major bugs.`);
  } else if (high > 0) {
    lines.push(`Priority: Address ${high} high severity issue${high > 1 ? 's' : ''} to improve overall code health.`);
  } else {
    lines.push('No critical or high severity issues — focus on medium/low items for continuous improvement.');
  }

  return lines.join('\n');
}
