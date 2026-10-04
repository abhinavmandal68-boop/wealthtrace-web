// Shares are integer cents, ordered to match splitAmong.
export function parseShareAmount(value) {
  if (value === "" || value == null) return NaN;
  const amount = Number(value);
  const cents = Math.round(amount * 100);
  return Number.isFinite(amount) && amount >= 0 && Math.abs(amount * 100 - cents) < 0.0001 ? cents : NaN;
}

export function getExpenseShares(expense) {
  const total = Math.round(Number(expense.amount) * 100);
  const members = expense.splitAmong;
  if (!Number.isSafeInteger(total) || total <= 0 || !Array.isArray(members) || !members.length) return null;
  if (expense.splitMode === "custom") {
    const shares = expense.splitAmounts;
    if (!Array.isArray(shares) || shares.length !== members.length || new Set(members).size !== members.length ||
      shares.some((share) => !Number.isSafeInteger(share) || share < 0) ||
      shares.reduce((sum, share) => sum + share, 0) !== total) return null;
    return [...shares];
  }
  const base = Math.floor(total / members.length);
  const remainder = total % members.length;
  return members.map((_, index) => base + (index < remainder ? 1 : 0));
}
