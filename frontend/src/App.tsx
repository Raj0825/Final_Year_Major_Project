import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ToastProvider } from "./context/ToastContext"
import ProtectedRoute from "./components/auth/ProtectedRoute"
import ToastContainer from "./components/shared/ToastContainer"

import LoginPage from "./pages/LoginPage"
import SignupPage from "./pages/SignupPage"
import BuyerFeedPage from "./pages/BuyerFeedPage"
import MapPage from "./pages/MapPage"
import MyOrdersPage from "./pages/MyOrdersPage"
import StoreDashboardPage from "./pages/StoreDashboardPage"
import StoreBatchesPage from "./pages/StoreBatchesPage"
import BatchDetailPage from "./pages/BatchDetailPage"
import StoreFulfillOrdersPage from "./pages/StoreFulfillOrdersPage"

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Buyer routes */}
          <Route path="/feed" element={
            <ProtectedRoute allowedRoles={["CUSTOMER", "NGO"]}>
              <BuyerFeedPage />
            </ProtectedRoute>
          } />
          <Route path="/feed/map" element={
            <ProtectedRoute allowedRoles={["CUSTOMER", "NGO"]}>
              <MapPage />
            </ProtectedRoute>
          } />
          <Route path="/my-orders" element={
            <ProtectedRoute allowedRoles={["CUSTOMER", "NGO"]}>
              <MyOrdersPage />
            </ProtectedRoute>
          } />

          {/* Store routes */}
          <Route path="/store/dashboard" element={
            <ProtectedRoute allowedRoles={["STORE_MANAGER", "STORE_STAFF"]}>
              <StoreDashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/store/batches" element={
            <ProtectedRoute allowedRoles={["STORE_MANAGER", "STORE_STAFF"]}>
              <StoreBatchesPage />
            </ProtectedRoute>
          } />
          <Route path="/store/batch/:id" element={
            <ProtectedRoute allowedRoles={["STORE_MANAGER", "STORE_STAFF"]}>
              <BatchDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/store/orders" element={
            <ProtectedRoute allowedRoles={["STORE_MANAGER", "STORE_STAFF"]}>
              <StoreFulfillOrdersPage />
            </ProtectedRoute>
          } />

          {/* Default redirect */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
      </AuthProvider>
    </ToastProvider>
  )
}

function RootRedirect() {
  const raw = localStorage.getItem("fr_user")
  if (raw) {
    try {
      const u = JSON.parse(raw)
      if (u.role === "STORE_MANAGER" || u.role === "STORE_STAFF") return <Navigate to="/store/dashboard" replace />
      return <Navigate to="/feed" replace />
    } catch {}
  }
  return <Navigate to="/login" replace />
}
