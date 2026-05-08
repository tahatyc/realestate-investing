const classes = {
  green: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  yellow: 'bg-amber-100 text-amber-800 ring-amber-200',
  red: 'bg-rose-100 text-rose-800 ring-rose-200'
};

export default function HealthBadge({ health, size = 'md' }) {
  if (!health) {
    return null;
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full font-medium capitalize ring-1',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        classes[health] ?? 'bg-slate-100 text-slate-700 ring-slate-200'
      ].join(' ')}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {health}
    </span>
  );
}
