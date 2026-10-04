import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { dashboardPathForRole, useAuth } from "../context/AuthContext";

const links = [
  { to: "/dashboard", label: "Overview", icon: "◈", roles: ["admin", "manager", "cashier", "inventory_staff"] },
  { to: "/products", label: "Products", icon: "▦", roles: ["admin", "manager", "cashier", "inventory_staff"] },
  { to: "/stores", label: "Stores", icon: "⌖", roles: ["admin", "manager"] },
  { to: "/inventory", label: "Inventory", icon: "▤", roles: ["admin", "manager", "cashier", "inventory_staff"] },
  { to: "/sales", label: "Sales", icon: "↗", roles: ["admin", "manager", "cashier"] },
  { to: "/analytics", label: "Analytics", icon: "◒", roles: ["admin", "manager"] },
  { to: "/forecast", label: "Forecast", icon: "⌁", roles: ["admin", "manager"] },
  { to: "/replenishment", label: "Risk & stock", icon: "!", roles: ["admin", "manager"] },
  { to: "/stores-map", label: "Stores Map", icon: "◎", roles: ["admin", "manager"] },
];

const titles = {
  "/dashboard": "Operations overview",
  "/admin-dashboard": "Admin dashboard",
  "/manager-dashboard": "Manager dashboard",
  "/cashier-dashboard": "Sales overview",
  "/inventory-dashboard": "Inventory overview",
  "/user-management": "User Management",
  "/products": "Product catalog",
  "/stores": "Store network",
  "/inventory": "Inventory control",
  "/sales": "Sales ledger",
  "/analytics": "Business analytics",
  "/forecast": "Demand forecast",
  "/replenishment": "Inventory risk",
  "/stores-map": "Stores map",
};

const formatRole = (role) =>
  role
    ? role
        .split("_")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ")
    : "User";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 900);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("stocksense-theme") === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    document.documentElement.classList.toggle("theme-light", theme === "light");
    localStorage.setItem("stocksense-theme", theme);
  }, [theme]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (profileOpen && profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  const visibleLinks = useMemo(
    () => [
      ...links
        .filter((link) => link.roles.includes(user?.role))
        .map((link) => (link.label === "Overview" ? { ...link, to: dashboardPathForRole(user?.role || "admin") } : link)),
      ...(user?.role === "admin" ? [{ to: "/user-management", label: "User Management", icon: "＋" }] : []),
    ],
    [user]
  );

  const signOut = () => {
    setProfileOpen(false);
    logout();
    navigate("/login");
  };

  const currentPath = location.pathname;
  const pageTitle = titles[currentPath] || "StockSense";
  const isDark = theme === "dark";
  const initial = user?.name?.slice(0, 1).toUpperCase() || "U";

  return (
    <div className={`app-shell role-${user?.role || ""} page-${currentPath.slice(1)}`}>
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="menu-button"
            onClick={() => setSidebarOpen((value) => !value)}
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            title={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
          >
            <span aria-hidden="true">{sidebarOpen ? "×" : "☰"}</span>
          </button>

          <h1>{pageTitle}</h1>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span aria-hidden="true">{isDark ? "☀" : "🌙"}</span>
            <span>{isDark ? "Light" : "Dark"}</span>
          </button>

          <div className="user-menu-wrap" ref={profileRef}>
            <button
              type="button"
              className="user-chip"
              onClick={() => setProfileOpen((value) => !value)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-controls="profile-menu"
            >
              <span className="avatar">{initial}</span>
              <span className="user-details">
                <b>{user?.name || "Operator"}</b>
                <small>{user?.email || "No email available"}</small>
                <small>{formatRole(user?.role)}</small>
              </span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown" id="profile-menu" role="menu" aria-label="Profile menu">
                <div className="profile-header">
                  <span className="avatar avatar-large">{initial}</span>
                  <div className="profile-header-copy">
                    <strong>{user?.name || "Operator"}</strong>
                    <span>{user?.email || "No email available"}</span>
                    <small>{formatRole(user?.role)}</small>
                  </div>
                </div>

                <div className="profile-divider" />

                <div className="profile-menu-list" role="none">
                  <NavLink to={dashboardPathForRole(user?.role || "admin")} className="profile-menu-item" onClick={() => setProfileOpen(false)}>
                    <span aria-hidden="true">◈</span>
                    Overview
                  </NavLink>

                  {user?.role === "admin" && (
                    <NavLink to="/user-management" className="profile-menu-item" onClick={() => setProfileOpen(false)}>
                      <span aria-hidden="true">＋</span>
                      User Management
                    </NavLink>
                  )}
                </div>

                <div className="profile-divider" />

                <button type="button" className="profile-logout" onClick={signOut}>
                  <span aria-hidden="true">↪</span>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-body">
        <aside
          id="app-sidebar"
          className={`sidebar ${sidebarOpen ? "open" : ""}`}
          aria-label="Sidebar navigation"
          aria-hidden={!sidebarOpen}
        >
          <div className="workspace-label">Workspace</div>

          <nav>
            {visibleLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/dashboard" || link.to === dashboardPathForRole(user?.role)}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <span>{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <div className="status-line">
              <span className="pulse" />
              System connected
            </div>

            <button type="button" className="logout" onClick={signOut}>
              ↪ <span>Sign out</span>
            </button>
          </div>
        </aside>

        {sidebarOpen && <button type="button" className="scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

        <main className="main-area">
          <div className="page-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
