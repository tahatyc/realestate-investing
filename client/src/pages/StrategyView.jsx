import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import FilterBar from '../components/FilterBar.jsx';
import LeverageToggle from '../components/LeverageToggle.jsx';
import MetricCard from '../components/MetricCard.jsx';
import PropertyTable from '../components/PropertyTable.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StatusViews.jsx';
import { useSettings, useStrategy } from '../api/client.js';
import { formatNumber, formatPercent } from '../lib/formatters.js';
import { getStrategy } from '../lib/strategies.js';

export default function StrategyView() {
  const { name } = useParams();
  const strategy = getStrategy(name);
  const [filters, setFilters] = useState({ limit: 50 });
  const settings = useSettings();
  const leverageEnabled = Boolean(settings.data?.leverage?.enabled);
  const effectiveFilters = useMemo(() => (leverageEnabled ? filters : { ...filters, health: '' }), [filters, leverageEnabled]);
  const query = useStrategy(name, effectiveFilters);

  if (settings.isLoading || query.isLoading) {
    return <LoadingState label={`Loading ${strategy.label}...`} />;
  }
  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const summary = query.data.summary ?? {};
  const health = summary.healthBreakdown ?? { green: 0, yellow: 0, red: 0 };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{strategy.label}</h1>
          <p className="text-sm text-slate-500">Ranked opportunities from the live strategy engine.</p>
        </div>
        <LeverageToggle />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Results" value={formatNumber(summary.total ?? 0)} />
        <MetricCard label="Avg CoC" value={formatPercent(summary.avgCocPct)} />
        <MetricCard label="Green" value={health.green} tone="green" />
        <MetricCard label="Red" value={health.red} tone="red" />
      </div>

      <FilterBar filters={filters} setFilters={setFilters} leverageEnabled={leverageEnabled} />

      {query.data.properties?.length ? (
        <PropertyTable
          rows={query.data.properties}
          leverageEnabled={leverageEnabled}
          currentRate={settings.data?.leverage?.mortgageRate}
          stressBuffer={settings.data?.flags?.rateStressPct}
        />
      ) : (
        <EmptyState title="No matching opportunities" detail="Adjust filters or run a fresh scrape." />
      )}
    </div>
  );
}
