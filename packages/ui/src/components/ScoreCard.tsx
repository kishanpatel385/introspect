'use client';

import { motion } from 'framer-motion';

interface ScoreCardProps {
  label: string;
  score: number;
  icon?: React.ReactNode;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--color-score-excellent)';
  if (score >= 60) return 'var(--color-score-good)';
  if (score >= 40) return 'var(--color-score-fair)';
  return 'var(--color-score-poor)';
}

function getGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export function ScoreCard({ label, score, icon }: ScoreCardProps) {
  const color = getScoreColor(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {icon && <span style={{ color: 'var(--color-text-secondary)' }}>{icon}</span>}
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color }}>{score}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>/100</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color,
          }}
        >
          {getGrade(score)}
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-bg-hover)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 'var(--radius-full)', background: color }}
        />
      </div>
    </motion.div>
  );
}
