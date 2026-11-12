import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LandingPage from './components/landingPage/landingPage.jsx'
import SignupPage from './components/signupPage/signupPage.jsx'
import LoginPage from './components/loginPage/loginPage.jsx'
import {createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import DashBoard from './components/dashBoard/dashBoard.jsx'
import CreatePage from './components/createPage/createPage.jsx'
import PublishPage from './components/publishPage/publishPage.jsx'
import { AuthProvider } from './components/AuthContext/authContext.jsx'
import { ThemeProvider } from './components/ThemeContext/themeContext.jsx'
import ProtectedRoute from './components/protectedRoute/protectedRoute.jsx'
import ComingSoon from './components/comingSoon/comingSoon.jsx'
import AiToolsPage from './components/aiToolsPage/aiToolsPage.jsx'
import AdminLayout from './components/admin/adminLayout.jsx'
import AdminRoute from './components/admin/adminRoute.jsx'
import AdminDashboard from './components/admin/adminDashboard.jsx'
import ManageUsers from './components/admin/manageUsers.jsx'
import UserDetails from './components/admin/userDetails/userDetails.jsx'
import AdminSettings from './components/admin/adminSettings.jsx'
import AdminComingSoon from './components/admin/comingSoon.jsx'
import SimulatorPage from './components/simulator/simulatorPage.jsx'
import BrandMemoryRoute from './components/settings/brandMemoryRoute.jsx'
import SettingsLayout from './components/settings/settingsLayout.jsx'
import SettingsPlaceholder from './components/settings/settingsPlaceholder.jsx'
import ProfileSettings from './components/settings/profileSettings.jsx'
import AppearanceSettings from './components/settings/appearanceSettings.jsx'
import TermsPage from './pages/legal/TermsPage.jsx'
import PrivacyPage from './pages/legal/PrivacyPage.jsx'
import './styles/theme.css'

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    ),
    children: [
      { index: true, element: <LandingPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/signup", element: <SignupPage /> },
      { path: "/terms", element: <TermsPage /> },
      { path: "/privacy", element: <PrivacyPage /> },
      {
        path: "/dashboard",
        element: <ProtectedRoute><DashBoard /></ProtectedRoute>,
      },
      {
        path: "/createpage",
        element: <ProtectedRoute><CreatePage /></ProtectedRoute>,
      },
      {
        path:"/publishpage",
        element: <ProtectedRoute><PublishPage /></ProtectedRoute>,
      },
      {
        path: "/simulator",
        element: <ProtectedRoute><SimulatorPage /></ProtectedRoute>,
      },
      {
        path: "/aitools",
        element: <ProtectedRoute><AiToolsPage /></ProtectedRoute>,
      },
      {
        path: "/settings",
        element: <ProtectedRoute><SettingsLayout /></ProtectedRoute>,
        children: [
          { index: true, element: <Navigate to="/settings/profile" replace /> },
          {
            path: "profile",
            element: <ProfileSettings />,
          },
          {
            path: "appearance",
            element: <AppearanceSettings />,
          },
          {
            path: "security",
            element: <SettingsPlaceholder title="Security" description="Manage your password and account security." />,
          },
          {
            path: "account",
            element: <SettingsPlaceholder title="Account" description="Manage your account status and access." />,
          },
          { path: "brand-memory", element: <BrandMemoryRoute /> },
        ],
      },
      {
        path: "/channels",
        element: <ProtectedRoute><ComingSoon title="Channels" /></ProtectedRoute>,
      },
      {
        path: "/pricing",
        element: <ProtectedRoute><ComingSoon title="Pricing" /></ProtectedRoute>,
      },
      {
        path: "/admin",
        element: (
          <ProtectedRoute>
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: "users", element: <ManageUsers /> },
          { path: "users/:id", element: <UserDetails /> },
          { path: "plans-billing", element: <AdminComingSoon title="Plans & Billing" /> },
          { path: "system-monitoring", element: <AdminComingSoon title="System Monitoring" /> },
          { path: "ai-usage", element: <AdminComingSoon title="AI Usage" /> },
          { path: "audit-logs", element: <AdminComingSoon title="Audit Logs" /> },
          { path: "settings", element: <AdminSettings /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router}/>
    </AuthProvider>
  </StrictMode>
)
