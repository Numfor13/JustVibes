import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as auth from "../auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // checking | signedOut | signedIn
  const [email,  setEmail]  = useState(null);
  const [name,   setName]   = useState(null);

  // Reads tokens from localStorage and hydrates state.
  // Also called by OAuthCallbackPage after Google token exchange.
  const reloadSession = useCallback(async () => {
    const token = await auth.getValidIdToken();
    if (token) {
      setEmail(auth.getEmailFromToken(token));
      setName(auth.getNameFromToken(token));
      setStatus("signedIn");
    } else {
      setEmail(null);
      setName(null);
      setStatus("signedOut");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // getValidIdToken is deduplicated inside auth.js, so the StrictMode
    // double-invoke only ever fires one network request.
    auth.getValidIdToken().then((token) => {
      if (cancelled) return;
      if (token) {
        setEmail(auth.getEmailFromToken(token));
        setName(auth.getNameFromToken(token));
        setStatus("signedIn");
      } else {
        setStatus("signedOut");
      }
    });

    // api.js dispatches this when any request returns 401 mid-session.
    function onUnauthorized() {
      auth.clearSession();
      setEmail(null);
      setName(null);
      setStatus("signedOut");
      navigate("/login", { replace: true });
    }

    window.addEventListener("justvibes:unauthorized", onUnauthorized);

    return () => {
      cancelled = true;
      window.removeEventListener("justvibes:unauthorized", onUnauthorized);
    };
  }, [navigate]);

  const signIn = useCallback(async (emailInput, password) => {
    const session = await auth.signIn(emailInput, password);
    setEmail(auth.getEmailFromToken(session.idToken));
    setName(auth.getNameFromToken(session.idToken));
    setStatus("signedIn");
  }, []);

  const signOut = useCallback(() => {
    auth.clearSession();
    setEmail(null);
    setName(null);
    setStatus("signedOut");
    navigate("/login", { replace: true });
  }, [navigate]);

  const value = {
    status,
    email,
    name,
    signIn,
    signOut,
    reloadSession,
    signUp:        auth.signUp,
    confirmSignUp: auth.confirmSignUp,
    resendCode:    auth.resendConfirmationCode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
