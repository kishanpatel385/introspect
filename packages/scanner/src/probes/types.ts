export interface LiveScanTarget {
  url: string;
  hostname: string;
}

export interface LiveFinding {
  id: string;
  probe: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  evidence?: string;
  recommendation?: string;
}

export interface LiveScanResult {
  target: string;
  scannedAt: string;
  findings: LiveFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  headers: Record<string, string>;
  ssl?: {
    valid: boolean;
    issuer?: string;
    expires?: string;
    protocol?: string;
  };
  dns?: {
    spf?: string;
    dkim?: boolean;
    dmarc?: string;
  };
  serverInfo?: {
    server?: string;
    poweredBy?: string;
    framework?: string;
  };
  scanDurationMs: number;
}

export type ProbeFunction = (target: LiveScanTarget) => Promise<LiveFinding[]>;
