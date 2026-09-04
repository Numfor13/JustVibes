import { Play, Pencil, Trash2, ListPlus, ListX } from "lucide-react";
import { coverStyle } from "../utils/cover";
import "./SongCard.css";

export default function SongCard({
  song,
  onPlay,
  onEdit,
  onDeleteRequest,
  onAddToPlaylist,
  onRemoveFromPlaylist,
}) {
  return (
    <div className="song-card">
      <button
        className="song-card__cover"
        style={coverStyle(song)}
        onClick={() => onPlay(song.songId)}
        aria-label={`Play ${song.title} in a new window`}
      >
        <span className="song-card__cover-overlay">
          <Play size={22} fill="currentColor" />
        </span>
      </button>

      <div className="song-card__meta">
        <p className="song-card__title" title={song.title}>
          {song.title}
        </p>
        <p className="song-card__artist" title={song.artist}>
          {song.artist}
        </p>
        <p className="song-card__uploader" title={song.uploaderName}>
          Uploaded by {song.uploaderName || "Unknown"}
        </p>
      </div>

      <div className="song-card__actions">
        {onAddToPlaylist && (
          <button
            className="song-card__icon-btn"
            onClick={() => onAddToPlaylist(song)}
            aria-label={`Add ${song.title} to a playlist`}
          >
            <ListPlus size={15} />
          </button>
        )}

        
        {song.isOwner && onEdit && (
          <button
            className="song-card__icon-btn"
            onClick={() => onEdit(song)}
            aria-label={`Edit ${song.title}`}
          >
            <Pencil size={15} />
          </button>
        )}
        {song.isOwner && onDeleteRequest && (
          <button
            className="song-card__icon-btn song-card__icon-btn--danger"
            onClick={() => onDeleteRequest(song)}
            aria-label={`Delete ${song.title}`}
          >
            <Trash2 size={15} />
          </button>
        )}

        {onRemoveFromPlaylist && (
          <button
            className="song-card__icon-btn song-card__icon-btn--danger"
            onClick={() => onRemoveFromPlaylist(song)}
            aria-label={`Remove ${song.title} from this playlist`}
          >
            <ListX size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
