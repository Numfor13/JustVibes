import json
import os
from datetime import datetime, timezone
from urllib.parse import unquote_plus

import boto3

dynamodb = boto3.resource("dynamodb")

TABLE_NAME = os.environ["TABLE_NAME"]
table = dynamodb.Table(TABLE_NAME)


def _extract_song_id(key: str) -> str | None:
    
    parts = key.split("/")
    if len(parts) >= 3 and parts[0] == "uploads":
        return parts[1]
    return None

def handler(event, context):
    
    for sqs_record in event.get("Records", []):
        s3_event = json.loads(sqs_record["body"])

        for s3_record in s3_event.get("Records", []):
            bucket = s3_record["s3"]["bucket"]["name"]
            key = unquote_plus(s3_record["s3"]["object"]["key"])
            size = s3_record["s3"]["object"].get("size", 0)

            song_id = _extract_song_id(key)
            if not song_id:
                print(f"Skipping object with unexpected key shape: {key}")
                continue

            now = datetime.now(timezone.utc).isoformat()
            existing = table.get_item(Key={"songId": song_id}).get("Item")

            if existing:
                table.update_item(
                    Key={"songId": song_id},
                    UpdateExpression=(
                        "SET #status = :ready, s3Key = :key, "
                        "sizeBytes = :size, processedAt = :now"
                    ),
                    ExpressionAttributeNames={"#status": "status"},
                    ExpressionAttributeValues={
                        ":ready": "ready",
                        ":key": key,
                        ":size": size,
                        ":now": now,
                    },
                )
            else:
                fallback_title = key.split("/")[-1]
                table.put_item(
                    Item={
                        "songId": song_id,
                        "title": fallback_title,
                        "artist": "Unknown",
                        "s3Key": key,
                        "sizeBytes": size,
                        "status": "ready",
                        "uploadedAt": now,
                        "processedAt": now,
                    }
                )

            print(f"Processed song {song_id} ({key}, bucket={bucket})")

    return {"statusCode": 200}