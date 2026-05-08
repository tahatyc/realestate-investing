import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, formatEur } from '../lib/formatters.js';

export default function PriceChart({ history = [] }) {
  if (!history.length) {
    return <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No price history yet.</div>;
  }

  const data = history.map((entry) => ({
    date: entry.recorded_at,
    price: entry.price_eur
  }));

  return (
    <div className="h-64 rounded-md border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 8 }}>
          <XAxis dataKey="date" tickFormatter={formatDate} fontSize={12} />
          <YAxis tickFormatter={(value) => formatEur(value)} width={84} fontSize={12} />
          <Tooltip formatter={(value) => formatEur(value)} labelFormatter={formatDate} />
          <Line type="monotone" dataKey="price" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
