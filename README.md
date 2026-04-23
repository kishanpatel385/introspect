<p align="center">
  <img src="apps/web/app/icon.svg" alt="Introspect" width="80" height="80" />
</p>

<h1 align="center">Introspect</h1>

<p align="center"><strong>Your code, deeply analyzed. Your server, thoroughly probed.</strong></p>

Introspect is a multi-language code scanner and live server security auditor. It scans GitHub repos, local projects, and ZIP uploads for security vulnerabilities, performance issues, dead code, and leaked secrets using 432 detection rules across 13 languages. It also probes live URLs/servers for security misconfigurations, exposed services, and infrastructure weaknesses.

All features are free. No signup. No API key needed for scanning (AI features are optional BYOK).

[![npm](https://img.shields.io/npm/v/@introspect-cli/introspect)](https://www.npmjs.com/package/@introspect-cli/introspect)

---

## Two Scan Modes

### 1. Code Scan
Analyzes source code for vulnerabilities and quality issues.

- **432 detection rules** — security (253), performance (38), quality (29), secrets (112)
- **13 languages** — JavaScript, TypeScript, Python, PHP, Ruby, Go, Java, C#, Rust, Kotlin, Swift, C++
- **Git Intelligence** — bus factor, team velocity, code hotspots, stale files, ownership maps
- **Input options** — GitHub URL, ZIP upload, or local path (CLI)

### 2. Live Scan
Probes a live URL/domain for server and network security issues.

- **HTTP Security Headers** — HSTS, CSP, X-Frame-Options, CORS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options
- **SSL/TLS Audit** — certificate validation, HTTP-to-HTTPS redirect, mixed content
- **DNS Security** — SPF record validation, DKIM signing check, DMARC policy audit
- **Exposed Files & Endpoints** — .env, .git, phpMyAdmin, Adminer, backups, debug endpoints, package.json, composer.json (20 paths checked)
- **Cookie Security** — HttpOnly, Secure, SameSite flags on session cookies
- **Rate Limiting** — tests if server enforces request limits against brute-force
- **Service Discovery** — port scanning for exposed databases (MySQL, PostgreSQL, MongoDB, Redis, Elasticsearch), caches (Memcached), message queues (RabbitMQ), admin panels (20 common ports)
- **WAF/Firewall Detection** — detects Cloudflare, AWS CloudFront, Akamai, Sucuri, Vercel, Netlify + tests if WAF blocks SQL injection payloads
- **Apache/httpd Security** — directory listing (Options +Indexes), mod_status/mod_info exposure, ETag inode leak, server version disclosure
- **Nginx Security** — default page detection, stub_status exposure, server version disclosure
- **Spring Boot** — Actuator endpoints (env, beans, health) exposure check
- **General** — server version headers, X-Powered-By disclosure, security.txt presence

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)

### Web Dashboard

```bash
# Clone the repository
git clone https://github.com/kishanpatel385/introspect
cd introspect

# Install dependencies
pnpm install

# Create environment file (optional — for GitHub code scanning)
echo "GITHUB_TOKEN=your_github_token" > apps/web/.env

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

**Getting a GitHub token:** GitHub Settings > Developer settings > Personal access tokens > Generate new token (classic) > select `public_repo` scope. This is optional but recommended — without it, GitHub API rate limits to 60 requests/hour.

### How to Use the Web Dashboard

1. **Code Scan:** Select "GitHub URL" tab > paste a public repo URL > click Scan. Or select "ZIP Upload" and drag a ZIP file.
2. **Live Scan:** Select "Live Scan" tab > enter a domain (e.g., `example.com`) > click Scan.
3. **View Results:** Results page shows scores, severity breakdown, grouped findings with evidence and recommendations.
4. **AI Insights:** Click "Add AI Key" button > select provider (Groq is free) > paste your API key > click any AI feature button.
5. **Export:** Click "Export HTML" for a standalone report file, or "PDF" for print-to-PDF.

### CLI

```bash
# Scan a GitHub repo
npx introspect scan https://github.com/owner/repo

# Scan local directory
npx introspect scan .

# Export report
npx introspect report --format md
npx introspect report --format json -o report.json
npx introspect report --format html -o report.html

# AI-powered code review (requires API key)
INTROSPECT_AI_KEY=your_key INTROSPECT_AI_PROVIDER=groq introspect review src/app.ts

# Generate PR description from current git diff
INTROSPECT_AI_KEY=your_key INTROSPECT_AI_PROVIDER=groq introspect pr

# Chat with AI about your codebase
INTROSPECT_AI_KEY=your_key INTROSPECT_AI_PROVIDER=groq introspect chat https://github.com/owner/repo
```

### CLI Commands Reference

| Command | Description |
|---|---|
| `introspect scan <url\|path>` | Scan a GitHub URL or local directory |
| `introspect report --format <md\|json\|html>` | Export last scan as report |
| `introspect review <file>` | Scan a file + optional AI code review |
| `introspect pr` | Generate PR description from git diff |
| `introspect chat [url\|path]` | Chat with AI about scan results (REPL) |
| `introspect version` | Show version |

---

## Results Page Features

### Code Scan Results (2 Tabs)

**Tab 1 — Code Analysis:**
- **Radar chart** — visual score breakdown across 9 categories
- **Score cards** — Health, Security, Performance, Quality, Duplication, Dead Code, Dependencies, Docs, Git Health
- **Alert banner** — prominent red warning when critical issues found
- **Severity stat grid** — Total, Critical, High, Medium, Low, Info counts
- **Grouped findings** — issues organized by severity with colored left borders and badges
- **Evidence blocks** — bad code shown in dark monospace blocks
- **Recommendation blocks** — fix suggestions with green accent
- **Priority action items** — table of top 10 issues sorted by severity
- **Filter tabs** — filter by category (Security, Performance, Quality, Dead Code, Deps, Docs, Git Health)
- **Sort dropdown** — sort by severity, category, or file

**Tab 2 — Git Intelligence:**
- **Repository info** — current branch, total branches, total commits, contributor count
- **Contributors table** — commits, lines added/deleted, active days, first/last commit, top files per author
- **Recent commits** — SHA, author, message, file changes (+/-), date
- **File ownership/blame** — who owns what percentage of top changed files
- **Activity timeline** — weekly breakdown of commits, active authors, insertions, deletions

Git intelligence is available for GitHub repos and local repos with `.git` folder. ZIP uploads with `.git` directory are also supported.

### Live Scan Results
- **Alert banner** — critical findings prominently displayed
- **Severity breakdown** — colored stat cards with counts
- **Grouped findings** — organized by severity (Critical → Info)
- Each finding shows: severity badge, probe type, title, description, evidence, and recommendation

### Export Options
- **Export HTML** — standalone styled HTML report file (dark theme, self-contained)
- **PDF** — print-to-PDF via browser's native print dialog

---

## AI Features (BYOK — Bring Your Own Key)

All scanning works without any API key. AI features are optional — bring your own key from any supported provider:

| Provider | Cost | How to get key |
|---|---|---|
| **Groq** | Free | [console.groq.com](https://console.groq.com) > API Keys |
| **OpenAI** | Paid | [platform.openai.com](https://platform.openai.com) > API Keys |
| **Anthropic** | Paid | [console.anthropic.com](https://console.anthropic.com) > API Keys |

### Available AI Features

| Feature | What it does |
|---|---|
| **Narrative Report** | AI-generated summary of scan findings in plain English |
| **Shadow CTO** | Strategic advice — what to prioritize, tech debt assessment, architecture recommendations |
| **Senior Code Review** | Detailed feedback like a senior engineer reviewing your code |
| **Blame Therapy** | Empathetic explanations of why code ended up this way + constructive fixes |
| **Migration Planner** | Step-by-step migration plans with risk assessment and timeline |
| **Onboarding Guide** | New developer survival guide for the scanned repository |
| **Release Notes** | Changelog-style report from scan findings |
| **Code DNA** | Coding patterns, style fingerprints, consistency analysis |
| **Interview Questions** | Technical interview questions based on actual codebase technologies |
| **Postmortem** | Incident-style report treating critical issues as production incidents |
| **Codebase Chat** | Ask questions about your scan results in a conversational interface |
| **PR Summary** | Generate pull request descriptions from scan findings |

**Privacy:** API key is stored in your browser's localStorage only. It is sent directly to the AI provider — never stored or logged on our servers.

**CLI:** Set `INTROSPECT_AI_KEY` and `INTROSPECT_AI_PROVIDER` environment variables to use AI features from the command line.

---

## Custom Rules

Add your own scanning rules by creating YAML files in `.introspect/rules/` folder in your repository:

```yaml
id: no-eval-in-our-codebase
language: [javascript, typescript]
severity: high
category: security
pattern: "eval\\("
message: "eval() is banned in our codebase. It allows arbitrary code execution and is a security risk. Use JSON.parse() for data parsing or a proper expression evaluator."
fix:
  bad: "eval(userInput)"
  good: "JSON.parse(userInput)"
```

**How it works:** When you scan a repo that contains `.introspect/rules/`, the scanner automatically loads your custom rules alongside the 320 built-in rules. Custom rules use the exact same YAML format and support the same severity levels (critical, high, medium, low, info) and categories (security, performance, quality).

---

## Ignore Rules

Create `.introspectignore` in your repo root to skip specific rules or files during scanning:

```
# Skip rules by ID
rule:magic-number
rule:file-too-long
rule:deep-nesting

# Skip files/folders (supports wildcards)
path:test/
path:*.test.ts
path:*.spec.js
path:package-lock.json
path:vendor/
path:dist/
```

**How it works:** The scanner reads `.introspectignore` before running analyzers. Matching files are excluded from scanning, and matching rule IDs are skipped. This prevents false positives on test files, generated code, and vendor dependencies.

---

## Languages Supported

JavaScript, TypeScript, Python, PHP, Ruby, Go, Java, C#, Rust, Kotlin, Swift, C++, Docker, Kubernetes, CI/CD configs (GitHub Actions, Travis, CircleCI)

---

## Architecture

```
introspect/
├── apps/
│   ├── web/               Next.js 14 dashboard
│   └── cli/               CLI with 5 commands
├── packages/
│   ├── scanner/
│   │   ├── src/rules/     320 YAML detection rules
│   │   ├── src/analyzers/ 7 code analyzers
│   │   ├── src/probes/    9 live security probes
│   │   ├── src/ingestion/ GitHub, ZIP, local file readers
│   │   ├── src/scoring/   Score calculator
│   │   └── src/report/    Report generators
│   ├── ai/                3 providers + 12 AI features
│   ├── core-types/        Shared TypeScript interfaces
│   ├── ui/                Shared UI components
│   └── config/            Shared TypeScript configs
└── .github/               CI pipeline (GitHub Actions)
```

**Tech Stack:**
- Frontend: Next.js 14 (App Router), SCSS Modules, Lucide Icons
- Scanner: YAML-driven regex rules, TypeScript analyzers, Node.js probes
- AI: Native fetch — OpenAI, Anthropic, Groq (zero SDK dependencies)
- CLI: Commander.js, Chalk, Ora
- Infra: Turborepo, pnpm workspaces, GitHub Actions CI

---

## Environment Variables

| Variable | Where | Required | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | `apps/web/.env` | For GitHub code scans | GitHub personal access token (`public_repo` scope) |
| `INTROSPECT_AI_KEY` | CLI env / browser localStorage | For AI features | API key from Groq, OpenAI, or Anthropic |
| `INTROSPECT_AI_PROVIDER` | CLI env / browser UI | For AI features | `groq`, `openai`, or `anthropic` |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

Free for personal and non-commercial use. See [LICENSE](./LICENSE) for details.

