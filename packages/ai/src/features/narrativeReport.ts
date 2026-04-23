import type { AiProvider, ScanResult } from '@introspect/core-types';

const SYSTEM_PROMPT = `You are an expert code analyst writing a friendly, human-readable report.

Rules:
1. Write like you're explaining to a smart colleague — no jargon without explanation.
2. Start with a TL;DR section (2-3 bullet points).
3. Use real file names, line numbers, and data from the scan.
4. Every section ends with specific, actionable next steps.
5. Be warm and helpful, not corporate.
6. Use analogies to explain complex issues.
7. Keep sentences short — one idea per sentence.
8. Output plain text with markdown formatting.
9. Keep the report between 2-3 paragraphs after the TL;DR.`;

function buildUserPrompt(scanResult: ScanResult): string {
  const issuesByType = scanResult.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  const criticalIssues = scanResult.issues
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 10)
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title} (${i.file || 'general'}${i.line ? `:${i.line}` : ''})`)
    .join('\n');

  return `Analyze this scan result and write a narrative report:

Repository: ${scanResult.repoName}
Overall Score: ${scanResult.overallScore}/100
Files Scanned: ${scanResult.totalFiles}
Total Lines: ${scanResult.totalLines}
Languages: ${scanResult.languages.join(', ')}
Scan Mode: ${scanResult.scanMode}

Category Scores:
- Security: ${scanResult.scores.security}/100
- Performance: ${scanResult.scores.performance}/100
- Code Quality: ${scanResult.scores.quality}/100
- Duplication: ${scanResult.scores.duplication}/100
- Dead Code: ${scanResult.scores.deadCode}/100
- Dependencies: ${scanResult.scores.dependencies}/100
- Documentation: ${scanResult.scores.docs}/100
- Git Health: ${scanResult.scores.gitHealth}/100

Issues by Type: ${JSON.stringify(issuesByType)}
Total Issues: ${scanResult.issues.length}

Top Critical/High Issues:
${criticalIssues || 'None found'}

Summary: ${scanResult.summary}`;
}

export async function generateNarrativeReport(
  provider: AiProvider,
  scanResult: ScanResult,
): Promise<string> {
  return provider.chat(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}

export async function* streamNarrativeReport(
  provider: AiProvider,
  scanResult: ScanResult,
): AsyncIterable<string> {
  yield* provider.chatStream(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}
