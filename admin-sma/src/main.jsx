import React from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import "./index.css";

import * as Sentry from "@sentry/react";

import { AuthProvider } from "./store/auth.jsx";
import AdminProtectedRoute from "./routes/AdminProtectedRoute.jsx";

import AdminLayout from "./layouts/AdminLayout.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";

import Stores from "./pages/Stores.jsx";
import Users from "./pages/Users.jsx";
import Security from "./pages/Security.jsx";
import Logs from "./pages/Logs.jsx";
import Complaints from "./pages/Complaints.jsx";
import Feedback from "./pages/Feedback.jsx";
import Settings from "./pages/Settings.jsx";

// ✅ Sentry init (ใช้ DSN จาก ENV: VITE_SENTRY_DSN)
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: Boolean(import.meta.env.VITE_SENTRY_DSN),
});

const router = createBrowserRouter([
  { path: "/login", element: <AdminLogin /> },

  {
    path: "/",
    element: (
      <AdminProtectedRoute>
        <AdminLayout />
      </AdminProtectedRoute>
    ),
    children: [
      // ✅ เข้า stores เป็น default ตามรูป
      { index: true, element: <Navigate to="stores" replace /> },

      { path: "stores", element: <Stores /> },
      { path: "users", element: <Users /> },
      { path: "security", element: <Security /> },
      { path: "logs", element: <Logs /> },
      { path: "complaints", element: <Complaints /> },
      { path: "feedback", element: <Feedback /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
