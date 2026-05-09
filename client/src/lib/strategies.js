import { getLabel } from './labels.js';

export const strategyList = [
  {
    id: 'buy-in-green',
    label: 'Buy in Green',
    path: '/strategy/buy-in-green',
    tone: 'emerald',
    cashColumns: ['appreciationPct', 'potentialProfit', 'holdMonths'],
    leveragedColumns: ['leveragedRoiPct', 'leveragedProfit', 'interestCost']
  },
  {
    id: 'brrrr',
    label: 'BRRRR',
    path: '/strategy/brrrr',
    tone: 'indigo',
    cashColumns: ['arv', 'netYieldPct', 'monthlyRent'],
    leveragedColumns: ['monthlyCashFlow', 'cocPct', 'dscr']
  },
  {
    id: 'flip',
    label: 'Fix & Flip',
    path: '/strategy/flip',
    tone: 'amber',
    cashColumns: ['profit', 'roiPct', 'annualizedRoiPct'],
    leveragedColumns: ['leveragedProfit', 'leveragedRoiPct', 'interestCost']
  },
  {
    id: 'cash-flow',
    label: 'Cash Flow Rental',
    path: '/strategy/cash-flow',
    tone: 'sky',
    cashColumns: ['monthlyRent', 'netYieldPct', 'paybackYears'],
    leveragedColumns: ['monthlyCashFlow', 'cocPct', 'breakEvenRate']
  },
  {
    id: 'airbnb',
    label: 'Airbnb',
    path: '/strategy/airbnb',
    tone: 'rose',
    cashColumns: ['monthlyRevenue', 'netYieldPct', 'longTermComparison'],
    leveragedColumns: ['monthlyCashFlow', 'cocPct', 'longTermMonthlyCashFlow']
  },
  {
    id: 'below-market',
    label: 'Below Market',
    path: '/strategy/below-market',
    tone: 'teal',
    cashColumns: ['discountPct', 'discountAmount', 'daysOnMarket'],
    leveragedColumns: ['instantEquity', 'effectiveLtvPct', 'equityOnCashRatio']
  }
];

export function getStrategy(id) {
  return (
    strategyList.find((strategy) => strategy.id === id) ?? {
      id,
      label: id,
      path: `/strategy/${id}`,
      tone: 'slate',
      cashColumns: [],
      leveragedColumns: []
    }
  );
}

const metricLabelKeys = [
  'appreciationPct',
  'potentialProfit',
  'holdMonths',
  'leveragedRoiPct',
  'leveragedProfit',
  'interestCost',
  'arv',
  'netYieldPct',
  'monthlyRent',
  'paybackYears',
  'monthlyCashFlow',
  'cocPct',
  'dscr',
  'profit',
  'roiPct',
  'annualizedRoiPct',
  'monthlyRevenue',
  'longTermComparison',
  'longTermMonthlyCashFlow',
  'discountPct',
  'discountAmount',
  'daysOnMarket',
  'instantEquity',
  'effectiveLtvPct',
  'equityOnCashRatio',
  'breakEvenRate'
];

export const metricLabels = Object.fromEntries(metricLabelKeys.map((key) => [key, getLabel(key)]));
