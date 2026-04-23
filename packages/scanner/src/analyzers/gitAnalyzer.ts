import { v4 as uuid } from 'uuid';
import type { Issue } from '@introspect/core-types';
import type { GitHistoryData } from '../ingestion/gitHistory';

export function runGitAnalyzer(gitData: GitHistoryData): Issue[] {
  const issues: Issue[] = [];

  issues.push(...checkBusFactor(gitData));
  issues.push(...checkCodeHotspots(gitData));
  issues.push(...checkStaleFiles(gitData));
  issues.push(...checkVelocityTrend(gitData));
  issues.push(...checkTeamConcentration(gitData));
  issues.push(...checkAuthorOwnership(gitData));

  return issues;
}

/**
 * Bus Factor — files owned by 1 person = knowledge bottleneck.
 * If that person leaves, nobody understands the code.
 */
function checkBusFactor(gitData: GitHistoryData): Issue[] {
  const issues: Issue[] = [];
  let singleAuthorCount = 0;

  for (const [file, authors] of gitData.fileAuthors) {
    if (authors.size === 1) singleAuthorCount++;
  }

  const totalTracked = gitData.fileAuthors.size;
  if (totalTracked === 0) return [];

  const singleAuthorRatio = singleAuthorCount / totalTracked;

  // Overall repo-level bus factor warning
  if (gitData.totalContributors <= 1) {
    issues.push({
      id: uuid(),
      ruleId: 'bus-factor-solo',
      type: 'git',
      severity: 'critical',
      title: 'Entire repository has a single contributor',
      description: `This repo has only ${gitData.totalContributors} contributor. If they become unavailable, there is zero backup knowledge. This is the highest bus factor risk possible. Actively recruit co-maintainers and document architectural decisions to reduce single-point-of-failure risk.`,
    });
  } else if (gitData.totalContributors === 2) {
    issues.push({
      id: uuid(),
      ruleId: 'bus-factor-low',
      type: 'git',
      severity: 'high',
      title: 'Repository has only 2 contributors',
      description: `Only 2 people have contributed to this repo. Knowledge is concentrated in very few hands. If one contributor leaves, the other carries the full burden. Spread ownership by pairing on critical modules and encouraging contributions across the team.`,
    });
  }

  // File-level: flag if >60% of files have single author
  if (singleAuthorRatio > 0.6 && totalTracked > 5) {
    issues.push({
      id: uuid(),
      ruleId: 'bus-factor-files',
      type: 'git',
      severity: 'high',
      title: `${Math.round(singleAuthorRatio * 100)}% of files have a single author`,
      description: `${singleAuthorCount} out of ${totalTracked} tracked files were only ever modified by one person. This creates severe knowledge silos — if any author becomes unavailable, their files become orphaned. Rotate code ownership through pair programming and cross-team reviews.`,
    });
  }

  return issues;
}

/**
 * Code Hotspots — files changed very frequently are bug magnets.
 * High churn + few authors = high risk.
 */
function checkCodeHotspots(gitData: GitHistoryData): Issue[] {
  const issues: Issue[] = [];

  // Sort by change count, take top offenders
  const sorted = [...gitData.fileChangeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [file, changeCount] of sorted) {
    if (changeCount < 5) continue;

    const authors = gitData.fileAuthors.get(file);
    const authorCount = authors?.size ?? 0;

    // High churn + low ownership = danger
    if (changeCount >= 10 && authorCount <= 2) {
      issues.push({
        id: uuid(),
        ruleId: 'hotspot-critical',
        type: 'git',
        severity: 'high',
        title: `Code hotspot: ${file} (${changeCount} changes, ${authorCount} authors)`,
        description: `This file has been modified ${changeCount} times but only by ${authorCount} author(s). Frequently changed files with concentrated ownership are the #1 source of production bugs. Consider refactoring to reduce change frequency, or spread ownership through code reviews and pair programming.`,
        file,
      });
    } else if (changeCount >= 8) {
      issues.push({
        id: uuid(),
        ruleId: 'hotspot-moderate',
        type: 'git',
        severity: 'medium',
        title: `Frequently changed file: ${file} (${changeCount} changes)`,
        description: `This file has been changed ${changeCount} times in recent history. Files with high churn often contain complex logic that's hard to get right. Consider breaking it into smaller, more stable modules to reduce change frequency and bug risk.`,
        file,
      });
    }
  }

  return issues;
}

/**
 * Stale Files — not touched in 6+ months.
 * Could be dead code, or under-maintained critical code.
 */
function checkStaleFiles(gitData: GitHistoryData): Issue[] {
  const issues: Issue[] = [];
  const now = Date.now();
  const sixMonths = 180 * 24 * 60 * 60 * 1000;
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  let staleCount = 0;

  for (const [file, lastDate] of gitData.fileLastTouch) {
    const age = now - lastDate.getTime();
    if (age > oneYear) staleCount++;
  }

  // Only flag at repo level if significant portion is stale
  const totalTracked = gitData.fileLastTouch.size;
  if (totalTracked > 5 && staleCount > 0) {
    const staleRatio = staleCount / totalTracked;

    if (staleRatio > 0.5) {
      issues.push({
        id: uuid(),
        ruleId: 'stale-codebase',
        type: 'git',
        severity: 'high',
        title: `${Math.round(staleRatio * 100)}% of files untouched for 1+ year`,
        description: `${staleCount} out of ${totalTracked} tracked files have not been modified in over a year. A large portion of stale code indicates the project may be undermaintained, or contains significant dead code. Audit stale files — archive what's unused, update what's still needed, and delete what's dead.`,
      });
    } else if (staleRatio > 0.25) {
      issues.push({
        id: uuid(),
        ruleId: 'stale-partial',
        type: 'git',
        severity: 'medium',
        title: `${staleCount} files untouched for 1+ year`,
        description: `${staleCount} files have not been modified in over a year. Stale code may contain outdated patterns, unpatched vulnerabilities, or deprecated API usage. Review these files to determine if they are still needed or should be removed.`,
      });
    }
  }

  return issues;
}

/**
 * Velocity Trend — is the project accelerating, stable, or declining?
 * Declining velocity can signal maintainer burnout or abandoned project.
 */
function checkVelocityTrend(gitData: GitHistoryData): Issue[] {
  const issues: Issue[] = [];
  const weeks = gitData.weeklyCommitCounts;

  if (weeks.length < 6) return [];

  // Compare recent 4 weeks vs older 4 weeks
  const recent = weeks.slice(0, 4).reduce((a, b) => a + b, 0);
  const older = weeks.slice(4, 8).reduce((a, b) => a + b, 0);

  // No activity at all in recent 4 weeks
  if (recent === 0 && older > 0) {
    issues.push({
      id: uuid(),
      ruleId: 'velocity-stalled',
      type: 'git',
      severity: 'high',
      title: 'No commits in the last 4 weeks',
      description: `This repository had ${older} commits in weeks 5-8 but zero in the last 4 weeks. Development appears to have stalled. This could indicate maintainer burnout, project abandonment, or a planned pause. If the project is active, investigate blockers and re-establish a regular commit cadence.`,
    });
  } else if (older > 0 && recent < older * 0.3) {
    const dropPercent = Math.round((1 - recent / older) * 100);
    issues.push({
      id: uuid(),
      ruleId: 'velocity-declining',
      type: 'git',
      severity: 'medium',
      title: `Commit velocity dropped ${dropPercent}% in recent weeks`,
      description: `Recent activity (${recent} commits in last 4 weeks) is significantly lower than the prior period (${older} commits in weeks 5-8). A steep decline in velocity often precedes project stagnation. Review team capacity, unblock pending PRs, and address any contributor friction.`,
    });
  }

  // Average commits per week
  const avgPerWeek = gitData.commits.length / Math.max(1, gitData.repoAgeWeeks);
  if (avgPerWeek < 0.5 && gitData.repoAgeWeeks > 8) {
    issues.push({
      id: uuid(),
      ruleId: 'velocity-low',
      type: 'git',
      severity: 'low',
      title: `Low commit frequency: ${avgPerWeek.toFixed(1)} commits/week average`,
      description: `Over ${gitData.repoAgeWeeks} weeks, this repo averages less than 1 commit per week. Low velocity isn't always bad (stable projects need fewer changes), but for actively developed software it may indicate slow iteration speed or blocked contributors.`,
    });
  }

  return issues;
}

/**
 * Team Concentration — is one author doing all the work?
 * Unbalanced teams = burnout risk + knowledge silos.
 */
function checkTeamConcentration(gitData: GitHistoryData): Issue[] {
  const issues: Issue[] = [];
  const totalCommits = gitData.commits.length;

  if (totalCommits < 10 || gitData.authorCommitCount.size < 2) return [];

  // Find top contributor
  let topAuthor = '';
  let topCount = 0;
  for (const [author, count] of gitData.authorCommitCount) {
    if (count > topCount) {
      topAuthor = author;
      topCount = count;
    }
  }

  const topRatio = topCount / totalCommits;

  if (topRatio > 0.9) {
    issues.push({
      id: uuid(),
      ruleId: 'team-monopoly',
      type: 'git',
      severity: 'high',
      title: `${Math.round(topRatio * 100)}% of commits from a single author`,
      description: `"${topAuthor}" has made ${topCount} out of ${totalCommits} recent commits (${Math.round(topRatio * 100)}%). When one person does almost all the work, the project is fragile — their absence would halt development. Distribute work more evenly and establish shared code ownership through pairing and reviews.`,
    });
  } else if (topRatio > 0.7) {
    issues.push({
      id: uuid(),
      ruleId: 'team-imbalanced',
      type: 'git',
      severity: 'medium',
      title: `Team imbalance: top contributor has ${Math.round(topRatio * 100)}% of commits`,
      description: `"${topAuthor}" accounts for ${topCount} of ${totalCommits} recent commits. While some concentration is normal (tech leads, project owners), this level of imbalance creates burnout risk and knowledge silos. Encourage other team members to take ownership of modules.`,
    });
  }

  return issues;
}

/**
 * Author Ownership Maps — who owns what, and are there orphaned files?
 * Flags concentrated ownership and files with no clear owner.
 */
function checkAuthorOwnership(gitData: GitHistoryData): Issue[] {
  const issues: Issue[] = [];
  const totalTracked = gitData.fileAuthors.size;

  if (totalTracked === 0) return [];

  // Build ownership map: for each file, find the author with >50% of commits
  const authorOwnedCount = new Map<string, number>();
  let orphanedFiles = 0;

  for (const [file, authors] of gitData.fileAuthors) {
    const fileCommits = gitData.fileChangeCount.get(file) ?? 0;
    if (fileCommits === 0) continue;

    // Count per-author commits for this file from the commit log
    const authorCommitsForFile = new Map<string, number>();
    for (const commit of gitData.commits) {
      if (commit.files.includes(file)) {
        authorCommitsForFile.set(commit.author, (authorCommitsForFile.get(commit.author) ?? 0) + 1);
      }
    }

    let dominantAuthor = '';
    let dominantCount = 0;
    for (const [author, count] of authorCommitsForFile) {
      if (count > dominantCount) {
        dominantCount = count;
        dominantAuthor = author;
      }
    }

    // Owner = author with >50% of commits to this file
    if (dominantAuthor && dominantCount / fileCommits > 0.5) {
      authorOwnedCount.set(dominantAuthor, (authorOwnedCount.get(dominantAuthor) ?? 0) + 1);
    } else if (authors.size > 1) {
      orphanedFiles++;
    }
  }

  // Flag files with no clear owner
  if (orphanedFiles > 3 && orphanedFiles / totalTracked > 0.3) {
    issues.push({
      id: uuid(),
      ruleId: 'ownership-orphaned',
      type: 'git',
      severity: 'medium',
      title: `${orphanedFiles} files have no clear owner`,
      description: `${orphanedFiles} out of ${totalTracked} tracked files have no single author responsible for more than 50% of changes. Shared ownership can be healthy, but when no one feels responsible, code quality drifts. Assign explicit code owners via CODEOWNERS file or team agreements.`,
    });
  }

  // Flag concentrated ownership — one author owns too many files
  for (const [author, ownedCount] of authorOwnedCount) {
    const ownershipRatio = ownedCount / totalTracked;
    if (ownershipRatio > 0.8 && totalTracked > 5) {
      issues.push({
        id: uuid(),
        ruleId: 'ownership-concentrated',
        type: 'git',
        severity: 'high',
        title: `"${author}" owns ${Math.round(ownershipRatio * 100)}% of all files`,
        description: `"${author}" is the dominant author on ${ownedCount} out of ${totalTracked} tracked files. This extreme concentration means the project is fragile — if this person becomes unavailable, most files have no backup owner. Actively distribute ownership through pairing and mentorship.`,
      });
    } else if (ownershipRatio > 0.6 && totalTracked > 5) {
      issues.push({
        id: uuid(),
        ruleId: 'ownership-heavy',
        type: 'git',
        severity: 'medium',
        title: `"${author}" owns ${Math.round(ownershipRatio * 100)}% of files`,
        description: `"${author}" is the dominant author on ${ownedCount} out of ${totalTracked} tracked files. While some concentration is expected for project leads, this level creates a knowledge bottleneck. Encourage other contributors to take ownership of specific directories.`,
      });
    }
  }

  return issues;
}
