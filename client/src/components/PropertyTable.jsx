import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import HealthBadge from './HealthBadge.jsx';
import MetricLabel from './MetricLabel.jsx';
import RateSensitivity from './RateSensitivity.jsx';
import { formatCashFlow, formatEur, formatPercent, formatSqm } from '../lib/formatters.js';

export default function PropertyTable({ rows = [], leverageEnabled, currentRate, stressBuffer }) {
  const [sorting, setSorting] = useState([{ id: 'score', desc: true }]);
  const [expanded, setExpanded] = useState({});

  const columns = useMemo(
    () => [
      {
        id: 'expand',
        header: '',
        cell: ({ row }) => (
          <button className="rounded p-1 hover:bg-slate-100" onClick={() => setExpanded((current) => ({ ...current, [row.id]: !current[row.id] }))}>
            {expanded[row.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )
      },
      ...(leverageEnabled
        ? [
            {
              id: 'health',
              header: <MetricLabel labelKey="health" variant="table" />,
              accessorFn: (row) => row.health,
              cell: ({ getValue }) => <HealthBadge health={getValue()} size="sm" />
            }
          ]
        : []),
      {
        id: 'score',
        header: <MetricLabel labelKey="score" variant="table" />,
        accessorFn: (row) => row.score ?? 0,
        cell: ({ getValue }) => formatPercent(getValue())
      },
      {
        id: 'property',
        header: <MetricLabel labelKey="property" variant="table" />,
        accessorFn: (row) => row.property?.title ?? row.title,
        cell: ({ row }) => {
          const property = row.original.property ?? row.original;
          return (
            <div className="min-w-56">
              <Link className="font-medium text-slate-900 hover:text-sky-700" to={`/property/${property.id}`}>
                {property.title || property.neighborhood || `Property #${property.id}`}
              </Link>
              <p className="text-xs text-slate-500">{property.zone || property.neighborhood || '-'}</p>
            </div>
          );
        }
      },
      {
        id: 'price',
        header: <MetricLabel labelKey="price" variant="table" />,
        accessorFn: (row) => row.property?.priceEur ?? row.priceEur,
        cell: ({ getValue }) => formatEur(getValue())
      },
      {
        id: 'area',
        header: <MetricLabel labelKey="area" variant="table" />,
        accessorFn: (row) => row.property?.areaSqm ?? row.areaSqm,
        cell: ({ getValue }) => formatSqm(getValue())
      },
      {
        id: 'yield',
        header: <MetricLabel labelKey="netYieldPct" variant="table" />,
        accessorFn: (row) => row.cashMetrics?.netYieldPct ?? row.cashMetrics?.roiPct ?? row.cashMetrics?.discountPct,
        cell: ({ getValue }) => formatPercent(getValue())
      },
      ...(leverageEnabled
        ? [
            {
              id: 'cashFlow',
              header: <MetricLabel labelKey="cashFlow" variant="table" />,
              accessorFn: (row) => row.leveragedMetrics?.monthlyCashFlow,
              cell: ({ getValue }) => <span className={Number(getValue()) < 0 ? 'text-rose-700' : 'text-emerald-700'}>{formatCashFlow(getValue())}</span>
            },
            {
              id: 'coc',
              header: <MetricLabel labelKey="coc" variant="table" />,
              accessorFn: (row) => row.leveragedMetrics?.cocPct,
              cell: ({ getValue }) => formatPercent(getValue())
            },
            {
              id: 'breakeven',
              header: <MetricLabel labelKey="breakEvenRate" variant="table" />,
              accessorFn: (row) => row.breakEvenRate,
              cell: ({ getValue }) => formatPercent(getValue())
            }
          ]
        : [])
    ],
    [expanded, leverageEnabled]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-3 text-left font-semibold">
                    {header.isPlaceholder ? null : (
                      <button className="font-semibold" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-t border-slate-100 hover:bg-slate-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {expanded[row.id] ? (
                  <tr className="border-t border-slate-100 bg-slate-50">
                    <td colSpan={row.getVisibleCells().length} className="px-3 py-3">
                      <RateSensitivity
                        rateSensitivity={row.original.rateSensitivity}
                        breakEvenRate={row.original.breakEvenRate}
                        currentRate={currentRate}
                        stressBuffer={stressBuffer}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
