import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { exchangeCodeForTokens } from "../auth";
import { useAuth } from "../hooks/useAuth";

// Handles the redirect back from Cognito's hosted UI after Google sign-in.
// Extracts ?code=... from the URL, exchanges it for tokens, then sends
// the user to the app. Runs the exchange only once even in React strict mode.
export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { reloadSession } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error || !code) {
      navigate("/login", { replace: true });
      return;
    }

    exchangeCodeForTokens(code)
      .then(() => reloadSession())
      .then(() => navigate("/", { replace: true }))
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate, reloadSession]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      color: "var(--text-secondary)",
      fontSize: "0.9rem",
    }}>
      Signing you in…
    </div>
  );
}
