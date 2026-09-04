import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A single-track player — deliberately not the multi-song usePlayer used
 * by the old bottom bar. This window only ever plays one song (requirement
 * 3), so there's no queue, no next/prev, and no cross-window state: the
 * main tab has no idea whether this window is playing anything, and that's
 * fine — it never needs to know.
 */
export function useAudioPlayback(audioUrl) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const onTime = () => setProgress(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);
    const onEnd = () => setIsPlaying(false);
    const onError = () => {
      console.error("Audio error:", audio.error?.code, "src:", audio.src);
      setErrorMessage("Couldn't play this track.");
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
      setProgress(0);
      setIsPlaying(false);
       audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        // Browser blocked autoplay — user will press play manually
      });
    }
  }, [audioUrl]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {
        setErrorMessage("Playback was blocked — press play again.");
      });
    }
  }, [isPlaying, audioUrl]);

  const seek = useCallback((seconds) => {
    if (audioRef.current) audioRef.current.currentTime = seconds;
    setProgress(seconds);
  }, []);

  const changeVolume = useCallback((v) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  return { isPlaying, progress, duration, volume, toggle, seek, changeVolume, errorMessage };
}
