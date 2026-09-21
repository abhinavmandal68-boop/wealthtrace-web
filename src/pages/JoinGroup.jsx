import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, LogIn, Users } from "lucide-react";
import { auth, db } from "../firebase";

export default function JoinGroup({ user }) {
  const { groupId: inviteCode } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState(user ? "loading" : "found");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!user) return;

    const fetchInvite = async () => {
      try {
        const inviteSnap = await getDoc(doc(db, "inviteCodes", inviteCode.toUpperCase()));
        if (!inviteSnap.exists() || inviteSnap.data().active !== true) {
          setStatus("error");
          return;
        }
        const inviteData = { code: inviteSnap.id, ...inviteSnap.data() };
        setInvite(inviteData);

        try {
          const groupSnap = await getDoc(doc(db, "groups", inviteData.groupId));
          setStatus(groupSnap.exists() && groupSnap.data().members?.includes(user.uid) ? "already" : "found");
        } catch {
          // A secure ruleset intentionally prevents non-members from reading the group.
          setStatus("found");
        }
      } catch (error) {
        console.error(error);
        setStatus("error");
      }
    };

    fetchInvite();
  }, [inviteCode, user]);

  const handleLogin = async () => {
    setActionError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error(error);
      if (error.code !== "auth/popup-closed-by-user") {
        setActionError("Sign-in failed. Check that pop-ups are allowed, then try again.");
      }
    }
  };

  const handleJoin = async () => {
    if (!user || !invite) return;
    setStatus("loading");
    setActionError("");
    try {
      const memberName = (user.displayName || "Member").trim().slice(0, 80) || "Member";
      await updateDoc(doc(db, "groups", invite.groupId), {
        members: arrayUnion(user.uid),
        [`memberNames.${user.uid}`]: memberName,
      });
      setStatus("joined");
      window.setTimeout(() => navigate(`/groups/${invite.groupId}`), 900);
    } catch (error) {
      console.error(error);
      setStatus("found");
      setActionError("We couldn't add you to this group. Ask the owner to verify the invite and try again.");
    }
  };

  const groupName = invite?.groupName || "a shared WealthTrace group";

  return (
    <div className="page-shell join-page" style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <motion.div className="join-card" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }} style={{ width: "100%", maxWidth: "400px", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "32px", padding: "40px 32px", boxShadow: "0 32px 80px rgba(0,0,0,0.4)", textAlign: "center" }}>
        {actionError && <p role="alert" style={{ color: "#fca5a5", fontSize: "13px", lineHeight: 1.5, marginBottom: "18px" }}>{actionError}</p>}

        {status === "loading" && <><IconBox><Users size={24} color="#a78bfa" /></IconBox><p style={mutedText}>Loading invitation...</p></>}

        {status === "error" && <><p style={{ fontSize: "32px", marginBottom: "12px" }}>😕</p><h2 style={heading}>Invitation not found</h2><p style={{ ...mutedText, marginBottom: "24px" }}>This code is invalid, inactive, or the group was deleted.</p><button onClick={() => navigate("/")} style={btnStyle}>Go to Dashboard</button></>}

        {status === "found" && !user && <><IconBox><Users size={24} color="#a78bfa" /></IconBox><p style={eyebrow}>Private group invitation</p><h2 style={heading}>You've been invited</h2><p style={{ ...mutedText, marginBottom: "28px" }}>Sign in to securely view and join {groupName}.</p><button onClick={handleLogin} style={btnStyle}><LogIn size={16} /> Sign in with Google</button></>}

        {status === "found" && user && <><IconBox><Users size={24} color="#a78bfa" /></IconBox><p style={eyebrow}>You're invited to</p><h2 style={heading}>{groupName}</h2><p style={{ ...mutedText, marginBottom: "28px" }}>{invite?.currency || "INR"} group · invite code {invite?.code}</p><button onClick={handleJoin} style={btnStyle}>Join Group <ArrowRight size={16} /></button></>}

        {status === "already" && <><IconBox success><CheckCircle size={24} color="#34d399" /></IconBox><h2 style={heading}>You're already in!</h2><p style={{ ...mutedText, marginBottom: "28px" }}>{groupName}</p><button onClick={() => navigate(`/groups/${invite.groupId}`)} style={btnStyle}>Open Group <ArrowRight size={16} /></button></>}

        {status === "joined" && <><IconBox success><CheckCircle size={24} color="#34d399" /></IconBox><h2 style={heading}>Joined successfully!</h2><p style={mutedText}>Taking you to {groupName}...</p></>}
      </motion.div>
    </div>
  );
}

function IconBox({ children, success = false }) {
  return <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: success ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(96,165,250,0.3))", border: `1px solid ${success ? "rgba(52,211,153,0.3)" : "rgba(167,139,250,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>{children}</div>;
}

const heading = { color: "white", fontSize: "22px", fontWeight: 750, margin: "0 0 8px" };
const mutedText = { color: "rgba(255,255,255,0.45)", fontSize: "14px", lineHeight: 1.55, margin: 0 };
const eyebrow = { color: "rgba(255,255,255,0.4)", fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px" };
const btnStyle = { width: "100%", minHeight: "48px", padding: "13px 20px", background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(96,165,250,0.3))", border: "1px solid rgba(167,139,250,0.4)", borderRadius: "14px", color: "white", fontSize: "15px", fontWeight: 650, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" };
