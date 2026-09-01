import { useCallback, useEffect, useRef, useState } from "react";
import { deleteSong, getSongs, updateSong } from "../api";

export function useSongs(enabled = true) {
  const [songs, setSongs] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const debounceRef = useRef(null);

  const fetchSongs = useCallback(async (term) => {
    setStatus((prev) => (prev === "ready" ? "refreshing" : "loading"));
    try {
      const data = await getSongs(term);
      setSongs(Array.isArray(data) ? data : []);
      setStatus("ready");
      setError(null);
    } catch (err) {
      setError(err.message || "Something went wrong");
      setStatus("error");
    }
  }, []);

  // Initial load — only once there's a signed-in session to authorize it.
  useEffect(() => {
    if (enabled) fetchSongs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fetchSongs]);

  // Debounced search
  useEffect(() => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSongs(search);
    }, 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, enabled]);

  const refresh = useCallback(() => fetchSongs(search), [fetchSongs, search]);

  const edit = useCallback(async (songId, patch) => {
    const updated = await updateSong(songId, patch);
    setSongs((prev) => prev.map((s) => (s.songId === songId ? updated : s)));
    return updated;
  }, []);

  const remove = useCallback(async (songId) => {
    await deleteSong(songId);
    setSongs((prev) => prev.filter((s) => s.songId !== songId));
  }, []);

  return { songs, status, error, search, setSearch, refresh, edit, remove };
}
