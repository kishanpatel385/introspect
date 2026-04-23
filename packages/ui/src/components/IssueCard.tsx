'use client';

import { motion } from 'framer-motion';
import type { Issue } from '@introspect/core-types';

interface IssueCardProps {
  issue: Issue;
  index?: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--color-critical)',
  high: 'var(--color-high)',
  medium: 'var(--color-medium)',
  low: 'var(--color-low)',
  info: 'var(--color-info)',
};

export function IssueCard({ issue, index = 0 }: IssueCardProps) {
  const severityColor = SEVERITY_COLORS[issue.severity] || 'var(--color-info)';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${severityColor}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: severityColor,
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            background: `color-mix(in srgb, ${severityColor} 12%, transparent)`,
          }}
        >
          {issue.severity}
        </span>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
          }}
        >
          {issue.type}
        </span>
        {issue.file && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {issue.file}
            {issue.line ? `:${issue.line}` : ''}
          </span>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
        {issue.title}
      </p>

      {issue.badCode && issue.goodCode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <code
            style={{
              display: 'block',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(248, 81, 73, 0.08)',
              color: 'var(--color-critical)',
            }}
          >
            - {issue.badCode}
          </code>
          <code
            style={{
              display: 'block',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(63, 185, 80, 0.08)',
              color: 'var(--color-score-excellent)',
            }}
          >
            + {issue.goodCode}
          </code>
        </div>
      )}
    </motion.div>
  );
}
