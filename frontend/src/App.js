import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ScopeProvider } from "@/context/ScopeContext";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Shell from "@/components/Shell";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null)
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<RedirectIfAuthed />} />
            <Route path="/*" element={
              <Protected>
                <ScopeProvider><Shell /></ScopeProvider>
              </Protected>
            } />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}
