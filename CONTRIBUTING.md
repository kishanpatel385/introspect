# Contributing to Introspect

Thanks for your interest! Here's how to get started.

## Setup

```bash
git clone https://github.com/introspect/introspect
cd introspect
pnpm install
pnpm build
pnpm dev
```

## Adding a New Rule

1. Create a YAML file in `packages/scanner/src/rules/<category>/`
2. Follow the format:

```yaml
id: unique-rule-id
language: [javascript, typescript]  # or [] for all languages
severity: critical | high | medium | low
category: security | performance | quality | duplication | dead_code | dependency | docs
pattern: "regex pattern here"
message: "Human-readable description of the issue"
fix:
  bad: "example of bad code"
  good: "example of fixed code"
```

3. Run `pnpm test` to verify
4. Submit a PR

## Commit Messages

```
feat: add new feature
fix: fix a bug
refactor: restructure without changing behavior
docs: documentation changes
test: add or update tests
chore: maintenance tasks
```

## Code Style

- TypeScript strict mode
- camelCase naming
- Functions under 50 lines
- Files under 800 lines
- No hardcoded values — use constants

## Questions?

Open an issue or start a discussion.
