import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import {
  AlertTriangle, ArrowRight, BarChart3, BadgeCheck, Bell, Boxes, Building2,
  CalendarClock, Check, CheckCircle2, ChevronDown, ClipboardCheck,
  Clock3, Edit3, Flag, FileScan, Handshake, Heart, Leaf, LogOut, MapPin, Menu, PackageCheck,
  Plus, Search, Send, Settings, ShieldCheck, SlidersHorizontal,
  Truck, UploadCloud, Users, X, ScanLine, Sparkles, RefreshCw, ShoppingBag,
  QrCode, History, ShoppingCart, Store, Minus, Moon, Sun, Trash2, Info, Phone,
  ExternalLink, FileText, ArrowUpDown, CheckCircle, Download, Eye, Navigation, Camera,
  Clock
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Link, Route, Switch, useLocation } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { login as apiLogin, register as apiRegister } from "@/api/auth";
import { getMyBatches, createBatch, scanBatch, updateBatchTier } from "@/api/batches";
import { getListings } from "@/api/listings";
import { getMyOrders, getPendingStoreOrders, fulfillOrderByCode } from "@/api/orders";
import { getNotifications } from "@/api/notifications";
import { getMyStore } from "@/api/stores";
import type { Batch, Listing, Order, NotificationItem, Role } from "@/types";

import {
  loadInventory, saveInventory, loadOrders, saveOrders, loadNotifications,
  saveNotifications, loadSettings, saveSettings, addReservation,
  fulfillPickupOrder, cancelPickupOrder, loadStores, saveStores, upsertStore,
  calculateDistance, isSameCity, resolveCoordinates, clearAllData, setCurrentUserEmail, isItemForStore, loadMyOrders, isOrderForCustomer, deduplicateOrders, syncFromCloud, confirmDiscardInventoryItem, InventoryItem, StoreOrder,
  AppNotification, UserSettings, RegisteredStore, DEFAULT_SETTINGS
} from "@/data/mockStore";

import { SettingsModal, SettingsTab } from "@/components/modals/SettingsModal";
import { ProductDetailModal } from "@/components/modals/ProductDetailModal";
import { EditBatchModal } from "@/components/modals/EditBatchModal";
import { ReceiptModal } from "@/components/modals/ReceiptModal";
import { WatchlistModal } from "@/components/modals/WatchlistModal";
import { nextPriceDrop, formatTimeRemaining, TIER_CONFIG, isPrintedDateInPast } from "@/config/tierConfig";
import LiveMapView from "@/components/LiveMapView";
import ESGDashboard from "@/components/ESGDashboard";

type AppWorkspaceRole = "supermarket" | "ngo";
type ToastKind = "success" | "warning" | "error" | "info";
type ToastState = { message: string; kind: ToastKind } | null;

// Dark Mode Theme Context
const ThemeContext = createContext<{ theme: "light" | "dark"; toggleTheme: () => void }>({
  theme: "light",
  toggleTheme: () => { },
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
  { href: "/supermarket/map", label: "Live Map", icon: MapPin },
  { href: "/supermarket/impact", label: "ESG Impact", icon: Leaf },
];

// Customer & NGO Navigation (Removed Verify pickup as requested)
const ngoNav = [
  { href: "/ngo/overview", label: "Overview", icon: BarChart3 },
  { href: "/ngo/available-food", label: "Food available nearby", icon: Boxes },
  { href: "/ngo/history", label: "My orders", icon: ClipboardCheck },
  { href: "/ngo/active", label: "My pickups", icon: Truck },
  { href: "/ngo/map", label: "Live Map", icon: MapPin },
  { href: "/ngo/impact", label: "ESG Impact", icon: Leaf },
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
  if (norm.includes("discard recommended") || norm === "expired") {
    return <span className="ss-chip" style={{ background: "#FEECE8", color: "#C53030", borderColor: "#FEB2B2", fontWeight: 700 }}>Discard recommended</span>;
  }
  if (norm.includes("discarded")) {
    return <span className="ss-chip" style={{ background: "#EDF2F7", color: "#4A5568", borderColor: "#CBD5E0", fontWeight: 600 }}>Discarded</span>;
  }
  if (norm.includes("expir") || norm.includes("tier_3") || norm.includes("urgent")) {
    return <span className="ss-chip badge-expiring">Expiring soon</span>;
  }
  if (norm.includes("tier_2")) {
    return <span className="ss-chip" style={{ background: "#FEF3C7", color: "#92400E", borderColor: "#FDE68A" }}>Discounted (-40%)</span>;
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
  const [storeName, setStoreName] = useState("");
  const [storeLocation, setStoreLocation] = useState("");
  const [storeArea, setStoreArea] = useState("");
  const [userLocation, setUserLocation] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let registeredUser: any = null;
      if (isRegister) {
        const backendRole: Role = role === "supermarket" ? "STORE_MANAGER" : "CUSTOMER";
        try {
          const res = await apiRegister({
            email,
            password,
            name: name || (role === "supermarket" ? "Store Manager" : "Customer"),
            role: backendRole,
            storeName: role === "supermarket" ? storeName.trim() : undefined,
            storeAddress: role === "supermarket" ? storeLocation.trim() : undefined,
          });
          registeredUser = res;
          localStorage.setItem("fr_token", res.token);
          localStorage.setItem("fr_user", JSON.stringify(res));
        } catch (regErr: any) {
          const errMsg = regErr?.response?.data?.message || regErr?.message || "Registration failed. Email may already be in use.";
          setError(errMsg);
          setLoading(false);
          return;
        }

        // Set the current user email FIRST
        const cleanEmail = email.trim().toLowerCase();
        setCurrentUserEmail(cleanEmail);

        const targetStoreId = registeredUser?.storeId || `store_${Date.now()}`;
        const locCoords = resolveCoordinates(
          city.trim(),
          role === "supermarket" ? storeArea.trim() : selectedArea.trim(),
          role === "supermarket" ? storeLocation.trim() : userLocation.trim()
        );

        const newSettings: UserSettings = {
          ...DEFAULT_SETTINGS,
          name: name.trim() || (role === "supermarket" ? "Store Manager" : "Customer"),
          email: cleanEmail,
          role,
          gpsLat: locCoords.lat,
          gpsLng: locCoords.lng,
          ...(role === "supermarket" ? {
            storeId: targetStoreId,
            storeName: storeName.trim() || "My Store",
            storeLocation: storeLocation.trim(),
            storeArea: storeArea.trim() || (storeLocation.split(",")[0] || "Central Market").trim(),
            storeCity: city.trim()
          } : {
            userLocation: userLocation.trim() || "Home Address",
            selectedArea: selectedArea.trim() || (userLocation.split(",")[0] || "Central Market").trim(),
            userCity: city.trim()
          })
        };
        saveSettings(newSettings);

        if (role === "supermarket") {
          upsertStore({
            id: targetStoreId,
            name: newSettings.storeName,
            location: newSettings.storeLocation,
            area: newSettings.storeArea,
            city: newSettings.storeCity,
            managerName: newSettings.name
          });
        }
      } else {
        // --- LOGIN FLOW ---
        try {
          const res = await apiLogin({ email, password });
          registeredUser = res;
          localStorage.setItem("fr_token", res.token);
          localStorage.setItem("fr_user", JSON.stringify(res));
        } catch (loginErr: any) {
          const errMsg = loginErr?.response?.data?.message || loginErr?.message || "Invalid email or password. Please try again.";
          setError(errMsg);
          setLoading(false);
          return;
        }

        // Set the current user email FIRST so loadSettings loads this specific user's saved permanent settings
        const cleanEmail = email.trim().toLowerCase();
        setCurrentUserEmail(cleanEmail);

        const prevSettings = loadSettings();
        const isDifferentUser = prevSettings.email && prevSettings.email.trim().toLowerCase() !== cleanEmail;
        const currentSettings = isDifferentUser ? { ...DEFAULT_SETTINGS, email: cleanEmail } : prevSettings;

        let targetStoreId = "";
        let storeNameVal = "";
        let storeLocationVal = "";
        let storeAreaVal = "";
        let storeCityVal = "";
        let storePhoneVal = "";

        if (role === "supermarket") {
          // 1. For role supermarket, targetStoreId must be registeredUser.storeId from the login response.
          // Do NOT prefer a storeId from local settings, and NEVER generate store_${Date.now()} on login.
          // If the server returns no storeId, show an error ("No store linked to this account").
          targetStoreId = registeredUser?.storeId?.trim() || "";
          if (!targetStoreId) {
            localStorage.removeItem("fr_token");
            localStorage.removeItem("fr_user");
            setError("No store linked to this account");
            setLoading(false);
            return;
          }

          // Fetch latest cloud data before loading stores
          try {
            await syncFromCloud();
          } catch { }

          // 2. Name/location precedence:
          // The cloud store record with id === targetStoreId first, then getMyStore(), then saved settings.
          // Never fall back to "My Store" or "Market Main Road" on login.
          const allStores = loadStores();
          const cloudStore = allStores.find(s => s.id === targetStoreId);
          const serverStore = await getMyStore().catch(() => null);

          storeNameVal = cloudStore?.name || serverStore?.name || (isDifferentUser ? "" : currentSettings.storeName) || "";
          storeLocationVal = cloudStore?.location || serverStore?.address || (isDifferentUser ? "" : currentSettings.storeLocation) || "";
          storeAreaVal = cloudStore?.area || (isDifferentUser ? "" : currentSettings.storeArea) || "";
          storeCityVal = cloudStore?.city || (isDifferentUser ? "" : currentSettings.storeCity) || "";
          storePhoneVal = cloudStore?.phone || serverStore?.phone || (isDifferentUser ? "" : currentSettings.storePhone) || "";

          // Sync local store cache with the cloud/server source of truth without placeholder defaults
          if (storeNameVal) {
            upsertStore({
              id: targetStoreId,
              name: storeNameVal,
              location: storeLocationVal,
              area: storeAreaVal,
              city: storeCityVal,
              phone: storePhoneVal,
              managerName: registeredUser?.name || currentSettings.name
            });
          }
        }

        const loginSettings: UserSettings = {
          ...currentSettings,
          name: registeredUser?.name || currentSettings.name || (role === "supermarket" ? "Store Manager" : "Customer"),
          email: cleanEmail,
          role,
          ...(role === "supermarket" ? {
            storeId: targetStoreId,
            storeName: storeNameVal,
            storeLocation: storeLocationVal,
            storeArea: storeAreaVal,
            storeCity: storeCityVal,
            storePhone: storePhoneVal
          } : {
            userLocation: currentSettings.userLocation || "",
            selectedArea: currentSettings.selectedArea || "",
            userCity: currentSettings.userCity || ""
          })
        };

        saveSettings(loginSettings);
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
    setPassword("");
    if (demoRole === "supermarket") {
      setEmail("store@example.com");
      setName("Rajesh Patel");
      setStoreName("Apex Fresh Supermarket");
      setStoreLocation("Shop 10-12, Station Road, Central");
      setStoreArea("Central Market");
    } else {
      setEmail("customer@example.com");
      setName("Priya Sharma");
      setUserLocation("Flat 302, Green Enclave, Station Road");
      setSelectedArea("Central Market");
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
            {import.meta.env.DEV && (
              <div className="mt-6 flex flex-wrap gap-2">
                <button onClick={() => handleQuickDemo("supermarket")} className="ss-btn-soft px-3.5 py-2 text-xs">
                  Quick Supermarket Demo
                </button>
                <button onClick={() => handleQuickDemo("ngo")} className="ss-btn-soft px-3.5 py-2 text-xs">
                  Quick Customer / NGO Demo
                </button>
              </div>
            )}
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
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#2D2320]">Full Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} required className="ss-input mt-1 text-sm" placeholder={role === "supermarket" ? "e.g. Rajesh Patel" : "e.g. Priya Sharma"} />
                  </div>

                  {role === "supermarket" ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-[#2D2320]">Supermarket Name</label>
                        <input value={storeName} onChange={e => setStoreName(e.target.value)} required className="ss-input mt-1 text-sm" placeholder="e.g. Apex Fresh Supermarket" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#2D2320]">Store Address / Location</label>
                        <input value={storeLocation} onChange={e => setStoreLocation(e.target.value)} required className="ss-input mt-1 text-sm" placeholder="e.g. Shop 12-14, MG Road, Shivaji Nagar" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#2D2320]">Area / Neighborhood</label>
                        <input value={storeArea} onChange={e => setStoreArea(e.target.value)} required className="ss-input mt-1 text-sm" placeholder="e.g. Central Market" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#2D2320]">City <span className="text-rose-500">*</span></label>
                        <input value={city} onChange={e => setCity(e.target.value)} required className="ss-input mt-1 text-sm" placeholder="e.g. Pune, Mumbai, Delhi, Bangalore" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-[#2D2320]">Your Home / Delivery Address</label>
                        <input value={userLocation} onChange={e => setUserLocation(e.target.value)} required className="ss-input mt-1 text-sm" placeholder="e.g. Flat 301, Sunshine Heights, Paud Road" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#2D2320]">Area / Neighborhood</label>
                        <input value={selectedArea} onChange={e => setSelectedArea(e.target.value)} required className="ss-input mt-1 text-sm" placeholder="e.g. Central Market" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#2D2320]">City <span className="text-rose-500">*</span></label>
                        <input value={city} onChange={e => setCity(e.target.value)} required className="ss-input mt-1 text-sm" placeholder="e.g. Pune, Mumbai, Delhi, Bangalore" />
                      </div>
                    </>
                  )}
                </>
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
function Sidebar({ role, path, onNavigate, onOpenSettings }: { role: AppWorkspaceRole; path: string; onNavigate: () => void; onOpenSettings?: () => void }) {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const items = role === "supermarket" ? supermarketNav : ngoNav;

  const storeTitle = role === "supermarket" ? (settings.storeName || "My Supermarket") : (settings.name || "Customer");
  const storeSubtitle = role === "supermarket" ? (settings.storeLocation || "Store manager workspace") : (settings.userLocation || "Local Resident");
  const storeCardInitials = storeTitle.split(" ").filter(Boolean).map(n => n[0]).join("").substring(0, 2).toUpperCase() || (role === "supermarket" ? "SM" : "CU");

  const [unreadCount, setUnreadCount] = useState(() => loadNotifications().filter(n => !n.read).length);

  useEffect(() => {
    const handleNotifs = () => setUnreadCount(loadNotifications().filter(n => !n.read).length);
    const handleSettings = () => setSettings(loadSettings());
    window.addEventListener("ss_notifs_updated", handleNotifs);
    window.addEventListener("ss_settings_updated", handleSettings);
    return () => {
      window.removeEventListener("ss_notifs_updated", handleNotifs);
      window.removeEventListener("ss_settings_updated", handleSettings);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("fr_token");
    localStorage.removeItem("fr_user");
    localStorage.removeItem("ss_current_email");
    setLocation("/");
  };

  return (
    <aside className="ss-sidebar hidden w-[240px] shrink-0 flex-col lg:flex border-r border-[#3E4947]">
      {/* Top Logo */}
      <div className="px-5 pb-5 pt-6">
        <Logo dark />
      </div>

      {/* Dynamic Profile / Store Card */}
      <div className="px-4 pb-4">
        <div
          onClick={onOpenSettings}
          className="rounded-xl bg-[#28312F] border border-white/5 p-3 flex items-center gap-3 cursor-pointer hover:border-white/20 transition-all"
          title="Click to edit profile & store details"
        >
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
          {unreadCount > 0 && (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[#FF6548] text-[11px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </Link>

        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-sm font-medium ss-sidebar-link text-left hover:text-white cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-sm font-medium ss-sidebar-link text-left hover:text-[#FF6548] cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Change role</span>
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ role, path, onNavigate, onOpenSettings }: { role: AppWorkspaceRole; path: string; onNavigate: () => void; onOpenSettings?: () => void }) {
  const [open, setOpen] = useState(false);
  const items = role === "supermarket" ? supermarketNav : ngoNav;
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between border-b border-[#3E4947] bg-[#343D3B] px-4 py-3">
        <Logo dark />
        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button className="rounded-lg p-1.5 text-white" onClick={onOpenSettings} aria-label="Open settings">
              <Settings className="h-5 w-5" />
            </button>
          )}
          <button className="rounded-lg p-1.5 text-white" onClick={() => setOpen(!open)} aria-label="Open navigation">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
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

function Topbar({ role, path, onOpenLocation }: { role: AppWorkspaceRole; path: string; onOpenLocation?: () => void }) {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [notifications, setNotifications] = useState(loadNotifications);

  useEffect(() => {
    const handleSettings = () => setSettings(loadSettings());
    const handleNotifs = () => setNotifications(loadNotifications());
    window.addEventListener("ss_settings_updated", handleSettings);
    window.addEventListener("ss_notifs_updated", handleNotifs);
    return () => {
      window.removeEventListener("ss_settings_updated", handleSettings);
      window.removeEventListener("ss_notifs_updated", handleNotifs);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const locationBreadcrumb = role === "supermarket"
    ? (settings.storeLocation || settings.storeName || "Store Location")
    : (settings.userLocation || settings.selectedArea || "Your Location");
  const workspaceTitle = role === "supermarket" ? (settings.storeName || "Manager workspace") : "Recipient workspace";
  const displayName = role === "supermarket" ? (settings.name || "Store Manager") : (settings.name || "Customer");
  const initials = displayName.split(" ").filter(Boolean).map(n => n[0]).join("").substring(0, 2).toUpperCase() || (role === "supermarket" ? "SM" : "CU");
  const notifsPath = role === "supermarket" ? "/supermarket/notifications" : "/ngo/notifications";

  return (
    <header className="flex items-center justify-between bg-[#FAF7F2] dark:bg-[#1A2220] px-6 py-4 lg:px-8 border-b border-[#EAE6DF]/60 dark:border-[#2D3835]">
      {/* Clickable Location Breadcrumbs */}
      <button
        onClick={onOpenLocation}
        className="flex items-center gap-2 text-xs sm:text-sm text-left hover:opacity-80 transition-opacity cursor-pointer group"
        title="Click to view or edit location"
      >
        <MapPin className="h-4 w-4 text-[#00897B] dark:text-[#2DD4BF] shrink-0 group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-[#00897B] dark:text-[#2DD4BF] underline decoration-dotted underline-offset-4">{locationBreadcrumb}</span>
        <span className="text-[#88827A] dark:text-[#64748B]">&gt;</span>
        <span className="text-[#554F4A] dark:text-[#CBD5E1] font-medium">{workspaceTitle}</span>
      </button>

      {/* Right side: Notifications + Theme + Avatar */}
      <div className="flex items-center gap-3">
        {/* Notification Bell with Badge */}
        <button
          onClick={() => setLocation(notifsPath)}
          className="relative p-2 rounded-xl text-[#7A746E] dark:text-[#A3B2AC] hover:bg-[#EAE6DF] dark:hover:bg-[#2A3532] hover:text-[#2D2320] dark:hover:text-[#F0F4F2] transition-all cursor-pointer"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF6548] text-[9px] font-bold text-white shadow-sm">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
        <ThemeToggle />
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#FCE5DF] dark:bg-[#3D2520] text-xs font-bold text-[#E0533C] dark:text-[#FF8D75]">
            {initials}
          </div>
          <span className="hidden sm:inline text-sm font-semibold text-[#2D2320] dark:text-[#E2E8E5]">{displayName}</span>
        </div>
      </div>
    </header>
  );
}


// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: OVERVIEW
// -------------------------------------------------------------
function DashboardHome({ onAction }: { onAction: (message: string, kind?: ToastKind) => void }) {
  const [, setLocation] = useLocation();
  const [inventory, setInventory] = useState<InventoryItem[]>(loadInventory);
  const [orders, setOrders] = useState<StoreOrder[]>(loadOrders);
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);
  const [activeActivity, setActiveActivity] = useState<{ title: string; desc: string; time: string } | null>(null);
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  useEffect(() => {
    const handleUpdate = () => {
      setInventory(loadInventory());
      setOrders(loadOrders());
      setSettings(loadSettings());
    };
    window.addEventListener("ss_inventory_updated", handleUpdate);
    window.addEventListener("ss_orders_updated", handleUpdate);
    window.addEventListener("ss_settings_updated", handleUpdate);
    return () => {
      window.removeEventListener("ss_inventory_updated", handleUpdate);
      window.removeEventListener("ss_orders_updated", handleUpdate);
      window.removeEventListener("ss_settings_updated", handleUpdate);
    };
  }, []);

  const myInventory = inventory.filter(i => isItemForStore(i, settings.storeId, settings.storeName));
  const urgentItems = myInventory.filter(i => i.status === "Expiring soon" || i.flagged || i.expiryHoursLeft <= 6);
  const currentStoreName = (settings.storeName || "").trim().toLowerCase();
  const currentStoreId = (settings.storeId || "").trim();
  const myOrders = deduplicateOrders(orders.filter(o =>
    (currentStoreId && o.storeId && o.storeId === currentStoreId) ||
    (currentStoreName && o.storeName && o.storeName.trim().toLowerCase() === currentStoreName)
  ));
  const pendingOrders = myOrders.filter(o => o.status === "RESERVED");
  const totalReservedKg = pendingOrders.reduce((acc, o) => acc + o.quantity, 0);

  const handleQuickDiscount = (item: InventoryItem, discountPct: number) => {
    const updated = inventory.map(i => {
      if (i.id === item.id) {
        const discounted = Math.round(i.originalPrice * (1 - discountPct / 100));
        return {
          ...i,
          discountPercent: discountPct,
          currentPrice: discounted,
          status: "Expiring soon" as const,
          flagged: true
        };
      }
      return i;
    });
    saveInventory(updated);
    onAction(`Applied ${discountPct}% emergency discount to ${item.name}!`);
  };

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">
            {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">Items needing attention</h1>
          <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1">A clear view of food that needs a decision before the next pickup window.</p>
        </div>
        <button
          onClick={() => setLocation("/supermarket/surplus")}
          className="ss-btn-coral px-4 py-2.5 text-sm flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center shadow-sm cursor-pointer"
        >
          <Plus className="h-4 w-4" /> List surplus
        </button>
      </div>

      {/* 4 Clickable Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          onClick={() => setLocation("/supermarket/inventory?filter=urgent")}
          className="ss-card p-5 cursor-pointer hover:border-[#FF6548] hover:shadow-md transition-all group"
          title="Click to view items needing attention"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670] dark:text-[#A3B2AC] group-hover:text-[#FF6548] transition-colors">Items needing attention</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2]">{urgentItems.length}</p>
              <p className="mt-2 text-xs text-[#8A847E] dark:text-[#73827E] flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#FF6548] inline-block"></span>
                {urgentItems.filter(i => i.expiryHoursLeft <= 6).length} expiring today &rarr;
              </p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#FEECE8] dark:bg-[#3C221D] text-[#E0533C] dark:text-[#FFA18F] shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div
          onClick={() => setLocation("/supermarket/verification?view=requests")}
          className="ss-card p-5 cursor-pointer hover:border-[#00897B] hover:shadow-md transition-all group"
          title="Click to view food requests"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670] dark:text-[#A3B2AC] group-hover:text-[#00897B] transition-colors">Food awaiting pickup</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2]">{totalReservedKg} units</p>
              <p className="mt-2 text-xs text-[#8A847E] dark:text-[#73827E]">Across {pendingOrders.length} reservations &rarr;</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E6F8F3] dark:bg-[#16342C] text-[#00897B] dark:text-[#5EEAD4] shrink-0">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div
          onClick={() => setLocation("/supermarket/verification?view=pickups")}
          className="ss-card p-5 cursor-pointer hover:border-[#55605D] hover:shadow-md transition-all group"
          title="Click to view scheduled pickups"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670] dark:text-[#A3B2AC] group-hover:text-[#2E221F] dark:group-hover:text-white transition-colors">Today's pickups</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2]">{pendingOrders.length}</p>
              <p className="mt-2 text-xs text-[#8A847E] dark:text-[#73827E]">Next window ready &rarr;</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#F0F2F1] dark:bg-[#27312E] text-[#55605D] dark:text-[#9EAEA9] shrink-0">
              <Truck className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div
          onClick={() => setLocation("/supermarket/surplus")}
          className="ss-card p-5 cursor-pointer hover:border-[#FF6548] hover:shadow-md transition-all group"
          title="Click to view surplus food inventory"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670] dark:text-[#A3B2AC] group-hover:text-[#FF6548] transition-colors">Active surplus lots</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2]">{inventory.filter(i => i.available > 0).length}</p>
              <p className="mt-2 text-xs text-[#8A847E] dark:text-[#73827E]">Ready for customers &rarr;</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#FEECE8] dark:bg-[#3C221D] text-[#E0533C] dark:text-[#FFA18F] shrink-0">
              <Users className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 2 Middle Cards: Expiring food & Pickup status */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="ss-card p-6 bg-white dark:bg-[#1F2825]">
          <div className="flex items-center justify-between pb-4 border-b border-[#EAE6DF]/60 dark:border-[#2D3835]">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#2E221F] dark:text-[#F0F4F2]">Expiring food</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#FEECE8] dark:bg-[#3C221D] text-[#E0533C] dark:text-[#FFA18F] font-bold">
                {urgentItems.length}
              </span>
            </div>
            <Link href="/supermarket/inventory?view=expiry" className="text-xs font-semibold text-[#00897B] dark:text-[#2DD4BF] hover:underline flex items-center gap-1">
              Expiry watchlist <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {urgentItems.length === 0 ? (
              <div className="py-8 text-center rounded-xl border border-dashed border-[#EAE6DF] dark:border-[#2D3835]">
                <Boxes className="h-8 w-8 text-[#A3B2AC] mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold text-[#2E221F] dark:text-[#F0F4F2]">No items expiring soon</p>
                <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-1 max-w-xs mx-auto">
                  All produce in your inventory is fresh and within safe shelf life.
                </p>
              </div>
            ) : (
              urgentItems.slice(0, 3).map(item => (
                <div key={item.id} className="p-3.5 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#25302D] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#F5F5F3] dark:bg-[#1C2422] text-[#7A746E] dark:text-[#A3B2AC] shrink-0">
                        <Boxes className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">{item.name}</span>
                          <StatusBadge label={item.status} />
                        </div>
                        <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">
                          {item.available} {item.unit} available • Expiry: <strong>{item.expiry}</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#EAE6DF]/60 dark:border-[#2D3835] text-xs">
                    <span className="text-[#FF6548] font-bold">₹{item.currentPrice} / {item.unit.replace(/s$/, "")} (-{item.discountPercent}%)</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLocation(`/supermarket/detection?batchId=${item.id}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#EAE6DF] dark:border-[#384541] hover:bg-[#FAF8F5] dark:hover:bg-[#1F2825] text-[11px] font-semibold text-[#00897B] dark:text-[#2DD4BF] cursor-pointer"
                        title="Run AI CNN Freshness Analysis"
                      >
                        <ScanLine className="h-3 w-3" /> AI Scan
                      </button>
                      <button
                        onClick={() => handleQuickDiscount(item, 50)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#FF6548] text-[#FF6548] hover:bg-[#FDF2EF] dark:hover:bg-[#382420] text-[11px] font-semibold cursor-pointer"
                        title="Apply 50% Emergency Discount"
                      >
                        -50%
                      </button>
                      <button
                        onClick={() => setLocation("/supermarket/inventory")}
                        className="text-xs font-semibold text-[#554F4A] dark:text-[#CBD5E1] hover:underline cursor-pointer"
                      >
                        Manage &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="ss-card p-6 bg-white dark:bg-[#1F2825]">
          <div className="flex items-center justify-between pb-4 border-b border-[#EAE6DF]/60 dark:border-[#2D3835]">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#2E221F] dark:text-[#F0F4F2]">Pickup status</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#E6F8F3] dark:bg-[#16342C] text-[#00897B] dark:text-[#5EEAD4] font-bold">
                {orders.length}
              </span>
            </div>
            <Link href="/supermarket/verification?view=pickups" className="text-xs font-semibold text-[#00897B] dark:text-[#2DD4BF] hover:underline">
              See all pickups &rarr;
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {orders.length === 0 ? (
              <div className="py-8 text-center rounded-xl border border-dashed border-[#EAE6DF] dark:border-[#2D3835]">
                <Truck className="h-8 w-8 text-[#A3B2AC] mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold text-[#2E221F] dark:text-[#F0F4F2]">No customer pickups yet</p>
                <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-1 max-w-xs mx-auto">
                  When customers reserve discounted food, their pickup QR passes will appear here for verification.
                </p>
              </div>
            ) : (
              orders.slice(0, 3).map(order => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#25302D] hover:border-[#00897B] cursor-pointer transition-all"
                  title="Click to view Pass & verify"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#F5F5F3] dark:bg-[#1C2422] text-[#7A746E] dark:text-[#A3B2AC] shrink-0">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">{order.customerName}</p>
                        <span className="font-mono text-[10px] font-bold text-[#FF6548] bg-[#FDF2EF] dark:bg-[#382420] px-1.5 py-0.5 rounded">
                          {order.qrCode}
                        </span>
                      </div>
                      <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">
                        {order.productName} ({order.quantity} {order.unit}) • {order.pickupTime}
                      </p>
                    </div>
                  </div>
                  <StatusBadge label={order.status === "FULFILLED" ? "Confirmed" : "Awaiting pickup"} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent activity (computed from real data) */}
      <div className="ss-card p-6 bg-white dark:bg-[#1F2825]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#2E221F] dark:text-[#F0F4F2]">Recent activity</h2>
          <span className="text-xs text-[#8A847E] dark:text-[#73827E]">Live telemetry stream</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(() => {
            const realActivities = [
              ...orders.map(o => ({
                title: `${o.quantity} ${o.unit} ${o.productName} reserved`,
                org: `Customer: ${o.customerName}`,
                time: "Order placed",
                desc: `Pass #${o.qrCode} reserved at ₹${o.priceAtOrder}. Status: ${o.status}.`
              })),
              ...inventory.map(i => ({
                title: `Added ${i.name} to stock`,
                org: `${i.available} ${i.unit} available • ₹${i.currentPrice}`,
                time: `Expiry: ${i.expiry}`,
                desc: `Freshness Score: ${Math.round(i.freshnessScore * 100)}%. ${i.storageTip || "Standard refrigeration."}`
              }))
            ].slice(0, 3);

            if (realActivities.length === 0) {
              return (
                <div className="p-8 text-center rounded-xl border border-dashed border-[#EAE6DF] dark:border-[#2D3835] col-span-3">
                  <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">No live activity recorded yet. Add inventory lots to begin live tracking.</p>
                </div>
              );
            }

            return realActivities.map((act, idx) => (
              <div
                key={idx}
                onClick={() => setActiveActivity({ title: act.title, desc: act.desc, time: act.time })}
                className="border-l-2 border-[#FF6548] pl-3 cursor-pointer hover:bg-[#FAF8F5] dark:hover:bg-[#25302D] p-2 rounded-r-xl transition-all"
              >
                <p className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">{act.title}</p>
                <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">{act.org}</p>
                <p className="text-[11px] text-[#A6A099] dark:text-[#64748B] mt-1">{act.time} • Details &rarr;</p>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Activity Details Dialog */}
      {activeActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 ss-reveal">
          <div className="ss-card w-full max-w-sm p-6 bg-white dark:bg-[#1F2825] shadow-2xl border border-[#EAE6DF] dark:border-[#2D3835]">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE6DF] dark:border-[#2D3835]">
              <h3 className="font-bold text-base text-[#2E221F] dark:text-[#F0F4F2]">{activeActivity.title}</h3>
              <button onClick={() => setActiveActivity(null)} className="text-[#8A847E]"><X className="h-4 w-4" /></button>
            </div>
            <div className="py-4 text-xs space-y-2 text-[#554F4A] dark:text-[#CBD5E1]">
              <p>{activeActivity.desc}</p>
              <p className="text-[11px] text-[#8A847E] dark:text-[#64748B]">Logged {activeActivity.time} via FreshRescue Automated Telemetry.</p>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setActiveActivity(null)} className="ss-btn-coral px-4 py-2 text-xs font-semibold cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Order Modal */}
      {selectedOrder && (
        <ReceiptModal
          order={selectedOrder}
          isOpen={true}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

function InventoryPage({ onAction, onOpenSettings }: { onAction: (message: string, kind?: ToastKind) => void; onOpenSettings?: (tab?: SettingsTab) => void }) {
  const [, setLocation] = useLocation();
  const [inventory, setInventory] = useState<InventoryItem[]>(loadInventory);
  const [search, setSearch] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedUrgency, setSelectedUrgency] = useState("All");

  const [activeTab, setActiveTab] = useState<"all" | "expiry" | "flagged">(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "expiry") return "expiry";
    if (params.get("filter") === "urgent") return "flagged";
    return "all";
  });

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState("");
  const [newCategory, setNewCategory] = useState<InventoryItem["category"]>("Vegetables");
  const [newQty, setNewQty] = useState(30);
  const [newUnit, setNewUnit] = useState("kg");
  const [newPrice, setNewPrice] = useState(50);
  const [newDiscountPct, setNewDiscountPct] = useState(0);
  const [newExpiryDate, setNewExpiryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  });
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setInventory(loadInventory());
      setSettings(loadSettings());
    };
    window.addEventListener("ss_inventory_updated", handleUpdate);
    window.addEventListener("ss_settings_updated", handleUpdate);
    return () => {
      window.removeEventListener("ss_inventory_updated", handleUpdate);
      window.removeEventListener("ss_settings_updated", handleUpdate);
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const currentSettings = loadSettings();
      if (!currentSettings.storeId || currentSettings.storeId === "store-default") {
        onAction("No store linked to this account. Please re-login.", "error");
        setLoading(false);
        return;
      }
      const currentStoreId = currentSettings.storeId.trim();
      const currentStoreName = currentSettings.storeName?.trim() || "My Store";
      const currentStoreLocation = currentSettings.storeLocation?.trim() || "";
      const currentStoreArea = currentSettings.storeArea?.trim() || "";
      const effectiveCity = currentSettings.storeCity?.trim() || "";
      const storeInitials = currentStoreName.substring(0, 2).toUpperCase() || "SM";

      // Calculate expiry hours from selected date
      const expiryMs = new Date(newExpiryDate).getTime() - Date.now();
      const expiryHoursLeft = Math.max(0, Math.floor(expiryMs / 3600000));
      const expiryDays = Math.ceil(expiryHoursLeft / 24);
      const expiryLabel = expiryHoursLeft <= 6 ? `${expiryHoursLeft}h left` :
        expiryHoursLeft <= 24 ? "Today" :
          expiryDays === 1 ? "Tomorrow" : `In ${expiryDays} days`;

      const discPct = Math.min(Math.max(0, newDiscountPct), 90);
      const discountedPrice = discPct > 0
        ? Math.round(newPrice * (1 - discPct / 100) * 100) / 100
        : newPrice;

      const freshnessScore = expiryHoursLeft > 48 ? 0.95 :
        expiryHoursLeft > 24 ? 0.75 :
          expiryHoursLeft > 6 ? 0.55 : 0.3;

      const newItem: InventoryItem = {
        id: "inv-" + Date.now(),
        name: newProduct,
        sku: `${storeInitials}-${Math.floor(250 + Math.random() * 50)} • ${newCategory}`,
        category: newCategory,
        available: newQty,
        unit: newUnit,
        originalPrice: newPrice,
        currentPrice: discountedPrice,
        discountPercent: discPct,
        status: expiryHoursLeft <= 24 ? "Expiring soon" : "Available",
        expiry: expiryLabel,
        expiryDate: newExpiryDate,
        expiryHoursLeft,
        pickupDeadline: new Date(newExpiryDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }) + ", 6:00 PM",
        flagged: expiryHoursLeft <= 24,
        storeId: currentStoreId,
        store: currentStoreName,
        storeLocation: currentStoreLocation,
        storeArea: currentStoreArea,
        storeCity: effectiveCity,
        distance: "0.8 km",
        freshnessScore,
        storageTip: "Store in appropriate temperature and humidity controls."
      };

      upsertStore({
        id: currentStoreId,
        name: currentStoreName,
        location: currentStoreLocation,
        area: currentStoreArea,
        city: effectiveCity,
        phone: currentSettings.storePhone,
        managerName: currentSettings.name
      });

      const updated = [newItem, ...inventory];
      saveInventory(updated);
      onAction(`Added ${newProduct} (${discPct > 0 ? discPct + "% off, " : ""}expires ${expiryLabel}) to ${currentStoreName}.`);
      setModalOpen(false);
      setNewProduct("");
      setNewDiscountPct(0);
    } catch (err: any) {
      onAction(err?.message || "Failed to add batch.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFlag = (item: InventoryItem) => {
    const updated = inventory.map(i => {
      if (i.id === item.id) {
        const nextFlag = !i.flagged;
        return {
          ...i,
          flagged: nextFlag,
          status: nextFlag ? "Expiring soon" as const : "Available" as const
        };
      }
      return i;
    });
    saveInventory(updated);
    onAction(item.flagged ? `Removed attention flag from ${item.name}` : `Flagged ${item.name} for surplus attention!`);
  };

  const handleDeleteItem = (id: string) => {
    const updated = inventory.filter(i => i.id !== id);
    saveInventory(updated);
    onAction("Item removed from store inventory.");
  };

  const handleSaveItemEdit = (updatedItem: InventoryItem) => {
    const updated = inventory.map(i => i.id === updatedItem.id ? updatedItem : i);
    saveInventory(updated);
    onAction(`Updated ${updatedItem.name} details.`);
  };

  const handleQuickEmergencyDiscount = (item: InventoryItem) => {
    const discounted = Math.round(item.originalPrice * 0.5);
    const updated = inventory.map(i => {
      if (i.id === item.id) {
        return {
          ...i,
          discountPercent: 50,
          currentPrice: discounted,
          status: "Expiring soon" as const,
          flagged: true
        };
      }
      return i;
    });
    saveInventory(updated);
    onAction(`Applied 50% Emergency Discount to ${item.name}!`);
  };

  const myInventory = inventory.filter(item => isItemForStore(item, settings.storeId, settings.storeName));

  const filtered = myInventory.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === "All" || item.category === selectedCategory;
    const matchUrgent = selectedUrgency === "All" ||
      (selectedUrgency === "Critical" && item.expiryHoursLeft <= 6) ||
      (selectedUrgency === "Tomorrow" && item.expiryHoursLeft > 6 && item.expiryHoursLeft <= 24) ||
      (selectedUrgency === "Stable" && item.expiryHoursLeft > 24);

    if (activeTab === "expiry") {
      return matchSearch && matchCat && matchUrgent && item.expiryHoursLeft <= 24;
    }
    if (activeTab === "flagged" || flaggedOnly) {
      return matchSearch && matchCat && matchUrgent && (item.flagged || item.status === "Expiring soon");
    }
    return matchSearch && matchCat && matchUrgent;
  }).sort((a, b) => {
    if (activeTab === "expiry") return a.expiryHoursLeft - b.expiryHoursLeft;
    return 0;
  });

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">
            {(settings.storeName || "MY SUPERMARKET").toUpperCase()}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">Inventory</h1>
          <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1">Search stock, flag items for attention, and manage dynamic expiry countdowns.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="ss-btn-coral px-4 py-2.5 text-sm flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center shadow-sm cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Add inventory
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#EAE6DF] dark:border-[#2D3835] pb-2">
        <button
          onClick={() => { setActiveTab("all"); setFlaggedOnly(false); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "all"
            ? "bg-[#2D2320] dark:bg-white text-white dark:text-[#2D2320] shadow-sm"
            : "text-[#7A746E] dark:text-[#A3B2AC] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D]"
            }`}
        >
          All Inventory ({myInventory.length})
        </button>
        <button
          onClick={() => { setActiveTab("expiry"); setFlaggedOnly(false); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "expiry"
            ? "bg-[#FF6548] text-white shadow-sm"
            : "text-[#7A746E] dark:text-[#A3B2AC] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D]"
            }`}
        >
          <CalendarClock className="h-3.5 w-3.5" /> Expiry Watchlist ({myInventory.filter(i => i.expiryHoursLeft <= 24).length})
        </button>
        <button
          onClick={() => { setActiveTab("flagged"); setFlaggedOnly(true); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "flagged"
            ? "bg-[#00897B] text-white shadow-sm"
            : "text-[#7A746E] dark:text-[#A3B2AC] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D]"
            }`}
        >
          <Flag className="h-3.5 w-3.5" /> Flagged for Attention ({myInventory.filter(i => i.flagged || i.status === "Expiring soon").length})
        </button>
      </div>

      {/* Expiry Alert Banner if on expiry tab */}
      {activeTab === "expiry" && (
        <div className="p-4 rounded-2xl bg-[#FEECE8] dark:bg-[#3C221D] border border-[#FCD3C9] dark:border-[#5E3128] flex items-center justify-between ss-reveal">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-[#E0533C] dark:text-[#FFA18F] shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#E0533C] dark:text-[#FFA18F]">Urgent Expiry Watchlist Active</p>
              <p className="text-[11px] text-[#2E221F] dark:text-[#F0F4F2] mt-0.5">
                Items listed below expire within 24 hours. Apply emergency discounts or list on Surplus to prevent landfill waste.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLocation("/supermarket/surplus")}
            className="ss-btn-coral px-3 py-1.5 text-xs font-semibold shrink-0 cursor-pointer"
          >
            Review Surplus Matches
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="ss-card p-4 bg-white dark:bg-[#1F2825]">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#8A847E] pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search inventory by product name or SKU"
              className="ss-input text-sm"
              style={{ paddingLeft: "2.6rem" }}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${filterOpen || selectedCategory !== "All" || selectedUrgency !== "All"
                ? "bg-[#00897B] text-white border-[#00897B]"
                : "bg-white dark:bg-[#25302D] text-[#554F4A] dark:text-[#CBD5E1] border-[#EAE6DF] dark:border-[#2D3835] hover:bg-[#F8F6F1] dark:hover:bg-[#2D3835]"
                }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {selectedCategory !== "All" || selectedUrgency !== "All" ? `Filtered (${selectedCategory})` : "Filter"}
            </button>
            {(selectedCategory !== "All" || selectedUrgency !== "All") && (
              <button
                onClick={() => { setSelectedCategory("All"); setSelectedUrgency("All"); }}
                className="text-xs text-[#FF6548] font-semibold hover:underline px-2 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Expandable Filter Drawer */}
        {filterOpen && (
          <div className="mt-4 pt-4 border-t border-[#EAE6DF] dark:border-[#2D3835] grid gap-4 sm:grid-cols-2 ss-reveal">
            <div>
              <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5] mb-2">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {["All", "Dairy", "Vegetables", "Fruit", "Bakery", "Staples"].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${selectedCategory === cat
                      ? "bg-[#2D2320] dark:bg-white text-white dark:text-[#2D2320] border-transparent"
                      : "border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#25302D] text-[#554F4A] dark:text-[#CBD5E1]"
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5] mb-2">Expiry Urgency</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "All", label: "All Timelines" },
                  { id: "Critical", label: "Critical (< 6h)" },
                  { id: "Tomorrow", label: "Tomorrow" },
                  { id: "Stable", label: "Stable (> 24h)" },
                ].map(urg => (
                  <button
                    key={urg.id}
                    onClick={() => setSelectedUrgency(urg.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${selectedUrgency === urg.id
                      ? "bg-[#FF6548] text-white border-transparent"
                      : "border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#25302D] text-[#554F4A] dark:text-[#CBD5E1]"
                      }`}
                  >
                    {urg.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Inventory Data Table */}
        <div className="ss-table-wrap mt-5">
          <table className="ss-table w-full text-sm">
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>AVAILABLE</th>
                <th>PRICE & DISCOUNT</th>
                <th>STATUS</th>
                <th>EXPIRY TIMELINE</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isExpired = item.status === "Discard recommended" || item.status === "Expired" || isPrintedDateInPast(item.expiryDate) || (typeof item.freshnessScore === "number" && item.freshnessScore < TIER_CONFIG.expiredMax);
                const isDiscarded = item.status === "Discarded";
                const displayStatus = isDiscarded ? "Discarded" : isExpired ? "Discard recommended" : item.status;

                return (
                <tr key={item.id} className="hover:bg-[#FAF8F5] dark:hover:bg-[#25302D] transition-colors">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#F5F5F3] dark:bg-[#1C2422] text-[#7A746E] dark:text-[#A3B2AC] shrink-0">
                        <Boxes className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-[#2E221F] dark:text-[#F0F4F2]">{item.name}</p>
                        <p className="text-[11px] text-[#8A847E] dark:text-[#73827E] mt-0.5">{item.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-semibold text-[#2E221F] dark:text-[#F0F4F2]">
                    {item.available} {item.unit}
                    {isDiscarded && item.discardedQuantity ? (
                      <span className="block text-[10px] text-gray-500">({item.discardedQuantity} discarded)</span>
                    ) : null}
                  </td>
                  <td>
                    <div className="text-xs">
                      <span className="font-bold text-[#FF6548]">₹{item.currentPrice}</span>
                      {item.discountPercent > 0 && (
                        <span className="ml-1 text-[11px] text-[#8A847E] line-through">₹{item.originalPrice}</span>
                      )}
                      {item.discountPercent > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#FDF2EF] dark:bg-[#382420] text-[#FF6548] font-bold text-[10px]">
                          -{item.discountPercent}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <StatusBadge label={displayStatus} />
                  </td>
                  <td className="text-xs text-[#554F4A] dark:text-[#CBD5E1]">
                    <div className="flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5 text-[#FF6548]" />
                      <span>{item.expiry}</span>
                      {item.expiryHoursLeft <= 6 && (
                        <span className="px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-bold text-[10px]">
                          ⏳ {item.expiryHoursLeft}h left
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {isExpired && !isDiscarded && (
                        <button
                          type="button"
                          title="Confirm discarded - records discarded quantity without deleting"
                          onClick={() => {
                            confirmDiscardInventoryItem(item.id, item.available);
                            onAction(`Recorded ${item.available} ${item.unit} of ${item.name} as discarded.`, "warning");
                          }}
                          className="px-2 py-1 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 text-[10px] font-bold hover:bg-red-600 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Confirm discarded</span>
                        </button>
                      )}
                      {!isExpired && item.expiryHoursLeft <= 6 && item.discountPercent < 50 && (
                        <button
                          title="Apply 50% Emergency Discount"
                          onClick={() => handleQuickEmergencyDiscount(item)}
                          className="px-2 py-1 rounded bg-[#FDF2EF] dark:bg-[#382420] text-[#FF6548] text-[10px] font-bold hover:bg-[#FF6548] hover:text-white transition-all cursor-pointer"
                        >
                          -50%
                        </button>
                      )}
                      <button
                        title="AI CNN Freshness Scan"
                        onClick={() => setLocation(`/supermarket/detection?batchId=${item.id}`)}
                        className="p-1.5 rounded-lg text-[#00897B] dark:text-[#2DD4BF] hover:bg-[#E8F8F4] dark:hover:bg-[#18332B] cursor-pointer"
                      >
                        <ScanLine className="h-4 w-4" />
                      </button>
                      <button
                        title="Edit Batch"
                        onClick={() => setEditingItem(item)}
                        className="p-1.5 rounded-lg text-[#8A847E] hover:text-[#2E221F] dark:hover:text-[#F0F4F2] hover:bg-[#F0EEEA] dark:hover:bg-[#2A3532] cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        title={item.flagged ? "Unflag Item" : "Flag as Surplus Attention"}
                        onClick={() => handleToggleFlag(item)}
                        className={`p-1.5 rounded-lg ${item.flagged ? "text-[#FF6548] bg-[#FDF2EF] dark:bg-[#382420]" : "text-[#8A847E]"} hover:bg-[#F0EEEA] dark:hover:bg-[#2A3532] cursor-pointer`}
                      >
                        <Flag className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );})}
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5F5F3] dark:bg-[#25302D] text-[#8A847E] dark:text-[#A3B2AC] mx-auto">
                        <Boxes className="h-6 w-6" />
                      </div>
                      <h3 className="font-bold text-base text-[#2E221F] dark:text-[#F0F4F2]">Your Store Inventory is Empty</h3>
                      <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">
                        You have no food batches listed yet. Click "+ Add Inventory" to begin adding fresh produce and surplus items.
                      </p>
                      <button
                        onClick={() => setModalOpen(true)}
                        className="ss-btn-coral px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add First Item
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#7A746E] dark:text-[#A3B2AC]">
                    No inventory lots match your current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Batch Modal */}
      {editingItem && (
        <EditBatchModal
          item={editingItem}
          isOpen={true}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveItemEdit}
          onDelete={handleDeleteItem}
        />
      )}

      {/* Add Produce Lot Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 ss-reveal" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="ss-card w-full max-w-lg p-6 bg-white dark:bg-[#1F2825] shadow-2xl border border-[#EAE6DF] dark:border-[#2D3835] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE6DF] dark:border-[#2D3835]">
              <div>
                <h3 className="font-bold text-lg text-[#2E221F] dark:text-[#F0F4F2]">Add New Inventory Lot</h3>
                <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">Fill in product details, expiry date and discount to list on customer feed</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg text-[#8A847E] hover:bg-[#F5F5F3] dark:hover:bg-[#25302D] cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Product Name *</label>
                <input value={newProduct} onChange={e => setNewProduct(e.target.value)} required placeholder="e.g. Fresh Tomatoes, Whole Wheat Bread" className="ss-input mt-1" />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Category</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value as any)} className="ss-input mt-1">
                    <option>Dairy</option>
                    <option>Vegetables</option>
                    <option>Fruit</option>
                    <option>Bakery</option>
                    <option>Staples</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Unit</label>
                  <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="ss-input mt-1">
                    <option value="kg">kg</option>
                    <option value="packets">packets</option>
                    <option value="packs">packs</option>
                    <option value="liters">liters</option>
                    <option value="units">units</option>
                    <option value="boxes">boxes</option>
                  </select>
                </div>
              </div>

              {/* Qty & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Quantity *</label>
                  <input type="number" min="1" value={newQty} onChange={e => setNewQty(Number(e.target.value))} required className="ss-input mt-1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Original Price (₹/{newUnit}) *</label>
                  <input type="number" step="0.5" min="1" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} required className="ss-input mt-1" />
                </div>
              </div>

              {/* Expiry Date & Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Expiry Date *</label>
                  <input
                    type="date"
                    value={newExpiryDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={e => setNewExpiryDate(e.target.value)}
                    required
                    className="ss-input mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Surplus Discount %</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min="0" max="90" step="5"
                      value={newDiscountPct}
                      onChange={e => setNewDiscountPct(Number(e.target.value))}
                      className="ss-input pr-8"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8A847E]">%</span>
                  </div>
                  {newDiscountPct > 0 && newPrice > 0 && (
                    <p className="mt-1 text-[10px] text-[#00897B] font-semibold">
                      Customer pays ₹{Math.round(newPrice * (1 - newDiscountPct / 100) * 100) / 100}/{newUnit}
                    </p>
                  )}
                </div>
              </div>

              {/* Store Location & City (Permanent, set at registration) */}
              <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#192220] border border-[#EAE6DF] dark:border-[#2D3835]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#00897B] dark:text-[#2DD4BF]" />
                    <span className="text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">
                      Publishing Store: <span className="font-bold text-[#00897B] dark:text-[#2DD4BF]">{settings.storeName || "My Store"} ({settings.storeCity || "Solapur"})</span>
                    </span>
                  </div>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setModalOpen(false);
                        onOpenSettings("location");
                      }}
                      className="text-[11px] font-semibold text-[#00897B] dark:text-[#2DD4BF] hover:underline cursor-pointer"
                    >
                      Edit in Settings
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC] mt-1">
                  Location is permanently set. Customers in {settings.storeCity || "your city"} will see this surplus batch.
                </p>
              </div>

              {/* Expiry urgency indicator */}
              {newExpiryDate && (() => {
                const hrs = Math.floor((new Date(newExpiryDate).getTime() - Date.now()) / 3600000);
                const color = hrs <= 24 ? "bg-red-50 border-red-200 text-red-700" : hrs <= 48 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-green-50 border-green-200 text-green-700";
                const label = hrs <= 6 ? "⚠️ Critical — expires in under 6 hours" : hrs <= 24 ? "⏳ Expiring today — consider adding discount" : hrs <= 48 ? "📅 Expiring tomorrow" : `✅ ${Math.ceil(hrs / 24)} days remaining`;
                return <div className={`p-2.5 rounded-lg border text-xs font-semibold ${color}`}>{label}</div>;
              })()}

              <div className="pt-2 flex gap-2">
                <button type="submit" disabled={loading} className="ss-btn-coral flex-1 py-2.5 text-xs font-semibold cursor-pointer">
                  {loading ? "Adding..." : "✓ Add to Inventory"}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="ss-btn-soft px-4 py-2.5 text-xs cursor-pointer">
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
  const [, setLocation] = useLocation();
  const [inventory, setInventory] = useState<InventoryItem[]>(loadInventory);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    freshnessScore: number;
    decayTier: "TIER_1" | "TIER_2" | "TIER_3";
    decayStatus: string;
    suggestedDiscount: number;
    suggestedHours: number;
    notes: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  useEffect(() => {
    const handleUpdate = () => {
      setInventory(loadInventory());
      setSettings(loadSettings());
    };
    window.addEventListener("ss_inventory_updated", handleUpdate);
    window.addEventListener("ss_settings_updated", handleUpdate);
    return () => {
      window.removeEventListener("ss_inventory_updated", handleUpdate);
      window.removeEventListener("ss_settings_updated", handleUpdate);
    };
  }, []);

  const myInventory = inventory.filter(i => isItemForStore(i, settings.storeId, settings.storeName));

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const bId = urlParams.get("batchId");
    if (bId && myInventory.some(i => i.id === bId)) {
      setSelectedItemId(bId);
    } else if (myInventory.length > 0 && !selectedItemId) {
      setSelectedItemId(myInventory[0].id);
    }
  }, [myInventory]);

  const targetItem = myInventory.find(i => i.id === selectedItemId) || myInventory[0];

  const presets = [
    {
      label: "🍅 Fresh Tomatoes",
      desc: "Grade A • 94% Freshness",
      score: 0.94,
      tier: "TIER_1" as const,
      status: "Crisp & Firm (Prime)",
      discount: 15,
      hours: 48,
      notes: "Optimal cell wall integrity, high moisture retention. Shelf life stable for standard retail."
    },
    {
      label: "🍎 Blemished Apples",
      desc: "Slight Bruising • 68% Freshness",
      score: 0.68,
      tier: "TIER_2" as const,
      status: "Early Softening (Fair)",
      discount: 35,
      hours: 18,
      notes: "Minor surface oxidation detected. Perfect for stewing, juicing or discounted immediate consumption."
    },
    {
      label: "🥬 Expiring Spinach",
      desc: "Wilting Edges • 42% Freshness",
      score: 0.42,
      tier: "TIER_3" as const,
      status: "Advanced Wilting (Urgent)",
      discount: 60,
      hours: 6,
      notes: "Significant moisture loss in leaf margins. Recommend 60% emergency surplus discount for immediate customer rescue."
    }
  ];

  const handleSelectPreset = (p: typeof presets[0]) => {
    setSelectedFile(null);
    setPreviewUrl(`https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80`);
    setAnalysisResult({
      freshnessScore: p.score,
      decayTier: p.tier,
      decayStatus: p.status,
      suggestedDiscount: p.discount,
      suggestedHours: p.hours,
      notes: p.notes
    });
    onAction(`Loaded ${p.label} sample scan profile.`, "success");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSelectedFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setAnalysisResult(null);
    }
  };

  const handleRunScan = async () => {
    setScanning(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      // MobileNetV2 produce inference simulation
      const baseScore = targetItem ? targetItem.freshnessScore : 0.76;
      const score = Math.min(0.98, Math.max(0.35, baseScore + (Math.random() * 0.1 - 0.05)));
      const discount = score >= 0.85 ? 15 : score >= 0.6 ? 35 : 55;
      const tier = score >= 0.85 ? "TIER_1" : score >= 0.6 ? "TIER_2" : "TIER_3";
      const status = score >= 0.85 ? "Crisp & Firm (Prime)" : score >= 0.6 ? "Moderate Ripeness (Fair)" : "Expiring Soon (Urgent)";

      setAnalysisResult({
        freshnessScore: score,
        decayTier: tier,
        decayStatus: status,
        suggestedDiscount: discount,
        suggestedHours: Math.round(score * 36),
        notes: `MobileNetV2 neural vision analyzed surface texture and hue uniformity. Confidence: 94.8%.`
      });
      onAction(`AI Freshness Analysis complete: ${Math.round(score * 100)}% (${status})`, "success");
    } catch (err: any) {
      onAction("CNN analysis failed. Please try again.", "error");
    } finally {
      setScanning(false);
    }
  };

  const handleConfirmAndList = () => {
    if (!analysisResult || !targetItem) return;
    const discountedPrice = Math.round(targetItem.originalPrice * (1 - analysisResult.suggestedDiscount / 100));
    const updated = inventory.map(item => {
      if (item.id === targetItem.id) {
        return {
          ...item,
          freshnessScore: analysisResult.freshnessScore,
          discountPercent: analysisResult.suggestedDiscount,
          currentPrice: discountedPrice,
          status: "Expiring soon" as const,
          expiry: `In ${analysisResult.suggestedHours}h`,
          expiryHoursLeft: analysisResult.suggestedHours,
          flagged: true
        };
      }
      return item;
    });

    saveInventory(updated);
    onAction(`Applied ${analysisResult.suggestedDiscount}% discount to ${targetItem.name} and listed on Surplus!`, "success");
  };

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">MOBILENETV2 NEURAL VISION</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">Produce Freshness Check</h1>
          <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1">Upload a produce photo or test preset samples to evaluate surface decay and set dynamic rescue pricing.</p>
        </div>
        <button
          onClick={() => setLocation("/supermarket/surplus")}
          className="ss-btn-soft px-4 py-2 text-xs font-semibold shrink-0 cursor-pointer"
        >
          View Surplus Feed &rarr;
        </button>
      </div>

      {/* Preset Quick Scan Cards */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase text-[#7A746E] dark:text-[#A3B2AC]">Try Preset Test Lots</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPreset(p)}
              className="text-left p-3.5 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] hover:border-[#FF6548] dark:hover:border-[#FF6548] transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#2E221F] dark:text-[#F0F4F2] group-hover:text-[#FF6548] transition-colors">{p.label}</span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#FAF5EE] dark:bg-[#2A2320] text-[#FF6548]">
                  -{p.discount}%
                </span>
              </div>
              <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-1">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Left: Upload and Target Selection */}
        <div className="ss-card p-6 bg-white dark:bg-[#1F2825] space-y-4">
          <h2 className="text-base font-bold text-[#2E221F] dark:text-[#F0F4F2]">Product Image Source</h2>

          {inventory.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[#78726B] dark:text-[#A3B2AC] mb-1.5">Target Inventory Lot to Update</label>
              <select
                value={selectedItemId}
                onChange={e => setSelectedItemId(e.target.value)}
                className="ss-input text-xs"
              >
                {inventory.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.available} {b.unit}) — Current: ₹{b.currentPrice} ({b.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-[#DCD6CC] dark:border-[#3E4947] rounded-2xl p-8 text-center hover:border-[#FF6548] transition-all bg-[#FAF9F6] dark:bg-[#1A2220] flex flex-col items-center justify-center min-h-[220px]"
          >
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            {previewUrl ? (
              <div className="space-y-3">
                <img src={previewUrl} alt="Preview" className="max-h-44 mx-auto rounded-xl object-contain shadow-md" />
                <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">Click to replace photo or select another preset</p>
              </div>
            ) : (
              <div className="space-y-3 flex flex-col items-center">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#EDEAE4] dark:bg-[#25302D] text-[#6C655F] dark:text-[#A3B2AC]">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-bold text-[#2E221F] dark:text-[#F0F4F2]">Upload Produce Lot Photo</p>
                  <p className="text-xs text-[#8A847E] dark:text-[#64748B] mt-0.5">JPEG, PNG, or camera capture</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="ss-btn-dark px-5 py-2.5 text-xs font-semibold mt-2 cursor-pointer"
                >
                  Browse local file
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRunScan}
              disabled={scanning}
              className="ss-btn-coral flex-1 py-3 text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {scanning ? "MobileNetV2 Analyzing..." : "Run AI Freshness Evaluation"}
            </button>
            {previewUrl && (
              <button
                onClick={() => { setSelectedFile(null); setPreviewUrl(null); setAnalysisResult(null); }}
                className="ss-btn-soft px-3.5 py-3 text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right: AI Output & Dynamic Tiering */}
        <div className="ss-card p-6 bg-white dark:bg-[#1F2825]">
          <h2 className="text-base font-bold text-[#2E221F] dark:text-[#F0F4F2] mb-4">Inspection Telemetry</h2>

          {analysisResult ? (
            <div className="space-y-5 ss-reveal">
              <div className="rounded-2xl border border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#1A2220] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">MobileNetV2 Classifier</span>
                    <h3 className="text-2xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2] mt-0.5">{targetItem?.name || "Produce Lot"}</h3>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${analysisResult.decayTier === "TIER_1"
                    ? "bg-[#E6F8F3] text-[#00897B]"
                    : analysisResult.decayTier === "TIER_2"
                      ? "bg-[#FEF3C7] text-[#D97706]"
                      : "bg-[#FEECE8] text-[#FF6548]"
                    }`}>
                    {analysisResult.decayTier}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-[#EAE6DF] dark:border-[#2D3835] pt-4">
                  <div>
                    <span className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">Evaluated Freshness</span>
                    <p className="text-3xl font-extrabold text-[#00897B] dark:text-[#2DD4BF] mt-1">
                      {Math.round(analysisResult.freshnessScore * 100)}%
                    </p>
                    <span className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC] mt-0.5 block">{analysisResult.decayStatus}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">Recommended Discount</span>
                    <p className="text-3xl font-extrabold text-[#FF6548] mt-1">
                      -{analysisResult.suggestedDiscount}%
                    </p>
                    {targetItem && (
                      <span className="text-[11px] font-bold text-[#FF6548] mt-0.5 block">
                        ₹{Math.round(targetItem.originalPrice * (1 - analysisResult.suggestedDiscount / 100))} / {targetItem.unit}
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-[#EAE6DF] dark:border-[#2D3835] pt-3 text-xs space-y-1.5 text-[#554F4A] dark:text-[#CBD5E1]">
                  <p>• <strong>Shelf Life Remaining:</strong> ~{analysisResult.suggestedHours} hours before quality drops.</p>
                  <p>• <strong>Diagnostic Notes:</strong> {analysisResult.notes}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirmAndList}
                  className="ss-btn-coral flex-1 py-3 text-xs font-semibold cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Confirm & Apply to Surplus
                </button>
                <button
                  onClick={() => { setSelectedFile(null); setPreviewUrl(null); setAnalysisResult(null); }}
                  className="ss-btn-soft px-4 py-3 text-xs font-semibold cursor-pointer"
                >
                  Scan Another
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF9F6] dark:bg-[#1A2220] p-12 text-center flex flex-col items-center justify-center min-h-[220px]">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#E6F8F3] dark:bg-[#1A332C] text-[#00897B] dark:text-[#2DD4BF] mb-3">
                <ScanLine className="h-6 w-6" />
              </div>
              <p className="text-base font-bold text-[#2E221F] dark:text-[#F0F4F2]">Awaiting Inspection</p>
              <p className="text-xs text-[#8A847E] dark:text-[#64748B] mt-1 max-w-xs">
                Upload a photo or click any sample preset lot above to run the MobileNetV2 evaluation.
              </p>
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
function SurplusPage({ onAction }: { onAction: (message: string, kind?: ToastKind) => void }) {
  const [, setLocation] = useLocation();
  const [inventory, setInventory] = useState<InventoryItem[]>(loadInventory);
  const [orders, setOrders] = useState<StoreOrder[]>(loadOrders);
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [filterMode, setFilterMode] = useState<"all" | "available" | "reserved">("all");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setInventory(loadInventory());
      setOrders(loadOrders());
      setSettings(loadSettings());
    };
    window.addEventListener("ss_inventory_updated", handleUpdate);
    window.addEventListener("ss_orders_updated", handleUpdate);
    window.addEventListener("ss_settings_updated", handleUpdate);
    return () => {
      window.removeEventListener("ss_inventory_updated", handleUpdate);
      window.removeEventListener("ss_orders_updated", handleUpdate);
      window.removeEventListener("ss_settings_updated", handleUpdate);
    };
  }, []);

  // Filter items that qualify as surplus for this store
  const myInventory = inventory.filter(i => isItemForStore(i, settings.storeId, settings.storeName));
  const surplusItems = myInventory.filter(i => i.discountPercent > 0 || i.flagged || i.status === "Expiring soon" || i.status === "Reserved");

  const currentStoreName = (settings.storeName || "").trim().toLowerCase();
  const currentStoreId = (settings.storeId || "").trim();
  const myOrders = deduplicateOrders(orders.filter(o =>
    (currentStoreId && o.storeId && o.storeId === currentStoreId) ||
    (currentStoreName && o.storeName && o.storeName.trim().toLowerCase() === currentStoreName)
  ));
  const totalAvailable = surplusItems.reduce((acc, curr) => acc + curr.available, 0);
  const totalReserved = myOrders.filter(o => o.status === "RESERVED").reduce((acc, curr) => acc + curr.quantity, 0);
  const totalRemaining = Math.max(0, totalAvailable - totalReserved);

  const displayedItems = surplusItems.filter(item => {
    if (filterMode === "available") return item.available > 0;
    if (filterMode === "reserved") return myOrders.some(o => o.productName.toLowerCase() === item.name.toLowerCase() && o.status === "RESERVED");
    return true;
  });

  const handleSaveEdit = (updated: InventoryItem) => {
    const next = inventory.map(i => i.id === updated.id ? updated : i);
    saveInventory(next);
    onAction(`Updated surplus details for ${updated.name}.`);
  };

  const handleDelete = (id: string) => {
    const next = inventory.filter(i => i.id !== id);
    saveInventory(next);
    onAction("Surplus lot removed.");
  };

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">
            {(settings.storeName || "My Supermarket").toUpperCase()}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">Available Food Surplus</h1>
          <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1">Keep available, reserved, and remaining quantities synchronized as customer vouchers are claimed.</p>
        </div>
        <button
          onClick={() => setLocation("/supermarket/inventory")}
          className="ss-btn-coral px-4 py-2.5 text-sm flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center shadow-sm cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Add or flag lot
        </button>
      </div>

      {/* Interactive Metric Cards acting as filters */}
      <div className="grid gap-4 md:grid-cols-3">
        <button
          onClick={() => setFilterMode("available")}
          className={`ss-card p-5 text-left transition-all cursor-pointer ${filterMode === "available" ? "ring-2 ring-[#00897B]" : ""}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670] dark:text-[#A3B2AC]">Total Available Surplus</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2]">{totalAvailable} kg</p>
              <p className="mt-2 text-xs text-[#00897B] dark:text-[#2DD4BF] font-semibold">Across {surplusItems.length} active lots</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E6F8F3] dark:bg-[#1A332C] text-[#00897B] dark:text-[#2DD4BF] shrink-0">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterMode("reserved")}
          className={`ss-card p-5 text-left transition-all cursor-pointer ${filterMode === "reserved" ? "ring-2 ring-[#FF6548]" : ""}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670] dark:text-[#A3B2AC]">Customer Reserved</p>
              <p className="mt-3 text-3xl font-extrabold text-[#FF6548]">{totalReserved} kg</p>
              <p className="mt-2 text-xs text-[#8A847E] dark:text-[#64748B]">{orders.filter(o => o.status === "RESERVED").length} active customer passes</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#FEECE8] dark:bg-[#382420] text-[#FF6548] shrink-0">
              <ClipboardCheck className="h-4 w-4" />
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterMode("all")}
          className={`ss-card p-5 text-left transition-all cursor-pointer ${filterMode === "all" ? "ring-2 ring-[#2D2320] dark:ring-white" : ""}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670] dark:text-[#A3B2AC]">Remaining Unclaimed</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2]">{totalRemaining} kg</p>
              <p className="mt-2 text-xs text-[#8A847E] dark:text-[#64748B]">Ready for immediate pickup</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#F0F2F1] dark:bg-[#25302D] text-[#55605D] dark:text-[#CBD5E1] shrink-0">
              <Users className="h-4 w-4" />
            </div>
          </div>
        </button>
      </div>

      {/* Grid of Surplus Cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {displayedItems.length === 0 ? (
          <div className="col-span-full py-16 text-center ss-card p-8 bg-white dark:bg-[#1F2825]">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5F5F3] dark:bg-[#25302D] text-[#8A847E] dark:text-[#A3B2AC] mx-auto mb-3">
              <Boxes className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-[#2E221F] dark:text-[#F0F4F2]">No Surplus Food Lots Listed</h3>
            <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-1 max-w-sm mx-auto">
              You have no items flagged as surplus or with discount applied. Add inventory or flag expiring produce to display them here.
            </p>
            <button
              onClick={() => setLocation("/supermarket/inventory")}
              className="ss-btn-coral mt-4 px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Manage Inventory Lots
            </button>
          </div>
        ) : (
          displayedItems.map(item => {
            const reservedQty = orders
              .filter(o => o.productName.toLowerCase() === item.name.toLowerCase() && o.status === "RESERVED")
              .reduce((sum, o) => sum + o.quantity, 0);
            const remainingQty = Math.max(0, item.available - reservedQty);

            return (
              <div key={item.id} className="ss-card p-6 bg-white dark:bg-[#1F2825] space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-[#2E221F] dark:text-[#F0F4F2]">{item.name}</h3>
                    <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">Pickup deadline: {item.pickupDeadline}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#FF6548]">₹{item.currentPrice}</span>
                    {item.discountPercent > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-[#FDF2EF] dark:bg-[#382420] text-[#FF6548] font-bold text-[10px]">
                        -{item.discountPercent}%
                      </span>
                    )}
                    <StatusBadge label={item.status} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="qty-segment-available p-3 rounded-xl bg-[#FAF9F6] dark:bg-[#25302D]">
                    <p className="text-xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2]">{item.available}</p>
                    <p className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC] mt-1">Available</p>
                  </div>

                  <div className="qty-segment-reserved p-3 rounded-xl bg-[#FFF6F3] dark:bg-[#2A1D1A]">
                    <p className="text-xl font-extrabold text-[#FF6548]">{reservedQty}</p>
                    <p className="text-[11px] text-[#FF6548] font-semibold mt-1">Reserved</p>
                  </div>

                  <div className="qty-segment-remaining p-3 rounded-xl bg-[#EBF8F4] dark:bg-[#192A25]">
                    <p className="text-xl font-extrabold text-[#00897B] dark:text-[#2DD4BF]">{remainingQty}</p>
                    <p className="text-[11px] text-[#00897B] dark:text-[#2DD4BF] font-semibold mt-1">Remaining</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#EAE6DF] dark:border-[#2D3835]">
                  <button
                    onClick={() => setLocation(`/supermarket/detection?batchId=${item.id}`)}
                    className="text-xs text-[#00897B] dark:text-[#2DD4BF] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ScanLine className="h-3.5 w-3.5" /> AI Freshness Scan
                  </button>
                  <button
                    onClick={() => setEditingItem(item)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#EAE6DF] dark:border-[#2D3835] text-xs font-semibold text-[#554F4A] dark:text-[#CBD5E1] hover:bg-[#F8F6F1] dark:hover:bg-[#2A3532] cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Edit batch
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editingItem && (
        <EditBatchModal
          item={editingItem}
          isOpen={true}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: COUNTER VERIFICATION
// -------------------------------------------------------------
function VerificationPage({ onAction }: { onAction: (message: string, kind?: ToastKind) => void }) {
  const [activeTab, setActiveTab] = useState<"scanner" | "requests" | "pickups">(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (view === "requests") return "requests";
    if (view === "pickups") return "pickups";
    return "scanner";
  });

  const [code, setCode] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [verifiedOrder, setVerifiedOrder] = useState<StoreOrder | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<StoreOrder[]>(loadOrders);
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  useEffect(() => {
    const handleUpdate = () => {
      setOrders(loadOrders());
      setSettings(loadSettings());
    };
    window.addEventListener("ss_orders_updated", handleUpdate);
    window.addEventListener("ss_settings_updated", handleUpdate);
    return () => {
      window.removeEventListener("ss_orders_updated", handleUpdate);
      window.removeEventListener("ss_settings_updated", handleUpdate);
    };
  }, []);

  const currentStoreName = (settings.storeName || "").trim().toLowerCase();
  const currentStoreId = (settings.storeId || "").trim();
  const myOrders = deduplicateOrders(orders.filter(o =>
    (currentStoreId && o.storeId && o.storeId === currentStoreId) ||
    (currentStoreName && o.storeName && o.storeName.trim().toLowerCase() === currentStoreName)
  ));
  const pendingOrders = myOrders.filter(o => o.status === "RESERVED");
  const fulfilledOrders = myOrders.filter(o => o.status === "FULFILLED");

  const handleVerify = (passCode: string) => {
    const cleanCode = passCode.trim().toUpperCase();
    if (!cleanCode) {
      onAction("Enter a valid 6-character pickup pass code.", "warning");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const fulfilled = fulfillPickupOrder(cleanCode);
      if (fulfilled) {
        setVerifiedOrder(fulfilled);
        setCode("");
        setCameraActive(false);
        onAction(`Handoff verified! Inventory automatically deducted for ${fulfilled.productName}.`, "success");
      } else {
        onAction("Invalid or already fulfilled pass code. Please verify code.", "error");
      }
      setLoading(false);
    }, 450);
  };

  const handleSimulateCameraScan = () => {
    setCameraActive(true);
    if (pendingOrders.length > 0) {
      const target = pendingOrders[0];
      setTimeout(() => {
        setCode(target.qrCode);
        handleVerify(target.qrCode);
      }, 1200);
    } else {
      setTimeout(() => {
        setCameraActive(false);
        onAction("No active customer in camera view. Waiting for reservation...", "warning");
      }, 1500);
    }
  };

  return (
    <div className="ss-reveal max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">CHECKOUT COUNTER</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">Counter QR Verification</h1>
        <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1">Scan customer QR codes, process queue requests, and inspect real-time pickup handoffs.</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-[#EAE6DF] dark:border-[#2D3835] pb-2">
        <button
          onClick={() => setActiveTab("scanner")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "scanner"
            ? "bg-[#2D2320] dark:bg-white text-white dark:text-[#2D2320] shadow-sm"
            : "text-[#7A746E] dark:text-[#A3B2AC] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D]"
            }`}
        >
          <QrCode className="h-3.5 w-3.5" /> Counter Scanner
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "requests"
            ? "bg-[#FF6548] text-white shadow-sm"
            : "text-[#7A746E] dark:text-[#A3B2AC] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D]"
            }`}
        >
          <Users className="h-3.5 w-3.5" /> Customer Requests ({pendingOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("pickups")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "pickups"
            ? "bg-[#00897B] text-white shadow-sm"
            : "text-[#7A746E] dark:text-[#A3B2AC] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D]"
            }`}
        >
          <PackageCheck className="h-3.5 w-3.5" /> Completed Pickups ({fulfilledOrders.length})
        </button>
      </div>

      {/* Tab 1: Scanner View */}
      {activeTab === "scanner" && (
        <div className="ss-card overflow-hidden bg-white dark:bg-[#1F2825] border border-[#EAE6DF] dark:border-[#2D3835]">
          <div className="bg-[#343D3B] p-6 text-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <QrCode className="h-6 w-6 text-[#FF6548]" />
                <h2 className="text-lg font-bold">{verifiedOrder ? "Order Fulfilled & Stock Deducted" : "Counter QR Barcode Scanner"}</h2>
              </div>
              <p className="mt-1 text-xs text-[#B0B8B5]">Instant stock deduction across FreshMart MongoDB inventory</p>
            </div>
            {!verifiedOrder && (
              <button
                onClick={handleSimulateCameraScan}
                className="ss-btn-coral px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5" /> Simulate Camera Scan
              </button>
            )}
          </div>

          {cameraActive && !verifiedOrder && (
            <div className="relative bg-black p-8 text-center text-white flex flex-col items-center justify-center min-h-[180px]">
              <div className="relative w-48 h-48 border-2 border-emerald-400 rounded-2xl flex items-center justify-center overflow-hidden">
                <div className="absolute inset-x-0 h-1 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" style={{ top: "45%" }} />
                <QrCode className="h-28 w-28 text-white/30" />
              </div>
              <p className="mt-3 text-xs text-emerald-400 font-mono tracking-wider animate-pulse">Scanning QR optical viewfinder...</p>
            </div>
          )}

          {verifiedOrder ? (
            <div className="p-8 text-center ss-reveal space-y-4">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#00897B]" />
              <h3 className="text-xl font-bold text-[#2E221F] dark:text-[#F0F4F2]">Handoff Verified & Fulfilled!</h3>
              <p className="mx-auto max-w-sm text-sm text-[#7A746E] dark:text-[#A3B2AC]">
                Pass <strong>{verifiedOrder.qrCode}</strong> ({verifiedOrder.quantity} units of {verifiedOrder.productName}) was verified for recipient <strong>{verifiedOrder.customerName}</strong>. Total collected: <strong>₹{verifiedOrder.priceAtOrder}</strong>.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setSelectedReceipt(verifiedOrder)}
                  className="ss-btn-soft px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" /> View Digital Receipt
                </button>
                <button
                  onClick={() => { setVerifiedOrder(null); setCode(""); }}
                  className="ss-btn-coral px-5 py-2 text-xs font-semibold cursor-pointer"
                >
                  Scan Next Customer Pass
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Enter 6-Character Pass ID</label>
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
                  className="ss-btn-coral px-6 py-2.5 text-sm shrink-0 flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Verify & Deduct
                </button>
              </div>

              {pendingOrders.length > 0 && (
                <div className="mt-6 pt-5 border-t border-[#EAE6DF] dark:border-[#2D3835]">
                  <p className="text-xs font-bold uppercase text-[#7A746E] dark:text-[#A3B2AC] mb-3">
                    Customers in Store Waiting for Pickup ({pendingOrders.length})
                  </p>
                  <div className="space-y-2">
                    {pendingOrders.map(po => (
                      <div key={po.id} className="flex items-center justify-between p-3.5 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D] transition-all">
                        <div>
                          <p className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">{po.productName}</p>
                          <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">
                            {po.customerName} • Qty: {po.quantity} • Total: ₹{po.priceAtOrder} • Pass:{" "}
                            <strong className="font-mono text-[#FF6548] font-bold">{po.qrCode}</strong>
                          </p>
                        </div>
                        <button
                          onClick={() => { setCode(po.qrCode); handleVerify(po.qrCode); }}
                          className="ss-btn-soft px-3 py-1.5 text-xs font-semibold cursor-pointer"
                        >
                          1-Click Verify
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Customer Requests */}
      {activeTab === "requests" && (
        <div className="ss-card overflow-hidden bg-white dark:bg-[#1F2825]">
          <div className="p-4 border-b border-[#EAE6DF] dark:border-[#2D3835] flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">Active Customer Requests ({pendingOrders.length})</h3>
            <span className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">Awaiting supermarket counter handoff</span>
          </div>
          <div className="ss-table-wrap">
            <table className="ss-table w-full text-sm">
              <thead>
                <tr>
                  <th>PASS ID</th>
                  <th>CUSTOMER</th>
                  <th>PRODUCT</th>
                  <th>QUANTITY</th>
                  <th>AMOUNT</th>
                  <th className="text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map(order => (
                  <tr key={order.id} className="hover:bg-[#FAF8F5] dark:hover:bg-[#25302D]">
                    <td>
                      <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-[#FAF5EE] dark:bg-[#2A2320] text-[#FF6548] border border-[#FCD3C9] dark:border-[#5E3128]">
                        {order.qrCode}
                      </span>
                    </td>
                    <td className="font-semibold text-[#2E221F] dark:text-[#F0F4F2]">{order.customerName}</td>
                    <td>{order.productName}</td>
                    <td>{order.quantity} units</td>
                    <td className="font-bold text-[#FF6548]">₹{order.priceAtOrder}</td>
                    <td className="text-right">
                      <button
                        onClick={() => handleVerify(order.qrCode)}
                        className="ss-btn-coral px-3 py-1 text-xs font-semibold cursor-pointer"
                      >
                        Verify & Handoff
                      </button>
                    </td>
                  </tr>
                ))}
                {pendingOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-[#7A746E] dark:text-[#A3B2AC]">
                      No pending customer requests at this time.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Completed Pickups */}
      {activeTab === "pickups" && (
        <div className="ss-card overflow-hidden bg-white dark:bg-[#1F2825]">
          <div className="p-4 border-b border-[#EAE6DF] dark:border-[#2D3835] flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">Fulfilled Order Pickups ({fulfilledOrders.length})</h3>
            <span className="text-xs text-[#00897B] dark:text-[#2DD4BF] font-semibold">Inventory safely rescued & logged</span>
          </div>
          <div className="ss-table-wrap">
            <table className="ss-table w-full text-sm">
              <thead>
                <tr>
                  <th>PASS ID</th>
                  <th>CUSTOMER</th>
                  <th>ITEM</th>
                  <th>QUANTITY</th>
                  <th>COLLECTED</th>
                  <th>TIMESTAMP</th>
                  <th className="text-right">RECEIPT</th>
                </tr>
              </thead>
              <tbody>
                {fulfilledOrders.map(order => (
                  <tr key={order.id} className="hover:bg-[#FAF8F5] dark:hover:bg-[#25302D]">
                    <td className="font-mono text-xs font-bold text-[#554F4A] dark:text-[#CBD5E1]">{order.qrCode}</td>
                    <td className="font-semibold text-[#2E221F] dark:text-[#F0F4F2]">{order.customerName}</td>
                    <td>{order.productName}</td>
                    <td>{order.quantity} units</td>
                    <td className="font-bold text-[#00897B] dark:text-[#2DD4BF]">₹{order.priceAtOrder}</td>
                    <td className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">{new Date(order.reservedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="text-right">
                      <button
                        onClick={() => setSelectedReceipt(order)}
                        className="ss-btn-soft px-2.5 py-1 text-xs cursor-pointer inline-flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedReceipt && (
        <ReceiptModal
          order={selectedReceipt}
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUPERMARKET WORKSPACE: IMPACT & ESG
// -------------------------------------------------------------
function ImpactPage() {
  return <ESGDashboard />;
}

// -------------------------------------------------------------
// CUSTOMER & NGO WORKSPACE: OVERVIEW
// -------------------------------------------------------------
function NgoOverview({ onAction, onOpenSettings }: { onAction: (message: string, kind?: ToastKind) => void; onOpenSettings?: (tab?: SettingsTab) => void }) {
  const [, setLocation] = useLocation();
  const [inventory, setInventory] = useState<InventoryItem[]>(loadInventory);
  const [orders, setOrders] = useState<StoreOrder[]>(() => loadMyOrders(loadSettings().email));
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [stores, setStores] = useState<RegisteredStore[]>(loadStores);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<StoreOrder | null>(null);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [watchPrefill, setWatchPrefill] = useState<{ keyword?: string; category?: string; maxPrice?: number } | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setInventory(loadInventory());
      const s = loadSettings();
      setSettings(s);
      setOrders(loadMyOrders(s.email));
      setStores(loadStores());
    };
    window.addEventListener("ss_inventory_updated", handleUpdate);
    window.addEventListener("ss_orders_updated", handleUpdate);
    window.addEventListener("ss_settings_updated", handleUpdate);
    window.addEventListener("ss_stores_updated", handleUpdate);
    return () => {
      window.removeEventListener("ss_inventory_updated", handleUpdate);
      window.removeEventListener("ss_orders_updated", handleUpdate);
      window.removeEventListener("ss_settings_updated", handleUpdate);
      window.removeEventListener("ss_stores_updated", handleUpdate);
    };
  }, []);

  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const handleBuy = (item: InventoryItem) => {
    const qty = quantities[item.id] > 0 ? quantities[item.id] : 1;
    const order = addReservation(item, qty, settings.name, settings.userLocation, settings.email);

    onAction(`Reserved ${qty} ${item.unit} of ${item.name}! Your pickup QR pass is ready.`, "success");
    setSelectedReceipt(order);
  };

  const activeReservations = orders.filter(o => o.status === "RESERVED");
  const fulfilledOrders = orders.filter(o => o.status === "FULFILLED");

  const userCity = (settings.userCity || "").trim();

  // Dynamic Supermarket Mapping and Distance calculation
  const storeMap = new Map<string, { id: string; name: string; location: string; area: string; city: string; itemCount: number; distance: string; km: number }>();

  // Add all registered supermarkets that match user's city
  stores.forEach(s => {
    // Multi-city isolation: user in City A cannot see store in City B
    if (userCity && s.city && !isSameCity(userCity, s.city)) {
      return;
    }

    const dist = calculateDistance(
      settings.userLocation || settings.selectedArea,
      s.location || s.area,
      userCity,
      s.city
    );

    if (!dist.sameCity) return;

    const count = inventory.filter(i => {
      if (userCity && i.storeCity && !isSameCity(userCity, i.storeCity)) return false;
      const matchStore = (i.store && s.name && i.store.toLowerCase() === s.name.toLowerCase()) || (i.storeId && s.id && i.storeId === s.id);
      return matchStore && i.available > 0;
    }).length;

    storeMap.set(s.name.toLowerCase(), {
      id: s.id,
      name: s.name,
      location: s.location,
      area: s.area,
      city: s.city,
      itemCount: count,
      distance: dist.display,
      km: dist.km
    });
  });

  // Also include any stores that have items listed in inventory in the user's city
  inventory.forEach(inv => {
    if (userCity && inv.storeCity && !isSameCity(userCity, inv.storeCity)) {
      return;
    }
    const key = inv.store.toLowerCase();
    if (!storeMap.has(key)) {
      const matchedStore = stores.find(st => st.name.toLowerCase() === key);
      const storeCity = inv.storeCity || matchedStore?.city || "";
      if (userCity && storeCity && !isSameCity(userCity, storeCity)) {
        return;
      }
      const loc = inv.storeLocation || matchedStore?.location || "Market Area";
      const dist = calculateDistance(
        settings.userLocation || settings.selectedArea,
        loc,
        userCity,
        storeCity
      );
      if (!dist.sameCity) return;

      const count = inventory.filter(i => {
        if (userCity && i.storeCity && !isSameCity(userCity, i.storeCity)) return false;
        return i.store.toLowerCase() === key && i.available > 0;
      }).length;

      storeMap.set(key, {
        id: inv.storeId || key,
        name: inv.store,
        location: loc,
        area: inv.storeArea || matchedStore?.area || "Local Area",
        city: storeCity,
        itemCount: count,
        distance: dist.display,
        km: dist.km
      });
    }
  });

  const nearbySupermarkets = Array.from(storeMap.values())
    .filter(s => !settings.searchRadiusKm || s.km <= settings.searchRadiusKm)
    .sort((a, b) => a.km - b.km);

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">VERIFIED SURPLUS STORES</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">Food available nearby</h1>
          <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1">
            Browse discounted food in {userCity || "your city"} within {settings.searchRadiusKm} km of {settings.userLocation || settings.selectedArea}, choose quantity, and collect on time.
          </p>
        </div>
        <button
          onClick={() => onOpenSettings?.("location")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] text-xs font-semibold text-[#2D2320] dark:text-[#F0F4F2] shadow-sm hover:bg-[#FAF8F5] dark:hover:bg-[#2A3532] shrink-0 self-start sm:self-center cursor-pointer transition-all"
          title="Permanent Location • Click to edit in Settings"
        >
          <MapPin className="h-3.5 w-3.5 text-[#00897B] dark:text-[#2DD4BF]" /> {userCity ? `${userCity} • ` : ""}{settings.userLocation || settings.selectedArea} ({settings.searchRadiusKm}km)
        </button>
      </div>

      {/* Nearby Supermarkets Section */}
      <div className="ss-card p-6 bg-white dark:bg-[#1F2825]">
        <div className="flex items-center justify-between pb-4 border-b border-[#EAE6DF]/60 dark:border-[#2D3835]">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-[#00897B] dark:text-[#2DD4BF]" />
            <h2 className="text-base font-bold text-[#2E221F] dark:text-[#F0F4F2]">Nearby Supermarkets</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#E0F7F2] dark:bg-[#18332B] text-[#00897B] dark:text-[#2DD4BF] font-bold">
              {nearbySupermarkets.length} registered
            </span>
          </div>
          <button
            onClick={() => onOpenSettings?.("location")}
            className="text-xs font-semibold text-[#00897B] dark:text-[#2DD4BF] hover:underline flex items-center gap-1 cursor-pointer"
          >
            Change radius ({settings.searchRadiusKm} km) &rarr;
          </button>
        </div>

        {nearbySupermarkets.length === 0 ? (
          <div className="py-10 text-center">
            <Building2 className="h-8 w-8 text-[#A3B2AC] mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold text-[#2E221F] dark:text-[#F0F4F2]">
              {userCity ? `No Supermarkets Registered in ${userCity} Yet` : "No Supermarkets Registered Yet"}
            </p>
            <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-1 max-w-sm mx-auto">
              {userCity
                ? `Only supermarkets located in ${userCity} are shown to you. When local stores join, they will appear here.`
                : "When supermarkets join and add their store name & location, they will appear here with live surplus food."}
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearbySupermarkets.map(s => (
              <div
                key={s.id}
                className="p-4 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF9F6] dark:bg-[#1A2220] hover:border-[#00897B] transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#E0F7F2] dark:bg-[#18332B] text-[#00897B] dark:text-[#2DD4BF] shrink-0 font-bold text-xs">
                        {s.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2] truncate">{s.name}</h3>
                        <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-[#FF6548] shrink-0" />
                          <span className="truncate">{s.location}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-[#7A746E] dark:text-[#A3B2AC] pt-2 border-t border-[#EAE6DF]/60 dark:border-[#2D3835]">
                    <span className="font-semibold text-[#00897B] dark:text-[#2DD4BF]">{s.distance} away</span>
                    <span className="font-bold text-[#2E221F] dark:text-[#F0F4F2]">{s.itemCount} surplus items</span>
                  </div>
                </div>

                <Link
                  href={`/ngo/available-food?store=${encodeURIComponent(s.name)}`}
                  className="ss-btn-soft w-full py-2 text-xs font-semibold text-center flex items-center justify-center gap-1.5"
                >
                  Browse Store Foods <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3 Metric Cards matching Screenshot 1 - now clickable! */}
      <div className="grid gap-4 sm:grid-cols-3">
        <button
          onClick={() => setLocation("/ngo/history")}
          className="ss-card p-5 text-left hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670] dark:text-[#A3B2AC]">My orders</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2] group-hover:text-[#FF6548] transition-colors">
                {orders.length}
              </p>
              <p className="mt-2 text-xs text-[#8A847E] dark:text-[#64748B]">{activeReservations.length} ready for pickup</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#FEECE8] dark:bg-[#382420] text-[#FF6548] shrink-0">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
        </button>

        <button
          onClick={() => setLocation("/ngo/active")}
          className="ss-card p-5 text-left hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670] dark:text-[#A3B2AC]">Upcoming pickups</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2] group-hover:text-[#00897B] transition-colors">
                {activeReservations.length}
              </p>
              <p className="mt-2 text-xs text-[#8A847E] dark:text-[#64748B]">Show QR codes at counter</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E6F8F3] dark:bg-[#1A332C] text-[#00897B] dark:text-[#2DD4BF] shrink-0">
              <Truck className="h-4 w-4" />
            </div>
          </div>
        </button>

        <button
          onClick={() => setLocation("/ngo/history")}
          className="ss-card p-5 text-left hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#7D7670] dark:text-[#A3B2AC]">Food collected</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2]">
                {fulfilledOrders.reduce((sum, o) => sum + o.quantity, 0)} units
              </p>
              <p className="mt-2 text-xs text-[#8A847E] dark:text-[#64748B]">Since joining Smart Surplus</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#F0F2F1] dark:bg-[#25302D] text-[#55605D] dark:text-[#CBD5E1] shrink-0">
              <Handshake className="h-4 w-4" />
            </div>
          </div>
        </button>
      </div>

      {/* Two main columns: Available now & Upcoming pickups */}
      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr] items-start">
        {/* Left Column: Available now */}
        <div className="ss-card p-6 bg-white dark:bg-[#1F2825]">
          <div className="flex items-center justify-between pb-4 border-b border-[#EAE6DF]/60 dark:border-[#2D3835]">
            <h2 className="text-base font-bold text-[#2E221F] dark:text-[#F0F4F2]">Available now</h2>
            <Link href="/ngo/available-food" className="text-xs font-semibold text-[#00897B] dark:text-[#2DD4BF] hover:underline flex items-center gap-1">
              See all food <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {(() => {
              const availableInCity = inventory.filter(item => {
                if (userCity && item.storeCity && !isSameCity(userCity, item.storeCity)) return false;
                if (userCity && !item.storeCity && item.store) {
                  const matchedStore = stores.find(s => s.name.toLowerCase() === item.store.toLowerCase());
                  if (matchedStore?.city && !isSameCity(userCity, matchedStore.city)) return false;
                }
                // Item B Safety Rule: EXPIRED items are never listed for sale
                if (item.available <= 0) return false;
                if (item.status === "Discarded" || item.status === "Discard recommended" || item.status === "Expired") return false;
                if (isPrintedDateInPast(item.expiryDate)) return false;
                if (typeof item.freshnessScore === "number" && item.freshnessScore < TIER_CONFIG.expiredMax) return false;
                return true;
              });

              if (availableInCity.length === 0) {
                return (
                  <div className="py-12 text-center rounded-xl border border-dashed border-[#EAE6DF] dark:border-[#2D3835]">
                    <Boxes className="h-8 w-8 text-[#A3B2AC] mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-bold text-[#2E221F] dark:text-[#F0F4F2]">
                      {userCity ? `No surplus food listed in ${userCity} yet` : "No surplus food listed yet"}
                    </p>
                    <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-1 max-w-xs mx-auto">
                      {userCity
                        ? `When supermarkets in ${userCity} list surplus produce or bakery batches, they will appear here.`
                        : "When nearby supermarkets list surplus produce or bakery batches, they will appear here."}
                    </p>
                  </div>
                );
              }

              return availableInCity.slice(0, 5).map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1A2220] gap-3 hover:border-[#FF6548]/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#F5F5F3] dark:bg-[#25302D] text-[#7A746E] dark:text-[#A3B2AC] shrink-0">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">{item.name}</span>
                        <StatusBadge label={item.status} />
                      </div>
                      <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">
                        <span className="font-semibold text-[#00897B] dark:text-[#2DD4BF]">{item.store}</span> • {item.available} {item.unit} left • {calculateDistance(settings.userLocation || settings.selectedArea, item.storeLocation || item.store, userCity, item.storeCity).display} away
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => setDetailItem(item)}
                      className="p-1.5 rounded-lg text-[#7A746E] hover:text-[#00897B] dark:hover:text-[#2DD4BF] hover:bg-[#F5F5F3] dark:hover:bg-[#25302D] cursor-pointer"
                      title="Inspect AI Freshness & Tips"
                    >
                      <Info className="h-4 w-4" />
                    </button>

                    <div className="flex items-center border border-[#EAE6DF] dark:border-[#2D3835] rounded-lg bg-white dark:bg-[#1F2825] overflow-hidden">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="px-2.5 py-1 text-xs text-[#7A746E] hover:bg-[#F5F5F3] dark:hover:bg-[#25302D] cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-2.5 py-1 text-xs font-bold text-[#2E221F] dark:text-[#F0F4F2] min-w-[24px] text-center">
                        {quantities[item.id] || 0}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="px-2.5 py-1 text-xs text-[#7A746E] hover:bg-[#F5F5F3] dark:hover:bg-[#25302D] cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleBuy(item)}
                      className="ss-btn-coral px-4 py-1.5 text-xs font-semibold shadow-sm cursor-pointer"
                    >
                      Buy (₹{item.currentPrice})
                    </button>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Right Column: Upcoming pickups */}
        <div className="ss-card p-6 bg-white dark:bg-[#1F2825] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#2E221F] dark:text-[#F0F4F2]">Upcoming Pickups</h2>
            <Link href="/ngo/active" className="text-xs font-semibold text-[#00897B] dark:text-[#2DD4BF] hover:underline">
              View all passes &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {activeReservations.map(order => (
              <div
                key={order.id}
                onClick={() => setSelectedReceipt(order)}
                className="p-4 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF9F6] dark:bg-[#1A2220] hover:border-[#FF6548] cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    <Store className="h-4 w-4 text-[#00897B] dark:text-[#2DD4BF] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">{order.storeName}</p>
                      <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">{order.productName} ({order.quantity} units)</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#FF6548] px-2 py-0.5 bg-[#FFF0ED] dark:bg-[#382420] rounded">
                    {order.qrCode}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-3 pt-2 border-t border-[#EAE6DF]/60 dark:border-[#2D3835]">
                  <span>Hold: ~15 mins left</span>
                  <span className="font-bold text-[#FF6548]">Pay ₹{order.priceAtOrder}</span>
                </div>
              </div>
            ))}

            {activeReservations.length === 0 && (
              <div className="py-8 text-center text-xs text-[#7A746E] dark:text-[#A3B2AC]">
                No upcoming pickups. Reserve any surplus item on the left to get your pickup QR pass!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Detail Modal */}
      {detailItem && (
        <ProductDetailModal
          item={detailItem}
          isOpen={true}
          onClose={() => setDetailItem(null)}
          onReserve={(it, q) => {
            const order = addReservation(it, q, settings.name, settings.userLocation, settings.email);
            onAction(`Reserved ${q} ${it.unit} of ${it.name}!`, "success");
            setSelectedReceipt(order);
          }}
          onWatch={(it) => {
            setWatchPrefill({
              keyword: it.name,
              category: it.category,
              maxPrice: it.currentPrice,
            });
            setWatchlistOpen(true);
          }}
        />
      )}

      <WatchlistModal
        isOpen={watchlistOpen}
        onClose={() => { setWatchlistOpen(false); setWatchPrefill(null); }}
        initialKeyword={watchPrefill?.keyword}
        initialCategory={watchPrefill?.category}
        initialMaxPrice={watchPrefill?.maxPrice}
        onAction={onAction}
      />

      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          order={selectedReceipt}
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMER & NGO WORKSPACE: BROWSE FOOD (Matching Screenshot 2)
// -------------------------------------------------------------
function NgoAvailableFood({ onAction, onOpenSettings }: { onAction: (message: string, kind?: ToastKind) => void; onOpenSettings?: (tab?: SettingsTab) => void }) {
  const searchParams = new URLSearchParams(window.location.search);
  const initialStore = searchParams.get("store") || "All";

  const [inventory, setInventory] = useState<InventoryItem[]>(loadInventory);
  const [stores, setStores] = useState<RegisteredStore[]>(loadStores);
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStore, setSelectedStore] = useState(initialStore);
  const [sortBy, setSortBy] = useState<"distance" | "price_asc" | "freshness">("distance");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<StoreOrder | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => settings.favoriteStores || []);
  const [cart, setCart] = useState<{ item: InventoryItem; qty: number }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [watchPrefill, setWatchPrefill] = useState<{ keyword?: string; category?: string; maxPrice?: number } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const toggleFavorite = (storeName: string) => {
    const next = favorites.includes(storeName)
      ? favorites.filter(f => f !== storeName)
      : [...favorites, storeName];
    setFavorites(next);
    saveSettings({ ...settings, favoriteStores: next });
    onAction(favorites.includes(storeName) ? `Removed ${storeName} from favorites` : `Added ${storeName} to favorites ❤️`);
  };

  const addToCart = (item: InventoryItem, qty: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + qty } : c);
      return [...prev, { item, qty }];
    });
    onAction(`Added ${qty} ${item.unit} of ${item.name} to cart 🛒`);
  };

  const checkoutCart = () => {
    if (cart.length === 0) return;
    cart.forEach(({ item, qty }) => {
      const order = addReservation(item, qty, settings.name, settings.userLocation, settings.email);
      setSelectedReceipt(order);
    });
    setCart([]);
    setCartOpen(false);
    onAction(`🎉 All ${cart.length} cart items reserved! Show QR at checkout.`, "success");
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.item.currentPrice * c.qty, 0);

  useEffect(() => {
    const handleUpdate = () => {
      setInventory(loadInventory());
      setStores(loadStores());
      setSettings(loadSettings());
    };
    window.addEventListener("ss_inventory_updated", handleUpdate);
    window.addEventListener("ss_stores_updated", handleUpdate);
    window.addEventListener("ss_settings_updated", handleUpdate);
    return () => {
      window.removeEventListener("ss_inventory_updated", handleUpdate);
      window.removeEventListener("ss_stores_updated", handleUpdate);
      window.removeEventListener("ss_settings_updated", handleUpdate);
    };
  }, []);

  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const handleBuy = (item: InventoryItem) => {
    const qty = quantities[item.id] > 0 ? quantities[item.id] : 1;
    const order = addReservation(item, qty, settings.name, settings.userLocation, settings.email);
    onAction(`Reserved ${qty} ${item.unit} of ${item.name}! Your pickup pass is ready.`, "success");
    setSelectedReceipt(order);
  };

  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  // The user's city (normalised for comparison)
  const userCity = (settings.userCity || "").trim();

  // Helper to normalize store names for grouping and filtering
  const normStore = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace("kirna", "kirana");

  // Helper: check if a store/item is in the user's city
  const isItemInUserCity = (storeCity?: string, storeName?: string) => {
    if (!userCity) return true;
    const effectiveCity = (storeCity || (storeName ? stores.find(s => normStore(s.name) === normStore(storeName))?.city : "") || "").trim();
    if (!effectiveCity) return false;
    return isSameCity(userCity, effectiveCity);
  };

  // City-filtered inventory: only items whose store is in the user's city (+ within radius)
  const cityFilteredInventory = inventory.filter(item => {
    // Multi-city boundary: user in City A cannot see items in City B
    if (!isItemInUserCity(item.storeCity, item.store)) return false;

    // Safety rule: EXPIRED items are never listed for sale
    if (item.available <= 0) return false;
    if (item.status === "Discarded" || item.status === "Discard recommended" || item.status === "Expired") return false;
    if (isPrintedDateInPast(item.expiryDate)) return false;
    if (typeof item.freshnessScore === "number" && item.freshnessScore < TIER_CONFIG.expiredMax) return false;

    // Distance / radius check using Haversine algorithm
    const dist = calculateDistance(
      settings.userLocation || settings.selectedArea,
      item.storeLocation || item.store,
      userCity,
      item.storeCity
    );
    if (!dist.sameCity) return false;
    if (settings.searchRadiusKm && dist.km > settings.searchRadiusKm) return false;

    return true;
  });

  // Build list of distinct supermarkets (only stores that have surplus food in user's city)
  const distinctStoreMap = new Map<string, { name: string; location: string; city: string; distance: string }>();

  // Add stores that currently have available inventory
  cityFilteredInventory.forEach(i => {
    if (!i.store) return;
    const k = normStore(i.store);
    if (!distinctStoreMap.has(k)) {
      const matched = stores.find(s => normStore(s.name) === k);
      distinctStoreMap.set(k, {
        name: matched?.name || i.store,
        location: matched?.location || i.storeLocation || "Market Area",
        city: matched?.city || i.storeCity || "",
        distance: calculateDistance(settings.userLocation || settings.selectedArea, matched?.location || i.storeLocation || i.store, userCity, i.storeCity).display
      });
    }
  });

  const distinctStores = Array.from(distinctStoreMap.values());

  const filtered = cityFilteredInventory.filter(item => {
    const matchCategory = selectedCategory === "All" || item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchStore = selectedStore === "All" || normStore(item.store) === normStore(selectedStore);
    const matchFav = !favoritesOnly || favorites.some(fav => normStore(fav) === normStore(item.store));
    const matchQuery = !query.trim() ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.store.toLowerCase().includes(query.toLowerCase()) ||
      (item.storeLocation && item.storeLocation.toLowerCase().includes(query.toLowerCase()));
    return matchCategory && matchStore && matchFav && matchQuery;
  }).sort((a, b) => {
    if (sortBy === "price_asc") return a.currentPrice - b.currentPrice;
    if (sortBy === "freshness") return b.freshnessScore - a.freshnessScore;
    const distA = calculateDistance(settings.userLocation || settings.selectedArea, a.storeLocation || a.store, userCity, a.storeCity).km;
    const distB = calculateDistance(settings.userLocation || settings.selectedArea, b.storeLocation || b.store, userCity, b.storeCity).km;
    return distA - distB;
  });

  // Compare mode: ranked items sorted by price ascending for direct cross-store price comparison
  const compareRankedItems = (() => {
    if (!compareMode || !query.trim()) return [];
    return [...filtered].sort((a, b) => a.currentPrice - b.currentPrice);
  })();

  // Compare mode: group items by product name for cross-store comparison
  const compareGroups = (() => {
    if (!compareMode || !query.trim()) return [];
    // Group filtered items by normalised product name
    const groups = new Map<string, InventoryItem[]>();
    filtered.forEach(item => {
      const key = item.name.trim().toLowerCase();
      const arr = groups.get(key) || [];
      arr.push(item);
      groups.set(key, arr);
    });
    // Sort each group by price ascending for easy comparison
    return Array.from(groups.entries())
      .map(([name, items]) => ({
        productName: items[0].name,
        items: items.sort((a, b) => a.currentPrice - b.currentPrice)
      }))
      .filter(g => g.items.length > 0);
  })();

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-6">
      {/* Top Header with Cart Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">VERIFIED SURPLUS STORES</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">Food available nearby</h1>
          <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1 flex items-center gap-2 flex-wrap">
            {userCity ? (
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                  <MapPin className="h-3 w-3" />
                  {settings.userCity}
                </span>
                <span>•</span>
                <span>Stores in {settings.userCity} within {settings.searchRadiusKm} km</span>
                <button
                  type="button"
                  onClick={() => onOpenSettings?.("location")}
                  className="text-[11px] font-bold text-[#00897B] dark:text-[#2DD4BF] hover:underline cursor-pointer ml-1"
                >
                  Change City / Radius
                </button>
              </>
            ) : (
              <span className="flex items-center gap-1.5 flex-wrap">
                <span>Set your city to filter stores in your city.</span>
                <button
                  type="button"
                  onClick={() => onOpenSettings?.("location")}
                  className="px-2.5 py-0.5 rounded-md bg-[#00897B] hover:bg-[#00796B] text-white text-[11px] font-bold cursor-pointer"
                >
                  📍 Set City
                </button>
              </span>
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Compare Prices Toggle */}
          <button
            onClick={() => setCompareMode(prev => !prev)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${compareMode
              ? "bg-indigo-600 text-white shadow-sm"
              : "border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] text-[#554F4A] dark:text-[#CBD5E1] hover:bg-[#FAF8F5]"
              }`}
            title="Compare the same product across different stores by price"
          >
            <ArrowUpDown className={`h-4 w-4 ${compareMode ? "text-white" : "text-indigo-500"}`} />
            <span>Compare Prices</span>
          </button>

          {/* Favorites Toggle */}
          <button
            onClick={() => setFavoritesOnly(prev => !prev)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${favoritesOnly
              ? "bg-rose-500 text-white shadow-sm"
              : "border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] text-[#554F4A] dark:text-[#CBD5E1] hover:bg-[#FAF8F5]"
              }`}
            title="Filter by favorited supermarkets"
          >
            <Heart className={`h-4 w-4 ${favoritesOnly ? "fill-white text-white" : "text-rose-500"}`} />
            <span>Favorites {favorites.length > 0 ? `(${favorites.length})` : ""}</span>
          </button>

          {/* Watchlist Alerts */}
          <button
            onClick={() => { setWatchPrefill(null); setWatchlistOpen(true); }}
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] text-[#554F4A] dark:text-[#CBD5E1] hover:bg-[#FAF8F5]"
            title="Manage your surplus food watchlist alerts"
          >
            <Bell className="h-4 w-4 text-amber-500" />
            <span>Watchlist</span>
          </button>

          {/* Cart Button */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Cart ({cart.reduce((s, c) => s + c.qty, 0)}) • ₹{cartTotal}</span>
            {cart.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-amber-400 absolute -top-1 -right-1 animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* City Not Set Warning */}
      {!userCity && inventory.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">City not set — currently showing all stores</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                Set your city to only see supermarkets located in your city or neighborhood.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenSettings?.("location")}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
          >
            <MapPin className="h-3.5 w-3.5" /> Set City
          </button>
        </div>
      )}

      {/* Supermarket Filter Bar */}
      {distinctStores.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-[#7A746E] dark:text-[#A3B2AC] shrink-0 flex items-center gap-1">
            <Store className="h-3.5 w-3.5 text-[#00897B] dark:text-[#2DD4BF]" /> Supermarket:
          </span>
          <button
            onClick={() => setSelectedStore("All")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer ${selectedStore === "All"
              ? "bg-[#00897B] text-white shadow-xs"
              : "border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] text-[#554F4A] dark:text-[#CBD5E1] hover:bg-[#FAF8F5]"
              }`}
          >
            All Stores ({cityFilteredInventory.length})
          </button>
          {distinctStores.map(s => {
            const isSelected = normStore(selectedStore) === normStore(s.name);
            const count = cityFilteredInventory.filter(i => normStore(i.store) === normStore(s.name)).length;
            const isFav = favorites.some(fav => normStore(fav) === normStore(s.name));
            return (
              <div
                key={s.name}
                className={`inline-flex items-center rounded-lg text-xs font-semibold shrink-0 border transition-all ${isSelected
                  ? "bg-[#00897B] text-white border-[#00897B] shadow-xs"
                  : "border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] text-[#554F4A] dark:text-[#CBD5E1] hover:bg-[#FAF8F5]"
                  }`}
              >
                <button
                  onClick={() => setSelectedStore(s.name)}
                  className="px-2.5 py-1.5 cursor-pointer text-left"
                >
                  {s.name} ({count}) • {s.distance}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(s.name);
                  }}
                  className="pr-2 pl-0.5 py-1.5 text-xs hover:scale-110 transition-transform cursor-pointer"
                  title={isFav ? "Favorited store" : "Add to favorites"}
                >
                  <Heart className={`h-3.5 w-3.5 ${isFav ? "fill-rose-500 text-rose-500" : isSelected ? "text-white/70" : "text-[#A3B2AC]"}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter and Categories Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#8A847E] pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={compareMode
              ? "Type a product name (e.g. Paneer, Milk, Dahi) to compare prices across stores..."
              : "Search food, supermarket name, or address..."
            }
            className="ss-input text-sm"
            style={{ paddingLeft: "2.6rem" }}
          />
        </div>

        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="ss-input sm:w-44 text-xs font-semibold"
        >
          <option value="distance">Nearest Distance</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="freshness">AI Freshness Score</option>
        </select>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {["All", "Dairy", "Vegetables", "Fruit", "Bakery", "Staples"].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${selectedCategory === cat
                ? "bg-[#2E3735] dark:bg-white text-white dark:text-[#2E3735] shadow-sm"
                : "bg-white dark:bg-[#1F2825] text-[#554F4A] dark:text-[#CBD5E1] border border-[#EAE6DF] dark:border-[#2D3835] hover:bg-[#F8F6F1] dark:hover:bg-[#25302D]"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Compare Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[#7A746E] dark:text-[#A3B2AC] font-semibold shrink-0">Quick Compare:</span>
        {[
          { label: "🧀 Paneer", term: "Paneer" },
          { label: "🥛 Milk", term: "Milk" },
          { label: "🥣 Dahi", term: "Dahi" },
          { label: "🍞 Bread", term: "Bread" },
          { label: "🍎 Apples", term: "Apple" },
          { label: "🍅 Tomatoes", term: "Tomato" },
        ].map(chip => (
          <button
            key={chip.term}
            onClick={() => {
              setQuery(chip.term);
              setCompareMode(true);
            }}
            className={`px-3 py-1 rounded-lg border text-xs font-semibold shrink-0 transition-all cursor-pointer ${query.toLowerCase() === chip.term.toLowerCase() && compareMode
              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
              : "border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] text-[#554F4A] dark:text-[#CBD5E1] hover:bg-[#FAF8F5]"
              }`}
          >
            {chip.label}
          </button>
        ))}
        {query && (
          <button
            onClick={() => { setQuery(""); setCompareMode(false); }}
            className="text-[11px] text-[#FF6548] font-semibold hover:underline shrink-0 px-1 cursor-pointer"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Compare Prices View */}
      {compareMode && query.trim() && compareRankedItems.length > 0 && (() => {
        const minPrice = compareRankedItems[0].currentPrice;
        const maxPrice = compareRankedItems[compareRankedItems.length - 1].currentPrice;
        const bestStore = compareRankedItems[0].store;
        const distinctStoresCount = new Set(compareRankedItems.map(i => i.store)).size;

        return (
          <div className="space-y-4 ss-reveal">
            {/* Price Comparison Summary Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-950/40 dark:to-emerald-950/40 border border-indigo-200 dark:border-indigo-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white shrink-0 shadow-xs">
                  <ArrowUpDown className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#2E221F] dark:text-[#F0F4F2]">
                    Price Comparison for "{query}" across {distinctStoresCount} store{distinctStoresCount !== 1 ? "s" : ""}
                  </h2>
                  <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">
                    Found {compareRankedItems.length} option{compareRankedItems.length !== 1 ? "s" : ""} in {settings.userCity || "your area"} — ranked by lowest price
                  </p>
                </div>
              </div>

              {compareRankedItems.length > 1 && maxPrice > minPrice && (
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[11px] font-semibold text-[#7A746E] dark:text-[#A3B2AC] block">Best Price at {bestStore}</span>
                  <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    Save up to ₹{maxPrice - minPrice}
                  </span>
                </div>
              )}
            </div>

            {/* Comparison Cards / Rows */}
            <div className="ss-card bg-white dark:bg-[#1F2825] overflow-hidden divide-y divide-[#EAE6DF]/60 dark:divide-[#2D3835]">
              {compareRankedItems.map((item, idx) => {
                const itemDist = calculateDistance(settings.userLocation || settings.selectedArea, item.storeLocation || item.store);
                const isCheapest = idx === 0 && compareRankedItems.length > 1;
                const qtySelected = quantities[item.id] > 0 ? quantities[item.id] : 1;
                const drop = nextPriceDrop(item, undefined, nowMs);

                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isCheapest ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "hover:bg-[#FAF8F5] dark:hover:bg-[#25302D]"
                      }`}
                  >
                    <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                      {/* Rank Number */}
                      <div className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-black shrink-0 ${isCheapest
                        ? "bg-emerald-500 text-white shadow-xs"
                        : "bg-[#F5F5F3] dark:bg-[#25302D] text-[#7A746E] dark:text-[#A3B2AC]"
                        }`}>
                        #{idx + 1}
                      </div>

                      {/* Item & Store Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">{item.name}</h3>
                          {isCheapest && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] tracking-wide border border-emerald-300 dark:border-emerald-700">
                              ★ BEST PRICE
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#FAF8F5] dark:bg-[#161D1B] border border-[#EAE6DF] dark:border-[#2D3835] text-[#7A746E] dark:text-[#A3B2AC] font-semibold">
                            {item.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-1 flex-wrap">
                          <span className="font-bold text-[#00897B] dark:text-[#2DD4BF] flex items-center gap-1">
                            <Store className="h-3 w-3" /> {item.store}
                          </span>
                          <span>•</span>
                          <span>{item.storeLocation || item.storeArea || "Market"}</span>
                          <span>•</span>
                          <span>📍 {itemDist.display}</span>
                          <span>•</span>
                          <span className="text-amber-600 dark:text-amber-400 font-medium">Expires: {item.expiry}</span>
                        </div>
                      </div>
                    </div>

                    {/* Price & Buying Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#EAE6DF]/60 dark:border-[#2D3835]">
                      <div className="text-left sm:text-right">
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-lg font-extrabold ${isCheapest ? "text-emerald-600 dark:text-emerald-400" : "text-[#FF6548]"}`}>
                            ₹{item.currentPrice}
                          </span>
                          {item.discountPercent > 0 && (
                            <span className="text-xs text-[#8A847E] line-through">₹{item.originalPrice}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8A847E] dark:text-[#7A746E]">
                          {item.available} {item.unit} available
                        </p>
                        {drop && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold block mt-0.5">
                            Drops to {drop.nextDiscountPercent}% in {formatTimeRemaining(drop.dropsAt, nowMs)} (expected)
                          </span>
                        )}
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center border border-[#EAE6DF] dark:border-[#2D3835] rounded-xl overflow-hidden bg-white dark:bg-[#1A2220]">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, -1)}
                          className="px-2 py-1.5 hover:bg-[#F5F5F3] dark:hover:bg-[#25302D] text-[#554F4A] dark:text-[#CBD5E1] cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2 py-1.5 font-bold text-xs min-w-[22px] text-center text-[#2E221F] dark:text-[#F0F4F2]">
                          {quantities[item.id] || 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, 1)}
                          className="px-2 py-1.5 hover:bg-[#F5F5F3] dark:hover:bg-[#25302D] text-[#554F4A] dark:text-[#CBD5E1] cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Add to Cart */}
                      <button
                        type="button"
                        onClick={() => addToCart(item, qtySelected)}
                        className="p-2 rounded-xl border border-[#00897B] text-[#00897B] dark:text-[#2DD4BF] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                        title="Add to cart"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </button>

                      {/* Buy Button */}
                      <button
                        type="button"
                        onClick={() => handleBuy(item)}
                        className="px-4 py-2 rounded-xl ss-btn-coral text-xs font-bold cursor-pointer shadow-xs"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Compare mode empty state */}
      {compareMode && query.trim() && compareRankedItems.length === 0 && (
        <div className="ss-card p-8 bg-white dark:bg-[#1F2825] text-center space-y-2">
          <ArrowUpDown className="h-8 w-8 text-[#A3B2AC] mx-auto" />
          <h3 className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">No matching products found</h3>
          <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] max-w-sm mx-auto">
            No items matching "{query}" were found in stores in {settings.userCity || "your area"}. Try another product like "Milk", "Paneer", or "Bread".
          </p>
        </div>
      )}

      {/* Compare mode hint */}
      {compareMode && !query.trim() && (
        <div className="ss-card p-6 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-center space-y-2">
          <Search className="h-8 w-8 text-indigo-400 mx-auto" />
          <h3 className="font-bold text-sm text-indigo-700 dark:text-indigo-300">Compare Prices Mode</h3>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 max-w-md mx-auto">
            Type a product name in the search bar (e.g. "Paneer", "Milk", "Dahi", "Apple") to see that item listed across all nearby stores with different pricing. You can compare and buy from the cheapest one!
          </p>
        </div>
      )}

      {/* Normal Grid View — hidden when compareMode is active with a query */}
      {!(compareMode && query.trim()) && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center ss-card p-8 bg-white dark:bg-[#1F2825]">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5F5F3] dark:bg-[#25302D] text-[#8A847E] dark:text-[#A3B2AC] mx-auto mb-3">
                <Boxes className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base text-[#2E221F] dark:text-[#F0F4F2]">No Surplus Food Available</h3>
              <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-1 max-w-sm mx-auto">
                {favoritesOnly
                  ? "No surplus items found from your favorited supermarkets."
                  : selectedStore !== "All"
                    ? `No items currently listed by ${selectedStore}.`
                    : "No surplus produce listed matching your filters. When nearby supermarkets add food batches, they will appear here live."}
              </p>
            </div>
          ) : (
            filtered.map(item => {
              const itemDist = calculateDistance(settings.userLocation || settings.selectedArea, item.storeLocation || item.store);
              const isFav = favorites.includes(item.store);
              const mapsQuery = encodeURIComponent(`${item.store} ${item.storeLocation || ""}`);
              const qtySelected = quantities[item.id] > 0 ? quantities[item.id] : 1;
              const drop = nextPriceDrop(item, undefined, nowMs);

              return (
                <div key={item.id} className="ss-card p-5 bg-white dark:bg-[#1F2825] space-y-3.5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#F5F5F3] dark:bg-[#25302D] text-[#7A746E] dark:text-[#A3B2AC]">
                        <Boxes className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          {Math.round(item.freshnessScore * 100)}% Fresh
                        </span>
                        <StatusBadge label={item.status} />
                      </div>
                    </div>

                    {/* Title & Store Info */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base text-[#2E221F] dark:text-[#F0F4F2]">{item.name}</h3>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleFavorite(item.store)}
                            className="p-1 text-[#7A746E] hover:text-rose-500 cursor-pointer"
                            title={isFav ? "Favorited store" : "Add store to favorites"}
                          >
                            <Heart className={`h-4 w-4 ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
                          </button>
                          <button
                            onClick={() => {
                              setWatchPrefill({
                                keyword: item.name,
                                category: item.category,
                                maxPrice: item.currentPrice,
                              });
                              setWatchlistOpen(true);
                            }}
                            className="p-1 text-[#7A746E] hover:text-amber-500 cursor-pointer"
                            title="Watch for price drops"
                          >
                            <Bell className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDetailItem(item)}
                            className="p-1 text-[#7A746E] hover:text-[#00897B] dark:hover:text-[#2DD4BF] cursor-pointer"
                            title="View Freshness Specs & Tips"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[#00897B] dark:text-[#2DD4BF]">{item.store}</span>
                        <span>•</span>
                        <span>{item.storeLocation || item.storeArea || "Store Branch"}</span>
                        <span>•</span>
                        <span className="font-semibold text-[#FF6548]">{itemDist.display}</span>
                      </p>
                      {/* Google Maps link */}
                      <div className="mt-1">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00897B] dark:text-[#2DD4BF] hover:underline"
                          title="View supermarket on Google Maps"
                        >
                          <Navigation className="h-3 w-3" />
                          <span>Directions on Maps</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                        </a>
                      </div>

                      {/* Feature 1: Expected Price Drop Countdown */}
                      {drop && (
                        <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>Expected: Price drops to {drop.nextDiscountPercent}% off in {formatTimeRemaining(drop.dropsAt, nowMs)}</span>
                        </div>
                      )}
                    </div>

                    {/* Two info boxes */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="rounded-xl bg-[#F6F6F4] dark:bg-[#25302D] p-2.5">
                        <p className="text-[11px] text-[#8A847E] dark:text-[#64748B]">Quantity available</p>
                        <p className="font-bold text-xs text-[#2E221F] dark:text-[#F0F4F2] mt-0.5">{item.available} {item.unit}</p>
                      </div>
                      <div className="rounded-xl bg-[#F6F6F4] dark:bg-[#25302D] p-2.5">
                        <p className="text-[11px] text-[#8A847E] dark:text-[#64748B]">Pickup deadline</p>
                        <p className="font-bold text-xs text-[#2E221F] dark:text-[#F0F4F2] mt-0.5 flex items-center gap-1">
                          <Clock3 className="h-3 w-3 text-amber-500" />
                          <span>{item.pickupDeadline}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Price, Stepper, Add to Cart & Buy Buttons */}
                  <div className="pt-2 flex flex-col gap-2 border-t border-[#EAE6DF]/60 dark:border-[#2D3835]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-extrabold text-[#FF6548]">₹{item.currentPrice}</span>
                        {item.discountPercent > 0 && (
                          <span className="text-xs text-[#8A847E] line-through ml-1">₹{item.originalPrice}</span>
                        )}
                        <span className="text-[11px] text-[#8A847E]"> / {item.unit}</span>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center border border-[#EAE6DF] dark:border-[#2D3835] rounded-lg bg-white dark:bg-[#1F2825] overflow-hidden">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="px-2 py-1 text-xs text-[#7A746E] hover:bg-[#F5F5F3] dark:hover:bg-[#25302D] cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 py-1 text-xs font-bold text-[#2E221F] dark:text-[#F0F4F2] min-w-[20px] text-center">
                          {quantities[item.id] || 1}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="px-2 py-1 text-xs text-[#7A746E] hover:bg-[#F5F5F3] dark:hover:bg-[#25302D] cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Actions: Add to Cart + Instant Buy */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => addToCart(item, qtySelected)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#00897B] text-[#00897B] dark:text-[#2DD4BF] text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        <span>Add to Cart</span>
                      </button>
                      <button
                        onClick={() => handleBuy(item)}
                        className="w-full ss-btn-coral py-2 text-xs font-semibold shadow-sm cursor-pointer"
                      >
                        Instant Pass
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Cart Modal / Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1C2523] border border-[#EAE6DF] dark:border-[#2D3835] shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE6DF] dark:border-[#2D3835]">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 dark:bg-emerald-950 text-[#00897B] dark:text-[#2DD4BF]">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#2E221F] dark:text-[#F0F4F2]">Your Food Rescue Cart</h3>
                  <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">{cart.length} item(s) selected</p>
                </div>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1.5 rounded-lg text-[#8A847E] hover:bg-[#F5F5F3] dark:hover:bg-[#25302D] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <ShoppingCart className="h-10 w-10 text-[#A3B2AC] mx-auto" />
                <p className="text-sm font-semibold text-[#554F4A] dark:text-[#CBD5E1]">Your cart is empty</p>
                <p className="text-xs text-[#8A847E]">Browse surplus items above and tap "Add to Cart".</p>
              </div>
            ) : (
              <>
                <div className="max-h-60 overflow-y-auto space-y-2.5 divide-y divide-[#EAE6DF]/60 dark:divide-[#2D3835]">
                  {cart.map(({ item, qty }) => (
                    <div key={item.id} className="pt-2 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs text-[#2E221F] dark:text-[#F0F4F2] truncate">{item.name}</p>
                        <p className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC]">
                          {item.store} • ₹{item.currentPrice}/{item.unit}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-[#EAE6DF] dark:border-[#2D3835] rounded-md overflow-hidden text-xs">
                          <button
                            onClick={() => {
                              if (qty <= 1) {
                                setCart(prev => prev.filter(c => c.item.id !== item.id));
                              } else {
                                setCart(prev => prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty - 1 } : c));
                              }
                            }}
                            className="px-2 py-0.5 hover:bg-[#F5F5F3] dark:hover:bg-[#25302D]"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2 py-0.5 font-bold">{qty}</span>
                          <button
                            onClick={() => {
                              setCart(prev => prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c));
                            }}
                            className="px-2 py-0.5 hover:bg-[#F5F5F3] dark:hover:bg-[#25302D]"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-xs font-bold text-[#FF6548] min-w-[50px] text-right">
                          ₹{item.currentPrice * qty}
                        </span>
                        <button
                          onClick={() => setCart(prev => prev.filter(c => c.item.id !== item.id))}
                          className="p-1 text-[#8A847E] hover:text-red-500 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-[#EAE6DF] dark:border-[#2D3835] space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#7A746E] dark:text-[#A3B2AC]">Total payable at pickup</span>
                    <span className="font-extrabold text-lg text-[#FF6548]">₹{cartTotal}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => setCart([])}
                      className="py-2.5 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] text-xs font-semibold text-[#7A746E] hover:bg-[#F5F5F3] dark:hover:bg-[#25302D] cursor-pointer"
                    >
                      Clear Cart
                    </button>
                    <button
                      onClick={checkoutCart}
                      className="py-2.5 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Reserve All & Get Passes</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {detailItem && (
        <ProductDetailModal
          item={detailItem}
          isOpen={true}
          onClose={() => setDetailItem(null)}
          onReserve={(it, q) => {
            const order = addReservation(it, q, settings.name, settings.userLocation, settings.email);
            onAction(`Reserved ${q} ${it.unit} of ${it.name}!`, "success");
            setSelectedReceipt(order);
          }}
          onWatch={(it) => {
            setWatchPrefill({
              keyword: it.name,
              category: it.category,
              maxPrice: it.currentPrice,
            });
            setWatchlistOpen(true);
          }}
        />
      )}

      <WatchlistModal
        isOpen={watchlistOpen}
        onClose={() => { setWatchlistOpen(false); setWatchPrefill(null); }}
        initialKeyword={watchPrefill?.keyword}
        initialCategory={watchPrefill?.category}
        initialMaxPrice={watchPrefill?.maxPrice}
        onAction={onAction}
      />

      {selectedReceipt && (
        <ReceiptModal
          order={selectedReceipt}
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMER & NGO WORKSPACE: ACTIVE QR PASSES
// -------------------------------------------------------------
function NgoActivePasses() {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [orders, setOrders] = useState<StoreOrder[]>(() => loadMyOrders(loadSettings().email));
  const [selectedReceipt, setSelectedReceipt] = useState<StoreOrder | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      const s = loadSettings();
      setSettings(s);
      setOrders(loadMyOrders(s.email));
    };
    window.addEventListener("ss_orders_updated", handleUpdate);
    window.addEventListener("ss_settings_updated", handleUpdate);
    return () => {
      window.removeEventListener("ss_orders_updated", handleUpdate);
      window.removeEventListener("ss_settings_updated", handleUpdate);
    };
  }, []);

  const activeOrders = orders.filter(o => o.status === "RESERVED");

  const handleSimulateCheckout = (passId: string) => {
    fulfillPickupOrder(passId);
  };

  const handleCancel = (id: string) => {
    cancelPickupOrder(id);
  };

  return (
    <div className="ss-reveal max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">COUNTER PICKUP PASSES</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">Active QR Pickup Passes</h1>
        <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1">Show this QR code or Pass ID at the supermarket checkout counter to complete your purchase.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {activeOrders.map(order => {
          return (
            <div key={order.id} className="ss-card p-6 bg-white dark:bg-[#1F2825] flex flex-col justify-between space-y-4 border border-[#EAE6DF] dark:border-[#2D3835]">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">Active Reservation</span>
                    <h3 className="font-bold text-lg text-[#2E221F] dark:text-[#F0F4F2] mt-0.5">{order.productName}</h3>
                    <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">{order.storeName}</p>
                  </div>
                  <span className="ss-chip badge-reserved">Reserved</span>
                </div>

                <div className="mt-4 flex items-center justify-center p-4 bg-[#FAF9F6] dark:bg-[#1A2220] rounded-xl border border-[#EAE6DF] dark:border-[#2D3835]">
                  <QRCodeSVG value={order.qrCode} size={150} level="M" />
                </div>

                <div className="mt-4 text-center">
                  <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">6-Character Pass Code</p>
                  <p className="font-mono text-2xl font-bold tracking-widest text-[#FF6548] mt-0.5">{order.qrCode}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#EAE6DF] dark:border-[#2D3835] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#7A746E] dark:text-[#A3B2AC]">Quantity</span>
                    <p className="font-bold text-[#2E221F] dark:text-[#F0F4F2] mt-0.5">{order.quantity} units</p>
                  </div>
                  <div>
                    <span className="text-[#7A746E] dark:text-[#A3B2AC]">Total to Pay</span>
                    <p className="font-bold text-[#FF6548] mt-0.5">₹{order.priceAtOrder.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#EAE6DF] dark:border-[#2D3835]">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedReceipt(order)}
                    className="ss-btn-soft flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" /> Full Voucher
                  </button>
                  <button
                    onClick={() => handleSimulateCheckout(order.qrCode)}
                    className="ss-btn-coral flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    title="Simulate store cashier scanning your pass"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Test Cashier Scan
                  </button>
                </div>
                <button
                  onClick={() => handleCancel(order.id)}
                  className="w-full text-center text-[11px] text-[#8A847E] hover:text-[#FF6548] cursor-pointer pt-1"
                >
                  Cancel reservation & return stock
                </button>
              </div>
            </div>
          );
        })}

        {activeOrders.length === 0 && (
          <div className="col-span-2 ss-card py-16 text-center bg-white dark:bg-[#1F2825]">
            <QrCode className="mx-auto h-12 w-12 text-[#B0A9A0]" />
            <h3 className="mt-4 font-bold text-lg text-[#2E221F] dark:text-[#F0F4F2]">No Active Reservations</h3>
            <p className="mt-1 text-xs text-[#7A746E] dark:text-[#A3B2AC] max-w-sm mx-auto">
              You don't have any pending pickup passes right now. Browse available food to reserve items and get your instant QR pass!
            </p>
            <Link href="/ngo/available-food" className="ss-btn-coral inline-flex items-center gap-2 mt-5 px-5 py-2.5 text-xs font-semibold cursor-pointer">
              Browse Available Food <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {selectedReceipt && (
        <ReceiptModal
          order={selectedReceipt}
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// CUSTOMER & NGO WORKSPACE: ORDER HISTORY (My Orders)
// -------------------------------------------------------------
function NgoHistory() {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [orders, setOrders] = useState<StoreOrder[]>(() => loadMyOrders(loadSettings().email));
  const [filter, setFilter] = useState<"ALL" | "RESERVED" | "FULFILLED" | "CANCELLED">("ALL");
  const [search, setSearch] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<StoreOrder | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      const s = loadSettings();
      setSettings(s);
      setOrders(loadMyOrders(s.email));
    };
    window.addEventListener("ss_orders_updated", handleUpdate);
    window.addEventListener("ss_settings_updated", handleUpdate);
    return () => {
      window.removeEventListener("ss_orders_updated", handleUpdate);
      window.removeEventListener("ss_settings_updated", handleUpdate);
    };
  }, []);

  const filtered = orders.filter(o => {
    const matchFilter = filter === "ALL" || o.status === filter;
    const matchSearch = o.productName.toLowerCase().includes(search.toLowerCase()) || o.qrCode.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="ss-reveal max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">RECEIPTS & RECORDS</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">My Orders & Receipts</h1>
          <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1">A chronological history of all your reservations, checkout passes, and fulfilled collections.</p>
        </div>
      </div>

      {/* Search and Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["ALL", "FULFILLED", "RESERVED", "CANCELLED"] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${filter === st
                ? "bg-[#2D2320] dark:bg-white text-white dark:text-[#2D2320] shadow-sm"
                : "bg-white dark:bg-[#1F2825] text-[#7A746E] dark:text-[#A3B2AC] border border-[#EAE6DF] dark:border-[#2D3835]"
                }`}
            >
              {st === "ALL" ? "All Orders" : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8A847E]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by pass or product..."
            className="ss-input text-xs pl-8 py-1.5"
          />
        </div>
      </div>

      <div className="ss-card overflow-hidden bg-white dark:bg-[#1F2825] border border-[#EAE6DF] dark:border-[#2D3835]">
        <div className="ss-table-wrap">
          <table className="ss-table w-full text-sm">
            <thead>
              <tr>
                <th>PASS ID</th>
                <th>PRODUCE ITEM</th>
                <th>STORE</th>
                <th>QUANTITY</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th>DATE & TIME</th>
                <th className="text-right">RECEIPT</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-[#FAF8F5] dark:hover:bg-[#25302D]">
                  <td>
                    <span className="font-mono text-xs font-bold bg-[#F5F5F3] dark:bg-[#25302D] px-2 py-1 rounded border border-[#EAE6DF] dark:border-[#2D3835]">
                      {order.qrCode}
                    </span>
                  </td>
                  <td>
                    <p className="font-bold text-[#2E221F] dark:text-[#F0F4F2]">{order.productName}</p>
                  </td>
                  <td className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">{order.storeName}</td>
                  <td className="font-semibold text-[#2E221F] dark:text-[#F0F4F2]">{order.quantity} units</td>
                  <td className="font-semibold text-[#FF6548]">₹{order.priceAtOrder.toFixed(2)}</td>
                  <td>
                    <StatusBadge label={order.status === "FULFILLED" ? "Confirmed" : order.status} />
                  </td>
                  <td className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">
                    {new Date(order.reservedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => setSelectedReceipt(order)}
                      className="ss-btn-soft px-2.5 py-1 text-xs cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" /> View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-[#7A746E] dark:text-[#A3B2AC]">
                    No orders found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedReceipt && (
        <ReceiptModal
          order={selectedReceipt}
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// NOTIFICATIONS PAGE
// -------------------------------------------------------------
function NotificationsPage() {
  const [, setLocation] = useLocation();
  const [notifs, setNotifs] = useState<AppNotification[]>(loadNotifications);
  const [filter, setFilter] = useState<"ALL" | "WATCHLIST" | "ORDER" | "DISCOUNT" | "SYSTEM">("ALL");

  useEffect(() => {
    const handleUpdate = () => setNotifs(loadNotifications());
    window.addEventListener("ss_notifs_updated", handleUpdate);

    // Fetch live notifications from server (including WATCHLIST notifications)
    getNotifications()
      .then((serverNotifs) => {
        if (Array.isArray(serverNotifs) && serverNotifs.length > 0) {
          const current = loadNotifications();
          const existingIds = new Set(current.map(n => n.id));
          const newNotifs: AppNotification[] = [];
          serverNotifs.forEach(sn => {
            if (!existingIds.has(sn.id)) {
              newNotifs.push({
                id: sn.id,
                title: sn.type === "WATCHLIST" ? "Watchlist Price Alert" : sn.type.replace(/_/g, " "),
                message: sn.message,
                type: sn.type === "WATCHLIST" ? "WATCHLIST" : (sn.type.includes("ORDER") ? "ORDER" : sn.type.includes("DISCOUNT") || sn.type.includes("PRICE") ? "DISCOUNT" : "SYSTEM"),
                read: sn.read,
                createdAt: sn.createdAt,
                link: "/ngo/available-food",
              });
            }
          });
          if (newNotifs.length > 0) {
            saveNotifications([...newNotifs, ...current]);
          }
        }
      })
      .catch(() => { });

    return () => window.removeEventListener("ss_notifs_updated", handleUpdate);
  }, []);

  const handleMarkAllRead = () => {
    const updated = notifs.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const handleClearAll = () => {
    saveNotifications([]);
  };

  const handleItemClick = (n: AppNotification) => {
    const updated = notifs.map(item => item.id === n.id ? { ...item, read: true } : item);
    saveNotifications(updated);
    if (n.link) setLocation(n.link);
  };

  const filtered = notifs.filter(n => filter === "ALL" || n.type === filter);

  return (
    <div className="ss-reveal max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00897B] dark:text-[#2DD4BF]">UPDATES & ALERTS</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">Notifications</h1>
          <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1">Real-time alerts for customer reservations, AI freshness analyses, and watchlist price cuts.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleMarkAllRead}
            className="ss-btn-soft px-3 py-1.5 text-xs font-semibold cursor-pointer"
          >
            Mark all read
          </button>
          <button
            onClick={handleClearAll}
            className="text-xs text-[#FF6548] font-semibold hover:underline px-2 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "WATCHLIST", "ORDER", "DISCOUNT", "SYSTEM"] as const).map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${filter === type
              ? "bg-[#2D2320] dark:bg-white text-white dark:text-[#2D2320] shadow-sm"
              : "bg-white dark:bg-[#1F2825] text-[#7A746E] dark:text-[#A3B2AC] border border-[#EAE6DF] dark:border-[#2D3835]"
              }`}
          >
            {type === "ALL" ? "All Alerts" : type === "WATCHLIST" ? "🎯 Watchlist" : type.charAt(0) + type.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="ss-card p-4 space-y-3 bg-white dark:bg-[#1F2825]">
        {filtered.map(n => (
          <div
            key={n.id}
            onClick={() => handleItemClick(n)}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${n.read
              ? "border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] opacity-80"
              : n.type === "WATCHLIST"
                ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                : "border-[#FF6548]/30 bg-[#FFF9F7] dark:bg-[#2A1D1A]"
              }`}
          >
            <div className={`grid h-8 w-8 place-items-center rounded-lg shrink-0 ${n.type === "WATCHLIST"
              ? "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300"
              : n.type === "DISCOUNT"
                ? "bg-[#FEECE8] text-[#FF6548]"
                : "bg-[#E6F8F3] text-[#00897B]"
              }`}>
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-[#2E221F] dark:text-[#F0F4F2]">{n.title}</p>
                  {n.type === "WATCHLIST" && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                      WATCHLIST
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#8A847E] dark:text-[#64748B]">
                  {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-xs text-[#554F4A] dark:text-[#CBD5E1] mt-0.5">{n.message}</p>
              {n.link && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#00897B] dark:text-[#2DD4BF] font-semibold mt-2 hover:underline">
                  View details <ExternalLink className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-xs text-[#7A746E] dark:text-[#A3B2AC]">No notifications found.</div>
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("profile");
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (message: string, kind: ToastKind = "success") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3000);
  };

  const openSettings = (tab: SettingsTab = "profile") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const type = location.split("/").filter(Boolean).slice(1).join("/") || "overview";

  const renderPage = () => {
    if (role === "supermarket") {
      if (type === "overview") return <DashboardHome onAction={notify} />;
      if (type === "inventory") return <InventoryPage onAction={notify} onOpenSettings={openSettings} />;
      if (type === "detection") return <DetectionPage onAction={notify} />;
      if (type === "surplus") return <SurplusPage onAction={notify} />;
      if (type === "verification") return <VerificationPage onAction={notify} />;
      if (type === "map") return <LiveMapView />;
      if (type === "impact") return <ImpactPage />;
      if (type === "notifications") return <NotificationsPage />;
      return <DashboardHome onAction={notify} />;
    }

    if (role === "ngo") {
      if (type === "overview") return <NgoOverview onAction={notify} onOpenSettings={openSettings} />;
      if (type === "available-food" || type === "browse") return <NgoAvailableFood onAction={notify} onOpenSettings={openSettings} />;
      if (type === "history" || type === "my-orders") return <NgoHistory />;
      if (type === "active" || type === "my-pickups") return <NgoActivePasses />;
      if (type === "map") return <LiveMapView />;
      if (type === "impact") return <ImpactPage />;
      if (type === "notifications") return <NotificationsPage />;
      return <NgoOverview onAction={notify} onOpenSettings={openSettings} />;
    }

    return <DashboardHome onAction={notify} />;
  };

  return (
    <div className="ss-shell flex min-h-[100dvh]">
      <Sidebar role={role} path={location} onNavigate={() => setToast(null)} onOpenSettings={() => openSettings("profile")} />
      <div className="min-w-0 flex-1 flex flex-col">
        <MobileNav role={role} path={location} onNavigate={() => setToast(null)} onOpenSettings={() => openSettings("profile")} />
        <Topbar role={role} path={location} onOpenLocation={() => openSettings("location")} />
        <main className="flex-1 px-6 py-8 lg:px-10">
          {renderPage()}
        </main>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={msg => notify(msg)}
        initialTab={settingsTab}
      />
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
