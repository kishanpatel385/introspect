import { v4 as uuid } from 'uuid';
import type { RepoFile, Rule, Issue } from '@introspect/core-types';

export function runRegexRules(files: RepoFile[], rules: Rule[]): Issue[] {
  const issues: Issue[] = [];

  for (const file of files) {
    const applicableRules = rules.filter((rule) => {
      if (rule.language.length === 0) return true;
      return file.language != null && rule.language.includes(file.language);
    });

    for (const rule of applicableRules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        const lines = file.content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i] ?? '')) {
            issues.push({
              id: uuid(),
              ruleId: rule.id,
              type: rule.category,
              severity: rule.severity,
              title: rule.message,
              description: rule.message,
              file: file.path,
              line: i + 1,
              badCode: rule.fix?.bad,
              goodCode: rule.fix?.good,
              language: file.language,
            });
          }
          regex.lastIndex = 0;
        }
      } catch {
        // Skip rules with invalid regex
      }
    }
  }

  return issues;
}
