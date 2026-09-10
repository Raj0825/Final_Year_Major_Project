import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle, ArrowRight, BarChart3, BadgeCheck, Bell, Boxes, Building2,
  CalendarClock, Check, CheckCircle2, ChevronDown, ClipboardCheck,
  Clock3, FileScan, Handshake, Leaf, LogOut, MapPin, Menu, PackageCheck,
  Plus, Search, Send, Settings, ShieldCheck, SlidersHorizontal,
  Truck, UploadCloud, Users, X, ScanLine, Sparkles, RefreshCw, ShoppingBag,
  QrCode, History
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Link, Route, Switch, useLocation } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { login as apiLogin, register as apiRegister } from "@/api/auth";
import { getMyBatches, createBatch, scanBatch, updateBatchTier } from "@/api/batches";
import { getListings } from "@/api/listings";
import { getMyOrders, getPendingStoreOrders, reserveListing, fulfillOrderByCode } from "@/api/orders";
import { getNotifications } from "@/api/notifications";
import type { Batch, Listing, Order, NotificationItem, Role } from "@/types";

type AppWorkspaceRole = "supermarket" | "ngo";
type ToastKind = "success" | "warning" | "error";
type ToastState = { message: string; kind: ToastKind } | null;

// Store Staff Navigation
const supermarketNav = [
  { href: "/supermarket/overview", label: "Overview", icon: BarChart3 },
  { href: "/supermarket/inventory", label: "Inventory", icon: Boxes },
  { href: "/supermarket/detection", label: "Freshness check", icon: ScanLine },
  { href: "/supermarket/surplus", label: "Flagged surplus", icon: AlertTriangle },
  { href: "/supermarket/verification", label: "Counter Verification", icon: BadgeCheck },
  { href: "/supermarket/impact", label: "Impact & ESG", icon: Leaf },
];

// Simplified Customer & NGO Navigation: Browse Food, Active QR Passes, Order History
const ngoNav = [
  { href: "/ngo/available-food", label: "Browse Food", icon: Boxes },
  { href: "/ngo/active", label: "Active QR Passes", icon: QrCode },
  { href: "/ngo/history", label: "Order History", icon: History },
];

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${dark ? "text-white" : "text-[hsl(var(--primary))]"}`}>
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${dark ? "bg-[hsl(var(--accent))]" : "bg-[hsl(var(--primary))]"}`}>
        <Leaf className="h-5 w-5 text-white" strokeWidth={2.5} />
      </div>
      <span className="text-lg font-bold tracking-tight">Smart <span className="ss-serif font-normal italic">Surplus</span></span>
    </div>
  );
}

function StatusChip({ label }: { label: string }) {
  const tone = label.toLowerCase();
  const cls = tone.includes("urgent") || tone.includes("tier_3") || tone.includes("critical") ? "bg-red-50 text-[#C62828]" :
    tone.includes("near") || tone.includes("pending") || tone.includes("tier_2") || tone.includes("reserved") ? "bg-orange-50 text-[#E65100]" :
    tone.includes("safe") || tone.includes("verified") || tone.includes("fresh") || tone.includes("fulfilled") ? "bg-green-50 text-[#2E7D32]" :
    tone.includes("tier_1") ? "bg-amber-50 text-[#C2671A]" :
    "bg-stone-100 text-[hsl(var(--muted-foreground))]";
  return <span className={`ss-chip ${cls}`}>{label}</span>;
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-white px-4 py-3 shadow-xl ss-reveal" role="status">
      {toast.kind === "success" ? <CheckCircle2 className="h-5 w-5 text-[#2E7D32]" /> : <AlertTriangle className="h-5 w-5 text-[#E65100]" />}
      <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{toast.message}</span>
      <button onClick={onClose} aria-label="Close notification"><X className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /></button>
    </div>
  );
}

// -------------------------------------------------------------
// LANDING PAGE
// -------------------------------------------------------------
function Landing() {
  return (
    <div className="ss-shell min-h-[100dvh] ss-noise">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-10">
        <Logo />
        <div className="flex items-center gap-3">
          <Link href="/login" className="ss-btn-soft inline-flex items-center gap-2 px-4 py-2 text-sm">Sign In / Demo <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </header>
      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-12 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-28 lg:pt-20">
          <div className="ss-reveal">
            <p className="ss-kicker mb-5">A better last mile for good food</p>
            <h1 className="max-w-3xl text-5xl font-bold leading-[.98] tracking-[-.055em] text-[hsl(var(--primary))] sm:text-7xl">Good food should reach <span className="ss-serif font-normal italic">people,</span> not bins.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[hsl(var(--muted-foreground))]">
              Smart Surplus helps Indian supermarkets move safe, near-expiry produce to customers and NGOs at up to 60% discount with instant QR code pickup passes.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login" className="ss-btn-primary inline-flex items-center gap-2 px-5 py-3">Open Workspace <ArrowRight className="h-4 w-4" /></Link>
              <a href="#how-it-works" className="ss-btn-soft inline-flex items-center gap-2 px-5 py-3">See how it works</a>
            </div>
            <div className="mt-12 flex items-center gap-7 border-t border-[hsl(var(--border))] pt-5 text-sm text-[hsl(var(--muted-foreground))]">
              <span><strong className="block text-xl text-[hsl(var(--primary))]">1,284</strong> meals redirected</span>
              <span><strong className="block text-xl text-[hsl(var(--primary))]">38</strong> partner NGOs</span>
              <span><strong className="block text-xl text-[hsl(var(--primary))]">4.6T</strong> food saved</span>
            </div>
          </div>
          <div className="relative ss-reveal [animation-delay:100ms]">
            <div className="ss-grid-paper absolute -inset-5 rounded-[28px] opacity-60" />
            <div className="relative overflow-hidden rounded-[24px] bg-[hsl(var(--primary))] p-6 text-white shadow-2xl sm:p-8">
              <div className="flex items-start justify-between">
                <div><p className="text-sm text-white/65">Live Produce Scan</p><p className="mt-1 text-2xl font-bold">Keras CNN Intelligence</p></div>
                <div className="rounded-full bg-white/10 p-2"><Clock3 className="h-5 w-5 text-[#F7A28B]" /></div>
              </div>
              <div className="mt-8 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.07] p-4">
                  <div><p className="font-semibold">Orange Lot #2401</p><p className="mt-1 text-xs text-white/60">CNN Freshness: 95% • 7 Days Left</p></div>
                  <span className="ss-chip bg-green-500/20 text-emerald-300">Fresh (0%)</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.07] p-4">
                  <div><p className="font-semibold">Banana Lot #0941</p><p className="mt-1 text-xs text-white/60">CNN Freshness: 45% • 2 Days Left</p></div>
                  <span className="ss-chip bg-amber-500/20 text-amber-300">Tier 2 (-40%)</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.07] p-4">
                  <div><p className="font-semibold">Apple Lot #1048</p><p className="mt-1 text-xs text-white/60">CNN Freshness: 25% • 1 Day Left</p></div>
                  <span className="ss-chip bg-red-500/20 text-red-300">Tier 3 (-60% Urgent 🔥)</span>
                </div>
              </div>
              <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-5 text-sm">
                <span className="text-white/65">Instant QR Code Handoff</span>
                <strong>Scan & Collect at Store Counter</strong>
              </div>
            </div>
          </div>
        </section>
        <section id="how-it-works" className="border-y border-[hsl(var(--border))] bg-white/55">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-10">
            <p className="ss-kicker">Simple 3-Step Flow</p>
            <div className="mt-4 grid gap-10 md:grid-cols-3">
              {[
                ["01", "Browse Discounted Produce", "Customers and NGOs view live near-expiry produce discounted up to 60% off at local supermarkets."],
                ["02", "Reserve & Get QR Code", "Reserve desired items online with a 15-minute guaranteed hold and receive an instant QR Code & Pass ID."],
                ["03", "Collect at Store Counter", "Walk into the supermarket, show your QR code to the cashier, and the store staff scans it to complete the purchase and deduct inventory."],
              ].map(([number, title, copy]) => (
                <div key={number} className="border-t-2 border-[hsl(var(--primary))] pt-4">
                  <span className="ss-mono text-xs text-[hsl(var(--accent))]">{number}</span>
                  <h2 className="mt-4 text-2xl font-bold text-[hsl(var(--primary))]">{title}</h2>
                  <p className="mt-3 leading-7 text-[hsl(var(--muted-foreground))]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[hsl(var(--border))] px-5 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
        FreshRescue & Smart Surplus • Final Year Major Project Platform
      </footer>
    </div>
  );
}

// -------------------------------------------------------------
// LOGIN & REGISTRATION PAGE
// -------------------------------------------------------------
function Login() {
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<AppWorkspaceRole>("supermarket");
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegister) {
        const backendRole: Role = role === "supermarket" ? "STORE_MANAGER" : "CUSTOMER";
        const res = await apiRegister({
          email,
          password,
          name: name || (role === "supermarket" ? "Store Staff" : "Valued Customer"),
          role: backendRole,
        });
        localStorage.setItem("fr_token", res.token);
        localStorage.setItem("fr_user", JSON.stringify(res));
      } else {
        const res = await apiLogin({ email, password });
        localStorage.setItem("fr_token", res.token);
        localStorage.setItem("fr_user", JSON.stringify(res));
      }
      setLocation(role === "supermarket" ? "/supermarket/overview" : "/ngo/available-food");
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Authentication failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoRole: AppWorkspaceRole) => {
    setRole(demoRole);
    if (demoRole === "supermarket") {
      setEmail("raj@store.com");
      setPassword("password123");
      setName("Raj (Store Staff)");
    } else {
      setEmail("priya@ngo.org");
      setPassword("password123");
      setName("Priya (Customer)");
    }
  };

  return (
    <div className="ss-shell ss-grid-paper flex min-h-[100dvh] flex-col">
      <header className="mx-auto w-full max-w-6xl px-5 py-6">
        <Link href="/"><Logo /></Link>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-12">
        <div className="grid w-full gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <p className="ss-kicker">Unified Workspace</p>
            <h1 className="mt-4 text-5xl font-bold tracking-tight text-[hsl(var(--primary))]">Choose your<br /><span className="ss-serif font-normal italic">point of view.</span></h1>
            <p className="mt-5 max-w-md leading-7 text-[hsl(var(--muted-foreground))]">
              Manage stock & scan QR codes at checkout as <strong>Store Staff</strong>, or browse discounted food & get instant QR pickup codes as a <strong>Customer / NGO</strong>.
            </p>
            <div className="mt-8 flex gap-3">
              <button onClick={() => handleQuickDemo("supermarket")} className="ss-btn-soft px-3 py-2 text-xs">Quick Supermarket Demo</button>
              <button onClick={() => handleQuickDemo("ngo")} className="ss-btn-soft px-3 py-2 text-xs">Quick Customer / NGO Demo</button>
            </div>
          </div>
          <div className="ss-card mx-auto w-full max-w-lg p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="font-bold text-[hsl(var(--primary))]">{isRegister ? "Create Account" : "Sign In to Workspace"}</p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Select role and enter your details.</p>
              </div>
              <button onClick={() => setIsRegister(!isRegister)} className="text-xs font-semibold text-[hsl(var(--accent))] hover:underline">
                {isRegister ? "Have an account? Sign In" : "Need an account? Sign Up"}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRole("supermarket")}
                className={`rounded-xl border-2 p-4 text-left ${role === "supermarket" ? "border-[hsl(var(--accent))] bg-orange-50/50" : "border-[hsl(var(--border))] bg-white"}`}
              >
                <Building2 className="h-5 w-5 text-[hsl(var(--primary))]" />
                <strong className="mt-3 block text-sm">Supermarket Staff</strong>
                <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Manage stock, run CNN scans & scan QR codes.</span>
              </button>
              <button
                type="button"
                onClick={() => setRole("ngo")}
                className={`rounded-xl border-2 p-4 text-left ${role === "ngo" ? "border-[hsl(var(--accent))] bg-orange-50/50" : "border-[hsl(var(--border))] bg-white"}`}
              >
                <Users className="h-5 w-5 text-[hsl(var(--primary))]" />
                <strong className="mt-3 block text-sm">Customer & NGO</strong>
                <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Browse discounted food, get QR pass & buy.</span>
              </button>
            </div>

            {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600">{error}</div>}

            <form onSubmit={handleAuth} className="mt-5 space-y-3">
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-[hsl(var(--foreground))]">Full Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} required className="ss-input mt-1" placeholder="e.g. Priya Sharma" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--foreground))]">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="ss-input mt-1" placeholder="name@email.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--foreground))]">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="ss-input mt-1" placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading} className="ss-btn-primary mt-4 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {isRegister ? "Create Account & Enter" : `Enter as ${role === "ngo" ? "Customer / NGO" : "Supermarket Staff"}`}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

// -------------------------------------------------------------
// LAYOUT: SIDEBAR, TOPBAR, MOBILE NAV
// -------------------------------------------------------------
function Sidebar({ role, path, onNavigate }: { role: AppWorkspaceRole; path: string; onNavigate: () => void }) {
  const [, setLocation] = useLocation();
  const items = role === "supermarket" ? supermarketNav : ngoNav;
  const userRaw = localStorage.getItem("fr_user");
  const user = userRaw ? JSON.parse(userRaw) : null;
  const displayName = user?.name || (role === "ngo" ? "Priya (Customer)" : "Raj (Store Staff)");
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "FR";

  const handleLogout = () => {
    localStorage.removeItem("fr_token");
    localStorage.removeItem("fr_user");
    setLocation("/");
  };

  return (
    <aside className="ss-sidebar hidden w-[248px] shrink-0 flex-col lg:flex">
      <div className="px-5 pb-6 pt-7"><Logo dark /></div>
      <div className="px-5 pb-5">
        <div className="rounded-xl border border-white/10 bg-white/[.07] p-3">
          <p className="ss-mono text-[10px] uppercase tracking-wider text-white/50">Signed in as</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#F7A28B] text-xs font-bold text-[hsl(var(--primary))]">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{displayName}</p>
              <p className="truncate text-xs text-white/55">{role === "ngo" ? "Customer / NGO" : "Store Staff"}</p>
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3" aria-label={`${role} navigation`}>
        <p className="ss-mono mb-2 px-3 text-[10px] uppercase tracking-widest text-white/40">Workspace</p>
        {items.map(item => {
          const Icon = item.icon;
          const active = path === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} className={`ss-link mb-1 flex items-center gap-3 rounded-r-lg px-3 py-2.5 text-sm font-medium ${active ? "ss-link-active" : ""}`}>
              <Icon className="h-[17px] w-[17px]" />
              {item.label}
            </Link>
          );
        })}
        <p className="ss-mono mb-2 mt-7 px-3 text-[10px] uppercase tracking-widest text-white/40">Account</p>
        <Link href={`/${role}/notifications`} onClick={onNavigate} className={`ss-link mb-1 flex items-center gap-3 rounded-r-lg px-3 py-2.5 text-sm font-medium ${path.endsWith("notifications") ? "ss-link-active" : ""}`}>
          <Bell className="h-[17px] w-[17px]" />
          Notifications
        </Link>
      </nav>
      <div className="border-t border-white/10 p-4">
        <button onClick={handleLogout} className="flex w-full items-center gap-2 px-2 py-2 text-xs text-white/60 hover:text-white">
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ role, path, onNavigate }: { role: AppWorkspaceRole; path: string; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const items = role === "supermarket" ? supermarketNav : ngoNav;
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--sidebar))] px-4 py-3">
        <Logo dark />
        <button className="rounded-lg p-2 text-white" onClick={() => setOpen(!open)} aria-label="Open navigation">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="ss-sidebar absolute left-0 right-0 z-30 border-b border-white/10 p-3 shadow-xl">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={() => { setOpen(false); onNavigate(); }} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${path === item.href ? "bg-white/10 text-white" : "text-white/70"}`}>
                <Icon className="h-4 w-4" />{item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Topbar({ role, path, onAction }: { role: AppWorkspaceRole; path: string; onAction: (message: string, kind?: ToastKind) => void }) {
  const current = (role === "supermarket" ? supermarketNav : ngoNav).find(item => item.href === path);
  const title = current?.label || (path.endsWith("notifications") ? "Notifications" : "Overview");
  const userRaw = localStorage.getItem("fr_user");
  const user = userRaw ? JSON.parse(userRaw) : null;
  const name = user?.name || (role === "ngo" ? "Priya" : "Raj");

  return (
    <header className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-5 py-4 lg:px-8">
      <div>
        <p className="ss-mono text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          {role === "ngo" ? "Customer & NGO Portal" : "Store Staff Operations"}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[hsl(var(--primary))]">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <Link href={`/${role}/notifications`} className="relative rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />
        </Link>
        <div className="hidden h-8 w-px bg-[hsl(var(--border))] sm:block" />
        <div className="hidden items-center gap-2 sm:flex">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#D7E6C7] text-xs font-bold text-[hsl(var(--primary))]">
            {name[0] || "U"}
          </div>
          <span className="text-sm font-semibold">{name}</span>
        </div>
      </div>
    </header>
  );
}

function Metric({ label, value, note, icon: Icon, tone = "primary" }: { label: string; value: string; note: string; icon: any; tone?: "primary" | "amber" | "salmon" }) {
  const color = tone === "amber" ? "bg-orange-50 text-[#C2671A]" : tone === "salmon" ? "bg-[#FFF0EC] text-[#C2671A]" : "bg-[#E9F2E4] text-[hsl(var(--primary))]";
  return (
    <div className="ss-card p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
        <div className={`rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-[hsl(var(--primary))]">{value}</p>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{note}</p>
    </div>
  );
}

function PageIntro({ eyebrow, title, copy, action, actionLabel, icon: Icon = Plus }: { eyebrow?: string; title: string; copy?: string; action?: () => void; actionLabel?: string; icon?: any }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="ss-kicker">{eyebrow || "Operations"}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-[hsl(var(--primary))]">{title}</h2>
        {copy && <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{copy}</p>}
      </div>
      {action && actionLabel && (
        <button onClick={action} className="ss-btn-amber inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-sm">
          <Icon className="h-4 w-4" />{actionLabel}
        </button>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: OVERVIEW
// -------------------------------------------------------------
function DashboardHome({ onAction }: { onAction: (message: string) => void }) {
  const [, setLocation] = useLocation();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);

  useEffect(() => {
    Promise.all([
      getMyBatches().catch(() => []),
      getPendingStoreOrders().catch(() => [])
    ]).then(([bRes, pRes]) => {
      setBatches(bRes);
      setPendingOrders(pRes);
    });
  }, []);

  const urgentBatches = batches.filter(b => b.state === "TIER_3" || b.state === "TIER_2");

  return (
    <div className="ss-reveal">
      <PageIntro
        eyebrow="Supermarket Operations"
        title="Store Operations at a Glance"
        copy={`${urgentBatches.length} produce lots currently flagged for discount or nearing expiry.`}
        action={() => setLocation("/supermarket/detection")}
        actionLabel="Run CNN Freshness Scan"
        icon={ScanLine}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active store batches" value={`${batches.length}`} note="Currently stocked in MongoDB" icon={Boxes} />
        <Metric label="Expiring soon" value={`${urgentBatches.length} lots`} note="Requires discount or donation" icon={AlertTriangle} tone="salmon" />
        <Metric label="Waiting customer pickups" value={`${pendingOrders.length}`} note="Pending QR counter verification" icon={CalendarClock} tone="amber" />
        <Metric label="Diverted produce" value="4.6 T" note="Saved from landfill this month" icon={Leaf} />
      </div>

      <div className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="ss-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
            <div>
              <h3 className="font-bold text-[hsl(var(--primary))]">Produce Expiry Watchlist</h3>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Live batches monitored by CNN and discount engine</p>
            </div>
            <Link href="/supermarket/inventory" className="text-xs font-bold text-[hsl(var(--accent))]">
              See all <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="ss-table-wrap">
            <table className="ss-table w-full text-sm">
              <thead>
                <tr><th>Product</th><th>Quantity</th><th>State</th><th>Discount</th></tr>
              </thead>
              <tbody>
                {batches.slice(0, 5).map(b => (
                  <tr key={b.id} className="hover:bg-[hsl(var(--secondary)/.45)]">
                    <td><p className="font-semibold">{b.productName}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{b.category}</p></td>
                    <td>{b.quantity} {b.unit}</td>
                    <td><StatusChip label={b.state} /></td>
                    <td>{b.currentDiscountPercent ? `-${b.currentDiscountPercent}%` : "0%"}</td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">No batches found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ss-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[hsl(var(--primary))]">Waiting Customer Handoffs</h3>
            <ClipboardCheck className="h-5 w-5 text-[hsl(var(--accent))]" />
          </div>
          <div className="mt-6 space-y-4">
            {pendingOrders.slice(0, 3).map((order, i) => (
              <div key={order.id} className="relative flex gap-3">
                <div className={`relative mt-1 h-4 w-4 shrink-0 rounded-full border-4 ${i === 0 ? "border-[#F7A28B] bg-[hsl(var(--primary))]" : "border-[#D7E6C7] bg-white"}`} />
                <div>
                  <p className="ss-mono text-xs text-[hsl(var(--accent))]">Pass ID: {order.qrCode || order.id.slice(-6).toUpperCase()}</p>
                  <p className="mt-1 text-sm font-bold">{order.productName || "Fresh Produce Lot"}</p>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Qty: {order.quantity} • Status: {order.status}</p>
                </div>
              </div>
            ))}
            {pendingOrders.length === 0 && (
              <p className="py-4 text-center text-xs text-[hsl(var(--muted-foreground))]">No customers waiting right now.</p>
            )}
          </div>
          <Link href="/supermarket/verification" className="ss-btn-soft mt-7 block w-full text-center px-3 py-2 text-xs">Go to Counter QR Scanner</Link>
        </section>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: INVENTORY
// -------------------------------------------------------------
function InventoryPage({ onAction }: { onAction: (message: string) => void }) {
  const [, setLocation] = useLocation();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState("");
  const [newCategory, setNewCategory] = useState("Fruit");
  const [newQty, setNewQty] = useState(50);
  const [newUnit, setNewUnit] = useState("kg");
  const [newPrice, setNewPrice] = useState(60);
  const [loading, setLoading] = useState(false);

  const fetchBatches = async () => {
    try {
      const data = await getMyBatches();
      setBatches(data);
    } catch {}
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createBatch({
        productName: newProduct,
        category: newCategory,
        quantity: newQty,
        unit: newUnit,
        originalPrice: newPrice,
        stockedAt: new Date().toISOString(),
      });
      onAction(`Created new batch for ${newProduct}.`);
      setModalOpen(false);
      setNewProduct("");
      fetchBatches();
    } catch (err: any) {
      onAction(err?.message || "Failed to add batch.", "error");
    } finally {
      setLoading(false);
    }
  };

  const filtered = batches.filter(b => {
    const matchSearch = b.productName.toLowerCase().includes(search.toLowerCase()) || b.category.toLowerCase().includes(search.toLowerCase());
    if (filter === "all") return matchSearch;
    if (filter === "urgent") return matchSearch && (b.state === "TIER_3" || b.state === "TIER_2");
    if (filter === "fresh") return matchSearch && b.state === "FRESH";
    return matchSearch;
  });

  return (
    <div className="ss-reveal">
      <PageIntro
        eyebrow="Stock management"
        title="Supermarket Inventory"
        copy="All produce currently in stock, with shelf tiers maintained automatically by the CNN freshness model and discount engine."
        action={() => setModalOpen(true)}
        actionLabel="Add New Produce Lot"
        icon={Plus}
      />

      <div className="ss-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="ss-input pl-9" placeholder="Search produce..." />
          </div>
          <div className="flex gap-2">
            {["all", "urgent", "fresh"].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === f ? "bg-[hsl(var(--primary))] text-white" : "ss-btn-soft"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="ss-table-wrap mt-4">
          <table className="ss-table w-full text-sm">
            <thead>
              <tr>
                <th>Produce Name</th>
                <th>Category</th>
                <th>Quantity In Stock</th>
                <th>Original Price</th>
                <th>State & Tier</th>
                <th>CNN Freshness</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="hover:bg-[hsl(var(--secondary)/.45)]">
                  <td>
                    <p className="font-semibold">{b.productName}</p>
                    <p className="ss-mono mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">ID: {b.id.slice(-6)}</p>
                  </td>
                  <td>{b.category}</td>
                  <td><strong>{b.quantity} {b.unit}</strong> {b.quantityReserved > 0 && <span className="text-xs text-orange-600">({b.quantityReserved} reserved)</span>}</td>
                  <td>₹{b.originalPrice.toFixed(2)} / {b.unit}</td>
                  <td><StatusChip label={b.state} /></td>
                  <td>
                    {b.freshnessScore != null ? (
                      <span className="font-bold text-[hsl(var(--primary))]">{Math.round(b.freshnessScore * 100)}%</span>
                    ) : (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">Not scanned</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => setLocation(`/supermarket/detection?batchId=${b.id}`)}
                      className="inline-flex items-center gap-1.5 ss-btn-primary px-3 py-1.5 text-xs"
                    >
                      <ScanLine className="h-3.5 w-3.5" /> CNN Scan
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-xs text-[hsl(var(--muted-foreground))]">No batches found matching filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ss-card w-full max-w-md p-6 bg-white ss-reveal">
            <div className="flex items-center justify-between pb-3 border-b border-[hsl(var(--border))]">
              <h3 className="font-bold text-lg text-[hsl(var(--primary))]">Add New Produce Lot</h3>
              <button onClick={() => setModalOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold">Product Name</label>
                <input value={newProduct} onChange={e => setNewProduct(e.target.value)} required placeholder="e.g. Apple, Banana, Orange" className="ss-input mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold">Category</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="ss-input mt-1">
                    <option>Fruit</option>
                    <option>Vegetable</option>
                    <option>Dairy</option>
                    <option>Bakery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">Unit</label>
                  <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="ss-input mt-1">
                    <option>kg</option>
                    <option>unit</option>
                    <option>pack</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold">Quantity</label>
                  <input type="number" min="1" value={newQty} onChange={e => setNewQty(Number(e.target.value))} required className="ss-input mt-1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold">Price (₹ / unit)</label>
                  <input type="number" step="0.5" min="1" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} required className="ss-input mt-1" />
                </div>
              </div>
              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={loading} className="ss-btn-primary flex-1 py-2.5 text-xs">
                  {loading ? "Adding..." : "Add to Inventory"}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="ss-btn-soft px-4 py-2.5 text-xs">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: FRESHNESS CHECK (CNN MODEL)
// -------------------------------------------------------------
function DetectionPage({ onAction }: { onAction: (message: string, kind?: ToastKind) => void }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [resultBatch, setResultBatch] = useState<Batch | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getMyBatches().then(res => {
      setBatches(res);
      const urlParams = new URLSearchParams(window.location.search);
      const bId = urlParams.get("batchId");
      if (bId && res.some(b => b.id === bId)) {
        setSelectedBatchId(bId);
      } else if (res.length > 0) {
        setSelectedBatchId(res[0].id);
      }
    }).catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSelectedFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setResultBatch(null);
    }
  };

  const handleRunScan = async () => {
    if (!selectedBatchId) {
      onAction("Please select a batch from inventory to scan.", "warning");
      return;
    }
    if (!selectedFile) {
      onAction("Please upload an image of the produce first.", "warning");
      return;
    }
    setScanning(true);
    try {
      const updated = await scanBatch(selectedBatchId, selectedFile);
      setResultBatch(updated);
      onAction(`CNN Scan complete! Freshness: ${Math.round((updated.freshnessScore || 0) * 100)}% (${updated.state})`, "success");
    } catch (err: any) {
      onAction(err?.response?.data?.message || err?.message || "CNN scan encountered an error.", "error");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="ss-reveal">
      <PageIntro
        eyebrow="CNN MobileNetV2 Analysis"
        title="Produce Freshness Check"
        copy="Upload a produce photo to evaluate real biological decay. The Keras model classifies freshness and automatically applies the optimal discount tier."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="ss-card p-6">
          <h3 className="font-bold text-lg text-[hsl(var(--primary))] mb-4 flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-[hsl(var(--accent))]" /> 1. Select Lot & Upload Photo
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Target Produce Batch</label>
              <select value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)} className="ss-input">
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.productName} ({b.quantity} {b.unit}) — Current: {b.state}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Produce Photo (JPEG/PNG)</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-[hsl(var(--border))] rounded-xl p-6 text-center hover:border-[hsl(var(--accent))] transition-all bg-[hsl(var(--card))]"
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                {previewUrl ? (
                  <div className="space-y-2">
                    <img src={previewUrl} alt="Preview" className="mx-auto max-h-48 rounded-lg object-contain" />
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Click to choose a different photo</p>
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <UploadCloud className="mx-auto h-8 w-8 text-[hsl(var(--accent))]" />
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Drop produce image here, or click to upload</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Evaluates apple, banana, orange & other market produce</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleRunScan}
              disabled={scanning || !selectedFile}
              className="ss-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {scanning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running Keras CNN Model on Port 8000...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Run Freshness Analysis
                </>
              )}
            </button>
          </div>
        </div>

        <div className="ss-card p-6">
          <h3 className="font-bold text-lg text-[hsl(var(--primary))] mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#2E7D32]" /> 2. Model Prediction & Auto-Tiering
          </h3>

          {resultBatch ? (
            <div className="space-y-5 ss-reveal">
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[#FBFDFB] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="ss-kicker text-[10px]">Prediction Result</span>
                    <h4 className="text-2xl font-bold mt-1 text-[hsl(var(--primary))]">{resultBatch.productName}</h4>
                  </div>
                  <StatusChip label={resultBatch.state} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[hsl(var(--border))] pt-4">
                  <div>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">Freshness Score</span>
                    <p className="text-3xl font-bold text-[hsl(var(--primary))] mt-1">
                      {Math.round((resultBatch.freshnessScore || 0) * 100)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">Customer Discount</span>
                    <p className="text-3xl font-bold text-[hsl(var(--accent))] mt-1">
                      {resultBatch.currentDiscountPercent ? `-${resultBatch.currentDiscountPercent}%` : "0% (Full Price)"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[hsl(var(--border))] text-xs space-y-1.5 text-[hsl(var(--muted-foreground))]">
                  <p>• <strong>State Transition:</strong> Automatically categorized as <strong>{resultBatch.state}</strong>.</p>
                  <p>• <strong>Customer Storefront:</strong> {resultBatch.state === "FRESH" ? "Standard inventory." : "Published to Customer Browse Feed with flash discount applied."}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Link href="/supermarket/surplus" className="ss-btn-amber flex-1 py-2.5 text-center text-xs">
                  View in Flagged Surplus Queue
                </Link>
                <Link href="/supermarket/inventory" className="ss-btn-soft flex-1 py-2.5 text-center text-xs">
                  Back to Inventory
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-[hsl(var(--muted-foreground))]">
              <ScanLine className="mx-auto h-12 w-12 text-stone-300" />
              <p className="mt-3 text-sm font-semibold">Awaiting Produce Scan</p>
              <p className="mt-1 text-xs max-w-xs mx-auto">Select a batch and upload a photo on the left to run MobileNetV2 CNN inference.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: FLAGGED SURPLUS
// -------------------------------------------------------------
function SurplusPage({ onAction }: { onAction: (message: string) => void }) {
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    getMyBatches().then(b => {
      setBatches(b.filter(x => x.state === "TIER_1" || x.state === "TIER_2" || x.state === "TIER_3"));
    }).catch(() => {});
  }, []);

  const handleSetTier = async (batchId: string, state: string, discount: number) => {
    try {
      await updateBatchTier(batchId, state, discount);
      onAction(`Tier updated to ${state} (${discount}% off).`);
      const updated = await getMyBatches();
      setBatches(updated.filter(x => x.state === "TIER_1" || x.state === "TIER_2" || x.state === "TIER_3"));
    } catch {
      onAction("Failed to update tier.");
    }
  };

  return (
    <div className="ss-reveal">
      <PageIntro
        eyebrow="Redistribution queue"
        title="Flagged Surplus & Discounts"
        copy="Produce that has moved into discount tiers based on decay or manual override. These items appear live in the Customer food feed."
      />

      <div className="space-y-3">
        {batches.map(item => (
          <div key={item.id} className="ss-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-[#FFF0EC] p-3 text-[#C2671A]">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{item.productName}</h3>
                  <StatusChip label={item.state} />
                  <span className="text-xs font-bold text-[hsl(var(--accent))]">
                    {item.currentDiscountPercent ? `-${item.currentDiscountPercent}% Off` : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  Stock: {item.quantity} {item.unit} • Original: ₹{item.originalPrice.toFixed(2)} / {item.unit}
                </p>
                <p className="mt-1 text-xs text-orange-600">
                  Customer Price: ₹{((item.originalPrice * (1 - (item.currentDiscountPercent || 0) / 100))).toFixed(2)} / {item.unit}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => handleSetTier(item.id, "TIER_1", 20)} className="ss-btn-soft px-3 py-1.5 text-xs">Tier 1 (-20%)</button>
              <button onClick={() => handleSetTier(item.id, "TIER_2", 40)} className="ss-btn-soft px-3 py-1.5 text-xs">Tier 2 (-40%)</button>
              <button onClick={() => handleSetTier(item.id, "TIER_3", 60)} className="ss-btn-amber px-3 py-1.5 text-xs">Tier 3 (-60% Urgent)</button>
            </div>
          </div>
        ))}

        {batches.length === 0 && (
          <div className="ss-card py-16 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#2E7D32]" />
            <h3 className="mt-4 font-bold">Your surplus queue is clear</h3>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Produce moving into Tier 1, 2, or 3 will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: COUNTER VERIFICATION & QR CODE SCAN
// -------------------------------------------------------------
function VerificationPage({ onAction }: { onAction: (message: string, kind?: ToastKind) => void }) {
  const [code, setCode] = useState("");
  const [verifiedOrder, setVerifiedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);

  const fetchPending = () => {
    getPendingStoreOrders().then(setPendingOrders).catch(() => []);
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleVerify = async (pickupCode: string) => {
    if (!pickupCode.trim()) {
      onAction("Enter a valid pickup pass code.", "warning");
      return;
    }
    setLoading(true);
    try {
      const fulfilled = await fulfillOrderByCode(pickupCode.trim().toUpperCase());
      setVerifiedOrder(fulfilled);
      onAction("Handoff verified! Reserved inventory automatically deducted from store.", "success");
      fetchPending();
    } catch (err: any) {
      onAction(err?.response?.data?.message || err?.message || "Invalid or expired pickup code.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ss-reveal">
      <PageIntro
        eyebrow="Checkout Counter"
        title="QR Code & Pass Verification"
        copy="Scan customer QR codes or enter their 6-character Pass ID. Completing verification fulfills the order and automatically updates MongoDB inventory."
      />

      <div className="mx-auto max-w-2xl">
        <div className="ss-card overflow-hidden">
          <div className="bg-[hsl(var(--primary))] p-6 text-white">
            <QrCode className="h-8 w-8 text-[#F7A28B]" />
            <h3 className="mt-4 text-xl font-bold">{verifiedOrder ? "Order Fulfilled & Stock Deducted" : "Scan or Enter Customer Pass"}</h3>
            <p className="mt-1 text-sm text-white/65">Instant inventory deduction at checkout counter</p>
          </div>

          {verifiedOrder ? (
            <div className="p-7 text-center ss-reveal">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#2E7D32]" />
              <h4 className="mt-4 text-lg font-bold">Handoff Confirmed!</h4>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                Order <strong>{verifiedOrder.qrCode || verifiedOrder.id.slice(-6).toUpperCase()}</strong> ({verifiedOrder.quantity} units of {verifiedOrder.productName || "produce"}) is fulfilled and inventory has been reduced in MongoDB.
              </p>
              <button onClick={() => { setVerifiedOrder(null); setCode(""); }} className="ss-btn-primary mt-6 px-5 py-2.5 text-xs">
                Scan Next Customer Pass
              </button>
            </div>
          ) : (
            <div className="p-6">
              <label className="block text-xs font-semibold">Enter 6-Character Pass ID (e.g. from Customer's QR code)</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SS-8042"
                  className="ss-input text-lg font-mono tracking-wider uppercase"
                />
                <button
                  disabled={loading || !code.trim()}
                  onClick={() => handleVerify(code)}
                  className="ss-btn-primary px-6 py-2.5 text-sm shrink-0 flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Verify & Deduct
                </button>
              </div>

              {pendingOrders.length > 0 && (
                <div className="mt-6 pt-5 border-t border-[hsl(var(--border))]">
                  <p className="text-xs font-bold uppercase text-[hsl(var(--muted-foreground))] mb-3">Customers Waiting at Checkout ({pendingOrders.length})</p>
                  <div className="space-y-2">
                    {pendingOrders.map(po => (
                      <div key={po.id} className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border))] hover:bg-stone-50">
                        <div>
                          <p className="font-semibold text-xs">{po.productName || "Produce Item"}</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Qty: {po.quantity} • Pass: <strong className="font-mono text-orange-600">{po.qrCode || po.id.slice(-6).toUpperCase()}</strong></p>
                        </div>
                        <button onClick={() => { setCode(po.qrCode || po.id.slice(-6).toUpperCase()); handleVerify(po.qrCode || po.id.slice(-6).toUpperCase()); }} className="ss-btn-soft px-3 py-1 text-xs">
                          1-Click Fulfill
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: IMPACT & ESG
// -------------------------------------------------------------
function ImpactPage() {
  return (
    <div className="ss-reveal">
      <PageIntro
        eyebrow="Sustainability & ESG"
        title="Supermarket Environmental Impact"
        copy="Every batch rescued prevents unnecessary organic landfill waste, reducing methane emissions and improving store margins."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Food Rescued" value="4.6 Tonnes" note="Prevented from waste bins" icon={Leaf} />
        <Metric label="Methane Emissions Avoided" value="11.5 T CO₂e" note="Carbon footprint reduction" icon={BarChart3} tone="amber" />
        <Metric label="Meals Redistributed" value="1,860 Meals" note="Nutritious food saved" icon={Users} tone="salmon" />
      </div>

      <div className="mt-6 ss-card p-6 bg-[hsl(var(--primary))] text-white">
        <p className="ss-kicker text-[#F7A28B]">Certified ESG Telemetry</p>
        <h3 className="text-2xl font-bold mt-2">Zero-Waste Supermarket Initiative</h3>
        <p className="text-white/70 text-sm mt-2 max-w-2xl leading-relaxed">
          Powered by MobileNetV2 CNN produce quality evaluation and dynamic discount tiering, FreshRescue gives supermarkets real-time inventory telemetry to meet sustainability goals.
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMER & NGO WORKSPACE: BROWSE FOOD & RESERVE (WITH QR MODAL)
// -------------------------------------------------------------
function NgoAvailableFood({ onAction }: { onAction: (message: string, kind?: ToastKind) => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");
  const [reserveModalItem, setReserveModalItem] = useState<Listing | null>(null);
  const [reserveQty, setReserveQty] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [issuedOrder, setIssuedOrder] = useState<Order | null>(null);

  const fetchListings = () => {
    getListings().then(setListings).catch(() => []);
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleReserve = async () => {
    if (!reserveModalItem) return;
    setReserving(true);
    try {
      const order = await reserveListing(reserveModalItem.id, reserveQty);
      setIssuedOrder(order);
      onAction(`Reserved ${reserveQty} ${reserveModalItem.unit} of ${reserveModalItem.productName}!`, "success");
      fetchListings();
    } catch (err: any) {
      onAction(err?.response?.data?.message || err?.message || "Reservation failed.", "error");
    } finally {
      setReserving(false);
    }
  };

  const filtered = listings.filter(l =>
    `${l.productName} ${l.storeName} ${l.category}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="ss-reveal">
      <PageIntro
        eyebrow="Browse & Save"
        title="Discounted Produce Storefront"
        copy="Browse near-expiry produce offered by local supermarkets at up to 60% off. Reserve online to lock in your price and get an instant QR pickup pass."
      />

      <div className="ss-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input value={query} onChange={e => setQuery(e.target.value)} className="ss-input pl-9" placeholder="Search by fruit, vegetable, or supermarket..." />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {filtered.map(item => (
            <div key={item.id} className="rounded-xl border border-[hsl(var(--border))] p-5 hover:border-[hsl(var(--accent)/.55)] transition-all bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-lg">{item.productName}</h3>
                    <StatusChip label={item.discountPercent > 0 ? `-${item.discountPercent}% Off` : "Fresh"} />
                  </div>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    <MapPin className="inline h-3.5 w-3.5 mr-1 text-[hsl(var(--accent))]" />
                    {item.storeName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-[hsl(var(--accent))]">₹{item.currentPrice.toFixed(2)}</p>
                  <p className="text-xs line-through text-[hsl(var(--muted-foreground))]">₹{item.originalPrice.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-y border-[hsl(var(--border))] py-3 text-xs">
                <div>
                  <span className="block text-[hsl(var(--muted-foreground))]">Available In Store</span>
                  <strong className="mt-0.5 block">{item.quantityAvailable} {item.unit}</strong>
                </div>
                <div>
                  <span className="block text-[hsl(var(--muted-foreground))]">Discount Tier</span>
                  <strong className="mt-0.5 block text-[#E65100]">{item.tier}</strong>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">15-min guaranteed hold</span>
                <button
                  onClick={() => { setReserveModalItem(item); setReserveQty(1); setIssuedOrder(null); }}
                  className="ss-btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
                >
                  <ShoppingBag className="h-3.5 w-3.5" /> Reserve & Get QR Pass
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No discounted food listings match your search.
            </div>
          )}
        </div>
      </div>

      {reserveModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ss-card w-full max-w-md p-6 bg-white ss-reveal">
            <div className="flex items-center justify-between pb-3 border-b border-[hsl(var(--border))]">
              <h3 className="font-bold text-lg text-[hsl(var(--primary))]">Reserve {reserveModalItem.productName}</h3>
              <button onClick={() => setReserveModalItem(null)}><X className="h-4 w-4" /></button>
            </div>

            {issuedOrder ? (
              <div className="py-4 text-center space-y-3 ss-reveal">
                <CheckCircle2 className="mx-auto h-10 w-10 text-[#2E7D32]" />
                <h4 className="text-lg font-bold">Pickup Pass Ready!</h4>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Show this QR code or Pass ID at <strong>{reserveModalItem.storeName}</strong> to collect:
                </p>

                <div className="my-3 flex justify-center p-3 bg-white rounded-xl border border-stone-200 shadow-sm w-fit mx-auto">
                  <QRCodeSVG value={issuedOrder.qrCode || issuedOrder.id} size={160} level="M" />
                </div>

                <div className="p-2.5 bg-orange-50 rounded-lg font-mono text-2xl font-bold tracking-widest text-[#C2671A]">
                  {issuedOrder.qrCode || issuedOrder.id.slice(-6).toUpperCase()}
                </div>

                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Hold reserved for 15 minutes • Pay ₹{(reserveModalItem.currentPrice * reserveQty).toFixed(2)} at counter
                </p>

                <div className="flex gap-2 pt-2">
                  <Link href="/ngo/active" className="ss-btn-primary flex-1 py-2.5 text-xs text-center">
                    View in Active Passes
                  </Link>
                  <button onClick={() => setReserveModalItem(null)} className="ss-btn-soft px-4 py-2.5 text-xs">
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold">Quantity to Reserve ({reserveModalItem.unit})</label>
                  <input
                    type="number"
                    min="1"
                    max={reserveModalItem.quantityAvailable}
                    value={reserveQty}
                    onChange={e => setReserveQty(Math.max(1, Math.min(reserveModalItem.quantityAvailable, Number(e.target.value))))}
                    className="ss-input mt-1"
                  />
                  <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Available: {reserveModalItem.quantityAvailable} {reserveModalItem.unit}</p>
                </div>

                <div className="rounded-lg bg-[hsl(var(--secondary))] p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Price per unit:</span>
                    <strong>₹{reserveModalItem.currentPrice.toFixed(2)} / {reserveModalItem.unit}</strong>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[hsl(var(--primary))] pt-1 border-t border-[hsl(var(--border))]">
                    <span>Total Amount to Pay:</span>
                    <span>₹{(reserveModalItem.currentPrice * reserveQty).toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button onClick={handleReserve} disabled={reserving} className="ss-btn-primary flex-1 py-2.5 text-xs">
                    {reserving ? "Generating Pass..." : "Confirm & Generate QR Pass"}
                  </button>
                  <button onClick={() => setReserveModalItem(null)} className="ss-btn-soft px-4 py-2.5 text-xs">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMER & NGO WORKSPACE: ACTIVE QR PASSES
// -------------------------------------------------------------
function NgoActivePasses() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedPass, setSelectedPass] = useState<Order | null>(null);

  useEffect(() => {
    getMyOrders().then(res => {
      setOrders(res.filter(o => o.status === "RESERVED"));
    }).catch(() => []);
  }, []);

  return (
    <div className="ss-reveal">
      <PageIntro
        eyebrow="Counter Pickup Passes"
        title="Active QR Pickup Passes"
        copy="Show the QR code or Pass ID on your screen when you arrive at the supermarket counter. The cashier will scan it to verify and complete your purchase."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {orders.map(order => {
          const passId = order.qrCode || order.id.slice(-6).toUpperCase();
          return (
            <div key={order.id} className="ss-card p-6 bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="ss-kicker text-[10px]">Active Reservation</span>
                    <h3 className="font-bold text-xl text-[hsl(var(--primary))] mt-1">{order.productName || "Produce Lot"}</h3>
                  </div>
                  <StatusChip label="Reserved" />
                </div>

                <div className="mt-5 flex items-center justify-center p-4 bg-[#FAF9F5] rounded-xl border border-stone-200">
                  <QRCodeSVG value={order.qrCode || order.id} size={150} level="M" />
                </div>

                <div className="mt-4 text-center">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Pass Code</p>
                  <p className="font-mono text-2xl font-bold tracking-widest text-[#C2671A] mt-0.5">{passId}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[hsl(var(--border))] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[hsl(var(--muted-foreground))]">Quantity</span>
                    <p className="font-bold mt-0.5">{order.quantity} units</p>
                  </div>
                  <div>
                    <span className="text-[hsl(var(--muted-foreground))]">Total to Pay</span>
                    <p className="font-bold text-[hsl(var(--accent))] mt-0.5">₹{order.priceAtOrder ? order.priceAtOrder.toFixed(2) : "—"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[hsl(var(--border))] text-center">
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Present this code at store counter to fulfill order.</p>
              </div>
            </div>
          );
        })}

        {orders.length === 0 && (
          <div className="col-span-2 ss-card py-16 text-center">
            <QrCode className="mx-auto h-12 w-12 text-stone-300" />
            <h3 className="mt-4 font-bold text-lg text-[hsl(var(--primary))]">No Active Reservations</h3>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] max-w-sm mx-auto">
              You don't have any active pickup passes right now. Browse available food to reserve items and get your QR pass!
            </p>
            <Link href="/ngo/available-food" className="ss-btn-primary inline-flex items-center gap-2 mt-5 px-5 py-2.5 text-xs">
              Browse Available Produce <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMER & NGO WORKSPACE: ORDER HISTORY
// -------------------------------------------------------------
function NgoHistory() {
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);

  useEffect(() => {
    getMyOrders().then(res => {
      // Sort newest first
      const sorted = [...res].sort((a, b) => new Date(b.reservedAt).getTime() - new Date(a.reservedAt).getTime());
      setHistoryOrders(sorted);
    }).catch(() => []);
  }, []);

  return (
    <div className="ss-reveal">
      <PageIntro
        eyebrow="Receipts & Records"
        title="Order History"
        copy="A chronological history of all your past reservations, fulfilled collections, and saved produce. Newest bookings appear on top."
      />

      <div className="ss-card overflow-hidden">
        <div className="ss-table-wrap">
          <table className="ss-table w-full text-sm">
            <thead>
              <tr>
                <th>Pass ID</th>
                <th>Produce Item</th>
                <th>Quantity</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {historyOrders.map(order => (
                <tr key={order.id} className="hover:bg-stone-50">
                  <td>
                    <span className="font-mono text-xs font-bold bg-stone-100 px-2 py-1 rounded border border-stone-200">
                      {order.qrCode || order.id.slice(-6).toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <p className="font-semibold">{order.productName || "Produce Lot"}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Order ID: {order.id.slice(-6)}</p>
                  </td>
                  <td>{order.quantity} units</td>
                  <td className="font-semibold">₹{order.priceAtOrder ? order.priceAtOrder.toFixed(2) : "—"}</td>
                  <td>
                    <StatusChip label={order.status === "FULFILLED" ? "Collected" : order.status} />
                  </td>
                  <td className="text-xs text-[hsl(var(--muted-foreground))]">
                    {new Date(order.reservedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
              {historyOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[hsl(var(--muted-foreground))]">
                    No order history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// NOTIFICATIONS PAGE
// -------------------------------------------------------------
function NotificationsPage() {
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);

  useEffect(() => {
    getNotifications().then(setNotifs).catch(() => []);
  }, []);

  return (
    <div className="ss-reveal">
      <PageIntro eyebrow="Activity" title="Notifications & Flash Deals" copy="Real-time notifications for discount tier changes, price drops, and order status." />
      <div className="ss-card p-4 space-y-3">
        {notifs.map(n => (
          <div key={n.id} className="p-4 rounded-xl border border-[hsl(var(--border))] flex items-start gap-3">
            <Bell className="h-5 w-5 text-[hsl(var(--accent))] mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{n.message}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
        {notifs.length === 0 && (
          <div className="py-12 text-center text-xs text-[hsl(var(--muted-foreground))]">No notifications right now.</div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// PRODUCT ROUTE DISPATCHER
// -------------------------------------------------------------
function ProductRoute() {
  const [location] = useLocation();
  const role: AppWorkspaceRole = location.startsWith("/ngo") ? "ngo" : "supermarket";
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (message: string, kind: ToastKind = "success") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3000);
  };

  const type = location.split("/").filter(Boolean).slice(1).join("/") || "overview";

  const renderPage = () => {
    // Supermarket routes
    if (role === "supermarket") {
      if (type === "overview") return <DashboardHome onAction={notify} />;
      if (type === "inventory") return <InventoryPage onAction={notify} />;
      if (type === "detection") return <DetectionPage onAction={notify} />;
      if (type === "surplus") return <SurplusPage onAction={notify} />;
      if (type === "verification") return <VerificationPage onAction={notify} />;
      if (type === "impact") return <ImpactPage />;
      if (type === "notifications") return <NotificationsPage />;
      return <DashboardHome onAction={notify} />;
    }

    // Customer & NGO routes: Browse Food, Active Passes, Order History, Notifications
    if (role === "ngo") {
      if (type === "available-food" || type === "overview") return <NgoAvailableFood onAction={notify} />;
      if (type === "active" || type === "requests") return <NgoActivePasses />;
      if (type === "history" || type === "pickups") return <NgoHistory />;
      if (type === "notifications") return <NotificationsPage />;
      return <NgoAvailableFood onAction={notify} />;
    }

    return <DashboardHome onAction={notify} />;
  };

  return (
    <div className="ss-shell ss-noise flex min-h-[100dvh]">
      <Sidebar role={role} path={location} onNavigate={() => setToast(null)} />
      <div className="min-w-0 flex-1">
        <MobileNav role={role} path={location} onNavigate={() => setToast(null)} />
        <Topbar role={role} path={location} onAction={notify} />
        <main className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8 lg:py-9">
          {renderPage()}
        </main>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="ss-shell grid min-h-[100dvh] place-items-center px-5 text-center">
      <div>
        <p className="ss-kicker">404</p>
        <h1 className="mt-3 text-4xl font-bold text-[hsl(var(--primary))]">Page not found</h1>
        <Link href="/" className="ss-btn-primary mt-6 inline-flex px-4 py-2.5 text-xs">Back to Home</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <ErrorBoundary>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/login" component={Login} />
          <Route path="/supermarket/:rest*" component={ProductRoute} />
          <Route path="/ngo/:rest*" component={ProductRoute} />
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
      <Toaster />
    </TooltipProvider>
  );
}
