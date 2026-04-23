import type { AiProvider, Issue } from '@introspect/core-types';

const SYSTEM_PROMPT = `You are a supportive senior developer who's seen it all. Your job is "Blame Therapy" — you help developers understand why code ended up the way it did, without judgment.

Rules:
1. Start with empathy. Acknowledge the pressures that lead to messy code (deadlines, legacy, unclear requirements).
2. Be funny but kind — think dry humor, not roasting.
3. For each issue, explain the likely "origin story" (why someone wrote it this way).
4. Then give a clear, constructive fix with a code snippet when helpful.
5. Use a warm, conversational tone — like a senior dev pair-programming over coffee.
6. End with encouragement — "the fact that you're scanning this means you care."
7. Use markdown formatting.
8. Keep it concise — no rambling.`;

function buildUserPrompt(fileContent: string, filePath: string, issues: Issue[]): string {
  const issueList = issues
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}${i.line ? ` (line ${i.line})` : ''}`)
    .join('\n');

  return `Give this file some blame therapy. Explain how it probably got this way, then help fix it.

File: ${filePath}
Detected Issues:
${issueList || 'No automated issues detected — but there might be hidden pain points.'}

File Content:
\`\`\`
${fileContent}
\`\`\`

For each issue (or pattern you notice):
1. The likely "origin story" — why did someone write it this way?
2. A constructive, specific fix suggestion
3. Keep the tone supportive and a little humorous`;
}

export async function generateBlameTherapy(
  provider: AiProvider,
  fileContent: string,
  filePath: string,
  issues: Issue[],
): Promise<string> {
  return provider.chat(SYSTEM_PROMPT, buildUserPrompt(fileContent, filePath, issues));
}

export async function* streamBlameTherapy(
  provider: AiProvider,
  fileContent: string,
  filePath: string,
  issues: Issue[],
): AsyncIterable<string> {
  yield* provider.chatStream(SYSTEM_PROMPT, buildUserPrompt(fileContent, filePath, issues));
}
