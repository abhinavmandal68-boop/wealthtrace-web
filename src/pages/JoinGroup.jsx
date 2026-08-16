import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { motion } from "framer-motion";
import { Users, LogIn, ArrowRight, CheckCircle } from "lucide-react";

export default function JoinGroup({ user }) {
  const { groupId } = useParams();   // reads the ID from the URL
  const navigate = useNavigate();

  const [group, setGroup]   = useState(null);   // group data from Firestore
  const [status, setStatus] = useState("loading"); 
  // status can be: "loading" | "found" | "already" | "joined" | "error"

  // ── Step 1: Fetch the group data ──
  // Wait for auth to be ready before fetching
  useEffect(() => {
    const fetchGroup = async () => {
      try {
        // If not logged in, still show the invite UI
        // but use a public-readable approach
        const snap = await getDoc(doc(db, "groups", groupId));
        
        // If document doesn't exist at all
        if (!snap.exists()) { 
          setStatus("error"); 
          return; 
        }

        const data = { id: snap.id, ...snap.data() };
        setGroup(data);

        if (user && data.members?.includes(user.uid)) {
          setStatus("already");
        } else {
          setStatus("found");
        }
      } catch (e) {
        console.error(e);
        // If permission denied and not logged in, 
        // show the join UI anyway so they can login first
        if (!user) {
          setStatus("found");
        } else {
          setStatus("error");
        }
      }
    };
    fetchGroup();
  }, [groupId, user]);

  // ── Step 2: Login with Google ──
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // App.jsx will detect login and re-render, user prop updates
    } catch (e) {
      console.error(e);
    }
  };

  // ── Step 3: Join the group ──
  const handleJoin = async () => {
    if (!user || !group) return;
    setStatus("loading");
    try {
      await updateDoc(doc(db, "groups", groupId), {
        members: arrayUnion(user.uid),
        [`memberNames.${user.uid}`]: user.displayName || user.email,
      });
      setStatus("joined");
      setTimeout(() => navigate(`/groups/${groupId}`), 1500);
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  };

  // ── UI ──
  return (
    <div className="page-shell join-page" style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      fontFamily: "'Outfit', sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>

      <motion.div
        className="join-card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: "100%", maxWidth: "400px",
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "32px",
          padding: "40px 32px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
          textAlign: "center",
        }}
      >
        {/* Loading */}
        {status === "loading" && (
          <>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Users size={24} color="#a78bfa" />
            </div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px" }}>Loading group...</p>
          </>
        )}

        {/* Error */}
        {status === "error" && (
          <>
            <p style={{ fontSize: "32px", marginBottom: "12px" }}>😕</p>
            <p style={{ color: "white", fontWeight: "700", fontSize: "18px", marginBottom: "8px" }}>Link not found</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "24px" }}>This invite link is invalid or the group was deleted.</p>
            <button onClick={() => navigate("/")} style={btnStyle}>Go to Dashboard</button>
          </>
        )}

        {/* Group found — not logged in yet */}
        {status === "found" && !user && (
          <>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(96,165,250,0.3))", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Users size={24} color="#a78bfa" />
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>You're invited to</p>
            <h2 style={{ color: "white", fontSize: "24px", fontWeight: "800", marginBottom: "8px" }}>{group?.name}</h2>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", marginBottom: "32px" }}>
              {group?.members?.length || 1} member{group?.members?.length !== 1 ? "s" : ""} already inside
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", marginBottom: "16px" }}>Sign in first to join this group</p>
            <button onClick={handleLogin} style={btnStyle}>
              <LogIn size={16} style={{ marginRight: "8px" }} /> Sign in with Google
            </button>
          </>
        )}

        {/* Group found — logged in, ready to join */}
        {status === "found" && user && (
          <>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(96,165,250,0.3))", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Users size={24} color="#a78bfa" />
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>You're invited to</p>
            <h2 style={{ color: "white", fontSize: "24px", fontWeight: "800", marginBottom: "8px" }}>{group?.name}</h2>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", marginBottom: "32px" }}>
              {group?.members?.length || 1} member{group?.members?.length !== 1 ? "s" : ""} already inside
            </p>
            <button onClick={handleJoin} style={btnStyle}>
              Join Group <ArrowRight size={16} style={{ marginLeft: "8px" }} />
            </button>
          </>
        )}

        {/* Already a member */}
        {status === "already" && (
          <>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle size={24} color="#34d399" />
            </div>
            <h2 style={{ color: "white", fontSize: "22px", fontWeight: "700", marginBottom: "8px" }}>You're already in!</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "28px" }}>{group?.name}</p>
            <button onClick={() => navigate(`/groups/${groupId}`)} style={btnStyle}>
              Open Group <ArrowRight size={16} style={{ marginLeft: "8px" }} />
            </button>
          </>
        )}

        {/* Successfully joined */}
        {status === "joined" && (
          <>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{ width: "56px", height: "56px", borderRadius: "16px", background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}
            >
              <CheckCircle size={24} color="#34d399" />
            </motion.div>
            <h2 style={{ color: "white", fontSize: "22px", fontWeight: "700", marginBottom: "8px" }}>Joined successfully!</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Taking you to {group?.name}...</p>
          </>
        )}

      </motion.div>
    </div>
  );
}

// Shared button style
const btnStyle = {
  width: "100%",
  padding: "14px 24px",
  background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(96,165,250,0.3))",
  border: "1px solid rgba(167,139,250,0.4)",
  borderRadius: "14px",
  color: "white",
  fontFamily: "'Outfit', sans-serif",
  fontSize: "15px",
  fontWeight: "600",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};