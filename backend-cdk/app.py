#!/usr/bin/env python3
import aws_cdk as cdk
from dotenv import load_dotenv
load_dotenv()

from music_backend.music_backend_stack import MusicStack2
from music_backend.cognito_stack import CognitoStack
from music_backend.Api_Gateway_stack import ApiGatewayStack

app = cdk.App()

StackOne = MusicStack2(
    app,
    "MusicStack",
    
)

StackTwo = CognitoStack(
    app,
    "CognitoStack",
    users_table = StackOne.Users_table,
  
)

StackThree = ApiGatewayStack(
    app,
    "ApiGatewayStack",
    user_pool=StackTwo.user_pool,
    api_handler=StackOne.api_handler,
   
)

app.synth()
