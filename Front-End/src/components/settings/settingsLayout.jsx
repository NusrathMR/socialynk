import { NavLink, Outlet } from "react-router-dom"
import Sidebar from "../sideBar/sidebar.jsx"
import TopBar from "../topBar/topBar.jsx"
import "./settingsLayout.css"

const settingsTabs = [
  { label: "Profile", to: "/settings/profile" },
  { label: "Appearance", to: "/settings/appearance" },
  { label: "Security", to: "/settings/security" },
  { label: "Account", to: "/settings/account" },
  { label: "Brand Memory", to: "/settings/brand-memory" },
]

export default function SettingsLayout() {
  return (
    <div className="db-layout settings-layout">
      <Sidebar />

      <main className="settings-main">
        <TopBar
          title="Settings"
          subtitle="Manage your profile, preferences, and account."
        />

        <div className="settings-body">
          <div className="settings-workspace">
            <nav className="settings-nav" aria-label="Settings sections">
              <h2>Settings</h2>
              {settingsTabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    isActive ? "settings-nav-link active" : "settings-nav-link"
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>

            <div className="settings-content">
              <Outlet />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
