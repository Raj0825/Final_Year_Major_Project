import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { signup } from "../api/auth"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import type { Role } from "../types"

const ROLES: { value: Role; label: string; icon: string; desc: string }[] = [
  { value: "CUSTOMER", label: "Customer", icon: "🛒", desc: "Buy discounted food" },
  { value: "NGO", label: "NGO", icon: "🤝", desc: "Collect for charity" },
  { value: "STORE_MANAGER", label: "Store Manager", icon: "🏪", desc: "Register & manage store" },
  { value: "STORE_STAFF", label: "Store Staff", icon: "👤", desc: "Join store team" },
]

export default function SignupPage() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  const { addToast } = useToast()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("CUSTOMER")

  // Store Manager details (asked upfront)
  const [storeName, setStoreName] = useState("")
  const [storeAddress, setStoreAddress] = useState("")
  const [storePhone, setStorePhone] = useState("")
  const [latitude, setLatitude] = useState<number | "">("")
  const [longitude, setLongitude] = useState<number | "">("")

  // Store Staff detail
  const [staffStoreId, setStaffStoreId] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      addToast("Geolocation is not supported by your browser", "error")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude)
        setLongitude(pos.coords.longitude)
        addToast("Store GPS coordinates captured!", "success")
      },
      (err) => {
        addToast("GPS error: " + err.message, "error")
      }
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (role === "STORE_MANAGER" && !storeName.trim()) {
      setError("Please provide your store name.")
      return
    }
    if (role === "STORE_STAFF" && !staffStoreId.trim()) {
      setError("Please provide your employer's Store ID.")
      return
    }

    setLoading(true)
    try {
      const data = await signup({
        name,
        email,
        password,
        role,
        storeName: role === "STORE_MANAGER" ? storeName.trim() : undefined,
        storeAddress: role === "STORE_MANAGER" ? storeAddress.trim() : undefined,
        storePhone: role === "STORE_MANAGER" ? storePhone.trim() : undefined,
        latitude: role === "STORE_MANAGER" && latitude !== "" ? Number(latitude) : undefined,
        longitude: role === "STORE_MANAGER" && longitude !== "" ? Number(longitude) : undefined,
        storeId: role === "STORE_STAFF" ? staffStoreId.trim() : undefined,
      })

      authLogin({
        userId: data.userId,
        name: data.name,
        role: data.role as Role,
        token: data.token,
        storeId: data.storeId,
      })

      addToast(`Account & Store created! Welcome, ${data.name} 🌿`, "success")
      if (data.role === "STORE_MANAGER" || data.role === "STORE_STAFF") {
        navigate("/store/dashboard")
      } else {
        navigate("/feed")
      }
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.response?.data ?? "Signup failed"
      setError(typeof msg === "string" ? msg : "Signup failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 540 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">🌿</div>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>FreshRescue</div>
            <div className="text-xs text-muted">Food surplus rescue network.</div>
          </div>
        </div>

        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>Create account</h1>
        <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Pick your role to get started.</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">I am joining as a...</label>
            <div className="role-selector">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`role-option${role === r.value ? " selected" : ""}`}
                  onClick={() => setRole(r.value)}
                  id={`role-${r.value}`}
                >
                  <span className="role-option-icon">{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Your Full Name *</label>
            <input
              id="signup-name"
              className="form-input"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              id="signup-email"
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              id="signup-password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* STORE MANAGER: Collect store info upfront */}
          {role === "STORE_MANAGER" && (
            <div style={{ background: "var(--surface-2)", padding: "16px 18px", borderRadius: "var(--radius)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--accent)" }}>
                🏪 Store Information
              </div>

              <div className="form-group">
                <label className="form-label">Store / Branch Name *</label>
                <input
                  id="signup-store-name"
                  className="form-input"
                  placeholder="e.g. FreshMart Metro Center"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Physical Address</label>
                <input
                  id="signup-store-address"
                  className="form-input"
                  placeholder="Street, locality, city"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  id="signup-store-phone"
                  className="form-input"
                  placeholder="+91 98765 43210"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="form-label" style={{ marginBottom: 0 }}>Store Coordinates (Map & Nearby Search)</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleDetectGPS}
                    style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                  >
                    📍 Detect GPS
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Latitude"
                    className="form-input"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Longitude"
                    className="form-input"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STORE STAFF: Enter employer store ID */}
          {role === "STORE_STAFF" && (
            <div className="form-group">
              <label className="form-label">Assigned Store ID *</label>
              <input
                id="signup-staff-storeid"
                className="form-input"
                placeholder="Enter the Store ID from your manager"
                value={staffStoreId}
                onChange={(e) => setStaffStoreId(e.target.value)}
                required
              />
            </div>
          )}

          <button
            id="signup-submit"
            className="btn btn-primary btn-lg w-full"
            type="submit"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? <span className="spinner" /> : "Create Account & Get Started"}
          </button>
        </form>

        <p className="text-sm text-center text-muted" style={{ marginTop: 20 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
