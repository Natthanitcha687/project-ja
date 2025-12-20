import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./store/auth";

import AdminProtectedRoute from "./routes/AdminProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";

import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import Stores from "./pages/Stores";
import Users from "./pages/Users";
import Security from "./pages/Security";
import Logs from "./pages/Logs";
import Complaints from "./pages/Complaints";

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
      { index: true, element: <Dashboard /> },
      { path: "stores", element: <Stores /> },
      { path: "users", element: <Users /> },
      { path: "security", element: <Security /> },
      { path: "logs", element: <Logs /> },
      { path: "complaints", element: <Complaints /> }
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
