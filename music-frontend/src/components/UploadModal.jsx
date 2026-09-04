import { useState } from "react";
import { Image, UploadCloud, X } from "lucide-react";
import Modal from "./Modal";
import { requestUploadUrl, requestCoverUploadUrl, uploadFileToS3, updateSong } from "../api";
import "./UploadModal.css";

const PROCESSING_WAIT_MS = 3000;

export default function UploadModal({ onClose, onUploaded }) {
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [progress, setProgress] = useState(0);
  const [coverProgress, setCoverProgress] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | uploading | uploading-cover | processing | error
  const [errorMsg, setErrorMsg] = useState(null);

  const busy = phase !== "idle" && phase !== "error";
  const canSubmit = audioFile && title.trim() && artist.trim() && !busy;

  function handleCoverChange(e) {
    const file = e.target.files?.[0] ?? null;
    setCoverFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setCoverPreview(url);
    } else {
      setCoverPreview(null);
    }
  }

  function clearCover() {
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setErrorMsg(null);
    setPhase("uploading");
    setProgress(0);

    try {
      // Step 1: get presigned URL + create DynamoDB row
      const { uploadUrl, key } = await requestUploadUrl({
        fileName: audioFile.name,
        contentType: audioFile.type || "audio/mpeg",
        title: title.trim(),
        artist: artist.trim(),
      });

      // Step 2: upload audio directly to S3
      await uploadFileToS3(uploadUrl, audioFile, setProgress);

      // Step 3: upload cover image if provided (optional)
      // Extract songId from the key: "uploads/{songId}/filename"
      const songId = key.split("/")[1];

      if (coverFile) {
        setPhase("uploading-cover");
        setCoverProgress(0);
        const { uploadUrl: coverUrl } = await requestCoverUploadUrl(songId, coverFile.type);
        await uploadFileToS3(coverUrl, coverFile, setCoverProgress);
        // Mark hasCover=true on the song record
        await updateSong(songId, { hasCover: true });
      }

      // Step 4: wait for S3 → SQS → Lambda pipeline to mark song ready
      setPhase("processing");
      await new Promise((r) => setTimeout(r, PROCESSING_WAIT_MS));
      await onUploaded();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Upload failed. Try again.");
      setPhase("error");
    }
  }

  const phaseLabel = {
    uploading: `Uploading audio — ${progress}%`,
    "uploading-cover": `Uploading cover — ${coverProgress}%`,
    processing: "Processing…",
  }[phase];

  const progressValue =
    phase === "uploading" ? progress :
    phase === "uploading-cover" ? coverProgress :
    phase === "processing" ? 100 : 0;

  return (
    <Modal title="Upload a track" onClose={onClose}>
      <form onSubmit={handleSubmit}>

        {/* Audio file */}
        <div className="field">
          <label htmlFor="audio-file">Audio file</label>
          <label
            className={`upload-dropzone ${audioFile ? "upload-dropzone--has-file" : ""}`}
            htmlFor="audio-file"
          >
            <UploadCloud size={20} />
            <span>{audioFile ? audioFile.name : "Choose an audio file"}</span>
          </label>
          <input
            id="audio-file"
            type="file"
            accept="audio/*"
            className="visually-hidden"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
        </div>

        {/* Title */}
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

        {/* Artist */}
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

        {/* Cover image — optional */}
        <div className="field">
          <label>
            Cover image{" "}
            <span className="upload-optional">(optional)</span>
          </label>

          {coverPreview ? (
            <div className="upload-cover-preview">
              <img src={coverPreview} alt="Cover preview" />
              <button
                type="button"
                className="upload-cover-remove"
                onClick={clearCover}
                disabled={busy}
                aria-label="Remove cover image"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label
              className="upload-dropzone upload-dropzone--cover"
              htmlFor="cover-file"
            >
              <Image size={20} />
              <span>Choose a cover image</span>
            </label>
          )}

          <input
            id="cover-file"
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={handleCoverChange}
            disabled={busy}
          />
        </div>

        {/* Progress bar */}
        {busy && (
          <div className="upload-progress">
            <div className="upload-progress__track">
              <div
                className="upload-progress__fill"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <span className="upload-progress__label">{phaseLabel}</span>
          </div>
        )}

        {errorMsg && <p className="field-error">{errorMsg}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={phase === "uploading" || phase === "uploading-cover"}
          >
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
