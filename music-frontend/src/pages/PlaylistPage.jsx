import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Music2, RefreshCw, Trash2 } from "lucide-react";
import SongCard from "../components/SongCard";
import { deletePlaylist, getPlaylist, removeSongFromPlaylist } from "../api";
import "../components/SongGrid.css";
import "./PlaylistPage.css";


export default function PlaylistPage() {
  const { playlistId } = useParams();
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [deletingPlaylist, setDeletingPlaylist] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  async function load() {
    setStatus("loading");
    try {
      const data = await getPlaylist(playlistId);
      setPlaylist(data);
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err.message || "Couldn't load this playlist");
      setStatus("error");
    }
  }

  async function handleRemoveSong(song) {
    // Optimistic update — this is a personal list, low stakes if it
    // needs a retry, and it keeps the UI feeling instant.
    setPlaylist((prev) => ({
      ...prev,
      songs: prev.songs.filter((s) => s.songId !== song.songId),
    }));
    try {
      await removeSongFromPlaylist(playlistId, song.songId);
    } catch (err) {
      setErrorMsg(err.message || "Couldn't remove that song — refreshing.");
      load();
    }
  }

  async function handleDeletePlaylist() {
    if (deletingPlaylist) return;
    setDeletingPlaylist(true);
    try {
      await deletePlaylist(playlistId);
      navigate("/playlists");
    } catch (err) {
      setErrorMsg(err.message || "Couldn't delete this playlist");
      setDeletingPlaylist(false);
    }
  }

  return (
    <div className="playlist-page">
      <Link to="/playlists" className="playlist-page__back">
        <ArrowLeft size={15} />
        <span>All playlists</span>
      </Link>

      {status === "ready" && playlist && (
        <div className="playlist-page__heading">
          <h2>{playlist.name}</h2>
          <span className="playlist-page__count">{playlist.songs.length} tracks</span>
          <button
            className="playlist-page__delete-btn"
            onClick={handleDeletePlaylist}
            disabled={deletingPlaylist}
          >
            <Trash2 size={14} />
            <span>{deletingPlaylist ? "Deleting…" : "Delete playlist"}</span>
          </button>
        </div>
      )}

      {errorMsg && <p className="field-error">{errorMsg}</p>}

      {status === "loading" && (
        <div className="song-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="song-card-skeleton" aria-hidden="true" />
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="library-state">
          <div className="library-state__icon library-state__icon--danger">
            <RefreshCw size={22} />
          </div>
          <h3>Couldn't load this playlist</h3>
          <button className="library-state__btn" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {status === "ready" && playlist.songs.length === 0 && (
        <div className="library-state">
          <div className="library-state__icon">
            <Music2 size={22} />
          </div>
          <h3>Nothing here yet</h3>
          <p>Add songs from your library using the "add to playlist" icon on any track.</p>
        </div>
      )}

      {status === "ready" && playlist.songs.length > 0 && (
        <div className="song-grid">
          {playlist.songs.map((song, index) => (
            <SongCard
              key={song.songId}
              song={song}
              onPlay={(songId) => navigate(`/play/${songId}`,
                {
                  state: {
                    queue: playlist.songs.map((s) => s.songId),
                    index,
                  },
              })}
              onRemoveFromPlaylist={handleRemoveSong}
            />
          ))}
        </div>
      )}
    </div>
  );
}
