import os
from aws_cdk import(
    Stack,
    aws_apigateway as apigw,
    CfnOutput,
)
from constructs import Construct

class ApiGatewayStack(Stack):
    def __init__(self, scope: Construct, id: str, api_handler, user_pool, **kwargs):
        super().__init__(scope, id, **kwargs)

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
        cover_upload_url_resource = song_resource.add_resource("cover-upload-url")
        cover_upload_url_resource.add_method("POST", **auth_method_options)


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

        CfnOutput(self, "ApiUrl", value=api.url)