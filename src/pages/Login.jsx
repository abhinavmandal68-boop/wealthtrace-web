import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { motion } from "framer-motion";

export default function Login() {
  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Outfit', sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes float1 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(20px) scale(0.97); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 0.3; }
          100% { transform: scale(0.95); opacity: 0.6; }
        }

        .login-btn {
          width: 100%;
          padding: 16px 24px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 16px;
          color: white;
          font-family: 'Outfit', sans-serif;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.03em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          position: relative;
          overflow: hidden;
        }
        .login-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(167,139,250,0.15), rgba(96,165,250,0.15));
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .login-btn:hover::before { opacity: 1; }
        .login-btn:hover {
          border-color: rgba(167,139,250,0.4);
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(120,40,200,0.25);
        }
        .login-btn:active { transform: translateY(0px); }

        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0;
          color: rgba(255,255,255,0.2);
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }
      `}</style>

      {/* Floating orbs */}
      <div style={{
        position: "absolute", top: "-15%", right: "-10%",
        width: "500px", height: "500px",
        background: "radial-gradient(circle, rgba(120,40,200,0.2) 0%, transparent 70%)",
        borderRadius: "50%",
        animation: "float1 8s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-15%", left: "-10%",
        width: "500px", height: "500px",
        background: "radial-gradient(circle, rgba(40,120,200,0.2) 0%, transparent 70%)",
        borderRadius: "50%",
        animation: "float2 10s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "40%", left: "20%",
        width: "300px", height: "300px",
        background: "radial-gradient(circle, rgba(244,114,182,0.08) 0%, transparent 70%)",
        borderRadius: "50%",
        animation: "float1 12s ease-in-out infinite 2s",
        pointerEvents: "none",
      }} />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: "100%",
          maxWidth: "420px",
          margin: "24px",
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "32px",
          padding: "48px 40px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: "36px" }}
        >
          {/* Animated ring */}
          <div style={{ position: "relative", display: "inline-block", marginBottom: "20px" }}>
            <div style={{
              position: "absolute", inset: "-8px",
              borderRadius: "50%",
              border: "1px solid rgba(167,139,250,0.3)",
              animation: "pulse-ring 3s ease-in-out infinite",
            }} />
            <div style={{
              width: "64px", height: "64px",
              background: "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(96,165,250,0.3))",
              borderRadius: "20px",
              border: "1px solid rgba(167,139,250,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "24px", fontWeight: "800",
              color: "white",
              backdropFilter: "blur(10px)",
            }}>
              W
            </div>
          </div>

          <h1 style={{
            fontSize: "28px",
            fontWeight: "800",
            background: "linear-gradient(135deg, #a78bfa, #60a5fa, #f472b6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-0.02em",
            marginBottom: "6px",
          }}>
            WealthTrace
          </h1>
          <p style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: "13px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontWeight: "500",
          }}>
            Personal Finance Intelligence
          </p>
        </motion.div>

        {/* Welcome text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{ marginBottom: "32px" }}
        >
          <h2 style={{
            color: "rgba(255,255,255,0.9)",
            fontSize: "20px",
            fontWeight: "700",
            marginBottom: "8px",
            letterSpacing: "-0.01em",
          }}>
            Welcome back
          </h2>
          <p style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: "14px",
            lineHeight: "1.6",
            fontWeight: "400",
          }}>
            Sign in to access your financial dashboard and track your expenses securely.
          </p>
        </motion.div>

        {/* Google Sign In */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <button className="login-btn" onClick={loginWithGoogle}>
            {/* Google SVG */}
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="divider">
            <span>secure login</span>
          </div>

          <p style={{
            textAlign: "center",
            color: "rgba(255,255,255,0.25)",
            fontSize: "12px",
            lineHeight: "1.7",
            fontWeight: "400",
          }}>
            By signing in, you agree to our Terms of Service.<br />
            Your data is encrypted and stored securely.
          </p>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "32px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {["Real-time Sync", "Secure", "Multi-device"].map((label) => (
            <span key={label} style={{
              padding: "5px 12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "50px",
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
              fontWeight: "500",
              letterSpacing: "0.05em",
            }}>
              {label}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
