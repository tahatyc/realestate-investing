import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatEur } from '../lib/formatters.js';

export default function NeighborhoodMap({ neighborhoods = [], metric = 'avg_price_per_sqm' }) {
  const data = neighborhoods
    .filter((item) => Number.isFinite(Number(item[metric])))
    .slice(0, 12)
    .map((item) => ({
      name: item.zone || item.neighborhood,
      value: Number(item[metric])
    }));

  if (!data.length) {
    return <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No neighborhood chart data yet.</div>;
  }

  return (
    <div className="h-72 rounded-md border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 40, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" angle={-35} textAnchor="end" height={64} interval={0} fontSize={11} />
          <YAxis tickFormatter={(value) => formatEur(value)} width={84} fontSize={12} />
          <Tooltip formatter={(value) => formatEur(value)} />
          <Bar dataKey="value" fill="#0f766e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
