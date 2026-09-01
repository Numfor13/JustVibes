import { Music2, RefreshCw, UploadCloud } from "lucide-react";
import SongCard from "./SongCard";
import "./SongGrid.css";

export default function SongGrid({
  songs,
  status,
  error,
  search,
  onPlay,
  onEdit,
  onDeleteRequest,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onRetry,
  onUploadClick,
}) {
  if (status === "loading") {
    return (
      <div className="song-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="song-card-skeleton" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="library-state">
        <div className="library-state__icon library-state__icon--danger">
          <RefreshCw size={22} />
        </div>
        <h3>Couldn't load your library</h3>
        <p>Check your connection and try again.</p>
        <button className="library-state__btn" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (songs.length === 0 && search) {
    return (
      <div className="library-state">
        <div className="library-state__icon">
          <Music2 size={22} />
        </div>
        <h3>No matches for "{search}"</h3>
        <p>Try a different title or artist.</p>
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="library-state">
        <div className="library-state__icon">
          <UploadCloud size={22} />
        </div>
        <h3>No tracks yet</h3>
        <p>Upload your first song to start your library.</p>
        <button className="library-state__btn" onClick={onUploadClick}>
          Upload a track
        </button>
      </div>
    );
  }

  return (
    <div className="song-grid">
      {songs.map((song) => (
        <SongCard
          key={song.songId}
          song={song}
          onPlay={onPlay}
          onEdit={onEdit}
          onDeleteRequest={onDeleteRequest}
          onAddToPlaylist={onAddToPlaylist}
          onRemoveFromPlaylist={onRemoveFromPlaylist}
        />
      ))}
    </div>
  );
}
