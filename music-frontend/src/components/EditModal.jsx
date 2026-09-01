import { useState } from "react";
import Modal from "./Modal";

export default function EditModal({ song, onClose, onSave }) {
  const [title, setTitle] = useState(song.title || "");
  const [artist, setArtist] = useState(song.artist || "");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const changed = title.trim() !== song.title || artist.trim() !== song.artist;
  const canSave = title.trim() && artist.trim() && changed && !saving;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setErrorMsg(null);
    try {
      await onSave(song.songId, { title: title.trim(), artist: artist.trim() });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Couldn't save changes. Try again.");
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit track" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="edit-title">Title</label>
          <input
            id="edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="edit-artist">Artist</label>
          <input
            id="edit-artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            disabled={saving}
            required
          />
        </div>

        {errorMsg && <p className="field-error">{errorMsg}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!canSave}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
