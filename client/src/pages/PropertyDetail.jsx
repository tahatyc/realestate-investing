import { ExternalLink } from 'lucide-react';
import { useParams } from 'react-router-dom';
import HealthBadge from '../components/HealthBadge.jsx';
import MetricCard from '../components/MetricCard.jsx';
import MetricLabel from '../components/MetricLabel.jsx';
import PriceChart from '../components/PriceChart.jsx';
import RateSensitivity from '../components/RateSensitivity.jsx';
import { ErrorState, LoadingState } from '../components/StatusViews.jsx';
import { useProperty } from '../api/client.js';
import { formatEur, formatPercent, formatSqm } from '../lib/formatters.js';
import { getLabel } from '../lib/labels.js';
import { formatMetric } from '../lib/metricFormatters.js';
import { getMetricValueClass } from '../lib/metricValueStyles.js';
import { getStrategy } from '../lib/strategies.js';

export default function PropertyDetail() {
  const { id } = useParams();
  const query = useProperty(id);

  if (query.isLoading) {
    return <LoadingState label="Loading property detail..." />;
  }
  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const property = query.data.property;
  const strategies = Object.entries(query.data.strategies ?? {});

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{property.title || property.neighborhood || `Property #${property.id}`}</h1>
          <p className="text-sm text-slate-500">{property.neighborhood} · {property.zone} · {property.type}</p>
        </div>
        {property.url ? (
          <a className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium" href={property.url} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Original listing
          </a>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard labelKey="price" value={formatEur(property.priceEur)} />
        <MetricCard labelKey="area" value={formatSqm(property.areaSqm)} />
        <MetricCard labelKey="pricePerSqm" value={formatEur(property.pricePerSqm)} />
        <MetricCard labelKey="condition" value={property.condition ?? '-'} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Price history</h2>
        <PriceChart history={query.data.priceHistory} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Strategy analysis</h2>
        {strategies.map(([id, result]) => (
          <div key={id} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">{getStrategy(id).label}</h3>
              <div className="flex items-center gap-2">
                <HealthBadge health={result.health} />
                <span className="text-sm text-slate-500">Score {formatPercent(result.score)}</span>
              </div>
            </div>
            {result.flags?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {result.flags.map((flag) => (
                  <span key={flag} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{getLabel(flag)}</span>
                ))}
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <MetricList title="Cash metrics" metrics={result.cashMetrics} />
              <MetricList title="Leveraged metrics" metrics={result.leveragedMetrics} />
            </div>
            <div className="mt-4">
              <RateSensitivity
                rateSensitivity={result.rateSensitivity}
                breakEvenRate={result.breakEvenRate}
                currentRate={query.data.leverageSettings?.mortgageRate}
              />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function MetricList({ title, metrics }) {
  if (!metrics) {
    return <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">{title}: not active</div>;
  }
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-sm font-semibold">{title}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        {Object.entries(metrics).slice(0, 10).map(([key, value]) => (
          <div key={key}>
            <dt>
              <MetricLabel labelKey={key} variant="metric" />
            </dt>
            <dd className={`font-medium ${getMetricValueClass(key, value)}`}>{formatMetric(key, value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
