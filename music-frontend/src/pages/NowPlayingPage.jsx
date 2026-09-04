import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {ArrowLeft, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import Equalizer from "../components/Equalizer";
import { getSong } from "../api";
import { coverStyle } from "../utils/cover";
import { formatTime } from "../utils/formatTime";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import "./NowPlayingPage.css";

export default function NowPlayingPage() {
  const { songId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const queue = state?.queue ?? [songId];
  const currentIndex = state?.index ?? 0;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < queue.length - 1;

  function goTo(newIndex) {
    navigate(`/play/${queue[newIndex]}`, {
      state: { queue, index: newIndex },
      replace: true,
    });
  }

  const [song, setSong] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    setSong(null);
    setStatus("loading");
    (async () => {
      try {
        const data = await getSong(songId);
        setSong(data);
        setStatus("ready");
      } catch (err) {
        setErrorMsg(err.message || "Couldn't load this song");
        setStatus("error");
      }
    })();
  }, [songId]);

  const player = useAudioPlayback(song?.audioUrl);
  const VolumeIcon = player.volume === 0 ? VolumeX : player.volume < 0.5 ? Volume1 : Volume2;

  // Auto-advance only when playback naturally stops (not on every progress tick)
  useEffect(() => {
    if (!player.isPlaying && player.duration > 0 && Math.abs(player.progress - player.duration) < 0.5) {
      if (hasNext) goTo(currentIndex + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.isPlaying]);

  if (status === "loading") {
    return (
      <div className="now-playing now-playing--center">
        <p className="now-playing__hint">Loading…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="now-playing now-playing--center">
        <p className="now-playing__hint">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="now-playing">
      <button
        className="now-playing__back-btn"
        onClick={() => navigate(-1)}
        aria-label="Go back"
      >
        <ArrowLeft size={20} />
      </button>
      <div className="now-playing__cover" style={coverStyle(song)}>
        <Equalizer active={player.isPlaying} size="lg" />
      </div>

      <h1 className="now-playing__title" title={song.title}>
        {song.title}
      </h1>
      <p className="now-playing__artist" title={song.artist}>
        {song.artist}
      </p>
      <p className="now-playing__uploader">Uploaded by {song.uploaderName || "Unknown"}</p>

      <div className="now-playing__controls">
        <button
          className="now-playing__skip-btn"
          onClick={() => goTo(currentIndex - 1)}
          disabled={!hasPrev}
          aria-label="Previous track"
        >
          <SkipBack size={22} fill="currentColor" />
        </button>

        <button
          className="now-playing__play-btn"
          onClick={player.toggle}
          aria-label={player.isPlaying ? "Pause" : "Play"}
        >
          {player.isPlaying
            ? <Pause size={22} fill="currentColor" />
            : <Play size={22} fill="currentColor" />}
        </button>

        <button
          className="now-playing__skip-btn"
          onClick={() => goTo(currentIndex + 1)}
          disabled={!hasNext}
          aria-label="Next track"
        >
          <SkipForward size={22} fill="currentColor" />
        </button>

        <div className="now-playing__volume">
          <VolumeIcon size={16} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={player.volume}
            onChange={(e) => player.changeVolume(Number(e.target.value))}
            className="now-playing__range"
            aria-label="Volume"
          />
        </div>
      </div>

      <div className="now-playing__seek">
        <span className="now-playing__time">{formatTime(player.progress)}</span>
        <input
          type="range"
          min={0}
          max={player.duration || 0}
          step={0.1}
          value={player.progress}
          onChange={(e) => player.seek(Number(e.target.value))}
          className="now-playing__range"
          aria-label="Seek"
        />
        <span className="now-playing__time">{formatTime(player.duration)}</span>
      </div>

      {player.errorMessage && <p className="now-playing__error">{player.errorMessage}</p>}
    </div>
  );
}