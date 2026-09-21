import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  Download,
  FileText,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";
import { db } from "../firebase";

const CATEGORIES = ["Rent", "Food", "Utilities", "Entertainment", "Transport", "Shopping", "Health", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Business", "Investment", "Bonus", "Gift", "Refund", "Other"];

const glassCard = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "24px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)",
};

const inputStyle = {
  width: "100%",
  minHeight: "44px",
  padding: "11px 13px",
  border: "1px solid rgba(255,255,255,0.13)",
  borderRadius: "11px",
  outline: "none",
  background: "rgba(255,255,255,0.07)",
  color: "white",
};

const todayInputValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const dateInputValue = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
);

const monthKey = (transaction) => {
  if (!transaction.createdAt?.seconds) return "";
  const date = new Date(transaction.createdAt.seconds * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const nextRecurringDate = (date, frequency) => {
  const next = new Date(date);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  return next;
};

const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export default function Planning({ user }) {
  const navigate = useNavigate();
  const currentMonth = todayInputValue().slice(0, 7);

  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [budgetMonth, setBudgetMonth] = useState(currentMonth);
  const [budgetCategory, setBudgetCategory] = useState("Food");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [recurringType, setRecurringType] = useState("expense");
  const [recurringCategory, setRecurringCategory] = useState("Food");
  const [recurringDescription, setRecurringDescription] = useState("");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");
  const [recurringDue, setRecurringDue] = useState(todayInputValue());
  const [reportMonth, setReportMonth] = useState(currentMonth);
  const [busyId, setBusyId] = useState("");
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    const listeners = [
      onSnapshot(
        query(collection(db, "transactions"), where("userId", "==", user.uid)),
        (snapshot) => setTransactions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        (error) => { console.error(error); setPageError("Transactions could not be loaded."); }
      ),
      onSnapshot(
        query(collection(db, "budgets"), where("userId", "==", user.uid)),
        (snapshot) => setBudgets(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        (error) => { console.error(error); setPageError("Budgets could not be loaded."); }
      ),
      onSnapshot(
        query(collection(db, "recurringTransactions"), where("userId", "==", user.uid)),
        (snapshot) => setRecurring(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        (error) => { console.error(error); setPageError("Recurring items could not be loaded."); }
      ),
    ];
    return () => listeners.forEach((unsubscribe) => unsubscribe());
  }, [user.uid]);

  const currentMonthExpenses = useMemo(() => transactions.filter(
    (transaction) => transaction.type === "expense" && monthKey(transaction) === budgetMonth
  ), [budgetMonth, transactions]);

  const visibleBudgets = budgets.filter((budget) => budget.month === budgetMonth);
  const exceededBudgets = visibleBudgets.filter((budget) => {
    const spent = currentMonthExpenses
      .filter((item) => item.category === budget.category)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    return spent > budget.limit;
  });
  const dueRecurring = recurring.filter((item) => {
    const dueDate = item.nextDueAt?.toDate?.();
    return item.active !== false && dueDate && dueDate <= new Date(`${todayInputValue()}T23:59:59`);
  });

  const saveBudget = async () => {
    const limit = Number(budgetLimit);
    if (!Number.isFinite(limit) || limit <= 0) return;
    setBusyId("budget");
    setPageError("");
    try {
      const budgetId = `${user.uid}_${budgetMonth}_${budgetCategory.toLowerCase()}`;
      const existingBudget = budgets.find((budget) => budget.id === budgetId);
      await setDoc(doc(db, "budgets", budgetId), {
        userId: user.uid,
        month: budgetMonth,
        category: budgetCategory,
        limit,
        createdAt: existingBudget?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setBudgetLimit("");
    } catch (error) {
      console.error(error);
      setPageError("The budget could not be saved.");
    } finally {
      setBusyId("");
    }
  };

  const saveRecurring = async () => {
    const amount = Number(recurringAmount);
    if (!recurringDescription.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setBusyId("recurring");
    setPageError("");
    try {
      await addDoc(collection(db, "recurringTransactions"), {
        userId: user.uid,
        type: recurringType,
        category: recurringCategory,
        description: recurringDescription.trim(),
        amount,
        frequency: recurringFrequency,
        nextDueAt: Timestamp.fromDate(new Date(`${recurringDue}T12:00:00`)),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setRecurringDescription("");
      setRecurringAmount("");
    } catch (error) {
      console.error(error);
      setPageError("The recurring item could not be saved.");
    } finally {
      setBusyId("");
    }
  };

  const postRecurring = async (item) => {
    const dueDate = item.nextDueAt?.toDate?.();
    if (!dueDate) return;
    setBusyId(item.id);
    setPageError("");
    try {
      const occurrenceDate = dateInputValue(dueDate);
      const transactionRef = doc(db, "transactions", `${user.uid}_${item.id}_${occurrenceDate}`);
      const batch = writeBatch(db);
      batch.set(transactionRef, {
        userId: user.uid,
        amount: item.amount,
        type: item.type,
        category: item.category,
        desc: item.description,
        createdAt: Timestamp.fromDate(dueDate),
        bankDate: occurrenceDate,
        recurringId: item.id,
        occurrenceKey: occurrenceDate,
      });
      batch.update(doc(db, "recurringTransactions", item.id), {
        nextDueAt: Timestamp.fromDate(nextRecurringDate(dueDate, item.frequency)),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      console.error(error);
      setPageError("The recurring transaction could not be posted.");
    } finally {
      setBusyId("");
    }
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      setPageError("This browser does not support notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const alertParts = [];
      if (dueRecurring.length) alertParts.push(`${dueRecurring.length} recurring item(s) are due`);
      if (exceededBudgets.length) alertParts.push(`${exceededBudgets.length} budget(s) are exceeded`);
      new Notification("WealthTrace alerts enabled", {
        body: alertParts.length ? `${alertParts.join(" and ")}.` : "No recurring items are due and your budgets are on track.",
        icon: "/favicon.svg",
      });
    }
  };

  const reportTransactions = transactions
    .filter((transaction) => monthKey(transaction) === reportMonth)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const exportCsv = () => {
    const header = ["Date", "Type", "Category", "Description", "Amount"];
    const rows = reportTransactions.map((item) => [
      item.bankDate || "",
      item.type,
      item.category,
      item.desc,
      item.amount,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `wealthtrace-${reportMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const reportWindow = window.open("", "_blank", "width=900,height=700");
    if (!reportWindow) {
      setPageError("Allow pop-ups to create a printable PDF report.");
      return;
    }
    reportWindow.opener = null;
    const income = reportTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = reportTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
    const rows = reportTransactions.map((item) => `
      <tr><td>${escapeHtml(item.bankDate || "")}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.desc)}</td><td>₹${Number(item.amount).toLocaleString("en-IN")}</td></tr>
    `).join("");
    reportWindow.document.write(`<!doctype html><html><head><title>WealthTrace ${escapeHtml(reportMonth)}</title><style>body{font:14px system-ui;padding:32px;color:#172033}h1{margin-bottom:4px}.summary{display:flex;gap:24px;margin:24px 0}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left}th{background:#f4f6fa}@media print{button{display:none}}</style></head><body><h1>WealthTrace report</h1><p>${escapeHtml(reportMonth)}</p><div class="summary"><strong>Income: ₹${income.toLocaleString("en-IN")}</strong><strong>Expenses: ₹${expenses.toLocaleString("en-IN")}</strong><strong>Net: ₹${(income - expenses).toLocaleString("en-IN")}</strong></div><table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    reportWindow.document.close();
  };

  return (
    <div className="page-shell planning-page">
      <main className="planning-content">
        <header className="planning-header">
          <button className="icon-button" onClick={() => navigate("/")} aria-label="Back to dashboard"><ArrowLeft size={18} /></button>
          <div>
            <h1>Planning</h1>
            <p>Budgets, recurring items, alerts and reports</p>
          </div>
          <button className="secondary-button" onClick={requestNotifications}><Bell size={15} /> Alerts</button>
        </header>

        {pageError && <div className="inline-error" role="alert"><span>{pageError}</span><button onClick={() => setPageError("")} aria-label="Dismiss error">×</button></div>}

        <section className="planning-section" style={glassCard}>
          <div className="section-title"><WalletCards size={19} /><div><h2>Monthly budgets</h2><p>Set a limit and compare it with actual spending.</p></div></div>
          <div className="planning-form budget-form">
            <input aria-label="Budget month" type="month" value={budgetMonth} onChange={(event) => setBudgetMonth(event.target.value)} style={inputStyle} />
            <select aria-label="Budget category" value={budgetCategory} onChange={(event) => setBudgetCategory(event.target.value)} style={inputStyle}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
            <input aria-label="Budget limit" type="number" min="1" inputMode="decimal" placeholder="Limit (₹)" value={budgetLimit} onChange={(event) => setBudgetLimit(event.target.value)} style={inputStyle} />
            <button className="primary-button" onClick={saveBudget} disabled={busyId === "budget"}>{busyId === "budget" ? "Saving..." : "Save budget"}</button>
          </div>
          <div className="budget-list">
            {visibleBudgets.length === 0 ? <p className="empty-copy">No budgets for this month.</p> : visibleBudgets.map((budget) => {
              const spent = currentMonthExpenses.filter((item) => item.category === budget.category).reduce((sum, item) => sum + Number(item.amount), 0);
              const percentage = Math.min((spent / budget.limit) * 100, 100);
              const exceeded = spent > budget.limit;
              return <div className="budget-row" key={budget.id}><div className="row-copy"><strong>{budget.category}</strong><span className={exceeded ? "danger-text" : ""}>₹{spent.toLocaleString("en-IN")} of ₹{budget.limit.toLocaleString("en-IN")}{exceeded ? " — over budget" : ""}</span><div className="progress-track"><div className={exceeded ? "progress-fill exceeded" : "progress-fill"} style={{ width: `${percentage}%` }} /></div></div><button className="icon-button danger-icon" onClick={() => deleteDoc(doc(db, "budgets", budget.id))} aria-label={`Delete ${budget.category} budget`}><Trash2 size={15} /></button></div>;
            })}
          </div>
        </section>

        <section className="planning-section" style={glassCard}>
          <div className="section-title"><CalendarClock size={19} /><div><h2>Recurring transactions</h2><p>Generate due bills locally—no paid scheduler required.</p></div></div>
          <div className="planning-form recurring-form">
            <select aria-label="Recurring type" value={recurringType} onChange={(event) => { setRecurringType(event.target.value); setRecurringCategory(event.target.value === "income" ? "Salary" : "Food"); }} style={inputStyle}><option value="expense">Expense</option><option value="income">Income</option></select>
            <select aria-label="Recurring category" value={recurringCategory} onChange={(event) => setRecurringCategory(event.target.value)} style={inputStyle}>{(recurringType === "income" ? INCOME_CATEGORIES : CATEGORIES).map((category) => <option key={category}>{category}</option>)}</select>
            <input aria-label="Recurring description" placeholder="Description" maxLength={100} value={recurringDescription} onChange={(event) => setRecurringDescription(event.target.value)} style={inputStyle} />
            <input aria-label="Recurring amount" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Amount (₹)" value={recurringAmount} onChange={(event) => setRecurringAmount(event.target.value)} style={inputStyle} />
            <select aria-label="Frequency" value={recurringFrequency} onChange={(event) => setRecurringFrequency(event.target.value)} style={inputStyle}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
            <input aria-label="Next due date" type="date" value={recurringDue} onChange={(event) => setRecurringDue(event.target.value)} style={inputStyle} />
            <button className="primary-button" onClick={saveRecurring} disabled={busyId === "recurring"}><Plus size={15} /> {busyId === "recurring" ? "Saving..." : "Add recurring"}</button>
          </div>
          <div className="recurring-list">
            {recurring.length === 0 ? <p className="empty-copy">No recurring items yet.</p> : recurring.map((item) => {
              const dueDate = item.nextDueAt?.toDate?.();
              const isDue = dueRecurring.some((due) => due.id === item.id);
              return <div className="recurring-row" key={item.id}><div className="row-copy"><strong>{item.description}</strong><span>{item.frequency} · ₹{Number(item.amount).toLocaleString("en-IN")} · due {dueDate ? dueDate.toLocaleDateString("en-IN") : "—"}</span></div><div className="row-actions">{isDue && <button className="primary-button compact" onClick={() => postRecurring(item)} disabled={Boolean(busyId)}>{busyId === item.id ? "Posting..." : "Post now"}</button>}<button className="icon-button danger-icon" onClick={() => deleteDoc(doc(db, "recurringTransactions", item.id))} aria-label={`Delete ${item.description}`}><Trash2 size={15} /></button></div></div>;
            })}
          </div>
        </section>

        <section className="planning-section" style={glassCard}>
          <div className="section-title"><FileText size={19} /><div><h2>Monthly reports</h2><p>Export locally as CSV or print/save as PDF.</p></div></div>
          <div className="report-actions">
            <input aria-label="Report month" type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} style={inputStyle} />
            <button className="secondary-button" onClick={exportCsv} disabled={!reportTransactions.length}><Download size={15} /> CSV</button>
            <button className="secondary-button" onClick={printReport} disabled={!reportTransactions.length}><FileText size={15} /> Print / PDF</button>
          </div>
          <p className="empty-copy">{reportTransactions.length} transaction{reportTransactions.length === 1 ? "" : "s"} in this report.</p>
        </section>
      </main>
    </div>
  );
}
