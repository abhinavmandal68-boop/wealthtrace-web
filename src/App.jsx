import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebase";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const GroupsList = lazy(() => import("./pages/GroupsList"));
const GroupDetail = lazy(() => import("./pages/GroupDetail"));
const JoinGroup = lazy(() => import("./pages/JoinGroup"));

function LoadingScreen() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <div className="app-loading__mark">W</div>
      <span>Loading WealthTrace...</span>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => setLoading(false), 8000);
    const unsub = auth.onAuthStateChanged(
      (u) => {
        window.clearTimeout(fallbackTimer);
        setUser(u);
        setLoading(false);
      },
      (error) => {
        console.error("Authentication initialization failed", error);
        window.clearTimeout(fallbackTimer);
        setLoading(false);
      }
    );
    return () => {
      window.clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public route — invite link, anyone can open this */}
        <Route path="/join/:groupId" element={<JoinGroup user={user} />} />

        {/* If not logged in, show Login for everything else */}
        {!user ? (
          <Route path="*" element={<Login />} />
        ) : (
          <>
            <Route path="/"            element={<Dashboard user={user} />} />
            <Route path="/groups"      element={<GroupsList user={user} />} />
            <Route path="/groups/:groupId" element={<GroupDetail user={user} />} />
            {/* Any unknown URL → go home */}
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
