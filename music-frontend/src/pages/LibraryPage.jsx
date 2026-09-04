import { useState } from "react";
import { Search, Upload, X } from "lucide-react";
import SongGrid from "../components/SongGrid";
import UploadModal from "../components/UploadModal";
import EditModal from "../components/EditModal";
import ConfirmDialog from "../components/ConfirmDialog";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import { useSongs } from "../hooks/useSongs";
import "./LibraryPage.css";
import { useNavigate } from "react-router-dom";
import SongCard from "../components/SongCard";
import "../components/SongGrid.css";

export default function LibraryPage() {
  const { songs, status, error, search, setSearch, refresh, edit, remove } = useSongs(true);
  const myUploads = songs.filter((s) => s.isOwner);
  const otherSongs = songs.filter((s) => !s.isOwner);
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [deletingSong, setDeletingSong] = useState(null);
  const [addingToPlaylistSong, setAddingToPlaylistSong] = useState(null);

  // Full ordered list for prev/next — my uploads first, then shared
  const orderedSongs = [...myUploads, ...otherSongs];

  function handlePlay(songId) {
    const index = orderedSongs.findIndex((s) => s.songId === songId);
    navigate(`/play/${songId}`, {
      state: { queue: orderedSongs.map((s) => s.songId), index },
    });
  }

  return (
    <div className="library-page">
      <div className="library-toolbar">
        <div className="library-toolbar__search">
          <Search size={16} className="library-toolbar__search-icon" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or artist"
            aria-label="Search your library"
            className="library-toolbar__search-input"
          />
          {search && (
            <button
              className="library-toolbar__search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button className="library-toolbar__upload-btn" onClick={() => setUploadOpen(true)}>
          <Upload size={16} />
          <span>Upload</span>
        </button>
      </div>

      {(status !== "ready" || songs.length === 0) && (
        <SongGrid
          songs={songs}
          status={status}
          error={error}
          search={search}
          onPlay={handlePlay}
          onEdit={setEditingSong}
          onDeleteRequest={setDeletingSong}
          onAddToPlaylist={setAddingToPlaylistSong}
          onRetry={refresh}
          onUploadClick={() => setUploadOpen(true)}
        />
      )}

      {status === "ready" && songs.length > 0 && (
        <>
          {myUploads.length > 0 && (
            <section className="library-section">
              <div className="library-page__heading">
                <h2>My Uploads</h2>
                <span className="library-page__count">{myUploads.length} tracks</span>
              </div>
              <div className="song-grid">
                {myUploads.map((song) => (
                  <SongCard
                    key={song.songId}
                    song={song}
                    onPlay={handlePlay}
                    onEdit={setEditingSong}
                    onDeleteRequest={setDeletingSong}
                    onAddToPlaylist={setAddingToPlaylistSong}
                  />
                ))}
              </div>
            </section>
          )}

          {otherSongs.length > 0 && (
            <section className="library-section">
              <div className="library-page__heading">
                <h2>{search ? "Search results" : "Shared library"}</h2>
                <span className="library-page__count">{otherSongs.length} tracks</span>
              </div>
              <div className="song-grid">
                {otherSongs.map((song) => (
                  <SongCard
                    key={song.songId}
                    song={song}
                    onPlay={handlePlay}
                    onEdit={setEditingSong}
                    onDeleteRequest={setDeletingSong}
                    onAddToPlaylist={setAddingToPlaylistSong}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {uploadOpen && (
        <UploadModal onClose={() => setUploadOpen(false)} onUploaded={refresh} />
      )}

      {editingSong && (
        <EditModal song={editingSong} onClose={() => setEditingSong(null)} onSave={edit} />
      )}

      {deletingSong && (
        <ConfirmDialog song={deletingSong} onClose={() => setDeletingSong(null)} onConfirm={remove} />
      )}

      {addingToPlaylistSong && (
        <AddToPlaylistModal song={addingToPlaylistSong} onClose={() => setAddingToPlaylistSong(null)} />
      )}
    </div>
  );
}