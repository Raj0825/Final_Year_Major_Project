import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { signup } from "../api/auth"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import type { Role } from "../types"

const ROLES: { value: Role; label: string; icon: string; desc: string }[] = [
  { value: "CUSTOMER", label: "Customer", icon: "🛒", desc: "Buy discounted food" },
  { value: "NGO", label: "NGO", icon: "🤝", desc: "Collect for charity" },
  { value: "STORE_MANAGER", label: "Store Manager", icon: "🏪", desc: "Manage your store" },
  { value: "STORE_STAFF", label: "Store Staff", icon: "👤", desc: "Assist store ops" },
]

export default function SignupPage() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  const { addToast } = useToast()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("CUSTOMER")
  const [storeId, setStoreId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const needsStoreId = role === "STORE_MANAGER" || role === "STORE_STAFF"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (needsStoreId && !storeId.trim()) {
      setError("Store ID is required for store roles.")
      return
    }
    setLoading(true)
    try {
      const data = await signup({ name, email, password, role, storeId: needsStoreId ? storeId : undefined })
      authLogin({ userId: data.userId, name: data.name, role: data.role as Role, token: data.token })
      addToast(`Account created! Welcome, ${data.name} 🌿`, "success")
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
      <div className="auth-card" style={{ maxWidth: 500 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">🌿</div>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>FreshRescue</div>
            <div className="text-xs text-muted">Join the movement.</div>
          </div>
        </div>

        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>Create account</h1>
        <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Pick your role and get started.</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">I am a...</label>
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
                  <span style={{ fontWeight: 600 }}>{r.label}</span>
                  <span className="text-xs" style={{ opacity: 0.7 }}>{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Full name</label>
            <input id="signup-name" className="form-input" type="text" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input id="signup-email" className="form-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input id="signup-password" className="form-input" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>

          {needsStoreId && (
            <div className="form-group">
              <label className="form-label">Store ID</label>
              <input
                id="signup-storeId"
                className="form-input"
                type="text"
                placeholder="e.g. store_001"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
              />
              <span className="form-error text-xs" style={{ color: "var(--text-muted)" }}>Your store manager will provide this.</span>
            </div>
          )}

          <button id="signup-submit" className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <span className="spinner" /> : "Create account"}
          </button>
        </form>

        <div className="divider" />
        <p className="text-sm text-muted" style={{ textAlign: "center" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}

