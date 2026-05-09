import MetricLabel from './MetricLabel.jsx';

export default function MetricCard({ label, labelKey, value, detail, tone = 'slate' }) {
  const toneClass = {
    slate: 'border-slate-200',
    green: 'border-emerald-200',
    yellow: 'border-amber-200',
    red: 'border-rose-200',
    blue: 'border-sky-200'
  }[tone] ?? 'border-slate-200';

  return (
    <div className={`rounded-md border bg-white p-4 ${toneClass}`}>
      <MetricLabel labelKey={labelKey} label={label} variant="card" />
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}
