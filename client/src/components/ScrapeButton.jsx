import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildScrapeRequest, useScraperStatus, useStartScraper } from '../api/client.js';

export default function ScrapeButton() {
  const queryClient = useQueryClient();
  const status = useScraperStatus();
  const start = useStartScraper();
  const [mode, setMode] = useState('default');
  const [includeRentals, setIncludeRentals] = useState(true);
  const running = status.data?.status === 'running' || start.isPending;

  useEffect(() => {
    if (status.data?.status === 'completed') {
      queryClient.invalidateQueries();
    }
  }, [queryClient, status.data?.status]);

  return (
    <div className="flex items-center gap-3">
      <select
        className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
        value={mode}
        disabled={running}
        onChange={(event) => setMode(event.target.value)}
      >
        <option value="default">Default crawl</option>
        <option value="deep">Deep crawl</option>
        <option value="full">Full crawl</option>
      </select>
      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={includeRentals}
          disabled={running}
          onChange={(event) => setIncludeRentals(event.target.checked)}
        />
        Rentals
      </label>
      <button
        type="button"
        disabled={running}
        onClick={() => start.mutate(buildScrapeRequest(mode, includeRentals))}
        className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        <RefreshCw className={['h-4 w-4', running ? 'animate-spin' : ''].join(' ')} />
        {running ? 'Scraping' : 'Run scrape'}
      </button>
      {status.data?.progress ? (
        <span className="text-sm text-slate-500">
          {status.data.status} · {status.data.crawlMode ?? 'bounded'} · {status.data.progress.currentPage}/{status.data.progress.totalPages} pages
        </span>
      ) : null}
    </div>
  );
}
