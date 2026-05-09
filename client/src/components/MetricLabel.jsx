import { Info } from 'lucide-react';
import { getLabelMeta } from '../lib/labels.js';

const sizeClasses = {
  card: 'text-xs font-medium uppercase text-slate-500',
  default: 'text-sm font-medium text-slate-700',
  table: 'text-xs font-semibold uppercase text-slate-500',
  metric: 'text-xs text-slate-500'
};

export default function MetricLabel({ labelKey, label, description, variant = 'default', className = '' }) {
  const metadata = labelKey ? getLabelMeta(labelKey) : { label: label ?? 'Unknown', description: description ?? '' };
  const displayLabel = label ?? metadata.label;
  const tooltip = description ?? metadata.description;
  const textClass = `${sizeClasses[variant] ?? sizeClasses.default} ${className}`.trim();

  return (
    <span className="group/metric-label relative inline-flex max-w-full items-center gap-1 align-middle">
      <span className={textClass}>{displayLabel}</span>
      {tooltip ? (
        <span className="relative inline-flex">
          <span
            tabIndex={0}
            aria-label={`${displayLabel}: ${tooltip}`}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 outline-none transition hover:text-slate-700 focus:text-slate-700 focus:ring-2 focus:ring-slate-300"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case leading-snug text-slate-700 shadow-lg group-hover/metric-label:block group-focus-within/metric-label:block"
          >
            {tooltip}
          </span>
        </span>
      ) : null}
    </span>
  );
}
