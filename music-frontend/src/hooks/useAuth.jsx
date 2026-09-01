import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as auth from "../auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState("checking"); // checking | signedOut | signedIn
  const [email, setEmail] = useState(null);
  const [name, setName] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await auth.getValidIdToken();
      if (cancelled) return;
      if (token) {
        setEmail(auth.getEmailFromToken(token));
        setName(auth.getNameFromToken(token));
        setStatus("signedIn");
      } else {
        setStatus("signedOut");
      }
    })();

    // api.js dispatches this if a request comes back 401 mid-session
    // (e.g. the refresh token itself finally expired).
    const onUnauthorized = () => {
      setEmail(null);
      setName(null);
      setStatus("signedOut");
    };
    window.addEventListener("justvibes:unauthorized", onUnauthorized);

    return () => {
      cancelled = true;
      window.removeEventListener("justvibes:unauthorized", onUnauthorized);
    };
  }, []);

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
  }, []);

  const value = {
    status,
    email,
    name,
    signIn,
    signOut,
    signUp: auth.signUp,
    confirmSignUp: auth.confirmSignUp,
    resendCode: auth.resendConfirmationCode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
