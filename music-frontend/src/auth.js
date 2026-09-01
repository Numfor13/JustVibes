// Talks to Cognito's IdP JSON API directly. SignUp / ConfirmSignUp /
// InitiateAuth (USER_PASSWORD_AUTH & REFRESH_TOKEN_AUTH) are public,
// unauthenticated actions — no SigV4 signing or AWS credentials required,
// which is why this is a plain fetch instead of pulling in the full AWS SDK.

const REGION = import.meta.env.VITE_AWS_REGION;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const COGNITO_ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;

const SESSION_KEY = "justvibes.session";
const REFRESH_BUFFER_MS = 60_000; // refresh 1 min before actual expiry

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
    // Cognito error shape: { __type: "UsernameExistsException", message: "..." }
    throw new Error(data.message || data.__type || `Request failed (${res.status})`);
  }

  return data;
}

function storeSession(result, fallbackRefreshToken) {
  if (!result) return;
  const expiresAt = Date.now() + (result.ExpiresIn ?? 3600) * 1000;
  const session = {
    idToken: result.IdToken,
    accessToken: result.AccessToken,
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

export function getEmailFromToken(idToken) {
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export function getNameFromToken(idToken) {
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    return payload.name ?? null;
  } catch {
    return null;
  }
}

/** POST /signup equivalent — self-service registration. */
export function signUp(email, password, name) {
  return cognitoRequest("SignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "name", Value: name },
    ],
  });
}

/** Verifies the emailed confirmation code. */
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

/** Signs in and stores the resulting tokens. Returns the raw AuthenticationResult. */
export async function signIn(email, password) {
  const data = await cognitoRequest("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  return storeSession(data.AuthenticationResult);
}

async function refreshSession(refreshToken) {
  const data = await cognitoRequest("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });
  // A refresh response never includes a new refresh token — keep the old one.
  return storeSession(data.AuthenticationResult, refreshToken);
}

/**
 * Returns a currently-valid idToken, transparently refreshing it if it's
 * expired or about to be. Returns null if there's no session (or the
 * refresh token itself has expired), meaning the user needs to sign in.
 */
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
    return refreshed.idToken;
  } catch {
    clearSession();
    return null;
  }
}
