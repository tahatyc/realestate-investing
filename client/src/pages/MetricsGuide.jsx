import { metricGlossary, strategyGuides, systemGuides } from '../lib/metricsGuide.js';

export default function MetricsGuide() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Metrics Guide</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          A plain-language reference for the data, assumptions, formulas, strategy scores, and health checks used by the investment analyzer.
        </p>
      </div>

      <GuideSection
        title="Systems"
        intro="These systems explain where the numbers come from before they appear in strategy tables or property detail pages."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {systemGuides.map((guide) => (
            <SystemGuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      </GuideSection>

      <GuideSection
        title="Strategy Calculations"
        intro="Each strategy has a cash-only score and a leveraged score. When leverage is off, the app hides financed metrics and ranks by the cash score."
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {strategyGuides.map((guide) => (
            <StrategyGuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      </GuideSection>

      <GuideSection
        title="Metric Glossary"
        intro="Common metric names used across cards, tables, property details, and guide formulas."
      >
        <div className="space-y-3">
          {metricGlossary.map((group) => (
            <MetricGlossaryTable key={group.title} group={group} />
          ))}
        </div>
      </GuideSection>
    </div>
  );
}

function GuideSection({ title, intro, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {intro ? <p className="mt-1 max-w-4xl text-sm text-slate-500">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SystemGuideCard({ guide }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">{guide.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{guide.summary}</p>
      <FormulaBlock formulas={guide.formulas} />
    </article>
  );
}

function StrategyGuideCard({ guide }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{guide.label}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{guide.summary}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {guide.id}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <TextList title="Main inputs" items={guide.inputs} />
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-800">Scoring</p>
          <dl className="mt-2 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Cash score</dt>
              <dd className="font-medium text-slate-800">{guide.cashScore}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Leveraged score</dt>
              <dd className="font-medium text-slate-800">{guide.leveragedScore}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TextList title="Cash metrics" items={guide.cashMetrics} />
        <TextList title="Leveraged metrics" items={guide.leveragedMetrics} />
      </div>

      <FormulaBlock formulas={guide.formulas} />
      <TextList title="Current assumptions and caveats" items={guide.caveats} />
    </article>
  );
}

function FormulaBlock({ formulas }) {
  if (!formulas?.length) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
      {formulas.map((formula) => (
        <div key={`${formula.label}-${formula.formula}`} className="border-t border-slate-200 p-3 first:border-t-0">
          <p className="text-sm font-semibold text-slate-800">{formula.label}</p>
          <p className="mt-1 break-words rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
            {formula.formula}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{formula.detail}</p>
        </div>
      ))}
    </div>
  );
}

function TextList({ title, items }) {
  if (!items?.length) return null;

  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricGlossaryTable({ group }) {
  return (
    <article className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold">{group.title}</h3>
      </div>
      <div className="divide-y divide-slate-200">
        {group.entries.map((entry) => (
          <div key={entry.key} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[12rem_1fr]">
            <div>
              <p className="font-medium text-slate-900">{entry.label}</p>
              <p className="break-words font-mono text-xs text-slate-500">{entry.key}</p>
            </div>
            <div>
              <p className="leading-6 text-slate-600">{entry.description}</p>
              {entry.formula ? (
                <p className="mt-1 break-words rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
                  {entry.formula}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
