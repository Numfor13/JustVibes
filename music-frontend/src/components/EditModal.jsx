import { useState } from "react";
import { ImagePlus } from "lucide-react";
import Modal from "./Modal";
import { requestCoverUploadUrl } from "../api";

export default function EditModal({ song, onClose, onSave }) {
  const [title, setTitle] = useState(song.title || "");
  const [artist, setArtist] = useState(song.artist || "");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(song.coverUrl || null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const changed = title.trim() !== song.title || artist.trim() !== song.artist || !!coverFile;
  const canSave = title.trim() && artist.trim() && changed && !saving;

  function handleCoverPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setErrorMsg(null);
    try {
      const body = { title: title.trim(), artist: artist.trim() };

      if (coverFile) {
        const { uploadUrl } = await requestCoverUploadUrl(song.songId, coverFile.type);
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": coverFile.type },
          body: coverFile,
        });
        if (!putRes.ok) throw new Error("Couldn't upload the cover image. Try again.");
        body.hasCover = true;
      }

      await onSave(song.songId, body);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Couldn't save changes. Try again.");
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit track" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label htmlFor="edit-cover" className="edit-modal__cover-picker">
          {coverPreview ? (
            <img src={coverPreview} alt="" className="edit-modal__cover-preview" />
          ) : (
            <span className="edit-modal__cover-placeholder">
              <ImagePlus size={22} />
              <span>Add cover image</span>
            </span>
          )}
        </label>
        <input
          id="edit-cover"
          type="file"
          accept="image/*"
          onChange={handleCoverPick}
          disabled={saving}
          hidden
        />

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