import type { AiProvider, ScanResult } from '@introspect/core-types';

const SYSTEM_PROMPT = `You are a staff engineer writing a post-incident report (postmortem) for a codebase. You treat critical and high-severity issues as "incidents" that need formal root cause analysis.

Rules:
1. Format as a professional postmortem — Timeline, Root Cause, Impact, Action Items.
2. Treat each critical/high issue cluster as a separate incident.
3. Be specific — reference actual files, patterns, and scores from the scan.
4. Timeline should trace how the issue likely developed over time.
5. Root Cause should go deeper than the symptom — explain the underlying pattern.
6. Impact should quantify risk in terms of security, reliability, and maintainability.
7. Action Items must be specific, prioritized (P0/P1/P2), and assigned to a category (security, performance, quality).
8. End with "Lessons Learned" — systemic improvements to prevent recurrence.
9. Use markdown formatting. Be direct and concise — no corporate fluff.`;

function buildUserPrompt(scanResult: ScanResult): string {
  const criticalIssues = scanResult.issues.filter((i) => i.severity === 'critical');
  const highIssues = scanResult.issues.filter((i) => i.severity === 'high');

  const incidents = [...criticalIssues, ...highIssues]
    .slice(0, 15)
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title} (${i.type}) — ${i.file || 'general'}${i.line ? `:${i.line}` : ''}: ${i.description}`)
    .join('\n');

  const issuesByType = scanResult.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  return `Write a postmortem report treating critical/high issues as incidents:

Repository: ${scanResult.repoName}
Overall Health Score: ${scanResult.overallScore}/100
Files: ${scanResult.totalFiles} | Lines: ${scanResult.totalLines}
Languages: ${scanResult.languages.join(', ')}

Category Scores:
- Security: ${scanResult.scores.security}/100
- Performance: ${scanResult.scores.performance}/100
- Code Quality: ${scanResult.scores.quality}/100
- Duplication: ${scanResult.scores.duplication}/100
- Dead Code: ${scanResult.scores.deadCode}/100
- Dependencies: ${scanResult.scores.dependencies}/100
- Git Health: ${scanResult.scores.gitHealth}/100

Issues by Type: ${JSON.stringify(issuesByType)}
Critical: ${criticalIssues.length} | High: ${highIssues.length} | Total: ${scanResult.issues.length}

Incidents (Critical + High Issues):
${incidents || 'No critical or high severity issues found — generate a clean-bill-of-health postmortem instead.'}

Summary: ${scanResult.summary}

Generate a postmortem with:
1. Executive Summary (severity, scope, impact)
2. Incident Breakdown (group related issues, trace root causes)
3. Timeline (how these issues likely developed)
4. Impact Assessment (security risk, reliability, maintainability)
5. Action Items (P0/P1/P2, with category and specific fix)
6. Lessons Learned (systemic improvements)`;
}

export async function generatePostmortem(
  provider: AiProvider,
  scanResult: ScanResult,
): Promise<string> {
  return provider.chat(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}

export async function* streamPostmortem(
  provider: AiProvider,
  scanResult: ScanResult,
): AsyncIterable<string> {
  yield* provider.chatStream(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}
