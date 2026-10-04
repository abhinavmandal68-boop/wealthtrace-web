import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { joinGroup } from "../src/utils/groupMembership.js";
import { calculateBalances } from "../src/utils/splitCalculator.js";
import { editGroupExpense } from "../src/utils/groupExpenseEditor.js";

let environment;
const projectId = "demo-wealthtrace";

const transaction = (userId, extra = {}) => ({
  userId,
  amount: 100,
  type: "expense",
  category: "Food",
  desc: "Dinner",
  createdAt: Timestamp.now(),
  bankDate: "2026-09-21",
  ...extra,
});

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

beforeEach(async () => environment.clearFirestore());
after(async () => environment.cleanup());

test("owners can create and read their transactions", async () => {
  const db = environment.authenticatedContext("user-a").firestore();
  const ref = doc(db, "transactions", "tx-1");
  await assertSucceeds(setDoc(ref, transaction("user-a")));
  await assertSucceeds(getDoc(ref));
});

test("users cannot read another user's transactions", async () => {
  await environment.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), "transactions", "tx-1"), transaction("user-a")));
  const userB = environment.authenticatedContext("user-b").firestore();
  await assertFails(getDoc(doc(userB, "transactions", "tx-1")));
  await assertFails(getDocs(collection(userB, "transactions")));
});

test("owners cannot transfer transaction ownership during an update", async () => {
  const createdAt = Timestamp.now();
  await environment.withSecurityRulesDisabled((context) => setDoc(
    doc(context.firestore(), "transactions", "tx-1"),
    transaction("user-a", { createdAt })
  ));
  const ownerDb = environment.authenticatedContext("user-a").firestore();
  await assertFails(setDoc(doc(ownerDb, "transactions", "tx-1"), transaction("user-b", { createdAt })));
});

test("unauthenticated reads and schema pollution are denied", async () => {
  const publicDb = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(publicDb, "transactions", "tx-1")));
  const ownerDb = environment.authenticatedContext("user-a").firestore();
  await assertFails(setDoc(doc(ownerDb, "transactions", "tx-2"), transaction("user-a", { extraData: "nope" })));
});

test("a creator can atomically create a group and invite", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  const availableCode = await assertSucceeds(getDoc(doc(db, "inviteCodes", "ABCDEFG")));
  assert.equal(availableCode.exists(), false);
  const batch = writeBatch(db);
  batch.set(doc(db, "groups", "group-1"), {
    name: "Trip",
    createdBy: "owner",
    members: ["owner"],
    memberNames: { owner: "Owner" },
    code: "ABCDEFG",
    currency: "INR",
    createdAt: Timestamp.now(),
  });
  batch.set(doc(db, "inviteCodes", "ABCDEFG"), {
    groupId: "group-1",
    groupName: "Trip",
    createdBy: "owner",
    currency: "INR",
    active: true,
    createdAt: Timestamp.now(),
  });
  await assertSucceeds(batch.commit());
});

test("a known active invite permits only a self-join update", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", "group-1"), {
      name: "Trip", createdBy: "owner", members: ["owner"], memberNames: { owner: "Owner" },
      code: "ABCDEFG", currency: "INR", createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, "inviteCodes", "ABCDEFG"), {
      groupId: "group-1", groupName: "Trip", createdBy: "owner", currency: "INR", active: true, createdAt: Timestamp.now(),
    });
  });

  const memberDb = environment.authenticatedContext("member").firestore();
  await assertSucceeds(setDoc(doc(memberDb, "groups", "group-1"), {
    name: "Trip", createdBy: "owner", members: ["owner", "member"], memberNames: { owner: "Owner", member: "Member" },
    code: "ABCDEFG", currency: "INR", createdAt: (await getDoc(doc(environment.authenticatedContext("owner").firestore(), "groups", "group-1"))).data().createdAt,
  }));
});

test("invite documents cannot be listed and malicious group changes are denied", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", "group-1"), {
      name: "Trip", createdBy: "owner", members: ["owner"], memberNames: { owner: "Owner" }, code: "ABCDEFG", currency: "INR", createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, "inviteCodes", "ABCDEFG"), {
      groupId: "group-1", groupName: "Trip", createdBy: "owner", currency: "INR", active: true, createdAt: Timestamp.now(),
    });
  });
  const db = environment.authenticatedContext("attacker").firestore();
  await assertFails(getDocs(query(collection(db, "inviteCodes"), where("active", "==", true))));
  let original;
  await environment.withSecurityRulesDisabled(async (context) => {
    original = (await getDoc(doc(context.firestore(), "groups", "group-1"))).data();
  });
  await assertFails(setDoc(doc(db, "groups", "group-1"), { ...original, name: "Hijacked", members: ["owner", "attacker"], memberNames: { owner: "Owner", attacker: "Attacker" } }));
});

test("non-members cannot create group expenses", async () => {
  await environment.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), "groups", "group-1"), {
    name: "Trip", createdBy: "owner", members: ["owner"], memberNames: { owner: "Owner" }, code: "ABCDEFG", currency: "INR", createdAt: Timestamp.now(),
  }));
  const db = environment.authenticatedContext("attacker").firestore();
  await assertFails(setDoc(doc(db, "groupExpenses", "expense-1"), {
    groupId: "group-1", description: "Fake", amount: 10, paidBy: "attacker", splitAmong: ["owner"], createdBy: "attacker", createdAt: Timestamp.now(), settled: false,
  }));
});

test("invite availability checks stay private and inactive codes cannot be read", async () => {
  const db = environment.authenticatedContext("owner").firestore();
  const publicDb = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "inviteCodes", "ABCDEFG")));
  await assertFails(getDoc(doc(publicDb, "inviteCodes", "ABCDEFG")));
  await assertFails(getDoc(doc(db, "inviteCodes", "invalid-code")));
  await environment.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), "inviteCodes", "ABCDEFG"), {
    groupId: "group-1", groupName: "Trip", createdBy: "owner", currency: "INR", active: false, createdAt: Timestamp.now(),
  }));
  await assertFails(getDoc(doc(db, "inviteCodes", "ABCDEFG")));
  await assertFails(getDocs(collection(db, "inviteCodes")));
});

test("client self-join, member queries, expenses and settlements work together", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", "group-1"), {
      name: "Trip", createdBy: "owner", members: ["owner"], memberNames: { owner: "Owner" },
      code: "ABCDEFG", currency: "INR", createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, "inviteCodes", "ABCDEFG"), {
      groupId: "group-1", groupName: "Trip", createdBy: "owner", currency: "INR", active: true, createdAt: Timestamp.now(),
    });
  });
  const memberDb = environment.authenticatedContext("member").firestore();
  await assertSucceeds(getDoc(doc(memberDb, "inviteCodes", "ABCDEFG")));
  await assertFails(getDoc(doc(memberDb, "groups", "group-1")));
  await assertSucceeds(updateDoc(doc(memberDb, "groups", "group-1"), {
    members: arrayUnion("member"), "memberNames.member": "Member",
  }));
  await assertSucceeds(getDoc(doc(memberDb, "groups", "group-1")));
  const groups = await assertSucceeds(getDocs(query(collection(memberDb, "groups"), where("members", "array-contains", "member"))));
  assert.equal(groups.size, 1);
  const ownerDb = environment.authenticatedContext("owner").firestore();
  await assertSucceeds(setDoc(doc(ownerDb, "groupExpenses", "dinner"), {
    groupId: "group-1", description: "Dinner", amount: 100, paidBy: "owner", splitAmong: ["owner", "member"],
    createdBy: "owner", createdAt: Timestamp.now(), settled: false,
  }));
  await assertSucceeds(setDoc(doc(memberDb, "groupExpenses", "payment"), {
    groupId: "group-1", description: "Settlement", amount: 50, paidBy: "member", splitAmong: ["owner"],
    createdBy: "member", createdAt: Timestamp.now(), settled: false, type: "settlement", note: "Paid by UPI", proofUrl: "",
  }));
  const expenses = await assertSucceeds(getDocs(query(collection(memberDb, "groupExpenses"), where("groupId", "==", "group-1"))));
  assert.equal(expenses.size, 2);
  assert.deepEqual(calculateBalances(expenses.docs.map((item) => item.data()), ["owner", "member"]), []);
  await assertFails(setDoc(doc(ownerDb, "groupExpenses", "fake-payment"), {
    groupId: "group-1", description: "Settlement", amount: 50, paidBy: "member", splitAmong: ["owner"],
    createdBy: "owner", createdAt: Timestamp.now(), settled: false, type: "settlement",
  }));
});

test("joining again is idempotent without changing the existing profile", async () => {
  await environment.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), "groups", "group-1"), {
    name: "Trip", createdBy: "owner", members: ["owner", "member"], memberNames: { owner: "Owner", member: "Original name" },
    code: "ABCDEFG", currency: "INR", createdAt: Timestamp.now(),
  }));
  const db = environment.authenticatedContext("member").firestore();
  await joinGroup(db, "group-1", { uid: "member", displayName: "New name" });
  const group = (await getDoc(doc(db, "groups", "group-1"))).data();
  assert.deepEqual(group.members, ["owner", "member"]);
  assert.equal(group.memberNames.member, "Original name");
});

test("join helper cannot bypass missing or inactive invitations", async () => {
  await environment.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), "groups", "group-1"), {
    name: "Trip", createdBy: "owner", members: ["owner"], memberNames: { owner: "Owner" },
    code: "ABCDEFG", currency: "INR", createdAt: Timestamp.now(),
  }));
  const db = environment.authenticatedContext("member").firestore();
  await assert.rejects(joinGroup(db, "group-1", { uid: "member", displayName: "Member" }));
  await environment.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), "inviteCodes", "ABCDEFG"), {
    groupId: "group-1", groupName: "Trip", createdBy: "owner", currency: "INR", active: false, createdAt: Timestamp.now(),
  }));
  await assert.rejects(joinGroup(db, "group-1", { uid: "member", displayName: "Member" }));
});

async function seedEditableExpense(extra = {}) {
  const expense = {
    groupId: "group-1", description: "Movie", amount: 90, paidBy: "owner", splitAmong: ["owner", "member"],
    createdBy: "owner", createdAt: Timestamp.now(), settled: false, ...extra,
  };
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", "group-1"), {
      name: "Trip", createdBy: "owner", members: ["owner", "member"], memberNames: { owner: "Owner", member: "Member" },
      code: "ABCDEFG", currency: "INR", createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, "inviteCodes", "ABCDEFG"), {
      groupId: "group-1", groupName: "Trip", createdBy: "owner", currency: "INR", active: true, createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, "groupExpenses", "expense-1"), expense);
  });
  return { id: "expense-1", ...expense };
}

test("a newly joined member can edit an existing bill and include themselves in its split", async () => {
  const original = await seedEditableExpense();
  const db = environment.authenticatedContext("new-member").firestore();
  await joinGroup(db, "group-1", { uid: "new-member", displayName: "New Member" });
  await editGroupExpense(db, original, {
    description: "Movie and snacks", amount: 120, paidBy: "member", splitAmong: ["owner", "member", "new-member"],
  });
  const saved = (await getDoc(doc(db, "groupExpenses", "expense-1"))).data();
  assert.equal(saved.description, "Movie and snacks");
  assert.equal(saved.amount, 120);
  assert.equal(saved.paidBy, "member");
  assert.deepEqual(saved.splitAmong, ["owner", "member", "new-member"]);
  assert.equal(saved.createdBy, "owner");
  assert.ok(saved.createdAt.isEqual(original.createdAt));
  assert.deepEqual(calculateBalances([saved], ["owner", "member", "new-member"]), [
    { from: "owner", to: "member", amount: 40 },
    { from: "new-member", to: "member", amount: 40 },
  ]);
});

test("non-members and anonymous users cannot edit bills", async () => {
  await seedEditableExpense();
  for (const db of [environment.authenticatedContext("outsider").firestore(), environment.unauthenticatedContext().firestore()]) {
    await assertFails(updateDoc(doc(db, "groupExpenses", "expense-1"), { amount: 120 }));
  }
});

test("member edits preserve authorship, group, timestamps and payment state", async () => {
  await seedEditableExpense();
  const db = environment.authenticatedContext("member").firestore();
  const ref = doc(db, "groupExpenses", "expense-1");
  for (const changes of [
    { createdBy: "member" }, { createdAt: Timestamp.fromMillis(1) }, { groupId: "another-group" },
    { settled: true }, { type: "settlement" }, { note: "rewritten" }, { proofUrl: "https://example.com" },
    { extraField: true },
  ]) {
    await assertFails(updateDoc(ref, changes));
  }
});

test("member edits validate amounts, descriptions, payers and split participants", async () => {
  await seedEditableExpense();
  const db = environment.authenticatedContext("member").firestore();
  const ref = doc(db, "groupExpenses", "expense-1");
  for (const changes of [
    { amount: 0 }, { amount: -10 }, { amount: "100" }, { amount: 1000000000001 },
    { description: "" }, { description: "x".repeat(201) }, { paidBy: "outsider" },
    { splitAmong: [] }, { splitAmong: ["outsider"] }, { splitAmong: ["owner", "owner"] },
  ]) {
    await assertFails(updateDoc(ref, changes));
  }
  await assertSucceeds(updateDoc(ref, { description: "Corrected movie", amount: 100 }));
});

test("settlement and legacy settled records cannot be changed through expense editing", async () => {
  for (const extra of [{ type: "settlement" }, { settled: true }]) {
    const original = await seedEditableExpense(extra);
    const db = environment.authenticatedContext("member").firestore();
    await assertFails(updateDoc(doc(db, "groupExpenses", "expense-1"), { amount: 120 }));
    await assert.rejects(editGroupExpense(db, original, { ...original, amount: 120 }), /cannot be edited/);
  }
});

test("an edit does not overwrite a change saved by another member", async () => {
  const original = await seedEditableExpense();
  const db = environment.authenticatedContext("member").firestore();
  await assertSucceeds(updateDoc(doc(db, "groupExpenses", "expense-1"), { amount: 150 }));
  await assert.rejects(editGroupExpense(db, original, { ...original, amount: 120 }), /Someone else edited/);
  assert.equal((await getDoc(doc(db, "groupExpenses", "expense-1"))).data().amount, 150);
});

test("saving an expense deleted during editing does not recreate it", async () => {
  const original = await seedEditableExpense();
  await environment.withSecurityRulesDisabled(async (context) => {
    const batch = writeBatch(context.firestore());
    batch.delete(doc(context.firestore(), "groupExpenses", "expense-1"));
    await batch.commit();
  });
  const db = environment.authenticatedContext("member").firestore();
  // A missing expense cannot be read under the member-scoped rules or rewritten.
  await assert.rejects(editGroupExpense(db, original, { ...original, amount: 120 }));
  await environment.withSecurityRulesDisabled(async (context) => {
    assert.equal((await getDoc(doc(context.firestore(), "groupExpenses", "expense-1"))).exists(), false);
  });
});

test("custom bills can be created and members can switch between equal and custom", async () => {
  const original = await seedEditableExpense();
  const db = environment.authenticatedContext("member").firestore();
  const custom = { ...original, splitMode: "custom", splitAmounts: [3000, 6000] };
  await editGroupExpense(db, original, custom);
  const saved = { id: original.id, ...(await getDoc(doc(db, "groupExpenses", original.id))).data() };
  assert.deepEqual(saved.splitAmounts, [3000, 6000]);
  await editGroupExpense(db, saved, { ...saved, splitMode: "equal", splitAmounts: [] });
  const { id: expenseId, ...customData } = custom;
  await assertSucceeds(setDoc(doc(db, "groupExpenses", `${expenseId}-custom`), { ...customData, createdBy: "member" }));
});

test("malformed custom shares are denied", async () => {
  await seedEditableExpense();
  const db = environment.authenticatedContext("member").firestore();
  const ref = doc(db, "groupExpenses", "expense-1");
  for (const splitAmounts of [[2000, 2000], [-1000, 10000], [3000.5, 5999.5], [9000], ["3000", 6000], ["3000", "6000"], [true, 8999], [null, 9000], [3000, 6000, 0]]) {
    await assertFails(updateDoc(ref, { splitMode: "custom", splitAmounts }));
  }
  await assertFails(updateDoc(ref, { splitMode: "percentage", splitAmounts: [] }));
  await assertFails(updateDoc(ref, { splitMode: "equal", splitAmounts: [3000, 6000] }));
});

test("custom splits work at the full 50-member group limit", async () => {
  const members = Array.from({ length: 50 }, (_, index) => `member-${index}`);
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "groups", "large-group"), {
      name: "Large trip", createdBy: members[0], members,
      memberNames: Object.fromEntries(members.map((uid) => [uid, uid])), code: "ABCDEFG", createdAt: Timestamp.now(),
    });
  });
  const db = environment.authenticatedContext(members[0]).firestore();
  await assertSucceeds(setDoc(doc(db, "groupExpenses", "large-bill"), {
    groupId: "large-group", description: "Dinner", amount: 50, paidBy: members[0], splitAmong: members,
    splitMode: "custom", splitAmounts: members.map(() => 100), createdBy: members[0], createdAt: Timestamp.now(), settled: false,
  }));
  await assertSucceeds(updateDoc(doc(db, "groupExpenses", "large-bill"), {
    amount: 49, splitAmounts: members.map((_, index) => index === 49 ? 0 : 100),
  }));
  await assertFails(updateDoc(doc(db, "groupExpenses", "large-bill"), {
    splitAmounts: members.map((_, index) => index === 49 ? -1 : index === 0 ? 101 : 100),
  }));
});

test("custom splits accept exact cents at the supported amount limit", async () => {
  await seedEditableExpense();
  const db = environment.authenticatedContext("member").firestore();
  await assertSucceeds(updateDoc(doc(db, "groupExpenses", "expense-1"), {
    amount: 1000000000000, splitMode: "custom", splitAmounts: [100000000000000, 0],
  }));
});
