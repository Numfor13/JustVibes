import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Pause, Play, Volume1, Volume2, VolumeX } from "lucide-react";
import Equalizer from "../components/Equalizer";
import { getSong } from "../api";
import { coverStyle } from "../utils/cover";
import { formatTime } from "../utils/formatTime";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import "./NowPlayingPage.css";

// A standalone page — opened via window.open() in its own real browser
// window (see LibraryPage's openNowPlaying), not a panel inside the main
// app. It independently fetches the one song it needs rather than relying
// on any state from the tab that opened it, since it has none.
export default function NowPlayingPage() {
  const { songId } = useParams();
  const [song, setSong] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
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
      <div className="now-playing__cover" style={coverStyle(song.songId)}>
        <Equalizer active={player.isPlaying} size="lg" />
      </div>

      <h1 className="now-playing__title" title={song.title}>
        {song.title}
      </h1>
      <p className="now-playing__artist" title={song.artist}>
        {song.artist}
      </p>
      <p className="now-playing__uploader">Uploaded by {song.uploaderName || "Unknown"}</p>

      <button
        className="now-playing__play-btn"
        onClick={player.toggle}
        aria-label={player.isPlaying ? "Pause" : "Play"}
      >
        {player.isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
      </button>

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

      {player.errorMessage && <p className="now-playing__error">{player.errorMessage}</p>}
    </div>
  );
}
