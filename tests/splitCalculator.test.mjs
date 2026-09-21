import test from "node:test";
import assert from "node:assert/strict";
import { calculateBalances } from "../src/utils/splitCalculator.js";

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
