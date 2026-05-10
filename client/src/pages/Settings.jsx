import { useEffect, useState } from 'react';
import { useSettings, useUpdateSettings } from '../api/client.js';
import MetricLabel from '../components/MetricLabel.jsx';
import { ErrorState, LoadingState } from '../components/StatusViews.jsx';

export default function Settings() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (settings.data) {
      setForm(settings.data);
    }
  }, [settings.data]);

  if (settings.isLoading || !form) return <LoadingState label="Loading settings..." />;
  if (settings.isError) return <ErrorState error={settings.error} />;

  function patch(section, key, value) {
    setForm((current) => {
      const next = { ...current, [section]: { ...current[section], [key]: value } };
      if (section === 'leverage' && key === 'downPaymentPct') {
        next.leverage.ltvPct = 100 - Number(value);
      }
      if (section === 'leverage' && key === 'ltvPct') {
        next.leverage.downPaymentPct = 100 - Number(value);
      }
      return next;
    });
  }

  function save(event) {
    event.preventDefault();
    update.mutate(form);
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-slate-500">Assumptions used by every strategy calculation.</p>
        </div>
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" disabled={update.isPending}>
          {update.isPending ? 'Saving...' : 'Save settings'}
        </button>
      </div>

      <Panel title="General Assumptions">
        <Field labelKey="targetGrossYieldPct" value={form.general.targetGrossYieldPct} onChange={(value) => patch('general', 'targetGrossYieldPct', value)} />
        <Field labelKey="targetNetYieldPct" value={form.general.targetNetYieldPct} onChange={(value) => patch('general', 'targetNetYieldPct', value)} />
        <Field labelKey="rehabCostPerSqm" value={form.general.rehabCostPerSqm} onChange={(value) => patch('general', 'rehabCostPerSqm', value)} />
        <Field labelKey="transactionCostPct" value={form.general.transactionCostPct} onChange={(value) => patch('general', 'transactionCostPct', value)} />
        <Field labelKey="vacancyPct" value={form.general.vacancyPct} onChange={(value) => patch('general', 'vacancyPct', value)} />
        <Field labelKey="managementFeePct" value={form.general.managementFeePct} onChange={(value) => patch('general', 'managementFeePct', value)} />
      </Panel>

      <Panel title="Mortgage / Leverage">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={form.leverage.enabled} onChange={(event) => patch('leverage', 'enabled', event.target.checked)} />
          Enable leverage analysis
        </label>
        <Field labelKey="mortgageRate" value={form.leverage.mortgageRate} onChange={(value) => patch('leverage', 'mortgageRate', value)} />
        <Field labelKey="loanTermYears" value={form.leverage.loanTermYears} onChange={(value) => patch('leverage', 'loanTermYears', value)} />
        <Field labelKey="downPaymentPct" value={form.leverage.downPaymentPct} onChange={(value) => patch('leverage', 'downPaymentPct', value)} />
        <Field labelKey="ltvPct" value={form.leverage.ltvPct} onChange={(value) => patch('leverage', 'ltvPct', value)} />
        <Field labelKey="originationFeePct" value={form.leverage.originationFeePct} onChange={(value) => patch('leverage', 'originationFeePct', value)} />
        <Field labelKey="annualInsuranceEur" value={form.leverage.annualInsuranceEur} onChange={(value) => patch('leverage', 'annualInsuranceEur', value)} />
      </Panel>

      <Panel title="Investment Health Thresholds">
        <Field labelKey="cocGreenPct" value={form.flags.cocGreenPct} onChange={(value) => patch('flags', 'cocGreenPct', value)} />
        <Field labelKey="cocYellowPct" value={form.flags.cocYellowPct} onChange={(value) => patch('flags', 'cocYellowPct', value)} />
        <Field labelKey="dscrMinimum" value={form.flags.dscrMinimum} onChange={(value) => patch('flags', 'dscrMinimum', value)} />
        <Field labelKey="rateStressPct" value={form.flags.rateStressPct} onChange={(value) => patch('flags', 'rateStressPct', value)} />
      </Panel>

      <Panel title="Airbnb">
        <Field labelKey="occupancyPct" value={form.airbnb.occupancyPct} onChange={(value) => patch('airbnb', 'occupancyPct', value)} />
        <Field labelKey="dailyRateEur" value={form.airbnb.dailyRateEur} onChange={(value) => patch('airbnb', 'dailyRateEur', value)} />
        <Field labelKey="operatingExpensePct" value={form.airbnb.operatingExpensePct} onChange={(value) => patch('airbnb', 'operatingExpensePct', value)} />
      </Panel>
    </form>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function Field({ labelKey, label, value, onChange }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block">
        <MetricLabel labelKey={labelKey} label={label} />
      </span>
      <input className="input" type="number" step="0.01" value={value ?? ''} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
