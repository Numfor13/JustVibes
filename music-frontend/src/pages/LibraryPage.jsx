import { useState } from "react";
import { Search, Upload, X } from "lucide-react";
import SongGrid from "../components/SongGrid";
import UploadModal from "../components/UploadModal";
import EditModal from "../components/EditModal";
import ConfirmDialog from "../components/ConfirmDialog";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import { useSongs } from "../hooks/useSongs";
import "./LibraryPage.css";

// A real, separate browser window/tab — not a client-side route change —
// since it needs to work even if the person closes the main tab, and the
// whole point (requirement 3) is a standalone "now playing" surface.
function openNowPlaying(songId) {
  window.open(
    `/play/${songId}`,
    "justvibes-player",
    "width=420,height=560,noopener,noreferrer"
  );
}

export default function LibraryPage() {
  const { songs, status, error, search, setSearch, refresh, edit, remove } = useSongs(true);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [deletingSong, setDeletingSong] = useState(null);
  const [addingToPlaylistSong, setAddingToPlaylistSong] = useState(null);

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

      <div className="library-page__heading">
        <h2>{search ? "Search results" : "Browse library"}</h2>
        {status === "ready" && <span className="library-page__count">{songs.length} tracks</span>}
      </div>

      <SongGrid
        songs={songs}
        status={status}
        error={error}
        search={search}
        onPlay={openNowPlaying}
        onEdit={setEditingSong}
        onDeleteRequest={setDeletingSong}
        onAddToPlaylist={setAddingToPlaylistSong}
        onRetry={refresh}
        onUploadClick={() => setUploadOpen(true)}
      />

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
