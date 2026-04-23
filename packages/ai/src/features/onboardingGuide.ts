import type { AiProvider, ScanResult } from '@introspect/core-types';

const SYSTEM_PROMPT = `You are writing a new developer onboarding guide for a codebase.

Rules:
1. Write for a competent developer who's never seen this repo before.
2. Start with "What does this project do?" in 2-3 sentences.
3. Explain the architecture and folder structure clearly.
4. Highlight key files a new dev should read first.
5. Document common patterns and conventions used in the codebase.
6. List gotchas — things that aren't obvious but will trip you up.
7. Be practical, not theoretical. Think "first week survival guide."
8. Use markdown formatting with clear sections.
9. Keep it scannable — bullet points over paragraphs.`;

function buildUserPrompt(scanResult: ScanResult): string {
  const issuesByType = scanResult.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  const qualityIssues = scanResult.issues
    .filter((i) => i.type === 'quality' || i.type === 'docs')
    .slice(0, 10)
    .map((i) => `- ${i.title}${i.file ? ` (${i.file})` : ''}`)
    .join('\n');

  return `Generate a new developer onboarding guide for this repository.

Repository: ${scanResult.repoName}
Overall Score: ${scanResult.overallScore}/100
Files: ${scanResult.totalFiles} | Lines: ${scanResult.totalLines}
Languages: ${scanResult.languages.join(', ')}
Scan Mode: ${scanResult.scanMode}

Category Scores:
- Code Quality: ${scanResult.scores.quality}/100
- Documentation: ${scanResult.scores.docs}/100
- Duplication: ${scanResult.scores.duplication}/100
- Dead Code: ${scanResult.scores.deadCode}/100
- Git Health: ${scanResult.scores.gitHealth}/100

Issues by Type: ${JSON.stringify(issuesByType)}

Quality & Documentation Issues:
${qualityIssues || 'None found'}

Summary: ${scanResult.summary}

Create an onboarding guide with:
1. Project Overview (what it does, who it's for)
2. Architecture & Folder Structure
3. Key Files to Read First
4. Common Patterns & Conventions
5. Development Workflow (how to run, test, deploy)
6. Gotchas & Things That Will Trip You Up
7. Where to Ask for Help`;
}

export async function generateOnboardingGuide(
  provider: AiProvider,
  scanResult: ScanResult,
): Promise<string> {
  return provider.chat(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}

export async function* streamOnboardingGuide(
  provider: AiProvider,
  scanResult: ScanResult,
): AsyncIterable<string> {
  yield* provider.chatStream(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}
