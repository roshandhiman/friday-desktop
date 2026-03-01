import { Navigate, Route, Routes } from "react-router-dom";

import DashboardLayout from "@/layout/dashboard-layout";
import DashboardPage from "@/pages/dashboard";
import ProfilePage from "@/pages/profile";
import SettingsPage from "@/pages/settings";
import SubscriptionPage from "@/pages/subscription";
import ToolsPage from "@/pages/tools";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
