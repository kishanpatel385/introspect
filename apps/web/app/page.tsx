'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Eye, ArrowRight, ChevronRight, Shield, Zap, Code2, Package, FileText, Lock, Cpu, Globe, Search, Download, X, Sparkles, Brain, Heart, GitBranch, BookOpen, FileCode, Printer } from 'lucide-react';
import type { ScanResult } from '@introspect/core-types';
import type { LiveScanResult } from '@introspect/scanner';
import styles from './page.module.scss';

const LIVE_STEPS = [
  'Checking HTTP security headers',
  'Checking SSL/TLS configuration',
  'Auditing DNS records',
  'Scanning for exposed files and endpoints',
  'Checking cookie security',
  'Testing rate limiting',
  'Scanning common ports',
  'Detecting WAF and firewall',
  'Checking server configuration',
  'Building report',
];

const STEPS = [
  'Fetching repository contents',
  'Scanning for security vulnerabilities',
  'Detecting performance issues',
  'Analyzing code quality',
  'Checking dependencies',
  'Reviewing documentation',
  'Building report',
];

const CATS = [
  { key: 'all', label: 'All' },
  { key: 'security', label: 'Security' },
  { key: 'performance', label: 'Performance' },
  { key: 'quality', label: 'Quality' },
  { key: 'dead_code', label: 'Dead Code' },
  { key: 'dependency', label: 'Deps' },
  { key: 'docs', label: 'Docs' },
  { key: 'git', label: 'Git Health' },
];

const SEV: Record<string, string> = {
  critical: '#f85149', high: '#f0883e', medium: '#d29922', low: '#58a6ff', info: '#6b7a8d',
};

const SEV_BADGE: Record<string, string> = {
  critical: 'badgeCritical', high: 'badgeHigh', medium: 'badgeMedium', low: 'badgeLow', info: 'badgeInfo',
};

const SEV_FINDING: Record<string, string> = {
  critical: 'findingCritical', high: 'findingHigh', medium: 'findingMedium', low: 'findingLow', info: 'findingInfo',
};

const SEV_LABELS: { key: string; label: string; color: string }[] = [
  { key: 'critical', label: 'Critical', color: '#f85149' },
  { key: 'high', label: 'High', color: '#f0883e' },
  { key: 'medium', label: 'Medium', color: '#d29922' },
  { key: 'low', label: 'Low', color: '#58a6ff' },
  { key: 'info', label: 'Info', color: '#6b7a8d' },
];

const TAG: Record<string, string> = {
  security: 'tSec', performance: 'tPerf', quality: 'tQual',
  dead_code: 'tDead', dependency: 'tDep', docs: 'tDocs', git: 'tGit',
};

type View = 'scan' | 'loading' | 'results';
type SortKey = 'severity' | 'type' | 'file';

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const RADAR_LABELS: { key: keyof ScanResult['scores']; label: string }[] = [
  { key: 'security', label: 'Security' },
  { key: 'performance', label: 'Perf' },
  { key: 'quality', label: 'Quality' },
  { key: 'deadCode', label: 'Dead Code' },
  { key: 'dependencies', label: 'Deps' },
  { key: 'docs', label: 'Docs' },
  { key: 'gitHealth', label: 'Git' },
];

function RadarChart({ scores }: { scores: ScanResult['scores'] }) {
  const cx = 120, cy = 120, r = 90;
  const count = RADAR_LABELS.length;

  const points = RADAR_LABELS.map((item, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const val = (scores[item.key] ?? 0) / 100;
    return {
      x: cx + r * val * Math.cos(angle),
      y: cy + r * val * Math.sin(angle),
      lx: cx + (r + 18) * Math.cos(angle),
      ly: cy + (r + 18) * Math.sin(angle),
      label: item.label,
      score: scores[item.key] ?? 0,
    };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox="0 0 240 240" className={styles.radar}>
      {/* Grid rings */}
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={RADAR_LABELS.map((_, i) => {
            const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
            return `${cx + r * ring * Math.cos(angle)},${cy + r * ring * Math.sin(angle)}`;
          }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}
      {/* Axis lines */}
      {RADAR_LABELS.map((_, i) => {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        return (
          <line key={i} x1={cx} y1={cy}
            x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1"
          />
        );
      })}
      {/* Data polygon */}
      <polygon points={polygon} fill="rgba(232,115,74,0.12)" stroke="#e8734a" strokeWidth="2" />
      {/* Data dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#e8734a" />
      ))}
      {/* Labels */}
      {points.map((p, i) => (
        <text key={i} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle"
          fill="#8b95a5" fontSize="9" fontFamily="var(--font-mono)"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

const SCAN_PREFIX = 'scan:';
const SCAN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface StoredScan {
  result: ScanResult;
  storedAt: number;
}

function generateId(): string {
  return crypto.randomUUID();
}

function saveScan(id: string, result: ScanResult): void {
  const entry: StoredScan = { result, storedAt: Date.now() };
  try {
    localStorage.setItem(`${SCAN_PREFIX}${id}`, JSON.stringify(entry));
  } catch { /* storage full — silently skip */ }
}

function loadScan(id: string): ScanResult | null {
  try {
    const raw = localStorage.getItem(`${SCAN_PREFIX}${id}`);
    if (!raw) return null;
    const entry: StoredScan = JSON.parse(raw);
    if (Date.now() - entry.storedAt > SCAN_TTL_MS) {
      localStorage.removeItem(`${SCAN_PREFIX}${id}`);
      return null;
    }
    return entry.result;
  } catch {
    return null;
  }
}

function exportPdf(): void {
  window.print();
}

function exportHtml(result: ScanResult): void {
  const sevColors: Record<string, string> = { critical: '#f85149', high: '#f0883e', medium: '#d29922', low: '#58a6ff', info: '#6b7a8d' };
  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const sorted = [...result.issues].sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4));
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const iss of result.issues) counts[iss.severity] = (counts[iss.severity] || 0) + 1;
  const criticals = sorted.filter((i) => i.severity === 'critical');
  const grouped: Record<string, typeof result.issues> = {};
  for (const iss of sorted) {
    if (!grouped[iss.severity]) grouped[iss.severity] = [];
    grouped[iss.severity]!.push(iss);
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const lines: string[] = [];
  lines.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">`);
  lines.push(`<title>Introspect Report - ${esc(result.repoName)}</title>`);
  lines.push(`<style>
:root { --critical: #f85149; --high: #f0883e; --medium: #d29922; --low: #58a6ff; --info: #6b7a8d; --fixed: #3fb950; --bg: #06090d; --card: #131a24; --text: #e2e8f0; --muted: #8b95a5; --border: rgba(255,255,255,0.08); --accent: #e8734a; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
.container { max-width: 1100px; margin: 0 auto; padding: 2rem; }
h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
h2 { font-size: 1.4rem; margin: 2rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--border); }
h3 { font-size: 1.05rem; margin: 0.5rem 0; }
.subtitle { color: var(--muted); margin-bottom: 0.5rem; font-size: 0.85rem; }
.card { background: var(--card); border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid var(--border); }
.grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.75rem; margin-bottom: 2rem; }
.stat { text-align: center; padding: 1.25rem 0.5rem; }
.stat .number { font-size: 2rem; font-weight: 700; }
.stat .label { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; }
.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: white; }
.badge-critical { background: var(--critical); }
.badge-high { background: var(--high); }
.badge-medium { background: var(--medium); color: #000; }
.badge-low { background: var(--low); }
.badge-info { background: var(--info); }
.finding { border-left: 4px solid; padding: 1.25rem; margin-bottom: 1rem; background: var(--card); border-radius: 0 8px 8px 0; border-top: 1px solid var(--border); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.finding-critical { border-left-color: var(--critical); }
.finding-high { border-left-color: var(--high); }
.finding-medium { border-left-color: var(--medium); }
.finding-low { border-left-color: var(--low); }
.finding-info { border-left-color: var(--info); }
.evidence { background: #0a0e14; padding: 0.75rem; border-radius: 6px; font-family: 'Cascadia Code', 'Fira Code', monospace; font-size: 0.82rem; margin: 0.5rem 0; overflow-x: auto; border: 1px solid var(--border); white-space: pre-wrap; color: #f97583; }
.recommendation { background: rgba(63,185,80,0.04); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; border-left: 3px solid var(--fixed); font-size: 0.9rem; }
.recommendation strong { color: var(--fixed); }
table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
th, td { padding: 0.6rem 1rem; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
th { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; }
.header-bar { background: linear-gradient(135deg, #131a24, #06090d); padding: 2rem; border-radius: 10px; margin-bottom: 2rem; border: 1px solid var(--border); }
.header-bar h1 span { color: var(--accent); }
.alert-banner { background: linear-gradient(135deg, #3d0a0a, #06090d); padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; border: 2px solid var(--critical); text-align: center; }
.alert-banner .number { font-size: 2.5rem; font-weight: 700; color: var(--critical); }
.finding-id { font-family: monospace; font-size: 0.8rem; color: var(--muted); font-weight: 600; }
.finding-file { font-family: monospace; font-size: 0.82rem; color: var(--accent); opacity: 0.8; }
.footer { text-align: center; color: var(--muted); margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); font-size: 0.8rem; }
</style></head><body><div class="container">`);

  // Header
  lines.push(`<div class="header-bar"><h1><span>Introspect</span> / ${esc(result.repoName)}</h1>`);
  lines.push(`<p class="subtitle">Scanned: ${esc(result.scannedAt)} | Files: ${result.totalFiles} | Lines: ${result.totalLines.toLocaleString()} | Duration: ${result.scanDurationMs}ms | Score: ${result.overallScore}/100</p></div>`);

  // Alert banner
  if ((counts.critical ?? 0) > 0) {
    lines.push(`<div class="alert-banner"><div class="number">${counts.critical} CRITICAL Finding${(counts.critical ?? 0) > 1 ? 's' : ''}</div>`);
    lines.push(`<p style="color:var(--text)">${criticals.map((i) => esc(i.title)).join(', ')}</p>`);
    lines.push(`<p style="color:var(--critical);font-weight:bold;margin-top:0.5rem">IMMEDIATE ACTION REQUIRED</p></div>`);
  }

  // Stats
  lines.push(`<h2>Executive Summary</h2><div class="grid">`);
  lines.push(`<div class="card stat"><div class="number" style="color:var(--text)">${result.issues.length}</div><div class="label">Total</div></div>`);
  for (const s of [{ k: 'critical', l: 'Critical' }, { k: 'high', l: 'High' }, { k: 'medium', l: 'Medium' }, { k: 'low', l: 'Low' }, { k: 'info', l: 'Info' }]) {
    lines.push(`<div class="card stat"><div class="number" style="color:var(--${s.k})">${counts[s.k] || 0}</div><div class="label">${s.l}</div></div>`);
  }
  lines.push(`</div>`);

  // Summary
  lines.push(`<div class="card"><p>${esc(result.summary)}</p></div>`);

  // Grouped findings
  for (const sev of ['critical', 'high', 'medium', 'low', 'info']) {
    const list = grouped[sev];
    if (!list || list.length === 0) continue;
    lines.push(`<h2>${sev.toUpperCase()} Findings</h2>`);
    list.forEach((iss, idx) => {
      const issNum = String(idx + 1).padStart(3, '0');
      lines.push(`<div class="finding finding-${sev}">`);
      lines.push(`<span class="badge badge-${sev}">${sev.toUpperCase()}</span> <span class="finding-id">ISS-${issNum}</span>`);
      lines.push(`<h3>${esc(iss.title)}</h3>`);
      if (iss.file) lines.push(`<div class="finding-file">${esc(iss.file)}${iss.line ? `:${iss.line}` : ''}</div>`);
      lines.push(`<p>${esc(iss.description)}</p>`);
      if (iss.badCode) lines.push(`<div class="evidence">${esc(iss.badCode)}</div>`);
      if (iss.goodCode) lines.push(`<div class="recommendation"><strong>Recommendation:</strong><pre style="margin:0.5rem 0;white-space:pre-wrap;font-family:monospace;font-size:0.82rem">${esc(iss.goodCode)}</pre></div>`);
      lines.push(`</div>`);
    });
  }

  // Action items
  const top10 = sorted.slice(0, 10);
  if (top10.length > 0) {
    lines.push(`<h2>Priority Action Items</h2><div class="card"><table>`);
    lines.push(`<tr><th>#</th><th>Priority</th><th>Action</th><th>File</th></tr>`);
    top10.forEach((iss, i) => {
      lines.push(`<tr><td>${i + 1}</td><td><span class="badge badge-${iss.severity}">${iss.severity.toUpperCase()}</span></td><td>${esc(iss.title)}</td><td style="font-family:monospace;font-size:0.8rem;color:var(--muted)">${iss.file ? esc(iss.file) : '-'}</td></tr>`);
    });
    lines.push(`</table></div>`);
  }

  lines.push(`<p class="footer">Generated by Introspect | ${esc(result.scannedAt)} | For authorized use only</p>`);
  lines.push(`</div></body></html>`);

  const blob = new Blob([lines.join('\n')], { type: 'text/html' });
  const urlObj = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = urlObj;
  a.download = `introspect-${result.repoName.replace('/', '-')}.html`;
  a.click();
  URL.revokeObjectURL(urlObj);
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [view, setView] = useState<View>('scan');
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('severity');
  const [elapsed, setElapsed] = useState(0);
  const [aiKey, setAiKey] = useState('');
  const [aiProvider, setAiProvider] = useState<'openai' | 'anthropic' | 'groq'>('groq');
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiSetup, setShowAiSetup] = useState(false);
  const [scanMode, setScanMode] = useState<'github' | 'zip' | 'live'>('github');
  const [liveResult, setLiveResult] = useState<LiveScanResult | null>(null);
  const [liveTarget, setLiveTarget] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [reportTab, setReportTab] = useState<'code' | 'git'>('code');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load AI key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('introspect:aiKey');
    const savedProvider = localStorage.getItem('introspect:aiProvider');
    if (savedKey) setAiKey(savedKey);
    if (savedProvider) setAiProvider(savedProvider as 'openai' | 'anthropic' | 'groq');
  }, []);

  const saveAiConfig = (key: string, provider: string) => {
    setAiKey(key);
    setAiProvider(provider as 'openai' | 'anthropic' | 'groq');
    if (key) localStorage.setItem('introspect:aiKey', key);
    else localStorage.removeItem('introspect:aiKey');
    localStorage.setItem('introspect:aiProvider', provider);
  };

  const runAiFeature = async (action: string) => {
    if (!aiKey || !result) return;
    setAiAction(action);
    setAiResult('');
    setAiLoading(true);
    try {
      const body: Record<string, unknown> = {
        action,
        apiKey: aiKey,
        provider: aiProvider,
        scanResult: result,
      };
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI request failed');
      setAiResult(data.result);
    } catch (err) {
      setAiResult(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setAiLoading(false);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.customSelect}`)) {
        setSortOpen(false);
        setProviderOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // Load scan from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('scan');
    if (!id) return;
    const cached = loadScan(id);
    if (cached) {
      setResult(cached);
      setScanId(id);
      setFilter('all');
      setView('results');
    } else {
      // expired or missing — clean URL
      window.history.replaceState(null, '', '/');
    }
  }, []);

  const showResult = useCallback((data: ScanResult) => {
    const id = generateId();
    saveScan(id, data);
    setScanId(id);
    window.history.pushState(null, '', `/?scan=${id}`);
    setResult(data);
    setFilter('all');
    setView('results');
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const cleanupTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
  }, []);

  const eventSourceRef = useRef<EventSource | null>(null);
  const [fileMeta, setFileMeta] = useState<{ filesScanned?: number; totalFiles?: number }>({});

  const doScan = () => {
    if (!url.trim()) return;
    setView('loading');
    setStep(0);
    setElapsed(0);
    setError(null);
    setFileMeta({});
    topRef.current?.scrollIntoView({ behavior: 'smooth' });

    const start = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    const encodedUrl = encodeURIComponent(url);
    const es = new EventSource(`/api/scan/stream?repoUrl=${encodedUrl}`);
    eventSourceRef.current = es;

    let currentStep = 0;

    es.addEventListener('step', (e) => {
      const data = JSON.parse(e.data);
      const stepIndex = STEPS.findIndex((s) => s === data.step);
      if (stepIndex >= 0) currentStep = stepIndex;
      else currentStep = Math.min(currentStep + 1, STEPS.length - 1);

      setStep(currentStep);
      setFileMeta({
        filesScanned: data.filesScanned,
        totalFiles: data.totalFiles ?? data.filesFound,
      });
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      es.close();
      eventSourceRef.current = null;
      cleanupTimers();
      setStep(STEPS.length);
      setTimeout(() => showResult(data.result), 400);
    });

    es.addEventListener('error', (e) => {
      if (e instanceof MessageEvent) {
        const data = JSON.parse(e.data);
        setError(data.message || 'Scan failed. Please try again.');
      } else {
        setError('Connection lost. Please try again.');
      }
      es.close();
      eventSourceRef.current = null;
      cleanupTimers();
      setView('scan');
    });
  };

  const doZipScan = async (file: File) => {
    setView('loading');
    setStep(0);
    setError(null);
    setElapsed(0);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });

    const maxStep = STEPS.length - 1;
    const timer = setInterval(() => {
      setStep((s) => {
        if (s >= maxStep) { clearInterval(timer); return maxStep; }
        return s + 1;
      });
    }, 3000);
    timerRef.current = timer;
    const start = Date.now();
    elapsedRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch('/api/scan', { method: 'POST', body: formData, signal: controller.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      cleanupTimers();
      showResult(data);
    } catch (err) {
      cleanupTimers();
      if (err instanceof DOMException && err.name === 'AbortError') { setView('scan'); return; }
      setError(err instanceof Error ? err.message : 'Scan failed');
      setView('scan');
    }
  };

  const cancelScan = () => {
    abortRef.current?.abort();
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    cleanupTimers();
    setView('scan');
  };

  const doLiveScan = () => {
    if (!liveTarget.trim()) return;
    setView('loading');
    setStep(0);
    setElapsed(0);
    setError(null);
    setLiveResult(null);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });

    const start = Date.now();
    elapsedRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);

    const encodedTarget = encodeURIComponent(liveTarget);
    const es = new EventSource(`/api/live-scan?target=${encodedTarget}`);
    eventSourceRef.current = es;

    es.addEventListener('step', (e) => {
      const data = JSON.parse(e.data);
      const idx = LIVE_STEPS.findIndex((s) => s === data.step);
      if (idx >= 0) setStep(idx);
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      es.close();
      eventSourceRef.current = null;
      cleanupTimers();
      setStep(LIVE_STEPS.length);
      setLiveResult(data.result);
      setView('results');
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    es.addEventListener('error', (e) => {
      if (e instanceof MessageEvent) {
        const data = JSON.parse(e.data);
        setError(data.message || 'Live scan failed');
      } else {
        setError('Connection lost');
      }
      es.close();
      eventSourceRef.current = null;
      cleanupTimers();
      setView('scan');
    });
  };

  const reset = () => {
    setView('scan');
    setUrl('');
    setResult(null);
    setLiveResult(null);
    setScanId(null);
    window.history.replaceState(null, '', '/');
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const issues = useMemo(() => {
    if (!result) return [];
    const list = filter === 'all' ? result.issues : result.issues.filter((i) => i.type === filter);
    return [...list].sort((a, b) => {
      if (sort === 'severity') return (SEV_ORDER[a.severity] ?? 4) - (SEV_ORDER[b.severity] ?? 4);
      if (sort === 'type') return a.type.localeCompare(b.type);
      return (a.file ?? '').localeCompare(b.file ?? '');
    });
  }, [result, filter, sort]);

  const sc = (v: number) => v >= 80 ? '#3fb950' : v >= 60 ? '#58a6ff' : v >= 40 ? '#d29922' : '#f85149';

  return (
    <div className={styles.page} ref={topRef}>
      <div className={styles.bgLayer} />
      <div className={styles.wrap}>

        {/* ── SCAN ── */}
        {(view === 'scan' || view === 'loading') && (
          <section className={`${styles.hero} ${view === 'loading' ? styles.heroLoading : ''}`}>
            <h1><Image src="/icon.svg" alt="Introspect" width={40} height={40} className={styles.headingIcon} /> Your code,<br /><span className={styles.hl}>deeply analyzed.</span></h1>
            <p className={styles.sub}>
              Scan any repo for vulnerabilities, performance bottlenecks, and hidden tech debt — before it hits production.
            </p>

            <div className={styles.scanSplit}>
              {/* Left — input */}
              <div className={styles.scanLeft}>
                <div className={styles.scanCard}>
                  <div className={styles.scanTabs}>
                    <button className={`${styles.scanTab} ${scanMode === 'github' ? styles.scanTabOn : ''}`} onClick={() => setScanMode('github')}>
                      <Globe size={13} /> GitHub URL
                    </button>
                    <button className={`${styles.scanTab} ${scanMode === 'zip' ? styles.scanTabOn : ''}`} onClick={() => setScanMode('zip')}>
                      <Package size={13} /> ZIP Upload
                    </button>
                    <button className={`${styles.scanTab} ${scanMode === 'live' ? styles.scanTabOn : ''}`} onClick={() => setScanMode('live')}>
                      <Shield size={13} /> Live Scan
                    </button>
                  </div>

                  {scanMode === 'github' && (
                    <>
                      <div className={styles.inputRow}>
                        <input
                          className={styles.urlIn}
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && doScan()}
                          placeholder="https://github.com/owner/repo"
                          disabled={view === 'loading'}
                        />
                        {view === 'loading' ? (
                          <button className={styles.cancelBtn} onClick={cancelScan}>
                            <X size={13} /> Cancel
                          </button>
                        ) : (
                          <button className={styles.runBtn} onClick={doScan} disabled={!url.trim()}>
                            Scan <ArrowRight size={13} className={styles.arr} />
                          </button>
                        )}
                      </div>
                      {view === 'scan' && (
                        <div className={styles.tryRow}>
                          <span>Try:</span>
                          {['expressjs/express', 'pallets/flask', 'laravel/framework'].map((r) => (
                            <button key={r} className={styles.tryBtn} onClick={() => setUrl(`https://github.com/${r}`)}>{r}</button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {scanMode === 'zip' && (
                    <div
                      className={styles.dropZone}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add(styles.dropActive ?? ''); }}
                      onDragLeave={(e) => { e.currentTarget.classList.remove(styles.dropActive ?? ''); }}
                      onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove(styles.dropActive ?? ''); const f = e.dataTransfer.files[0]; if (f && f.name.endsWith('.zip')) doZipScan(f); }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        className={styles.fileIn}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) doZipScan(f); }}
                      />
                      <Package size={24} className={styles.dropIcon} />
                      <span className={styles.dropText}>Drop a .zip file here or <strong>click to browse</strong></span>
                    </div>
                  )}

                  {scanMode === 'live' && (
                    <div className={styles.inputRow}>
                      <input
                        className={styles.urlIn}
                        value={liveTarget}
                        onChange={(e) => setLiveTarget(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && doLiveScan()}
                        placeholder="example.com or https://example.com"
                        disabled={view === 'loading'}
                      />
                      {view === 'loading' && scanMode === 'live' ? (
                        <button className={styles.cancelBtn} onClick={cancelScan}>
                          <X size={13} /> Cancel
                        </button>
                      ) : (
                        <button className={styles.runBtn} onClick={doLiveScan} disabled={!liveTarget.trim()}>
                          Scan <ArrowRight size={13} className={styles.arr} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {error && (
                  <div className={styles.errorMsg} onClick={() => setError(null)}>
                    {error}
                  </div>
                )}

                <div className={styles.scanQuick}>
                  <div className={styles.sqItem}><Shield size={13} /> <strong>432</strong> rules</div>
                  <div className={styles.sqItem}><Globe size={13} /> <strong>13</strong> languages</div>
                  <div className={styles.sqItem}><Zap size={13} /> <strong>Git</strong> intelligence</div>
                  <div className={styles.sqItem}><Sparkles size={13} /> <strong>AI</strong> insights</div>
                </div>
              </div>

              {/* Right — terminal */}
              <div className={styles.termBox}>
                <div className={styles.termHeader}>
                  <div className={styles.termDots}><span /><span /><span /></div>
                  <span className={styles.termTitle}>introspect</span>
                  {view === 'loading' && <span className={styles.elapsed}>{elapsed}s</span>}
                </div>
                <div className={styles.termBody}>
                  {view === 'scan' && !url.trim() && (
                    <>
                      <div className={styles.termLine}><span className={styles.termPrompt}>$</span> introspect --version</div>
                      <div className={styles.termLine}><span className={styles.termOut}>v0.1.0</span></div>
                      <div className={styles.termLine}><span className={styles.termPrompt}>$</span> <span className={styles.cursor}>_</span></div>
                    </>
                  )}
                  {view === 'scan' && url.trim() && (
                    <div className={styles.termLine}><span className={styles.termPrompt}>$</span> introspect scan {url.replace('https://github.com/', '')} <span className={styles.termHint}>↵ to scan</span></div>
                  )}
                  {view === 'loading' && (
                    <>
                      <div className={styles.termLine}><span className={styles.termPrompt}>$</span> introspect scan {url.replace('https://github.com/', '')}</div>
                      {fileMeta.totalFiles && (
                        <div className={styles.termLine}><span className={styles.termOut}>Found {fileMeta.totalFiles} files — scanning {fileMeta.filesScanned ?? '...'}</span></div>
                      )}
                      {(scanMode === 'live' ? LIVE_STEPS : STEPS).map((s, i) => {
                        const label = s;
                        return (
                          <div key={s} className={`${styles.termLine} ${i < step ? styles.termDone : ''} ${i === step ? styles.termActive : ''} ${i > step ? styles.termPending : ''}`}>
                            <span className={styles.termPrefix}>
                              {i < step ? '✓' : i === step ? <span className={styles.cursor}>&#9656;</span> : ' '}
                            </span>
                            {label}
                            {i === step && <span className={styles.pulseDot} />}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── SECTIONS (only on scan view, not loading) ── */}
        {view === 'scan' && (
          <>
            {/* Stats */}
            <section className={styles.statsBar}>
              {(scanMode === 'live' ? [
                { icon: <Shield size={16} />, val: '9', label: 'Security Probes' },
                { icon: <Globe size={16} />, val: '20+', label: 'Ports Scanned' },
                { icon: <Lock size={16} />, val: 'SSL', label: 'TLS/DNS Audit' },
                { icon: <Zap size={16} />, val: 'WAF', label: 'Firewall Check' },
              ] : [
                { icon: <Shield size={16} />, val: '432', label: 'Detection Rules' },
                { icon: <Globe size={16} />, val: '13', label: 'Languages' },
                { icon: <Lock size={16} />, val: '0', label: 'API Keys Needed' },
                { icon: <Zap size={16} />, val: 'Fast', label: 'Parallel Scan' },
              ]).map((s) => (
                <div key={s.label} className={styles.statItem}>
                  <span className={styles.statIcon}>{s.icon}</span>
                  <span className={styles.statVal}>{s.val}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </section>

            {/* Features */}
            <section className={styles.featSection}>
              <h2 className={styles.secTitle}>{scanMode === 'live' ? 'What Live Scan checks' : 'What Introspect checks'}</h2>
              <p className={styles.secSub}>{scanMode === 'live' ? 'Probe any URL for security misconfigurations, exposed services, and vulnerabilities.' : 'Every rule runs deterministically — no AI, no cloud, no waiting.'}</p>
              <div className={styles.featGrid}>
                {(scanMode === 'live' ? [
                  { icon: <Shield size={20} />, title: 'HTTP Security Headers', count: 7, desc: 'HSTS, CSP, X-Frame-Options, X-Content-Type, Referrer-Policy, Permissions-Policy, CORS misconfiguration.', color: '#f85149' },
                  { icon: <Lock size={20} />, title: 'SSL/TLS Audit', count: 3, desc: 'Certificate validation, HTTPS redirect, mixed content detection.', color: '#f0883e' },
                  { icon: <Globe size={20} />, title: 'DNS Security', count: 3, desc: 'SPF records, DKIM signing, DMARC policy — email spoofing prevention.', color: '#d29922' },
                  { icon: <Eye size={20} />, title: 'Exposed Files', count: 20, desc: '.env, .git, phpMyAdmin, backups, debug endpoints, package.json, composer.json.', color: '#bc8cff' },
                  { icon: <Zap size={20} />, title: 'Service Discovery', count: 20, desc: 'Port scanning — databases, caches, admin panels, FTP, Telnet, message queues.', color: '#63b3ed' },
                  { icon: <Cpu size={20} />, title: 'Server Security', count: 15, desc: 'Apache/Nginx config, WAF detection, rate limiting, cookie flags, Spring Actuator, directory listing.', color: '#68d391' },
                ] : [
                  { icon: <Shield size={20} />, title: 'Security', count: 253, desc: 'SQL injection, XSS, SSRF, CSRF, command injection, secrets, weak crypto — across 13 languages.', color: '#f85149' },
                  { icon: <Zap size={20} />, title: 'Performance', count: 38, desc: 'N+1 queries across 10 ORMs, blocking I/O, sync calls, bundle bloat, missing indexes.', color: '#f0883e' },
                  { icon: <Code2 size={20} />, title: 'Code Quality', count: 29, desc: 'Cyclomatic complexity, deep nesting, long functions, magic numbers, dead code.', color: '#d29922' },
                  { icon: <Eye size={20} />, title: 'Secrets Scanner', count: 112, desc: '112 patterns: AWS, GCP, Stripe, GitHub, OpenAI, Anthropic, private keys, DB URLs, JWT.', color: '#bc8cff' },
                  { icon: <Package size={20} />, title: 'Dependencies', count: 5, desc: 'Known CVEs, deprecated packages, license conflicts, unpinned versions, wildcard deps.', color: '#63b3ed' },
                  { icon: <FileText size={20} />, title: 'Docs & Tests', count: 5, desc: 'README completeness, missing test files, low test-to-code ratio, documentation gaps.', color: '#68d391' },
                ]).map((f) => (
                  <div key={f.title} className={styles.featCard} style={{ '--fc': f.color } as React.CSSProperties}>
                    <div className={styles.featIcon}>{f.icon}</div>
                    <div>
                      <div className={styles.featHead}>
                        <h3>{f.title}</h3>
                        <span className={styles.featCount}>{f.count} checks</span>
                      </div>
                      <p className={styles.featDesc}>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* How it works */}
            <section className={styles.howSection}>
              <h2 className={styles.secTitle}>How it works</h2>
              <p className={styles.secSub}>Three steps. No signup. No config files.</p>
              <div className={styles.howGrid}>
                {[
                  { num: '01', icon: <Search size={20} />, title: 'Paste URL or Upload', desc: 'Enter a GitHub URL or upload a ZIP file. We fetch and parse the code automatically.' },
                  { num: '02', icon: <Cpu size={20} />, title: 'Instant Analysis', desc: '432 rules scan every file. Security, performance, quality, secrets, git health — all checked.' },
                  { num: '03', icon: <Eye size={20} />, title: 'Get Results', desc: 'Scored dashboard with expandable issues. Before/after code fixes. Export as Markdown.' },
                ].map((h) => (
                  <div key={h.num} className={styles.howCard}>
                    <span className={styles.howNum}>{h.num}</span>
                    <div className={styles.howIcon}>{h.icon}</div>
                    <h3>{h.title}</h3>
                    <p>{h.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Languages */}
            <section className={styles.langSection}>
              <h2 className={styles.secTitle}>Every major language</h2>
              <p className={styles.secSub}>One scanner, every stack. Rules auto-filter by detected language.</p>
              <div className={styles.langGrid}>
                {['JavaScript', 'TypeScript', 'Python', 'PHP', 'Ruby', 'Go', 'Java', 'C#', 'Rust', 'Kotlin', 'Swift', 'C++'].map((l) => (
                  <span key={l} className={styles.langChip}>{l}</span>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className={styles.ctaSection}>
              <h2>Ready to scan your repo?</h2>
              <p>No API key. No signup. Just paste a URL.</p>
              <button className={styles.ctaBtn} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Start Scanning <ArrowRight size={14} />
              </button>
            </section>
          </>
        )}

        {/* loading view removed — terminal is inline in scan split */}

        {/* ── RESULTS ── */}
        {view === 'results' && result && (() => {
          const sevCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
          for (const iss of result.issues) sevCounts[iss.severity] = (sevCounts[iss.severity] || 0) + 1;
          const criticalIssues = result.issues.filter((i) => i.severity === 'critical');
          const groupedBySev: Record<string, typeof result.issues> = {};
          for (const iss of issues) {
            if (!groupedBySev[iss.severity]) groupedBySev[iss.severity] = [];
            groupedBySev[iss.severity]!.push(iss);
          }
          const actionItems = [...issues].sort((a, b) => (SEV_ORDER[a.severity] ?? 4) - (SEV_ORDER[b.severity] ?? 4)).slice(0, 10);
          let issueCounter = 0;

          return (
          <section className={styles.res}>
            <div className={styles.resTop}>
              <div className={styles.resTitle}>Scan Report</div>
              <div className={styles.resActions}>
                <button className={styles.exportBtn} onClick={() => exportHtml(result)}>
                  <Download size={13} /> Export HTML
                </button>
                <button className={styles.printBtn} onClick={exportPdf}>
                  <Printer size={13} /> PDF
                </button>
                <button className={styles.aiSetupBtn} onClick={() => setShowAiSetup(!showAiSetup)}>
                  <Sparkles size={13} /> {aiKey ? 'AI On' : 'Add AI Key'}
                </button>
                <button className={styles.backBtn} onClick={reset}>← New scan</button>
              </div>
            </div>
            <div className={styles.resMeta}>
              {result.repoName} · Scanned {result.totalFiles}{result.totalRepoFiles ? ` of ${result.totalRepoFiles} files` : ' files'}{result.totalRepoFiles && result.totalRepoFiles > result.totalFiles ? ` · ${result.totalRepoFiles - result.totalFiles} skipped (non-scannable)` : ''} · {result.totalLines.toLocaleString()} lines · {elapsed}s
            </div>

            {/* Report Tabs */}
            <div className={styles.reportTabs}>
              <button className={`${styles.reportTab} ${reportTab === 'code' ? styles.reportTabOn : ''}`} onClick={() => setReportTab('code')}>
                <Code2 size={14} /> Code Analysis
              </button>
              <button className={`${styles.reportTab} ${reportTab === 'git' ? styles.reportTabOn : ''}`} onClick={() => setReportTab('git')}>
                <GitBranch size={14} /> Git Intelligence
              </button>
            </div>

            {showAiSetup && (
              <div className={styles.aiSetupBox}>
                <div className={styles.aiSetupRow}>
                  <div className={styles.customSelect} onClick={() => { setProviderOpen(!providerOpen); setSortOpen(false); }}>
                    <span className={styles.csValue}>
                      {aiProvider === 'groq' ? 'Groq (free)' : aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'}
                    </span>
                    <ChevronRight size={12} className={`${styles.csArrow} ${providerOpen ? styles.csArrowOpen : ''}`} />
                    {providerOpen && (
                      <div className={styles.csDropdown}>
                        {[
                          { value: 'groq', label: 'Groq (free, fast)' },
                          { value: 'openai', label: 'OpenAI' },
                          { value: 'anthropic', label: 'Anthropic' },
                        ].map((o) => (
                          <div key={o.value} className={`${styles.csOption} ${aiProvider === o.value ? styles.csOptionActive : ''}`}
                            onClick={(e) => { e.stopPropagation(); saveAiConfig(aiKey, o.value); setProviderOpen(false); }}>
                            {o.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    className={styles.aiKeyInput}
                    type="password"
                    placeholder="Paste your API key..."
                    value={aiKey}
                    onChange={(e) => saveAiConfig(e.target.value, aiProvider)}
                  />
                </div>
                <span className={styles.aiKeyHint}>Key stays in your browser localStorage only — never stored or transmitted</span>
                <div className={styles.aiFeatures}>
                  {[
                    { action: 'narrative', icon: <FileCode size={15} />, label: 'Narrative Report' },
                    { action: 'shadow-cto', icon: <Brain size={15} />, label: 'Shadow CTO' },
                    { action: 'onboarding-guide', icon: <BookOpen size={15} />, label: 'Onboarding Guide' },
                    { action: 'release-notes', icon: <GitBranch size={15} />, label: 'Release Notes' },
                    { action: 'blame-therapy', icon: <Heart size={15} />, label: 'Blame Therapy' },
                    { action: 'code-dna', icon: <Cpu size={15} />, label: 'Code DNA' },
                    { action: 'interview-questions', icon: <Search size={15} />, label: 'Interview Questions' },
                    { action: 'postmortem', icon: <Shield size={15} />, label: 'Postmortem' },
                  ].map((f) => (
                    <button
                      key={f.action}
                      className={`${styles.aiFeatBtn} ${aiAction === f.action ? styles.aiFeatActive : ''} ${!aiKey ? styles.aiFeatLocked : ''}`}
                      onClick={() => aiKey ? runAiFeature(f.action) : undefined}
                      disabled={aiLoading || !aiKey}
                    >
                      {f.icon} {f.label} {!aiKey && <Lock size={10} />}
                    </button>
                  ))}
                </div>
                {(aiLoading || aiResult) && (
                  <div className={styles.aiResultBox}>
                    {aiLoading && <div className={styles.aiLoadingDot}>Thinking...</div>}
                    {aiResult && <pre className={styles.aiResultText}>{aiResult}</pre>}
                  </div>
                )}
              </div>
            )}

            {/* Radar + Score Cards */}
            {reportTab === 'code' && <>
            <div className={styles.scoreRow}>
              <div className={styles.radarWrap}>
                <RadarChart scores={result.scores} />
              </div>
              <div className={styles.scores}>
                <div className={styles.scoreCard}>
                  <div className={styles.scoreN} style={{ color: sc(result.overallScore) }}>{result.overallScore}</div>
                  <div className={styles.scoreL}>Health</div>
                </div>
                {Object.entries(result.scores).map(([k, v]) => (
                  <div key={k} className={styles.scoreCard}>
                    <div className={styles.scoreN} style={{ color: sc(v) }}>{v}</div>
                    <div className={styles.scoreL}>{k.replace(/([A-Z])/g, ' $1').trim()}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alert Banner */}
            {(sevCounts.critical ?? 0) > 0 && (
              <div className={styles.alertBanner}>
                <div className={styles.alertNumber}>{sevCounts.critical} CRITICAL Finding{(sevCounts.critical ?? 0) > 1 ? 's' : ''}</div>
                <div className={styles.alertList}>{criticalIssues.map((i) => i.title).join(' / ')}</div>
                <div className={styles.alertUrgent}>IMMEDIATE ACTION REQUIRED</div>
              </div>
            )}

            {/* Executive Summary */}
            <div className={styles.aiBox}>
              <div className={styles.aiLbl}><span className={styles.aiDot} /> Executive Summary</div>
              <div className={styles.aiTxt}>{result.summary.split('\n').map((line, i) => <div key={i}>{line}</div>)}</div>
            </div>

            {/* Severity Stat Cards */}
            <div className={styles.sevGrid}>
              <div className={styles.sevCard}>
                <div className={styles.sevNumber} style={{ color: '#e2e8f0' }}>{result.issues.length}</div>
                <div className={styles.sevLabel}>Total</div>
              </div>
              {SEV_LABELS.map((s) => (
                <div key={s.key} className={styles.sevCard}>
                  <div className={styles.sevNumber} style={{ color: s.color }}>{sevCounts[s.key] || 0}</div>
                  <div className={styles.sevLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filter Tabs */}
            <div className={styles.filters}>
              <div className={styles.filterTabs}>
                {CATS.map((c) => {
                  const cnt = c.key === 'all' ? result.issues.length : result.issues.filter((i) => i.type === c.key).length;
                  if (cnt === 0 && c.key !== 'all') return null;
                  return (
                    <button key={c.key} className={`${styles.ft} ${filter === c.key ? styles.ftOn : ''}`} onClick={() => setFilter(c.key)}>
                      {c.label}<span className={styles.ftCt}>{cnt}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.filterRight}>
                <span className={styles.issueCount}>{issues.length} issues</span>
                <div className={styles.customSelect} onClick={() => { setSortOpen(!sortOpen); setProviderOpen(false); }}>
                  <span className={styles.csValue}>{sort === 'severity' ? 'Severity' : sort === 'type' ? 'Category' : 'File'}</span>
                  <ChevronRight size={12} className={`${styles.csArrow} ${sortOpen ? styles.csArrowOpen : ''}`} />
                  {sortOpen && (
                    <div className={styles.csDropdown}>
                      {[
                        { value: 'severity', label: 'Severity' },
                        { value: 'type', label: 'Category' },
                        { value: 'file', label: 'File' },
                      ].map((o) => (
                        <div key={o.value} className={`${styles.csOption} ${sort === o.value ? styles.csOptionActive : ''}`}
                          onClick={(e) => { e.stopPropagation(); setSort(o.value as SortKey); setSortOpen(false); }}>
                          {o.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Grouped Findings by Severity */}
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => {
              const sevIssues = groupedBySev[sev];
              if (!sevIssues || sevIssues.length === 0) return null;
              return (
                <div key={sev} className={styles.sevSection}>
                  <div className={styles.sevHeader}>
                    <span className={styles.sevHeaderDot} style={{ background: SEV[sev] }} />
                    {sev.toUpperCase()} Findings ({sevIssues.length})
                  </div>
                  {sevIssues.map((issue) => {
                    issueCounter++;
                    const issId = `ISS-${String(issueCounter).padStart(3, '0')}`;
                    return (
                      <div key={issue.id} className={`${styles.finding} ${styles[SEV_FINDING[issue.severity] ?? ''] || ''}`}>
                        <div className={styles.findingTop}>
                          <span className={`${styles.badge} ${styles[SEV_BADGE[issue.severity] ?? ''] || ''}`}>{issue.severity.toUpperCase()}</span>
                          <span className={styles.findingId}>{issId}</span>
                          <span className={`${styles.iTag} ${styles[TAG[issue.type] || ''] || ''}`}>{issue.type.replace('_', '-')}</span>
                        </div>
                        <div className={styles.findingTitle}>{issue.title}</div>
                        {issue.file && <div className={styles.findingFile}>{issue.file}{issue.line ? `:${issue.line}` : ''}</div>}
                        <p className={styles.findingDesc}>{issue.description}</p>
                        {issue.badCode && (
                          <div className={styles.evidence}>{issue.badCode}</div>
                        )}
                        {issue.goodCode && (
                          <div className={styles.recommendation}>
                            <div className={styles.recommendationLabel}>Recommendation</div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: 1.7 }}>{issue.goodCode}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Priority Action Items */}
            {actionItems.length > 0 && (
              <div className={styles.actionTable}>
                <div className={styles.actionTableTitle}>Priority Action Items</div>
                <table className={styles.prTable}>
                  <thead>
                    <tr><th>#</th><th>Priority</th><th>Action</th><th>File</th></tr>
                  </thead>
                  <tbody>
                    {actionItems.map((iss, i) => (
                      <tr key={iss.id}>
                        <td>{i + 1}</td>
                        <td><span className={`${styles.badge} ${styles[SEV_BADGE[iss.severity] ?? ''] || ''}`}>{iss.severity.toUpperCase()}</span></td>
                        <td>{iss.title}</td>
                        <td className={styles.prFile}>{iss.file || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </>}

            {/* Git Intelligence Tab */}
            {reportTab === 'git' && (
              <div className={styles.gitTab}>
                {result.gitIntelligence ? (
                  <>
                    {/* Branch info */}
                    <div className={styles.aiBox}>
                      <div className={styles.aiLbl}>Repository Info</div>
                      <div className={styles.aiTxt}>
                        <div>Branch: <strong>{result.gitIntelligence.currentBranch}</strong> · {result.gitIntelligence.branches.length} total branches · {result.gitIntelligence.totalCommits} commits · {result.gitIntelligence.contributors.length} contributors</div>
                      </div>
                    </div>

                    {/* Contributors */}
                    <div className={styles.sevSection}>
                      <div className={styles.sevHeader}>Contributors ({result.gitIntelligence.contributors.length})</div>
                      {result.gitIntelligence.contributors.map((c) => (
                        <div key={c.name} className={`${styles.finding} ${styles.findingInfo}`}>
                          <div className={styles.findingTitle}>{c.name}</div>
                          <div className={styles.findingDesc}>
                            {c.commits} commits · +{c.linesAdded.toLocaleString()} / -{c.linesDeleted.toLocaleString()} lines · {c.activeDays} active days
                          </div>
                          <div className={styles.findingFile}>
                            First: {new Date(c.firstCommit).toLocaleDateString()} · Last: {new Date(c.lastCommit).toLocaleDateString()}
                          </div>
                          {c.topFiles.length > 0 && (
                            <div className={styles.evidence}>Top files: {c.topFiles.join(', ')}</div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Recent Commits */}
                    <div className={styles.sevSection}>
                      <div className={styles.sevHeader}>Recent Commits ({result.gitIntelligence.recentCommits.length})</div>
                      <div className={styles.actionTable}>
                        <table className={styles.prTable}>
                          <thead>
                            <tr><th>SHA</th><th>Author</th><th>Message</th><th>Changes</th><th>Date</th></tr>
                          </thead>
                          <tbody>
                            {result.gitIntelligence.recentCommits.map((c) => (
                              <tr key={c.sha}>
                                <td className={styles.prFile}>{c.shortSha}</td>
                                <td>{c.author}</td>
                                <td>{c.message.slice(0, 60)}{c.message.length > 60 ? '...' : ''}</td>
                                <td className={styles.prFile}>+{c.insertions} -{c.deletions} ({c.filesChanged} files)</td>
                                <td className={styles.prFile}>{new Date(c.date).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* File Blame */}
                    {Object.keys(result.gitIntelligence.fileBlame).length > 0 && (
                      <div className={styles.sevSection}>
                        <div className={styles.sevHeader}>File Ownership (Top Changed Files)</div>
                        {Object.entries(result.gitIntelligence.fileBlame).map(([file, entries]) => (
                          <div key={file} className={`${styles.finding} ${styles.findingLow}`}>
                            <div className={styles.findingFile}>{file}</div>
                            <div className={styles.findingDesc}>
                              {entries.map((e) => `${e.author} (${e.percentage}%)`).join(' · ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Timeline */}
                    {result.gitIntelligence.timeline.length > 0 && (
                      <div className={styles.sevSection}>
                        <div className={styles.sevHeader}>Activity Timeline</div>
                        <div className={styles.actionTable}>
                          <table className={styles.prTable}>
                            <thead>
                              <tr><th>Week</th><th>Commits</th><th>Authors</th><th>Lines Added</th><th>Lines Deleted</th></tr>
                            </thead>
                            <tbody>
                              {result.gitIntelligence.timeline.slice(-12).map((t) => (
                                <tr key={t.week}>
                                  <td className={styles.prFile}>{t.week}</td>
                                  <td>{t.commits}</td>
                                  <td>{t.authors}</td>
                                  <td style={{ color: '#3fb950' }}>+{t.insertions.toLocaleString()}</td>
                                  <td style={{ color: '#f85149' }}>-{t.deletions.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.aiBox}>
                    <div className={styles.aiTxt}>
                      Git intelligence data is not available for this scan. Git data is available when scanning GitHub repos or local repositories with a .git folder.
                    </div>
                  </div>
                )}
              </div>
            )}

          </section>
          );
        })()}

        {/* ── LIVE SCAN RESULTS ── */}
        {view === 'results' && liveResult && !result && (
          <section className={styles.res}>
            <div className={styles.resTop}>
              <div className={styles.resTitle}>Live Security Report</div>
              <div className={styles.resActions}>
                <button className={styles.backBtn} onClick={reset}>← New scan</button>
              </div>
            </div>
            <div className={styles.resMeta}>
              {liveResult.target} · {liveResult.findings.length} findings · {(liveResult.scanDurationMs / 1000).toFixed(1)}s
              {liveResult.serverInfo?.server && ` · Server: ${liveResult.serverInfo.server}`}
              {liveResult.serverInfo?.framework && ` · ${liveResult.serverInfo.framework}`}
            </div>

            {/* Alert banner */}
            {(liveResult.summary.critical ?? 0) > 0 && (
              <div className={styles.alertBanner}>
                <div className={styles.alertNumber}>{liveResult.summary.critical} CRITICAL Finding{(liveResult.summary.critical ?? 0) > 1 ? 's' : ''}</div>
                <div className={styles.alertList}>
                  {liveResult.findings.filter((f) => f.severity === 'critical').map((f) => f.title).join(' / ')}
                </div>
                <div className={styles.alertUrgent}>IMMEDIATE ACTION REQUIRED</div>
              </div>
            )}

            {/* Severity stat grid */}
            <div className={styles.sevGrid}>
              {[
                { label: 'Total', count: liveResult.summary.total, color: '#e2e8f0' },
                { label: 'Critical', count: liveResult.summary.critical, color: '#f85149' },
                { label: 'High', count: liveResult.summary.high, color: '#f0883e' },
                { label: 'Medium', count: liveResult.summary.medium, color: '#d29922' },
                { label: 'Low', count: liveResult.summary.low, color: '#58a6ff' },
                { label: 'Info', count: liveResult.summary.info, color: '#6b7a8d' },
              ].map((s) => (
                <div key={s.label} className={styles.sevCard}>
                  <div className={styles.sevNumber} style={{ color: s.color }}>{s.count}</div>
                  <div className={styles.sevLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Grouped findings */}
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => {
              const sevFindings = liveResult.findings.filter((f) => f.severity === sev);
              if (sevFindings.length === 0) return null;
              return (
                <div key={sev} className={styles.sevSection}>
                  <div className={styles.sevHeader}>
                    <span className={styles.sevHeaderDot} style={{ background: SEV[sev] }} />
                    {sev.toUpperCase()} Findings ({sevFindings.length})
                  </div>
                  {sevFindings.map((finding) => (
                    <div key={finding.id} className={`${styles.finding} ${styles[SEV_FINDING[finding.severity] ?? ''] || ''}`}>
                      <div className={styles.findingTop}>
                        <span className={`${styles.badge} ${styles[SEV_BADGE[finding.severity] ?? ''] || ''}`}>{finding.severity.toUpperCase()}</span>
                        <span className={`${styles.iTag} ${styles.tSec}`}>{finding.probe}</span>
                      </div>
                      <div className={styles.findingTitle}>{finding.title}</div>
                      <div className={styles.findingDesc}>{finding.description}</div>
                      {finding.evidence && (
                        <div className={styles.evidence}>{finding.evidence}</div>
                      )}
                      {finding.recommendation && (
                        <div className={styles.recommendation}>
                          <div className={styles.recommendationLabel}>Recommendation</div>
                          {finding.recommendation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        )}
      </div>

      <footer className={styles.foot}>Built by <a href="https://kishanpatel385.github.io/" target="_blank" rel="noopener noreferrer"><strong>Kishan Patel</strong></a></footer>
    </div>
  );
}
