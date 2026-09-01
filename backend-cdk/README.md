# Music Backend — CDK (Python)

Implements the S3 → SQS → Lambda → DynamoDB pipeline behind the `songs`
endpoints your `src/api.js` already calls:

- `POST /songs/upload-url` → `{ uploadUrl, key }`
- `GET  /songs` → `[{ songId, title, artist, audioUrl, uploadedAt }, ...]`
- `GET  /songs?search=phrase` → same shape, filtered by title/artist (case-insensitive substring)
- `PUT  /songs/{songId}` body `{ title?, artist? }` → updated song object
- `DELETE /songs/{songId}` → deletes the DynamoDB record and the S3 audio file

## Architecture

One Lambda handles both API-facing routes (`LambdaRestApi(proxy=False)`,
routes wired explicitly via `add_method` — same pattern as most CDK
CRUD-API tutorials), dispatching internally on `httpMethod`/`resource`.
A second, separate Lambda handles the SQS trigger, since that's a
different invocation source entirely and can't be merged into the
API Gateway routing:

```
Browser --POST /songs/upload-url--> API GW --> ApiHandlerFn (generate_upload_url)
                                                    |-- writes DynamoDB item (status: pending)
                                                    '-- returns presigned S3 PUT URL

Browser --PUT file--> S3 (private bucket, uploads/{songId}/{fileName})
                          |
                          '--> S3 ObjectCreated event --> SQS --> ProcessSongUploadFn
                                                                       '-- DynamoDB item -> status: ready

Browser --GET /songs--> API GW --> ApiHandlerFn (list_songs)
                                        '-- DynamoDB scan (status=ready) + presigned S3 GET URLs
```

### Why metadata is written by the API handler, not carried as S3 object metadata

Your `Upload.jsx` PUTs to the presigned URL with only a `Content-Type`
header. A presigned URL that includes `Metadata` in its signature would
require the client to also send matching `x-amz-meta-*` headers, which
it doesn't. So instead, `generate_upload_url()` writes a `status: pending`
row to DynamoDB (with title/artist) *before* returning the URL, keyed by
a `songId` embedded in the S3 key (`uploads/{songId}/{fileName}`).
`ProcessSongUploadFn` parses that same `songId` back out of the S3 event
and flips the row to `status: ready`. No frontend changes needed.

## Prerequisites

- AWS CLI configured with credentials (`aws configure`)
- Node.js (for the CDK CLI) and Python 3.9+
- `npm install -g aws-cdk`
- CDK bootstrapped in your account/region (one-time): `cdk bootstrap`

## Deploy

```bash
cd backend-cdk
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cdk diff      # optional: see what will be created
cdk deploy
```

At the end, note the stack outputs:

- `ApiUrl` — set as `VITE_API_URL` in `src/.env` (no trailing slash)
- `ApiKeyId` — use this to fetch the actual key value:
  ```bash
  aws apigateway get-api-key --api-key <ApiKeyId> --include-value --query value --output text
  ```
  Set that value as `VITE_API_KEY` in `src/.env`.

**Rotate your existing key too.** The `VITE_API_KEY` currently checked
into `src/.env` is exposed (Vite inlines `VITE_*` vars into the client
bundle, and the file is in the repo). This new stack issues a fresh
key — use it, and revoke/delete the old API Gateway key.

## Testing after deploy

```bash
# List songs (should be empty array initially)
curl -H "x-api-key: <key>" "<ApiUrl>songs"

# Request an upload URL
curl -X POST -H "x-api-key: <key>" -H "Content-Type: application/json" \
  -d '{"fileName":"test.mp3","contentType":"audio/mpeg","title":"Test Song","artist":"Test Artist"}' \
  "<ApiUrl>songs/upload-url"

# PUT an actual mp3 file to the returned uploadUrl, then wait a few
# seconds (S3 event -> SQS -> Lambda #2) and re-run the GET /songs call.
```

## Notes / things to tighten before production

- `cors` on the S3 bucket and `allow_origins` on API Gateway are set to
  `*` for local dev. Lock both to your actual Amplify domain.
- `RemovalPolicy.RETAIN` is set on the S3 bucket and DynamoDB table so
  `cdk destroy` won't delete your audio/data. Switch to `DESTROY` for a
  disposable dev stack if you'd rather not clean up manually.
- `list-songs` uses a DynamoDB `Scan` with a filter — fine at small
  scale. If the library grows, add a GSI on `status` and `Query` it
  instead.
- No audio duration is extracted (would need a library like
  `mutagen` bundled into Lambda #2's deployment package, or an
  MediaConvert/Transcribe job). `duration` is omitted from the
  response for now; add it if `SongCard`/`MusicPlayer` need it.
- DLQ (`SongUploadDLQ`) holds messages that fail processing 3 times —
  worth wiring a CloudWatch alarm on its `ApproximateNumberOfMessagesVisible`.

## Useful CDK commands

- `cdk synth` — generate the CloudFormation template (no deploy)
- `cdk diff` — compare deployed stack with current code
- `cdk destroy` — tear down (bucket/table will remain due to RETAIN)
