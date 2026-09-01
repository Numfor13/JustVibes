import { useState } from "react";
import { UploadCloud } from "lucide-react";
import Modal from "./Modal";
import { requestUploadUrl, uploadFileToS3 } from "../api";
import "./UploadModal.css";

const PROCESSING_WAIT_MS = 3000;

export default function UploadModal({ onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | uploading | processing | error
  const [errorMsg, setErrorMsg] = useState(null);

  const busy = phase === "uploading" || phase === "processing";
  const canSubmit = file && title.trim() && artist.trim() && !busy;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setErrorMsg(null);
    setPhase("uploading");
    setProgress(0);

    try {
      const { uploadUrl } = await requestUploadUrl({
        fileName: file.name,
        contentType: file.type || "audio/mpeg",
        title: title.trim(),
        artist: artist.trim(),
      });

      await uploadFileToS3(uploadUrl, file, setProgress);

      // The file still needs S3 -> SQS -> Lambda processing before it
      // shows up as "ready" in GET /songs. Give the pipeline a moment,
      // then refresh the list and close — no reliable client-side
      // signal for "done processing" without a second endpoint, so
      // this is a fixed wait rather than a match-guessing poll.
      setPhase("processing");
      await new Promise((r) => setTimeout(r, PROCESSING_WAIT_MS));
      await onUploaded();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Upload failed. Try again.");
      setPhase("error");
    }
  }

  return (
    <Modal title="Upload a track" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="audio-file">Audio file</label>
          <label
            className={`upload-dropzone ${file ? "upload-dropzone--has-file" : ""}`}
            htmlFor="audio-file"
          >
            <UploadCloud size={20} />
            <span>{file ? file.name : "Choose an audio file"}</span>
          </label>
          <input
            id="audio-file"
            type="file"
            accept="audio/*"
            className="visually-hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
        </div>

        <div className="field">
          <label htmlFor="upload-title">Title</label>
          <input
            id="upload-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Track title"
            disabled={busy}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="upload-artist">Artist</label>
          <input
            id="upload-artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist name"
            disabled={busy}
            required
          />
        </div>

        {(phase === "uploading" || phase === "processing") && (
          <div className="upload-progress">
            <div className="upload-progress__track">
              <div
                className="upload-progress__fill"
                style={{ width: `${phase === "processing" ? 100 : progress}%` }}
              />
            </div>
            <span className="upload-progress__label">
              {phase === "uploading" ? `Uploading — ${progress}%` : "Processing…"}
            </span>
          </div>
        )}

        {errorMsg && <p className="field-error">{errorMsg}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={phase === "uploading"}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
            {phase === "idle" ? "Upload" : phase === "error" ? "Retry" : "Uploading…"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
