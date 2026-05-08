export const BGN_PER_EUR = 1.95583;

export function bgnToEur(amountBgn) {
  return Number(amountBgn) / BGN_PER_EUR;
}

export function eurToBgn(amountEur) {
  return Number(amountEur) * BGN_PER_EUR;
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
