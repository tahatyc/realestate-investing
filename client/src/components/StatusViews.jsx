import { Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Loading data...' }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ title = 'Could not load data', error }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{error?.message ?? 'The API returned an error.'}</p>
    </div>
  );
}

export function EmptyState({ title = 'No data yet', detail = 'Run a scrape or adjust filters.' }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}
