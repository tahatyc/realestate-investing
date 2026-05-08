import NeighborhoodMap from '../components/NeighborhoodMap.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StatusViews.jsx';
import { useNeighborhoods } from '../api/client.js';
import { formatEur, formatNumber, formatSqm } from '../lib/formatters.js';

export default function Neighborhoods() {
  const query = useNeighborhoods();

  if (query.isLoading) return <LoadingState label="Loading neighborhoods..." />;
  if (query.isError) return <ErrorState error={query.error} />;

  const neighborhoods = query.data.neighborhoods ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Neighborhoods</h1>
        <p className="text-sm text-slate-500">Zone comparison from active listings.</p>
      </div>

      {neighborhoods.length ? (
        <>
          <NeighborhoodMap neighborhoods={neighborhoods} />
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left">Neighborhood</th>
                  <th className="px-3 py-3 text-left">Zone</th>
                  <th className="px-3 py-3 text-right">Listings</th>
                  <th className="px-3 py-3 text-right">Avg price</th>
                  <th className="px-3 py-3 text-right">Avg price/sqm</th>
                  <th className="px-3 py-3 text-right">Avg area</th>
                </tr>
              </thead>
              <tbody>
                {neighborhoods.map((item) => (
                  <tr key={`${item.neighborhood}-${item.zone}`} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-medium">{item.neighborhood}</td>
                    <td className="px-3 py-3">{item.zone}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(item.property_count)}</td>
                    <td className="px-3 py-3 text-right">{formatEur(item.avg_price_eur)}</td>
                    <td className="px-3 py-3 text-right">{formatEur(item.avg_price_per_sqm)}</td>
                    <td className="px-3 py-3 text-right">{formatSqm(item.avg_area_sqm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
