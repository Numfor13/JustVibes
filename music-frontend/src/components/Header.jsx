import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import Equalizer from "./Equalizer";
import "./Header.css";

export default function Header({ name, email, onSignOut }) {
  return (
    <header className="header">
      <div className="header__brand">
        <Equalizer size="sm" active />
        <span className="header__wordmark">JustVibes</span>
      </div>

      <nav className="header__nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `header__nav-link ${isActive ? "header__nav-link--active" : ""}`}
        >
          Library
        </NavLink>
        <NavLink
          to="/playlists"
          className={({ isActive }) => `header__nav-link ${isActive ? "header__nav-link--active" : ""}`}
        >
          Playlists
        </NavLink>
      </nav>

      <div className="header__account">
        <span className="header__email" title={email}>
          {name || email}
        </span>
        <button className="header__signout-btn" onClick={onSignOut} aria-label="Sign out" >
          Sign out 
        </button> 
      </div>
    </header>
  );
}
