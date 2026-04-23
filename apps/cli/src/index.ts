import { Command } from 'commander';
import { scanCommand } from './commands/scan.js';
import { reportCommand } from './commands/report.js';
import { reviewCommand } from './commands/review.js';
import { prCommand } from './commands/pr.js';
import { chatCommand } from './commands/chat.js';

const program = new Command();

program
  .name('introspect')
  .description('Your code, deeply analyzed. Multi-language AI-native code scanner.')
  .version('0.1.0');

program.addCommand(scanCommand);
program.addCommand(reportCommand);
program.addCommand(reviewCommand);
program.addCommand(prCommand);
program.addCommand(chatCommand);

program.parse();
