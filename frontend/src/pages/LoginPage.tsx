import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { login } from "../api/auth"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"

export default function LoginPage() {
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  const { addToast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data = await login({ email, password })
      authLogin({ userId: data.userId, name: data.name, role: data.role as any, token: data.token, storeId: data.storeId })
      addToast(`Welcome back, ${data.name}!`, "success")
      if (data.role === "STORE_MANAGER" || data.role === "STORE_STAFF") {
        navigate("/store/dashboard")
      } else {
        navigate("/feed")
      }
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.response?.data ?? "Invalid credentials"
      setError(typeof msg === "string" ? msg : "Invalid credentials")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🌿</div>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>FreshRescue</div>
            <div className="text-xs text-muted">Rescue food. Reduce waste.</div>
          </div>
        </div>

        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>Sign in</h1>
        <p className="text-muted text-sm" style={{ marginBottom: 28 }}>Welcome back — let&apos;s get rescuing.</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button id="login-submit" className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <span className="spinner" /> : "Sign in"}
          </button>
        </form>

        <div className="divider" />
        <p className="text-sm text-muted" style={{ textAlign: "center" }}>
          Don&apos;t have an account?{" "}
          <Link to="/signup" style={{ fontWeight: 600 }}>Create one</Link>
        </p>
      </div>
    </div>
  )
}

