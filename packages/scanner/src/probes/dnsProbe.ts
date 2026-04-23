import { v4 as uuid } from 'uuid';
import type { LiveScanTarget, LiveFinding } from './types';

interface DnsAnswer {
  type: number;
  data: string;
}

interface DnsResponse {
  Answer?: DnsAnswer[];
}

async function dnsLookup(hostname: string, type: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=${type}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as DnsResponse;
    return (data.Answer ?? []).map((a) => a.data);
  } catch {
    return [];
  }
}

export async function runDnsProbe(target: LiveScanTarget): Promise<{ findings: LiveFinding[]; dns: { spf?: string; dkim?: boolean; dmarc?: string } }> {
  const findings: LiveFinding[] = [];
  const dns: { spf?: string; dkim?: boolean; dmarc?: string } = {};

  const hostname = target.hostname;

  // SPF check
  const txtRecords = await dnsLookup(hostname, 'TXT');
  const spfRecords = txtRecords.filter((r) => r.toLowerCase().includes('v=spf1'));

  if (spfRecords.length === 0) {
    findings.push({
      id: uuid(),
      probe: 'dns',
      severity: 'high',
      title: 'No SPF record configured',
      description: 'SPF (Sender Policy Framework) record is missing. Without SPF, anyone can send emails pretending to be from your domain. This enables phishing attacks targeting your users and partners.',
      recommendation: 'Add a TXT record: v=spf1 include:_spf.google.com -all (adjust for your email provider)',
    });
  } else if (spfRecords.length > 1) {
    findings.push({
      id: uuid(),
      probe: 'dns',
      severity: 'high',
      title: `Multiple SPF records found (${spfRecords.length})`,
      description: 'Multiple SPF TXT records exist, which is an RFC violation. This causes SPF verification to fail (PerError), effectively disabling email authentication.',
      evidence: spfRecords.join('\n'),
      recommendation: 'Merge all SPF records into a single TXT record.',
    });
  } else {
    dns.spf = spfRecords[0];
    if (spfRecords[0]?.includes('~all')) {
      findings.push({
        id: uuid(),
        probe: 'dns',
        severity: 'medium',
        title: 'SPF uses soft fail (~all) instead of hard fail (-all)',
        description: 'SPF record uses ~all (soft fail) which only marks unauthorized emails as suspicious but still delivers them. Attackers can still spoof your domain.',
        evidence: spfRecords[0],
        recommendation: 'Change ~all to -all for strict SPF enforcement.',
      });
    }
  }

  // DMARC check
  const dmarcRecords = await dnsLookup(`_dmarc.${hostname}`, 'TXT');
  const dmarc = dmarcRecords.find((r) => r.toLowerCase().includes('v=dmarc1'));

  if (!dmarc) {
    findings.push({
      id: uuid(),
      probe: 'dns',
      severity: 'high',
      title: 'No DMARC record configured',
      description: 'DMARC (Domain-based Message Authentication) is not configured. Without DMARC, there is no policy telling email providers what to do with failed SPF/DKIM checks. Spoofed emails will be delivered.',
      recommendation: 'Add TXT record at _dmarc.yourdomain.com: v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com',
    });
  } else {
    dns.dmarc = dmarc;
    if (dmarc.includes('p=none')) {
      findings.push({
        id: uuid(),
        probe: 'dns',
        severity: 'medium',
        title: 'DMARC policy set to none (not enforcing)',
        description: 'DMARC policy is p=none which only monitors but does not block spoofed emails. This provides visibility but no protection.',
        evidence: dmarc,
        recommendation: 'Upgrade to p=quarantine or p=reject after verifying legitimate emails pass.',
      });
    }
  }

  // DKIM check (common selectors)
  const dkimSelectors = ['default', 'google', 'k1', 'selector1', 'selector2', 'mail', 'dkim'];
  let dkimFound = false;
  for (const sel of dkimSelectors) {
    const dkimRecords = await dnsLookup(`${sel}._domainkey.${hostname}`, 'TXT');
    if (dkimRecords.length > 0) {
      dkimFound = true;
      break;
    }
  }

  dns.dkim = dkimFound;
  if (!dkimFound) {
    findings.push({
      id: uuid(),
      probe: 'dns',
      severity: 'medium',
      title: 'No DKIM records found',
      description: 'DKIM (DomainKeys Identified Mail) records were not found for common selectors. Without DKIM, email recipients cannot verify that messages truly came from your domain.',
      recommendation: 'Configure DKIM signing with your email provider and publish the public key as a DNS TXT record.',
    });
  }

  return { findings, dns };
}
