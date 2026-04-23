import { Command } from 'commander';
import chalk from 'chalk';
import { loadLastScan } from '../utils/lastScan.js';

export const reportCommand = new Command('report')
  .description('Export last scan result as a report')
  .option('-f, --format <format>', 'Report format: md, json, html', 'md')
  .option('-o, --output <file>', 'Save report to file (prints to stdout if omitted)')
  .action(async (options: { format: string; output?: string }) => {
    const formatMap: Record<string, 'markdown' | 'json' | 'html'> = {
      md: 'markdown',
      markdown: 'markdown',
      json: 'json',
      html: 'html',
    };

    const resolvedFormat = formatMap[options.format];
    if (!resolvedFormat) {
      process.stderr.write(chalk.red(`Unknown format "${options.format}". Use md, json, or html.\n`));
      process.exit(1);
    }

    try {
      const result = await loadLastScan();
      const { generateReport } = await import('@introspect/scanner');
      const report = generateReport(result, resolvedFormat);

      if (options.output) {
        const { writeFile } = await import('fs/promises');
        await writeFile(options.output, report, 'utf-8');
        process.stdout.write(chalk.green(`Report saved to ${options.output}\n`));
      } else {
        process.stdout.write(report);
        process.stdout.write('\n');
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        process.stderr.write(chalk.red('No previous scan found. Run "introspect scan" first.\n'));
      } else {
        process.stderr.write(chalk.red(error instanceof Error ? error.message : 'Failed to generate report') + '\n');
      }
      process.exit(1);
    }
  });
