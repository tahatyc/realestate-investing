import { Link } from 'react-router-dom';
import LeverageToggle from '../components/LeverageToggle.jsx';
import MetricCard from '../components/MetricCard.jsx';
import NeighborhoodMap from '../components/NeighborhoodMap.jsx';
import ScrapeButton from '../components/ScrapeButton.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StatusViews.jsx';
import { useOverview, useSettings } from '../api/client.js';
import { formatDate, formatNumber, formatPercent } from '../lib/formatters.js';
import { strategyList } from '../lib/strategies.js';

export default function Overview() {
  const overview = useOverview();
  const settings = useSettings();

  if (overview.isLoading || settings.isLoading) {
    return <LoadingState label="Loading dashboard..." />;
  }
  if (overview.isError) {
    return <ErrorState error={overview.error} />;
  }

  const leverage = overview.data.leverage;
  const strategies = overview.data.strategies ?? {};

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-slate-500">Live investment scoring across scraped Sofia listings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LeverageToggle />
          <ScrapeButton />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Active listings" value={formatNumber(overview.data.totalListings)} />
        <MetricCard label="Mortgage rate" value={formatPercent(leverage.mortgageRate)} detail={`${leverage.loanTermYears} years · ${formatPercent(leverage.ltvPct, 0)} LTV`} />
        <MetricCard label="Last scrape" value={overview.data.lastScrape?.status ?? 'none'} detail={formatDate(overview.data.lastScrape?.started_at)} />
        <MetricCard label="Health mode" value={leverage.enabled ? 'Leveraged' : 'Cash-only'} detail={leverage.enabled ? 'Traffic lights active' : 'Leveraged columns hidden'} />
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {strategyList.map((strategy) => {
          const summary = strategies[strategy.id] ?? {};
          const health = summary.healthBreakdown ?? { green: 0, yellow: 0, red: 0 };
          return (
            <Link key={strategy.id} to={strategy.path} className="rounded-md border border-slate-200 bg-white p-4 hover:border-slate-400">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">{strategy.label}</h2>
                <span className="text-sm text-slate-500">{formatNumber(summary.total ?? 0)} deals</span>
              </div>
              <div className="mt-3 flex gap-2 text-sm">
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">G {health.green}</span>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Y {health.yellow}</span>
                <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">R {health.red}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">Avg CoC {formatPercent(summary.avgCocPct)}</p>
            </Link>
          );
        })}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Neighborhood price/sqm</h2>
          <Link className="text-sm font-medium text-sky-700" to="/neighborhoods">View all</Link>
        </div>
        {overview.data.neighborhoods?.length ? <NeighborhoodMap neighborhoods={overview.data.neighborhoods} /> : <EmptyState />}
      </section>
    </div>
  );
}
