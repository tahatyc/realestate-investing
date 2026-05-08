import { formatCashFlow, formatEur, formatPercent } from '../lib/formatters.js';

export default function RateSensitivity({ rateSensitivity = [], breakEvenRate, currentRate, stressBuffer = 1 }) {
  if (!rateSensitivity?.length && breakEvenRate == null) {
    return <p className="text-sm text-slate-500">No rate sensitivity available.</p>;
  }

  const sensitive =
    breakEvenRate != null &&
    currentRate != null &&
    Number(breakEvenRate) <= Number(currentRate) + Number(stressBuffer);

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Rate</th>
            <th className="px-3 py-2 text-right">Payment</th>
            <th className="px-3 py-2 text-right">Cash flow</th>
          </tr>
        </thead>
        <tbody>
          {rateSensitivity.map((row) => (
            <tr key={row.ratePct} className="border-t border-slate-100">
              <td className="px-3 py-2">{formatPercent(row.ratePct)}</td>
              <td className="px-3 py-2 text-right">{formatEur(row.monthlyPayment)}</td>
              <td className={['px-3 py-2 text-right font-medium', Number(row.monthlyCashFlow) < 0 ? 'text-rose-700' : 'text-emerald-700'].join(' ')}>
                {formatCashFlow(row.monthlyCashFlow)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={['border-t px-3 py-2 text-sm', sensitive ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-600'].join(' ')}>
        Breakeven rate: <span className="font-semibold">{formatPercent(breakEvenRate)}</span>
      </div>
    </div>
  );
}
