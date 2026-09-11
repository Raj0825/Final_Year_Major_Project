import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import {
  AlertTriangle, ArrowRight, BarChart3, BadgeCheck, Bell, Boxes, Building2,
  CalendarClock, Check, CheckCircle2, ChevronDown, ClipboardCheck,
  Clock3, Edit3, Flag, FileScan, Handshake, Heart, Leaf, LogOut, MapPin, Menu, PackageCheck,
  Plus, Search, Send, Settings, ShieldCheck, SlidersHorizontal,
  Truck, UploadCloud, Users, X, ScanLine, Sparkles, RefreshCw, ShoppingBag,
  QrCode, History, ShoppingCart, Store, Minus, Moon, Sun
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

// Dark Mode Theme Context
const ThemeContext = createContext<{ theme: "light" | "dark"; toggleTheme: () => void }>({
  theme: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("ss_theme") as "light" | "dark") || "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("ss_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className="p-2 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] text-[#554F4A] dark:text-[#E2E8E5] hover:bg-[#F8F6F1] dark:hover:bg-[#26312E] transition-all shadow-sm flex items-center justify-center cursor-pointer"
      aria-label="Toggle dark mode"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-[#F59E0B]" />
      ) : (
        <Moon className="h-4 w-4 text-[#554F4A]" />
      )}
    </button>
  );
}

// Store Staff Navigation matching reference screenshot
const supermarketNav = [
  { href: "/supermarket/overview", label: "Overview", icon: BarChart3 },
  { href: "/supermarket/inventory", label: "Inventory", icon: Boxes },
  { href: "/supermarket/detection", label: "Freshness check", icon: ScanLine },
  { href: "/supermarket/inventory?view=expiry", label: "Expiry date", icon: CalendarClock },
  { href: "/supermarket/surplus", label: "Available food", icon: PackageCheck },
  { href: "/supermarket/verification?view=requests", label: "Food requests", icon: Users },
  { href: "/supermarket/verification?view=pickups", label: "Pickups", icon: Truck },
  { href: "/supermarket/verification", label: "Verify pickup", icon: BadgeCheck },
  { href: "/supermarket/impact", label: "Impact", icon: Leaf },
];

// Customer & NGO Navigation (Removed Verify pickup as requested)
const ngoNav = [
  { href: "/ngo/overview", label: "Overview", icon: BarChart3 },
  { href: "/ngo/available-food", label: "Food available nearby", icon: Boxes },
  { href: "/ngo/history", label: "My orders", icon: ClipboardCheck },
  { href: "/ngo/active", label: "My pickups", icon: Truck },
  { href: "/ngo/impact", label: "Impact", icon: Leaf },
];

function Logo({ dark = false }: { dark?: boolean }) {
  if (dark) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#FF6548] text-white font-bold text-base shadow-sm">
          S
        </div>
        <span className="text-lg font-bold tracking-tight text-white">
          Smart<span className="text-[#FF6548]">Surplus</span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#343D3B] text-white font-bold text-base shadow-sm">
        S
      </div>
      <span className="text-lg font-bold tracking-tight text-[#2D2320] dark:text-[#F0F4F2]">
        Smart<span className="text-[#FF6548]">Surplus</span>
      </span>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  const norm = (label || "").toLowerCase();
  if (norm.includes("expir") || norm.includes("tier_3") || norm.includes("tier_2") || norm.includes("urgent")) {
    return <span className="ss-chip badge-expiring">Expiring soon</span>;
  }
  if (norm.includes("avail") || norm.includes("fresh") || norm.includes("tier_1")) {
    return <span className="ss-chip badge-available">Available</span>;
  }
  if (norm.includes("reserv")) {
    return <span className="ss-chip badge-reserved">Reserved</span>;
  }
  if (norm.includes("confirm")) {
    return <span className="ss-chip badge-confirmed">Confirmed</span>;
  }
  if (norm.includes("await") || norm.includes("pending")) {
    return <span className="ss-chip badge-awaiting">Awaiting pickup</span>;
  }
  return <span className="ss-chip badge-available">{label}</span>;
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-[#EAE6DF] bg-white px-4 py-3 shadow-xl ss-reveal" role="status">
      {toast.kind === "success" ? <CheckCircle2 className="h-5 w-5 text-[#00897B]" /> : <AlertTriangle className="h-5 w-5 text-[#FF6548]" />}
      <span className="text-sm font-semibold text-[#2D2320]">{toast.message}</span>
      <button onClick={onClose} aria-label="Close notification"><X className="h-4 w-4 text-[#8A847E]" /></button>
    </div>
  );
}

// -------------------------------------------------------------
// LANDING PAGE (Clean General Network)
// -------------------------------------------------------------
function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="ss-shell min-h-[100dvh] ss-noise flex flex-col justify-between">
      {/* Top Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[#7D7670] dark:text-[#A6B2AF]">Surplus Food Network</span>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Hero */}
      <main className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-10">
        <div className="ss-reveal">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#E0F7F2] text-[#00897B] text-xs font-semibold tracking-wide mb-6">
            Built for zero-waste food teams
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-[#2E221F] leading-[1.08]">
            Move good food. <br />
            <span className="text-[#FF6548]">Right on time.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base md:text-lg text-[#6C655F] leading-relaxed">
            Smart Surplus connects supermarkets with nearby organizations and customers so usable food moves before it expires.
          </p>

          <p className="mt-14 text-sm font-medium text-[#7D7670]">
            How will you use Smart Surplus?
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Link
              href="/login?role=supermarket"
              className="group flex items-center justify-between rounded-2xl border border-[#EAE6DF] bg-white p-5 shadow-sm transition-all hover:border-[#D0C9BE] hover:shadow-md cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#E8F8F4] text-[#00897B] shrink-0">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#2D2320]">I manage a supermarket</h2>
                  <p className="mt-0.5 text-xs text-[#7A746E]">Manage inventory, identify surplus food and arrange pickups.</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-[#9C958E] transition-transform group-hover:translate-x-1 shrink-0 ml-3" />
            </Link>

            <Link
              href="/login?role=ngo"
              className="group flex items-center justify-between rounded-2xl border border-[#EAE6DF] bg-white p-5 shadow-sm transition-all hover:border-[#D0C9BE] hover:shadow-md cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#FDF0EB] text-[#FF6548] shrink-0">
                  <Handshake className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#2D2320]">I need surplus food</h2>
                  <p className="mt-0.5 text-xs text-[#7A746E]">Find available food nearby as an NGO or individual customer.</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-[#9C958E] transition-transform group-hover:translate-x-1 shrink-0 ml-3" />
            </Link>
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-6 text-xs text-[#8A847E] flex justify-between items-center">
        <span>Smart Surplus • FreshRescue</span>
        <span>Connected Surplus Food Network</span>
      </footer>
    </div>
  );
}

// -------------------------------------------------------------
// LOGIN & REGISTRATION PAGE
// -------------------------------------------------------------
function Login() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialRole = (searchParams.get("role") as AppWorkspaceRole) || "supermarket";

  const [role, setRole] = useState<AppWorkspaceRole>(initialRole);
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
          name: name || (role === "supermarket" ? "Ananya Kulkarni" : "Priya Deshmukh"),
          role: backendRole,
        });
        localStorage.setItem("fr_token", res.token);
        localStorage.setItem("fr_user", JSON.stringify(res));
      } else {
        const res = await apiLogin({ email, password });
        localStorage.setItem("fr_token", res.token);
        localStorage.setItem("fr_user", JSON.stringify(res));
      }
      setLocation(role === "supermarket" ? "/supermarket/overview" : "/ngo/overview");
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
      setName("Ananya Kulkarni");
    } else {
      setEmail("priya@ngo.org");
      setPassword("password123");
      setName("Priya Deshmukh");
    }
  };

  return (
    <div className="ss-shell flex min-h-[100dvh] flex-col justify-between">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/"><Logo /></Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-8">
        <div className="grid w-full gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#E0F7F2] text-[#00897B] text-xs font-semibold tracking-wide mb-4">
              Unified Portal
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#2E221F] leading-tight">
              Sign in to <br /><span className="text-[#FF6548]">Smart Surplus</span>
            </h1>
            <p className="mt-4 max-w-md text-sm text-[#6C655F] leading-relaxed">
              Supermarket managers track inventory decay & fulfill pickups. NGOs and local customers browse discounted food and get instant QR pickup passes.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={() => handleQuickDemo("supermarket")} className="ss-btn-soft px-3.5 py-2 text-xs">
                Quick Supermarket Demo
              </button>
              <button onClick={() => handleQuickDemo("ngo")} className="ss-btn-soft px-3.5 py-2 text-xs">
                Quick Customer / NGO Demo
              </button>
            </div>
          </div>

          <div className="ss-card mx-auto w-full max-w-md p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="font-bold text-[#2D2320]">{isRegister ? "Create Account" : "Sign In"}</p>
                <p className="mt-0.5 text-xs text-[#7A746E]">Select your workspace role below.</p>
              </div>
              <button onClick={() => setIsRegister(!isRegister)} className="text-xs font-semibold text-[#FF6548] hover:underline">
                {isRegister ? "Have an account? Sign In" : "Need account? Sign Up"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setRole("supermarket")}
                className={`rounded-xl border p-3.5 text-left transition-all ${role === "supermarket" ? "border-[#FF6548] bg-[#FDF2EF]" : "border-[#EAE6DF] bg-white"}`}
              >
                <Building2 className={`h-5 w-5 ${role === "supermarket" ? "text-[#FF6548]" : "text-[#7A746E]"}`} />
                <strong className="mt-2 block text-xs font-bold text-[#2D2320]">Supermarket</strong>
                <span className="text-[11px] text-[#7A746E]">Manager workspace</span>
              </button>
              <button
                type="button"
                onClick={() => setRole("ngo")}
                className={`rounded-xl border p-3.5 text-left transition-all ${role === "ngo" ? "border-[#FF6548] bg-[#FDF2EF]" : "border-[#EAE6DF] bg-white"}`}
              >
                <Users className={`h-5 w-5 ${role === "ngo" ? "text-[#FF6548]" : "text-[#7A746E]"}`} />
                <strong className="mt-2 block text-xs font-bold text-[#2D2320]">Customer / NGO</strong>
                <span className="text-[11px] text-[#7A746E]">Browse & QR passes</span>
              </button>
            </div>

            {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600 border border-red-200">{error}</div>}

            <form onSubmit={handleAuth} className="space-y-3">
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320]">Full Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} required className="ss-input mt-1 text-sm" placeholder="e.g. Priya Deshmukh" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#2D2320]">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="ss-input mt-1 text-sm" placeholder="name@email.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2D2320]">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="ss-input mt-1 text-sm" placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading} className="ss-btn-coral mt-4 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {isRegister ? "Create Account & Enter" : `Enter as ${role === "ngo" ? "Customer / NGO" : "Store Manager"}`}
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-4 text-xs text-[#8A847E] text-center">
        Smart Surplus • Surplus Food Network
      </footer>
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
  const displayName = user?.name || (role === "ngo" ? "Priya Deshmukh" : "Ananya Kulkarni");
  const storeCardInitials = role === "supermarket" ? "FM" : "PD";
  const storeTitle = role === "supermarket" ? "FreshMart Supermarket" : displayName;
  const storeSubtitle = role === "supermarket" ? "Supermarket manager" : "Individual customer";

  const handleLogout = () => {
    localStorage.removeItem("fr_token");
    localStorage.removeItem("fr_user");
    setLocation("/");
  };

  return (
    <aside className="ss-sidebar hidden w-[240px] shrink-0 flex-col lg:flex border-r border-[#3E4947]">
      {/* Top Logo */}
      <div className="px-5 pb-5 pt-6">
        <Logo dark />
      </div>

      {/* Profile Card (FM FreshMart... / PD Priya Deshmukh) */}
      <div className="px-4 pb-4">
        <div className="rounded-xl bg-[#28312F] border border-white/5 p-3 flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#FF6548] text-xs font-bold text-white shrink-0">
            {storeCardInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{storeTitle}</p>
            <p className="truncate text-[11px] text-[#8E9B97]">{storeSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 space-y-1" aria-label={`${role} navigation`}>
        {items.map(item => {
          const Icon = item.icon;
          const active = path === item.href || (item.href.includes("?") && path === item.href.split("?")[0]);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium transition-all ${active ? "ss-sidebar-link-active" : "ss-sidebar-link"}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Nav Links */}
      <div className="px-3 pb-5 pt-3 border-t border-[#3E4947] space-y-1">
        <Link
          href={`/${role}/notifications`}
          onClick={onNavigate}
          className={`flex items-center justify-between px-3.5 py-2 text-sm font-medium ${path.endsWith("notifications") ? "ss-sidebar-link-active" : "ss-sidebar-link"}`}
        >
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </div>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] font-bold text-[#FF6548]">
            3
          </span>
        </Link>

        <button
          onClick={() => {}}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-sm font-medium ss-sidebar-link text-left"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-sm font-medium ss-sidebar-link text-left hover:text-[#FF6548]"
        >
          <LogOut className="h-4 w-4" />
          <span>Change role</span>
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
      <div className="flex items-center justify-between border-b border-[#3E4947] bg-[#343D3B] px-4 py-3">
        <Logo dark />
        <button className="rounded-lg p-1.5 text-white" onClick={() => setOpen(!open)} aria-label="Open navigation">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="bg-[#343D3B] absolute left-0 right-0 z-40 border-b border-[#3E4947] p-3 shadow-xl space-y-1">
          {items.map(item => {
            const Icon = item.icon;
            const active = path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { setOpen(false); onNavigate(); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${active ? "bg-white text-[#2E3735] font-semibold" : "text-[#A6B2AF]"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Topbar({ role, path }: { role: AppWorkspaceRole; path: string }) {
  const userRaw = localStorage.getItem("fr_user");
  const user = userRaw ? JSON.parse(userRaw) : null;
  const name = user?.name || (role === "ngo" ? "Priya Deshmukh" : "Ananya Kulkarni");
  const initials = name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || (role === "ngo" ? "PD" : "AK");
  const locationBreadcrumb = role === "supermarket" ? "Central Market Hub" : "City Center Market";
  const workspaceTitle = role === "supermarket" ? "Manager workspace" : "Recipient workspace";

  return (
    <header className="flex items-center justify-between bg-[#FAF7F2] dark:bg-[#1A2220] px-6 py-4 lg:px-8 border-b border-[#EAE6DF]/60 dark:border-[#2D3835]">
      {/* Breadcrumbs matching Screenshot 1 & 2 */}
      <div className="flex items-center gap-2 text-xs sm:text-sm">
        <MapPin className="h-4 w-4 text-[#00897B] dark:text-[#2DD4BF] shrink-0" />
        <span className="font-semibold text-[#00897B] dark:text-[#2DD4BF]">{locationBreadcrumb}</span>
        <span className="text-[#88827A] dark:text-[#64748B]">&gt;</span>
        <span className="text-[#554F4A] dark:text-[#CBD5E1] font-medium">{workspaceTitle}</span>
      </div>

      {/* User profile avatar on right + Theme Toggle */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#FCE5DF] dark:bg-[#3D2520] text-xs font-bold text-[#E0533C] dark:text-[#FF8D75]">
            {initials}
          </div>
          <span className="hidden sm:inline text-sm font-semibold text-[#2D2320] dark:text-[#E2E8E5]">{name}</span>
        </div>
      </div>
    </header>
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
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B]">THURSDAY, 19 JUNE 2026</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] mt-1">Items needing attention</h1>
          <p className="text-sm text-[#78726B] mt-1">A clear view of food that needs a decision before the next pickup window.</p>
        </div>
        <button
          onClick={() => setLocation("/supermarket/surplus")}
          className="ss-btn-coral px-4 py-2.5 text-sm flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center shadow-sm"
        >
          <Plus className="h-4 w-4" /> List surplus
        </button>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="ss-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670]">Items needing attention</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F]">{urgentBatches.length || 12}</p>
              <p className="mt-2 text-xs text-[#8A847E]">4 expiring today</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#FEECE8] text-[#E0533C] shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="ss-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670]">Food awaiting pickup</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F]">86 kg</p>
              <p className="mt-2 text-xs text-[#8A847E]">Across 5 reservations</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E6F8F3] text-[#00897B] shrink-0">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="ss-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670]">Today's pickups</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F]">{pendingOrders.length || 4}</p>
              <p className="mt-2 text-xs text-[#8A847E]">Next one at 11:30 AM</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#F0F2F1] text-[#55605D] shrink-0">
              <Truck className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="ss-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670]">New matches</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F]">7</p>
              <p className="mt-2 text-xs text-[#8A847E]">3 NGOs • 4 customers</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#FEECE8] text-[#E0533C] shrink-0">
              <Users className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 2 Middle Cards: Expiring food & Pickup status */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="ss-card p-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#EAE6DF]/60">
            <h2 className="text-base font-bold text-[#2E221F]">Expiring food</h2>
            <Link href="/supermarket/inventory" className="text-xs font-semibold text-[#00897B] hover:underline flex items-center gap-1">
              View inventory <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAE6DF] bg-white">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#F5F5F3] text-[#7A746E]">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#2E221F]">Amul Taaza Milk</span>
                    <span className="ss-chip badge-expiring">Expiring soon</span>
                  </div>
                  <p className="text-xs text-[#7A746E] mt-0.5">26 packets available • Expiry date: Today, 8:00 PM</p>
                </div>
              </div>
              <button onClick={() => setLocation("/supermarket/inventory")} className="text-xs font-semibold text-[#FF6548] hover:underline">
                Manage
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAE6DF] bg-white">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#F5F5F3] text-[#7A746E]">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#2E221F]">Bhindi</span>
                    <span className="ss-chip badge-expiring">Expiring soon</span>
                  </div>
                  <p className="text-xs text-[#7A746E] mt-0.5">13 kg available • Expiry date: Today, 9:00 PM</p>
                </div>
              </div>
              <button onClick={() => setLocation("/supermarket/inventory")} className="text-xs font-semibold text-[#FF6548] hover:underline">
                Manage
              </button>
            </div>
          </div>
        </div>

        <div className="ss-card p-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#EAE6DF]/60">
            <h2 className="text-base font-bold text-[#2E221F]">Pickup status</h2>
            <Link href="/supermarket/verification" className="text-xs font-semibold text-[#00897B] hover:underline">
              See all
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAE6DF] bg-white">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#F5F5F3] text-[#7A746E]">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-[#2E221F]">Annapurna Seva Foundation</p>
                  <p className="text-xs text-[#7A746E] mt-0.5">Today, 11:30 AM</p>
                </div>
              </div>
              <span className="ss-chip badge-confirmed">Confirmed</span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAE6DF] bg-white">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#F5F5F3] text-[#7A746E]">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-[#2E221F]">Central Community Kitchen</p>
                  <p className="text-xs text-[#7A746E] mt-0.5">Today, 2:00 PM</p>
                </div>
              </div>
              <span className="ss-chip badge-awaiting">Awaiting pickup</span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAE6DF] bg-white">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#F5F5F3] text-[#7A746E]">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-[#2E221F]">Priya Deshmukh</p>
                  <p className="text-xs text-[#7A746E] mt-0.5">Today, 5:30 PM</p>
                </div>
              </div>
              <span className="ss-chip badge-reserved">Reserved</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent activity */}
      <div className="ss-card p-6">
        <h2 className="text-base font-bold text-[#2E221F] mb-4">Recent activity</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="border-l-2 border-[#FF6548] pl-3">
            <p className="font-bold text-sm text-[#2E221F]">8 milk packets reserved</p>
            <p className="text-xs text-[#7A746E] mt-0.5">Annapurna Seva Foundation</p>
            <p className="text-[11px] text-[#A6A099] mt-1">12 min ago</p>
          </div>

          <div className="border-l-2 border-[#FF6548] pl-3">
            <p className="font-bold text-sm text-[#2E221F]">Pickup confirmed</p>
            <p className="text-xs text-[#7A746E] mt-0.5">Central Community Kitchen</p>
            <p className="text-[11px] text-[#A6A099] mt-1">48 min ago</p>
          </div>

          <div className="border-l-2 border-[#FF6548] pl-3">
            <p className="font-bold text-sm text-[#2E221F]">Expiry date checked</p>
            <p className="text-xs text-[#7A746E] mt-0.5">Amul Taaza Milk • 34 packets</p>
            <p className="text-[11px] text-[#A6A099] mt-1">1 hr ago</p>
          </div>
        </div>
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
  const [search, setSearch] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState("");
  const [newCategory, setNewCategory] = useState("Vegetables");
  const [newQty, setNewQty] = useState(30);
  const [newUnit, setNewUnit] = useState("kg");
  const [newPrice, setNewPrice] = useState(50);
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
      onAction(err?.message || "Failed to add batch.");
    } finally {
      setLoading(false);
    }
  };

  const seedItems = [
    { id: "s1", name: "Amul Taaza Milk", sku: "FM - 240 • Dairy", available: "26 packets", status: "Expiring soon", expiry: "Today, 8:00 PM", pickup: "Today, 6:00 PM", flagged: true },
    { id: "s2", name: "Fresh Paneer", sku: "FM - 241 • Dairy", available: "14 packs", status: "Available", expiry: "Tomorrow, 10:00 AM", pickup: "Today, 9:00 PM", flagged: false },
    { id: "s3", name: "Amul Masti Curd", sku: "FM - 242 • Dairy", available: "20 cups", status: "Reserved", expiry: "Tomorrow, 8:00 AM", pickup: "Today, 7:00 PM", flagged: false },
    { id: "s4", name: "Tomato", sku: "FM - 243 • Vegetables", available: "30 kg", status: "Available", expiry: "Tomorrow, 6:00 PM", pickup: "Tomorrow, 2:00 PM", flagged: false },
    { id: "s5", name: "Potato", sku: "FM - 244 • Vegetables", available: "47 kg", status: "Available", expiry: "In 2 days", pickup: "Tomorrow, 5:00 PM", flagged: false },
    { id: "s6", name: "Bhindi", sku: "FM - 245 • Vegetables", available: "13 kg", status: "Expiring soon", expiry: "Today, 9:00 PM", pickup: "Today, 7:00 PM", flagged: true },
  ];

  const liveItems = batches.map(b => ({
    id: b.id,
    name: b.productName,
    sku: `FM - ${b.id.slice(-3)} • ${b.category}`,
    available: `${b.quantity} ${b.unit}`,
    status: (b.state === "TIER_3" || b.state === "TIER_2") ? "Expiring soon" : b.state === "FRESH" ? "Available" : "Reserved",
    expiry: "Tomorrow, 8:00 PM",
    pickup: "Today, 9:00 PM",
    flagged: b.state === "TIER_3" || b.state === "TIER_2",
  }));

  const allInventory = [...seedItems, ...liveItems];

  const filtered = allInventory.filter(item => {
    const match = item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase());
    if (flaggedOnly) return match && item.flagged;
    return match;
  });

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B]">FRESHMART SUPERMARKET</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] mt-1">Inventory</h1>
          <p className="text-sm text-[#78726B] mt-1">Search stock, flag items for attention, and keep expiry information current.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="ss-btn-coral px-4 py-2.5 text-sm flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add inventory
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="ss-card p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#8A847E] pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search inventory by product or SKU"
              className="ss-input text-sm"
              style={{ paddingLeft: "2.6rem" }}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setFlaggedOnly(!flaggedOnly)}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${flaggedOnly ? "bg-[#FF6548] text-white border-[#FF6548]" : "bg-white text-[#554F4A] border-[#EAE6DF] hover:bg-[#F8F6F1]"}`}
            >
              <Flag className="h-3.5 w-3.5" /> Flagged only
            </button>
            <button
              onClick={() => {}}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white text-[#554F4A] border border-[#EAE6DF] hover:bg-[#F8F6F1]"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
            </button>
          </div>
        </div>

        {/* Inventory Data Table */}
        <div className="ss-table-wrap mt-5">
          <table className="ss-table w-full text-sm">
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>AVAILABLE</th>
                <th>STATUS</th>
                <th>EXPIRY DATE</th>
                <th>PICKUP DEADLINE</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-[#FAF8F5]">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#F5F5F3] text-[#7A746E] shrink-0">
                        <Boxes className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-[#2E221F]">{item.name}</p>
                        <p className="text-[11px] text-[#8A847E] mt-0.5">{item.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-semibold text-[#2E221F]">{item.available}</td>
                  <td>
                    <StatusBadge label={item.status} />
                  </td>
                  <td className="text-xs text-[#554F4A]">{item.expiry}</td>
                  <td className="text-xs text-[#554F4A]">{item.pickup}</td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        title="CNN Freshness Scan"
                        onClick={() => setLocation(`/supermarket/detection?batchId=${item.id}`)}
                        className="p-1.5 rounded-lg text-[#8A847E] hover:text-[#2E221F] hover:bg-[#F0EEEA]"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        title="Flag as Surplus"
                        onClick={() => setLocation("/supermarket/surplus")}
                        className={`p-1.5 rounded-lg ${item.flagged ? "text-[#FF6548]" : "text-[#8A847E]"} hover:bg-[#F0EEEA]`}
                      >
                        <Flag className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Produce Lot Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ss-card w-full max-w-md p-6 bg-white ss-reveal">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE6DF]">
              <h3 className="font-bold text-lg text-[#2E221F]">Add New Inventory Lot</h3>
              <button onClick={() => setModalOpen(false)}><X className="h-4 w-4 text-[#8A847E]" /></button>
            </div>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#2D2320]">Product Name</label>
                <input value={newProduct} onChange={e => setNewProduct(e.target.value)} required placeholder="e.g. Amul Taaza Milk, Tomato, Bhindi" className="ss-input mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320]">Category</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="ss-input mt-1">
                    <option>Dairy</option>
                    <option>Vegetables</option>
                    <option>Fruit</option>
                    <option>Bakery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320]">Unit</label>
                  <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="ss-input mt-1">
                    <option>packets</option>
                    <option>kg</option>
                    <option>packs</option>
                    <option>cups</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320]">Quantity</label>
                  <input type="number" min="1" value={newQty} onChange={e => setNewQty(Number(e.target.value))} required className="ss-input mt-1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320]">Price (₹ / unit)</label>
                  <input type="number" step="0.5" min="1" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} required className="ss-input mt-1" />
                </div>
              </div>
              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={loading} className="ss-btn-coral flex-1 py-2.5 text-xs font-semibold">
                  {loading ? "Adding..." : "Add to Inventory"}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="ss-btn-soft px-4 py-2.5 text-xs">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: FRESHNESS CHECK
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
    if (!selectedFile) {
      fileInputRef.current?.click();
      return;
    }
    setScanning(true);
    try {
      if (selectedBatchId) {
        const updated = await scanBatch(selectedBatchId, selectedFile);
        setResultBatch(updated);
        onAction(`CNN Scan complete! Freshness: ${Math.round((updated.freshnessScore || 0) * 100)}% (${updated.state})`, "success");
      } else {
        setResultBatch({
          id: "sim-1",
          storeId: "store-1",
          productName: "Fresh Produce Lot",
          category: "Produce",
          quantity: 25,
          unit: "kg",
          originalPrice: 40,
          currentDiscountPercent: 40,
          state: "TIER_2",
          freshnessScore: 0.72,
          stockedAt: new Date().toISOString(),
          quantityReserved: 0,
          imageUrls: [],
          needsManualReview: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as Batch);
        onAction("Freshness analysis complete! 72% Freshness detected.", "success");
      }
    } catch (err: any) {
      onAction(err?.response?.data?.message || err?.message || "CNN scan error.", "error");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00897B]">SIMULATED FRONTEND RESULT</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] mt-1">Freshness check</h1>
        <p className="text-sm text-[#78726B] mt-1">Upload a product photo to simulate a freshness analysis before listing surplus.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="ss-card p-6 bg-white">
          <h2 className="text-base font-bold text-[#2E221F] mb-4">Upload product photo</h2>

          {batches.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#78726B] mb-1">Target Lot</label>
              <select
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                className="ss-input text-xs"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.productName} ({b.quantity} {b.unit}) — Current: {b.state}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-[#DCD6CC] rounded-2xl p-10 text-center hover:border-[#FF6548] transition-all bg-[#FAF9F6] flex flex-col items-center justify-center min-h-[220px]"
          >
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            {previewUrl ? (
              <div className="space-y-3">
                <img src={previewUrl} alt="Preview" className="max-h-40 mx-auto rounded-xl object-contain shadow-sm" />
                <p className="text-xs text-[#7A746E]">Click to choose a different photo</p>
              </div>
            ) : (
              <div className="space-y-3 flex flex-col items-center">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#EDEAE4] text-[#6C655F]">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-bold text-[#2E221F]">Drop an image here</p>
                  <p className="text-xs text-[#8A847E] mt-0.5">PNG or JPG • simulated only</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="ss-btn-dark px-5 py-2.5 text-xs font-semibold mt-2"
                >
                  Choose image
                </button>
              </div>
            )}
          </div>

          {selectedFile && (
            <button
              onClick={handleRunScan}
              disabled={scanning}
              className="ss-btn-coral w-full mt-4 py-3 text-sm flex items-center justify-center gap-2"
            >
              {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {scanning ? "Analyzing Produce Freshness..." : "Run Freshness Analysis"}
            </button>
          )}
        </div>

        <div className="ss-card p-6 bg-white">
          <h2 className="text-base font-bold text-[#2E221F] mb-4">Analysis result</h2>

          {resultBatch ? (
            <div className="space-y-5 ss-reveal">
              <div className="rounded-2xl border border-[#EAE6DF] bg-[#FAF8F5] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#00897B]">CNN MobileNetV2 Output</span>
                    <h3 className="text-2xl font-extrabold text-[#2E221F] mt-1">{resultBatch.productName}</h3>
                  </div>
                  <StatusBadge label={resultBatch.state} />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#EAE6DF] pt-4">
                  <div>
                    <span className="text-xs text-[#7A746E]">Freshness Score</span>
                    <p className="text-3xl font-extrabold text-[#00897B] mt-1">
                      {Math.round((resultBatch.freshnessScore || 0.72) * 100)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#7A746E]">Applied Discount</span>
                    <p className="text-3xl font-extrabold text-[#FF6548] mt-1">
                      {resultBatch.currentDiscountPercent ? `-${resultBatch.currentDiscountPercent}%` : "-40%"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#EAE6DF] text-xs space-y-1 text-[#65605A]">
                  <p>• <strong>Decay Status:</strong> Evaluated as <strong>{resultBatch.state}</strong>.</p>
                  <p>• <strong>Recommendation:</strong> Fast customer pickup window set to prevent waste.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => onAction("Produce lot flagged for immediate surplus pickup.")}
                  className="ss-btn-coral flex-1 py-2.5 text-xs font-semibold"
                >
                  Confirm & List Surplus
                </button>
                <button
                  onClick={() => { setSelectedFile(null); setPreviewUrl(null); setResultBatch(null); }}
                  className="ss-btn-soft px-4 py-2.5 text-xs font-semibold"
                >
                  Scan Another
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#EAE6DF] bg-[#FAF9F6] p-12 text-center flex flex-col items-center justify-center min-h-[220px]">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#E6F8F3] text-[#00897B] mb-3">
                <ScanLine className="h-6 w-6" />
              </div>
              <p className="text-base font-bold text-[#2E221F]">Waiting for an upload</p>
              <p className="text-xs text-[#8A847E] mt-1">Your simulated result will appear here for review.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: SURPLUS
// -------------------------------------------------------------
function SurplusPage({ onAction }: { onAction: (message: string) => void }) {
  const [, setLocation] = useLocation();
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    getMyBatches().then(setBatches).catch(() => []);
  }, []);

  const surplusItems = [
    { id: "s1", name: "Amul Taaza Milk", status: "Expiring soon", deadline: "Today, 6:00 PM", available: 34, reserved: 8, remaining: 26 },
    { id: "s2", name: "Fresh Paneer", status: "Available", deadline: "Today, 9:00 PM", available: 18, reserved: 4, remaining: 14 },
    { id: "s3", name: "Amul Masti Curd", status: "Reserved", deadline: "Today, 7:00 PM", available: 26, reserved: 6, remaining: 20 },
    { id: "s4", name: "Tomato", status: "Available", deadline: "Tomorrow, 2:00 PM", available: 42, reserved: 12, remaining: 30 },
  ];

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B]">FRESHMART SUPERMARKET</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] mt-1">Surplus</h1>
          <p className="text-sm text-[#78726B] mt-1">Keep available, reserved, and remaining quantities visible as partners confirm.</p>
        </div>
        <button
          onClick={() => setLocation("/supermarket/inventory")}
          className="ss-btn-coral px-4 py-2.5 text-sm flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center shadow-sm"
        >
          <Plus className="h-4 w-4" /> List surplus
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="ss-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670]">Available</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F]">186 kg</p>
              <p className="mt-2 text-xs text-[#8A847E]">Across 8 food items</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E6F8F3] text-[#00897B] shrink-0">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="ss-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670]">Reserved</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F]">62 kg</p>
              <p className="mt-2 text-xs text-[#8A847E]">5 recipient requests</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#F0F2F1] text-[#55605D] shrink-0">
              <ClipboardCheck className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="ss-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670]">Remaining</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F]">124 kg</p>
              <p className="mt-2 text-xs text-[#8A847E]">Ready for new matches</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#FEECE8] text-[#E0533C] shrink-0">
              <Users className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {surplusItems.map(item => (
          <div key={item.id} className="ss-card p-6 bg-white space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-base text-[#2E221F]">{item.name}</h3>
                <p className="text-xs text-[#7A746E] mt-0.5">Pickup deadline: {item.deadline}</p>
              </div>
              <StatusBadge label={item.status} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="qty-segment-available p-3">
                <p className="text-xl font-extrabold text-[#2E221F]">{item.available}</p>
                <p className="text-[11px] text-[#7A746E] mt-1">Available</p>
              </div>

              <div className="qty-segment-reserved p-3">
                <p className="text-xl font-extrabold text-[#9C674E]">{item.reserved}</p>
                <p className="text-[11px] text-[#9C674E] mt-1">Reserved</p>
              </div>

              <div className="qty-segment-remaining p-3">
                <p className="text-xl font-extrabold text-[#00897B]">{item.remaining}</p>
                <p className="text-[11px] text-[#00897B] font-semibold mt-1">Remaining</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => onAction(`Editing quantities for ${item.name}`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#EAE6DF] text-xs font-semibold text-[#554F4A] hover:bg-[#F8F6F1]"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit quantities
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: COUNTER VERIFICATION
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
      onAction("Handoff verified! Inventory automatically deducted from store.", "success");
      fetchPending();
    } catch (err: any) {
      onAction(err?.response?.data?.message || err?.message || "Invalid or expired pickup code.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ss-reveal max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00897B]">CHECKOUT COUNTER</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] mt-1">Counter QR Verification</h1>
        <p className="text-sm text-[#78726B] mt-1">Scan customer QR codes or enter their 6-character Pass ID to deduct inventory.</p>
      </div>

      <div className="ss-card overflow-hidden">
        <div className="bg-[#343D3B] p-6 text-white">
          <QrCode className="h-8 w-8 text-[#FF6548]" />
          <h2 className="mt-3 text-xl font-bold">{verifiedOrder ? "Order Fulfilled & Stock Deducted" : "Scan or Enter Customer Pass"}</h2>
          <p className="mt-1 text-xs text-[#B0B8B5]">Instant inventory deduction at checkout counter</p>
        </div>

        {verifiedOrder ? (
          <div className="p-8 text-center ss-reveal space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#00897B]" />
            <h3 className="text-lg font-bold text-[#2E221F]">Handoff Confirmed!</h3>
            <p className="mx-auto max-w-sm text-sm text-[#7A746E]">
              Order <strong>{verifiedOrder.qrCode || verifiedOrder.id.slice(-6).toUpperCase()}</strong> ({verifiedOrder.quantity} units of {verifiedOrder.productName || "produce"}) is fulfilled and inventory has been deducted in MongoDB.
            </p>
            <button onClick={() => { setVerifiedOrder(null); setCode(""); }} className="ss-btn-coral px-5 py-2.5 text-xs font-semibold">
              Scan Next Customer Pass
            </button>
          </div>
        ) : (
          <div className="p-6">
            <label className="block text-xs font-semibold text-[#2D2320]">Enter 6-Character Pass ID</label>
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
                className="ss-btn-coral px-6 py-2.5 text-sm shrink-0 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Verify & Deduct
              </button>
            </div>

            {pendingOrders.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[#EAE6DF]">
                <p className="text-xs font-bold uppercase text-[#7A746E] mb-3">Customers Waiting at Checkout ({pendingOrders.length})</p>
                <div className="space-y-2">
                  {pendingOrders.map(po => (
                    <div key={po.id} className="flex items-center justify-between p-3 rounded-xl border border-[#EAE6DF] hover:bg-[#FAF8F5]">
                      <div>
                        <p className="font-bold text-xs text-[#2E221F]">{po.productName || "Produce Item"}</p>
                        <p className="text-[11px] text-[#7A746E]">Qty: {po.quantity} • Pass: <strong className="font-mono text-[#FF6548]">{po.qrCode || po.id.slice(-6).toUpperCase()}</strong></p>
                      </div>
                      <button
                        onClick={() => { setCode(po.qrCode || po.id.slice(-6).toUpperCase()); handleVerify(po.qrCode || po.id.slice(-6).toUpperCase()); }}
                        className="ss-btn-soft px-3 py-1.5 text-xs"
                      >
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
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: IMPACT & ESG
// -------------------------------------------------------------
function ImpactPage() {
  return (
    <div className="ss-reveal max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00897B]">SUSTAINABILITY & ESG</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] mt-1">Supermarket Impact Telemetry</h1>
        <p className="text-sm text-[#78726B] mt-1">Every batch rescued prevents unnecessary organic landfill waste and reduces methane emissions.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="ss-card p-5">
          <p className="text-xs font-medium text-[#7D7670]">Food Rescued</p>
          <p className="mt-3 text-3xl font-extrabold text-[#2E221F]">4.6 Tonnes</p>
          <p className="mt-2 text-xs text-[#8A847E]">Prevented from waste bins</p>
        </div>
        <div className="ss-card p-5">
          <p className="text-xs font-medium text-[#7D7670]">Methane Emissions Avoided</p>
          <p className="mt-3 text-3xl font-extrabold text-[#00897B]">11.5 T CO₂e</p>
          <p className="mt-2 text-xs text-[#8A847E]">Carbon footprint reduction</p>
        </div>
        <div className="ss-card p-5">
          <p className="text-xs font-medium text-[#7D7670]">Meals Redistributed</p>
          <p className="mt-3 text-3xl font-extrabold text-[#FF6548]">1,860 Meals</p>
          <p className="mt-2 text-xs text-[#8A847E]">Nutritious food saved</p>
        </div>
      </div>

      <div className="ss-card p-6 bg-[#343D3B] text-white">
        <span className="text-xs font-bold uppercase tracking-wider text-[#FF6548]">Certified ESG Telemetry</span>
        <h2 className="text-2xl font-bold mt-2">Zero-Waste Supermarket Initiative</h2>
        <p className="text-[#B0B8B5] text-sm mt-2 max-w-2xl leading-relaxed">
          Powered by MobileNetV2 CNN produce quality evaluation and dynamic discount tiering, Smart Surplus gives supermarkets real-time inventory telemetry to meet sustainability goals.
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMER & NGO WORKSPACE: OVERVIEW (Matching Screenshot 1)
// -------------------------------------------------------------
function NgoOverview({ onAction }: { onAction: (message: string, kind?: ToastKind) => void }) {
  const [, setLocation] = useLocation();
  const [quantities, setQuantities] = useState<Record<string, number>>({
    "c1": 0,
    "c2": 0,
    "c3": 0,
    "c4": 0,
  });
  const [reserveModalItem, setReserveModalItem] = useState<{ id: string; name: string; unit: string; price: number; store: string } | null>(null);
  const [reserveQty, setReserveQty] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [issuedOrder, setIssuedOrder] = useState<Order | null>(null);

  const overviewItems = [
    { id: "c1", name: "Amul Taaza Milk", status: "Expiring soon", available: "26 packets available", expiry: "Today, 8:00 PM", price: 18, unit: "packet", store: "FreshMart Central Hub" },
    { id: "c2", name: "Fresh Paneer", status: "Available", available: "14 packs available", expiry: "Tomorrow, 10:00 AM", price: 72, unit: "pack", store: "FreshMart West Branch" },
    { id: "c3", name: "Amul Masti Curd", status: "Reserved", available: "20 cups available", expiry: "Tomorrow, 8:00 AM", price: 24, unit: "cups", store: "FreshMart Central Hub" },
    { id: "c4", name: "Tomato", status: "Available", available: "30 kg available", expiry: "Tomorrow, 6:00 PM", price: 22, unit: "kg", store: "FreshMart East Branch" },
  ];

  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const handleBuy = (item: typeof overviewItems[0]) => {
    const qty = quantities[item.id] > 0 ? quantities[item.id] : 1;
    setReserveQty(qty);
    setReserveModalItem(item);
    setIssuedOrder(null);
  };

  const handleConfirmReservation = async () => {
    if (!reserveModalItem) return;
    setReserving(true);
    try {
      // Mock order pass creation for UI demo or API
      const randomCode = "SS-" + Math.floor(1000 + Math.random() * 9000);
      const newOrder = {
        id: "ord-" + Date.now(),
        listingId: reserveModalItem.id,
        productName: reserveModalItem.name,
        quantity: reserveQty,
        priceAtOrder: reserveModalItem.price * reserveQty,
        status: "RESERVED",
        reservedAt: new Date().toISOString(),
        qrCode: randomCode,
        userId: "demo-cust-1"
      } as unknown as Order;
      setIssuedOrder(newOrder);
      onAction(`Reserved ${reserveQty} ${reserveModalItem.unit} of ${reserveModalItem.name}!`, "success");
    } catch (err: any) {
      onAction(err?.message || "Reservation failed.", "error");
    } finally {
      setReserving(false);
    }
  };

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      {/* Top Header matching Screenshot 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B]">VERIFIED SURPLUS STORES</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] mt-1">Food available nearby</h1>
          <p className="text-sm text-[#78726B] mt-1">Find discounted food close to you, choose a quantity, and collect it during the pickup window.</p>
        </div>
        <button
          onClick={() => onAction("Area filter set to 5km radius.")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#EAE6DF] bg-white text-xs font-semibold text-[#2D2320] shadow-sm hover:bg-[#FAF8F5] shrink-0 self-start sm:self-center"
        >
          <MapPin className="h-3.5 w-3.5 text-[#00897B]" /> Change area
        </button>
      </div>

      {/* 3 Metric Cards matching Screenshot 1 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="ss-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670]">My orders</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F]">3</p>
              <p className="mt-2 text-xs text-[#8A847E]">1 ready for pickup</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#FEECE8] text-[#FF6548] shrink-0">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="ss-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670]">Upcoming pickups</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F]">2</p>
              <p className="mt-2 text-xs text-[#8A847E]">Next today at 5:30 PM</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E6F8F3] text-[#00897B] shrink-0">
              <Truck className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="ss-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670]">Food collected</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F]">16 items</p>
              <p className="mt-2 text-xs text-[#8A847E]">Since joining Smart Surplus</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#F0F2F1] text-[#55605D] shrink-0">
              <Handshake className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Two main columns: Available now & Upcoming pickups */}
      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr] items-start">
        {/* Left Column: Available now */}
        <div className="ss-card p-6 bg-white">
          <div className="flex items-center justify-between pb-4 border-b border-[#EAE6DF]/60">
            <h2 className="text-base font-bold text-[#2E221F]">Available now</h2>
            <Link href="/ngo/available-food" className="text-xs font-semibold text-[#00897B] hover:underline flex items-center gap-1">
              See all food <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {overviewItems.map(item => (
              <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-[#EAE6DF] bg-white gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#F5F5F3] text-[#7A746E] shrink-0">
                    <Boxes className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#2E221F]">{item.name}</span>
                      <StatusBadge label={item.status} />
                    </div>
                    <p className="text-xs text-[#7A746E] mt-0.5">{item.available} • Expiry date: {item.expiry}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {/* Stepper matching Screenshot 1 */}
                  <div className="flex items-center border border-[#EAE6DF] rounded-lg bg-white overflow-hidden">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="px-2.5 py-1 text-xs text-[#7A746E] hover:bg-[#F5F5F3]"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-2.5 py-1 text-xs font-bold text-[#2E221F] min-w-[24px] text-center">
                      {quantities[item.id] || 0}
                    </span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="px-2.5 py-1 text-xs text-[#7A746E] hover:bg-[#F5F5F3]"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleBuy(item)}
                    className="ss-btn-coral px-4 py-1.5 text-xs font-semibold shadow-sm"
                  >
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Upcoming pickups matching Screenshot 1 */}
        <div className="ss-card p-6 bg-white space-y-4">
          <h2 className="text-base font-bold text-[#2E221F]">Upcoming pickups</h2>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-[#EAE6DF] bg-[#FAF9F6]">
              <div className="flex items-start gap-2.5">
                <Store className="h-4 w-4 text-[#00897B] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-[#2E221F]">FreshMart Central Hub</p>
                  <div className="flex items-center justify-between text-xs text-[#7A746E] mt-1">
                    <span>Today • 5:30 PM</span>
                    <span className="font-semibold text-[#2D2320]">2 items</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[#EAE6DF] bg-[#FAF9F6]">
              <div className="flex items-start gap-2.5">
                <Store className="h-4 w-4 text-[#00897B] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-[#2E221F]">FreshMart West Branch</p>
                  <div className="flex items-center justify-between text-xs text-[#7A746E] mt-1">
                    <span>Tomorrow • 11:00 AM</span>
                    <span className="font-semibold text-[#2D2320]">1 item</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-center">
            <Link href="/ngo/active" className="text-xs font-semibold text-[#00897B] hover:underline">
              View pickup status &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Reservation & Instant QR Code Modal */}
      {reserveModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ss-card w-full max-w-md p-6 bg-white ss-reveal">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE6DF]">
              <h3 className="font-bold text-lg text-[#2E221F]">Reserve {reserveModalItem.name}</h3>
              <button onClick={() => setReserveModalItem(null)}><X className="h-4 w-4 text-[#8A847E]" /></button>
            </div>

            {issuedOrder ? (
              <div className="py-4 text-center space-y-3 ss-reveal">
                <CheckCircle2 className="mx-auto h-10 w-10 text-[#00897B]" />
                <h4 className="text-lg font-bold text-[#2E221F]">Pickup Pass Ready!</h4>
                <p className="text-xs text-[#7A746E]">
                  Show this QR code or Pass ID at <strong>{reserveModalItem.store}</strong> to collect:
                </p>

                <div className="my-3 flex justify-center p-3 bg-white rounded-xl border border-[#EAE6DF] shadow-sm w-fit mx-auto">
                  <QRCodeSVG value={issuedOrder.qrCode || issuedOrder.id} size={160} level="M" />
                </div>

                <div className="p-2.5 bg-[#FDF2EF] rounded-lg font-mono text-2xl font-bold tracking-widest text-[#FF6548]">
                  {issuedOrder.qrCode || issuedOrder.id.slice(-6).toUpperCase()}
                </div>

                <p className="text-xs text-[#7A746E]">
                  Hold reserved for 15 minutes • Pay ₹{(reserveModalItem.price * reserveQty).toFixed(2)} at counter
                </p>

                <div className="flex gap-2 pt-2">
                  <Link href="/ngo/active" className="ss-btn-coral flex-1 py-2.5 text-xs text-center font-semibold">
                    View in Active Passes
                  </Link>
                  <button onClick={() => setReserveModalItem(null)} className="ss-btn-soft px-4 py-2.5 text-xs font-semibold">
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320]">Quantity to Reserve ({reserveModalItem.unit})</label>
                  <input
                    type="number"
                    min="1"
                    value={reserveQty}
                    onChange={e => setReserveQty(Math.max(1, Number(e.target.value)))}
                    className="ss-input mt-1 text-sm"
                  />
                </div>

                <div className="rounded-xl bg-[#FAF8F5] border border-[#EAE6DF] p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#7A746E]">Price per unit:</span>
                    <strong className="text-[#2D2320]">₹{reserveModalItem.price.toFixed(2)} / {reserveModalItem.unit}</strong>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#2E221F] pt-1 border-t border-[#EAE6DF]">
                    <span>Total Amount to Pay:</span>
                    <span className="text-[#FF6548]">₹{(reserveModalItem.price * reserveQty).toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button onClick={handleConfirmReservation} disabled={reserving} className="ss-btn-coral flex-1 py-2.5 text-xs font-semibold">
                    {reserving ? "Generating Pass..." : "Confirm & Generate QR Pass"}
                  </button>
                  <button onClick={() => setReserveModalItem(null)} className="ss-btn-soft px-4 py-2.5 text-xs font-semibold">
                    Cancel
                  </button>
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
// CUSTOMER & NGO WORKSPACE: BROWSE FOOD (Matching Screenshot 2)
// -------------------------------------------------------------
function NgoAvailableFood({ onAction }: { onAction: (message: string, kind?: ToastKind) => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [quantities, setQuantities] = useState<Record<string, number>>({
    "f1": 0, "f2": 0, "f3": 0, "f4": 0, "f5": 0, "f6": 0
  });

  const [reserveModalItem, setReserveModalItem] = useState<{ id: string; name: string; unit: string; price: number; store: string } | null>(null);
  const [reserveQty, setReserveQty] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [issuedOrder, setIssuedOrder] = useState<Order | null>(null);

  useEffect(() => {
    getListings().then(setListings).catch(() => []);
  }, []);

  const foodCards = [
    {
      id: "f1",
      name: "Amul Taaza Milk",
      category: "Dairy",
      store: "FreshMart Central",
      distance: "1.2 km",
      status: "Expiring soon",
      quantityAvailable: "26 packets",
      pickupDeadline: "Today, 6:00 PM",
      price: 18,
      originalPrice: 28,
      unit: "packet"
    },
    {
      id: "f2",
      name: "Fresh Paneer",
      category: "Dairy",
      store: "FreshMart West",
      distance: "2.4 km",
      status: "Available",
      quantityAvailable: "14 packs",
      pickupDeadline: "Today, 9:00 PM",
      price: 72,
      originalPrice: 110,
      unit: "pack"
    },
    {
      id: "f3",
      name: "Amul Masti Curd",
      category: "Dairy",
      store: "FreshMart Central",
      distance: "2.8 km",
      status: "Reserved",
      quantityAvailable: "20 cups",
      pickupDeadline: "Today, 7:00 PM",
      price: 24,
      originalPrice: 36,
      unit: "cups"
    },
    {
      id: "f4",
      name: "Tomato",
      category: "Vegetables",
      store: "FreshMart East",
      distance: "3.6 km",
      status: "Available",
      quantityAvailable: "30 kg",
      pickupDeadline: "Tomorrow, 2:00 PM",
      price: 22,
      originalPrice: 35,
      unit: "kg"
    },
    {
      id: "f5",
      name: "Potato",
      category: "Vegetables",
      store: "FreshMart North",
      distance: "4.1 km",
      status: "Available",
      quantityAvailable: "47 kg",
      pickupDeadline: "Tomorrow, 5:00 PM",
      price: 18,
      originalPrice: 28,
      unit: "kg"
    },
    {
      id: "f6",
      name: "Bhindi",
      category: "Vegetables",
      store: "FreshMart City Lines",
      distance: "1.8 km",
      status: "Expiring soon",
      quantityAvailable: "13 kg",
      pickupDeadline: "Today, 7:00 PM",
      price: 28,
      originalPrice: 45,
      unit: "kg"
    },
  ];

  // Merge live items
  const liveFood = listings.map(l => ({
    id: l.id,
    name: l.productName,
    category: l.category || "Produce",
    store: l.storeName || "FreshMart Store",
    distance: "1.5 km",
    status: l.discountPercent > 20 ? "Expiring soon" : "Available",
    quantityAvailable: `${l.quantityAvailable} ${l.unit}`,
    pickupDeadline: "Today, 8:00 PM",
    price: l.currentPrice,
    originalPrice: l.originalPrice,
    unit: l.unit
  }));

  const allFood = [...foodCards, ...liveFood];

  const filtered = allFood.filter(item => {
    const matchCategory = selectedCategory === "All" || item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchQuery = item.name.toLowerCase().includes(query.toLowerCase()) || item.store.toLowerCase().includes(query.toLowerCase());
    return matchCategory && matchQuery;
  });

  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const handleBuy = (item: typeof allFood[0]) => {
    const qty = (quantities[item.id] && quantities[item.id] > 0) ? quantities[item.id] : 1;
    setReserveQty(qty);
    setReserveModalItem(item);
    setIssuedOrder(null);
  };

  const handleConfirmReservation = async () => {
    if (!reserveModalItem) return;
    setReserving(true);
    try {
      if (reserveModalItem.id.startsWith("f")) {
        // Mock order pass creation for seeded UI items
        const randomCode = "SS-" + Math.floor(1000 + Math.random() * 9000);
        const newOrder = {
          id: "ord-" + Date.now(),
          listingId: reserveModalItem.id,
          productName: reserveModalItem.name,
          quantity: reserveQty,
          priceAtOrder: reserveModalItem.price * reserveQty,
          status: "RESERVED",
          reservedAt: new Date().toISOString(),
          qrCode: randomCode,
          userId: "demo-cust-1"
        } as unknown as Order;
        setIssuedOrder(newOrder);
      } else {
        const order = await reserveListing(reserveModalItem.id, reserveQty);
        setIssuedOrder(order);
      }
      onAction(`Reserved ${reserveQty} ${reserveModalItem.unit} of ${reserveModalItem.name}!`, "success");
    } catch (err: any) {
      onAction(err?.message || "Reservation failed.", "error");
    } finally {
      setReserving(false);
    }
  };

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      {/* Top Header matching Screenshot 2 */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00897B]">VERIFIED SURPLUS STORES</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] mt-1">Food available nearby</h1>
        <p className="text-sm text-[#78726B] mt-1">Discounted food from stores near you. Select a quantity and collect it on time.</p>
      </div>

      {/* Filter and Categories Bar matching Screenshot 2 */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#8A847E] pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search food or store"
            className="ss-input text-sm"
            style={{ paddingLeft: "2.6rem" }}
          />
        </div>

        {/* Category Pills matching Screenshot 2 */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {["All", "Dairy", "Vegetables", "Bakery", "Staples"].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${selectedCategory === cat ? "bg-[#2E3735] text-white shadow-sm" : "bg-white text-[#554F4A] border border-[#EAE6DF] hover:bg-[#F8F6F1]"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Food Grid matching Screenshot 2 */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(item => (
          <div key={item.id} className="ss-card p-5 bg-white space-y-3.5 flex flex-col justify-between">
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#F5F5F3] text-[#7A746E]">
                  <Boxes className="h-5 w-5" />
                </div>
                <StatusBadge label={item.status} />
              </div>

              {/* Title & Store */}
              <div className="mt-3">
                <h3 className="font-bold text-base text-[#2E221F]">{item.name}</h3>
                <p className="text-xs text-[#7A746E] mt-0.5">{item.store} • {item.distance}</p>
              </div>

              {/* Two info boxes matching Screenshot 2 */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="rounded-xl bg-[#F6F6F4] p-2.5">
                  <p className="text-[11px] text-[#8A847E]">Quantity available</p>
                  <p className="font-bold text-xs text-[#2E221F] mt-0.5">{item.quantityAvailable}</p>
                </div>
                <div className="rounded-xl bg-[#F6F6F4] p-2.5">
                  <p className="text-[11px] text-[#8A847E]">Pickup deadline</p>
                  <p className="font-bold text-xs text-[#2E221F] mt-0.5">{item.pickupDeadline}</p>
                </div>
              </div>
            </div>

            {/* Bottom Row: Price, Stepper, and Buy Button */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#EAE6DF]/60">
              <div>
                <span className="text-lg font-extrabold text-[#FF6548]">₹{item.price}</span>
                <span className="text-xs text-[#8A847E] line-through ml-1">₹{item.originalPrice}</span>
                <span className="text-[11px] text-[#8A847E] block">/ {item.unit}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Stepper [ - ] [ 0 ] [ + ] */}
                <div className="flex items-center border border-[#EAE6DF] rounded-lg bg-white overflow-hidden">
                  <button
                    onClick={() => updateQty(item.id, -1)}
                    className="px-2 py-1 text-xs text-[#7A746E] hover:bg-[#F5F5F3]"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="px-2 py-1 text-xs font-bold text-[#2E221F] min-w-[20px] text-center">
                    {quantities[item.id] || 0}
                  </span>
                  <button
                    onClick={() => updateQty(item.id, 1)}
                    className="px-2 py-1 text-xs text-[#7A746E] hover:bg-[#F5F5F3]"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <button
                  onClick={() => handleBuy(item)}
                  className="ss-btn-coral px-4 py-2 text-xs font-semibold shadow-sm"
                >
                  Buy
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reservation & Instant QR Code Modal */}
      {reserveModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ss-card w-full max-w-md p-6 bg-white ss-reveal">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE6DF]">
              <h3 className="font-bold text-lg text-[#2E221F]">Reserve {reserveModalItem.name}</h3>
              <button onClick={() => setReserveModalItem(null)}><X className="h-4 w-4 text-[#8A847E]" /></button>
            </div>

            {issuedOrder ? (
              <div className="py-4 text-center space-y-3 ss-reveal">
                <CheckCircle2 className="mx-auto h-10 w-10 text-[#00897B]" />
                <h4 className="text-lg font-bold text-[#2E221F]">Pickup Pass Ready!</h4>
                <p className="text-xs text-[#7A746E]">
                  Show this QR code or Pass ID at <strong>{reserveModalItem.store}</strong> to collect:
                </p>

                <div className="my-3 flex justify-center p-3 bg-white rounded-xl border border-[#EAE6DF] shadow-sm w-fit mx-auto">
                  <QRCodeSVG value={issuedOrder.qrCode || issuedOrder.id} size={160} level="M" />
                </div>

                <div className="p-2.5 bg-[#FDF2EF] rounded-lg font-mono text-2xl font-bold tracking-widest text-[#FF6548]">
                  {issuedOrder.qrCode || issuedOrder.id.slice(-6).toUpperCase()}
                </div>

                <p className="text-xs text-[#7A746E]">
                  Hold reserved for 15 minutes • Pay ₹{(reserveModalItem.price * reserveQty).toFixed(2)} at counter
                </p>

                <div className="flex gap-2 pt-2">
                  <Link href="/ngo/active" className="ss-btn-coral flex-1 py-2.5 text-xs text-center font-semibold">
                    View in Active Passes
                  </Link>
                  <button onClick={() => setReserveModalItem(null)} className="ss-btn-soft px-4 py-2.5 text-xs font-semibold">
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320]">Quantity to Reserve ({reserveModalItem.unit})</label>
                  <input
                    type="number"
                    min="1"
                    value={reserveQty}
                    onChange={e => setReserveQty(Math.max(1, Number(e.target.value)))}
                    className="ss-input mt-1 text-sm"
                  />
                </div>

                <div className="rounded-xl bg-[#FAF8F5] border border-[#EAE6DF] p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#7A746E]">Price per unit:</span>
                    <strong className="text-[#2D2320]">₹{reserveModalItem.price.toFixed(2)} / {reserveModalItem.unit}</strong>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[#2E221F] pt-1 border-t border-[#EAE6DF]">
                    <span>Total Amount to Pay:</span>
                    <span className="text-[#FF6548]">₹{(reserveModalItem.price * reserveQty).toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button onClick={handleConfirmReservation} disabled={reserving} className="ss-btn-coral flex-1 py-2.5 text-xs font-semibold">
                    {reserving ? "Generating Pass..." : "Confirm & Generate QR Pass"}
                  </button>
                  <button onClick={() => setReserveModalItem(null)} className="ss-btn-soft px-4 py-2.5 text-xs font-semibold">
                    Cancel
                  </button>
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

  useEffect(() => {
    getMyOrders().then(res => {
      setOrders(res.filter(o => o.status === "RESERVED"));
    }).catch(() => []);
  }, []);

  return (
    <div className="ss-reveal max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00897B]">COUNTER PICKUP PASSES</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] mt-1">Active QR Pickup Passes</h1>
        <p className="text-sm text-[#78726B] mt-1">Show this QR code or Pass ID at the supermarket checkout counter to complete your purchase.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {orders.map(order => {
          const passId = order.qrCode || order.id.slice(-6).toUpperCase();
          return (
            <div key={order.id} className="ss-card p-6 bg-white flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#00897B]">Active Reservation</span>
                    <h3 className="font-bold text-lg text-[#2E221F] mt-0.5">{order.productName || "Produce Lot"}</h3>
                  </div>
                  <span className="ss-chip badge-reserved">Reserved</span>
                </div>

                <div className="mt-4 flex items-center justify-center p-4 bg-[#FAF9F6] rounded-xl border border-[#EAE6DF]">
                  <QRCodeSVG value={order.qrCode || order.id} size={150} level="M" />
                </div>

                <div className="mt-4 text-center">
                  <p className="text-xs text-[#7A746E]">Pass Code</p>
                  <p className="font-mono text-2xl font-bold tracking-widest text-[#FF6548] mt-0.5">{passId}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#EAE6DF] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#7A746E]">Quantity</span>
                    <p className="font-bold text-[#2E221F] mt-0.5">{order.quantity} units</p>
                  </div>
                  <div>
                    <span className="text-[#7A746E]">Total to Pay</span>
                    <p className="font-bold text-[#FF6548] mt-0.5">₹{order.priceAtOrder ? order.priceAtOrder.toFixed(2) : "—"}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#EAE6DF] text-center">
                <p className="text-[11px] text-[#7A746E]">Present this code at store counter to fulfill order.</p>
              </div>
            </div>
          );
        })}

        {orders.length === 0 && (
          <div className="col-span-2 ss-card py-16 text-center">
            <QrCode className="mx-auto h-12 w-12 text-[#B0A9A0]" />
            <h3 className="mt-4 font-bold text-lg text-[#2E221F]">No Active Reservations</h3>
            <p className="mt-1 text-xs text-[#7A746E] max-w-sm mx-auto">
              You don't have any active pickup passes right now. Browse available food to reserve items and get your QR pass!
            </p>
            <Link href="/ngo/available-food" className="ss-btn-coral inline-flex items-center gap-2 mt-5 px-5 py-2.5 text-xs font-semibold">
              Browse Available Food <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMER & NGO WORKSPACE: ORDER HISTORY (My Orders)
// -------------------------------------------------------------
function NgoHistory() {
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);

  useEffect(() => {
    getMyOrders().then(res => {
      const sorted = [...res].sort((a, b) => new Date(b.reservedAt).getTime() - new Date(a.reservedAt).getTime());
      setHistoryOrders(sorted);
    }).catch(() => []);
  }, []);

  return (
    <div className="ss-reveal max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00897B]">RECEIPTS & RECORDS</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] mt-1">My Orders</h1>
        <p className="text-sm text-[#78726B] mt-1">A chronological history of all your past reservations and fulfilled collections.</p>
      </div>

      <div className="ss-card overflow-hidden">
        <div className="ss-table-wrap">
          <table className="ss-table w-full text-sm">
            <thead>
              <tr>
                <th>PASS ID</th>
                <th>PRODUCE ITEM</th>
                <th>QUANTITY</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th>DATE & TIME</th>
              </tr>
            </thead>
            <tbody>
              {historyOrders.map(order => (
                <tr key={order.id} className="hover:bg-[#FAF8F5]">
                  <td>
                    <span className="font-mono text-xs font-bold bg-[#F5F5F3] px-2 py-1 rounded border border-[#EAE6DF]">
                      {order.qrCode || order.id.slice(-6).toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <p className="font-bold text-[#2E221F]">{order.productName || "Produce Lot"}</p>
                    <p className="text-[11px] text-[#8A847E]">Order: {order.id.slice(-6)}</p>
                  </td>
                  <td className="font-semibold text-[#2E221F]">{order.quantity} units</td>
                  <td className="font-semibold text-[#2E221F]">₹{order.priceAtOrder ? order.priceAtOrder.toFixed(2) : "—"}</td>
                  <td>
                    <StatusBadge label={order.status === "FULFILLED" ? "Confirmed" : order.status} />
                  </td>
                  <td className="text-xs text-[#7A746E]">
                    {new Date(order.reservedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
              {historyOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#7A746E]">
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
    <div className="ss-reveal max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00897B]">UPDATES & ALERTS</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] mt-1">Notifications</h1>
        <p className="text-sm text-[#78726B] mt-1">Real-time alerts for discount tier adjustments, orders, and pickups.</p>
      </div>

      <div className="ss-card p-4 space-y-3">
        {notifs.map(n => (
          <div key={n.id} className="p-4 rounded-xl border border-[#EAE6DF] flex items-start gap-3 bg-white">
            <Bell className="h-5 w-5 text-[#FF6548] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#2E221F]">{n.message}</p>
              <p className="text-[11px] text-[#8A847E] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
        {notifs.length === 0 && (
          <div className="py-12 text-center text-xs text-[#7A746E]">No notifications right now.</div>
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

    if (role === "ngo") {
      if (type === "overview") return <NgoOverview onAction={notify} />;
      if (type === "available-food" || type === "browse") return <NgoAvailableFood onAction={notify} />;
      if (type === "history" || type === "my-orders") return <NgoHistory />;
      if (type === "active" || type === "my-pickups") return <NgoActivePasses />;
      if (type === "impact") return <ImpactPage />;
      if (type === "notifications") return <NotificationsPage />;
      return <NgoOverview onAction={notify} />;
    }

    return <DashboardHome onAction={notify} />;
  };

  return (
    <div className="ss-shell flex min-h-[100dvh]">
      <Sidebar role={role} path={location} onNavigate={() => setToast(null)} />
      <div className="min-w-0 flex-1 flex flex-col">
        <MobileNav role={role} path={location} onNavigate={() => setToast(null)} />
        <Topbar role={role} path={location} />
        <main className="flex-1 px-6 py-8 lg:px-10">
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
        <h1 className="text-4xl font-extrabold text-[#2E221F]">Page not found</h1>
        <Link href="/" className="ss-btn-coral mt-6 inline-flex px-4 py-2.5 text-xs font-semibold">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
