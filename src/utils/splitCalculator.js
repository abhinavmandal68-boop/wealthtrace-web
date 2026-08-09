// Takes all expenses in a group and returns simplified debts
// Example output: [{ from: "uid1", to: "uid2", amount: 450 }]

export function calculateBalances(expenses, members) {
  // Step 1: Build a balance map — how much each person has net
  // Positive = they are owed money, Negative = they owe money
  const balance = {};
  members.forEach((uid) => (balance[uid] = 0));

  expenses.forEach((expense) => {
    if (expense.settled) return; // skip settled expenses

    const { amount, paidBy, splitAmong } = expense;
    const splitCount = splitAmong.length;
    if (!splitCount) return;

    const share = amount / splitCount;

    // Person who paid gets credited the full amount
    balance[paidBy] = (balance[paidBy] || 0) + amount;

    // Each person in the split gets debited their share
    splitAmong.forEach((uid) => {
      balance[uid] = (balance[uid] || 0) - share;
    });
  });

  // Step 2: Simplify debts
  // Separate into who is owed (creditors) and who owes (debtors)
  const creditors = []; // people with positive balance
  const debtors = [];   // people with negative balance

  Object.entries(balance).forEach(([uid, amt]) => {
    if (amt > 0.01)  creditors.push({ uid, amt });
    if (amt < -0.01) debtors.push({ uid, amt: -amt }); // store as positive
  });

  // Step 3: Match debtors to creditors (greedy algorithm)
  const transactions = [];

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor   = debtors[i];
    const creditor = creditors[j];

    const settleAmount = Math.min(debtor.amt, creditor.amt);

    transactions.push({
      from:   debtor.uid,
      to:     creditor.uid,
      amount: Math.round(settleAmount * 100) / 100, // round to 2 decimals
    });

    debtor.amt   -= settleAmount;
    creditor.amt -= settleAmount;

    if (debtor.amt < 0.01)   i++;
    if (creditor.amt < 0.01) j++;
  }

  return transactions;
}