import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  detail?: string;
  tone?: 'default' | 'cyan' | 'emerald' | 'amber' | 'red';
}

const TONE_STYLES: Record<NonNullable<MetricCardProps['tone']>, string> = {
  default: 'var(--text-primary)',
  cyan: 'var(--accent-text)',
  emerald: 'var(--status-success)',
  amber: 'var(--status-warning)',
  red: 'var(--status-danger)',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  detail,
  tone = 'default',
}) => {
  return (
    <div className="raira-card raira-card-pad flex flex-col justify-between min-w-0">
      <div className="text-xs font-medium text-[var(--text-muted)] truncate">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5 min-w-0">
        <span
          className="font-mono tabular-nums text-2xl font-semibold tracking-tight truncate"
          style={{ color: TONE_STYLES[tone] }}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs text-[var(--text-muted)] shrink-0">{unit}</span>
        )}
      </div>
      {detail && (
        <div className="mt-1.5 text-xs text-[var(--text-muted)] truncate">{detail}</div>
      )}
    </div>
  );
};
