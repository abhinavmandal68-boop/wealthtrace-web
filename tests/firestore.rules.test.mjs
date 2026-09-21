import test, { after, before, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

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
