import { breakEvenRate, downPayment, dscr, interestOnlyPayment, loanAmount, monthlyPayment, originationFee, rateSensitivity } from '../utils/mortgage.js';
import { queryAllProperties } from '../db/properties.js';

export function propertyPrice(property) {
  return Number(property.price_eur ?? property.priceEur ?? 0);
}

export function propertyArea(property) {
  return Number(property.area_sqm ?? property.areaSqm ?? 0);
}

export function transactionCosts(property, settings) {
  return propertyPrice(property) * (Number(settings.general?.transactionCostPct ?? 3) / 100);
}

export function propertyPayload(property) {
  return {
    id: property.id,
    externalId: property.external_id,
    listingPurpose: property.listing_purpose,
    category: property.category,
    title: property.title,
    url: property.url,
    neighborhood: property.neighborhood,
    zone: property.zone,
    type: property.type,
    condition: property.condition,
    priceEur: property.price_eur,
    areaSqm: property.area_sqm,
    pricePerSqm: property.price_per_sqm,
    constructionStage: property.construction_stage,
    constructionYear: property.construction_year,
    description: property.description
  };
}

export function estimatedMonthlyRent(property, settings) {
  return propertyPrice(property) * (Number(settings.general.targetGrossYieldPct ?? 6) / 100) / 12;
}

export function monthlyNoi(property, settings, monthlyRent = estimatedMonthlyRent(property, settings)) {
  const vacancy = Number(settings.general.vacancyPct ?? 0);
  const management = Number(settings.general.managementFeePct ?? 0);
  return monthlyRent * (1 - (vacancy + management) / 100);
}

export async function averagePricePerSqm(property) {
  if (!property.zone) {
    return Number(property.price_per_sqm || 0);
  }

  const comps = await queryAllProperties({
    zone: property.zone,
    listingPurpose: 'sale',
    limit: 10000
  });
  const prices = comps
    .filter((comp) => comp.external_id !== property.external_id)
    .filter((comp) => comp.price_per_sqm != null)
    .map((comp) => Number(comp.price_per_sqm))
    .filter(Number.isFinite);

  if (!prices.length) {
    return Number(property.price_per_sqm || 0);
  }

  return prices.reduce((sum, value) => sum + value, 0) / prices.length;
}

export function rentalLeveragedMetrics(property, settings, monthlyNetOperatingIncome, options = {}) {
  const price = propertyPrice(property);
  const leverage = settings.leverage;
  const principal = loanAmount(price, leverage.ltvPct);
  const cashDown = downPayment(price, leverage.downPaymentPct);
  const transaction = options.transactionCosts ?? transactionCosts(property, settings);
  const cashInvested = options.cashInvested ?? cashDown + transaction;
  const payment = monthlyPayment(principal, leverage.mortgageRate, leverage.loanTermYears);
  const insuranceMonthly = Number(leverage.annualInsuranceEur ?? 0) / 12;
  const cashFlow = Number(monthlyNetOperatingIncome) - payment - insuranceMonthly;
  const breakEven = breakEvenRate({
    principal,
    termYears: leverage.loanTermYears,
    monthlyNetOperatingIncome: Number(monthlyNetOperatingIncome) - insuranceMonthly
  });

  return {
    loanAmount: principal,
    downPayment: cashDown,
    transactionCosts: transaction,
    cashInvested,
    originationFee: originationFee(principal, leverage.originationFeePct),
    monthlyPayment: payment,
    monthlyCashFlow: cashFlow,
    cocPct: cashInvested > 0 ? (cashFlow * 12 / cashInvested) * 100 : null,
    dscr: dscr(monthlyNetOperatingIncome, payment),
    breakEvenRate: breakEven,
    rateSensitivity: rateSensitivity({
      principal,
      termYears: leverage.loanTermYears,
      monthlyNetOperatingIncome: Number(monthlyNetOperatingIncome) - insuranceMonthly,
      currentRatePct: leverage.mortgageRate
    }),
    leveragedPaybackYears: cashFlow > 0 && cashInvested > 0 ? cashInvested / (cashFlow * 12) : null
  };
}

export function financingCarryCost(principal, settings, months) {
  return interestOnlyPayment(principal, settings.leverage.mortgageRate) * months;
}

export function baseResult(name, property, cashMetrics, leveragedMetrics, cashScore, leveragedScore, extra = {}) {
  return {
    strategy: name,
    property: propertyPayload(property),
    cashMetrics,
    leveragedMetrics,
    cashScore,
    leveragedScore,
    flags: [],
    ...extra
  };
}
