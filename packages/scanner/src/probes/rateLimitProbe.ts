import { v4 as uuid } from 'uuid';
import type { LiveScanTarget, LiveFinding } from './types';

export async function runRateLimitProbe(target: LiveScanTarget): Promise<LiveFinding[]> {
  const findings: LiveFinding[] = [];

  try {
    // Send 5 rapid requests to check for rate limiting
    const promises = Array.from({ length: 5 }, () =>
      fetch(target.url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      }).then((r) => r.status).catch(() => 0),
    );

    const statuses = await Promise.all(promises);
    const has429 = statuses.some((s) => s === 429);
    const allOk = statuses.every((s) => s === 200);

    if (allOk && !has429) {
      // Check for rate limit headers
      const res = await fetch(target.url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      const rateLimitHeader = res.headers.get('x-ratelimit-limit') ?? res.headers.get('ratelimit-limit') ?? res.headers.get('x-rate-limit-limit');
      const retryAfter = res.headers.get('retry-after');

      if (!rateLimitHeader && !retryAfter) {
        findings.push({
          id: uuid(),
          probe: 'rate-limit',
          severity: 'medium',
          title: 'No rate limiting detected',
          description: 'The server does not appear to enforce rate limiting. Without rate limiting, the server is vulnerable to brute-force attacks on login endpoints, credential stuffing, and denial of service through request flooding.',
          recommendation: 'Implement rate limiting. For Express: use express-rate-limit. For nginx: use limit_req_zone. Recommended: 100 requests/minute for general endpoints, 10 requests/minute for login.',
        });
      }
    }
  } catch {
    // Skip on error
  }

  return findings;
}
