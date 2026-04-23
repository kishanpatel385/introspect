import type { AiProvider, ScanResult } from '@introspect/core-types';

const SYSTEM_PROMPT = `You are a senior engineering interviewer who crafts technical interview questions based on real codebases. Your questions test whether a candidate truly understands the technologies and patterns used in a specific project.

Rules:
1. Generate questions relevant to the actual technologies and patterns found in the repo.
2. Mix difficulty levels: 2 warm-up, 3 intermediate, 2 advanced, 1 architecture-level.
3. Each question should reference a real pattern or technology from the scan data.
4. Include a brief "what to look for" hint for the interviewer (not the answer).
5. Questions should test understanding, not trivia — focus on "why" and "how" over "what."
6. Group questions by topic (e.g., framework, patterns, security, performance).
7. Use markdown formatting with clear sections.
8. Be specific to THIS codebase — generic questions are useless.`;

function buildUserPrompt(scanResult: ScanResult): string {
  const issuesByType = scanResult.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  const topIssues = scanResult.issues
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 10)
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title} (${i.type}) — ${i.file || 'general'}`)
    .join('\n');

  return `Generate technical interview questions based on this codebase:

Repository: ${scanResult.repoName}
Overall Health Score: ${scanResult.overallScore}/100
Files: ${scanResult.totalFiles} | Lines: ${scanResult.totalLines}
Languages: ${scanResult.languages.join(', ')}

Category Scores:
- Security: ${scanResult.scores.security}/100
- Performance: ${scanResult.scores.performance}/100
- Code Quality: ${scanResult.scores.quality}/100
- Dependencies: ${scanResult.scores.dependencies}/100
- Documentation: ${scanResult.scores.docs}/100
- Git Health: ${scanResult.scores.gitHealth}/100

Issues by Type: ${JSON.stringify(issuesByType)}
Total Issues: ${scanResult.issues.length}

Top Issues:
${topIssues || 'None found'}

Summary: ${scanResult.summary}

Generate interview questions that:
1. Test understanding of the specific languages and frameworks used (${scanResult.languages.join(', ')})
2. Probe knowledge of patterns found in the scan (good and bad)
3. Assess ability to solve the actual issues detected
4. Evaluate architecture and design thinking relevant to this project
5. Include "what to look for" hints for the interviewer`;
}

export async function generateInterviewQuestions(
  provider: AiProvider,
  scanResult: ScanResult,
): Promise<string> {
  return provider.chat(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}

export async function* streamInterviewQuestions(
  provider: AiProvider,
  scanResult: ScanResult,
): AsyncIterable<string> {
  yield* provider.chatStream(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}
