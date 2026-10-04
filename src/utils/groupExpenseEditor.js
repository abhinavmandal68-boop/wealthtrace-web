import { doc, runTransaction } from "firebase/firestore";

const editableFields = ["description", "amount", "paidBy", "splitAmong", "splitMode", "splitAmounts"];
const normalized = (expense) => ({ ...expense, splitMode: expense.splitMode || "equal", splitAmounts: expense.splitAmounts || [] });

export async function editGroupExpense(db, original, changes) {
  const expenseRef = doc(db, "groupExpenses", original.id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(expenseRef);
    if (!snapshot.exists()) throw new Error("This expense was deleted. Close the form and refresh the group.");
    const current = snapshot.data();
    if (current.type === "settlement" || current.settled) {
      throw new Error("This payment record cannot be edited as an expense.");
    }
    const currentValues = normalized(current);
    const originalValues = normalized(original);
    if (editableFields.some((field) => JSON.stringify(currentValues[field]) !== JSON.stringify(originalValues[field]))) {
      throw new Error("Someone else edited this expense. Close the form and reopen it to see their changes.");
    }
    const updatedValues = normalized(changes);
    transaction.update(expenseRef, Object.fromEntries(editableFields.map((field) => [field, updatedValues[field]])));
  });
}
