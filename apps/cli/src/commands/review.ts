import { Command } from 'commander';
import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { resolve, basename, extname, dirname } from 'path';
import type { Severity, AiProviderName, RepoFile } from '@introspect/core-types';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export const reviewCommand = new Command('review')
  .description('Scan a file and optionally run AI code review')
  .argument('<file>', 'Path to a local file to review')
  .action(async (file: string) => {
    const { default: ora } = await import('ora');
    const filePath = resolve(file);

    let fileContent: string;
    try {
      fileContent = await readFile(filePath, 'utf-8');
    } catch {
      process.stderr.write(chalk.red(`Cannot read file: ${filePath}\n`));
      process.exit(1);
    }

    const spinner = ora('Scanning file...').start();

    try {
      const { loadRules } = await import('@introspect/scanner');
      const { runAnalyzers } = await import('@introspect/scanner');

      const repoFile: RepoFile = {
        path: basename(filePath),
        content: fileContent,
        size: fileContent.length,
      };

      // Detect language from extension
      const ext = extname(filePath).toLowerCase();
      const langMap: Record<string, string> = {
        '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
        '.py': 'python', '.php': 'php', '.rb': 'ruby', '.go': 'go',
        '.java': 'java', '.cs': 'csharp', '.rs': 'rust', '.kt': 'kotlin', '.swift': 'swift',
      };
      const lang = langMap[ext];
      if (lang) repoFile.language = lang;

      const languages = lang ? [lang] : [];
      const rules = await loadRules(languages);
      const issues = await runAnalyzers([repoFile], rules);

      spinner.succeed(`Scan complete — ${issues.length} issue(s) found`);

      if (issues.length > 0) {
        process.stdout.write('\n');
        const sorted = [...issues].sort(
          (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
        );

        for (const issue of sorted) {
          const badge = severityColor(issue.severity, issue.severity.toUpperCase());
          const location = issue.line ? chalk.dim(`:${issue.line}`) : '';
          process.stdout.write(`  ${badge} ${issue.title}${location}\n`);
          process.stdout.write(`    ${chalk.dim(issue.description)}\n`);
        }
      }

      // AI review if env vars are set
      const aiKey = process.env.INTROSPECT_AI_KEY;
      const aiProvider = process.env.INTROSPECT_AI_PROVIDER as AiProviderName | undefined;

      if (aiKey && aiProvider) {
        process.stdout.write('\n');
        const aiSpinner = ora('Running AI code review...').start();

        try {
          const { createProvider, generateCodeReview } = await import('@introspect/ai');
          const provider = createProvider({ name: aiProvider, apiKey: aiKey });
          const review = await generateCodeReview(provider, fileContent, basename(filePath), issues);

          aiSpinner.succeed('AI Review');
          process.stdout.write('\n');
          process.stdout.write(review);
          process.stdout.write('\n');
        } catch (error) {
          aiSpinner.fail(error instanceof Error ? error.message : 'AI review failed');
        }
      } else {
        process.stdout.write(
          chalk.dim('\n  Tip: Set INTROSPECT_AI_KEY and INTROSPECT_AI_PROVIDER for AI-powered review.\n'),
        );
      }
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Review failed');
      process.exit(1);
    }
  });

function severityColor(severity: Severity, text: string): string {
  switch (severity) {
    case 'critical': return chalk.red.bold(text);
    case 'high': return chalk.hex('#f0883e').bold(text);
    case 'medium': return chalk.yellow.bold(text);
    case 'low': return chalk.blue(text);
    case 'info': return chalk.gray(text);
  }
}
