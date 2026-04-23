import { v4 as uuid } from 'uuid';
import type { LiveScanTarget, LiveFinding } from './types';

const COMMON_PORTS = [
  { port: 21, service: 'FTP', severity: 'high' as const },
  { port: 22, service: 'SSH', severity: 'info' as const },
  { port: 23, service: 'Telnet', severity: 'critical' as const },
  { port: 25, service: 'SMTP', severity: 'medium' as const },
  { port: 80, service: 'HTTP', severity: 'info' as const },
  { port: 443, service: 'HTTPS', severity: 'info' as const },
  { port: 3000, service: 'Node.js/Dev Server', severity: 'medium' as const },
  { port: 3306, service: 'MySQL', severity: 'critical' as const },
  { port: 5432, service: 'PostgreSQL', severity: 'critical' as const },
  { port: 6379, service: 'Redis', severity: 'critical' as const },
  { port: 8080, service: 'HTTP Alt/Proxy', severity: 'low' as const },
  { port: 8443, service: 'HTTPS Alt/Admin Panel', severity: 'medium' as const },
  { port: 9200, service: 'Elasticsearch', severity: 'critical' as const },
  { port: 9090, service: 'Prometheus', severity: 'high' as const },
  { port: 27017, service: 'MongoDB', severity: 'critical' as const },
  { port: 5672, service: 'RabbitMQ', severity: 'high' as const },
  { port: 15672, service: 'RabbitMQ Management', severity: 'critical' as const },
  { port: 11211, service: 'Memcached', severity: 'high' as const },
  { port: 2379, service: 'etcd', severity: 'critical' as const },
  { port: 4443, service: 'Docker Registry', severity: 'high' as const },
];

async function checkPort(hostname: string, port: number): Promise<boolean> {
  try {
    const url = port === 443 ? `https://${hostname}:${port}` : `http://${hostname}:${port}`;
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(3000),
    });
    return true;
  } catch {
    return false;
  }
}

export async function runServiceProbe(target: LiveScanTarget): Promise<LiveFinding[]> {
  const findings: LiveFinding[] = [];
  const openPorts: { port: number; service: string; severity: string }[] = [];

  // Check ports in batches of 5
  for (let i = 0; i < COMMON_PORTS.length; i += 5) {
    const batch = COMMON_PORTS.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (p) => {
        const isOpen = await checkPort(target.hostname, p.port);
        return { ...p, isOpen };
      }),
    );

    for (const r of results) {
      if (!r.isOpen) continue;

      // Skip standard web ports
      if (r.port === 80 || r.port === 443) {
        openPorts.push(r);
        continue;
      }

      openPorts.push(r);

      // Database ports exposed = critical
      if ([3306, 5432, 6379, 27017, 9200, 2379, 11211].includes(r.port)) {
        findings.push({
          id: uuid(),
          probe: 'service-discovery',
          severity: 'critical',
          title: `${r.service} port ${r.port} publicly accessible`,
          description: `${r.service} is accessible on port ${r.port} from the internet. Database and cache services should never be publicly exposed. Attackers can attempt brute-force authentication or exploit known vulnerabilities to access or destroy data.`,
          evidence: `${target.hostname}:${r.port} — OPEN (${r.service})`,
          recommendation: `Block port ${r.port} in firewall. Only allow access from application servers via private network or VPN.`,
        });
      }
      // Admin panels
      else if ([15672, 8443, 9090].includes(r.port)) {
        findings.push({
          id: uuid(),
          probe: 'service-discovery',
          severity: 'high',
          title: `${r.service} on port ${r.port} publicly accessible`,
          description: `${r.service} management interface is publicly accessible. Admin panels should be restricted to internal networks or VPN. Default credentials are commonly tried by automated scanners.`,
          evidence: `${target.hostname}:${r.port} — OPEN (${r.service})`,
          recommendation: `Restrict port ${r.port} to specific IPs or VPN. Change default credentials.`,
        });
      }
      // Telnet = ancient, insecure
      else if (r.port === 23) {
        findings.push({
          id: uuid(),
          probe: 'service-discovery',
          severity: 'critical',
          title: 'Telnet service publicly accessible',
          description: 'Telnet transmits all data including passwords in plain text. It is an obsolete protocol with no encryption. Any attacker on the network can intercept credentials.',
          evidence: `${target.hostname}:23 — OPEN (Telnet)`,
          recommendation: 'Disable Telnet immediately. Use SSH for remote access.',
        });
      }
      // Dev servers
      else if ([3000, 8080].includes(r.port)) {
        findings.push({
          id: uuid(),
          probe: 'service-discovery',
          severity: r.severity,
          title: `${r.service} on port ${r.port} accessible`,
          description: `Port ${r.port} is commonly used for development servers. If this is a production environment, non-standard ports may indicate debug or staging instances that lack production security controls.`,
          evidence: `${target.hostname}:${r.port} — OPEN (${r.service})`,
          recommendation: `If this is not intentional, block port ${r.port} in firewall.`,
        });
      }
      // Others
      else {
        findings.push({
          id: uuid(),
          probe: 'service-discovery',
          severity: r.severity,
          title: `${r.service} on port ${r.port} accessible`,
          description: `${r.service} service is publicly accessible on port ${r.port}. Evaluate if this service needs to be publicly exposed.`,
          evidence: `${target.hostname}:${r.port} — OPEN (${r.service})`,
          recommendation: `Review if port ${r.port} needs to be open. Restrict if not needed.`,
        });
      }
    }
  }

  // Summary finding
  const nonWebPorts = openPorts.filter((p) => p.port !== 80 && p.port !== 443);
  if (nonWebPorts.length > 3) {
    findings.push({
      id: uuid(),
      probe: 'service-discovery',
      severity: 'high',
      title: `${nonWebPorts.length} non-standard ports open`,
      description: `${nonWebPorts.length} ports beyond HTTP/HTTPS are publicly accessible: ${nonWebPorts.map((p) => `${p.port} (${p.service})`).join(', ')}. A large attack surface increases the risk of exploitation.`,
      recommendation: 'Review all open ports. Close unnecessary services. Use a firewall to restrict access.',
    });
  }

  return findings;
}
