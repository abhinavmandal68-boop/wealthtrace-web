import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GroupsList from "./pages/GroupsList";
import GroupDetail from "./pages/GroupDetail";
import JoinGroup from "./pages/JoinGroup";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return null;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public route — invite link, anyone can open this */}
        <Route path="/join/:groupId" element={<JoinGroup user={user} />} />

        {/* If not logged in, show Login for everything else */}
        {!user ? (
          <Route path="*" element={<Login />} />
        ) : (
          <>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/groups"      element={<GroupsList />} />
            <Route path="/groups/:groupId" element={<GroupDetail />} />
            {/* Any unknown URL → go home */}
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}