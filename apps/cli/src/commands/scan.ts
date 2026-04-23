import { Command } from 'commander';
import chalk from 'chalk';
import type { ScanRequest, Issue, Severity } from '@introspect/core-types';
import { saveLastScan } from '../utils/lastScan.js';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const MAX_ISSUES_DISPLAYED = 20;

export const scanCommand = new Command('scan')
  .description('Scan a repository for issues')
  .argument('[target]', 'GitHub URL or local path (defaults to current directory)', '.')
  .option('-m, --mode <mode>', 'Scan mode: quick, deep', 'deep')
  .action(async (target: string, options: { mode: string }) => {
    const { default: ora } = await import('ora');

    const spinner = ora('Scanning...').start();

    try {
      const { scan } = await import('@introspect/scanner');

      const isUrl = target.startsWith('http');
      const source = isUrl
        ? { type: 'github' as const, url: target }
        : { type: 'local' as const, path: target };

      const request: ScanRequest = {
        source,
        mode: (options.mode === 'quick' ? 'quick' : 'deep') as ScanRequest['mode'],
      };

      spinner.text = 'Ingesting files...';
      const result = await scan(request);

      spinner.succeed(
        `Scan complete in ${result.scanDurationMs}ms`,
      );

      // Save for later report usage
      await saveLastScan(result);

      // Overall score with color
      const scoreColor =
        result.overallScore > 80 ? chalk.green
          : result.overallScore > 60 ? chalk.yellow
            : chalk.red;

      process.stdout.write('\n');
      process.stdout.write(scoreColor.bold(`  Overall Score: ${result.overallScore}/100\n`));
      process.stdout.write(`  ${result.summary}\n`);
      process.stdout.write('\n');
      process.stdout.write(`  Files: ${result.totalFiles} | Lines: ${result.totalLines.toLocaleString()} | Languages: ${result.languages.join(', ')}\n`);
      process.stdout.write('\n');

      // Category scores table
      process.stdout.write(chalk.bold('  Category Scores\n'));
      process.stdout.write(`  ${'Category'.padEnd(16)} ${'Score'.padStart(5)}  Bar\n`);
      process.stdout.write(`  ${'─'.repeat(16)} ${'─'.repeat(5)}  ${'─'.repeat(20)}\n`);

      for (const [key, value] of Object.entries(result.scores)) {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
        const bar = '█'.repeat(Math.round(value / 5));
        const color = value >= 80 ? chalk.green : value >= 60 ? chalk.yellow : chalk.red;
        process.stdout.write(`  ${label.padEnd(16)} ${String(value).padStart(5)}  ${color(bar)}\n`);
      }

      // Issues grouped by severity (top 20)
      if (result.issues.length > 0) {
        process.stdout.write('\n');
        process.stdout.write(chalk.bold(`  Issues (${result.issues.length} total, showing top ${Math.min(result.issues.length, MAX_ISSUES_DISPLAYED)})\n`));
        process.stdout.write('\n');

        const sorted = [...result.issues].sort(
          (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
        );
        const top = sorted.slice(0, MAX_ISSUES_DISPLAYED);
        const grouped = groupBySeverity(top);

        for (const severity of SEVERITY_ORDER) {
          const issues = grouped[severity];
          if (!issues?.length) continue;

          const badge = severityBadge(severity);
          process.stdout.write(`  ${badge} (${issues.length})\n`);

          for (const issue of issues) {
            const location = issue.file
              ? chalk.dim(` ${issue.file}${issue.line ? `:${issue.line}` : ''}`)
              : '';
            process.stdout.write(`    ${issue.title}${location}\n`);
          }
          process.stdout.write('\n');
        }
      }
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Scan failed');
      process.exit(1);
    }
  });

function severityBadge(severity: Severity): string {
  const label = severity.toUpperCase();
  switch (severity) {
    case 'critical': return chalk.bgRed.white.bold(` ${label} `);
    case 'high': return chalk.bgHex('#f0883e').white.bold(` ${label} `);
    case 'medium': return chalk.bgYellow.black.bold(` ${label} `);
    case 'low': return chalk.bgBlue.white(` ${label} `);
    case 'info': return chalk.bgGray.white(` ${label} `);
  }
}

function groupBySeverity(issues: Issue[]): Partial<Record<Severity, Issue[]>> {
  const result: Partial<Record<Severity, Issue[]>> = {};
  for (const issue of issues) {
    (result[issue.severity] ??= []).push(issue);
  }
  return result;
}
