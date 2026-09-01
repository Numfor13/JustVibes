# JustVibes — music library frontend

A standalone React (Vite + react-router) frontend for the JustVibes
backend (S3 → SQS → Lambda → DynamoDB, Cognito auth, deployed via the
`music-backend-cdk` stack). Dark, wine/plum-accented UI with a live
equalizer visualizer.

## Setup

```bash
cd music-frontend
cp .env.example .env
# edit .env with your deployed API's ApiUrl, region, and Cognito App Client ID
npm install
npm run dev
```

`VITE_API_URL` should be the `ApiUrl` stack output (with trailing
slash). `VITE_AWS_REGION` is your deploy region. `VITE_COGNITO_CLIENT_ID`
is the `UserPoolClientId` stack output — fetch both output values with:

```bash
aws cloudformation describe-stacks --stack-name MusicBackendStack \
  --query "Stacks[0].Outputs"
```

Auth is entirely Cognito — no API key. Every request sends the signed-in
user's JWT as `Authorization: Bearer <idToken>`.

## What's wired up

- **Auth** — sign-up now requires a display name alongside email/password
  (email verification code, then sign-in) via Cognito User Pools, gating
  the whole app. idToken refreshes transparently in the background; the
  app drops back to the sign-in screen if the session fully expires.
- **Shared library** — everyone uploads into and sees the same pool of
  songs (`GET /songs`, search via `?search=phrase`, debounced 350ms).
- **Upload** — `POST /songs/upload-url` → presigned PUT to S3 → brief
  wait for the SQS/Lambda pipeline → list refresh. The backend stamps
  `uploadedBy` from the caller's verified JWT, not from anything the
  client sends.
- **Ownership-gated edit/delete** — every song shows who uploaded it
  (resolved server-side against the `Users` table, never a frozen
  snapshot). Edit/delete buttons only render when the backend's
  `isOwner` flag says so — the actual enforcement is in Lambda, this is
  just UI tidiness; hitting the endpoint directly for a song you don't
  own returns a 403 regardless of what the UI shows.
- **Playlists** — create multiple named playlists (`/playlists`), add
  songs to them from the library grid, view and remove songs from a
  playlist (`/playlists/:playlistId`), delete a playlist entirely.
  Playlists are private to their owner.
- **Standalone "now playing" window** — clicking play opens a real,
  separate browser window at `/play/:songId` (not a panel in the main
  app), independently fetching that one song's title/artist/uploader
  and audio via `GET /songs/{songId}`. The main tab has no way to know
  what's playing in that window, and doesn't need to.

## How auth works

`src/auth.js` talks to Cognito's IdP endpoint directly with plain
`fetch` (no AWS SDK) — `SignUp`, `ConfirmSignUp`, and `InitiateAuth`
(`USER_PASSWORD_AUTH` / `REFRESH_TOKEN_AUTH`) are public, unauthenticated
actions that don't need SigV4 signing or AWS credentials, so pulling in
the full SDK isn't necessary. Tokens are cached in `localStorage`;
`getValidIdToken()` refreshes automatically ~1 minute before expiry, and
returns `null` if the refresh token itself has expired. `api.js` reads
that token on every request; a 401 anywhere clears the session and
notifies `AuthProvider` to fall back to the sign-in screen.

## Routing

- `/` — Library (search, upload, the shared song grid)
- `/playlists` — your own playlists, create new ones
- `/playlists/:playlistId` — one playlist's songs, with remove-from-playlist
- `/play/:songId` — opened via `window.open()`, not a normal in-app
  navigation — this is what makes it a genuinely separate window rather
  than a route change inside the same tab

`MainLayout` (persistent header + nav) wraps the first three; the
now-playing route sits outside it entirely, since a popup window opened
at 420×560 has no use for the full app's navigation chrome.

## Design notes

- Palette: near-black background with a wine/maroon primary accent and
  a plum undertone reserved for gradients — see
  `src/styles/tokens.css` for the full token list.
- Type: Fraunces (display/serif), Manrope (body/UI), JetBrains Mono
  (timestamps, track counts).
- Signature element: the equalizer-bar mark (`Equalizer.jsx`) — static
  in the header as the brand mark, animated on the standalone player
  page as a visualizer when something's playing.
- Song "cover art" is a deterministic gradient derived from each
  `songId` (the backend has no artwork field), kept within the
  wine/plum family so it never clashes with the rest of the UI.

## Build

```bash
npm run build   # outputs to dist/
```
