import type { LiveScanTarget, LiveScanResult, LiveFinding } from './types';
import { runHttpProbe } from './httpProbe';
import { runExposedFilesProbe } from './exposedFilesProbe';
import { runDnsProbe } from './dnsProbe';
import { runSslProbe } from './sslProbe';
import { runCookieProbe } from './cookieProbe';
import { runRateLimitProbe } from './rateLimitProbe';
import { runServiceProbe } from './serviceProbe';
import { runFirewallProbe } from './firewallProbe';
import { runServerConfigProbe } from './serverConfigProbe';

export type { LiveScanTarget, LiveScanResult, LiveFinding } from './types';

export type LiveProgressCallback = (step: string, meta?: Record<string, unknown>) => void;

function parseTarget(input: string): LiveScanTarget {
  let url = input.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  try {
    const hostname = new URL(url).hostname;
    if (!hostname) throw new Error('Empty hostname');
    return { url, hostname };
  } catch {
    throw new Error(`Invalid URL: "${input}". Enter a valid domain like example.com`);
  }
}

export async function liveScan(
  input: string,
  onProgress?: LiveProgressCallback,
): Promise<LiveScanResult> {
  const startTime = Date.now();
  const target = parseTarget(input);
  const emit = onProgress ?? (() => {});
  const allFindings: LiveFinding[] = [];

  // 1. HTTP Headers
  emit('Checking HTTP security headers');
  const httpResult = await runHttpProbe(target);
  allFindings.push(...httpResult.findings);

  // 2. SSL/TLS
  emit('Checking SSL/TLS configuration');
  const sslResult = await runSslProbe(target);
  allFindings.push(...sslResult.findings);

  // 3. DNS (SPF, DKIM, DMARC)
  emit('Auditing DNS records');
  const dnsResult = await runDnsProbe(target);
  allFindings.push(...dnsResult.findings);

  // 4. Exposed files
  emit('Scanning for exposed files and endpoints');
  const exposedFindings = await runExposedFilesProbe(target);
  allFindings.push(...exposedFindings);

  // 5. Cookie security
  emit('Checking cookie security');
  const cookieFindings = await runCookieProbe(target);
  allFindings.push(...cookieFindings);

  // 6. Rate limiting
  emit('Testing rate limiting');
  const rateLimitFindings = await runRateLimitProbe(target);
  allFindings.push(...rateLimitFindings);

  // 7. Service discovery (port scan)
  emit('Scanning common ports');
  const serviceFindings = await runServiceProbe(target);
  allFindings.push(...serviceFindings);

  // 8. Firewall/WAF detection
  emit('Detecting WAF and firewall');
  const firewallFindings = await runFirewallProbe(target);
  allFindings.push(...firewallFindings);

  // 9. Server config (Apache/Nginx/IIS specific)
  emit('Checking server configuration');
  const serverConfigFindings = await runServerConfigProbe(target);
  allFindings.push(...serverConfigFindings);

  emit('Building report');

  // Summary counts
  const summary = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of allFindings) {
    summary.total++;
    summary[f.severity]++;
  }

  return {
    target: target.url,
    scannedAt: new Date().toISOString(),
    findings: allFindings,
    summary,
    headers: httpResult.headers,
    ssl: sslResult.ssl,
    dns: dnsResult.dns,
    serverInfo: httpResult.serverInfo,
    scanDurationMs: Date.now() - startTime,
  };
}
