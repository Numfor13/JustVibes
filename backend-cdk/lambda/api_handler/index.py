import json
import os
import re
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key  # was: boto3.dynamodb.condition (missing "s")

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

BUCKET_NAME = os.environ["BUCKET_NAME"]
SONGS_TABLE_NAME = os.environ["TABLE_NAME"]
USERS_TABLE_NAME = os.environ["USERS_TABLE_NAME"]
PLAYLISTS_TABLE_NAME = os.environ["PLAYLISTS_TABLE_NAME"]
PLAYLIST_SONGS_TABLE_NAME = os.environ["PLAYLIST_SONGS_TABLE_NAME"]

Music_table = dynamodb.Table(SONGS_TABLE_NAME)
Users_table = dynamodb.Table(USERS_TABLE_NAME)
Playlist_Table = dynamodb.Table(PLAYLISTS_TABLE_NAME)
playlist_songs_table = dynamodb.Table(PLAYLIST_SONGS_TABLE_NAME)


UPLOAD_URL_TTL_SECONDS = 300
PLAYBACK_URL_TTL_SECONDS = 3600
BATCH_GET_CHUNK_SIZE = 100

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
}

def handler(event, context):

    http_method = event["httpMethod"]
    resource = event.get("resource", "")


    try:
        path_params = event.get("pathParameters") or {}
        caller_sub = event["requestContext"]["authorizer"]["claims"]["sub"]

        if http_method == "GET" and resource == "/songs":
            query_params = event.get("queryStringParameters") or {}
            return list_songs(query_params.get("search"), caller_sub)
        elif http_method == "POST" and resource == "/songs/upload-url":
            body = json.loads(event.get("body") or "{}")
            return generate_upload_url(body, caller_sub)
        elif http_method == "GET" and resource == "/songs/{songId}":
            return get_song(path_params["songId"], caller_sub)
        elif http_method == "PUT" and resource == "/songs/{songId}":
            body = json.loads(event.get("body") or "{}")
            return update_song(path_params["songId"], body, caller_sub)
        elif http_method == "DELETE" and resource == "/songs/{songId}":
            return delete_song(path_params["songId"],caller_sub)

        elif http_method == "POST" and resource == "/playlists":
            body = json.loads(event.get("body") or "{}")
            return create_playlist(body, caller_sub)
        elif http_method == "GET" and resource == "/playlists":
            return list_playlists(caller_sub)
        elif http_method == "GET" and resource == "/playlists/{playlistId}":
            return get_playlist(path_params["playlistId"], caller_sub)
        elif http_method == "DELETE" and resource == "/playlists/{playlistId}":
            return delete_playlist(path_params["playlistId"], caller_sub)
        elif http_method == "POST" and resource == "/playlists/{playlistId}/songs":
            body = json.loads(event.get("body") or "{}")
            return add_song_to_playlist(path_params["playlistId"], body, caller_sub)
        elif (
            http_method == "DELETE"
            and resource == "/playlists/{playlistId}/songs/{songId}"
        ):
            return remove_song_from_playlist(
                path_params["playlistId"], path_params["songId"], caller_sub
            )

        return _response(400, {"message": "Unsupported route"})

    except Exception as e:
        return _response(500, {"message": str(e)})


def generate_upload_url(body, caller_sub):

    file_name = body.get("fileName")
    content_type = body.get("contentType")
    title = (body.get("title") or "").strip()
    artist = (body.get("artist") or "").strip()

    if not file_name or not content_type or not title or not artist:
        return _response(
            400,
            {"message": "fileName, contentType, title, and artist are required"},
        )

    song_id = str(uuid.uuid4())
    safe_name = _sanitize_filename(file_name)
    key = f"uploads/{song_id}/{safe_name}"

    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": BUCKET_NAME,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=UPLOAD_URL_TTL_SECONDS,
    )

    now = datetime.now(timezone.utc).isoformat()

    Music_table.put_item(
        Item={
            "songId": song_id,
            "title": title,
            "artist": artist,
            "s3Key": key,
            "contentType": content_type,
            "status": "pending",
            "uploadedBy": caller_sub,
            "uploadedAt": now,
        }
    )

    return _response(200, {"uploadUrl": upload_url, "key": key})

def list_songs(search, caller_sub):

    items = _scan_ready_songs()

    search = (search or "").strip().lower()
    if search:
        items = [
            item
            for item in items
            if search in (item.get("title") or "").lower()
            or search in (item.get("artist") or "").lower()
        ]

    names_by_sub = _resolve_user_names(item.get("uploadedBy") for item in items)
    songs = [_song_to_response(item, caller_sub, names_by_sub) for item in items]
    songs.sort(key=lambda s: s.get("uploadedAt") or "", reverse=True)

    return _response(200, songs)

def get_song(song_id, caller_sub):
    item = Music_table.get_item(Key={"songId": song_id}).get("Item")
    if not item or item.get("status") != "ready":
        return _response(404, {"message": f"song{song_id} not found"})

    names_by_sub = _resolve_user_names([item.get("uploadedBy")])
    return _response(200, _song_to_response(item, caller_sub, names_by_sub))


def update_song(song_id, body, caller_sub):

    title = body.get("title")
    artist = body.get("artist")
    title = title.strip() if isinstance(title, str) else None
    artist = artist.strip() if isinstance(artist, str) else None

    if not title and not artist:
        return _response(400, {"message": "Provide title and/or artist to update"})

    existing = Music_table.get_item(Key={"songId": song_id}).get("Item")
    if not existing:
        return _response(404, {"message": f"Song {song_id} not found"})
    if existing.get("uploadedBy") != caller_sub:
            return _response(403, {"message": "You can only edit songs you uploaded"})

    set_clauses = []
    expr_names = {}
    expr_values = {}

    if title:
        set_clauses.append("#title = :title")
        expr_names["#title"] = "title"
        expr_values[":title"] = title
    if artist:
        set_clauses.append("#artist = :artist")
        expr_names["#artist"] = "artist"
        expr_values[":artist"] = artist

    result = Music_table.update_item(
        Key={"songId": song_id},
        UpdateExpression="SET " + ", ".join(set_clauses),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
        ReturnValues="ALL_NEW",
    )

    names_by_sub = _resolve_user_names([result["Attributes"].get("uploadedBy")])

    return _response(200, _song_to_response(result["Attributes"], caller_sub, names_by_sub))

def delete_song(song_id, caller_sub):

    existing = Music_table.get_item(Key={"songId": song_id}).get("Item")
    if not existing:
        return _response(404, {"message": f"Song {song_id} not found"})
    if existing.get("uploadedBy") != caller_sub:
            return _response(403, {"message": "You can only delete songs you uploaded"})

    s3_key = existing.get("s3Key")
    if s3_key:
        s3.delete_object(Bucket=BUCKET_NAME, Key=s3_key)

    Music_table.delete_item(Key={"songId": song_id})

    return _response(200, {"message": f"Deleted {song_id}"})

def create_playlist(body, caller_sub):
    name = (body.get("name") or "").strip()
    if not name:
        return _response(400, {"message": "name is required"})

    playlist_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    Playlist_Table.put_item(
        Item={
            "playlistId": playlist_id,
            "ownerId": caller_sub,
            "name": name,
            "createdAt": now,
        }
    )

    return _response(
        201, {"playlistId": playlist_id, "name": name, "createdAt": now}
    )

def list_playlists(caller_sub):
    result = Playlist_Table.query(
            IndexName="ownerId-index",
            KeyConditionExpression=Key("ownerId").eq(caller_sub),
        )
    playlists = [
        {
            "playlistId": item["playlistId"],
            "name": item.get("name"),
            "createdAt": item.get("createdAt"),
        }
        for item in result.get("Items", [])
    ]
    playlists.sort(key=lambda p: p.get("createdAt") or "", reverse=True)

    return _response(200, playlists)

def get_playlist(playlist_id, caller_sub):
    playlist = Playlist_Table.get_item(Key={"playlistId": playlist_id}).get("Item")
    if not playlist:
        return _response(404, {"message": f"Playlist {playlist_id} not found"})
    if playlist.get("ownerId") != caller_sub:
        return _response(403, {"message": "This isn't your playlist"})

    membership = playlist_songs_table.query(
        KeyConditionExpression=Key("playlistId").eq(playlist_id)
    )
    song_ids = [row["songId"] for row in membership.get("Items", [])]

    song_items = _batch_get(SONGS_TABLE_NAME, "songId", song_ids)
    names_by_sub = _resolve_user_names(item.get("uploadedBy") for item in song_items)
    songs = [_song_to_response(item, caller_sub, names_by_sub) for item in song_items]
    songs.sort(key=lambda s: s.get("uploadedAt") or "", reverse=True)

    return _response(
        200,
        {
            "playlistId": playlist["playlistId"],
            "name": playlist.get("name"),
            "createdAt": playlist.get("createdAt"),
            "songs": songs,
        },
    )

def delete_playlist(playlist_id, caller_sub):
    playlist = Playlist_Table.get_item(Key={"playlistId": playlist_id}).get("Item")
    if not playlist:
        return _response(404, {"message": f"Playlist {playlist_id} not found"})
    if playlist.get("ownerId") != caller_sub:
        return _response(403, {"message": "This isn't your playlist"})

    membership = playlist_songs_table.query(
        KeyConditionExpression=Key("playlistId").eq(playlist_id)
    )
    with playlist_songs_table.batch_writer() as batch:
        for row in membership.get("Items", []):
            batch.delete_item(Key={"playlistId": playlist_id, "songId": row["songId"]})

    Playlist_Table.delete_item(Key={"playlistId": playlist_id})

    return _response(200, {"message": f"Deleted playlist {playlist_id}"})

def add_song_to_playlist(playlist_id, body, caller_sub):
    playlist = Playlist_Table.get_item(Key={"playlistId": playlist_id}).get("Item")
    if not playlist:
        return _response(404, {"message": f"Playlist {playlist_id} not found"})
    if playlist.get("ownerId") != caller_sub:
        return _response(403, {"message": "This isn't your playlist"})

    song_id = body.get("songId")
    if not song_id:
        return _response(400, {"message": "songId is required"})

    song = Music_table.get_item(Key={"songId": song_id}).get("Item")
    if not song or song.get("status") != "ready":
        return _response(404, {"message": f"Song {song_id} not found"})

    playlist_songs_table.put_item(
        Item={
            "playlistId": playlist_id,
            "songId": song_id,
            "addedAt": datetime.now(timezone.utc).isoformat(),
        }
    )

    return _response(200, {"message": "Added"})

def remove_song_from_playlist(playlist_id, song_id, caller_sub):
    """DELETE /playlists/{playlistId}/songs/{songId}"""
    playlist = Playlist_Table.get_item(Key={"playlistId": playlist_id}).get("Item")
    if not playlist:
        return _response(404, {"message": f"Playlist {playlist_id} not found"})
    if playlist.get("ownerId") != caller_sub:
        return _response(403, {"message": "This isn't your playlist"})

    playlist_songs_table.delete_item(Key={"playlistId": playlist_id, "songId": song_id})

    return _response(200, {"message": "Removed"})

def _scan_ready_songs():
    items = []
    scan_kwargs = {
        "FilterExpression": "#status = :ready",
        "ExpressionAttributeNames": {"#status": "status"},
        "ExpressionAttributeValues": {":ready": "ready"},
    }
    while True:
        result = Music_table.scan(**scan_kwargs)
        items.extend(result.get("Items", []))
        if "LastEvaluatedKey" not in result:
            break
        scan_kwargs["ExclusiveStartKey"] = result["LastEvaluatedKey"]
    return items

def _resolve_user_names(subs):
    unique_subs = list({s for s in subs if s})
    items = _batch_get(USERS_TABLE_NAME, "userId", unique_subs)
    return {item["userId"]: item.get("name") or item.get("email") for item in items}

def _batch_get(table_name, key_name, key_values):
    unique_values = list({v for v in key_values if v})
    if not unique_values:
        return []

    items = []
    for i in range(0, len(unique_values), BATCH_GET_CHUNK_SIZE):
        chunk = unique_values[i : i + BATCH_GET_CHUNK_SIZE]
        response = dynamodb.batch_get_item(
            RequestItems={table_name: {"Keys": [{key_name: v} for v in chunk]}}
        )
        items.extend(response.get("Responses", {}).get(table_name, []))
    return items

def _song_to_response(item, caller_sub, names_by_sub):
    audio_url = None
    if item.get("s3Key"):
        audio_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": item["s3Key"]},
            ExpiresIn=PLAYBACK_URL_TTL_SECONDS,
        )
    uploaded_by = item.get("uploadedBy")
    return {
        "songId": item["songId"],
        "title": item.get("title"),
        "artist": item.get("artist"),
        "audioUrl": audio_url,
        "uploadedAt": item.get("uploadedAt"),
        "uploaderName": names_by_sub.get(uploaded_by, "Unknown"),
        "isOwner": uploaded_by == caller_sub,
    }

def _sanitize_filename(name: str) -> str:
    name = name.strip().replace(" ", "-")
    return re.sub(r"[^A-Za-z0-9._-]", "", name) or "audio-file"

def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=str),
    }