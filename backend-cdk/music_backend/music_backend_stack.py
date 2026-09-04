import os
from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_s3 as s3,
    aws_s3_notifications as s3n,
    aws_sqs as sqs,
    aws_dynamodb as dynamodb,
    aws_lambda as _lambda,
    aws_lambda_event_sources as lambda_events,
   
)
from constructs import Construct


class MusicStack2(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        #S3
        Music_bucket = s3.Bucket(
            self,
            "SongsBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            cors=[
                s3.CorsRule(
                    allowed_methods=[s3.HttpMethods.PUT, s3.HttpMethods.GET],
                    allowed_origins=["*"],  
                    allowed_headers=["*"],
                    max_age=3000,
                )
            ],
            removal_policy=RemovalPolicy.DESTROY, 
            auto_delete_objects=True
        )

        #DynamoDB
        Music_table = dynamodb.Table(
            self,
            "SongsTable",
            table_name="Songs",
            partition_key=dynamodb.Attribute(
                name="songId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # FIX 1: was a local variable — now exposed as self.Users_table so app.py can access it
        self.Users_table = dynamodb.Table(
            self,
            "UsersTable",
            table_name="Users",
            partition_key=dynamodb.Attribute(
                name="userId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        Playlist_Table = dynamodb.Table(
            self,
            "Playlist_Table",
            table_name="Playlists",
            partition_key=dynamodb.Attribute(
                name="playlistId", type=dynamodb.AttributeType.STRING,
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY
        )

        Playlist_Table.add_global_secondary_index(
            index_name="ownerId-index",
            partition_key=dynamodb.Attribute(
                name="ownerId", type=dynamodb.AttributeType.STRING,
            ),
        )

        #Playlist Songs Table (The bridge between playlist table and songs table)
        playlist_songs_table = dynamodb.Table(
            self,
            "PlaylistSongsTable",
            table_name="PlaylistSongs",
            partition_key=dynamodb.Attribute(
                name="playlistId", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="songId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        #SQS
        Music_SQS = sqs.Queue(
            self,
            "SongUploadDLQ",
            retention_period=Duration.days(14),
        )

        upload_queue = sqs.Queue(
            self,
            "SongUploadQueue",
            visibility_timeout=Duration.seconds(60), 
            dead_letter_queue=sqs.DeadLetterQueue(
                max_receive_count=3,
                queue=Music_SQS,
            ),
        )

        # Event notification from S3 to SQS 
        Music_bucket.add_event_notification(
            s3.EventType.OBJECT_CREATED,
            s3n.SqsDestination(upload_queue),
            s3.NotificationKeyFilter(prefix="uploads/"),
        )

        # FIX 2: was a local variable — now exposed as self.api_handler so app.py can access it
        self.api_handler = _lambda.Function(
            self,
            "ApiHandlerFn",
            runtime=_lambda.Runtime.PYTHON_3_13,
            handler="index.handler",
            code=_lambda.Code.from_asset("lambda/api_handler"),
            architecture=_lambda.Architecture.ARM_64,
            timeout=Duration.seconds(10),
            memory_size=128,
            environment={
                "BUCKET_NAME": Music_bucket.bucket_name,
                "TABLE_NAME": Music_table.table_name,
                "USERS_TABLE_NAME": self.Users_table.table_name,
                "PLAYLISTS_TABLE_NAME": Playlist_Table.table_name,
                "PLAYLIST_SONGS_TABLE_NAME": playlist_songs_table.table_name,
            },
        )
        Music_bucket.grant_put(self.api_handler)
        Music_bucket.grant_read(self.api_handler)
        Music_bucket.grant_delete(self.api_handler)
        Music_table.grant_read_write_data(self.api_handler)
        self.Users_table.grant_read_data(self.api_handler)
        Playlist_Table.grant_read_write_data(self.api_handler)
        playlist_songs_table.grant_read_write_data(self.api_handler)

        # Lambda (SQS-triggered)
        process_upload_fn = _lambda.Function(
            self,
            "ProcessSongUploadFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="index.handler",
            code=_lambda.Code.from_asset("lambda/process_song_upload"),
            timeout=Duration.seconds(30),
            environment={
                "TABLE_NAME": Music_table.table_name,
            },
        )
        Music_table.grant_read_write_data(process_upload_fn)
        process_upload_fn.add_event_source(
            lambda_events.SqsEventSource(upload_queue, batch_size=5)
        )

        #Outputs
        CfnOutput(self, "AudioBucketName", value=Music_bucket.bucket_name)
        CfnOutput(self, "SongsTableName", value=Music_table.table_name)
        CfnOutput(self, "UsersTableName", value=self.Users_table.table_name)
        CfnOutput(self, "PlaylistsTableName", value=Playlist_Table.table_name)
        CfnOutput(self, "PlaylistSongsTableName", value=playlist_songs_table.table_name)
        CfnOutput(self, "UploadQueueUrl", value=upload_queue.queue_url)
        CfnOutput(self, "DeadLetterQueueUrl", value=Music_SQS.queue_url)
