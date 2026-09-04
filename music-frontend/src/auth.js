import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";

const REGION     = import.meta.env.VITE_AWS_REGION;
const CLIENT_ID  = import.meta.env.VITE_COGNITO_CLIENT_ID;
const COGNITO_DOMAIN   = import.meta.env.VITE_COGNITO_DOMAIN;
const COGNITO_ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;

const SESSION_KEY      = "justvibes.session";
const REFRESH_BUFFER_MS = 60_000; // refresh 1 min before actual expiry

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_USER_POOL_ID,
  ClientId: CLIENT_ID,
});
// ─── Cognito JSON API (email/password) ───────────────────────────────────────

async function cognitoRequest(action, body) {
  const res = await fetch(COGNITO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Cognito error shape: { __type: "NotAuthorizedException", message: "..." }
    throw new Error(data.message || data.__type || `Request failed (${res.status})`);
  }

  return data;
}

// ─── Session storage ──────────────────────────────────────────────────────────

function storeSession(result, fallbackRefreshToken) {
  if (!result) return null;
  const expiresAt = Date.now() + (result.ExpiresIn ?? 3600) * 1000;
  const session = {
    idToken:      result.IdToken,
    accessToken:  result.AccessToken,
    refreshToken: result.RefreshToken ?? fallbackRefreshToken,
    expiresAt,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function decodeToken(idToken) {
  try {
    return JSON.parse(atob(idToken.split(".")[1]));
  } catch {
    return {};
  }
}

export const getEmailFromToken = (idToken) => decodeToken(idToken).email ?? null;
export const getNameFromToken  = (idToken) => decodeToken(idToken).name  ?? null;

// ─── Email / password auth ────────────────────────────────────────────────────

export function signUp(email, password, name) {
  return cognitoRequest("SignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "name",  Value: name  },
    ],
  });
}

export function confirmSignUp(email, code) {
  return cognitoRequest("ConfirmSignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  });
}

export function resendConfirmationCode(email) {
  return cognitoRequest("ResendConfirmationCode", {
    ClientId: CLIENT_ID,
    Username: email,
  });
}

export async function signIn(email, password) {
  _refreshInFlight = null;

  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    user.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve(storeSession({
          IdToken:      session.getIdToken().getJwtToken(),
          AccessToken:  session.getAccessToken().getJwtToken(),
          RefreshToken: session.getRefreshToken().getToken(),
          ExpiresIn:    3600,
        }));
      },
      onFailure: (err) => reject(new Error(err.message || "Sign in failed")),
    });
  });
}

// ─── Google OAuth (Cognito Hosted UI redirect) ────────────────────────────────

export function initiateGoogleSignIn() {
  const redirectUri = encodeURIComponent(`${window.location.origin}/oauth/callback`);
  const url =
    `${COGNITO_DOMAIN}/oauth2/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&scope=openid+email+profile` +
    `&identity_provider=Google` +
    `&redirect_uri=${redirectUri}`;
  window.location.href = url;
}

export async function exchangeCodeForTokens(code) {
  const redirectUri = `${window.location.origin}/oauth/callback`;
  const params = new URLSearchParams({
    grant_type:   "authorization_code",
    client_id:    CLIENT_ID,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "OAuth token exchange failed");

  return storeSession({
    IdToken:      data.id_token,
    AccessToken:  data.access_token,
    RefreshToken: data.refresh_token,
    ExpiresIn:    data.expires_in,
  });
}

// ─── Session refresh — deduplicated ──────────────────────────────────────────
//
// React StrictMode mounts effects twice in development, which means two
// concurrent getValidIdToken() calls can race and both try to use the refresh
// token at the same time. Cognito refresh tokens are single-use, so the second
// request always gets a 400. We fix this by sharing a single in-flight promise:
// if a refresh is already running, every concurrent caller waits on the same
// promise instead of starting a new one.

let _refreshInFlight = null;

async function refreshSession(refreshToken) {
  if (_refreshInFlight) return _refreshInFlight;

  _refreshInFlight = cognitoRequest("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  })
    .then((data) => storeSession(data.AuthenticationResult, refreshToken))
    .finally(() => { _refreshInFlight = null; });

  return _refreshInFlight;
}

export async function getValidIdToken() {
  const session = loadSession();
  if (!session) return null;

  if (Date.now() < session.expiresAt - REFRESH_BUFFER_MS) {
    return session.idToken;
  }

  if (!session.refreshToken) {
    clearSession();
    return null;
  }

  try {
    const refreshed = await refreshSession(session.refreshToken);
    return refreshed?.idToken ?? null;
  } catch {
    clearSession();
    return null;
  }
}
