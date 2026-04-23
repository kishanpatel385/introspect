import { v4 as uuid } from 'uuid';
import type { LiveScanTarget, LiveFinding } from './types';

const WAF_SIGNATURES: { header: string; value: string; name: string }[] = [
  { header: 'server', value: 'cloudflare', name: 'Cloudflare' },
  { header: 'x-cdn', value: 'cloudflare', name: 'Cloudflare' },
  { header: 'cf-ray', value: '', name: 'Cloudflare' },
  { header: 'server', value: 'awselb', name: 'AWS ELB' },
  { header: 'x-amz-cf-id', value: '', name: 'AWS CloudFront' },
  { header: 'x-amz-cf-pop', value: '', name: 'AWS CloudFront' },
  { header: 'server', value: 'akamaighost', name: 'Akamai' },
  { header: 'x-sucuri-id', value: '', name: 'Sucuri WAF' },
  { header: 'x-sucuri-cache', value: '', name: 'Sucuri WAF' },
  { header: 'server', value: 'sucuri', name: 'Sucuri WAF' },
  { header: 'x-powered-by', value: 'express-rate-limit', name: 'Express Rate Limit' },
  { header: 'server', value: 'google frontend', name: 'Google Cloud' },
  { header: 'via', value: 'varnish', name: 'Varnish Cache' },
  { header: 'x-vercel-id', value: '', name: 'Vercel' },
  { header: 'x-served-by', value: 'netlify', name: 'Netlify' },
];

export async function runFirewallProbe(target: LiveScanTarget): Promise<LiveFinding[]> {
  const findings: LiveFinding[] = [];

  try {
    const res = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    // Detect WAF/CDN
    const detectedWafs: string[] = [];
    for (const sig of WAF_SIGNATURES) {
      const headerValue = res.headers.get(sig.header)?.toLowerCase() ?? '';
      if (sig.value && headerValue.includes(sig.value)) {
        if (!detectedWafs.includes(sig.name)) detectedWafs.push(sig.name);
      } else if (!sig.value && res.headers.has(sig.header)) {
        if (!detectedWafs.includes(sig.name)) detectedWafs.push(sig.name);
      }
    }

    if (detectedWafs.length > 0) {
      findings.push({
        id: uuid(),
        probe: 'firewall',
        severity: 'info',
        title: `WAF/CDN detected: ${detectedWafs.join(', ')}`,
        description: `The site is behind ${detectedWafs.join(' and ')}. This provides DDoS protection, caching, and may include web application firewall features.`,
        evidence: detectedWafs.map((w) => `Detected: ${w}`).join('\n'),
      });
    } else {
      findings.push({
        id: uuid(),
        probe: 'firewall',
        severity: 'medium',
        title: 'No WAF/CDN detected',
        description: 'No web application firewall or CDN was detected. The server appears to be directly exposed to the internet without DDoS protection or request filtering. This increases vulnerability to volumetric attacks and automated exploitation.',
        recommendation: 'Consider using Cloudflare (free tier), AWS CloudFront, or similar WAF/CDN service for protection.',
      });
    }

    // Check for common WAF test — send suspicious payload and see if blocked
    try {
      const wafTestRes = await fetch(`${target.url}/?id=1%27%20OR%201=1--`, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });

      if (wafTestRes.status === 403 || wafTestRes.status === 406 || wafTestRes.status === 429) {
        findings.push({
          id: uuid(),
          probe: 'firewall',
          severity: 'info',
          title: 'WAF actively blocking SQL injection attempts',
          description: `The server returned ${wafTestRes.status} when a SQL injection test payload was sent. This indicates active request filtering is in place.`,
          evidence: `GET ${target.url}/?id=1' OR 1=1-- → ${wafTestRes.status}`,
        });
      } else if (wafTestRes.ok) {
        findings.push({
          id: uuid(),
          probe: 'firewall',
          severity: 'medium',
          title: 'No WAF blocking detected for SQL injection patterns',
          description: 'A test request with a SQL injection payload was not blocked. This suggests no active WAF rule is filtering malicious requests. The application must handle input validation internally.',
          evidence: `GET ${target.url}/?id=1' OR 1=1-- → ${wafTestRes.status} (not blocked)`,
          recommendation: 'Enable WAF rules to block common attack patterns (SQLi, XSS, etc.).',
        });
      }
    } catch {
      // Skip WAF test on error
    }

  } catch {
    // Connection failed — skip
  }

  return findings;
}
