import { getLabel } from './labels.js';
import { strategyList } from './strategies.js';

export const requiredSystemGuideIds = [
  'data-freshness',
  'settings',
  'leverage',
  'mortgage-payment',
  'rate-sensitivity',
  'health-flags',
  'neighborhoods'
];

export const systemGuides = [
  {
    id: 'data-freshness',
    title: 'Data ingestion and freshness',
    summary:
      'The dashboard works from locally stored imot.bg listing data. Active listings, property details, and price history come from scraper runs, so every result should be read in the context of the last scrape time.',
    formulas: [
      {
        label: 'Active listings',
        formula: 'Listings where the local dataset still marks the property as active.',
        detail: 'The overview uses this count to show how much current market coverage the app has.'
      },
      {
        label: 'Price history',
        formula: 'Stored price observations ordered by scrape time.',
        detail: 'Property detail pages use this to show price movement and Below Market counts price drops from decreases in the recorded sequence.'
      },
      {
        label: 'Last scrape',
        formula: 'Most recent scraper run status and timestamp.',
        detail: 'A stale scrape means metrics may be mathematically correct but based on old market data.'
      }
    ]
  },
  {
    id: 'settings',
    title: 'Settings and assumptions',
    summary:
      'Settings are global assumptions used by every strategy calculation. Changing rental yield targets, expenses, leverage, Airbnb assumptions, or health thresholds changes future API results immediately.',
    formulas: [
      {
        label: 'Estimated monthly rent',
        formula: 'price * targetGrossYieldPct / 100 / 12',
        detail: 'The app estimates long-term rent from the configured gross yield target rather than from a separate rent listing match.'
      },
      {
        label: 'Monthly NOI',
        formula: 'monthlyRent * (1 - (vacancyPct + managementFeePct) / 100)',
        detail: 'NOI is net operating income after vacancy and management assumptions, before mortgage payment and insurance.'
      },
      {
        label: 'Airbnb monthly revenue',
        formula: 'dailyRateEur * 30 * occupancyPct / 100',
        detail: 'Short-term rental revenue uses a 30-day month and the configured occupancy assumption.'
      }
    ]
  },
  {
    id: 'leverage',
    title: 'Leverage behavior',
    summary:
      'Leverage controls whether financed metrics, health flags, rate sensitivity, and leveraged scoring are visible. The cash-only metrics are still calculated either way.',
    formulas: [
      {
        label: 'Loan amount',
        formula: 'price * ltvPct / 100',
        detail: 'The borrowed principal is based on the configured loan-to-value ratio.'
      },
      {
        label: 'Down payment',
        formula: 'price * downPaymentPct / 100',
        detail: 'The cash paid upfront is used as invested cash for many leveraged return calculations.'
      },
      {
        label: 'Origination fee',
        formula: 'loanAmount * originationFeePct / 100',
        detail: 'Loan setup cost is included in leveraged profit calculations for strategies that model financing carry.'
      },
      {
        label: 'Leverage off',
        formula: 'When leverage is off, score falls back to the cash score.',
        detail: 'Leveraged metrics, health, flags, rate sensitivity, and break-even rate are hidden in API results.'
      }
    ]
  },
  {
    id: 'mortgage-payment',
    title: 'Mortgage payment math',
    summary:
      'The mortgage payment is a fixed amortizing principal-and-interest payment calculated from principal, annual rate, and loan term. It is a screening estimate, not a bank offer.',
    formulas: [
      {
        label: 'Monthly rate',
        formula: 'annualRatePct / 100 / 12',
        detail: 'The annual mortgage rate setting is converted to a monthly decimal rate.'
      },
      {
        label: 'Monthly payment',
        formula: 'principal * r * (1 + r)^n / ((1 + r)^n - 1)',
        detail: 'This is the standard amortizing payment formula. If the rate is 0%, the app uses principal divided by months.'
      },
      {
        label: 'Interest-only carry cost',
        formula: 'principal * mortgageRate / 100 / 12 * months',
        detail: 'Buy in Green and Fix & Flip use interest-only carry cost over the assumed hold period.'
      },
      {
        label: 'DSCR',
        formula: 'monthlyNOI / monthlyDebtService',
        detail: 'Debt service coverage ratio compares operating income with the mortgage payment.'
      }
    ]
  },
  {
    id: 'rate-sensitivity',
    title: 'Rate sensitivity and break-even rate',
    summary:
      'Rate sensitivity shows whether a financed deal still works if mortgage rates move higher. Break-even rate estimates the rate where monthly cash flow reaches zero.',
    formulas: [
      {
        label: 'Rate sensitivity',
        formula: 'currentRate, currentRate + 1%, currentRate + 2%',
        detail: 'For each rate, the app recalculates monthly payment and monthly cash flow.'
      },
      {
        label: 'Break-even rate',
        formula: 'Search between 0% and 20% until payment equals NOI available for debt service.',
        detail: 'A low break-even rate means the deal has less room to absorb higher borrowing costs.'
      },
      {
        label: 'Monthly cash flow',
        formula: 'monthlyNOI - monthlyPayment - annualInsurance / 12',
        detail: 'Rental-style leveraged strategies subtract mortgage payment and monthly insurance from NOI.'
      }
    ]
  },
  {
    id: 'health-flags',
    title: 'Health flags and traffic lights',
    summary:
      'Health is a leveraged screening system. It combines cash flow, cash-on-cash return, DSCR, break-even rate, refinance coverage, and instant equity signals.',
    formulas: [
      {
        label: 'Green',
        formula: 'cocPct >= cocGreenPct AND monthlyCashFlow > 0 AND dscr >= dscrMinimum',
        detail: 'Green means the deal clears the configured return and debt coverage thresholds.'
      },
      {
        label: 'Yellow',
        formula: 'Default leveraged state when a deal is neither green nor red.',
        detail: 'Yellow means the deal is watchable but does not clearly pass or fail the health rules.'
      },
      {
        label: 'Red',
        formula: '(monthlyCashFlow < 0 AND cocPct < cocYellowPct) OR breakEvenRate <= currentRate',
        detail: 'Red means the deal is already weak on cash flow or cannot tolerate the current mortgage rate.'
      },
      {
        label: 'Flags',
        formula: 'NEGATIVE_CASH_FLOW, LOW_DSCR, RATE_SENSITIVE, STRONG_LEVERAGED_RETURN, REFINANCE_VIABLE, INSTANT_EQUITY',
        detail: 'Flags explain which specific rule or signal affected the deal.'
      }
    ]
  },
  {
    id: 'neighborhoods',
    title: 'Neighborhood metrics',
    summary:
      'Neighborhood data gives context for price per sqm, estimated market value, and relative deal quality. Several strategies compare a listing against neighborhood price levels.',
    formulas: [
      {
        label: 'Average price per sqm',
        formula: 'Average active property price_per_sqm in the same zone, excluding the current listing.',
        detail: 'When no stronger comparison exists, strategy code falls back to the current listing price per sqm.'
      },
      {
        label: 'Market value',
        formula: 'averagePricePerSqm * area',
        detail: 'Buy in Green, BRRRR, Fix & Flip, and Below Market use this as part of future value or discount estimates.'
      },
      {
        label: 'Price per sqm',
        formula: 'price / area',
        detail: 'This is the basic price efficiency metric used to compare listings across sizes and neighborhoods.'
      }
    ]
  }
];

const strategyGuideById = {
  'buy-in-green': {
    id: 'buy-in-green',
    summary:
      'Finds new-build or near-finished properties where the expected finished value is higher than the current asking price.',
    inputs: ['price', 'areaSqm', 'pricePerSqm', 'constructionStage', 'zone', 'mortgageRate', 'ltvPct', 'downPaymentPct', 'originationFeePct'],
    cashMetrics: [
      'averageFinishedPricePerSqm',
      'futureValue',
      'potentialProfit',
      'appreciationPct',
      'holdMonths'
    ],
    leveragedMetrics: [
      'loanAmount',
      'downPayment',
      'interestCost',
      'originationFee',
      'leveragedProfit',
      'leveragedRoiPct',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate'
    ],
    metricKeys: [
      'appreciationPct',
      'potentialProfit',
      'holdMonths',
      'leveragedRoiPct',
      'leveragedProfit',
      'interestCost'
    ],
    formulas: [
      {
        label: 'Future value',
        formula: 'max(neighborhoodAveragePricePerSqm, pricePerSqm * 1.15) * area',
        detail: 'The app assumes finished value is at least 15% above the current price per sqm when neighborhood data is lower.'
      },
      {
        label: 'Potential profit',
        formula: 'futureValue - price',
        detail: 'Cash-only upside before financing costs.'
      },
      {
        label: 'Leveraged ROI',
        formula: '(potentialProfit - interestCost - originationFee) / downPayment * 100',
        detail: 'Debt amplifies the return by comparing profit with cash down instead of full price.'
      }
    ],
    cashScore: 'Potential profit.',
    leveragedScore: 'Leveraged ROI.',
    caveats: [
      'Hold months are 18 for act 14, 8 for act 15, and 6 for other stages.',
      'The strategy uses a simplified future value estimate and does not model construction delays or closing risk.',
      'DSCR and break-even values are placeholders for health compatibility on this non-rental strategy.'
    ]
  },
  brrrr: {
    id: 'brrrr',
    summary:
      'Screens for buy, rehab, rent, refinance, repeat deals where refinance proceeds can recover a meaningful part of total investment.',
    inputs: ['price', 'areaSqm', 'zone', 'targetGrossYieldPct', 'vacancyPct', 'managementFeePct', 'ltvPct', 'mortgageRate', 'loanTermYears'],
    cashMetrics: [
      'purchasePrice',
      'rehabCost',
      'totalInvestment',
      'arv',
      'monthlyRent',
      'grossYieldPct',
      'netYieldPct'
    ],
    leveragedMetrics: [
      'loanAmount',
      'downPayment',
      'monthlyPayment',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate',
      'rateSensitivity',
      'refinanceLoan',
      'cashLeftInDeal',
      'refinanceCoveragePct'
    ],
    metricKeys: ['arv', 'netYieldPct', 'monthlyRent', 'monthlyCashFlow', 'cocPct', 'dscr'],
    formulas: [
      {
        label: 'Rehab cost',
        formula: 'area * 300',
        detail: 'The current model uses a fixed EUR 300 per sqm rehab assumption.'
      },
      {
        label: 'ARV',
        formula: 'max(neighborhoodAveragePricePerSqm * area, price * 1.15)',
        detail: 'After-repair value is the greater of neighborhood value and a 15% uplift over price.'
      },
      {
        label: 'Cash left in deal',
        formula: 'max(totalInvestment - refinanceLoan, 0)',
        detail: 'If refinance proceeds cover the full investment, cash left in the deal bottoms out at zero.'
      }
    ],
    cashScore: 'Net yield on total investment.',
    leveragedScore: 'Monthly cash flow.',
    caveats: [
      'Rehab cost is a simple area-based estimate.',
      'Rent is estimated from ARV using the global target gross yield setting.',
      'Refinance terms are modeled from the global LTV setting.'
    ]
  },
  flip: {
    id: 'flip',
    summary:
      'Estimates fix-and-flip upside from resale value, renovation cost, transaction costs, and optional financing carry.',
    inputs: ['price', 'areaSqm', 'zone', 'mortgageRate', 'ltvPct', 'downPaymentPct', 'originationFeePct'],
    cashMetrics: ['purchasePrice', 'rehabCost', 'arv', 'transactionCosts', 'profit', 'roiPct', 'annualizedRoiPct'],
    leveragedMetrics: [
      'loanAmount',
      'cashDeployed',
      'downPayment',
      'interestCost',
      'originationFee',
      'leveragedProfit',
      'leveragedRoiPct',
      'leveragedAnnualizedRoiPct',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate'
    ],
    metricKeys: ['profit', 'roiPct', 'annualizedRoiPct', 'leveragedProfit', 'leveragedRoiPct', 'interestCost'],
    formulas: [
      {
        label: 'Rehab cost',
        formula: 'area * 300',
        detail: 'The current model uses a fixed EUR 300 per sqm rehab assumption.'
      },
      {
        label: 'Profit',
        formula: 'arv - price - rehabCost - transactionCosts',
        detail: 'Cash profit after estimated renovation and transaction costs.'
      },
      {
        label: 'Annualized ROI',
        formula: 'roiPct * 2',
        detail: 'The current flip model assumes a six-month timeline, so total ROI is doubled.'
      }
    ],
    cashScore: 'Cash ROI.',
    leveragedScore: 'Leveraged ROI.',
    caveats: [
      'ARV uses the greater of neighborhood value and a 12% uplift over current price.',
      'Transaction costs are modeled as 3% of price.',
      'The model does not include taxes, contractor delays, or selling time variability.'
    ]
  },
  'cash-flow': {
    id: 'cash-flow',
    summary:
      'Ranks traditional long-term rentals by estimated net yield or leveraged cash-on-cash return.',
    inputs: ['price', 'targetGrossYieldPct', 'vacancyPct', 'managementFeePct', 'mortgageRate', 'loanTermYears', 'annualInsuranceEur'],
    cashMetrics: ['monthlyRent', 'monthlyNOI', 'grossYieldPct', 'netYieldPct', 'capRatePct', 'paybackYears'],
    leveragedMetrics: [
      'loanAmount',
      'downPayment',
      'originationFee',
      'monthlyPayment',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate',
      'rateSensitivity',
      'leveragedPaybackYears'
    ],
    metricKeys: ['monthlyRent', 'netYieldPct', 'paybackYears', 'monthlyCashFlow', 'cocPct', 'breakEvenRate'],
    formulas: [
      {
        label: 'Gross yield',
        formula: 'monthlyRent * 12 / price * 100',
        detail: 'Annual rent before vacancy and management assumptions divided by purchase price.'
      },
      {
        label: 'Net yield',
        formula: 'monthlyNOI * 12 / price * 100',
        detail: 'Annual NOI divided by purchase price. Cap rate currently uses the same value.'
      },
      {
        label: 'Payback years',
        formula: '100 / netYieldPct',
        detail: 'Only shown when net yield is positive.'
      }
    ],
    cashScore: 'Net yield.',
    leveragedScore: 'Cash-on-cash return.',
    caveats: [
      'Rent is estimated from the configured target gross yield, not from a matched rental comp.',
      'NOI subtracts vacancy and management assumptions only.',
      'Insurance is subtracted after NOI in leveraged cash flow.'
    ]
  },
  airbnb: {
    id: 'airbnb',
    summary:
      'Compares short-term rental income potential against traditional long-term rental assumptions.',
    inputs: ['price', 'dailyRateEur', 'occupancyPct', 'operatingExpensePct', 'targetGrossYieldPct', 'mortgageRate', 'loanTermYears'],
    cashMetrics: [
      'monthlyRevenue',
      'operatingExpenses',
      'monthlyNOI',
      'netYieldPct',
      'longTermMonthlyNOI',
      'longTermComparison'
    ],
    leveragedMetrics: [
      'loanAmount',
      'downPayment',
      'originationFee',
      'monthlyPayment',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate',
      'rateSensitivity',
      'leveragedPaybackYears',
      'longTermMonthlyCashFlow'
    ],
    metricKeys: ['monthlyRevenue', 'netYieldPct', 'longTermComparison', 'monthlyCashFlow', 'cocPct', 'longTermMonthlyCashFlow'],
    formulas: [
      {
        label: 'Monthly revenue',
        formula: 'dailyRateEur * 30 * occupancyPct / 100',
        detail: 'Gross short-term rental revenue from daily rate, 30 days, and occupancy.'
      },
      {
        label: 'Operating expenses',
        formula: 'monthlyRevenue * operatingExpensePct / 100',
        detail: 'Short-term rental operating cost reserve.'
      },
      {
        label: 'Long-term comparison',
        formula: 'airbnbNOI / longTermNOI',
        detail: 'Compares Airbnb NOI against the traditional rental NOI estimate.'
      }
    ],
    cashScore: 'Airbnb net yield.',
    leveragedScore: 'Cash-on-cash return.',
    caveats: [
      'Revenue uses a 30-day month.',
      'The model does not include seasonality, licensing limits, platform fees, or cleaning fee treatment.',
      'Long-term comparison uses the same global rental assumptions as Cash Flow Rental.'
    ]
  },
  'below-market': {
    id: 'below-market',
    summary:
      'Finds listings priced below estimated neighborhood market value and highlights instant equity signals.',
    inputs: ['price', 'areaSqm', 'zone', 'firstSeenAt', 'priceHistory', 'ltvPct', 'downPaymentPct'],
    cashMetrics: ['marketValue', 'discountAmount', 'discountPct', 'daysOnMarket', 'priceDrops'],
    leveragedMetrics: [
      'loanAmount',
      'downPayment',
      'monthlyPayment',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate',
      'rateSensitivity',
      'instantEquity',
      'discountAmount',
      'effectiveLtvPct',
      'equityOnCashRatio'
    ],
    metricKeys: ['discountPct', 'discountAmount', 'daysOnMarket', 'instantEquity', 'effectiveLtvPct', 'equityOnCashRatio'],
    formulas: [
      {
        label: 'Market value',
        formula: 'max(neighborhoodAveragePricePerSqm * area, price)',
        detail: 'The model does not let estimated market value fall below current asking price.'
      },
      {
        label: 'Discount',
        formula: '(marketValue - price) / marketValue * 100',
        detail: 'Estimated percentage below market value.'
      },
      {
        label: 'Leveraged score',
        formula: 'discountPct + equityOnCashRatio * 10',
        detail: 'Leverage gives extra ranking weight to discount relative to down payment.'
      }
    ],
    cashScore: 'Discount percentage.',
    leveragedScore: 'Discount percentage plus equity-to-cash ratio times 10.',
    caveats: [
      'Market value depends on available neighborhood price per sqm data.',
      'Price drops are counted from recorded price history, so old missing data cannot be recovered.',
      'Instant equity is an estimate, not an appraisal.'
    ]
  }
};

export const strategyGuides = strategyList.map((strategy) => ({
  ...strategyGuideById[strategy.id],
  label: strategy.label,
  tone: strategy.tone,
  tableColumns: {
    cash: strategy.cashColumns,
    leveraged: strategy.leveragedColumns
  }
}));

export const metricGlossary = [
  {
    title: 'Core property metrics',
    entries: [
      glossaryEntry('price', 'Asking price used as the base for return and financing calculations.'),
      glossaryEntry('areaSqm', 'Property size in square meters.'),
      glossaryEntry('pricePerSqm', 'Asking price divided by area, used for neighborhood comparisons.'),
      glossaryEntry('marketValue', 'Estimated fair value from neighborhood price per sqm context.'),
      glossaryEntry('daysOnMarket', 'Days since the listing was first seen by the scraper.')
    ]
  },
  {
    title: 'Rental income metrics',
    entries: [
      glossaryEntry('monthlyRent', 'Estimated long-term monthly rent from the target gross yield setting.', 'price * targetGrossYieldPct / 100 / 12'),
      glossaryEntry('noi', 'Net operating income after vacancy and management assumptions.', 'monthlyRent * (1 - expensesPct / 100)'),
      glossaryEntry('grossYieldPct', 'Annual rent divided by purchase price.', 'monthlyRent * 12 / price * 100'),
      glossaryEntry('netYieldPct', 'Annual NOI divided by purchase price.', 'monthlyNOI * 12 / price * 100'),
      glossaryEntry('paybackYears', 'Estimated years for net yield to recover the investment.', '100 / netYieldPct')
    ]
  },
  {
    title: 'Leverage metrics',
    entries: [
      glossaryEntry('loanAmount', 'Estimated borrowed principal.', 'price * ltvPct / 100'),
      glossaryEntry('downPayment', 'Cash paid upfront toward the property purchase.', 'price * downPaymentPct / 100'),
      glossaryEntry('monthlyPayment', 'Fixed amortizing principal-and-interest payment.'),
      glossaryEntry('monthlyCashFlow', 'Income left after operating costs, mortgage payment, and monthly insurance.'),
      glossaryEntry('cocPct', 'Annual cash flow divided by cash invested.', 'monthlyCashFlow * 12 / cashInvested * 100'),
      glossaryEntry('dscr', 'Debt service coverage ratio.', 'monthlyNOI / monthlyDebtService'),
      glossaryEntry('breakEvenRate', 'Mortgage rate where monthly cash flow reaches zero.')
    ]
  },
  {
    title: 'Strategy outcome metrics',
    entries: [
      glossaryEntry('potentialProfit', 'Estimated upside before financing costs.'),
      glossaryEntry('roiPct', 'Profit divided by total investment.'),
      glossaryEntry('annualizedRoiPct', 'ROI adjusted to an annual rate in the flip model.'),
      glossaryEntry('arv', 'After-repair value estimate.'),
      glossaryEntry('discountPct', 'Estimated percentage below market value.'),
      glossaryEntry('equityOnCashRatio', 'Instant equity divided by down payment.'),
      glossaryEntry('longTermComparison', 'Airbnb NOI divided by long-term rental NOI.')
    ]
  }
];

export function findStrategyGuide(id) {
  return strategyGuides.find((guide) => guide.id === id);
}

export function flattenGuideText() {
  return [
    ...systemGuides.flatMap((guide) => [
      guide.id,
      guide.title,
      guide.summary,
      ...guide.formulas.flatMap((formula) => [formula.label, formula.formula, formula.detail])
    ]),
    ...strategyGuides.flatMap((guide) => [
      guide.id,
      guide.label,
      guide.summary,
      guide.cashScore,
      guide.leveragedScore,
      ...guide.inputs,
      ...guide.cashMetrics,
      ...guide.leveragedMetrics,
      ...guide.metricKeys,
      ...guide.caveats,
      ...guide.formulas.flatMap((formula) => [formula.label, formula.formula, formula.detail])
    ]),
    ...metricGlossary.flatMap((group) => [
      group.title,
      ...group.entries.flatMap((entry) => [entry.key, entry.label, entry.description, entry.formula ?? ''])
    ])
  ].join(' ');
}

function glossaryEntry(key, description, formula = '') {
  return {
    key,
    label: getLabel(key),
    description,
    formula
  };
}
