
import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import ThemeToggle from "./ThemeToggle";
import "./Navbar.css";

function Navbar() {
  return (
    <header className="site-navbar">
      <nav className="site-navbar-inner" aria-label="Main navigation">
        <Link to="/" className="site-navbar-brand" aria-label="GDG KAUHOOT home">
          <BrandLogo />
        </Link>

        <div className="site-navbar-actions">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
