import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  detail?: string;
  tone?: 'default' | 'cyan' | 'emerald' | 'amber' | 'red';
}

const TONE_CLASSES: Record<NonNullable<MetricCardProps['tone']>, string> = {
  default: 'text-slate-100',
  cyan: 'text-cyan-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  detail,
  tone = 'default',
}) => {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-4 flex flex-col justify-between min-w-0">
      <div className="text-xs font-medium text-slate-400 truncate">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5 min-w-0">
        <span
          className={`font-mono tabular-nums text-2xl font-semibold tracking-tight truncate ${TONE_CLASSES[tone]}`}
        >
          {value}
        </span>
        {unit && <span className="font-mono text-xs text-slate-500 shrink-0">{unit}</span>}
      </div>
      {detail && <div className="mt-1.5 text-xs text-slate-500 truncate">{detail}</div>}
    </div>
  );
};
