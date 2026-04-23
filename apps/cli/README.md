# Introspect

**Your code, deeply analyzed. Your server, thoroughly probed.**

Multi-language code scanner with **432 detection rules**, git intelligence, live server security scanning, and AI-powered insights. Scans GitHub repos, local projects, and ZIP uploads for security vulnerabilities, performance issues, dead code, and leaked secrets — across 13 languages.

```bash
npx introspect scan https://github.com/owner/repo
```

---

## Installation

```bash
# Use directly (no install needed)
npx introspect scan https://github.com/owner/repo

# Or install globally
npm install -g introspect
```

---

## Commands

### `introspect scan <url|path>`

Scan a GitHub repository or local directory.

```bash
# Scan a GitHub repo
introspect scan https://github.com/expressjs/express

# Scan current directory
introspect scan .

# Scan specific folder
introspect scan /path/to/project
```

**Output includes:**
- Overall health score (0-100)
- Category scores: Security, Performance, Quality, Dead Code, Dependencies, Docs, Git Health
- Issues sorted by severity with file locations
- Before/after fix suggestions

### `introspect report --format <md|json|html>`

Export the last scan result as a report file.

```bash
# Markdown report
introspect report --format md

# JSON report
introspect report --format json -o report.json

# Standalone HTML report (styled, dark theme)
introspect report --format html -o report.html
```

### `introspect review <file>`

Scan a single file for issues. Optionally get AI-powered code review.

```bash
# Basic scan
introspect review src/app.ts

# With AI review (requires API key)
INTROSPECT_AI_KEY=your_key INTROSPECT_AI_PROVIDER=groq introspect review src/app.ts
```

### `introspect pr`

Generate a pull request description from your current git diff.

```bash
INTROSPECT_AI_KEY=your_key INTROSPECT_AI_PROVIDER=groq introspect pr
```

### `introspect chat [url|path]`

Interactive chat about your codebase with AI. Ask questions about scan findings, architecture, and code quality.

```bash
# Chat about a GitHub repo
INTROSPECT_AI_KEY=your_key INTROSPECT_AI_PROVIDER=groq introspect chat https://github.com/owner/repo

# Chat about last scanned repo
INTROSPECT_AI_KEY=your_key INTROSPECT_AI_PROVIDER=groq introspect chat
```

---

## What It Detects

### Code Scanning (432 Rules)

| Category | Rules | Examples |
|---|---|---|
| **Security** | 253 | SQL injection, XSS, CSRF, SSRF, command injection, secrets, weak crypto, deserialization, XXE |
| **Performance** | 38 | N+1 queries (10 ORMs), blocking I/O, bundle bloat, missing indexes |
| **Code Quality** | 29 | Deep nesting, long functions, magic numbers, complexity |
| **Secrets** | 112 | AWS, GCP, Stripe, GitHub, OpenAI, Anthropic, private keys, DB URLs, JWT |

### Git Intelligence (6 Checks)

- **Bus factor** — single contributor risk
- **Code hotspots** — frequently changed files
- **Velocity trend** — commit activity trends
- **Stale files** — untouched code
- **Team concentration** — workload imbalance
- **Author ownership** — who owns what

### Languages Supported

JavaScript, TypeScript, Python, PHP, Ruby, Go, Java, C#, Rust, Kotlin, Swift, C++, Docker, Kubernetes, CI/CD configs

---

## AI Features (Optional — BYOK)

All 432 rules work without any API key. For AI features, bring your own key:

```bash
export INTROSPECT_AI_KEY=your_api_key
export INTROSPECT_AI_PROVIDER=groq  # or openai, anthropic
```

| Provider | Cost | Get key at |
|---|---|---|
| **Groq** | Free | console.groq.com |
| **OpenAI** | Paid | platform.openai.com |
| **Anthropic** | Paid | console.anthropic.com |

### Available AI Features

- **Senior Code Review** — detailed feedback like a senior engineer
- **Shadow CTO** — strategic advice and architecture recommendations
- **Blame Therapy** — empathetic explanations + constructive fixes
- **Migration Planner** — step-by-step migration plans
- **Onboarding Guide** — new developer guide for the repo
- **Release Notes** — changelog from scan findings
- **Code DNA** — coding patterns and style analysis
- **Interview Questions** — tech questions based on the codebase
- **Postmortem** — incident-style report for critical issues
- **Codebase Chat** — ask questions about your code
- **PR Summary** — generate PR descriptions
- **Narrative Report** — AI summary of scan findings

---

## Custom Rules

Create `.introspect/rules/` in your project with YAML rule files:

```yaml
id: no-console-log
language: [javascript, typescript]
severity: medium
category: quality
pattern: "console\\.log\\("
message: "Remove console.log before committing. Use a proper logger instead."
fix:
  bad: "console.log(data)"
  good: "logger.info(data)"
```

## Ignore Rules

Create `.introspectignore` in your project root:

```
# Skip specific rules
rule:magic-number
rule:file-too-long

# Skip files/folders
path:test/
path:*.test.ts
path:vendor/
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | For GitHub scans | Personal access token (public_repo scope) |
| `INTROSPECT_AI_KEY` | For AI features | API key from Groq/OpenAI/Anthropic |
| `INTROSPECT_AI_PROVIDER` | For AI features | `groq`, `openai`, or `anthropic` |

---

## Web Dashboard

Introspect also has a web dashboard with radar charts, live scan progress, server security probing, and interactive results. See the [full project on GitHub](https://github.com/kishanpatel385/introspect).

---

## License

Free for personal and non-commercial use. See [LICENSE](./LICENSE) for details.

## Author

[Kishan Patel](https://kishanpatel385.github.io/)
