import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Trash2, LogOut, Upload, TrendingUp, TrendingDown, Plus, ChevronLeft, X, Check } from "lucide-react";

const COLORS = ["#a78bfa", "#60a5fa", "#f472b6", "#34d399", "#fb923c", "#e879f9"];

const glassCard = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "24px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
};

const EXPENSE_CATEGORIES = ["Rent", "Food", "Utilities", "Entertainment", "Transport", "Shopping", "Health", "Other"];
const INCOME_CATEGORIES  = ["Salary", "Freelance", "Business", "Investment", "Bonus", "Gift", "Refund", "Other"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function useLongPress(callback, ms = 500) {
  const timerRef = { current: null };
  const start = () => { timerRef.current = setTimeout(callback, ms); };
  const stop  = () => { clearTimeout(timerRef.current); };
  return { onMouseDown: start, onMouseUp: stop, onMouseLeave: stop, onTouchStart: start, onTouchEnd: stop };
}

export default function Dashboard() {
  const [amount, setAmount]         = useState("");
  const [type, setType]             = useState("expense");
  const [category, setCategory]     = useState("Food");
  const activeCategories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [desc, setDesc]             = useState("");
  const todayStr = new Date().toISOString().split("T")[0];
  const [txnDate, setTxnDate]       = useState(todayStr);
  const [transactions, setTransactions] = useState([]);
  const [showSuccess, setShowSuccess]   = useState(false);
  const [activeTab, setActiveTab]       = useState("dashboard");
  const [filterMonth, setFilterMonth]   = useState("All");
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [selectMode, setSelectMode]     = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      setTransactions(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return () => unsub();
  }, [user]);

  const addTransaction = async () => {
    const val = Number(amount);
    if (!val || isNaN(val) || val <= 0) return;
    const chosenDate = new Date(txnDate + "T12:00:00");
    await addDoc(collection(db, "transactions"), {
      amount: val, type, category, desc,
      userId: user.uid,
      createdAt: { seconds: Math.floor(chosenDate.getTime() / 1000), nanoseconds: 0 },
      bankDate: txnDate,
    });
    setAmount(""); setDesc(""); setTxnDate(todayStr);
    setShowSuccess(true);
    setTimeout(() => { setShowSuccess(false); setActiveTab("dashboard"); }, 2000);
  };

  // ── CSV Parser (unchanged) ──
  const parseDate = (raw) => {
    if (!raw) return null;
    const s = raw.trim().replace(/"/g, "");
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
    const dmyShort = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (dmyShort) return new Date(2000 + +dmyShort[3], +dmyShort[2] - 1, +dmyShort[1]);
    const hdfcFmt = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (hdfcFmt) return new Date(`${hdfcFmt[2]} ${hdfcFmt[1]} ${hdfcFmt[3]}`);
    const spaced = s.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
    if (spaced) return new Date(`${spaced[2]} ${spaced[1]} ${spaced[3]}`);
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
    const fb = new Date(s);
    return isNaN(fb.getTime()) ? null : fb;
  };

  const detectBank = (headerLine = "") => {
    const h = headerLine.toLowerCase();
    if (h.includes("cheque no") || h.includes("ref no./cheque")) return "SBI";
    if (h.includes("withdrawal amt") || h.includes("deposit amt")) return "HDFC";
    if (h.includes("transaction remarks") || h.includes("dr/cr")) return "ICICI";
    if (h.includes("transaction id") && (h.includes("debit") || h.includes("credit"))) return "Federal Bank";
    if (h.includes("instrument id") || h.includes("indusind")) return "IndusInd";
    return "Unknown Bank";
  };

  const detectCategory = (desc = "") => {
    const d = desc.toLowerCase();
    if (d.includes("zomato") || d.includes("swiggy") || d.includes("restaurant") || d.includes("food")) return "Food";
    if (d.includes("uber") || d.includes("ola") || d.includes("petrol") || d.includes("fuel") || d.includes("irctc") || d.includes("flight")) return "Transport";
    if (d.includes("amazon") || d.includes("flipkart") || d.includes("myntra") || d.includes("shopping")) return "Shopping";
    if (d.includes("electricity") || d.includes("broadband") || d.includes("airtel") || d.includes("jio")) return "Utilities";
    if (d.includes("rent") || d.includes("housing") || d.includes("maintenance")) return "Rent";
    if (d.includes("hospital") || d.includes("pharmacy") || d.includes("medical") || d.includes("doctor")) return "Health";
    if (d.includes("netflix") || d.includes("hotstar") || d.includes("spotify") || d.includes("bookmyshow")) return "Entertainment";
    return "Other";
  };

  const parseCSVLine = (line) => {
    const result = []; let current = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    result.push(current.trim()); return result;
  };

  const [importStatus, setImportStatus] = useState(null);
  const [importBank, setImportBank]     = useState("");
  const [importCount, setImportCount]   = useState(0);
  const [importErrors, setImportErrors] = useState([]);

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setImportStatus("loading"); setImportErrors([]); setImportBank("");
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const headerKeywords = ["txn date","transaction date","trans date","posting date","value date","date"];
        let headerIdx = lines.findIndex(l => headerKeywords.some(k => l.toLowerCase().includes(k)));
        if (headerIdx === -1) headerIdx = 0;
        const headerRaw = lines[headerIdx];
        const bank = detectBank(headerRaw);
        setImportBank(bank);
        const headers = parseCSVLine(headerRaw).map(h => h.toLowerCase());
        const col = (kws) => headers.findIndex(h => kws.some(k => h.includes(k)));
        const dateCol   = col(["txn date","transaction date","date"]);
        const descCol   = col(["description","narration","particulars","remarks"]);
        const debitCol  = col(["debit","withdrawal"]);
        const creditCol = col(["credit","deposit"]);
        const amtCol    = col(["amount"]);
        const drcrCol   = col(["dr/cr","cr/dr","txn type","type"]);
        const skipWords = ["opening balance","closing balance","total","statement","account no","customer name"];
        const errors = []; const batch = writeBatch(db); let count = 0;
        lines.slice(headerIdx + 1).forEach((line, idx) => {
          if (!line) return;
          const ll = line.toLowerCase();
          if (skipWords.some(k => ll.startsWith(k))) return;
          const cols = parseCSVLine(line);
          if (cols.length < 2) return;
          const rawDate = (dateCol >= 0 ? cols[dateCol] : cols[0]) || "";
          const txnDateParsed = parseDate(rawDate);
          if (!txnDateParsed || isNaN(txnDateParsed.getTime())) {
            if (rawDate.length > 0) errors.push(`Row ${idx + 2}: cannot parse date "${rawDate}"`);
            return;
          }
          const rawDesc = (descCol >= 0 ? cols[descCol] : (cols[1] || cols[2] || "")).slice(0, 100);
          const clean = (v) => parseFloat((v || "").replace(/[,\s₹]/g, ""));
          let finalAmount = 0, transType = "";
          if (amtCol >= 0 && drcrCol >= 0) {
            const amt = clean(cols[amtCol]); const flag = (cols[drcrCol] || "").toLowerCase();
            if (!isNaN(amt) && amt > 0) { finalAmount = amt; transType = (flag.includes("cr") || flag === "c" || flag === "credit") ? "income" : "expense"; }
          } else {
            const debit = clean(debitCol >= 0 ? cols[debitCol] : cols[4]);
            const credit = clean(creditCol >= 0 ? cols[creditCol] : cols[5]);
            if (!isNaN(credit) && credit > 0) { finalAmount = credit; transType = "income"; }
            else if (!isNaN(debit) && debit > 0) { finalAmount = debit; transType = "expense"; }
          }
          if (finalAmount <= 0) return;
          const ref = doc(collection(db, "transactions"));
          batch.set(ref, { amount: finalAmount, type: transType, category: detectCategory(rawDesc), desc: rawDesc, userId: user.uid, createdAt: { seconds: Math.floor(txnDateParsed.getTime() / 1000), nanoseconds: 0 }, bankDate: rawDate, bank, imported: true });
          count++;
        });
        if (count > 0) { await batch.commit(); setImportCount(count); setImportStatus("success"); setImportErrors(errors); }
        else { setImportStatus("error"); setImportErrors(errors.length > 0 ? errors : ["No valid transactions found."]); }
      } catch (err) { setImportStatus("error"); setImportErrors([`Error: ${err.message}`]); }
    };
    reader.readAsText(file);
  };

  const deleteOne = async (id) => await deleteDoc(doc(db, "transactions", id));
  const deleteAll = async () => {
    if (!window.confirm("Clear all transactions? This cannot be undone.")) return;
    const batch = writeBatch(db);
    transactions.forEach(t => batch.delete(doc(db, "transactions", t.id)));
    await batch.commit();
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(transactions.map(t => t.id)));
  };
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const batch = writeBatch(db);
    selectedIds.forEach(id => batch.delete(doc(db, "transactions", id)));
    await batch.commit();
    setSelectedIds(new Set()); setSelectMode(false);
  };

  const months = ["All","January","February","March","April","May","June","July","August","September","October","November","December"];
  const filtered = filterMonth === "All" ? transactions : transactions.filter(t => {
    if (!t.createdAt?.seconds) return false;
    return new Date(t.createdAt.seconds * 1000).toLocaleString("default", { month: "long" }) === filterMonth;
  });
  const totalIncome  = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const barData = [...filtered].reverse().reduce((acc, t) => {
    const date = t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "Syncing";
    const ex = acc.find(i => i.date === date);
    if (ex) { if (t.type === "expense") ex.expense += t.amount; else ex.income += t.amount; }
    else acc.push({ date, income: t.type === "income" ? t.amount : 0, expense: t.type === "expense" ? t.amount : 0 });
    return acc;
  }, []).slice(-10);

  const pieData = EXPENSE_CATEGORIES.map(cat => ({
    name: cat,
    value: filtered.filter(t => t.category === cat && t.type === "expense").reduce((s, t) => s + t.amount, 0),
  })).filter(d => d.value > 0);

  const formatTxDate = (t) => {
    if (t.bankDate) { const p = parseDate(t.bankDate); if (p && !isNaN(p.getTime())) return p.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    if (t.createdAt?.seconds) return new Date(t.createdAt.seconds * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    return "Syncing...";
  };

  const fmt = (n) => `Rs. ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  // ── Current month summary for Dashboard tab quick card ──
  const now = new Date();
    if (!t.createdAt?.seconds) return false;
    const d = new Date(t.createdAt.seconds * 1000);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", fontFamily: "'Outfit', sans-serif", color: "white", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-20px); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.4); border-radius: 2px; }
        input, select, textarea { font-family: 'Outfit', sans-serif; }
        .tab-btn { background: none; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.03em; padding: 10px 20px; border-radius: 50px; transition: all 0.25s ease; color: rgba(255,255,255,0.45); }
        .tab-btn.active { background: linear-gradient(135deg, rgba(120,40,200,0.7), rgba(40,120,200,0.7)); color: white; box-shadow: 0 4px 16px rgba(120,40,200,0.3); }
        .tab-btn:hover:not(.active) { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.06); }
        .action-btn { width:100%; padding: 15px; background: linear-gradient(135deg, rgba(120,40,200,0.9), rgba(40,120,200,0.9)); border: none; border-radius: 14px; color: white; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 0.05em; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 6px 24px rgba(120,40,200,0.4); }
        .action-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(120,40,200,0.5); }
        .ghost-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); border-radius: 10px; padding: 8px 14px; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; display:flex; align-items:center; gap:6px; }
        .ghost-btn:hover { background: rgba(255,255,255,0.1); color: white; border-color: rgba(255,255,255,0.2); }
        .danger-btn { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: rgba(239,68,68,0.7); border-radius: 10px; padding: 8px 14px; font-family:'Outfit',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; }
        .danger-btn:hover { background: rgba(239,68,68,0.2); color: #f87171; }
        .field-label { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 8px; display: block; }
        .field-input { width:100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; color: white; font-family:'Outfit',sans-serif; font-size:15px; font-weight:500; outline:none; transition: border-color 0.2s; }
        .field-input:focus { border-color: rgba(167,139,250,0.5); background: rgba(255,255,255,0.07); }
        .field-input::placeholder { color: rgba(255,255,255,0.2); }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { filter: invert(0.9); }
        .toggle-opt { flex:1; padding: 10px; border: none; border-radius: 10px; font-family:'Outfit',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; letter-spacing:0.04em; }
        .tx-row { display:flex; justify-content:space-between; align-items:center; padding: 14px 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; transition: all 0.2s; }
        .tx-row:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); }
        .del-btn { background:none; border:none; color:rgba(255,255,255,0.15); cursor:pointer; padding:4px; border-radius:6px; transition:color 0.2s; display:flex; align-items:center; }
        .del-btn:hover { color: rgba(239,68,68,0.7); }
        .metric-card { padding: 24px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); }
        .monthly-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(120,40,200,0.4) !important; }
      `}</style>

      {/* Orbs */}
      <div style={{ position:"fixed", top:"-10%", right:"-5%", width:"400px", height:"400px", background:"radial-gradient(circle, rgba(120,40,200,0.15) 0%, transparent 70%)", borderRadius:"50%", pointerEvents:"none", animation:"float 10s ease-in-out infinite" }} />
      <div style={{ position:"fixed", bottom:"-10%", left:"-5%", width:"400px", height:"400px", background:"radial-gradient(circle, rgba(40,120,200,0.15) 0%, transparent 70%)", borderRadius:"50%", pointerEvents:"none", animation:"float 14s ease-in-out infinite 2s" }} />

      {/* Header */}
      <header style={{ maxWidth:"1200px", margin:"0 auto", padding:"24px 32px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.5 }}>
          <h1 style={{ fontSize:"24px", fontWeight:"800", background:"linear-gradient(135deg, #a78bfa, #60a5fa)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", letterSpacing:"-0.02em", margin:0 }}>
            WealthTrace
          </h1>
          <p style={{ color:"rgba(255,255,255,0.3)", fontSize:"12px", letterSpacing:"0.15em", textTransform:"uppercase", fontWeight:"500", margin:"2px 0 0" }}>
            {user?.displayName || "Dashboard"}
          </p>
        </motion.div>
        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
          <button className="ghost-btn" onClick={() => signOut(auth)}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {/* Nav Tabs */}
      <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"0 32px 24px" }}>
        <div style={{ display:"inline-flex", gap:"4px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"50px", padding:"4px" }}>
          {[["dashboard","Dashboard"], ["add","New Transaction"], ["history","History"]].map(([key, label]) => (
            <button key={key} className={`tab-btn ${activeTab === key ? "active" : ""}`} onClick={() => setActiveTab(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ maxWidth:"1200px", margin:"0 auto", padding:"0 32px 48px" }}>

        {/* ── DASHBOARD TAB ── */}
        {activeTab === "dashboard" && (
          <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>

            {/* Month filter */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
              <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"13px", fontWeight:"500" }}>
                {filtered.length} transaction{filtered.length !== 1 ? "s" : ""} {filterMonth !== "All" ? `in ${filterMonth}` : "total"}
              </p>
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", color:"white", padding:"8px 14px", fontSize:"13px", fontWeight:"500", outline:"none", cursor:"pointer", fontFamily:"'Outfit', sans-serif" }}>
                {months.map(m => <option key={m} value={m} style={{ background:"#302b63" }}>{m}</option>)}
              </select>
            </div>

            {/* Metric cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px,1fr))", gap:"16px", marginBottom:"24px" }}>
              {[
                { label:"Balance", value: fmt(balance), color: balance >= 0 ? "#34d399" : "#f87171", bg:"rgba(52,211,153,0.08)", border:"rgba(52,211,153,0.15)" },
                { label:"Total Income", value: fmt(totalIncome), color:"#34d399", bg:"rgba(52,211,153,0.06)", border:"rgba(52,211,153,0.12)" },
                { label:"Total Expenses", value: fmt(totalExpense), color:"#f87171", bg:"rgba(248,113,113,0.06)", border:"rgba(248,113,113,0.12)" },
                { label:"Transactions", value: filtered.length, color:"#a78bfa", bg:"rgba(167,139,250,0.06)", border:"rgba(167,139,250,0.12)" },
              ].map(({ label, value, color, bg, border }) => (
                <motion.div key={label} whileHover={{ y:-3 }} className="metric-card" style={{ background:bg, borderColor:border }}>
                  <p style={{ fontSize:"11px", fontWeight:"600", letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(255,255,255,0.4)", marginBottom:"10px" }}>{label}</p>
                  <p style={{ fontSize:"26px", fontWeight:"800", color, letterSpacing:"-0.02em" }}>{value}</p>
                </motion.div>
              ))}
            </div>

            {/* Charts */}
            {filtered.length > 0 ? (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", marginBottom:"20px" }}>
                <div style={{ ...glassCard, padding:"28px" }}>
                  <p style={{ fontSize:"13px", fontWeight:"700", letterSpacing:"0.06em", textTransform:"uppercase", color:"rgba(255,255,255,0.5)", marginBottom:"20px" }}>Daily Flow</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill:"rgba(255,255,255,0.3)", fontSize:11, fontFamily:"Outfit" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill:"rgba(255,255,255,0.3)", fontSize:11, fontFamily:"Outfit" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ background:"rgba(15,12,41,0.95)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"12px", fontFamily:"Outfit", fontSize:"13px" }} labelStyle={{ color:"rgba(255,255,255,0.6)", marginBottom:"4px" }} formatter={(val, name) => [`Rs. ${val.toLocaleString("en-IN")}`, name === "income" ? "Income" : "Expense"]} />
                      <Bar dataKey="income" fill="rgba(52,211,153,0.7)" radius={[6,6,0,0]} maxBarSize={32} />
                      <Bar dataKey="expense" fill="rgba(167,139,250,0.7)" radius={[6,6,0,0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display:"flex", gap:"16px", marginTop:"12px" }}>
                    <span style={{ fontSize:"12px", color:"rgba(52,211,153,0.8)", display:"flex", alignItems:"center", gap:"6px" }}><span style={{ width:8, height:8, background:"rgba(52,211,153,0.7)", borderRadius:"2px", display:"inline-block" }}></span>Income</span>
                    <span style={{ fontSize:"12px", color:"rgba(167,139,250,0.8)", display:"flex", alignItems:"center", gap:"6px" }}><span style={{ width:8, height:8, background:"rgba(167,139,250,0.7)", borderRadius:"2px", display:"inline-block" }}></span>Expense</span>
                  </div>
                </div>
                <div style={{ ...glassCard, padding:"28px" }}>
                  <p style={{ fontSize:"13px", fontWeight:"700", letterSpacing:"0.06em", textTransform:"uppercase", color:"rgba(255,255,255,0.5)", marginBottom:"20px" }}>Spending by Category</p>
                  {pieData.length > 0 ? (
                    <div style={{ display:"flex", gap:"16px", alignItems:"center" }}>
                      <PieChart width={160} height={160}>
                        <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background:"rgba(15,12,41,0.95)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"12px", fontFamily:"Outfit", fontSize:"13px" }} formatter={val => [`Rs. ${val.toLocaleString("en-IN")}`, ""]} />
                      </PieChart>
                      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"6px" }}>
                        {pieData.map((d, i) => (
                          <div key={d.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <span style={{ fontSize:"12px", color:"rgba(255,255,255,0.5)", display:"flex", alignItems:"center", gap:"6px" }}>
                              <span style={{ width:6, height:6, background:COLORS[i % COLORS.length], borderRadius:"50%", display:"inline-block" }}></span>
                              {d.name}
                            </span>
                            <span style={{ fontSize:"12px", fontWeight:"600", color:"rgba(255,255,255,0.7)" }}>Rs. {d.value.toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ height:160, display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.2)", fontSize:"14px" }}>No expense data</div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ ...glassCard, padding:"48px", textAlign:"center", marginBottom:"20px" }}>
                <p style={{ color:"rgba(255,255,255,0.3)", fontSize:"15px" }}>No transactions for this period.</p>
                <button className="action-btn" style={{ marginTop:"20px", maxWidth:"200px", display:"inline-block" }} onClick={() => setActiveTab("add")}>Add Transaction</button>
              </div>
            )}

            {/* Recent */}
            {filtered.length > 0 && (
              <div style={{ ...glassCard, padding:"28px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
                  <p style={{ fontSize:"13px", fontWeight:"700", letterSpacing:"0.06em", textTransform:"uppercase", color:"rgba(255,255,255,0.5)" }}>Recent</p>
                  <button className="ghost-btn" onClick={() => setActiveTab("history")}>View all</button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {filtered.slice(0,5).map(t => (
                    <div key={t.id} className="tx-row">
                      <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                        <div style={{ width:36, height:36, borderRadius:"10px", background: t.type === "income" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {t.type === "income" ? <TrendingUp size={16} color="#34d399" /> : <TrendingDown size={16} color="#f87171" />}
                        </div>
                        <div>
                          <p style={{ fontSize:"14px", fontWeight:"600", color:"rgba(255,255,255,0.85)", margin:0 }}>{t.category || "Other"}</p>
                          <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", margin:0, marginTop:"2px" }}>{t.desc || formatTxDate(t)}</p>
                        </div>
                      </div>
                      <p style={{ fontSize:"16px", fontWeight:"700", color: t.type === "income" ? "#34d399" : "#f87171", margin:0 }}>
                        {t.type === "income" ? "+" : "-"} Rs. {t.amount.toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── ADD TRANSACTION TAB ── */}
        {activeTab === "add" && (
          <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }} style={{ maxWidth:"520px", margin:"0 auto" }}>
            <div style={{ ...glassCard, padding:"36px", position:"relative", overflow:"hidden" }}>
              <AnimatePresence>
                {showSuccess && (
                  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    style={{ position:"absolute", inset:0, background:"rgba(15,12,41,0.95)", backdropFilter:"blur(20px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:20, borderRadius:"24px" }}>
                    <motion.div initial={{ scale:0.5 }} animate={{ scale:1 }} transition={{ type:"spring", stiffness:300 }}
                      style={{ width:64, height:64, background:"rgba(52,211,153,0.15)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"16px" }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </motion.div>
                    <p style={{ fontSize:"18px", fontWeight:"700", color:"#34d399", margin:0 }}>Saved Successfully</p>
                    <p style={{ fontSize:"13px", color:"rgba(255,255,255,0.4)", marginTop:"6px" }}>Redirecting to dashboard...</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <h2 style={{ fontSize:"20px", fontWeight:"800", letterSpacing:"-0.01em", marginBottom:"28px", color:"rgba(255,255,255,0.9)" }}>New Transaction</h2>

              <div style={{ marginBottom:"20px" }}>
                <label className="field-label">Type</label>
                <div style={{ display:"flex", gap:"6px", background:"rgba(255,255,255,0.04)", borderRadius:"12px", padding:"4px" }}>
                  <button className="toggle-opt" onClick={() => { setType("expense"); setCategory("Food"); }}
                    style={{ background: type === "expense" ? "rgba(248,113,113,0.15)" : "transparent", color: type === "expense" ? "#f87171" : "rgba(255,255,255,0.3)", border: type === "expense" ? "1px solid rgba(248,113,113,0.2)" : "1px solid transparent" }}>
                    Expense
                  </button>
                  <button className="toggle-opt" onClick={() => { setType("income"); setCategory("Salary"); }}
                    style={{ background: type === "income" ? "rgba(52,211,153,0.15)" : "transparent", color: type === "income" ? "#34d399" : "rgba(255,255,255,0.3)", border: type === "income" ? "1px solid rgba(52,211,153,0.2)" : "1px solid transparent" }}>
                    Income
                  </button>
                </div>
              </div>

              <div style={{ marginBottom:"20px" }}>
                <label className="field-label">Transaction Date</label>
                <input className="field-input" type="date" value={txnDate} max={todayStr} onChange={e => setTxnDate(e.target.value)} style={{ colorScheme:"dark", cursor:"pointer" }} />
                {txnDate !== todayStr && (
                  <p style={{ fontSize:"11px", color:"rgba(167,139,250,0.7)", marginTop:"6px", fontWeight:"500" }}>
                    Recording past transaction for {new Date(txnDate + "T12:00:00").toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" })}
                  </p>
                )}
              </div>

              <div style={{ marginBottom:"20px" }}>
                <label className="field-label">Amount</label>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.3)", fontSize:"15px", fontWeight:"600" }}>Rs.</span>
                  <input className="field-input" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
                    style={{ paddingLeft:"44px", fontSize:"20px", fontWeight:"700" }} onKeyDown={e => e.key === "Enter" && addTransaction()} />
                </div>
              </div>

              <div style={{ marginBottom:"20px" }}>
                <label className="field-label">Category</label>
                <select className="field-input" value={category} onChange={e => setCategory(e.target.value)}>
                  {activeCategories.map(c => <option key={c} value={c} style={{ background:"#302b63" }}>{c}</option>)}
                </select>
              </div>

              <div style={{ marginBottom:"28px" }}>
                <label className="field-label">Description <span style={{ color:"rgba(255,255,255,0.2)", fontWeight:400, textTransform:"none", letterSpacing:0 }}>(optional)</span></label>
                <input className="field-input" type="text" placeholder="e.g. Grocery run, Salary credit" value={desc} onChange={e => setDesc(e.target.value)} />
              </div>

              <button className="action-btn" onClick={addTransaction}>Save Transaction</button>

              {/* CSV Import */}
              <div style={{ marginTop:"24px", padding:"20px", background:"rgba(255,255,255,0.03)", border:"1px dashed rgba(255,255,255,0.1)", borderRadius:"14px" }}>
                <p style={{ fontSize:"12px", fontWeight:"600", color:"rgba(255,255,255,0.35)", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:"12px", textAlign:"center" }}>Import Bank Statement</p>
                {importStatus === "loading" && <p style={{ textAlign:"center", color:"rgba(167,139,250,0.8)", fontSize:"13px" }}>Reading file...</p>}
                {importStatus === "success" && (
                  <div style={{ textAlign:"center" }}>
                    <p style={{ color:"#34d399", fontSize:"14px", fontWeight:"600", marginBottom:"4px" }}>{importCount} transactions imported</p>
                    {importBank && <p style={{ color:"rgba(167,139,250,0.7)", fontSize:"12px", marginBottom:"4px" }}>Detected: {importBank}</p>}
                    {importErrors.length > 0 && <p style={{ color:"rgba(251,146,60,0.8)", fontSize:"12px" }}>{importErrors.length} rows skipped</p>}
                    <button className="ghost-btn" style={{ margin:"8px auto 0", display:"inline-flex" }} onClick={() => setImportStatus(null)}>Import another</button>
                  </div>
                )}
                {importStatus === "error" && (
                  <div style={{ textAlign:"center" }}>
                    <p style={{ color:"#f87171", fontSize:"13px", marginBottom:"8px" }}>Import failed</p>
                    {importErrors.slice(0,3).map((e, i) => <p key={i} style={{ color:"rgba(255,255,255,0.3)", fontSize:"11px" }}>{e}</p>)}
                    <button className="ghost-btn" style={{ margin:"8px auto 0", display:"inline-flex" }} onClick={() => setImportStatus(null)}>Try again</button>
                  </div>
                )}
                {!importStatus && (
                  <>
                    <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", cursor:"pointer", color:"rgba(167,139,250,0.8)", fontSize:"13px", fontWeight:"600", marginBottom:"10px" }}>
                      <Upload size={14} /> Choose CSV file
                      <input type="file" accept=".csv" onChange={handleImport} style={{ display:"none" }} />
                    </label>
                    <p style={{ textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:"11px", lineHeight:"1.6" }}>
                      Supports SBI, HDFC, ICICI,<br/>Federal Bank, IndusInd Bank
                    </p>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "history" && (
          <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
              <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"13px", fontWeight:"500" }}>
                {selectMode && selectedIds.size > 0 ? `${selectedIds.size} selected` : `${transactions.length} transactions`}
              </p>
              <div style={{ display:"flex", gap:"8px" }}>
                {selectMode ? (
                  <>
                    <button className="ghost-btn" onClick={toggleSelectAll}>{selectedIds.size === transactions.length ? "Deselect all" : "Select all"}</button>
                    {selectedIds.size > 0 && <button className="danger-btn" onClick={deleteSelected}><Trash2 size={13} /> Delete ({selectedIds.size})</button>}
                    <button className="ghost-btn" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="ghost-btn" onClick={() => setSelectMode(true)}>Select</button>
                    <button className="danger-btn" onClick={deleteAll}><Trash2 size={13} /> Clear all</button>
                  </>
                )}
              </div>
            </div>

            {selectMode && <p style={{ color:"rgba(167,139,250,0.6)", fontSize:"12px", marginBottom:"12px", fontWeight:"500" }}>Tap any transaction to select it</p>}

            <div style={{ ...glassCard, padding:"16px" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                <AnimatePresence>
                  {transactions.map(t => {
                    const isSelected = selectedIds.has(t.id);
                    return (
                      <motion.div key={t.id} layout
                        initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, x:-20 }}
                        onClick={() => selectMode && toggleSelect(t.id)}
                        {...useLongPress(() => { setSelectMode(true); toggleSelect(t.id); })}
                        className="tx-row"
                        style={{ cursor: selectMode ? "pointer" : "default", background: isSelected ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)", border: isSelected ? "1px solid rgba(167,139,250,0.35)" : "1px solid rgba(255,255,255,0.06)", borderRadius:"14px", padding:"14px 16px", transition:"all 0.15s ease", userSelect:"none" }}
                      >
                        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                          {selectMode ? (
                            <div style={{ width:22, height:22, borderRadius:"6px", flexShrink:0, background: isSelected ? "rgba(167,139,250,0.9)" : "rgba(255,255,255,0.08)", border: isSelected ? "2px solid #a78bfa" : "2px solid rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s ease" }}>
                              {isSelected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                          ) : (
                            <div style={{ width:38, height:38, borderRadius:"10px", background: t.type === "income" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                              {t.type === "income" ? <TrendingUp size={15} color="#34d399" /> : <TrendingDown size={15} color="#f87171" />}
                            </div>
                          )}
                          <div>
                            <p style={{ fontSize:"14px", fontWeight:"600", color:"rgba(255,255,255,0.85)", margin:0 }}>
                              {t.category || "Other"}{t.desc && <span style={{ color:"rgba(255,255,255,0.3)", fontWeight:400, marginLeft:"6px" }}>— {t.desc}</span>}
                            </p>
                            <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.25)", margin:0, marginTop:"2px" }}>{formatTxDate(t)}</p>
                          </div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                          <p style={{ fontSize:"15px", fontWeight:"700", color: t.type === "income" ? "#34d399" : "#f87171", margin:0, whiteSpace:"nowrap" }}>
                            {t.type === "income" ? "+" : "−"} Rs. {t.amount.toLocaleString("en-IN")}
                          </p>
                          {!selectMode && (
                            <button className="del-btn" onClick={(e) => { e.stopPropagation(); deleteOne(t.id); }}><Trash2 size={14} /></button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {transactions.length === 0 && (
                  <div style={{ padding:"48px", textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:"14px" }}>No transactions yet.</div>
                )}
              </div>
            </div>

            <AnimatePresence>
              {selectMode && selectedIds.size > 0 && (
                <motion.div initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:40 }}
                  style={{ position:"fixed", bottom:"32px", left:"50%", transform:"translateX(-50%)", background:"rgba(15,12,41,0.95)", backdropFilter:"blur(20px)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:"50px", padding:"12px 24px", display:"flex", alignItems:"center", gap:"16px", boxShadow:"0 8px 32px rgba(0,0,0,0.5)", zIndex:100, whiteSpace:"nowrap" }}>
                  <p style={{ color:"rgba(255,255,255,0.7)", fontSize:"14px", fontWeight:"500", margin:0 }}>{selectedIds.size} selected</p>
                  <button onClick={deleteSelected} style={{ background:"rgba(248,113,113,0.15)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:"50px", padding:"8px 20px", color:"#f87171", fontFamily:"'Outfit',sans-serif", fontSize:"14px", fontWeight:"600", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}>
                    <Trash2 size={14} /> Delete selected
                  </button>
                  <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.3)", fontFamily:"'Outfit',sans-serif", fontSize:"14px", cursor:"pointer" }}>
                    Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

    </div>
  );
}
