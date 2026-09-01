import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import AuthScreen from "./components/AuthScreen";
import LibraryPage from "./pages/LibraryPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import PlaylistPage from "./pages/PlaylistPage";
import NowPlayingPage from "./pages/NowPlayingPage";
import { useAuth } from "./hooks/useAuth";
import "./App.css";

// Wraps the main, multi-page app in the persistent nav. The standalone
// "now playing" window (a real separate browser window/tab, requirement
// 3) deliberately sits outside this layout — it has its own minimal
// chrome and doesn't need Library/Playlists navigation.
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

export default function App() {
  const { status: authStatus, email, name, signOut } = useAuth();

  if (authStatus === "checking") {
    return <div className="app app--loading" aria-busy="true" />;
  }

  if (authStatus === "signedOut") {
    return <AuthScreen />;
  }

  return (
    <Routes>
      <Route path="/play/:songId" element={<NowPlayingPage />} />
      <Route element={<MainLayout email={email} name={name} onSignOut={signOut} />}>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/playlists" element={<PlaylistsPage />} />
        <Route path="/playlists/:playlistId" element={<PlaylistPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
