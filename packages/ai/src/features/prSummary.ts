import type { AiProvider, ScanResult } from '@introspect/core-types';

const SYSTEM_PROMPT = `You are a senior engineer writing a pull request description based on code scan results.

Rules:
1. Use the exact format: ## Summary, ## Issues Found, ## Recommendations, ## Risk Assessment.
2. Be concise — bullet points over paragraphs.
3. In Issues Found, group by severity and include file references.
4. Risk Assessment should be one of: Low, Medium, High, Critical — with a brief justification.
5. Keep the entire PR description under 500 words.
6. Use markdown formatting.`;

function buildUserPrompt(scanResult: ScanResult): string {
  const issuesBySeverity = scanResult.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {});

  const topIssues = scanResult.issues
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 10)
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title} — ${i.file || 'general'}${i.line ? `:${i.line}` : ''}`)
    .join('\n');

  return `Generate a PR description summarizing these scan findings:

Repository: ${scanResult.repoName}
Overall Score: ${scanResult.overallScore}/100
Files Scanned: ${scanResult.totalFiles}
Languages: ${scanResult.languages.join(', ')}

Category Scores:
- Security: ${scanResult.scores.security}/100
- Performance: ${scanResult.scores.performance}/100
- Code Quality: ${scanResult.scores.quality}/100
- Duplication: ${scanResult.scores.duplication}/100
- Dead Code: ${scanResult.scores.deadCode}/100
- Dependencies: ${scanResult.scores.dependencies}/100
- Documentation: ${scanResult.scores.docs}/100
- Git Health: ${scanResult.scores.gitHealth}/100

Issues by Severity: ${JSON.stringify(issuesBySeverity)}
Total Issues: ${scanResult.issues.length}

Top Critical/High Issues:
${topIssues || 'None found'}

Summary: ${scanResult.summary}`;
}

export async function generatePrSummary(
  provider: AiProvider,
  scanResult: ScanResult,
): Promise<string> {
  return provider.chat(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}

export async function* streamPrSummary(
  provider: AiProvider,
  scanResult: ScanResult,
): AsyncIterable<string> {
  yield* provider.chatStream(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}
