import { v4 as uuid } from 'uuid';
import type { LiveScanTarget, LiveFinding } from './types';

const SECURITY_HEADERS = [
  {
    header: 'strict-transport-security',
    name: 'HSTS',
    severity: 'high' as const,
    missing: 'Strict-Transport-Security header is missing. Browsers will not enforce HTTPS, leaving users vulnerable to SSL stripping and man-in-the-middle attacks. Add HSTS with max-age of at least 1 year (31536000).',
    fix: 'Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains',
  },
  {
    header: 'content-security-policy',
    name: 'CSP',
    severity: 'medium' as const,
    missing: 'Content-Security-Policy header is missing. Without CSP, the site is vulnerable to XSS attacks where injected scripts can steal data, hijack sessions, and deface pages.',
    fix: "Add a restrictive CSP policy. Start with: Content-Security-Policy: default-src 'self'; script-src 'self'",
  },
  {
    header: 'x-frame-options',
    name: 'X-Frame-Options',
    severity: 'medium' as const,
    missing: 'X-Frame-Options header is missing. The site can be embedded in iframes on malicious pages, enabling clickjacking attacks where users unknowingly click hidden buttons.',
    fix: 'Add header: X-Frame-Options: DENY (or SAMEORIGIN if iframes are needed)',
  },
  {
    header: 'x-content-type-options',
    name: 'X-Content-Type-Options',
    severity: 'low' as const,
    missing: 'X-Content-Type-Options header is missing. Browsers may MIME-sniff responses, potentially executing uploaded files as scripts.',
    fix: 'Add header: X-Content-Type-Options: nosniff',
  },
  {
    header: 'referrer-policy',
    name: 'Referrer-Policy',
    severity: 'low' as const,
    missing: 'Referrer-Policy header is missing. Full URLs including query parameters may leak to third-party sites in the Referer header.',
    fix: 'Add header: Referrer-Policy: strict-origin-when-cross-origin',
  },
  {
    header: 'permissions-policy',
    name: 'Permissions-Policy',
    severity: 'low' as const,
    missing: 'Permissions-Policy header is missing. Browser features like camera, microphone, geolocation are not restricted, increasing the attack surface if XSS occurs.',
    fix: 'Add header: Permissions-Policy: camera=(), microphone=(), geolocation=()',
  },
  {
    header: 'x-xss-protection',
    name: 'X-XSS-Protection',
    severity: 'info' as const,
    missing: 'X-XSS-Protection header is missing. While deprecated in modern browsers, legacy browsers still benefit from it.',
    fix: 'Add header: X-XSS-Protection: 1; mode=block',
  },
];

export async function runHttpProbe(target: LiveScanTarget): Promise<{ findings: LiveFinding[]; headers: Record<string, string>; serverInfo: { server?: string; poweredBy?: string; framework?: string } }> {
  const findings: LiveFinding[] = [];
  const headers: Record<string, string> = {};
  const serverInfo: { server?: string; poweredBy?: string; framework?: string } = {};

  try {
    const res = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    // Collect headers
    res.headers.forEach((value, key) => { headers[key] = value; });

    // Server version disclosure
    const server = res.headers.get('server');
    if (server) {
      serverInfo.server = server;
      const hasVersion = /[\d.]+/.test(server);
      if (hasVersion) {
        findings.push({
          id: uuid(),
          probe: 'http-headers',
          severity: 'medium',
          title: `Server version disclosed: ${server}`,
          description: `The Server header reveals software name and version. Attackers use version information to find known vulnerabilities (CVEs) specific to that version. Hide or remove version details.`,
          evidence: `Server: ${server}`,
          recommendation: 'Remove version from Server header. For nginx: server_tokens off; For Apache: ServerTokens Prod',
        });
      }
    }

    // X-Powered-By disclosure
    const poweredBy = res.headers.get('x-powered-by');
    if (poweredBy) {
      serverInfo.poweredBy = poweredBy;
      findings.push({
        id: uuid(),
        probe: 'http-headers',
        severity: 'medium',
        title: `Technology stack disclosed: ${poweredBy}`,
        description: `The X-Powered-By header reveals the backend technology. Attackers use this to target framework-specific vulnerabilities.`,
        evidence: `X-Powered-By: ${poweredBy}`,
        recommendation: 'Remove X-Powered-By header. For Express: app.disable("x-powered-by"). For PHP: expose_php = Off',
      });
    }

    // Framework detection
    const setCookie = res.headers.get('set-cookie') ?? '';
    if (setCookie.includes('laravel_session')) serverInfo.framework = 'Laravel';
    else if (setCookie.includes('connect.sid')) serverInfo.framework = 'Express.js';
    else if (setCookie.includes('JSESSIONID')) serverInfo.framework = 'Java';
    else if (setCookie.includes('ASP.NET')) serverInfo.framework = 'ASP.NET';

    // Check security headers
    for (const check of SECURITY_HEADERS) {
      const value = res.headers.get(check.header);
      if (!value) {
        findings.push({
          id: uuid(),
          probe: 'http-headers',
          severity: check.severity,
          title: `Missing security header: ${check.name}`,
          description: check.missing,
          recommendation: check.fix,
        });
      }
    }

    // CORS check
    const corsOrigin = res.headers.get('access-control-allow-origin');
    const corsCredentials = res.headers.get('access-control-allow-credentials');
    if (corsOrigin === '*' && corsCredentials === 'true') {
      findings.push({
        id: uuid(),
        probe: 'http-headers',
        severity: 'critical',
        title: 'CORS misconfiguration: wildcard origin with credentials',
        description: 'Access-Control-Allow-Origin is set to * with credentials allowed. Any website can make authenticated requests to this server, stealing user data and performing actions on their behalf.',
        evidence: `Access-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true`,
        recommendation: 'Never use wildcard origin with credentials. Whitelist specific trusted origins.',
      });
    } else if (corsOrigin === '*') {
      findings.push({
        id: uuid(),
        probe: 'http-headers',
        severity: 'low',
        title: 'CORS allows all origins',
        description: 'Access-Control-Allow-Origin is set to *, allowing any website to make requests. This is acceptable for public APIs but risky for authenticated endpoints.',
        evidence: `Access-Control-Allow-Origin: *`,
        recommendation: 'If the API requires authentication, restrict to specific origins.',
      });
    }

    // HTTPS redirect check
    if (target.url.startsWith('http://')) {
      if (!res.redirected || !res.url.startsWith('https://')) {
        findings.push({
          id: uuid(),
          probe: 'http-headers',
          severity: 'high',
          title: 'No HTTP to HTTPS redirect',
          description: 'The HTTP version of the site does not redirect to HTTPS. Users accessing via HTTP have their traffic exposed to eavesdropping and modification.',
          recommendation: 'Configure server to redirect all HTTP requests to HTTPS (301 redirect).',
        });
      }
    }

  } catch (err) {
    findings.push({
      id: uuid(),
      probe: 'http-headers',
      severity: 'info',
      title: 'Could not connect to target',
      description: err instanceof Error ? err.message : 'Connection failed',
    });
  }

  return { findings, headers, serverInfo };
}
