import { Loader2, Power } from 'lucide-react';
import { useSettings, useUpdateSettings } from '../api/client.js';

export default function LeverageToggle() {
  const { data: settings } = useSettings();
  const mutation = useUpdateSettings();
  const enabled = Boolean(settings?.leverage?.enabled);

  return (
    <button
      type="button"
      onClick={() => mutation.mutate({ leverage: { enabled: !enabled } })}
      disabled={mutation.isPending || !settings}
      className={[
        'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium',
        enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'
      ].join(' ')}
    >
      {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
      Leverage: {enabled ? 'ON' : 'OFF'}
    </button>
  );
}
