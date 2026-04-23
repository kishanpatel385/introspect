'use client';

import { motion } from 'framer-motion';

interface ScanProgressProps {
  currentStep: string;
  steps: string[];
  completedSteps: number;
}

export function ScanProgress({ currentStep, steps, completedSteps }: ScanProgressProps) {
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Scanning...
        </span>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-accent)' }}>
          {Math.round(progress)}%
        </span>
      </div>

      <div
        style={{
          height: 6,
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-bg-hover)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-accent)',
            boxShadow: 'var(--shadow-glow)',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {steps.map((step, i) => (
          <div
            key={step}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              color:
                i < completedSteps
                  ? 'var(--color-score-excellent)'
                  : i === completedSteps
                    ? 'var(--color-accent)'
                    : 'var(--color-text-muted)',
            }}
          >
            <span style={{ width: 16, textAlign: 'center' }}>
              {i < completedSteps ? '✓' : i === completedSteps ? '→' : '·'}
            </span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
