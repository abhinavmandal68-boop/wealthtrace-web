import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection, addDoc, query, where,
  onSnapshot, serverTimestamp, doc, deleteDoc,
  getDocs, getDoc, updateDoc, arrayUnion,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Copy, Check, ArrowLeft, Trash2, Hash } from "lucide-react";

const glassCard = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "24px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)",
};

// ── Generate a 7-digit alphanumeric code ──
const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 7; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

export default function GroupsList() {
  const user = auth.currentUser;
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // ── Listen to groups ──
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "groups"),
      where("members", "array-contains", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  // ── Create group with a unique code ──
  const createGroup = async () => {
    if (!groupName.trim()) return;
    setCreating(true);
    try {
      const code = generateCode();
      const docRef = await addDoc(collection(db, "groups"), {
        name: groupName.trim(),
        createdBy: user.uid,
        members: [user.uid],
        memberNames: { [user.uid]: user.displayName || user.email },
        code,
        createdAt: serverTimestamp(),
      });
      setGroupName("");
      setShowCreate(false);
      navigate(`/groups/${docRef.id}`);
    } catch (e) { console.error(e); }
    setCreating(false);
  };

  // ── Join group by code ──
  const joinGroup = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 7) { setJoinError("Code must be 7 characters"); return; }
    setJoining(true);
    setJoinError("");
    try {
      // Search for group with this code
      const q = query(collection(db, "groups"), where("code", "==", code));
      const snap = await getDocs(q);

      if (snap.empty) {
        setJoinError("No group found with this code");
        setJoining(false);
        return;
      }

      const groupDoc = snap.docs[0];
      const groupData = groupDoc.data();

      // Already a member?
      if (groupData.members?.includes(user.uid)) {
        setJoinCode("");
        setShowJoin(false);
        navigate(`/groups/${groupDoc.id}`);
        return;
      }

      // Add user to members
      await updateDoc(doc(db, "groups", groupDoc.id), {
        members: arrayUnion(user.uid),
        [`memberNames.${user.uid}`]: user.displayName || user.email,
      });

      setJoinCode("");
      setShowJoin(false);
      navigate(`/groups/${groupDoc.id}`);
    } catch (e) {
      console.error(e);
      setJoinError("Something went wrong. Try again.");
    }
    setJoining(false);
  };

  // ── Copy group code ──
  const copyCode = (code, groupId) => {
    navigator.clipboard.writeText(code);
    setCopiedId(groupId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Delete group ──
  const deleteGroupFromList = async (groupId, groupName) => {
    if (!window.confirm(`Delete "${groupName}"? This will remove the group and ALL its expenses permanently.`)) return;
    try {
      const expensesSnap = await getDocs(
        query(collection(db, "groupExpenses"), where("groupId", "==", groupId))
      );
      await Promise.all(expensesSnap.docs.map(d => deleteDoc(doc(db, "groupExpenses", d.id))));
      await deleteDoc(doc(db, "groups", groupId));
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      fontFamily: "'Outfit', sans-serif",
      padding: "24px 16px",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>

      <div className="mobile-content groups-content" style={{ maxWidth: "480px", margin: "0 auto" }}>

        {/* Header */}
        <div className="groups-header responsive-toolbar" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
          <button
            onClick={() => navigate("/")}
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ color: "white", fontSize: "22px", fontWeight: "700", margin: 0 }}>Groups</h1>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", margin: 0 }}>Split expenses with friends</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); }}
            style={{ marginLeft: "auto", background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(96,165,250,0.3))", border: "1px solid rgba(167,139,250,0.4)", borderRadius: "12px", padding: "8px 16px", color: "white", fontFamily: "'Outfit',sans-serif", fontSize: "14px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={16} /> New
          </button>
        </div>

        {/* Create Group Panel */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              style={{ ...glassCard, padding: "24px", marginBottom: "20px" }}
            >
              <p style={{ color: "white", fontWeight: "600", fontSize: "16px", marginBottom: "16px" }}>
                Create a new group
              </p>
              <input
                type="text"
                placeholder="Group name (e.g. Goa Trip)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createGroup()}
                style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "white", fontFamily: "'Outfit',sans-serif", fontSize: "15px", outline: "none", boxSizing: "border-box", marginBottom: "12px" }}
              />
              <div className="form-actions" style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={createGroup}
                  disabled={creating || !groupName.trim()}
                  style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg, rgba(167,139,250,0.4), rgba(96,165,250,0.4))", border: "1px solid rgba(167,139,250,0.4)", borderRadius: "12px", color: "white", fontFamily: "'Outfit',sans-serif", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
                >
                  {creating ? "Creating..." : "Create Group"}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setGroupName(""); }}
                  style={{ padding: "12px 20px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "12px", color: "rgba(255,255,255,0.5)", fontFamily: "'Outfit',sans-serif", fontSize: "14px", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Join Group Panel */}
        <AnimatePresence>
          {showJoin && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              style={{ ...glassCard, padding: "24px", marginBottom: "20px", border: "1px solid rgba(96,165,250,0.2)" }}
            >
              <p style={{ color: "white", fontWeight: "600", fontSize: "16px", marginBottom: "6px" }}>
                Join a group
              </p>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", marginBottom: "16px" }}>
                Enter the 7-digit code shared by your friend
              </p>
              <input
                type="text"
                placeholder="e.g. GOA4821"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(""); }}
                onKeyDown={(e) => e.key === "Enter" && joinGroup()}
                maxLength={7}
                style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.08)", border: joinError ? "1px solid rgba(248,113,113,0.5)" : "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "white", fontFamily: "'Outfit',sans-serif", fontSize: "18px", fontWeight: "700", letterSpacing: "0.15em", outline: "none", boxSizing: "border-box", marginBottom: "8px", textTransform: "uppercase" }}
              />
              {joinError && (
                <p style={{ color: "#f87171", fontSize: "13px", marginBottom: "12px" }}>{joinError}</p>
              )}
              {!joinError && <div style={{ marginBottom: "12px" }} />}
              <div className="form-actions" style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={joinGroup}
                  disabled={joining || joinCode.length !== 7}
                  style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg, rgba(96,165,250,0.3), rgba(52,211,153,0.3))", border: "1px solid rgba(96,165,250,0.4)", borderRadius: "12px", color: "white", fontFamily: "'Outfit',sans-serif", fontSize: "14px", fontWeight: "600", cursor: "pointer", opacity: joinCode.length !== 7 ? 0.5 : 1 }}
                >
                  {joining ? "Joining..." : "Join Group"}
                </button>
                <button
                  onClick={() => { setShowJoin(false); setJoinCode(""); setJoinError(""); }}
                  style={{ padding: "12px 20px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "12px", color: "rgba(255,255,255,0.5)", fontFamily: "'Outfit',sans-serif", fontSize: "14px", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Groups List */}
        {groups.length === 0 && !showCreate && !showJoin ? (
          <div style={{ ...glassCard, padding: "48px 24px", textAlign: "center" }}>
            <Users size={40} color="rgba(167,139,250,0.4)" style={{ marginBottom: "16px" }} />
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "15px", fontWeight: "500", marginBottom: "8px" }}>No groups yet</p>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "13px", marginBottom: "24px" }}>Create one or join with a code</p>
            <button
              onClick={() => { setShowJoin(true); setShowCreate(false); }}
              style={{ padding: "10px 24px", background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: "12px", color: "rgba(96,165,250,0.9)", fontFamily: "'Outfit',sans-serif", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
            >
              Join with a code
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {groups.map((group) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ ...glassCard, padding: "20px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: "16px" }}
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  {/* Group icon */}
                  <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(96,165,250,0.3))", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "18px" }}>
                    👥
                  </div>

                  {/* Group info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "white", fontWeight: "600", fontSize: "15px", margin: 0, marginBottom: "2px" }}>
                      {group.name}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", margin: 0 }}>
                        {group.members?.length || 1} member{group.members?.length !== 1 ? "s" : ""}
                      </p>
                      {group.code && (
                        <span style={{ padding: "2px 8px", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "6px", fontSize: "11px", color: "rgba(167,139,250,0.8)", fontWeight: "700", letterSpacing: "0.1em" }}>
                          {group.code}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Copy code button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); copyCode(group.code, group.id); }}
                    style={{ background: copiedId === group.id ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)", border: copiedId === group.id ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.10)", borderRadius: "10px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: copiedId === group.id ? "#34d399" : "rgba(255,255,255,0.4)", transition: "all 0.2s ease", flexShrink: 0 }}
                    title="Copy group code"
                  >
                    {copiedId === group.id ? <Check size={16} /> : <Hash size={16} />}
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteGroupFromList(group.id, group.name); }}
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(239,68,68,0.6)", transition: "all 0.2s ease", flexShrink: 0 }}
                    title="Delete group"
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; e.currentTarget.style.color = "#f87171"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "rgba(239,68,68,0.6)"; }}
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Join with code button at bottom */}
            {!showJoin && !showCreate && (
              <button
                onClick={() => { setShowJoin(true); setShowCreate(false); }}
                style={{ width: "100%", marginTop: "16px", padding: "14px", background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "16px", color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit',sans-serif", fontSize: "14px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <Hash size={16} /> Join a group with code
              </button>
            )}
          </>
        )}

      </div>
    </div>
  );
}