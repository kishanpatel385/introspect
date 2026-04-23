// ─── Scan Result ──────────────────────────────────────────────
export interface ScanResult {
  repoName: string;
  scannedAt: string;
  overallScore: number;
  scores: CategoryScores;
  summary: string;
  issues: Issue[];
  totalFiles: number;
  totalRepoFiles?: number;
  totalLines: number;
  languages: string[];
  scanMode: ScanMode;
  scanDurationMs: number;
  gitIntelligence?: GitIntelligence;
}

export interface GitIntelligence {
  branches: string[];
  currentBranch: string;
  totalCommits: number;
  contributors: {
    name: string;
    email: string;
    commits: number;
    linesAdded: number;
    linesDeleted: number;
    firstCommit: string;
    lastCommit: string;
    activeDays: number;
    topFiles: string[];
  }[];
  recentCommits: {
    sha: string;
    shortSha: string;
    author: string;
    date: string;
    message: string;
    filesChanged: number;
    insertions: number;
    deletions: number;
  }[];
  timeline: {
    week: string;
    commits: number;
    authors: number;
    insertions: number;
    deletions: number;
  }[];
  fileBlame: Record<string, { author: string; lines: number; percentage: number }[]>;
}

export interface CategoryScores {
  security: number;
  performance: number;
  quality: number;
  duplication: number;
  deadCode: number;
  dependencies: number;
  docs: number;
  gitHealth: number;
}

// ─── Issues ───────────────────────────────────────────────────
export type IssueType =
  | 'security'
  | 'performance'
  | 'quality'
  | 'duplication'
  | 'dead_code'
  | 'dependency'
  | 'docs'
  | 'git';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Issue {
  id: string;
  ruleId: string;
  type: IssueType;
  severity: Severity;
  title: string;
  description: string;
  file?: string;
  line?: number;
  endLine?: number;
  column?: number;
  badCode?: string;
  goodCode?: string;
  language?: string;
}

// ─── Rules ────────────────────────────────────────────────────
export interface Rule {
  id: string;
  language: string[];
  severity: Severity;
  category: IssueType;
  pattern: string;
  message: string;
  fix?: {
    bad: string;
    good: string;
  };
}

// ─── Repo & Files ─────────────────────────────────────────────
export interface RepoFile {
  path: string;
  content: string;
  size: number;
  language?: string;
}

export type ScanMode = 'quick' | 'deep' | 'upload';

export interface ScanRequest {
  source: GitHubSource | ZipSource | LocalSource;
  mode: ScanMode;
  aiProvider?: AiProviderConfig;
}

export interface GitHubSource {
  type: 'github';
  url: string;
  token?: string;
}

export interface ZipSource {
  type: 'zip';
  buffer: ArrayBuffer;
}

export interface LocalSource {
  type: 'local';
  path: string;
}

// ─── AI Providers ─────────────────────────────────────────────
export type AiProviderName = 'groq' | 'anthropic' | 'openai';

export interface AiProviderConfig {
  name: AiProviderName;
  apiKey: string;
  model?: string;
}

export interface AiProvider {
  name: AiProviderName;
  chat(systemPrompt: string, userPrompt: string): Promise<string>;
  chatStream(systemPrompt: string, userPrompt: string): AsyncIterable<string>;
}

// ─── Features (all free, no tiers) ───────────────────────────
export const ALL_FEATURES = [
  'scan', 'ai-byok', 'cli', 'public-repos', 'zip-upload',
  'scan-history', 'private-repos', 'pdf-export',
  'org-dashboard', 'pr-bot',
  'shadow-cto', 'blame-therapy', 'migration-planner',
  'onboarding-guide', 'release-notes', 'code-review',
  'narrative-report',
] as const;

export type Feature = typeof ALL_FEATURES[number];

// ─── Supported Languages ──────────────────────────────────────
export const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'python', 'php', 'ruby',
  'go', 'java', 'csharp', 'rust', 'kotlin', 'swift',
  'cpp', 'c',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_EXTENSIONS: Record<string, SupportedLanguage> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.php': 'php',
  '.rb': 'ruby',
  '.go': 'go',
  '.java': 'java',
  '.cs': 'csharp',
  '.rs': 'rust',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.swift': 'swift',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c': 'c',
  '.h': 'c',
};
