import { useEffect, useState } from "react";
import { auth } from "./firebase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard"; // ✅ FIXED (moved up)

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    auth.onAuthStateChanged((u) => setUser(u));
  }, []);

  return user ? <Dashboard /> : <Login />;
}