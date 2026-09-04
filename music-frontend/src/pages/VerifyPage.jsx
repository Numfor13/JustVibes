import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../hooks/useAuth";
import "./VerifyPage.css";

export default function VerifyPage() {
  const { confirmSignUp, resendCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Email comes via navigation state from SignUpPage
  const [email, setEmail] = useState(location.state?.email ?? "");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null);
  const [resendNotice, setResendNotice] = useState(null);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleDigitChange(idx, val) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    setError(null);

    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  }

  function handleKeyDown(idx, e) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = [...digits];
    pasted.split("").forEach((ch, i) => { if (i < 6) next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  const code = digits.join("");
  const codeComplete = code.length === 6;

  async function handleVerify(e) {
    e.preventDefault();
    if (!codeComplete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await confirmSignUp(email.trim(), code);
      sessionStorage.setItem("justvibes.notice", "Account verified — welcome to JustVibes.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message || "That code didn't work. Check and try again.");
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    setError(null);
    setResendNotice(null);
    try {
      await resendCode(email.trim());
      setResendNotice(`New code sent to ${email}.`);
    } catch (err) {
      setError(err.message || "Couldn't resend the code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout>
      <button
        type="button"
        className="verify-back"
        onClick={() => navigate("/signup")}
      >
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="verify-icon">
        <Mail size={28} strokeWidth={1.5} />
      </div>

      <h1 className="auth-title">Check your inbox</h1>
      <p className="auth-subtitle verify-subtitle">
        We sent a 6-digit code to <strong>{email || "your email"}</strong>.
        Enter it below to verify your account.
      </p>

      {/* Email field if they arrived directly (no state) */}
      {!location.state?.email && (
        <div className="field">
          <label htmlFor="verify-email">Email address</label>
          <input
            id="verify-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
            required
          />
        </div>
      )}

      <form onSubmit={handleVerify}>
        <div className="verify-digits" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              className={`verify-digit ${d ? "verify-digit--filled" : ""}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={busy}
              aria-label={`Digit ${i + 1} of 6`}
            />
          ))}
        </div>

        {resendNotice && <p className="field-notice verify-notice">{resendNotice}</p>}
        {error && <p className="field-error verify-error">{error}</p>}

        <button
          type="submit"
          className="btn btn--primary auth-submit"
          disabled={!codeComplete || busy}
        >
          {busy ? "Verifying…" : "Verify account"}
        </button>
      </form>

      <p className="auth-switch verify-resend">
        Didn't receive a code?{" "}
        <button type="button" onClick={handleResend} disabled={resending}>
          {resending ? "Sending…" : "Resend code"}
        </button>
      </p>
    </AuthLayout>
  );
}
