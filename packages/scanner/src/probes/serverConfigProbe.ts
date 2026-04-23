import { v4 as uuid } from 'uuid';
import type { LiveScanTarget, LiveFinding } from './types';

const ADMIN_PATHS = [
  { path: '/server-status', name: 'Apache mod_status', severity: 'high' as const },
  { path: '/server-info', name: 'Apache mod_info', severity: 'high' as const },
  { path: '/nginx_status', name: 'Nginx stub_status', severity: 'high' as const },
  { path: '/status', name: 'Server status page', severity: 'medium' as const },
  { path: '/info.php', name: 'PHP info page', severity: 'high' as const },
  { path: '/test.php', name: 'PHP test file', severity: 'medium' as const },
  { path: '/elmah.axd', name: 'ASP.NET error log', severity: 'high' as const },
  { path: '/trace.axd', name: 'ASP.NET trace', severity: 'high' as const },
  { path: '/actuator', name: 'Spring Boot Actuator', severity: 'high' as const },
  { path: '/actuator/health', name: 'Spring Actuator Health', severity: 'low' as const },
  { path: '/actuator/env', name: 'Spring Actuator Env', severity: 'critical' as const },
  { path: '/actuator/beans', name: 'Spring Actuator Beans', severity: 'high' as const },
  { path: '/.well-known/security.txt', name: 'Security.txt', severity: 'info' as const },
  { path: '/crossdomain.xml', name: 'Flash crossdomain policy', severity: 'medium' as const },
  { path: '/clientaccesspolicy.xml', name: 'Silverlight access policy', severity: 'medium' as const },
];

export async function runServerConfigProbe(target: LiveScanTarget): Promise<LiveFinding[]> {
  const findings: LiveFinding[] = [];
  const baseUrl = target.url.replace(/\/$/, '');

  // Detect server type from headers
  let serverType = 'unknown';
  try {
    const res = await fetch(target.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    const server = (res.headers.get('server') ?? '').toLowerCase();
    if (server.includes('apache') || server.includes('httpd')) serverType = 'apache';
    else if (server.includes('nginx')) serverType = 'nginx';
    else if (server.includes('iis')) serverType = 'iis';
    else if (server.includes('litespeed')) serverType = 'litespeed';
  } catch { /* skip */ }

  // Apache-specific checks
  if (serverType === 'apache') {
    // Check for directory listing
    try {
      const res = await fetch(`${baseUrl}/icons/`, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(5000) });
      const body = await res.text();
      if (res.ok && (body.includes('Index of') || body.includes('Directory listing'))) {
        findings.push({
          id: uuid(),
          probe: 'server-config',
          severity: 'medium',
          title: 'Apache directory listing enabled',
          description: 'Directory listing is enabled on the server. Visitors can browse the entire directory structure, potentially finding backup files, config files, and other sensitive data.',
          evidence: `GET ${baseUrl}/icons/ → Directory listing visible`,
          recommendation: 'Disable directory listing. Add "Options -Indexes" in Apache config or .htaccess.',
        });
      }
    } catch { /* skip */ }

    // Check ETag (inode leak)
    try {
      const res = await fetch(target.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      const etag = res.headers.get('etag') ?? '';
      if (etag && etag.includes('-') && etag.split('-').length >= 3) {
        findings.push({
          id: uuid(),
          probe: 'server-config',
          severity: 'low',
          title: 'Apache ETag leaks inode information',
          description: 'The ETag header contains inode, size, and timestamp. Inode numbers can be used to fingerprint the server and detect if multiple hostnames share the same server.',
          evidence: `ETag: ${etag}`,
          recommendation: 'Set "FileETag MTime Size" in Apache config to remove inode from ETag.',
        });
      }
    } catch { /* skip */ }
  }

  // Nginx-specific checks
  if (serverType === 'nginx') {
    // Check for default page
    try {
      const res = await fetch(target.url, { method: 'GET', signal: AbortSignal.timeout(5000) });
      const body = await res.text();
      if (body.includes('Welcome to nginx!') || body.includes('nginx default page')) {
        findings.push({
          id: uuid(),
          probe: 'server-config',
          severity: 'medium',
          title: 'Nginx default page detected',
          description: 'The server is showing the default nginx welcome page. This indicates the server may be unconfigured or the default virtual host is active. Unconfigured servers are easy targets.',
          recommendation: 'Configure a proper server block or remove the default site.',
        });
      }
    } catch { /* skip */ }
  }

  // Check admin/debug paths
  for (let i = 0; i < ADMIN_PATHS.length; i += 5) {
    const batch = ADMIN_PATHS.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (check) => {
        try {
          const res = await fetch(`${baseUrl}${check.path}`, {
            method: 'GET',
            redirect: 'follow',
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            const body = await res.text();
            if (body.length > 50 && !body.toLowerCase().includes('not found') && !body.toLowerCase().includes('404')) {
              return { check, found: true, size: body.length };
            }
          }
        } catch { /* skip */ }
        return null;
      }),
    );

    for (const r of results) {
      if (!r) continue;
      findings.push({
        id: uuid(),
        probe: 'server-config',
        severity: r.check.severity,
        title: `${r.check.name} accessible at ${r.check.path}`,
        description: `${r.check.name} is publicly accessible. Admin, debug, and status endpoints should never be exposed to the internet. They reveal internal server state, configuration, environment variables, and can be exploited for further attacks.`,
        evidence: `GET ${baseUrl}${r.check.path} → 200 OK (${r.size} bytes)`,
        recommendation: `Restrict access to ${r.check.path}. Block in server config or firewall. Only allow from internal IPs.`,
      });
    }
  }

  // security.txt check
  try {
    const res = await fetch(`${baseUrl}/.well-known/security.txt`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      findings.push({
        id: uuid(),
        probe: 'server-config',
        severity: 'info',
        title: 'No security.txt found',
        description: 'No security.txt file was found at /.well-known/security.txt. This file helps security researchers report vulnerabilities responsibly.',
        recommendation: 'Create a security.txt file with contact info for vulnerability reporting. See https://securitytxt.org/',
      });
    }
  } catch { /* skip */ }

  return findings;
}
