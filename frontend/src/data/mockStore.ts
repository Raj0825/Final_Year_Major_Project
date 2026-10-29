// frontend/src/data/mockStore.ts
// Unified Reactive Data Store for FreshRescue / Smart Surplus
// Dynamic multi-store support, proximity calculation, zero-fake clean state
import api from "../api/client";

export interface RegisteredStore {
  id: string;
  name: string;
  location: string; // Street / landmark address
  area: string;     // Area / neighborhood
  city: string;     // City name for geographic matching
  phone?: string;
  managerName?: string;
  joinedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: "Dairy" | "Vegetables" | "Fruit" | "Bakery" | "Staples";
  available: number;
  unit: string;
  originalPrice: number;
  currentPrice: number;
  discountPercent: number;
  status: "Available" | "Expiring soon" | "Reserved";
  expiry: string;
  expiryDate?: string;       // ISO date string yyyy-mm-dd
  expiryHoursLeft: number;
  pickupDeadline: string;
  flagged: boolean;
  storeId?: string;
  store: string;
  storeLocation?: string;
  storeArea?: string;
  storeCity?: string;      // City of the store that listed this item
  distance: string;
  freshnessScore: number;
  storageTip?: string;
}

export interface StoreOrder {
  id: string;
  listingId: string;
  storeId?: string;
  productName: string;
  storeName: string;
  storeLocation?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerLocation?: string;
  quantity: number;
  unit: string;
  priceAtOrder: number;
  status: "RESERVED" | "FULFILLED" | "CANCELLED";
  reservedAt: string;
  pickupTime: string;
  qrCode: string;
  notes?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "ORDER" | "EXPIRY" | "DISCOUNT" | "SYSTEM";
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface UserSettings {
  name: string;
  email: string;
  role: "supermarket" | "ngo";
  storeId?: string;
  storeName: string;
  storeLocation: string;
  storeArea: string;
  storeCity: string;       // City where the store is located
  storePhone?: string;
  userLocation: string;
  selectedArea: string;
  userCity: string;        // City where the user/customer lives
  searchRadiusKm: number;
  holdMinutes: number;
  emailAlerts: boolean;
  smsAlerts: boolean;
  soundEnabled: boolean;
  gpsLat?: number;      // Last GPS latitude from browser geolocation
  gpsLng?: number;      // Last GPS longitude from browser geolocation
  favoriteStores?: string[];  // Array of store names marked as favorite
}

export const DEFAULT_SETTINGS: UserSettings = {
  name: "Store Manager",
  email: "store@freshrescue.org",
  role: "supermarket",
  storeId: "",
  storeName: "",
  storeLocation: "",
  storeArea: "",
  storeCity: "",
  storePhone: "",
  userLocation: "",
  selectedArea: "",
  userCity: "",
  searchRadiusKm: 10,
  holdMinutes: 15,
  emailAlerts: true,
  smsAlerts: false,
  soundEnabled: true,
};

// Pure clean default collections — ZERO fake listings
export const DEFAULT_INVENTORY: InventoryItem[] = [];
export const DEFAULT_ORDERS: StoreOrder[] = [];
export const DEFAULT_NOTIFICATIONS: AppNotification[] = [];
export const DEFAULT_STORES: RegisteredStore[] = [];

// Storage Keys (v4 clean slate)
const STORAGE_KEYS = {
  INVENTORY: "ss_inventory_v4",      // GLOBAL — shared across all users
  ORDERS: "ss_orders_v4",            // GLOBAL — shared across all users
  NOTIFS: "ss_notifs_v4",            // GLOBAL — shared across all users
  STORES: "ss_stores_v4",            // GLOBAL — shared across all users
  CURRENT_EMAIL: "ss_current_email", // which user is active right now
  INITIALIZED: "ss_v4_clean_slate_done"
};

// Returns the per-user settings localStorage key for the given email
function settingsKeyForEmail(email: string): string {
  return `ss_settings_v4_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

// Get the email of the currently logged-in user
export function getCurrentUserEmail(): string {
  try {
    const email = localStorage.getItem(STORAGE_KEYS.CURRENT_EMAIL);
    if (email && email.trim()) return email.toLowerCase().trim();
    const rawUser = localStorage.getItem("fr_user");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u.email && typeof u.email === "string" && u.email.trim()) {
        const e = u.email.toLowerCase().trim();
        localStorage.setItem(STORAGE_KEYS.CURRENT_EMAIL, e);
        return e;
      }
    }
  } catch {}
  return "";
}

export function setCurrentUserEmail(email: string) {
  if (email && email.trim()) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_EMAIL, email.toLowerCase().trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_EMAIL);
  }
}

// Purge obsolete mock data from legacy sessions
(() => {
  try {
    if (!localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
      // Remove all legacy mock keys containing hardcoded sample items
      localStorage.removeItem("ss_inventory_v3");
      localStorage.removeItem("ss_orders_v3");
      localStorage.removeItem("ss_notifs_v3");
      localStorage.removeItem("ss_settings_v3");
      localStorage.removeItem("ss_inventory");
      localStorage.removeItem("ss_orders");
      localStorage.removeItem("ss_notifications");
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, "true");
    }
  } catch {}
})();

// Auto-migrate and clean up obsolete test data and store duplicates
(() => {
  try {
    const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("fr_token");
    const MIGRATION_KEY = "freshrescue_migration_clean_stores_v3";
    if (!localStorage.getItem(MIGRATION_KEY)) {
      localStorage.setItem(MIGRATION_KEY, "true");

      // 1. Clean up stores: remove duplicate 'store-default' or 'City Supermarket'
      const rawStores = localStorage.getItem(STORAGE_KEYS.STORES);
      if (rawStores) {
        const stores: RegisteredStore[] = JSON.parse(rawStores);
        if (Array.isArray(stores)) {
          const cleanedStores = stores.filter(s => {
            if (!s || !s.name) return false;
            const n = s.name.toLowerCase().trim();
            if (n === "city supermarket") {
              if (hasToken) api.delete(`/cloud-sync/stores/${s.id}`).catch(() => {});
              return false;
            }
            if (s.id === "store-default") {
              if (hasToken) api.delete(`/cloud-sync/stores/${s.id}`).catch(() => {});
              return false;
            }
            return true;
          });
          localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(cleanedStores));
          if (hasToken) api.put("/cloud-sync/stores/sync", cleanedStores).catch(() => {});
        }
      }

      // 2. Clean up inventory: remove test apple from City Supermarket and normalize Banana to Rajesh Kirana store
      const rawInv = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      if (rawInv) {
        const inv: InventoryItem[] = JSON.parse(rawInv);
        if (Array.isArray(inv)) {
          const cleanedInv = inv.filter(item => {
            if (!item || !item.name) return false;
            if (item.id === "inv-1792928404400" || (item.store && item.store.toLowerCase().includes("city supermarket"))) {
              if (hasToken) api.delete(`/cloud-sync/inventory/${item.id}`).catch(() => {});
              return false;
            }
            return true;
          }).map(item => {
            if (item.store && item.store.toLowerCase().includes("rajesh kirna")) {
              return {
                ...item,
                store: "Rajesh Kirana store",
                storeId: "6adefee06aaf854704c87d53",
                storeLocation: "near Ashok chowk",
                storeArea: "ashowk chowk",
                storeCity: "Solapur"
              };
            }
            return item;
          });
          localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(cleanedInv));
          if (hasToken) api.put("/cloud-sync/inventory/sync", cleanedInv).catch(() => {});
        }
      }
      window.dispatchEvent(new Event("ss_stores_updated"));
      window.dispatchEvent(new Event("ss_inventory_updated"));
    }
  } catch {}
})();

// Geographic and Distance Calculation Engine (Haversine Algorithm & Multi-City Boundary)

export interface LatLng {
  lat: number;
  lng: number;
}

// Known coordinates for Indian cities
export const CITY_COORDINATES: Record<string, LatLng> = {
  solapur: { lat: 17.6599, lng: 75.9064 },
  sholapur: { lat: 17.6599, lng: 75.9064 },
  pune: { lat: 18.5204, lng: 73.8567 },
  mumbai: { lat: 19.0760, lng: 72.8777 },
  bombay: { lat: 19.0760, lng: 72.8777 },
  delhi: { lat: 28.6139, lng: 77.2090 },
  "new delhi": { lat: 28.6139, lng: 77.2090 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  madras: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  calcutta: { lat: 22.5726, lng: 88.3639 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  surat: { lat: 21.1702, lng: 72.8311 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  nashik: { lat: 19.9975, lng: 73.7898 },
  aurangabad: { lat: 19.8762, lng: 75.3433 },
  "chhatrapati sambhajinagar": { lat: 19.8762, lng: 75.3433 },
  kolhapur: { lat: 16.7050, lng: 74.2433 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  indore: { lat: 22.7196, lng: 75.8577 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  noida: { lat: 28.5355, lng: 77.3910 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  navi_mumbai: { lat: 19.0330, lng: 73.0297 },
  thane: { lat: 19.2183, lng: 72.9781 }
};

// Known coordinates for popular neighborhoods and landmarks
export const AREA_COORDINATES: Record<string, LatLng> = {
  // Solapur areas
  "ashok chowk": { lat: 17.6650, lng: 75.9120 },
  "ashok chowk solapur": { lat: 17.6650, lng: 75.9120 },
  "ashowk chowk": { lat: 17.6650, lng: 75.9120 },
  "navi peth": { lat: 17.6710, lng: 75.9010 },
  "jule solapur": { lat: 17.6420, lng: 75.9180 },
  "saat rasta": { lat: 17.6610, lng: 75.9030 },
  "market yard solapur": { lat: 17.6750, lng: 75.9200 },
  "hotgi road": { lat: 17.6320, lng: 75.9280 },
  "solapur station": { lat: 17.6695, lng: 75.9040 },

  // Pune areas
  kothrud: { lat: 18.5074, lng: 73.8077 },
  "shivaji nagar": { lat: 18.5314, lng: 73.8446 },
  "viman nagar": { lat: 18.5679, lng: 73.9143 },
  hinjewadi: { lat: 18.5913, lng: 73.7389 },
  baner: { lat: 18.5590, lng: 73.7868 },
  hadapsar: { lat: 18.5089, lng: 73.9260 },
  camp: { lat: 18.5170, lng: 73.8780 },
  swargate: { lat: 18.5018, lng: 73.8586 },
  deccan: { lat: 18.5174, lng: 73.8415 },
  magarpatta: { lat: 18.5158, lng: 73.9272 },
  wakad: { lat: 18.5987, lng: 73.7660 },
  pimpri: { lat: 18.6279, lng: 73.7997 },
  chinchwad: { lat: 18.6445, lng: 73.8000 },
  "paud road": { lat: 18.5080, lng: 73.8010 },
  "central market": { lat: 18.5180, lng: 73.8540 },

  // Mumbai areas
  andheri: { lat: 19.1136, lng: 72.8697 },
  bandra: { lat: 19.0596, lng: 72.8295 },
  dadar: { lat: 19.0178, lng: 72.8478 },
  colaba: { lat: 18.9067, lng: 72.8147 },
  borivali: { lat: 19.2307, lng: 72.8567 },
  juhu: { lat: 19.1075, lng: 72.8263 },
  powai: { lat: 19.1176, lng: 72.9060 },
  kurla: { lat: 19.0726, lng: 72.8845 },
  malad: { lat: 19.1874, lng: 72.8484 },

  // Delhi areas
  "connaught place": { lat: 28.6315, lng: 77.2167 },
  "south extension": { lat: 28.5714, lng: 77.2215 },
  "karol bagh": { lat: 28.6514, lng: 77.1907 },
  rohini: { lat: 28.7495, lng: 77.0565 },
  "hauz khas": { lat: 28.5494, lng: 77.2001 },
  dwarka: { lat: 28.5921, lng: 77.0460 },
  "chandni chowk": { lat: 28.6506, lng: 77.2303 },
  "lajpat nagar": { lat: 28.5700, lng: 77.2400 },

  // Bangalore areas
  koramangala: { lat: 12.9352, lng: 77.6245 },
  indiranagar: { lat: 12.9784, lng: 77.6408 },
  "hsr layout": { lat: 12.9121, lng: 77.6446 },
  whitefield: { lat: 12.9698, lng: 77.7500 },
  jayanagar: { lat: 12.9308, lng: 77.5838 },
  "electronic city": { lat: 12.8452, lng: 77.6602 },
  malleswaram: { lat: 13.0031, lng: 77.5643 },
  "mg road": { lat: 12.9756, lng: 77.6066 },
  "btm layout": { lat: 12.9166, lng: 77.6101 }
};

/**
 * Normalizes city name and checks equality with support for common aliases.
 */
export function isSameCity(city1?: string, city2?: string): boolean {
  if (!city1 || !city2) return false;
  const c1 = city1.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const c2 = city2.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;

  const aliases: Record<string, string[]> = {
    bengaluru: ["bangalore"],
    bangalore: ["bengaluru"],
    mumbai: ["bombay"],
    bombay: ["mumbai"],
    kolkata: ["calcutta"],
    calcutta: ["kolkata"],
    chennai: ["madras"],
    madras: ["chennai"],
    gurugram: ["gurgaon"],
    gurgaon: ["gurugram"],
    solapur: ["sholapur"],
    sholapur: ["solapur"],
    delhi: ["newdelhi"],
    newdelhi: ["delhi"]
  };

  if (aliases[c1]?.includes(c2) || aliases[c2]?.includes(c1)) {
    return true;
  }
  return false;
}

/**
 * Mathematical Haversine Distance Formula.
 * Calculates Great-Circle distance between two latitude/longitude points on Earth.
 * Returns distance in kilometers (rounded to 1 decimal place).
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's mean radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Resolves geographical coordinates for a city, area, or address.
 * Uses exact GPS if provided, or resolves from known database with deterministic sub-city offsets.
 */
export function resolveCoordinates(
  city?: string,
  area?: string,
  address?: string,
  directCoords?: { lat?: number; lng?: number }
): LatLng {
  if (directCoords && typeof directCoords.lat === "number" && typeof directCoords.lng === "number" && !isNaN(directCoords.lat)) {
    return { lat: directCoords.lat, lng: directCoords.lng };
  }

  const cleanArea = (area || "").trim().toLowerCase();
  const cleanAddr = (address || "").trim().toLowerCase();
  const cleanCity = (city || "").trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");

  // 1. Direct Area Match
  for (const [key, coords] of Object.entries(AREA_COORDINATES)) {
    if (cleanArea === key || cleanAddr.includes(key) || cleanArea.includes(key)) {
      return coords;
    }
  }

  // 2. City Center Match
  let baseCoords: LatLng | null = null;
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (cleanCity === key || cleanCity.includes(key) || key.includes(cleanCity)) {
      baseCoords = coords;
      break;
    }
  }

  if (!baseCoords) {
    // Default base for unknown city: deterministic center so distances within this city make sense
    let cityHash = 0;
    const s = cleanCity || "default_city";
    for (let i = 0; i < s.length; i++) {
      cityHash = (cityHash << 5) - cityHash + s.charCodeAt(i);
      cityHash |= 0;
    }
    const latOffset = ((Math.abs(cityHash) % 1000) - 500) / 100;
    const lngOffset = ((Math.abs(cityHash >> 3) % 1000) - 500) / 100;
    baseCoords = { lat: 20.5937 + latOffset, lng: 78.9629 + lngOffset };
  }

  // Apply deterministic micro-offset for neighborhood/street within the city (0.4 km - 3.5 km radius)
  let subHash = 0;
  const subStr = `${cleanArea}::${cleanAddr}`;
  for (let i = 0; i < subStr.length; i++) {
    subHash = (subHash << 5) - subHash + subStr.charCodeAt(i);
    subHash |= 0;
  }
  const deltaLat = ((Math.abs(subHash) % 40) - 20) / 1000; // ~1-2 km
  const deltaLng = ((Math.abs(subHash >> 2) % 40) - 20) / 1000;

  return {
    lat: baseCoords.lat + deltaLat,
    lng: baseCoords.lng + deltaLng
  };
}

export interface DistanceResult {
  km: number;
  display: string;
  sameCity: boolean;
}

/**
 * Robust Distance Calculation Algorithm.
 * 1. Checks City Boundary: If user and store are in different cities, returns sameCity = false and Infinity km.
 * 2. Uses Haversine Formula for exact geographic distance calculation within the same city.
 */
export function calculateDistance(
  userLocOrArea: string,
  storeLocOrArea: string,
  userCity?: string,
  storeCity?: string,
  userDirectCoords?: { lat?: number; lng?: number },
  storeDirectCoords?: { lat?: number; lng?: number }
): DistanceResult {
  // Try extracting cities from user settings or store cache if not passed directly
  let effectiveUserCity = (userCity || "").trim();
  let effectiveStoreCity = (storeCity || "").trim();

  if (!effectiveUserCity) {
    try {
      const s = loadSettings();
      effectiveUserCity = (s.userCity || s.storeCity || "").trim();
    } catch {}
  }

  if (!effectiveStoreCity) {
    try {
      const stores = loadStores();
      const norm = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
      const storeNorm = norm(storeLocOrArea || "");
      const matched = stores.find(st => norm(st.name) === storeNorm || norm(st.location).includes(storeNorm));
      if (matched?.city) effectiveStoreCity = matched.city;
    } catch {}
  }

  // Multi-City Isolation Check: If both cities are present and do not match, hide/infinite
  if (effectiveUserCity && effectiveStoreCity && !isSameCity(effectiveUserCity, effectiveStoreCity)) {
    return {
      km: Infinity,
      display: "Different City",
      sameCity: false
    };
  }

  const u = (userLocOrArea || "").trim().toLowerCase();
  const s = (storeLocOrArea || "").trim().toLowerCase();

  // If exact match or one contains the other
  if (u && s && (u === s || u.includes(s) || s.includes(u))) {
    return { km: 0.6, display: "0.6 km", sameCity: true };
  }

  // Resolve coordinates
  const userCoords = resolveCoordinates(effectiveUserCity, userLocOrArea, userLocOrArea, userDirectCoords);
  const storeCoords = resolveCoordinates(effectiveStoreCity, storeLocOrArea, storeLocOrArea, storeDirectCoords);

  // Compute Haversine distance
  const rawDist = haversineDistanceKm(userCoords.lat, userCoords.lng, storeCoords.lat, storeCoords.lng);
  const kmVal = Math.max(0.4, rawDist);
  const rounded = Math.round(kmVal * 10) / 10;

  return {
    km: rounded,
    display: `${rounded} km`,
    sameCity: true
  };
}

// Stores Management
export function loadStores(): RegisteredStore[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STORES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const seen = new Map<string, RegisteredStore>();
        const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace("kirna", "kirana");
        for (const store of parsed) {
          if (!store || !store.name) continue;
          if (store.name.toLowerCase().trim() === "city supermarket") continue;
          const k = normKey(store.name);
          if (seen.has(k)) {
            const ex = seen.get(k)!;
            if (ex.id === "store-default" && store.id !== "store-default") {
              seen.set(k, { ...ex, ...store });
            }
          } else {
            seen.set(k, store);
          }
        }
        return Array.from(seen.values());
      }
    }
  } catch {}
  return [];
}

export function saveStores(stores: RegisteredStore[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(stores));
    window.dispatchEvent(new Event("ss_stores_updated"));
  } catch {}
  if (typeof localStorage !== "undefined" && localStorage.getItem("fr_token")) {
    const settings = loadSettings();
    if (settings.role === "supermarket" && settings.storeId && settings.storeId !== "store-default") {
      const myStores = stores.filter(s => s.id === settings.storeId);
      if (myStores.length > 0) {
        api.put("/cloud-sync/stores/sync", myStores).catch(() => {});
      }
    }
  }
}

export function deleteStore(id: string) {
  const stores = loadStores().filter(s => s.id !== id);
  saveStores(stores);
  if (typeof localStorage !== "undefined" && localStorage.getItem("fr_token")) {
    api.delete(`/cloud-sync/stores/${id}`).catch(() => {});
  }
}

export function upsertStore(data: Partial<RegisteredStore> & { name: string; location: string }): RegisteredStore {
  const stores = loadStores();
  const cleanName = data.name ? data.name.trim() : "";
  if (!cleanName || cleanName === "My Store") {
    return {
      id: data.id || "store-temp",
      name: cleanName || "My Store",
      location: data.location || "",
      area: data.area || "",
      city: data.city || "",
      phone: data.phone || "",
      managerName: data.managerName || "",
      joinedAt: new Date().toISOString()
    };
  }

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace("kirna", "kirana");
  const cleanNorm = norm(cleanName);

  const existingIdx = stores.findIndex(
    s => norm(s.name) === cleanNorm || (data.id && data.id !== "store-default" && s.id === data.id)
  );

  const targetId = existingIdx !== -1 && stores[existingIdx].id !== "store-default"
    ? stores[existingIdx].id
    : (data.id && data.id !== "store-default" ? data.id : `store-${Date.now()}`);

  const updatedRecord: RegisteredStore = {
    id: targetId,
    name: cleanName,
    location: data.location ? data.location.trim() : (existingIdx !== -1 ? stores[existingIdx].location : ""),
    area: data.area ? data.area.trim() : (existingIdx !== -1 ? stores[existingIdx].area : "Central Market"),
    city: data.city ? data.city.trim() : (existingIdx !== -1 ? stores[existingIdx].city : ""),
    phone: data.phone || (existingIdx !== -1 ? stores[existingIdx].phone : ""),
    managerName: data.managerName || (existingIdx !== -1 ? stores[existingIdx].managerName : "Store Manager"),
    joinedAt: data.joinedAt || (existingIdx !== -1 ? stores[existingIdx].joinedAt : new Date().toISOString())
  };

  let nextStores: RegisteredStore[];
  if (existingIdx !== -1) {
    nextStores = [...stores];
    nextStores[existingIdx] = { ...nextStores[existingIdx], ...updatedRecord };
  } else {
    nextStores = [updatedRecord, ...stores];
  }

  saveStores(nextStores);

  // Keep inventory items listed by this store in sync with updated location, area, and city
  try {
    const rawInv = localStorage.getItem(STORAGE_KEYS.INVENTORY);
    if (rawInv) {
      const items: InventoryItem[] = JSON.parse(rawInv);
      if (Array.isArray(items)) {
        let changed = false;
        const updated = items.map(it => {
          if (it.storeId === targetId || norm(it.store || "") === cleanNorm) {
            changed = true;
            return {
              ...it,
              store: cleanName,
              storeLocation: updatedRecord.location,
              storeArea: updatedRecord.area,
              storeCity: updatedRecord.city
            };
          }
          return it;
        });
        if (changed) {
          localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(updated));
          window.dispatchEvent(new Event("ss_inventory_updated"));
          if (typeof localStorage !== "undefined" && localStorage.getItem("fr_token")) {
            const myItems = updated.filter(i => i.storeId === targetId);
            if (myItems.length > 0) {
              api.put("/cloud-sync/inventory/sync", myItems).catch(() => {});
            }
          }
        }
      }
    }
  } catch {}

  return updatedRecord;
}

// Helper to determine if an inventory item belongs to a specific store
export function isItemForStore(item: InventoryItem, storeId?: string, storeName?: string): boolean {
  if (!item) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace("kirna", "kirana");
  const sName = norm(storeName || "");
  if (sName && item.store) {
    return norm(item.store) === sName;
  }
  if (storeId && storeId !== "store-default" && item.storeId && item.storeId !== "store-default") {
    return item.storeId === storeId;
  }
  return false;
}

export function deleteInventoryItem(id: string) {
  const current = loadInventory().filter(i => i.id !== id);
  saveInventory(current);
  if (typeof localStorage !== "undefined" && localStorage.getItem("fr_token")) {
    api.delete(`/cloud-sync/inventory/${id}`).catch(() => {});
  }
}

// Inventory Management
export function loadInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INVENTORY);
    if (raw) {
      const parsed: InventoryItem[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Discard any residual legacy mock items that had inv-1 to inv-8
        return parsed.filter(i => !["inv-1", "inv-2", "inv-3", "inv-4", "inv-5", "inv-6", "inv-7", "inv-8"].includes(i.id));
      }
    }
  } catch {}
  return [];
}

export function saveInventory(items: InventoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(items));
    window.dispatchEvent(new Event("ss_inventory_updated"));
  } catch {}
  if (typeof localStorage !== "undefined" && localStorage.getItem("fr_token")) {
    const settings = loadSettings();
    if (settings.role === "supermarket" && settings.storeId && settings.storeId !== "store-default") {
      const myItems = items.filter(i => i.storeId === settings.storeId);
      if (myItems.length > 0) {
        api.put("/cloud-sync/inventory/sync", myItems).catch(() => {
          api.post("/cloud-sync/inventory/batch", myItems).catch(() => {});
        });
      }
    }
  }
}

// Orders Management
export function deduplicateOrders(orders: StoreOrder[]): StoreOrder[] {
  const map = new Map<string, StoreOrder>();
  for (const o of orders) {
    if (!o) continue;
    // Deduplicate by unique pickup QR pass code first, fallback to order ID
    const key = (o.qrCode && o.qrCode.trim()) ? `qr_${o.qrCode.trim().toUpperCase()}` : o.id;
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, o);
    } else {
      const status = (o.status === "FULFILLED" || existing.status === "FULFILLED")
        ? "FULFILLED"
        : (o.status === "CANCELLED" || existing.status === "CANCELLED" ? "CANCELLED" : "RESERVED");
      map.set(key, { ...existing, ...o, status });
    }
  }
  return Array.from(map.values());
}

export function loadOrders(): StoreOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (raw) {
      const parsed: StoreOrder[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(o => !["ord-101", "ord-102", "ord-103"].includes(o.id));
        const deduplicated = deduplicateOrders(cleaned);
        // Automatically clean up accumulated duplicate entries from storage
        if (deduplicated.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(deduplicated));
        }
        return deduplicated;
      }
    }
  } catch {}
  return [];
}

// Customer Order Filtering Utilities
export function isOrderForCustomer(order: StoreOrder, customerEmail?: string): boolean {
  if (!order) return false;
  const targetEmail = (customerEmail || getCurrentUserEmail() || "").toLowerCase().trim();
  if (!targetEmail) return false;
  return Boolean(order.customerEmail && order.customerEmail.toLowerCase().trim() === targetEmail);
}

export function loadMyOrders(customerEmail?: string): StoreOrder[] {
  const targetEmail = (customerEmail || getCurrentUserEmail() || "").toLowerCase().trim();
  if (!targetEmail) return [];
  return loadOrders().filter(o => isOrderForCustomer(o, targetEmail));
}

export function saveOrders(orders: StoreOrder[]) {
  try {
    const deduplicated = deduplicateOrders(orders);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(deduplicated));
    window.dispatchEvent(new Event("ss_orders_updated"));
  } catch {}
}

// Notifications Management
export function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveNotifications(notifs: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify(notifs));
    window.dispatchEvent(new Event("ss_notifs_updated"));
  } catch {}
}

// User Settings Management — Per-user isolated, keyed by email
// Inventory / Stores / Orders remain GLOBAL and shared between all users.

export function loadSettings(): UserSettings {
  try {
    // First try the current logged-in user's own settings
    const email = getCurrentUserEmail();
    if (email) {
      const raw = localStorage.getItem(settingsKeyForEmail(email));
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
      // If an active user email exists but has no saved settings yet, do not fall back to another user's legacy settings!
      return { ...DEFAULT_SETTINGS, email };
    }
    // Fallback: legacy single-key (for existing sessions with no email stored)
    const legacyRaw = localStorage.getItem("ss_settings_v4");
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: UserSettings) {
  try {
    const email = settings.email || getCurrentUserEmail();
    if (email) {
      // Save under per-user key
      localStorage.setItem(settingsKeyForEmail(email), JSON.stringify(settings));
      // Also update the current email pointer
      setCurrentUserEmail(email);
    } else {
      // Fallback: save to legacy key
      localStorage.setItem("ss_settings_v4", JSON.stringify(settings));
    }
    window.dispatchEvent(new Event("ss_settings_updated"));
  } catch {}
}

// Reservation & Order Operations
export function addReservation(
  item: InventoryItem,
  qty: number,
  customerName: string,
  customerLocation?: string,
  customerEmail?: string
): StoreOrder {
  const currentOrders = loadOrders();
  const randomPass = "SS-" + Math.floor(1000 + Math.random() * 9000);
  const email = (customerEmail || getCurrentUserEmail() || "").toLowerCase().trim();
  const newOrder: StoreOrder = {
    id: "ord-" + Date.now(),
    listingId: item.id,
    storeId: item.storeId,
    productName: item.name,
    storeName: item.store,
    storeLocation: item.storeLocation || "Market Store Counter",
    customerName: customerName || "Customer",
    customerEmail: email,
    customerLocation: customerLocation || "Local Area",
    quantity: qty,
    unit: item.unit,
    priceAtOrder: item.currentPrice * qty,
    status: "RESERVED",
    reservedAt: new Date().toISOString(),
    pickupTime: `Today, ${new Date(Date.now() + 3600000 * 2).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    qrCode: randomPass,
    notes: `Pickup deadline: ${item.pickupDeadline}`
  };

  const updatedOrders = [newOrder, ...currentOrders];
  saveOrders(updatedOrders);
  if (typeof localStorage !== "undefined" && localStorage.getItem("fr_token")) {
    api.post("/cloud-sync/orders", newOrder).catch(() => {});
  }

  // Update item available quantity in inventory locally and atomically in cloud
  const inventory = loadInventory();
  const updatedInv = inventory.map(inv => {
    if (inv.id === item.id) {
      const remaining = Math.max(0, inv.available - qty);
      return {
        ...inv,
        available: remaining,
        status: (remaining === 0 ? "Reserved" : inv.status) as InventoryItem["status"]
      };
    }
    return inv;
  });
  try {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(updatedInv));
    window.dispatchEvent(new Event("ss_inventory_updated"));
  } catch {}

  // Atomic cloud reservation decrement (does not push entire inventory)
  if (typeof localStorage !== "undefined" && localStorage.getItem("fr_token")) {
    api.post(`/cloud-sync/inventory/${item.id}/reserve?quantity=${qty}`).catch(() => {});
  }

  // Push notification
  const notifs = loadNotifications();
  const newNotif: AppNotification = {
    id: "notif-" + Date.now(),
    title: "New Reservation Created",
    message: `${customerName || "Customer"} reserved ${qty} ${item.unit} of ${item.name} from ${item.store}. Pass ID: ${randomPass}`,
    type: "ORDER",
    read: false,
    createdAt: new Date().toISOString(),
    link: "/supermarket/verification"
  };
  saveNotifications([newNotif, ...notifs]);

  return newOrder;
}

export function fulfillPickupOrder(codeOrId: string): StoreOrder | null {
  const orders = loadOrders();
  const targetCode = codeOrId.trim().toUpperCase();
  const foundIndex = orders.findIndex(o => 
    (o.qrCode && o.qrCode.toUpperCase() === targetCode) || 
    o.id.toUpperCase() === targetCode ||
    o.id.slice(-6).toUpperCase() === targetCode
  );

  if (foundIndex === -1) return null;

  const target = orders[foundIndex];
  if (target.status === "FULFILLED") return target;

  const updated: StoreOrder = {
    ...target,
    status: "FULFILLED",
    notes: `Collected & verified at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  };

  const nextOrders = [...orders];
  nextOrders[foundIndex] = updated;
  saveOrders(nextOrders);

  // Push notification
  const notifs = loadNotifications();
  const newNotif: AppNotification = {
    id: "notif-" + Date.now(),
    title: "Order Fulfilled at Counter",
    message: `Pass ${updated.qrCode} for ${updated.productName} (${updated.quantity} ${updated.unit}) was successfully fulfilled.`,
    type: "ORDER",
    read: false,
    createdAt: new Date().toISOString(),
    link: "/supermarket/verification?view=pickups"
  };
  saveNotifications([newNotif, ...notifs]);
  if (typeof localStorage !== "undefined" && localStorage.getItem("fr_token")) {
    api.patch(`/cloud-sync/orders/${updated.id}/status?status=FULFILLED`).catch(() => {});
  }

  return updated;
}

export function cancelPickupOrder(orderId: string): boolean {
  const orders = loadOrders();
  const found = orders.find(o => o.id === orderId);
  if (!found || found.status !== "RESERVED") return false;

  const updatedOrders = orders.map(o => o.id === orderId ? { ...o, status: "CANCELLED" as const } : o);
  saveOrders(updatedOrders);

  // Restore inventory locally
  const inventory = loadInventory();
  const updatedInv = inventory.map(inv => {
    if (inv.id === found.listingId) {
      return { ...inv, available: inv.available + found.quantity, status: "Available" as const };
    }
    return inv;
  });
  try {
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(updatedInv));
    window.dispatchEvent(new Event("ss_inventory_updated"));
  } catch {}

  // Atomic cloud release and order cancel status
  if (typeof localStorage !== "undefined" && localStorage.getItem("fr_token")) {
    api.post(`/cloud-sync/inventory/${found.listingId}/release?quantity=${found.quantity}`).catch(() => {});
    api.patch(`/cloud-sync/orders/${orderId}/status?status=CANCELLED`).catch(() => {});
  }

  return true;
}

export function clearAllData() {
  localStorage.removeItem(STORAGE_KEYS.INVENTORY);
  localStorage.removeItem(STORAGE_KEYS.ORDERS);
  localStorage.removeItem(STORAGE_KEYS.NOTIFS);
  localStorage.removeItem(STORAGE_KEYS.STORES);
  window.dispatchEvent(new Event("ss_inventory_updated"));
  window.dispatchEvent(new Event("ss_orders_updated"));
  window.dispatchEvent(new Event("ss_notifs_updated"));
  window.dispatchEvent(new Event("ss_stores_updated"));
}

// --- Cloud Sync with MongoDB Atlas via Render Backend ---
let isSyncing = false;
export async function syncFromCloud(): Promise<void> {
  if (isSyncing) return;
  if (typeof localStorage === "undefined" || !localStorage.getItem("fr_token")) return;
  isSyncing = true;
  try {
    const [invRes, storeRes, orderRes] = await Promise.allSettled([
      api.get<InventoryItem[]>("/cloud-sync/inventory"),
      api.get<RegisteredStore[]>("/cloud-sync/stores"),
      api.get<StoreOrder[]>("/cloud-sync/orders")
    ]);

    if (invRes.status === "fulfilled" && Array.isArray(invRes.value.data)) {
      const cloudItems = invRes.value.data.filter(i => {
        if (!i || !i.name) return false;
        if (i.id === "inv-1792928404400" || (i.store && i.store.toLowerCase().includes("city supermarket"))) return false;
        return true;
      });
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(cloudItems));
      window.dispatchEvent(new Event("ss_inventory_updated"));
    }

    if (storeRes.status === "fulfilled" && Array.isArray(storeRes.value.data)) {
      const cloudStores = storeRes.value.data;
      const seen = new Map<string, RegisteredStore>();
      const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace("kirna", "kirana");
      for (const store of cloudStores) {
        if (!store || !store.name) continue;
        if (store.name.toLowerCase().trim() === "city supermarket") continue;
        const k = normKey(store.name);
        if (seen.has(k)) {
          const ex = seen.get(k)!;
          if (ex.id === "store-default" && store.id !== "store-default") {
            seen.set(k, { ...ex, ...store });
          }
        } else {
          seen.set(k, store);
        }
      }
      const cleaned = Array.from(seen.values());
      localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(cleaned));
      window.dispatchEvent(new Event("ss_stores_updated"));
    }

    if (orderRes.status === "fulfilled" && Array.isArray(orderRes.value.data)) {
      const cloudOrders = orderRes.value.data;
      const currentOrders = loadOrders();

      // Deduplicate orders by unique order ID across cloud and local storage
      const orderMap = new Map<string, StoreOrder>();

      // 1. Add all existing local orders
      for (const o of currentOrders) {
        if (o && o.id) {
          orderMap.set(o.id, o);
        }
      }

      // 2. Merge cloud orders, updating status or adding new orders
      for (const co of cloudOrders) {
        if (co && co.id) {
          const local = orderMap.get(co.id);
          orderMap.set(co.id, local ? { ...local, ...co } : co);
        }
      }

      const deduplicated = Array.from(orderMap.values());
      const currentRaw = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const nextRaw = JSON.stringify(deduplicated);

      // ONLY save and dispatch if the data actually changed!
      if (currentRaw !== nextRaw) {
        localStorage.setItem(STORAGE_KEYS.ORDERS, nextRaw);
        window.dispatchEvent(new Event("ss_orders_updated"));
      }
    }
  } catch {
    // Cloud sync offline or waking up
  } finally {
    isSyncing = false;
  }
}

// Auto-sync immediately and poll every 4 seconds so laptop and phone stay in sync
if (typeof window !== "undefined") {
  syncFromCloud();
  setInterval(() => {
    syncFromCloud();
  }, 4000);
  window.addEventListener("focus", () => syncFromCloud());
}

