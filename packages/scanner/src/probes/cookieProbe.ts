import { v4 as uuid } from 'uuid';
import type { LiveScanTarget, LiveFinding } from './types';

export async function runCookieProbe(target: LiveScanTarget): Promise<LiveFinding[]> {
  const findings: LiveFinding[] = [];

  try {
    const res = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    const setCookies = res.headers.getSetCookie?.() ?? [];

    for (const cookie of setCookies) {
      const name = cookie.split('=')[0]?.trim() ?? 'unknown';
      const lower = cookie.toLowerCase();
      const isSession = name.toLowerCase().includes('session') || name.toLowerCase().includes('token') || name.toLowerCase().includes('auth') || name.toLowerCase().includes('sid');

      if (isSession) {
        if (!lower.includes('httponly')) {
          findings.push({
            id: uuid(),
            probe: 'cookies',
            severity: 'high',
            title: `Session cookie "${name}" missing HttpOnly flag`,
            description: 'Without HttpOnly, JavaScript can read this cookie via document.cookie. If XSS occurs, attackers steal session tokens and hijack user accounts.',
            evidence: cookie,
            recommendation: 'Add HttpOnly flag to all session/auth cookies.',
          });
        }

        if (!lower.includes('secure')) {
          findings.push({
            id: uuid(),
            probe: 'cookies',
            severity: 'high',
            title: `Session cookie "${name}" missing Secure flag`,
            description: 'Without Secure flag, the cookie is sent over HTTP (unencrypted). Attackers on the same network can intercept session tokens.',
            evidence: cookie,
            recommendation: 'Add Secure flag to all session/auth cookies.',
          });
        }

        if (!lower.includes('samesite')) {
          findings.push({
            id: uuid(),
            probe: 'cookies',
            severity: 'medium',
            title: `Session cookie "${name}" missing SameSite attribute`,
            description: 'Without SameSite, the cookie is sent with cross-site requests, enabling CSRF attacks where malicious sites perform actions on behalf of authenticated users.',
            evidence: cookie,
            recommendation: 'Add SameSite=Lax or SameSite=Strict to session cookies.',
          });
        }
      }
    }
  } catch {
    // Connection failed — skip
  }

  return findings;
}
