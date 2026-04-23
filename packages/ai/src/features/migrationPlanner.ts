import type { AiProvider, ScanResult } from '@introspect/core-types';

const SYSTEM_PROMPT = `You are an expert software architect specializing in migrations and upgrades.

Rules:
1. Create a realistic, step-by-step migration plan — not wishful thinking.
2. Each step must have: what to do, estimated effort, risk level (low/medium/high), and rollback strategy.
3. Identify breaking changes and compatibility issues upfront.
4. Suggest a phased approach — never "big bang" rewrites.
5. Include a risk matrix: what can go wrong and how to mitigate.
6. Reference specific files, patterns, and dependencies from the scan data.
7. Be honest about complexity. If it's hard, say so.
8. Use markdown formatting with clear phases.
9. End with a timeline estimate and team requirements.`;

function buildUserPrompt(scanResult: ScanResult, targetFramework: string): string {
  const depIssues = scanResult.issues
    .filter((i) => i.type === 'dependency')
    .slice(0, 10)
    .map((i) => `- ${i.title}: ${i.description}`)
    .join('\n');

  return `Create a migration plan for this codebase.

Target Migration: ${targetFramework}

Repository: ${scanResult.repoName}
Overall Score: ${scanResult.overallScore}/100
Files: ${scanResult.totalFiles} | Lines: ${scanResult.totalLines}
Languages: ${scanResult.languages.join(', ')}

Category Scores:
- Security: ${scanResult.scores.security}/100
- Performance: ${scanResult.scores.performance}/100
- Code Quality: ${scanResult.scores.quality}/100
- Dependencies: ${scanResult.scores.dependencies}/100

Total Issues: ${scanResult.issues.length}

Dependency Issues:
${depIssues || 'None detected'}

Summary: ${scanResult.summary}

Provide:
1. Migration Overview (what's changing and why it matters)
2. Pre-Migration Checklist
3. Phased Migration Plan (each phase with steps, effort, risk, rollback)
4. Risk Matrix (risk → impact → mitigation)
5. Timeline Estimate & Team Requirements`;
}

export async function generateMigrationPlan(
  provider: AiProvider,
  scanResult: ScanResult,
  targetFramework: string,
): Promise<string> {
  return provider.chat(SYSTEM_PROMPT, buildUserPrompt(scanResult, targetFramework));
}

export async function* streamMigrationPlan(
  provider: AiProvider,
  scanResult: ScanResult,
  targetFramework: string,
): AsyncIterable<string> {
  yield* provider.chatStream(SYSTEM_PROMPT, buildUserPrompt(scanResult, targetFramework));
}
