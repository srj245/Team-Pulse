import { useEffect, useState } from "react";
import { ArrowRight, LogOut, UserCircle2 } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { logoutUser } from "../lib/api";
import { getStoredUser, SESSION_EVENT } from "../lib/session";
import { buttonStyles, cn } from "../lib/ui";

export function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    const syncUser = () => {
      setUser(getStoredUser());
    };

    window.addEventListener(SESSION_EVENT, syncUser);
    return () => window.removeEventListener(SESSION_EVENT, syncUser);
  }, []);

  async function handleLogout() {
    await logoutUser();
    navigate("/signin");
  }

  const navLinkClassName = ({ isActive }) =>
    cn("transition-colors hover:text-white", isActive ? "text-white" : "text-gray-400");

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#0a0a0a]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tighter text-white">
            Validation<span className="text-accent-cyan text-glow">Engine</span>
          </span>
        </Link>

        <div className="hidden gap-7 text-sm font-medium md:flex">
          <NavLink to="/#features" className={navLinkClassName}>
            Features
          </NavLink>
          <NavLink to="/dashboard" className={navLinkClassName}>
            Dashboard
          </NavLink>
          <NavLink to="/about" className={navLinkClassName}>
            About
          </NavLink>
          <NavLink to="/contact" className={navLinkClassName}>
            Contact
          </NavLink>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/profile"
                className={cn(buttonStyles("secondary"), "hidden py-2.5 pl-4 pr-5 sm:inline-flex")}
              >
                <UserCircle2 className="h-4 w-4" />
                {user.name || user.email}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className={cn(buttonStyles("ghost"), "px-4 py-2.5 text-sm")}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                className={cn(buttonStyles("secondary"), "hidden py-2.5 px-5 sm:inline-flex")}
              >
                Sign in
              </Link>
              <Link to="/signup" className={cn(buttonStyles("primary"), "py-2.5 px-5")}>
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
