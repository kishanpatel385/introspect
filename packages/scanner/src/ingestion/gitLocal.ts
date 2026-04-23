import { simpleGit } from 'simple-git';
import type { GitHistoryData, GitCommit } from './gitHistory';

export interface GitDetailedData extends GitHistoryData {
  branches: string[];
  currentBranch: string;
  totalCommits: number;
  authorStats: AuthorStat[];
  recentCommits: DetailedCommit[];
  fileBlame: Map<string, BlameEntry[]>;
  commitTimeline: TimelineEntry[];
}

export interface AuthorStat {
  name: string;
  email: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  firstCommit: string;
  lastCommit: string;
  activeDays: number;
  topFiles: string[];
}

export interface DetailedCommit {
  sha: string;
  shortSha: string;
  author: string;
  email: string;
  date: string;
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: CommitFile[];
}

export interface CommitFile {
  path: string;
  insertions: number;
  deletions: number;
  binary: boolean;
}

export interface BlameEntry {
  author: string;
  lines: number;
  percentage: number;
}

export interface TimelineEntry {
  week: string;
  commits: number;
  authors: number;
  insertions: number;
  deletions: number;
}

export async function fetchLocalGitHistory(repoPath: string): Promise<GitDetailedData | null> {
  try {
    const git = simpleGit(repoPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return null;

    // Branches
    const branchResult = await git.branch();
    const branches = branchResult.all;
    const currentBranch = branchResult.current;

    // Recent commits with stats (last 100)
    const log = await git.log({
      maxCount: 100,
      '--stat': null,
      '--format': '%H|%h|%an|%ae|%aI|%s',
    } as Record<string, unknown>);

    const recentCommits: DetailedCommit[] = [];
    const commits: GitCommit[] = [];
    const authorStatsMap = new Map<string, {
      email: string; commits: number; linesAdded: number; linesDeleted: number;
      firstCommit: string; lastCommit: string; days: Set<string>; files: Map<string, number>;
    }>();
    const fileAuthors = new Map<string, Set<string>>();
    const fileLastTouch = new Map<string, Date>();
    const fileChangeCount = new Map<string, number>();
    const authorCommitCount = new Map<string, number>();
    const authorFiles = new Map<string, Set<string>>();
    const weeklyData = new Map<string, { commits: number; authors: Set<string>; ins: number; del: number }>();

    for (const entry of log.all) {
      const sha = entry.hash;
      const author = entry.author_name;
      const email = entry.author_email;
      const date = entry.date;
      const message = entry.message;
      const entryAny = entry as unknown as Record<string, { insertions?: number; deletions?: number; files?: Record<string, unknown>[] }>;
      const insertions = entryAny.diff?.insertions ?? 0;
      const deletions = entryAny.diff?.deletions ?? 0;
      const changedFiles = entryAny.diff?.files ?? [];

      const commitFiles: CommitFile[] = Array.isArray(changedFiles)
        ? changedFiles.map((f: Record<string, unknown>) => ({
            path: String(f.file ?? ''),
            insertions: Number(f.insertions ?? 0),
            deletions: Number(f.deletions ?? 0),
            binary: Boolean(f.binary),
          }))
        : [];

      const filePaths = commitFiles.map((f) => f.path);

      recentCommits.push({
        sha,
        shortSha: sha.slice(0, 7),
        author,
        email,
        date,
        message,
        filesChanged: commitFiles.length,
        insertions: Number(insertions),
        deletions: Number(deletions),
        files: commitFiles,
      });

      commits.push({ sha, author, date, message, files: filePaths });

      // Author stats
      if (!authorStatsMap.has(author)) {
        authorStatsMap.set(author, {
          email, commits: 0, linesAdded: 0, linesDeleted: 0,
          firstCommit: date, lastCommit: date,
          days: new Set(), files: new Map(),
        });
      }
      const stat = authorStatsMap.get(author)!;
      stat.commits++;
      stat.linesAdded += Number(insertions);
      stat.linesDeleted += Number(deletions);
      stat.lastCommit = date;
      stat.days.add(date.split('T')[0] ?? '');
      for (const fp of filePaths) {
        stat.files.set(fp, (stat.files.get(fp) ?? 0) + 1);
      }

      // File maps
      authorCommitCount.set(author, (authorCommitCount.get(author) ?? 0) + 1);
      if (!authorFiles.has(author)) authorFiles.set(author, new Set());
      for (const fp of filePaths) {
        if (!fileAuthors.has(fp)) fileAuthors.set(fp, new Set());
        fileAuthors.get(fp)!.add(author);
        const commitDate = new Date(date);
        const existing = fileLastTouch.get(fp);
        if (!existing || commitDate > existing) fileLastTouch.set(fp, commitDate);
        fileChangeCount.set(fp, (fileChangeCount.get(fp) ?? 0) + 1);
        authorFiles.get(author)!.add(fp);
      }

      // Weekly timeline
      const weekStart = getWeekStart(new Date(date));
      if (!weeklyData.has(weekStart)) {
        weeklyData.set(weekStart, { commits: 0, authors: new Set(), ins: 0, del: 0 });
      }
      const week = weeklyData.get(weekStart)!;
      week.commits++;
      week.authors.add(author);
      week.ins += Number(insertions);
      week.del += Number(deletions);
    }

    // Build author stats
    const authorStats: AuthorStat[] = [...authorStatsMap.entries()]
      .map(([name, s]) => ({
        name,
        email: s.email,
        commits: s.commits,
        linesAdded: s.linesAdded,
        linesDeleted: s.linesDeleted,
        firstCommit: s.firstCommit,
        lastCommit: s.lastCommit,
        activeDays: s.days.size,
        topFiles: [...s.files.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([f]) => f),
      }))
      .sort((a, b) => b.commits - a.commits);

    // Build timeline
    const commitTimeline: TimelineEntry[] = [...weeklyData.entries()]
      .map(([week, d]) => ({
        week,
        commits: d.commits,
        authors: d.authors.size,
        insertions: d.ins,
        deletions: d.del,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Weekly commit counts for velocity
    const now = Date.now();
    const weeklyCommitCounts = new Array(12).fill(0) as number[];
    for (const commit of commits) {
      const weeksAgo = Math.floor((now - new Date(commit.date).getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksAgo >= 0 && weeksAgo < 12) weeklyCommitCounts[weeksAgo]!++;
    }

    const oldestCommit = commits.length > 0 ? new Date(commits[commits.length - 1]!.date) : new Date();
    const repoAgeWeeks = Math.max(1, Math.floor((now - oldestCommit.getTime()) / (7 * 24 * 60 * 60 * 1000)));

    // Blame for top 10 most changed files
    const fileBlame = new Map<string, BlameEntry[]>();
    const topChangedFiles = [...fileChangeCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [filePath] of topChangedFiles) {
      const authors = fileAuthors.get(filePath);
      if (!authors) continue;
      const totalAuthors = [...authors];
      const blameEntries: BlameEntry[] = totalAuthors.map((a) => {
        const authorFileCount = authorStatsMap.get(a)?.files.get(filePath) ?? 0;
        const totalChanges = fileChangeCount.get(filePath) ?? 1;
        return {
          author: a,
          lines: authorFileCount,
          percentage: Math.round((authorFileCount / totalChanges) * 100),
        };
      }).sort((a, b) => b.percentage - a.percentage);
      fileBlame.set(filePath, blameEntries);
    }

    // Total commits count
    const totalLog = await git.log({ maxCount: 1, '--all': null } as Record<string, unknown>);
    const totalCommits = totalLog.total;

    return {
      commits,
      fileAuthors,
      fileLastTouch,
      fileChangeCount,
      authorCommitCount,
      authorFiles,
      totalContributors: authorStats.length,
      repoAgeWeeks,
      weeklyCommitCounts,
      branches,
      currentBranch,
      totalCommits,
      authorStats,
      recentCommits,
      fileBlame,
      commitTimeline,
    };
  } catch {
    return null;
  }
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0] ?? '';
}
