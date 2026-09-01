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
    aws_apigateway as apigw,
    aws_cognito as cognito,
)
from constructs import Construct


class MusicStack(Stack):
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

       #Users
        Users_table = dynamodb.Table(
            self,
            "UsersTable",
            table_name = "Users",
            partition_key=dynamodb.Attribute(
                name = "userId", type = dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        Playlist_Table = dynamodb.Table(
            self,
            "Playlist_Table",
            table_name = "Playlists",
            partition_key = dynamodb.Attribute(
                name= "playlistId", type = dynamodb.AttributeType.STRING,
            ),
            billing_mode = dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy= RemovalPolicy.DESTROY
        )

        Playlist_Table.add_global_secondary_index(
            index_name="ownerId-index",
            partition_key = dynamodb.Attribute(
                name = "ownerId", type =  dynamodb.AttributeType.STRING,
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

        #Cognito
        user_pool = cognito.UserPool(
            self,
            "MusicUserPool",
                self_sign_up_enabled=True,
                sign_in_aliases=cognito.SignInAliases(email=True),
                auto_verify=cognito.AutoVerifiedAttrs(email=True),
                standard_attributes=cognito.StandardAttributes(
                    email=cognito.StandardAttribute(required=True, mutable=True),
                    fullname = cognito.StandardAttribute(required=True, mutable=True),
                ),
                password_policy=cognito.PasswordPolicy(
                    min_length=8,
                    require_lowercase=True,
                    require_uppercase=True,
                    require_digits=True,
                    require_symbols=False,
                ),
                account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
                removal_policy=RemovalPolicy.DESTROY,
            )

        user_pool_client = user_pool.add_client(
            "MusicUserPoolClient",
            generate_secret=False,  
            auth_flows=cognito.AuthFlow(
            user_password=True,  
            ),  
        )

        post_confirmation_fn = _lambda.Function(
            self,
            "PostConfirmationFn",
            runtime=_lambda.Runtime.PYTHON_3_13,
            handler="index.handler",
            code=_lambda.Code.from_asset("lambda/post_confirmation"),
            architecture=_lambda.Architecture.ARM_64,
            timeout=Duration.seconds(10),
            environment={
                "USERS_TABLE_NAME": Users_table.table_name,
            },
        )

        Users_table.grant_write_data(post_confirmation_fn)
        user_pool.add_trigger(
            cognito.UserPoolOperation.POST_CONFIRMATION, post_confirmation_fn
        )


        # API handler Lambda 
        api_handler = _lambda.Function(
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
                "USERS_TABLE_NAME": Users_table.table_name,
                "PLAYLISTS_TABLE_NAME": Playlist_Table.table_name,
                "PLAYLIST_SONGS_TABLE_NAME": playlist_songs_table.table_name,
            },
        )
        Music_bucket.grant_put(api_handler)
        Music_bucket.grant_read(api_handler)
        Music_bucket.grant_delete(api_handler)
        Music_table.grant_read_write_data(api_handler)
        Users_table.grant_read_data(api_handler)
        Playlist_Table.grant_read_write_data(api_handler)
        playlist_songs_table.grant_read_write_data(api_handler)



        # Lambda  (SQS-triggered)

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

        # API Gateway 
        api = apigw.LambdaRestApi(
            self,
            "MusicApi",
            handler=api_handler,
            proxy=False,
            rest_api_name="My music",
            deploy_options=apigw.StageOptions(stage_name="DEV"),
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,  
                allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        authorizer = apigw.CognitoUserPoolsAuthorizer(
                    self,
                    "MusicApiAuthorizer",
                    cognito_user_pools=[user_pool],
                    )
        auth_method_options = {
                    "authorization_type": apigw.AuthorizationType.COGNITO,
                    "authorizer": authorizer,
                }

        cors_gateway_response_headers = {
            "Access-Control-Allow-Origin": "'*'",
            "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
        }

        api.add_gateway_response(
            "Default4xxCors",
            type=apigw.ResponseType.DEFAULT_4_XX,
            response_headers=cors_gateway_response_headers,
        )
        api.add_gateway_response(
            "Default5xxCors",
            type=apigw.ResponseType.DEFAULT_5_XX,
            response_headers=cors_gateway_response_headers,
        )

        # /songs


        # api_key = api.add_api_key("MusicApiKey")
        # usage_plan = api.add_usage_plan(
        #     "MusicApiUsagePlan",
        #     throttle=apigw.ThrottleSettings(rate_limit=10, burst_limit=20),
        # )
        # usage_plan.add_api_key(api_key)
        # usage_plan.add_api_stage(stage=api.deployment_stage)

        # /songs
        songs_resource = api.root.add_resource("songs")
        songs_resource.add_method("GET", **auth_method_options) 

        # /songs/upload-url
        upload_url_resource = songs_resource.add_resource("upload-url")
        upload_url_resource.add_method(
            "POST", **auth_method_options
            #api_key_required=True
        )  

        # /songs/{songId}
        song_resource = songs_resource.add_resource("{songId}")
        song_resource.add_method("GET",**auth_method_options)
        song_resource.add_method("PUT",**auth_method_options
        #api_key_required=True
        )  
        song_resource.add_method("DELETE", **auth_method_options
                                 #api_key_required=True
        )  


        # /playlists
        playlists_resource = api.root.add_resource("playlists")
        playlists_resource.add_method(
            "GET", **auth_method_options
        )  
        playlists_resource.add_method(
            "POST", **auth_method_options
        )  

        # /playlists/{playlistId}
        playlist_resource = playlists_resource.add_resource("{playlistId}")
        playlist_resource.add_method(
            "GET", **auth_method_options
        ) 
        playlist_resource.add_method(
            "DELETE", **auth_method_options
        )  

        # /playlists/{playlistId}/songs
        playlist_songs_resource = playlist_resource.add_resource("songs")
        playlist_songs_resource.add_method(
            "POST", **auth_method_options
        )  

        # /playlists/{playlistId}/songs/{songId}
        playlist_song_resource = playlist_songs_resource.add_resource("{songId}")
        playlist_song_resource.add_method(
            "DELETE", **auth_method_options
        )  


        #Outputs

        CfnOutput(self, "ApiUrl", value=api.url)

        # CfnOutput(self, "ApiKeyId", value=api_key.key_id)

        CfnOutput(self, "AudioBucketName", value=Music_bucket.bucket_name)

        CfnOutput(self, "SongsTableName", value=Music_table.table_name)

        CfnOutput(self, "UsersTableName", value=Users_table.table_name)

        CfnOutput(self, "PlaylistsTableName", value=Playlist_Table.table_name)

        CfnOutput(self, "PlaylistSongsTableName", value=playlist_songs_table.table_name)

        CfnOutput(self, "UploadQueueUrl", value=upload_queue.queue_url)

        CfnOutput(self, "DeadLetterQueueUrl", value=Music_SQS.queue_url)

        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id)

        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id)