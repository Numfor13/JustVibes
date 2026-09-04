import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import VerifyPage from "./pages/VerifyPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";
import LibraryPage from "./pages/LibraryPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import PlaylistPage from "./pages/PlaylistPage";
import NowPlayingPage from "./pages/NowPlayingPage";
import { useAuth } from "./hooks/useAuth";
import "./App.css";

function MainLayout({ email, name, onSignOut }) {
  return (
    <div className="app">
      <Header email={email} name={name} onSignOut={onSignOut} />
      <main className="app__main">
        <Outlet />
      </main>
    </div>
  );
}

// Redirects signed-in users away from auth pages to the library
function GuestRoute({ children }) {
  const { status } = useAuth();
  if (status === "checking") return <div className="app app--loading" aria-busy="true" />;
  if (status === "signedIn") return <Navigate to="/" replace />;
  return children;
}

// Redirects signed-out users away from protected pages to login
function ProtectedRoute({ children }) {
  const { status } = useAuth();
  if (status === "checking") return <div className="app app--loading" aria-busy="true" />;
  if (status === "signedOut") return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { status: authStatus, email, name, signOut } = useAuth();

  return (
    <Routes>
      {/* OAuth callback — public, no guard needed */}
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

      {/* Standalone player window — public but needs a valid session for the API */}
      <Route path="/play/:songId" element={<NowPlayingPage />} />

      {/* Guest-only auth pages */}
      <Route path="/login"  element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/signup" element={<GuestRoute><SignUpPage /></GuestRoute>} />
      <Route path="/verify" element={<GuestRoute><VerifyPage /></GuestRoute>} />

      {/* Protected app pages */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout email={email} name={name} onSignOut={signOut} />
          </ProtectedRoute>
        }
      >
        <Route path="/"                          element={<LibraryPage />} />
        <Route path="/playlists"                 element={<PlaylistsPage />} />
        <Route path="/playlists/:playlistId"     element={<PlaylistPage />} />
        <Route path="*"                          element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
