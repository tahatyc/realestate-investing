import { getDb } from './connection.js';

function booleanFromDb(value) {
  return Boolean(value);
}

function toNested(row) {
  return {
    general: {
      city: row.city,
      currency: row.currency,
      targetGrossYieldPct: row.target_gross_yield_pct,
      targetNetYieldPct: row.target_net_yield_pct,
      rehabCostPerSqm: row.rehab_cost_per_sqm,
      transactionCostPct: row.transaction_cost_pct,
      vacancyPct: row.vacancy_pct,
      managementFeePct: row.management_fee_pct
    },
    airbnb: {
      occupancyPct: row.airbnb_occupancy_pct,
      dailyRateEur: row.airbnb_daily_rate_eur,
      operatingExpensePct: row.airbnb_operating_expense_pct
    },
    leverage: {
      enabled: booleanFromDb(row.leverage_enabled),
      mortgageRate: row.mortgage_rate,
      loanTermYears: row.loan_term_years,
      downPaymentPct: row.down_payment_pct,
      ltvPct: row.ltv_pct,
      originationFeePct: row.origination_fee_pct,
      annualInsuranceEur: row.annual_insurance_eur
    },
    flags: {
      cocGreenPct: row.flag_coc_green_pct,
      cocYellowPct: row.flag_coc_yellow_pct,
      dscrMinimum: row.flag_dscr_minimum,
      rateStressPct: row.flag_rate_stress_pct
    },
    updatedAt: row.updated_at
  };
}

const updateMap = {
  'general.city': 'city',
  'general.currency': 'currency',
  'general.targetGrossYieldPct': 'target_gross_yield_pct',
  'general.targetNetYieldPct': 'target_net_yield_pct',
  'general.rehabCostPerSqm': 'rehab_cost_per_sqm',
  'general.transactionCostPct': 'transaction_cost_pct',
  'general.vacancyPct': 'vacancy_pct',
  'general.managementFeePct': 'management_fee_pct',
  'airbnb.occupancyPct': 'airbnb_occupancy_pct',
  'airbnb.dailyRateEur': 'airbnb_daily_rate_eur',
  'airbnb.operatingExpensePct': 'airbnb_operating_expense_pct',
  'leverage.enabled': 'leverage_enabled',
  'leverage.mortgageRate': 'mortgage_rate',
  'leverage.loanTermYears': 'loan_term_years',
  'leverage.downPaymentPct': 'down_payment_pct',
  'leverage.ltvPct': 'ltv_pct',
  'leverage.originationFeePct': 'origination_fee_pct',
  'leverage.annualInsuranceEur': 'annual_insurance_eur',
  'flags.cocGreenPct': 'flag_coc_green_pct',
  'flags.cocYellowPct': 'flag_coc_yellow_pct',
  'flags.dscrMinimum': 'flag_dscr_minimum',
  'flags.rateStressPct': 'flag_rate_stress_pct'
};

function flattenUpdates(updates) {
  const flat = {};

  for (const [section, values] of Object.entries(updates)) {
    if (!values || typeof values !== 'object') {
      continue;
    }
    for (const [key, value] of Object.entries(values)) {
      flat[`${section}.${key}`] = typeof value === 'boolean' ? Number(value) : value;
    }
  }

  if (flat['leverage.downPaymentPct'] != null && flat['leverage.ltvPct'] == null) {
    flat['leverage.ltvPct'] = 100 - Number(flat['leverage.downPaymentPct']);
  }
  if (flat['leverage.ltvPct'] != null && flat['leverage.downPaymentPct'] == null) {
    flat['leverage.downPaymentPct'] = 100 - Number(flat['leverage.ltvPct']);
  }

  return flat;
}

export function getSettings(database = getDb()) {
  const row = database.prepare('SELECT * FROM settings WHERE id = 1').get();
  return toNested(row);
}

export function updateSettings(updates, database = getDb()) {
  const flat = flattenUpdates(updates);
  const assignments = [];
  const params = {};

  for (const [path, value] of Object.entries(flat)) {
    const column = updateMap[path];
    if (!column) {
      continue;
    }
    assignments.push(`${column} = @${column}`);
    params[column] = value;
  }

  if (!assignments.length) {
    return getSettings(database);
  }

  assignments.push('updated_at = CURRENT_TIMESTAMP');
  database.prepare(`UPDATE settings SET ${assignments.join(', ')} WHERE id = 1`).run(params);
  return getSettings(database);
}
