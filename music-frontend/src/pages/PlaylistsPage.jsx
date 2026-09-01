import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ListMusic, Plus } from "lucide-react";
import { createPlaylist, getPlaylists } from "../api";
import "../components/SongGrid.css";
import "./PlaylistsPage.css";

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setStatus("loading");
    try {
      const data = await getPlaylists();
      setPlaylists(Array.isArray(data) ? data : []);
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err.message || "Couldn't load your playlists");
      setStatus("error");
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;

    setCreating(true);
    setErrorMsg(null);
    try {
      const playlist = await createPlaylist(name);
      setPlaylists((prev) => [playlist, ...prev]);
      setNewName("");
    } catch (err) {
      setErrorMsg(err.message || "Couldn't create that playlist");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="playlists-page">
      <div className="playlists-page__heading">
        <h2>Your playlists</h2>
        {status === "ready" && <span className="playlists-page__count">{playlists.length}</span>}
      </div>

      <form className="playlists-page__new" onSubmit={handleCreate}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New playlist name"
          disabled={creating}
        />
        <button type="submit" className="btn btn--primary" disabled={!newName.trim() || creating}>
          <Plus size={16} />
          <span>{creating ? "Creating…" : "Create"}</span>
        </button>
      </form>

      {errorMsg && <p className="field-error">{errorMsg}</p>}

      {status === "loading" && (
        <div className="playlists-page__list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="playlist-card-skeleton" aria-hidden="true" />
          ))}
        </div>
      )}

      {status === "ready" && playlists.length === 0 && (
        <div className="library-state">
          <div className="library-state__icon">
            <ListMusic size={22} />
          </div>
          <h3>No playlists yet</h3>
          <p>Create one above to start collecting songs you like.</p>
        </div>
      )}

      {status === "ready" && playlists.length > 0 && (
        <div className="playlists-page__list">
          {playlists.map((p) => (
            <Link key={p.playlistId} to={`/playlists/${p.playlistId}`} className="playlist-card">
              <div className="playlist-card__icon">
                <ListMusic size={20} />
              </div>
              <span className="playlist-card__name">{p.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
