import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import Modal from "./Modal";
import { addSongToPlaylist, createPlaylist, getPlaylists } from "../api";
import "./AddToPlaylistModal.css";

export default function AddToPlaylistModal({ song, onClose }) {
  const [playlists, setPlaylists] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [addedIds, setAddedIds] = useState(new Set());
  const [pendingId, setPendingId] = useState(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPlaylists();
        setPlaylists(Array.isArray(data) ? data : []);
        setStatus("ready");
      } catch (err) {
        setErrorMsg(err.message || "Couldn't load your playlists");
        setStatus("error");
      }
    })();
  }, []);

  async function handleAdd(playlistId) {
    setPendingId(playlistId);
    setErrorMsg(null);
    try {
      await addSongToPlaylist(playlistId, song.songId);
      setAddedIds((prev) => new Set(prev).add(playlistId));
    } catch (err) {
      setErrorMsg(err.message || "Couldn't add to that playlist");
    } finally {
      setPendingId(null);
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
    <Modal title={`Add "${song.title}" to a playlist`} onClose={onClose}>
      {status === "loading" && <p className="add-to-playlist__hint">Loading your playlists…</p>}

      {status === "ready" && playlists.length === 0 && (
        <p className="add-to-playlist__hint">You don't have any playlists yet — create one below.</p>
      )}

      {status === "ready" && playlists.length > 0 && (
        <ul className="add-to-playlist__list">
          {playlists.map((p) => {
            const added = addedIds.has(p.playlistId);
            return (
              <li key={p.playlistId}>
                <button
                  type="button"
                  className={`add-to-playlist__item ${added ? "add-to-playlist__item--added" : ""}`}
                  onClick={() => handleAdd(p.playlistId)}
                  disabled={pendingId === p.playlistId || added}
                >
                  <span>{p.name}</span>
                  {added && <Check size={15} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {errorMsg && <p className="field-error">{errorMsg}</p>}

      <form className="add-to-playlist__new" onSubmit={handleCreate}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New playlist name"
          disabled={creating}
        />
        <button type="submit" className="btn btn--ghost" disabled={!newName.trim() || creating}>
          <Plus size={15} />
          <span>{creating ? "Creating…" : "Create"}</span>
        </button>
      </form>

      <div className="modal-actions">
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
