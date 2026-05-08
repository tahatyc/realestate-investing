export function loanAmount(price, ltvPct) {
  return Number(price) * (Number(ltvPct) / 100);
}

export function downPayment(price, downPaymentPct) {
  return Number(price) * (Number(downPaymentPct) / 100);
}

export function originationFee(amount, originationFeePct) {
  return Number(amount) * (Number(originationFeePct) / 100);
}

export function monthlyPayment(principal, annualRatePct, termYears) {
  const principalValue = Number(principal);
  const months = Number(termYears) * 12;
  const monthlyRate = Number(annualRatePct) / 100 / 12;

  if (principalValue <= 0 || months <= 0) {
    return 0;
  }
  if (monthlyRate === 0) {
    return principalValue / months;
  }

  return (
    (principalValue * monthlyRate * (1 + monthlyRate) ** months) /
    ((1 + monthlyRate) ** months - 1)
  );
}

export function interestOnlyPayment(principal, annualRatePct) {
  return (Number(principal) * (Number(annualRatePct) / 100)) / 12;
}

export function dscr(monthlyNetOperatingIncome, monthlyDebtService) {
  const debtService = Number(monthlyDebtService);
  if (debtService <= 0) {
    return null;
  }
  return Number(monthlyNetOperatingIncome) / debtService;
}

export function breakEvenRate({
  principal,
  termYears,
  monthlyNetOperatingIncome,
  minRatePct = 0,
  maxRatePct = 20,
  tolerance = 0.0001
}) {
  const targetNoi = Number(monthlyNetOperatingIncome);

  if (targetNoi <= 0) {
    return 0;
  }

  const paymentAtMin = monthlyPayment(principal, minRatePct, termYears);
  if (paymentAtMin > targetNoi) {
    return minRatePct;
  }

  const paymentAtMax = monthlyPayment(principal, maxRatePct, termYears);
  if (paymentAtMax < targetNoi) {
    return maxRatePct;
  }

  let low = minRatePct;
  let high = maxRatePct;

  while (high - low > tolerance) {
    const mid = (low + high) / 2;
    const payment = monthlyPayment(principal, mid, termYears);

    if (payment > targetNoi) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return (low + high) / 2;
}

export function rateSensitivity({
  principal,
  termYears,
  monthlyNetOperatingIncome,
  currentRatePct
}) {
  return [0, 1, 2].map((increasePct) => {
    const ratePct = Number(currentRatePct) + increasePct;
    const payment = monthlyPayment(principal, ratePct, termYears);
    return {
      ratePct,
      monthlyPayment: payment,
      monthlyCashFlow: Number(monthlyNetOperatingIncome) - payment
    };
  });
}
