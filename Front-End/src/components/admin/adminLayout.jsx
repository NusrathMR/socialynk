import { NavLink, Outlet } from "react-router-dom"
import Sidebar from "../sideBar/sidebar.jsx"
import TopBar from "../topBar/topBar.jsx"
import "./adminPage.css"

const adminTabs = [
  { label: "Admin Dashboard", to: "/admin", end: true },
  { label: "Manage Users", to: "/admin/users" },
  { label: "Plans & Billing", to: "/admin/plans-billing" },
  { label: "System Monitoring", to: "/admin/system-monitoring" },
  { label: "AI Usage", to: "/admin/ai-usage" },
  { label: "Audit Logs", to: "/admin/audit-logs" },
  { label: "Admin Settings", to: "/admin/settings" },
]

export default function AdminLayout() {
  return (
    <div className="db-layout">
      <Sidebar />

      <main className="db-main">
        <TopBar
          title="Admin"
          subtitle="Manage users, plans and system settings."
        />

        <div className="ad-wrap">
          <nav className="ad-tabs" aria-label="Admin navigation">
            {adminTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  isActive ? "ad-tab active" : "ad-tab"
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="ad-content">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
