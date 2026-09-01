import { useState } from "react";
import { LogIn, UserPlus, KeyRound } from "lucide-react";
import Equalizer from "./Equalizer";
import { useAuth } from "../hooks/useAuth";
import "./Modal.css";
import "./AuthScreen.css";

// "signIn" | "signUp" | "confirm"
export default function AuthScreen() {
  const { signIn, signUp, confirmSignUp, resendCode } = useAuth();

  const [mode, setMode] = useState("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function handleSignIn(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message || "Couldn't sign in. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signUp(email.trim(), password, name.trim());
      setMode("confirm");
      setNotice(`We sent a verification code to ${email.trim()}.`);
    } catch (err) {
      setError(err.message || "Couldn't create your account.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await confirmSignUp(email.trim(), code.trim());
      setNotice("Verified — sign in to continue.");
      setMode("signIn");
      setPassword("");
      setCode("");
    } catch (err) {
      setError(err.message || "That code didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    try {
      await resendCode(email.trim());
      setNotice(`Sent a new code to ${email.trim()}.`);
    } catch (err) {
      setError(err.message || "Couldn't resend the code.");
    }
  }

  function switchMode(next) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <Equalizer size="lg" active />
          <span className="auth-wordmark">JustVibes</span>
        </div>

        {mode === "signIn" && (
          <>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to reach your library.</p>

            <form onSubmit={handleSignIn}>
              <div className="field">
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={busy}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={busy}
                  required
                />
              </div>

              {notice && <p className="field-notice">{notice}</p>}
              {error && <p className="field-error">{error}</p>}

              <button type="submit" className="btn btn--primary auth-submit" disabled={busy}>
                <LogIn size={16} />
                <span>{busy ? "Signing in…" : "Sign in"}</span>
              </button>
            </form>

            <p className="auth-switch">
              New here?{" "}
              <button type="button" onClick={() => switchMode("signUp")}>
                Create an account
              </button>
            </p>
          </>
        )}

        {mode === "signUp" && (
          <>
            <h1 className="auth-title">Create your account</h1>
            

            <form onSubmit={handleSignUp}>
              <div className="field">
                <label htmlFor="auth-name">User name</label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  autoComplete="name"
                  disabled={busy}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={busy}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  minLength={8}
                  disabled={busy}
                  required
                />
                <p className="auth-subtitle">At least 8 characters, with a mix of cases and a number.</p>
              </div>

              {error && <p className="field-error">{error}</p>}

              <button type="submit" className="btn btn--primary auth-submit" disabled={busy}>
                <UserPlus size={16} />
                <span>{busy ? "Creating account…" : "Create account"}</span>
              </button>
            </form>

            <p className="auth-switch">
              Already have an account?{" "}
              <button type="button" onClick={() => switchMode("signIn")}>
                Sign in
              </button>
            </p>
          </>
        )}

        {mode === "confirm" && (
          <>
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle">Enter the verification code we sent to {email}.</p>

            <form onSubmit={handleConfirm}>
              <div className="field">
                <label htmlFor="auth-code">Verification code</label>
                <input
                  id="auth-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  disabled={busy}
                  required
                />
              </div>

              {notice && <p className="field-notice">{notice}</p>}
              {error && <p className="field-error">{error}</p>}

              <button type="submit" className="btn btn--primary auth-submit" disabled={busy}>
                <KeyRound size={16} />
                <span>{busy ? "Verifying…" : "Verify"}</span>
              </button>
            </form>

            <p className="auth-switch">
              Didn't get a code?{" "}
              <button type="button" onClick={handleResend}>
                Resend
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
