import Equalizer from "./Equalizer";
import "./AuthScreen.css";

export default function AuthLayout({ children }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <Equalizer size="lg" active />
          <span className="auth-wordmark">JustVibes</span>
        </div>
        {children}
      </div>
    </div>
  );
}
