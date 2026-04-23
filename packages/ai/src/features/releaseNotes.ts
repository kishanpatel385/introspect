import type { AiProvider, ScanResult } from '@introspect/core-types';

const SYSTEM_PROMPT = `You are generating release notes based on a codebase scan.

Rules:
1. Write like a changelog entry — clear, structured, useful.
2. Start with a health summary badge: Healthy / Needs Attention / Critical.
3. Group findings into: Highlights, Issues Found, Recommended Actions.
4. Be specific — reference actual scores, issue counts, and categories.
5. Keep the tone professional but approachable.
6. End with clear "Recommended Next Steps" (prioritized).
7. Use markdown formatting.
8. Keep it to one page — no one reads long release notes.`;

function buildUserPrompt(scanResult: ScanResult): string {
  const criticalCount = scanResult.issues.filter((i) => i.severity === 'critical').length;
  const highCount = scanResult.issues.filter((i) => i.severity === 'high').length;
  const mediumCount = scanResult.issues.filter((i) => i.severity === 'medium').length;

  const issuesByType = scanResult.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  const topIssues = scanResult.issues
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 8)
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title} — ${i.type}${i.file ? ` (${i.file})` : ''}`)
    .join('\n');

  return `Generate release notes from this scan.

Repository: ${scanResult.repoName}
Scanned At: ${scanResult.scannedAt}
Overall Score: ${scanResult.overallScore}/100

Category Scores:
- Security: ${scanResult.scores.security}/100
- Performance: ${scanResult.scores.performance}/100
- Code Quality: ${scanResult.scores.quality}/100
- Duplication: ${scanResult.scores.duplication}/100
- Dead Code: ${scanResult.scores.deadCode}/100
- Dependencies: ${scanResult.scores.dependencies}/100
- Documentation: ${scanResult.scores.docs}/100
- Git Health: ${scanResult.scores.gitHealth}/100

Files: ${scanResult.totalFiles} | Lines: ${scanResult.totalLines}
Languages: ${scanResult.languages.join(', ')}

Issue Breakdown: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${scanResult.issues.length} total
Issues by Type: ${JSON.stringify(issuesByType)}

Top Issues:
${topIssues || 'No critical or high issues found'}

Summary: ${scanResult.summary}

Generate release notes with:
1. Health Status Badge
2. Scan Highlights (what's going well)
3. Issues Found (grouped by severity)
4. Recommended Next Steps (prioritized)`;
}

export async function generateReleaseNotes(
  provider: AiProvider,
  scanResult: ScanResult,
): Promise<string> {
  return provider.chat(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}

export async function* streamReleaseNotes(
  provider: AiProvider,
  scanResult: ScanResult,
): AsyncIterable<string> {
  yield* provider.chatStream(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}
