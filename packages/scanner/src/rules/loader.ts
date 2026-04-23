import { readFile } from 'fs/promises';
import { join } from 'path';
import fg from 'fast-glob';
import yaml from 'js-yaml';
import type { Rule, RepoFile } from '@introspect/core-types';

const RULES_DIR = join(__dirname, '..', '..', 'src', 'rules');
const CUSTOM_RULES_PREFIX = '.introspect/rules/';

function isValidRule(rule: unknown): rule is Rule {
  if (!rule || typeof rule !== 'object') return false;
  const r = rule as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.category === 'string' &&
    typeof r.pattern === 'string' &&
    typeof r.message === 'string' &&
    typeof r.severity === 'string' &&
    Array.isArray(r.language)
  );
}

function filterByLanguage(rules: Rule[], languages: string[]): Rule[] {
  return rules.filter((rule) => {
    const ruleLanguages = rule.language || [];
    return ruleLanguages.length === 0 || ruleLanguages.some((lang) => languages.includes(lang));
  });
}

export async function loadRules(languages: string[]): Promise<Rule[]> {
  const ruleFiles = await fg('**/*.yaml', {
    cwd: RULES_DIR,
    absolute: true,
  });

  const rules: Rule[] = [];

  for (const filePath of ruleFiles) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const rule = yaml.load(content) as Rule;

      if (!rule?.id || !rule?.category) continue;

      const ruleLanguages = rule.language || [];
      const isApplicable =
        ruleLanguages.length === 0 || ruleLanguages.some((lang) => languages.includes(lang));

      if (isApplicable) {
        rules.push(rule);
      }
    } catch {
      // Skip malformed rule files
    }
  }

  return rules;
}

export function loadCustomRulesFromFiles(repoFiles: RepoFile[], languages: string[]): Rule[] {
  const customRules: Rule[] = [];

  for (const file of repoFiles) {
    if (!file.path.startsWith(CUSTOM_RULES_PREFIX)) continue;
    if (!file.path.endsWith('.yaml') && !file.path.endsWith('.yml')) continue;

    try {
      const parsed = yaml.load(file.content);
      if (!isValidRule(parsed)) continue;
      customRules.push(parsed);
    } catch {
      // Skip malformed custom rule files — don't crash the scan
    }
  }

  return filterByLanguage(customRules, languages);
}

export async function loadCustomRulesFromLocal(
  repoPath: string,
  languages: string[],
): Promise<Rule[]> {
  const customDir = join(repoPath, '.introspect', 'rules');
  const customRules: Rule[] = [];

  try {
    const files = await fg('*.{yaml,yml}', { cwd: customDir, absolute: true });

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const parsed = yaml.load(content);
        if (!isValidRule(parsed)) continue;
        customRules.push(parsed);
      } catch {
        // Skip malformed custom rule files
      }
    }
  } catch {
    // .introspect/rules/ doesn't exist — that's fine
  }

  return filterByLanguage(customRules, languages);
}
