import { v4 as uuid } from 'uuid';
import type { LiveScanTarget, LiveFinding } from './types';

const SENSITIVE_PATHS = [
  { path: '/.env', severity: 'critical' as const, title: '.env file exposed', desc: 'Environment file is publicly accessible. May contain database credentials, API keys, and secrets. Attackers can use these to access databases, third-party services, and escalate privileges.' },
  { path: '/.git/HEAD', severity: 'critical' as const, title: '.git directory exposed', desc: 'Git repository data is publicly accessible. Attackers can download the entire source code, commit history, and potentially find hardcoded secrets in old commits.' },
  { path: '/.git/config', severity: 'critical' as const, title: '.git/config exposed', desc: 'Git config reveals repository origin URL and potentially credentials. Can expose internal infrastructure details.' },
  { path: '/wp-admin/', severity: 'high' as const, title: 'WordPress admin panel exposed', desc: 'WordPress admin login page is publicly accessible. Attackers can attempt brute-force attacks on admin credentials.' },
  { path: '/phpmyadmin/', severity: 'critical' as const, title: 'phpMyAdmin publicly accessible', desc: 'phpMyAdmin database management interface is publicly accessible. If default or weak credentials are used, attackers get full database access.' },
  { path: '/adminer.php', severity: 'critical' as const, title: 'Adminer database tool exposed', desc: 'Adminer database tool is publicly accessible. Provides direct database access if credentials are known or weak.' },
  { path: '/server-status', severity: 'medium' as const, title: 'Apache server-status exposed', desc: 'Apache server-status page reveals active connections, request details, and internal server information.' },
  { path: '/server-info', severity: 'medium' as const, title: 'Apache server-info exposed', desc: 'Apache server-info page reveals server configuration, loaded modules, and internal details.' },
  { path: '/phpinfo.php', severity: 'high' as const, title: 'phpinfo() page exposed', desc: 'PHP info page reveals PHP version, extensions, environment variables, and server paths. Attackers use this for reconnaissance.' },
  { path: '/debug', severity: 'high' as const, title: 'Debug endpoint exposed', desc: 'Debug endpoint is publicly accessible. May reveal stack traces, environment variables, and internal state.' },
  { path: '/api/docs', severity: 'low' as const, title: 'API documentation exposed', desc: 'API documentation is publicly accessible. While useful for developers, it reveals all endpoints and parameters to potential attackers.' },
  { path: '/swagger/', severity: 'low' as const, title: 'Swagger UI exposed', desc: 'Swagger API documentation is publicly accessible. Reveals all API endpoints, request/response schemas.' },
  { path: '/graphql', severity: 'low' as const, title: 'GraphQL endpoint detected', desc: 'GraphQL endpoint is accessible. Check if introspection is enabled — it reveals the entire schema.' },
  { path: '/composer.json', severity: 'medium' as const, title: 'composer.json exposed', desc: 'PHP dependency file is publicly accessible. Reveals all dependencies and versions, enabling targeted attacks on known vulnerabilities.' },
  { path: '/package.json', severity: 'medium' as const, title: 'package.json exposed', desc: 'Node.js dependency file is publicly accessible. Reveals all dependencies and versions.' },
  { path: '/wp-config.php.bak', severity: 'critical' as const, title: 'WordPress config backup exposed', desc: 'Backup of wp-config.php is accessible. Contains database credentials, secret keys, and configuration.' },
  { path: '/backup.sql', severity: 'critical' as const, title: 'SQL backup file exposed', desc: 'Database backup file is publicly accessible. Contains all database data including user credentials and sensitive information.' },
  { path: '/.DS_Store', severity: 'low' as const, title: '.DS_Store file exposed', desc: 'macOS directory metadata file reveals file and folder names in the directory. Can aid in directory enumeration.' },
  { path: '/robots.txt', severity: 'info' as const, title: 'robots.txt found', desc: 'robots.txt reveals paths the site owner wants hidden from search engines. Attackers often check these paths for sensitive content.' },
  { path: '/sitemap.xml', severity: 'info' as const, title: 'sitemap.xml found', desc: 'Sitemap reveals all pages on the site. Useful for mapping the application surface.' },
];

export async function runExposedFilesProbe(target: LiveScanTarget): Promise<LiveFinding[]> {
  const findings: LiveFinding[] = [];
  const baseUrl = target.url.replace(/\/$/, '');

  // Check paths in parallel batches of 5
  for (let i = 0; i < SENSITIVE_PATHS.length; i += 5) {
    const batch = SENSITIVE_PATHS.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (check) => {
        try {
          const res = await fetch(`${baseUrl}${check.path}`, {
            method: 'GET',
            redirect: 'follow',
            signal: AbortSignal.timeout(5000),
          });

          // 200 or 403 (exists but forbidden) are notable
          if (res.status === 200) {
            const body = await res.text();
            // Verify it's not a generic 404 page disguised as 200
            if (body.length > 0 && !body.toLowerCase().includes('not found') && !body.toLowerCase().includes('404')) {
              return {
                found: true,
                status: 200,
                check,
                evidence: body.slice(0, 200),
              };
            }
          } else if (res.status === 403) {
            // File exists but access denied — still a finding (info level)
            if (check.severity === 'critical' || check.severity === 'high') {
              return {
                found: true,
                status: 403,
                check,
              };
            }
          }
        } catch {
          // Connection failed — skip
        }
        return null;
      }),
    );

    for (const r of results) {
      if (!r) continue;
      if (r.status === 200) {
        findings.push({
          id: uuid(),
          probe: 'exposed-files',
          severity: r.check.severity,
          title: r.check.title,
          description: r.check.desc,
          evidence: `GET ${baseUrl}${r.check.path} → 200 OK\n${r.evidence ? r.evidence + '...' : ''}`,
          recommendation: `Block access to ${r.check.path} in server config. For nginx: location ${r.check.path} { return 404; }`,
        });
      } else if (r.status === 403) {
        findings.push({
          id: uuid(),
          probe: 'exposed-files',
          severity: 'info',
          title: `${r.check.title} (blocked but exists)`,
          description: `${r.check.path} returns 403 Forbidden. The file exists on disk but access is denied. Good — but consider removing it entirely.`,
          evidence: `GET ${baseUrl}${r.check.path} → 403 Forbidden`,
        });
      }
    }
  }

  return findings;
}
