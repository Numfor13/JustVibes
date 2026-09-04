import os
from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_lambda as _lambda,
    aws_cognito as cognito,
)
import aws_cdk.aws_cognito_identitypool_alpha as identitypool
from constructs import Construct


class CognitoStack(Stack):
    def __init__(self, scope: Construct, id: str, users_table, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.user_pool = cognito.UserPool(
            self,
            "MusicUserPool",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
                fullname=cognito.StandardAttribute(required=True, mutable=True),
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

        user_pool_google_provider = cognito.UserPoolIdentityProviderGoogle(
            self,
            "UserPoolGoogleProvider",
            user_pool=self.user_pool,
            client_id=os.environ.get("GOOGLE_CLIENT_ID"),
            client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
            attribute_mapping=cognito.AttributeMapping(
                email=cognito.ProviderAttribute.GOOGLE_EMAIL,
                fullname=cognito.ProviderAttribute.GOOGLE_NAME,
            ),
            scopes=["profile", "email", "openid"],
        )

        user_pool_client = self.user_pool.add_client(
            "MusicUserPoolClient",
            generate_secret=False,
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
            ),
            supported_identity_providers=[
                cognito.UserPoolClientIdentityProvider.GOOGLE
            ],
            
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(authorization_code_grant=True),
                callback_urls=[
                    "http://localhost:5173/oauth/callback",
                    "http://localhost:4173/oauth/callback",
                    "https://main.d3khbl8vtwgqvc.amplifyapp.com/" 
                ],
                logout_urls=[
                    "http://localhost:5173/login",
                    "http://localhost:4173/login",
                    "https://main.d3khbl8vtwgqvc.amplifyapp.com/login" 
                ]
            )
        )

        user_pool_client.node.add_dependency(user_pool_google_provider)

        user_pool_domain = self.user_pool.add_domain(
            "CognitoDomain",
            cognito_domain=cognito.CognitoDomainOptions(
                domain_prefix="justvibes"
            ),
        )

        identity_pool = identitypool.IdentityPool(
            self,
            "MusicIdentityPool",
            identity_pool_name="MusicIdentityPool_JustVibes",
            allow_unauthenticated_identities=True,
            authentication_providers=identitypool.IdentityPoolAuthenticationProviders(
                user_pools=[
                    identitypool.UserPoolAuthenticationProvider(
                        user_pool=self.user_pool,
                        user_pool_client=user_pool_client,
                    )
                ],
                google=identitypool.IdentityPoolGoogleLoginProvider(
                    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
                ),
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
                "USERS_TABLE_NAME": users_table.table_name,
            },
        )

        users_table.grant_write_data(post_confirmation_fn)
        self.user_pool.add_trigger(
            cognito.UserPoolOperation.POST_CONFIRMATION, post_confirmation_fn
        )

        CfnOutput(self, "UserPoolId",      value=self.user_pool.user_pool_id)
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id)
        CfnOutput(self, "UserPoolDomain",   value=user_pool_domain.domain_name)
        CfnOutput(self, "IdentityPoolId",   value=identity_pool.identity_pool_id)
