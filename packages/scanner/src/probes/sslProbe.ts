import { v4 as uuid } from 'uuid';
import type { LiveScanTarget, LiveFinding } from './types';

export async function runSslProbe(target: LiveScanTarget): Promise<{ findings: LiveFinding[]; ssl: { valid: boolean; issuer?: string; expires?: string; protocol?: string } }> {
  const findings: LiveFinding[] = [];
  const ssl: { valid: boolean; issuer?: string; expires?: string; protocol?: string } = { valid: false };

  // Check if HTTPS works
  const httpsUrl = target.url.replace(/^http:/, 'https:');

  try {
    const res = await fetch(httpsUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    ssl.valid = true;

    // Check if HTTP version redirects to HTTPS
    if (target.url.startsWith('https://')) {
      try {
        const httpUrl = target.url.replace(/^https:/, 'http:');
        const httpRes = await fetch(httpUrl, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(5000),
        });

        const location = httpRes.headers.get('location') ?? '';
        if (httpRes.status >= 300 && httpRes.status < 400 && location.startsWith('https://')) {
          // Good — HTTP redirects to HTTPS
        } else if (httpRes.ok) {
          findings.push({
            id: uuid(),
            probe: 'ssl',
            severity: 'high',
            title: 'HTTP version accessible without redirect to HTTPS',
            description: 'The HTTP (non-encrypted) version of the site is accessible and does not redirect to HTTPS. Users who type the URL without https:// will use an unencrypted connection.',
            recommendation: 'Configure a 301 redirect from HTTP to HTTPS on all routes.',
          });
        }
      } catch {
        // HTTP not accessible — that's fine
      }
    }

    // Mixed content potential (check if main page loads over HTTPS)
    if (res.ok) {
      ssl.protocol = 'TLS';
    }

  } catch (err) {
    ssl.valid = false;
    findings.push({
      id: uuid(),
      probe: 'ssl',
      severity: 'critical',
      title: 'HTTPS connection failed',
      description: `Could not establish a secure HTTPS connection. The site may not have a valid SSL certificate, or the certificate may be expired/self-signed. All data transmitted is unencrypted.`,
      evidence: err instanceof Error ? err.message : 'Connection failed',
      recommendation: 'Install a valid SSL certificate. Use Let\'s Encrypt for free certificates.',
    });
  }

  // Check if site is HTTP-only
  if (target.url.startsWith('http://') && !target.url.startsWith('https://')) {
    try {
      await fetch(`https://${target.hostname}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      findings.push({
        id: uuid(),
        probe: 'ssl',
        severity: 'critical',
        title: 'No HTTPS support',
        description: 'The site does not support HTTPS at all. All traffic including passwords and sensitive data is transmitted in plain text.',
        recommendation: 'Install an SSL certificate immediately. Use Let\'s Encrypt for free automated certificates.',
      });
    }
  }

  return { findings, ssl };
}
