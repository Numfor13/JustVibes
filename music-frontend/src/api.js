import { clearSession, getValidIdToken } from "./auth";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/?$/, "/") ?? "";

async function authHeaders(extra = {}) {
  const token = await getValidIdToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function unwrap(res) {
  const text = await res.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new Event("justvibes:unauthorized"));
    throw new Error("Your session expired. Please sign in again.");
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && payload.message) ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return payload;
}

/** GET /songs[?search=phrase] */
export async function getSongs(search) {
  const url = new URL(`${API_URL}songs`);
  if (search) url.searchParams.set("search", search);
  const res = await fetch(url, { headers: await authHeaders() });
  return unwrap(res);
}

/** GET /songs/{songId} -> single song, hydrated with uploaderName/isOwner */
export async function getSong(songId) {
  const res = await fetch(`${API_URL}songs/${encodeURIComponent(songId)}`, {
    headers: await authHeaders(),
  });
  return unwrap(res);
}

/** POST /songs/upload-url -> { uploadUrl, key } */
export async function requestUploadUrl({ fileName, contentType, title, artist }) {
  const res = await fetch(`${API_URL}songs/upload-url`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ fileName, contentType, title, artist }),
  });
  return unwrap(res);
}

/** POST /songs/{songId}/cover-upload-url -> { uploadUrl, key } */
export async function requestCoverUploadUrl(songId, contentType) {
  const res = await fetch(`${API_URL}songs/${encodeURIComponent(songId)}/cover-upload-url`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ contentType }),
  });
  return unwrap(res);
}

/** PUT the actual file to the presigned S3 URL, with progress reporting. */
export function uploadFileToS3(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));

    xhr.send(file);
  });
}

/** PUT /songs/{songId} body: { title?, artist?, hasCover? } */
export async function updateSong(songId, { title, artist, hasCover }) {
  const res = await fetch(`${API_URL}songs/${encodeURIComponent(songId)}`, {
    method: "PUT",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ title, artist, hasCover }),
  });
  return unwrap(res);
}

/** DELETE /songs/{songId} */
export async function deleteSong(songId) {
  const res = await fetch(`${API_URL}songs/${encodeURIComponent(songId)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  return unwrap(res);
}

/** POST /playlists  body: { name } -> created playlist */
export async function createPlaylist(name) {
  const res = await fetch(`${API_URL}playlists`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  return unwrap(res);
}

/** GET /playlists -> the caller's own playlists */
export async function getPlaylists() {
  const res = await fetch(`${API_URL}playlists`, { headers: await authHeaders() });
  return unwrap(res);
}

/** GET /playlists/{playlistId} -> { playlistId, name, createdAt, songs: [...] } */
export async function getPlaylist(playlistId) {
  const res = await fetch(`${API_URL}playlists/${encodeURIComponent(playlistId)}`, {
    headers: await authHeaders(),
  });
  return unwrap(res);
}

/** DELETE /playlists/{playlistId} */
export async function deletePlaylist(playlistId) {
  const res = await fetch(`${API_URL}playlists/${encodeURIComponent(playlistId)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  return unwrap(res);
}

/** POST /playlists/{playlistId}/songs  body: { songId } */
export async function addSongToPlaylist(playlistId, songId) {
  const res = await fetch(`${API_URL}playlists/${encodeURIComponent(playlistId)}/songs`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ songId }),
  });
  return unwrap(res);
}

/** DELETE /playlists/{playlistId}/songs/{songId} */
export async function removeSongFromPlaylist(playlistId, songId) {
  const res = await fetch(
    `${API_URL}playlists/${encodeURIComponent(playlistId)}/songs/${encodeURIComponent(songId)}`,
    { method: "DELETE", headers: await authHeaders() }
  );
  return unwrap(res);
}