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
