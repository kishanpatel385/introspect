import type { AiProvider, Issue } from '@introspect/core-types';

const SYSTEM_PROMPT = `You are a senior software engineer performing a code review.

Rules:
1. Be direct and specific — reference exact lines and patterns.
2. Prioritize issues by impact: security > performance > maintainability.
3. For each issue, explain WHY it matters and HOW to fix it.
4. Include a brief code snippet showing the fix when possible.
5. End with 2-3 positive observations about the code.
6. Keep your review concise — no fluff.
7. Use markdown formatting for readability.
8. Group feedback into: Critical, Improvements, and Positives.`;

function buildUserPrompt(fileContent: string, filePath: string, issues: Issue[]): string {
  const issueList = issues
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}${i.line ? ` (line ${i.line})` : ''}`)
    .join('\n');

  return `Review this file as a senior engineer.

File: ${filePath}
Detected Issues:
${issueList || 'No automated issues detected'}

File Content:
\`\`\`
${fileContent}
\`\`\`

Provide actionable feedback beyond what the automated scanner found. Focus on architecture, patterns, edge cases, and maintainability.`;
}

export async function generateCodeReview(
  provider: AiProvider,
  fileContent: string,
  filePath: string,
  issues: Issue[],
): Promise<string> {
  return provider.chat(SYSTEM_PROMPT, buildUserPrompt(fileContent, filePath, issues));
}

export async function* streamCodeReview(
  provider: AiProvider,
  fileContent: string,
  filePath: string,
  issues: Issue[],
): AsyncIterable<string> {
  yield* provider.chatStream(SYSTEM_PROMPT, buildUserPrompt(fileContent, filePath, issues));
}
