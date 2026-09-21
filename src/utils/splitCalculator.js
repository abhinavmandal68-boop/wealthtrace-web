// Calculates the minimum set of payments needed to settle a group's open items.
// Integer cents are used throughout so repeated splits do not create rounding drift.
export function calculateBalances(expenses = [], members = []) {
  const balance = {};
  members.forEach((uid) => {
    if (uid) balance[uid] = 0;
  });

  expenses.forEach((expense) => {
    if (!expense || expense.settled) return;

    const amountInCents = Math.round(Number(expense.amount) * 100);
    const paidBy = expense.paidBy;
    const splitAmong = [...new Set(Array.isArray(expense.splitAmong) ? expense.splitAmong : [])]
      .filter(Boolean);

    if (!paidBy || !Number.isFinite(amountInCents) || amountInCents <= 0 || splitAmong.length === 0) {
      return;
    }

    balance[paidBy] = (balance[paidBy] || 0) + amountInCents;

    const baseShare = Math.floor(amountInCents / splitAmong.length);
    const remainder = amountInCents % splitAmong.length;
    splitAmong.forEach((uid, index) => {
      const share = baseShare + (index < remainder ? 1 : 0);
      balance[uid] = (balance[uid] || 0) - share;
    });
  });

  const creditors = [];
  const debtors = [];

  Object.entries(balance).forEach(([uid, amountInCents]) => {
    if (amountInCents > 0) creditors.push({ uid, amountInCents });
    if (amountInCents < 0) debtors.push({ uid, amountInCents: -amountInCents });
  });

  const transactions = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const settlementInCents = Math.min(debtor.amountInCents, creditor.amountInCents);

    transactions.push({
      from: debtor.uid,
      to: creditor.uid,
      amount: settlementInCents / 100,
    });

    debtor.amountInCents -= settlementInCents;
    creditor.amountInCents -= settlementInCents;

    if (debtor.amountInCents === 0) debtorIndex += 1;
    if (creditor.amountInCents === 0) creditorIndex += 1;
  }

  return transactions;
}
