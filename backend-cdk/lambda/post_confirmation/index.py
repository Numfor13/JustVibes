import os
from datetime import datetime, timezone

import boto3

dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(os.environ["USERS_TABLE_NAME"])


def handler(event, context):
 
    attributes = event["request"]["userAttributes"]
    user_id = attributes["sub"]
    email = attributes.get("email")
    name = attributes.get("name", email)  # fall back to email if somehow missing

    users_table.put_item(
        Item={
            "userId": user_id,
            "name": name,
            "email": email,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
    )

    return event
