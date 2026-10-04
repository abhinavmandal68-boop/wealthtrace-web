import test from "node:test";
import assert from "node:assert/strict";
import { calculateBalances } from "../src/utils/splitCalculator.js";
import { getExpenseShares, parseShareAmount } from "../src/utils/expenseSplit.js";

test("calculates a basic equal split", () => {
  assert.deepEqual(
    calculateBalances([{ amount: 100, paidBy: "a", splitAmong: ["a", "b"], settled: false }], ["a", "b"]),
    [{ from: "b", to: "a", amount: 50 }]
  );
});

test("simplifies indirect debts", () => {
  assert.deepEqual(
    calculateBalances([
      { amount: 60, paidBy: "a", splitAmong: ["b"], settled: false },
      { amount: 60, paidBy: "b", splitAmong: ["c"], settled: false },
    ], ["a", "b", "c"]),
    [{ from: "c", to: "a", amount: 60 }]
  );
});

test("uses cents without creating rounding drift", () => {
  const result = calculateBalances([{ amount: 10, paidBy: "a", splitAmong: ["a", "b", "c"] }], ["a", "b", "c"]);
  assert.equal(result.reduce((sum, item) => sum + item.amount, 0), 6.66);
});

test("ignores malformed and settled expenses", () => {
  assert.deepEqual(calculateBalances([
    { amount: 20, paidBy: "a", splitAmong: [], settled: false },
    { amount: 20, paidBy: "a", splitAmong: ["b"], settled: true },
  ], ["a", "b"]), []);
});

test("a persisted settlement clears a balance and removing it restores the debt", () => {
  const dinner = { amount: 100, paidBy: "a", splitAmong: ["a", "b"], settled: false };
  const settlement = { amount: 50, paidBy: "b", splitAmong: ["a"], type: "settlement", settled: false };
  assert.deepEqual(calculateBalances([dinner, settlement], ["a", "b"]), []);
  assert.deepEqual(calculateBalances([dinner], ["a", "b"]), [{ from: "b", to: "a", amount: 50 }]);
});

test("partial settlements reduce the outstanding debt", () => {
  assert.deepEqual(calculateBalances([
    { amount: 100, paidBy: "a", splitAmong: ["a", "b"] },
    { amount: 20, paidBy: "b", splitAmong: ["a"], type: "settlement" },
  ], ["a", "b"]), [{ from: "b", to: "a", amount: 30 }]);
});

test("multi-member rounded balances all clear after the suggested payments", () => {
  const expenses = [{ amount: 10, paidBy: "a", splitAmong: ["a", "b", "c"] }];
  const payments = calculateBalances(expenses, ["a", "b", "c"]);
  const settlements = payments.map(({ from, to, amount }) => ({ amount, paidBy: from, splitAmong: [to], type: "settlement" }));
  assert.deepEqual(calculateBalances([...expenses, ...settlements], ["a", "b", "c"]), []);
});

test("custom shares determine each member's debt", () => {
  const bill = { amount: 100, paidBy: "a", splitAmong: ["a", "b", "c"], splitMode: "custom", splitAmounts: [1000, 3000, 6000] };
  assert.deepEqual(calculateBalances([bill], ["a", "b", "c"]), [
    { from: "b", to: "a", amount: 30 }, { from: "c", to: "a", amount: 60 },
  ]);
  assert.deepEqual(calculateBalances([bill,
    { amount: 30, paidBy: "b", splitAmong: ["a"], type: "settlement" },
    { amount: 60, paidBy: "c", splitAmong: ["a"], type: "settlement" },
  ], ["a", "b", "c"]), []);
});

test("invalid custom splits do not corrupt balances", () => {
  for (const shares of [[1000, 1000], [-1000, 11000], [5000.5, 4999.5], [10000], ["5000", 5000]]) {
    assert.deepEqual(calculateBalances([{ amount: 100, paidBy: "a", splitAmong: ["a", "b"], splitMode: "custom", splitAmounts: shares }], ["a", "b"]), []);
  }
});

test("custom splits support zero shares and exact cents", () => {
  assert.deepEqual(getExpenseShares({ amount: 10.01, splitAmong: ["a", "b", "c"], splitMode: "custom", splitAmounts: [0, 333, 668] }), [0, 333, 668]);
  assert.equal(parseShareAmount("3.33"), 333);
  assert.equal(parseShareAmount("0"), 0);
  for (const value of ["", "-1", "1.001", "invalid"]) assert.ok(Number.isNaN(parseShareAmount(value)));
});
