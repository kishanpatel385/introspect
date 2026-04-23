import type { AiProvider, ScanResult } from '@introspect/core-types';

const SYSTEM_PROMPT = `You are a seasoned CTO reviewing a codebase for strategic decision-making.

Rules:
1. Think like a CTO — balance technical excellence with business reality.
2. Prioritize what to fix NOW vs. what can wait.
3. Assess technical debt honestly with estimated effort levels (low/medium/high).
4. Give architecture recommendations backed by the scan data.
5. Include team scaling advice — what skills are needed, where bottlenecks will appear.
6. Be concise and opinionated. No wishy-washy advice.
7. Use markdown formatting with clear sections.
8. End with a "Next Quarter Priorities" section (3-5 items, ranked).`;

function buildUserPrompt(scanResult: ScanResult): string {
  const criticalCount = scanResult.issues.filter((i) => i.severity === 'critical').length;
  const highCount = scanResult.issues.filter((i) => i.severity === 'high').length;

  const issuesByType = scanResult.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  const topIssues = scanResult.issues
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 15)
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title} (${i.type}) — ${i.file || 'general'}`)
    .join('\n');

  return `Act as CTO and give strategic advice for this codebase:

Repository: ${scanResult.repoName}
Overall Health Score: ${scanResult.overallScore}/100
Files: ${scanResult.totalFiles} | Lines: ${scanResult.totalLines}
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

Critical Issues: ${criticalCount} | High Issues: ${highCount} | Total: ${scanResult.issues.length}
Issues by Type: ${JSON.stringify(issuesByType)}

Top Issues:
${topIssues || 'None found'}

Summary: ${scanResult.summary}

Provide:
1. Executive Summary (2-3 sentences)
2. Technical Debt Assessment (what's costing the team time)
3. Architecture Recommendations
4. Security & Risk Posture
5. Team Scaling Advice (what roles/skills to hire for)
6. Next Quarter Priorities (ranked)`;
}

export async function generateShadowCtoAdvice(
  provider: AiProvider,
  scanResult: ScanResult,
): Promise<string> {
  return provider.chat(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}

export async function* streamShadowCtoAdvice(
  provider: AiProvider,
  scanResult: ScanResult,
): AsyncIterable<string> {
  yield* provider.chatStream(SYSTEM_PROMPT, buildUserPrompt(scanResult));
}
