import "./sidebar.css"
import { Link, NavLink } from "react-router-dom";
import ProfileMenu from "../profileMenu/profileMenu.jsx"
import { useAuth } from "../AuthContext/authContext.jsx"
import getInitials from "../../utils/getInitials.js"
import formatPlan from "../../utils/formatPlan.js"

const baseLinks = [
  { name: "Home", icon: "⌂", to: "/dashboard" },
  { name: "Create", icon: "✎", to: "/createpage" },
  { name: "Publish", icon: "▦", to: "/publishpage" },
];

function Sidebar() {
  const { user } = useAuth()
  const displayName = typeof user?.name === "string" && user.name.trim()
    ? user.name.trim()
    : "User"
  const links = user?.role === "admin"
    ? [...baseLinks, { name: "Admin", icon: "⚙", to: "/admin" }]
    : baseLinks

  return (
    <aside className="app-sidebar">
      <div>
        {/* Brand */}
        <div className="db-brand">
          <span className="db-logo">✦</span>
          <div>
            <strong>Socialynk</strong>
            <small>ENTERPRISE SUITE</small>
          </div>
        </div>

        <Link to="/createpage" className="db-create-btn">+ Create New</Link>

        {/* Menu */}
        <nav className="db-menu">
          {links.map((link) => (
            <NavLink key={link.name} to={link.to}>
              {link.icon} {link.name}
            </NavLink>
          ))}
        </nav>
      </div>

      <div>
        {/* User card */}
        <div className="db-user-card">
          <ProfileMenu
            direction="up"
            align="left"
            size={40}
            avatarInitials={getInitials(user?.name)}
          />
          <div>
            <strong title={displayName}>{displayName}</strong>
            <small>{formatPlan(user?.plan)}</small>
          </div>
          <span className="db-dots">⇅</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
