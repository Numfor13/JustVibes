import { useState } from "react";
import Modal from "./Modal";

export default function ConfirmDialog({ song, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  async function handleConfirm() {
    setDeleting(true);
    setErrorMsg(null);
    try {
      await onConfirm(song.songId);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Couldn't delete this track. Try again.");
      setDeleting(false);
    }
  }

  return (
    <Modal title="Delete track" onClose={onClose}>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        Delete <strong style={{ color: "var(--text-primary)" }}>{song.title}</strong> by{" "}
        {song.artist}? This removes the file and can't be undone.
      </p>

      {errorMsg && <p className="field-error">{errorMsg}</p>}

      <div className="modal-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={deleting}>
          Cancel
        </button>
        <button type="button" className="btn btn--danger" onClick={handleConfirm} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
