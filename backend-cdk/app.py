#!/usr/bin/env python3
import aws_cdk as cdk

from music_backend.music_backend_stack import MusicStack

app = cdk.App()

MusicStack(
    app,
    "MusicStack",
    # env=cdk.Environment(account="YOUR_ACCOUNT_ID", region="us-east-1"),
)

app.synth()
