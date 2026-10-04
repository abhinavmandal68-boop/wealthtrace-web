import { arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";

// A repeated join must succeed without rewriting another member's data.
export async function joinGroup(db, groupId, user) {
  const groupRef = doc(db, "groups", groupId);
  const memberName = (user.displayName || "Member").trim().slice(0, 80) || "Member";
  try {
    await updateDoc(groupRef, {
      members: arrayUnion(user.uid),
      [`memberNames.${user.uid}`]: memberName,
    });
  } catch (error) {
    if (error.code !== "permission-denied") throw error;
    // Existing members cannot self-join again under the security rules.
    // Only a successful member-authorized read can confirm this is a repeat.
    const group = await getDoc(groupRef);
    if (!group.exists() || !group.data().members?.includes(user.uid)) throw error;
  }
}
