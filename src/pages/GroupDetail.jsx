import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  doc, getDoc, collection, addDoc, onSnapshot,
  query, where, serverTimestamp, updateDoc, deleteDoc,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Users, Receipt, TrendingDown, X, Check, Trash2 } from "lucide-react";
import { calculateBalances } from "../utils/splitCalculator";

const glassCard = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "24px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)",
};

const labelStyle = {
  color: "rgba(255,255,255,0.45)",
  fontSize: "12px",
  fontWeight: "600",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const inputStyle = {
  width: "100%",
  padding: "12px 16px",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  color: "white",
  fontFamily: "'Outfit',sans-serif",
  fontSize: "15px",
  outline: "none",
  boxSizing: "border-box",
  marginBottom: "20px",
};

export default function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [activeTab, setActiveTab] = useState("expenses");
  const [showAdd, setShowAdd] = useState(false);

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(user?.uid || "");
  const [splitAmong, setSplitAmong] = useState([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      const snap = await getDoc(doc(db, "groups", groupId));
      if (!snap.exists()) { navigate("/groups"); return; }
      const data = { id: snap.id, ...snap.data() };
      setGroup(data);
      setSplitAmong(data.members || []);
    };
    fetchGroup();
  }, [groupId, navigate]);

  useEffect(() => {
    const q = query(
      collection(db, "groupExpenses"),
      where("groupId", "==", groupId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setExpenses(data);
    });
    return () => unsub();
  }, [groupId]);

  useEffect(() => {
    if (!group) return;
    const result = calculateBalances(expenses, group.members || []);
    setBalances(result);
  }, [expenses, group]);

  const addExpense = async () => {
    const val = Number(amount);
    if (!desc.trim() || !val || val <= 0 || splitAmong.length === 0) return;
    setAdding(true);
    try {
      await addDoc(collection(db, "groupExpenses"), {
        groupId,
        description: desc.trim(),
        amount: val,
        paidBy,
        splitAmong,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        settled: false,
      });
      setDesc("");
      setAmount("");
      setSplitAmong(group?.members || []);
      setShowAdd(false);
    } catch (e) { console.error(e); }
    setAdding(false);
  };

  const toggleMember = (uid) => {
    setSplitAmong(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const settleUp = async (expenseIds) => {
    try {
      await Promise.all(
        expenseIds.map(id =>
          updateDoc(doc(db, "groupExpenses", id), { settled: true })
        )
      );
    } catch (e) { console.error(e); }
  };

  // ── Delete single expense ──
  const deleteExpense = async (id) => {
    try {
      await deleteDoc(doc(db, "groupExpenses", id));
    } catch (e) { console.error(e); }
  };

  // ── Clear all expenses ──
  const clearAllExpenses = async () => {
    if (!window.confirm("Clear ALL expenses in this group? This cannot be undone.")) return;
    try {
      await Promise.all(expenses.map(e => deleteDoc(doc(db, "groupExpenses", e.id))));
    } catch (e) { console.error(e); }
  };

  const getName = (uid) => {
    if (!group?.memberNames) return "Unknown";
    if (uid === user?.uid) return "You";
    return group.memberNames[uid] || "Unknown";
  };

  const formatDate = (ts) => {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  if (!group) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit',sans-serif" }}>
          Loading...
        </p>
      </div>
    );
  }

  const totalSpent = expenses
    .filter(e => !e.settled)
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      fontFamily: "'Outfit', sans-serif",
      padding: "24px 16px 120px",
    }}>
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        .del-expense-btn { background: none; border: none; color: rgba(255,255,255,0.15); cursor: pointer; padding: 6px; border-radius: 8px; display: flex; align-items: center; transition: all 0.2s; }
        .del-expense-btn:hover { color: #f87171; background: rgba(248,113,113,0.10); }
        .clear-all-btn { background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.2); color: rgba(239,68,68,0.7); border-radius: 10px; padding: 7px 14px; font-family: 'Outfit',sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .clear-all-btn:hover { background: rgba(239,68,68,0.2); color: #f87171; }`}
      </style>

      <div style={{ maxWidth: "480px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "24px",
        }}>
          <button
            onClick={() => navigate("/groups")}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "12px",
              padding: "8px",
              display: "flex",
              cursor: "pointer",
              color: "white",
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ color: "white", fontSize: "20px", fontWeight: "700", margin: 0 }}>
              {group.name}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", margin: 0 }}>
              {group.members?.length || 1} members · ₹{totalSpent.toLocaleString("en-IN")} total
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(96,165,250,0.3))",
              border: "1px solid rgba(167,139,250,0.4)",
              borderRadius: "12px",
              padding: "8px 16px",
              color: "white",
              fontFamily: "'Outfit',sans-serif",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plus size={16} /> Add
          </button>
        </div>

        {/* Members row */}
        <div style={{
          ...glassCard,
          padding: "16px 20px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}>
          <Users size={16} color="rgba(167,139,250,0.7)" />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {group.members?.map(uid => (
              <span key={uid} style={{
                padding: "4px 12px",
                background: "rgba(167,139,250,0.12)",
                border: "1px solid rgba(167,139,250,0.2)",
                borderRadius: "50px",
                fontSize: "12px",
                color: "rgba(255,255,255,0.7)",
                fontWeight: "500",
              }}>
                {getName(uid)}
              </span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          background: "rgba(255,255,255,0.04)",
          borderRadius: "14px",
          padding: "4px",
        }}>
          {["expenses", "balances"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "10px",
                background: activeTab === tab ? "rgba(167,139,250,0.2)" : "transparent",
                border: activeTab === tab
                  ? "1px solid rgba(167,139,250,0.3)"
                  : "1px solid transparent",
                borderRadius: "10px",
                color: activeTab === tab ? "white" : "rgba(255,255,255,0.4)",
                fontFamily: "'Outfit',sans-serif",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s",
                textTransform: "capitalize",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              {tab === "expenses"
                ? <><Receipt size={14} />Expenses</>
                : <><TrendingDown size={14} />Balances</>
              }
            </button>
          ))}
        </div>

        {/* Expenses Tab */}
        {activeTab === "expenses" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

            {/* Clear all button — only shows when there are expenses */}
            {expenses.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="clear-all-btn" onClick={clearAllExpenses}>
                  <Trash2 size={13} /> Clear all
                </button>
              </div>
            )}

            {expenses.length === 0 ? (
              <div style={{ ...glassCard, padding: "48px 24px", textAlign: "center" }}>
                <Receipt size={36} color="rgba(167,139,250,0.3)" style={{ marginBottom: "12px" }} />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>No expenses yet</p>
                <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>Tap + Add to record one</p>
              </div>
            ) : (
              expenses.map(expense => (
                <motion.div
                  key={expense.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  style={{ ...glassCard, padding: "16px 20px", opacity: expense.settled ? 0.45 : 1 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    {/* Left — description + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "white", fontWeight: "600", fontSize: "15px", margin: 0, marginBottom: "4px" }}>
                        {expense.description}
                        {expense.settled && (
                          <span style={{ marginLeft: "8px", fontSize: "11px", color: "#34d399", fontWeight: "500" }}>
                            Settled
                          </span>
                        )}
                      </p>
                      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", margin: 0 }}>
                        Paid by {getName(expense.paidBy)} · {formatDate(expense.createdAt)}
                      </p>
                      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "11px", margin: "4px 0 0" }}>
                        Split among: {expense.splitAmong?.map(uid => getName(uid)).join(", ")}
                      </p>
                    </div>

                    {/* Right — amount + delete */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, marginLeft: "12px" }}>
                      <p style={{ color: "#a78bfa", fontWeight: "700", fontSize: "16px", margin: 0, whiteSpace: "nowrap" }}>
                        ₹{expense.amount.toLocaleString("en-IN")}
                      </p>
                      <button
                        className="del-expense-btn"
                        onClick={() => deleteExpense(expense.id)}
                        title="Delete expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Balances Tab */}
        {activeTab === "balances" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {balances.length === 0 ? (
              <div style={{ ...glassCard, padding: "48px 24px", textAlign: "center" }}>
                <Check size={36} color="rgba(52,211,153,0.4)" style={{ marginBottom: "12px" }} />
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "15px", fontWeight: "600" }}>
                  All settled up!
                </p>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px" }}>No pending balances</p>
              </div>
            ) : (
              balances.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    ...glassCard,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <p style={{ color: "white", fontWeight: "600", fontSize: "14px", margin: 0, marginBottom: "2px" }}>
                      <span style={{ color: "#f87171" }}>{getName(b.from)}</span>
                      <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 8px" }}>owes</span>
                      <span style={{ color: "#34d399" }}>{getName(b.to)}</span>
                    </p>
                    <p style={{ color: "#a78bfa", fontWeight: "700", fontSize: "18px", margin: 0 }}>
                      ₹{b.amount.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <button
                    onClick={() => settleUp(
                      expenses
                        .filter(e => !e.settled && e.splitAmong?.includes(b.from) && e.paidBy === b.to)
                        .map(e => e.id)
                    )}
                    style={{
                      padding: "8px 16px",
                      background: "rgba(52,211,153,0.12)",
                      border: "1px solid rgba(52,211,153,0.3)",
                      borderRadius: "10px",
                      color: "#34d399",
                      fontFamily: "'Outfit',sans-serif",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Settle up
                  </button>
                </motion.div>
              ))
            )}
          </div>
        )}

      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdd(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(4px)",
                zIndex: 50,
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                background: "linear-gradient(180deg, #1a1730 0%, #0f0c29 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "28px 28px 0 0",
                padding: "28px 24px 40px",
                zIndex: 51,
                maxWidth: "480px",
                margin: "0 auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h3 style={{ color: "white", fontSize: "18px", fontWeight: "700", margin: 0 }}>
                  Add Expense
                </h3>
                <button
                  onClick={() => setShowAdd(false)}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "10px",
                    padding: "6px",
                    display: "flex",
                    cursor: "pointer",
                    color: "white",
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={labelStyle}>What was this for?</p>
              <input
                type="text"
                placeholder="e.g. Dinner at Barbeque Nation"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                style={inputStyle}
              />

              <p style={labelStyle}>Amount (₹)</p>
              <input
                type="number"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={inputStyle}
              />

              <p style={labelStyle}>Paid by</p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                {group.members?.map(uid => (
                  <button
                    key={uid}
                    onClick={() => setPaidBy(uid)}
                    style={{
                      padding: "8px 16px",
                      background: paidBy === uid ? "rgba(167,139,250,0.25)" : "rgba(255,255,255,0.06)",
                      border: paidBy === uid
                        ? "1px solid rgba(167,139,250,0.5)"
                        : "1px solid rgba(255,255,255,0.10)",
                      borderRadius: "10px",
                      color: paidBy === uid ? "white" : "rgba(255,255,255,0.45)",
                      fontFamily: "'Outfit',sans-serif",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {getName(uid)}
                  </button>
                ))}
              </div>

              <p style={labelStyle}>Split among</p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "28px", flexWrap: "wrap" }}>
                {group.members?.map(uid => (
                  <button
                    key={uid}
                    onClick={() => toggleMember(uid)}
                    style={{
                      padding: "8px 16px",
                      background: splitAmong.includes(uid) ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.06)",
                      border: splitAmong.includes(uid)
                        ? "1px solid rgba(96,165,250,0.4)"
                        : "1px solid rgba(255,255,255,0.10)",
                      borderRadius: "10px",
                      color: splitAmong.includes(uid) ? "white" : "rgba(255,255,255,0.35)",
                      fontFamily: "'Outfit',sans-serif",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {splitAmong.includes(uid) ? "✓ " : ""}{getName(uid)}
                  </button>
                ))}
              </div>

              <button
                onClick={addExpense}
                disabled={adding || !desc.trim() || !amount || splitAmong.length === 0}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "linear-gradient(135deg, rgba(167,139,250,0.4), rgba(96,165,250,0.4))",
                  border: "1px solid rgba(167,139,250,0.4)",
                  borderRadius: "16px",
                  color: "white",
                  fontFamily: "'Outfit',sans-serif",
                  fontSize: "16px",
                  fontWeight: "700",
                  cursor: "pointer",
                  opacity: (!desc.trim() || !amount || splitAmong.length === 0) ? 0.5 : 1,
                }}
              >
                {adding ? "Adding..." : "Add Expense"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}