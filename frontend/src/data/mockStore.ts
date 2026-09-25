// frontend/src/data/mockStore.ts
// Unified Reactive Data Store for FreshRescue / Smart Surplus
// Dynamic multi-store support, proximity calculation, zero-fake clean state

export interface RegisteredStore {
  id: string;
  name: string;
  location: string; // Street / landmark address
  area: string;     // Area / neighborhood
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
  distance: string;
  freshnessScore: number;
  storageTip?: string;
}

export interface StoreOrder {
  id: string;
  listingId: string;
  productName: string;
  storeName: string;
  storeLocation?: string;
  customerName: string;
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
  storePhone?: string;
  userLocation: string;
  selectedArea: string;
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
  storeId: "store-default",
  storeName: "City Mart Supermarket",
  storeLocation: "Market Square, Station Road",
  storeArea: "Central Market",
  storePhone: "+91 98000 00000",
  userLocation: "Green Park Society, Paud Road",
  selectedArea: "Central Market",
  searchRadiusKm: 5,
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
  return localStorage.getItem(STORAGE_KEYS.CURRENT_EMAIL) || "";
}

export function setCurrentUserEmail(email: string) {
  localStorage.setItem(STORAGE_KEYS.CURRENT_EMAIL, email.toLowerCase());
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

// Distance Calculation Utility
export function calculateDistance(userLocOrArea: string, storeLocOrArea: string): { km: number; display: string } {
  if (!userLocOrArea || !storeLocOrArea) {
    return { km: 1.2, display: "1.2 km" };
  }
  const u = userLocOrArea.trim().toLowerCase();
  const s = storeLocOrArea.trim().toLowerCase();

  // If identical or one contains the other
  if (u === s || u.includes(s) || s.includes(u)) {
    return { km: 0.6, display: "0.6 km" };
  }

  // Hash-based deterministic distance for consistent display between locations
  let hash = 0;
  const combined = `${u}::${s}`;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  const kmVal = Math.max(0.4, (Math.abs(hash) % 48) / 10 + 0.4);
  const rounded = Math.round(kmVal * 10) / 10;
  return { km: rounded, display: `${rounded} km` };
}

// Stores Management
export function loadStores(): RegisteredStore[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STORES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveStores(stores: RegisteredStore[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(stores));
    window.dispatchEvent(new Event("ss_stores_updated"));
  } catch {}
}

export function upsertStore(data: Partial<RegisteredStore> & { name: string; location: string }): RegisteredStore {
  const stores = loadStores();
  const existingIdx = stores.findIndex(
    s => (data.id && s.id === data.id) || s.name.toLowerCase() === data.name.toLowerCase()
  );

  const targetId = data.id || (existingIdx !== -1 ? stores[existingIdx].id : `store-${Date.now()}`);
  const updatedRecord: RegisteredStore = {
    id: targetId,
    name: data.name.trim(),
    location: data.location.trim(),
    area: data.area ? data.area.trim() : (data.location.split(",")[0] || "Local Area").trim(),
    phone: data.phone || "+91 98000 00000",
    managerName: data.managerName || "Store Manager",
    joinedAt: data.joinedAt || new Date().toISOString()
  };

  let nextStores: RegisteredStore[];
  if (existingIdx !== -1) {
    nextStores = [...stores];
    nextStores[existingIdx] = { ...nextStores[existingIdx], ...updatedRecord };
  } else {
    nextStores = [updatedRecord, ...stores];
  }

  saveStores(nextStores);
  return updatedRecord;
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
}

// Orders Management
export function loadOrders(): StoreOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (raw) {
      const parsed: StoreOrder[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(o => !["ord-101", "ord-102", "ord-103"].includes(o.id));
      }
    }
  } catch {}
  return [];
}

export function saveOrders(orders: StoreOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
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
    }
    // Fallback: legacy single-key (for existing sessions)
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
export function addReservation(item: InventoryItem, qty: number, customerName: string, customerLocation?: string): StoreOrder {
  const currentOrders = loadOrders();
  const randomPass = "SS-" + Math.floor(1000 + Math.random() * 9000);
  const newOrder: StoreOrder = {
    id: "ord-" + Date.now(),
    listingId: item.id,
    productName: item.name,
    storeName: item.store,
    storeLocation: item.storeLocation || "Market Store Counter",
    customerName: customerName || "Customer",
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

  // Update item available quantity in inventory
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
  saveInventory(updatedInv);

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

  return updated;
}

export function cancelPickupOrder(orderId: string): boolean {
  const orders = loadOrders();
  const found = orders.find(o => o.id === orderId);
  if (!found || found.status !== "RESERVED") return false;

  const updatedOrders = orders.map(o => o.id === orderId ? { ...o, status: "CANCELLED" as const } : o);
  saveOrders(updatedOrders);

  // Restore inventory
  const inventory = loadInventory();
  const updatedInv = inventory.map(inv => {
    if (inv.id === found.listingId) {
      return { ...inv, available: inv.available + found.quantity, status: "Available" as const };
    }
    return inv;
  });
  saveInventory(updatedInv);

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
