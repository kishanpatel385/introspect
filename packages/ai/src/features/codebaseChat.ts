import type { AiProvider, ScanResult } from '@introspect/core-types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildSystemPrompt(repoName: string): string {
  return `You are an expert code analyst. You have access to scan results for ${repoName}. Answer questions about the codebase health, issues found, and recommendations.

Rules:
1. Be specific — reference actual data from the scan results.
2. When discussing issues, mention severity, file, and line when available.
3. Keep answers concise and actionable.
4. If the user asks about something not covered by the scan data, say so honestly.
5. Use markdown formatting for readability.`;
}

function buildContext(scanResult: ScanResult): string {
  const issuesByType = scanResult.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  const topIssues = scanResult.issues
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 15)
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title} (${i.type}) — ${i.file || 'general'}${i.line ? `:${i.line}` : ''}`)
    .join('\n');

  return `Scan Data:
Repository: ${scanResult.repoName}
Overall Score: ${scanResult.overallScore}/100
Files: ${scanResult.totalFiles} | Lines: ${scanResult.totalLines}
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
${topIssues || 'None found'}

Summary: ${scanResult.summary}`;
}

function buildUserPrompt(scanResult: ScanResult, userMessage: string, history?: ChatMessage[]): string {
  const context = buildContext(scanResult);
  const historyText = history?.length
    ? '\n\nConversation History:\n' + history.map((m) => `${m.role}: ${m.content}`).join('\n')
    : '';

  return `${context}${historyText}

User Question: ${userMessage}`;
}

export async function generateChatResponse(
  provider: AiProvider,
  scanResult: ScanResult,
  userMessage: string,
  history?: ChatMessage[],
): Promise<string> {
  return provider.chat(
    buildSystemPrompt(scanResult.repoName),
    buildUserPrompt(scanResult, userMessage, history),
  );
}

export async function* streamChatResponse(
  provider: AiProvider,
  scanResult: ScanResult,
  userMessage: string,
  history?: ChatMessage[],
): AsyncIterable<string> {
  yield* provider.chatStream(
    buildSystemPrompt(scanResult.repoName),
    buildUserPrompt(scanResult, userMessage, history),
  );
}

export type { ChatMessage };
