import { Command } from 'commander';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { resolve } from 'path';
import type { ScanRequest, AiProviderName } from '@introspect/core-types';

export const chatCommand = new Command('chat')
  .description('Chat with AI about a scanned repository (REPL mode)')
  .argument('[url-or-path]', 'GitHub URL or local path to scan first')
  .action(async (target?: string) => {
    const { default: ora } = await import('ora');
    const { scan } = await import('@introspect/scanner');
    const { createProvider, generateChatResponse } = await import('@introspect/ai');

    const aiKey = process.env.INTROSPECT_AI_KEY;
    const aiProvider = (process.env.INTROSPECT_AI_PROVIDER ?? 'groq') as AiProviderName;

    if (!aiKey) {
      process.stderr.write(chalk.red('AI key required for chat mode.\n'));
      process.stderr.write(chalk.dim('Set INTROSPECT_AI_KEY and INTROSPECT_AI_PROVIDER env vars.\n'));
      process.exit(1);
    }

    let scanResult: Awaited<ReturnType<typeof scan>> | null = null;

    // Load last scan or scan now
    if (target) {
      const spinner = ora('Scanning...').start();
      try {
        const isUrl = target.startsWith('http');
        const request: ScanRequest = isUrl
          ? { source: { type: 'github', url: target, token: process.env.GITHUB_TOKEN }, mode: 'quick' }
          : { source: { type: 'local', path: resolve(target) }, mode: 'quick' };

        scanResult = await scan(request);
        spinner.succeed(`Scanned ${scanResult.repoName} — ${scanResult.totalFiles} files, score ${scanResult.overallScore}/100`);
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Scan failed');
        process.exit(1);
      }
    } else {
      // Try loading last scan
      try {
        const { loadLastScan } = await import('../utils/lastScan.js');
        scanResult = await loadLastScan();
      } catch {
        // No previous scan available
      }
      if (!scanResult) {
        process.stderr.write(chalk.red('No previous scan found. Provide a URL or path:\n'));
        process.stderr.write(chalk.dim('  introspect chat https://github.com/owner/repo\n'));
        process.exit(1);
      }
      process.stdout.write(chalk.dim(`Using last scan: ${scanResult.repoName}\n`));
    }

    const provider = createProvider({ name: aiProvider, apiKey: aiKey });

    process.stdout.write('\n');
    process.stdout.write(chalk.bold(`Chat with ${scanResult.repoName}`) + '\n');
    process.stdout.write(chalk.dim('Type your questions. "exit" to quit.\n\n'));

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const history: { role: 'user' | 'assistant'; content: string }[] = [];

    const prompt = () => {
      rl.question(chalk.hex('#e8734a')('you > '), async (input) => {
        const msg = input.trim();
        if (!msg || msg === 'exit' || msg === 'quit') {
          process.stdout.write(chalk.dim('Bye!\n'));
          rl.close();
          return;
        }

        history.push({ role: 'user', content: msg });

        try {
          const response = await generateChatResponse(provider, scanResult!, msg, history);
          process.stdout.write(chalk.white(`\n${response}\n\n`));
          history.push({ role: 'assistant', content: response });
        } catch (err) {
          process.stderr.write(chalk.red('AI error: ') + (err instanceof Error ? err.message : 'Unknown error') + '\n');
        }

        prompt();
      });
    };

    prompt();
  });
