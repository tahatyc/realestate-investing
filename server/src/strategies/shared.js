import { breakEvenRate, downPayment, dscr, interestOnlyPayment, loanAmount, monthlyPayment, originationFee, rateSensitivity } from '../utils/mortgage.js';

export function propertyPrice(property) {
  return Number(property.price_eur ?? property.priceEur ?? 0);
}

export function propertyArea(property) {
  return Number(property.area_sqm ?? property.areaSqm ?? 0);
}

export function propertyPayload(property) {
  return {
    id: property.id,
    externalId: property.external_id,
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

export function averagePricePerSqm(property, database) {
  const row = database
    .prepare(
      `SELECT AVG(price_per_sqm) AS value
       FROM properties
       WHERE is_active = 1
         AND zone = @zone
         AND price_per_sqm IS NOT NULL
         AND external_id != @externalId`
    )
    .get({ zone: property.zone, externalId: property.external_id });
  return Number(row?.value || property.price_per_sqm || 0);
}

export function rentalLeveragedMetrics(property, settings, monthlyNetOperatingIncome) {
  const price = propertyPrice(property);
  const leverage = settings.leverage;
  const principal = loanAmount(price, leverage.ltvPct);
  const cashDown = downPayment(price, leverage.downPaymentPct);
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
    originationFee: originationFee(principal, leverage.originationFeePct),
    monthlyPayment: payment,
    monthlyCashFlow: cashFlow,
    cocPct: cashDown > 0 ? (cashFlow * 12 / cashDown) * 100 : null,
    dscr: dscr(monthlyNetOperatingIncome, payment),
    breakEvenRate: breakEven,
    rateSensitivity: rateSensitivity({
      principal,
      termYears: leverage.loanTermYears,
      monthlyNetOperatingIncome: Number(monthlyNetOperatingIncome) - insuranceMonthly,
      currentRatePct: leverage.mortgageRate
    }),
    leveragedPaybackYears: cashFlow > 0 && cashDown > 0 ? cashDown / (cashFlow * 12) : null
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
