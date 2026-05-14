export function isStrategyApplicable(result) {
  return result?.applicable !== false;
}

export function strategyNotApplicableMessage(strategyId) {
  if (strategyId === 'buy-in-green') {
    return 'Not applicable: this listing is not explicitly pre-construction before Act 14.';
  }
  return 'Not applicable for this listing.';
}
