import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import type { AiProviderName, ScanRequest } from '@introspect/core-types';

export const prCommand = new Command('pr')
  .description('Generate a PR description from current git changes')
  .action(async () => {
    const { default: ora } = await import('ora');

    const aiKey = process.env.INTROSPECT_AI_KEY;
    const aiProvider = process.env.INTROSPECT_AI_PROVIDER as AiProviderName | undefined;

    if (!aiKey || !aiProvider) {
      process.stderr.write(
        chalk.red('INTROSPECT_AI_KEY and INTROSPECT_AI_PROVIDER env vars are required.\n'),
      );
      process.exit(1);
    }

    let diff: string;
    try {
      diff = execSync('git diff HEAD', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    } catch {
      process.stderr.write(chalk.red('Failed to get git diff. Make sure you are in a git repository.\n'));
      process.exit(1);
    }

    if (!diff.trim()) {
      try {
        diff = execSync('git diff --cached', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      } catch {
        // ignore, diff stays empty
      }
    }

    if (!diff.trim()) {
      process.stderr.write(chalk.yellow('No changes detected. Stage or commit changes first.\n'));
      process.exit(0);
    }

    const spinner = ora('Scanning changes...').start();

    try {
      const { scan } = await import('@introspect/scanner');

      const request: ScanRequest = {
        source: { type: 'local', path: '.' },
        mode: 'quick',
      };

      const result = await scan(request);
      spinner.text = 'Generating PR description...';

      const { createProvider, generatePrSummary } = await import('@introspect/ai');
      const provider = createProvider({ name: aiProvider, apiKey: aiKey });
      const prDescription = await generatePrSummary(provider, result);

      spinner.succeed('PR description generated');
      process.stdout.write('\n');
      process.stdout.write(prDescription);
      process.stdout.write('\n');
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'PR generation failed');
      process.exit(1);
    }
  });
