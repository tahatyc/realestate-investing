import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useScraperStatus, useStartScraper } from '../api/client.js';

export default function ScrapeButton() {
  const queryClient = useQueryClient();
  const status = useScraperStatus();
  const start = useStartScraper();
  const running = status.data?.status === 'running' || start.isPending;

  useEffect(() => {
    if (status.data?.status === 'completed') {
      queryClient.invalidateQueries();
    }
  }, [queryClient, status.data?.status]);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={running}
        onClick={() => start.mutate()}
        className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        <RefreshCw className={['h-4 w-4', running ? 'animate-spin' : ''].join(' ')} />
        {running ? 'Scraping' : 'Run scrape'}
      </button>
      {status.data?.progress ? (
        <span className="text-sm text-slate-500">
          {status.data.status} · {status.data.progress.currentPage}/{status.data.progress.totalPages} pages
        </span>
      ) : null}
    </div>
  );
}
