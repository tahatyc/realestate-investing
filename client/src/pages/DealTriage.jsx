import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import HealthBadge from '../components/HealthBadge.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StatusViews.jsx';
import { useDealTriage, useUpdateDealTriage } from '../api/client.js';
import { formatEur, formatNumber, formatSqm } from '../lib/formatters.js';
import { getStrategy } from '../lib/strategies.js';
import { statusLabel, TRIAGE_STATUSES } from './dealTriageHelpers.js';

export default function DealTriage() {
  const [includeRejected, setIncludeRejected] = useState(false);
  const query = useDealTriage({ limit: 50, includeRejected: includeRejected ? 'true' : '' });
  const updateTriage = useUpdateDealTriage();

  if (query.isLoading) {
    return <LoadingState label="Loading deal triage..." />;
  }
  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const opportunities = query.data.opportunities ?? [];
  const summary = query.data.summary ?? {};

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deal Triage</h1>
          <p className="text-sm text-slate-500">Ranked opportunities that need a decision.</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          {formatNumber(summary.total ?? opportunities.length)} active candidates
          {summary.hiddenRejected ? `, ${formatNumber(summary.hiddenRejected)} rejected hidden` : ''}
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={includeRejected}
          onChange={(event) => setIncludeRejected(event.target.checked)}
        />
        Show rejected
      </label>

      {opportunities.length ? (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Property</th>
                  <th className="px-3 py-3 text-left font-semibold">Deal signal</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                  <th className="px-3 py-3 text-left font-semibold">Note</th>
                  <th className="px-3 py-3 text-left font-semibold">Links</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((item) => (
                  <TriageRow key={item.property.id} item={item} updateTriage={updateTriage} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState title="No triage candidates yet" detail="Run a fresh scrape or adjust filters." />
      )}
    </div>
  );
}

function TriageRow({ item, updateTriage }) {
  const property = item.property;
  const triage = item.triage;

  function saveStatus(status) {
    updateTriage.mutate({
      propertyId: property.id,
      updates: {
        status,
        note: triage.note,
        rejectedReason: triage.rejectedReason
      }
    });
  }

  function saveNote(event) {
    updateTriage.mutate({
      propertyId: property.id,
      updates: {
        status: triage.status,
        note: event.currentTarget.value,
        rejectedReason: triage.rejectedReason
      }
    });
  }

  return (
    <tr className="border-t border-slate-100 align-top hover:bg-slate-50">
      <td className="min-w-64 px-3 py-3">
        <Link className="font-medium text-slate-900 hover:text-sky-700" to={`/property/${property.id}`}>
          {property.title || property.neighborhood || `Property #${property.id}`}
        </Link>
        <p className="text-xs text-slate-500">
          {property.neighborhood || '-'} - {property.type || '-'}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {formatEur(property.priceEur)} - {formatSqm(property.areaSqm)} - {formatEur(property.pricePerSqm)}/sqm
        </p>
      </td>
      <td className="min-w-72 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            {getStrategy(item.bestStrategy).label}
          </span>
          <HealthBadge health={item.health} size="sm" />
          <span className="text-xs text-slate-500">Rank {Math.round(item.rankScore)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.signals.slice(0, 4).map((signal) => (
            <span
              key={`${signal.type}-${signal.label}`}
              className={[
                'rounded-full px-2 py-1 text-xs font-medium',
                signal.severity === 'risk'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-emerald-100 text-emerald-800'
              ].join(' ')}
            >
              {signal.label}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-3">
        <select
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
          value={triage.status}
          onChange={(event) => saveStatus(event.target.value)}
        >
          {TRIAGE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </td>
      <td className="min-w-64 px-3 py-3">
        <textarea
          className="h-16 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          defaultValue={triage.note}
          onBlur={saveNote}
          placeholder="Broker notes, legal questions, next action"
        />
        {updateTriage.isError ? <p className="mt-1 text-xs text-rose-700">{updateTriage.error.message}</p> : null}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-2">
          <Link className="text-sm font-medium text-sky-700" to={`/property/${property.id}`}>
            Detail
          </Link>
          {property.url ? (
            <a className="inline-flex items-center gap-1 text-sm font-medium text-sky-700" href={property.url} target="_blank" rel="noreferrer">
              Original <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
