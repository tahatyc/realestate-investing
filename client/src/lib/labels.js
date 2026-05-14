const acronyms = new Map([
  ['arv', 'ARV'],
  ['coc', 'CoC'],
  ['dscr', 'DSCR'],
  ['ltv', 'LTV'],
  ['noi', 'NOI'],
  ['roi', 'ROI'],
  ['sqm', 'sqm'],
  ['pct', 'pct'],
  ['eur', 'EUR']
]);

export const labelMetadata = {
  activeListings: {
    label: 'Active listings',
    description: 'Listings currently available in the dataset. Useful for judging market coverage.'
  },
  activeSaleListings: {
    label: 'Sale listings',
    description: 'Active purchase listings from the latest stored imot.bg sale data.'
  },
  activeRentalComps: {
    label: 'Rental comps',
    description: 'Active rental listings used as market rent comps when enough similar records exist.'
  },
  annualInsuranceEur: {
    label: 'Annual insurance',
    description: 'Estimated yearly insurance cost used in leveraged cash flow calculations.'
  },
  annualizedRoiPct: {
    label: 'Annualized ROI',
    description: 'Projected return adjusted to a yearly rate. Useful for comparing deals with different hold periods.'
  },
  appreciationPct: {
    label: 'Appreciation',
    description: 'Expected price growth over the hold period. Useful for judging upside from market movement.'
  },
  area: {
    label: 'Area',
    description: 'Property size in square meters. Useful for comparing price efficiency.'
  },
  areaSqm: {
    label: 'Area',
    description: 'Property size in square meters. Useful for comparing price efficiency.'
  },
  arv: {
    label: 'ARV',
    description: 'After-repair value estimate. Useful for judging refinance or resale potential after improvements.'
  },
  breakEvenRate: {
    label: 'Break-even rate',
    description: 'Mortgage rate where monthly cash flow reaches zero. Useful for interest-rate risk checks.'
  },
  breakeven: {
    label: 'Break-even rate',
    description: 'Mortgage rate where monthly cash flow reaches zero. Useful for interest-rate risk checks.'
  },
  cashDeployed: {
    label: 'Cash deployed',
    description: 'Cash put into the deal before exit. Useful for calculating leveraged flip returns.'
  },
  cashFlow: {
    label: 'Cash flow',
    description: 'Monthly income left after operating costs and debt service. Useful for checking if the deal pays for itself.'
  },
  cashInvested: {
    label: 'Cash invested',
    description: 'Upfront cash in the deal, including down payment and transaction costs. Useful for leveraged return calculations.'
  },
  rentSource: {
    label: 'Rent source',
    description: 'Shows whether rent-sensitive metrics use neighborhood comps, zone comps, or the target-yield fallback.'
  },
  cashLeftInDeal: {
    label: 'Cash left in deal',
    description: 'Cash still tied up after refinance. Useful for judging BRRRR capital recycling.'
  },
  coc: {
    label: 'Cash-on-cash return',
    description: 'Annual cash flow divided by cash invested. Useful for comparing leveraged deals.'
  },
  cocGreenPct: {
    label: 'CoC green threshold',
    description: 'Minimum cash-on-cash return for a green health rating.'
  },
  cocPct: {
    label: 'Cash-on-cash return',
    description: 'Annual cash flow divided by cash invested. Useful for comparing leveraged deals.'
  },
  cocYellowPct: {
    label: 'CoC yellow threshold',
    description: 'Minimum cash-on-cash return for a yellow health rating.'
  },
  condition: {
    label: 'Condition',
    description: 'Detected property condition from the listing. Useful for estimating work needed before renting or reselling.'
  },
  dailyRateEur: {
    label: 'Daily rate',
    description: 'Expected nightly Airbnb price. Useful for estimating short-term rental revenue.'
  },
  daysOnMarket: {
    label: 'Days on market',
    description: 'How long the listing has been visible. Useful for spotting stale listings and negotiation room.'
  },
  discountAmount: {
    label: 'Discount amount',
    description: 'Estimated euro difference between market value and asking price. Useful for sizing instant upside.'
  },
  discountPct: {
    label: 'Discount',
    description: 'Estimated percentage below market value. Useful for finding underpriced listings.'
  },
  downPayment: {
    label: 'Down payment',
    description: 'Cash paid upfront toward the property purchase. Useful for calculating cash invested.'
  },
  downPaymentPct: {
    label: 'Down payment',
    description: 'Share of the purchase price paid in cash. Useful for calculating loan size and cash invested.'
  },
  dscr: {
    label: 'DSCR',
    description: 'Debt service coverage ratio: operating income divided by debt payments. Useful for loan safety checks.'
  },
  dscrMinimum: {
    label: 'DSCR minimum',
    description: 'Lowest acceptable debt service coverage ratio before a deal is flagged as risky.'
  },
  effectiveLtvPct: {
    label: 'Effective LTV',
    description: 'Loan-to-value after accounting for discount or equity. Useful for judging financing risk.'
  },
  equityOnCashRatio: {
    label: 'Equity-to-cash ratio',
    description: 'Instant equity compared with cash invested. Useful for measuring how much value each cash euro creates.'
  },
  greenCount: {
    label: 'Green',
    description: 'Count of listings that pass the leveraged health checks.'
  },
  health: {
    label: 'Health',
    description: 'Traffic-light rating from cash flow, return, debt coverage, and rate stress checks.'
  },
  healthMode: {
    label: 'Health mode',
    description: 'Shows whether leveraged health checks are active or hidden.'
  },
  INSTANT_EQUITY: {
    label: 'Instant equity',
    description: 'The estimated below market discount is larger than the down payment.'
  },
  LOW_DSCR: {
    label: 'Low DSCR',
    description: 'Debt service coverage is below the configured safety threshold.'
  },
  NEGATIVE_CASH_FLOW: {
    label: 'Negative cash flow',
    description: 'Monthly income is below expenses and debt service.'
  },
  RATE_SENSITIVE: {
    label: 'Rate sensitive',
    description: 'Cash flow is vulnerable to the configured mortgage rate stress test.'
  },
  REFINANCE_VIABLE: {
    label: 'Refinance viable',
    description: 'Estimated refinance coverage is high enough to recover a meaningful share of capital.'
  },
  STRONG_LEVERAGED_RETURN: {
    label: 'Strong leveraged return',
    description: 'Cash-on-cash return clears the green threshold while cash flow stays positive.'
  },
  holdMonths: {
    label: 'Hold period',
    description: 'Expected months before exit. Useful for annualizing returns and interest costs.'
  },
  instantEquity: {
    label: 'Instant equity',
    description: 'Estimated value gained at purchase from buying below market. Useful for downside protection.'
  },
  interestCost: {
    label: 'Interest cost',
    description: 'Estimated financing interest over the strategy period. Useful for understanding leverage drag.'
  },
  lastScrape: {
    label: 'Last scrape',
    description: 'Most recent scraper run status and date. Useful for judging how fresh the data is.'
  },
  leveragedPaybackYears: {
    label: 'Leveraged payback period',
    description: 'Years needed for leveraged cash flow to recover cash invested. Useful for judging capital recovery with debt.'
  },
  leveragedProfit: {
    label: 'Leveraged profit',
    description: 'Estimated profit after financing costs. Useful for seeing how debt changes the strategy result.'
  },
  leveragedRoiPct: {
    label: 'Leveraged ROI',
    description: 'Return on cash invested when using debt. Useful for comparing financed opportunities.'
  },
  loanAmount: {
    label: 'Loan amount',
    description: 'Estimated borrowed principal. Useful for understanding debt exposure.'
  },
  loanTermYears: {
    label: 'Loan term',
    description: 'Mortgage length in years. Useful for calculating monthly payments.'
  },
  longTermComparison: {
    label: 'Vs long-term rent',
    description: 'Short-term rental result compared with long-term rental income. Useful for choosing rental strategy.'
  },
  longTermMonthlyCashFlow: {
    label: 'Long-term cash flow',
    description: 'Estimated monthly cash flow using long-term rent. Useful as a fallback comparison for Airbnb deals.'
  },
  longTermMonthlyRent: {
    label: 'Long-term monthly rent',
    description: 'Estimated monthly rent for a traditional lease. Useful for comparing Airbnb against a simpler rental strategy.'
  },
  ltvPct: {
    label: 'LTV',
    description: 'Loan-to-value ratio. Useful for calculating loan size and financing risk.'
  },
  managementFeePct: {
    label: 'Management fee',
    description: 'Share of rent reserved for property management. Useful for net income estimates.'
  },
  marketValue: {
    label: 'Market value',
    description: 'Estimated fair value from neighborhood pricing. Useful for identifying discounts.'
  },
  monthlyCashFlow: {
    label: 'Monthly cash flow',
    description: 'Monthly income left after operating costs and debt service. Useful for checking if the deal pays for itself.'
  },
  monthlyPayment: {
    label: 'Monthly payment',
    description: 'Estimated monthly mortgage payment. Useful for judging debt burden.'
  },
  monthlyRent: {
    label: 'Monthly rent',
    description: 'Estimated long-term monthly rent. Useful for yield and cash flow calculations.'
  },
  monthlyRevenue: {
    label: 'Monthly revenue',
    description: 'Estimated Airbnb gross monthly revenue before expenses. Useful for short-term rental screening.'
  },
  mortgageRate: {
    label: 'Mortgage rate',
    description: 'Annual interest rate used for leveraged calculations and stress checks.'
  },
  netYieldPct: {
    label: 'Net yield',
    description: 'Annual net rental income divided by purchase price. Useful for comparing rental efficiency.'
  },
  noi: {
    label: 'NOI',
    description: 'Net operating income after expected operating costs. Useful for rental return and debt coverage checks.'
  },
  occupancyPct: {
    label: 'Occupancy',
    description: 'Expected share of nights booked for Airbnb. Useful for estimating short-term rental revenue.'
  },
  operatingExpensePct: {
    label: 'Operating expense',
    description: 'Share of Airbnb revenue reserved for operating costs. Useful for net short-term rental income.'
  },
  originationFee: {
    label: 'Origination fee',
    description: 'Estimated loan setup cost in euros. Useful for calculating financing cash needs.'
  },
  originationFeePct: {
    label: 'Origination fee',
    description: 'Loan setup fee as a share of borrowed amount. Useful for calculating upfront financing costs.'
  },
  paybackYears: {
    label: 'Payback period',
    description: 'Years needed for income to recover the investment. Useful for comparing capital recovery speed.'
  },
  potentialProfit: {
    label: 'Potential profit',
    description: 'Estimated euro upside after the strategy assumptions. Useful for sizing the opportunity.'
  },
  price: {
    label: 'Price',
    description: 'Listing asking price. Useful as the base for all return and financing calculations.'
  },
  priceEur: {
    label: 'Price',
    description: 'Listing asking price. Useful as the base for all return and financing calculations.'
  },
  pricePerSqm: {
    label: 'Price per sqm',
    description: 'Asking price divided by area. Useful for comparing listings across neighborhoods and sizes.'
  },
  profit: {
    label: 'Profit',
    description: 'Estimated euro gain after costs. Useful for understanding total upside.'
  },
  property: {
    label: 'Property',
    description: 'Listing title and location. Useful for identifying the deal.'
  },
  purchasePrice: {
    label: 'Purchase price',
    description: 'Assumed acquisition price used by the strategy. Useful as the baseline for returns and costs.'
  },
  rateSensitivity: {
    label: 'Rate sensitivity',
    description: 'Cash flow at different mortgage rates. Useful for judging interest-rate risk.'
  },
  rateStressPct: {
    label: 'Rate stress',
    description: 'Interest-rate buffer added during health checks. Useful for testing whether a deal survives rate increases.'
  },
  redCount: {
    label: 'Red',
    description: 'Count of listings that fail leveraged health checks.'
  },
  refinanceLoan: {
    label: 'Refinance loan',
    description: 'Expected loan amount after refinance. Useful for BRRRR cash recovery estimates.'
  },
  rehabCost: {
    label: 'Rehab cost',
    description: 'Estimated renovation budget. Useful for judging total investment and resale upside.'
  },
  rehabCostPerSqm: {
    label: 'Rehab cost per sqm',
    description: 'Renovation budget multiplier per square meter. Useful for tuning rehab-heavy strategy estimates.'
  },
  results: {
    label: 'Results',
    description: 'Number of listings matching the current strategy and filters.'
  },
  roiPct: {
    label: 'ROI',
    description: 'Return on investment before annualization. Useful for comparing total return against cash required.'
  },
  score: {
    label: 'Score',
    description: 'Strategy ranking score. Useful for sorting the strongest matches first.'
  },
  targetGrossYieldPct: {
    label: 'Target gross yield',
    description: 'Desired rent before expenses as a share of price. Useful for quick rental screening.'
  },
  targetNetYieldPct: {
    label: 'Target net yield',
    description: 'Desired rent after expenses as a share of price. Useful for judging real rental performance.'
  },
  totalInvestment: {
    label: 'Total investment',
    description: 'Purchase price plus strategy costs. Useful for calculating total return.'
  },
  transactionCosts: {
    label: 'Transaction costs',
    description: 'Estimated buyer-side notary and local transaction costs. Useful for keeping Bulgarian purchase costs in every strategy.'
  },
  transactionCostPct: {
    label: 'Transaction costs',
    description: 'Buyer-side notary and local transaction costs as a share of purchase price. Sofia defaults to 3%.'
  },
  vacancyPct: {
    label: 'Vacancy',
    description: 'Expected share of time without rent. Useful for conservative net income estimates.'
  },
  yellowCount: {
    label: 'Yellow',
    description: 'Count of listings with acceptable but weaker leveraged health checks.'
  }
};

export function humanizeKey(key) {
  if (key == null || key === '') return 'Unknown';

  const spaced = String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();

  if (!spaced) return 'Unknown';

  const words = spaced.split(/\s+/).map((word) => acronyms.get(word) ?? word);
  const first = words[0];
  const capitalizedFirst = acronyms.has(String(first).toLowerCase())
    ? first
    : `${first.charAt(0).toUpperCase()}${first.slice(1)}`;

  return [capitalizedFirst, ...words.slice(1)].join(' ');
}

export function getLabelMeta(key) {
  const metadata = labelMetadata[key];
  if (metadata) {
    return {
      key,
      label: metadata.label,
      description: metadata.description ?? ''
    };
  }

  return {
    key,
    label: humanizeKey(key),
    description: ''
  };
}

export function getLabel(key) {
  return getLabelMeta(key).label;
}
