import type { AiProvider, ScanResult } from '@introspect/core-types';

const SYSTEM_PROMPT = `You are a code archaeologist who reads codebases like fingerprints. Your job is "Code DNA" — you analyze coding patterns, style fingerprints, and tech preferences to create a unique profile of a codebase.

Rules:
1. Identify dominant coding patterns (OOP vs functional, monolith vs modular, etc.).
2. Detect framework preferences and how idiomatically they are used.
3. Assess coding style traits: naming conventions, file organization, abstraction level.
4. Calculate and explain a consistency score (0-100) — how uniform is the style across the codebase?
5. Highlight "genetic markers" — unique patterns that make this codebase distinctive.
6. Note style conflicts or mixed paradigms that create friction.
7. Use markdown formatting with clear sections.
8. Be specific — reference actual files, patterns, and data from the scan.
9. Keep it concise and insightful — no fluff.`;

function buildUserPrompt(scanResult: ScanResult): string {
  const issuesByType = scanResult.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  const styleIssues = scanResult.issues
    .filter((i) => i.type === 'quality' || i.type === 'duplication' || i.type === 'dead_code')
    .slice(0, 15)
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title} — ${i.file || 'general'}`)
    .join('\n');

  return `Analyze this codebase's DNA — its coding patterns, style fingerprints, and tech preferences:

Repository: ${scanResult.repoName}
Overall Health Score: ${scanResult.overallScore}/100
Files: ${scanResult.totalFiles} | Lines: ${scanResult.totalLines}
Languages: ${scanResult.languages.join(', ')}

Category Scores:
- Code Quality: ${scanResult.scores.quality}/100
- Duplication: ${scanResult.scores.duplication}/100
- Dead Code: ${scanResult.scores.deadCode}/100
- Dependencies: ${scanResult.scores.dependencies}/100
- Documentation: ${scanResult.scores.docs}/100

Issues by Type: ${JSON.stringify(issuesByType)}
Total Issues: ${scanResult.issues.length}

Style & Quality Issues:
${styleIssues || 'None found'}

Summary: ${scanResult.summary}

Provide:
1. Dominant Patterns (OOP/functional/mixed, architecture style, abstraction level)
2. Framework & Tech Preferences (what's used, how idiomatically)
3. Coding Style Traits (naming, file organization, comment habits)
4. Consistency Score (0-100) with explanation
5. Genetic Markers (what makes this codebase unique)
6. Style Conflicts (mixed paradigms, inconsistencies that create friction)`;
}

export async function generateCodeDna(
  provider: AiProvider,
  scanResult: ScanResult,
): Promise<string> {
  return provider.chat(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}

export async function* streamCodeDna(
  provider: AiProvider,
  scanResult: ScanResult,
): AsyncIterable<string> {
  yield* provider.chatStream(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}
