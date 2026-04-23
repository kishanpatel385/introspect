interface IgnoreConfig {
  rules: string[];
  paths: string[];
}

export function parseIgnoreFile(content: string): IgnoreConfig {
  const rules: string[] = [];
  const paths: string[] = [];

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('rule:')) {
      const ruleId = line.slice(5).trim();
      if (ruleId) rules.push(ruleId);
    } else if (line.startsWith('path:')) {
      const pattern = line.slice(5).trim();
      if (pattern) paths.push(sanitizePath(pattern));
    }
  }

  return { rules, paths };
}

export function shouldIgnoreRule(ruleId: string, ignoredRules: string[]): boolean {
  return ignoredRules.includes(ruleId);
}

export function shouldIgnoreFile(filePath: string, ignoredPaths: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/');

  return ignoredPaths.some((pattern) => {
    // Directory match: pattern ends with /
    if (pattern.endsWith('/')) {
      return normalized.startsWith(pattern) || normalized.includes(`/${pattern}`);
    }

    // Wildcard match: pattern contains *
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$',
      );
      const fileName = normalized.split('/').pop() ?? '';
      return regex.test(normalized) || regex.test(fileName);
    }

    // Exact match
    return normalized === pattern || normalized.endsWith(`/${pattern}`);
  });
}

function sanitizePath(pattern: string): string {
  // Prevent path traversal
  return pattern.replace(/\.\.\//g, '').replace(/\\/g, '/');
}
