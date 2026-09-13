import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import AppLayout from "./layouts/AppLayout.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import {
  AdminPage,
  BookingsPage,
  CustomerDashboard,
  HomePage,
  LoginPage,
  NotificationsPage,
  ProviderDashboard,
  ProviderDetailPage,
  ProviderProfilePage,
  RegisterPage,
} from "./pages/Pages.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute roles={["customer"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<CustomerDashboard />} />
          <Route path="/providers/:id" element={<ProviderDetailPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute roles={["provider"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/provider" element={<ProviderDashboard />} />
          <Route path="/provider/profile" element={<ProviderProfilePage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route element={<AppLayout />}><Route path="/admin" element={<AdminPage />} /></Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
