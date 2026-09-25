import React, { useState } from "react";
import { X, User, Bell, Sliders, Shield, Check, RotateCcw, Store, MapPin, Navigation, Loader2, ExternalLink } from "lucide-react";
import { loadSettings, saveSettings, UserSettings, upsertStore, clearAllData } from "@/data/mockStore";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  if (!isOpen) return null;

  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [activeTab, setActiveTab] = useState<"profile" | "location" | "operations" | "notifications" | "system">("profile");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);

    // If supermarket, upsert the store registry
    if (settings.role === "supermarket") {
      upsertStore({
        id: settings.storeId,
        name: settings.storeName,
        location: settings.storeLocation,
        area: settings.storeArea,
        phone: settings.storePhone,
        managerName: settings.name
      });
    }

    onSaved("Settings updated successfully!");
    onClose();
  };

  const handleResetData = () => {
    if (confirm("Reset all surplus, orders, and stores to a clean, empty state?")) {
      clearAllData();
      window.location.reload();
    }
  };

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);

  const handleDetectGPS = () => {
    setGpsLoading(true);
    setGpsMsg(null);
    if (!navigator.geolocation) {
      setGpsMsg("❌ Geolocation not supported by your browser.");
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const parts = [
            addr.road || addr.pedestrian,
            addr.neighbourhood || addr.suburb || addr.city_district,
            addr.city || addr.town || addr.county
          ].filter(Boolean);
          const detectedAddress = parts.slice(0, 3).join(", ") || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          const detectedArea = addr.neighbourhood || addr.suburb || addr.city_district || addr.city || "Local Area";
          setSettings(s => ({
            ...s,
            userLocation: detectedAddress,
            selectedArea: detectedArea,
            gpsLat: latitude,
            gpsLng: longitude,
            storeLocation: s.role === "supermarket" ? (s.storeLocation || detectedAddress) : s.storeLocation
          }));
          setGpsMsg(`✅ Location detected: ${detectedAddress}`);
        } catch {
          setSettings(s => ({ ...s, gpsLat: latitude, gpsLng: longitude }));
          setGpsMsg(`✅ GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) setGpsMsg("❌ Location access denied. Allow location in browser settings.");
        else setGpsMsg("❌ Could not get location. Enter manually.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 ss-reveal">
      <div className="ss-card w-full max-w-xl bg-white dark:bg-[#1F2825] overflow-hidden shadow-2xl border border-[#EAE6DF] dark:border-[#2D3835]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#192220]">
          <div>
            <h3 className="font-bold text-lg text-[#2E221F] dark:text-[#F0F4F2]">Account & Store Settings</h3>
            <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">Manage store information, your location, and operational preferences.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A847E] hover:text-[#2E221F] dark:hover:text-[#F0F4F2] hover:bg-[#EAE6DF] dark:hover:bg-[#2A3532] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#EAE6DF] dark:border-[#2D3835] px-6 bg-[#FAF7F2] dark:bg-[#1A2220] gap-2 overflow-x-auto">
          {[
            { id: "profile", label: "Profile", icon: User },
            { id: "location", label: settings.role === "supermarket" ? "Store Info" : "My Location", icon: settings.role === "supermarket" ? Store : MapPin },
            { id: "operations", label: "Operations", icon: Sliders },
            { id: "notifications", label: "Alerts", icon: Bell },
            { id: "system", label: "System", icon: Shield },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? "border-[#FF6548] text-[#FF6548]"
                    : "border-transparent text-[#7A746E] dark:text-[#A3B2AC] hover:text-[#2E221F] dark:hover:text-[#F0F4F2]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {activeTab === "profile" && (
            <div className="space-y-3.5 ss-reveal">
              <div>
                <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Full Name</label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={e => setSettings({ ...settings, name: e.target.value })}
                  className="ss-input mt-1 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Email Address</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={e => setSettings({ ...settings, email: e.target.value })}
                  className="ss-input mt-1 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Account Role</label>
                <div className="mt-1 flex gap-3">
                  <span className="px-3 py-1.5 rounded-lg border border-[#00897B] bg-[#E0F7F2] text-[#00897B] font-bold text-xs">
                    {settings.role === "supermarket" ? "Supermarket Manager" : "Customer / NGO"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "location" && (
            <div className="space-y-3.5 ss-reveal">
              {settings.role === "supermarket" ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">
                      Supermarket Name
                    </label>
                    <input
                      type="text"
                      value={settings.storeName}
                      onChange={e => setSettings({ ...settings, storeName: e.target.value })}
                      placeholder="e.g. Apex Supermarket, Fresh Choice"
                      className="ss-input mt-1 text-sm"
                      required
                    />
                    <p className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC] mt-1">
                      This name appears to customers when they browse nearby food.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">
                      Store Address / Location
                    </label>
                    <input
                      type="text"
                      value={settings.storeLocation}
                      onChange={e => setSettings({ ...settings, storeLocation: e.target.value })}
                      placeholder="e.g. Shop 12-14, MG Road, Shivaji Nagar"
                      className="ss-input mt-1 text-sm"
                      required
                    />
                  </div>

                  {/* GPS for Store Location */}
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={handleDetectGPS}
                      disabled={gpsLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E0F7F2] dark:bg-[#18332B] text-[#00897B] dark:text-[#2DD4BF] font-semibold text-xs border border-[#B2EBE0] dark:border-[#1E4A3A] hover:bg-[#C8F0E8] transition-all cursor-pointer"
                    >
                      {gpsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                      {gpsLoading ? "Detecting..." : "📍 Detect store location"}
                    </button>
                    {settings.storeLocation && (
                      <button type="button" onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(settings.storeLocation)}`, "_blank")} title="Open in Google Maps" className="px-3 py-2 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] text-[#554F4A] dark:text-[#CBD5E1] hover:bg-[#FAF8F5] cursor-pointer">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {gpsMsg && (
                    <div className={`p-2.5 rounded-lg border text-xs font-medium ${
                      gpsMsg.startsWith("✅") ? "bg-green-50 border-green-200 text-green-700" : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}>{gpsMsg}</div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">
                      Neighborhood / City Area
                    </label>
                    <input
                      type="text"
                      value={settings.storeArea}
                      onChange={e => setSettings({ ...settings, storeArea: e.target.value })}
                      placeholder="e.g. Central Market, Kothrud"
                      className="ss-input mt-1 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">
                      Store Contact Phone
                    </label>
                    <input
                      type="text"
                      value={settings.storePhone || ""}
                      onChange={e => setSettings({ ...settings, storePhone: e.target.value })}
                      placeholder="+91 98000 00000"
                      className="ss-input mt-1 text-sm"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* GPS Detect */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDetectGPS}
                      disabled={gpsLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E0F7F2] dark:bg-[#18332B] text-[#00897B] dark:text-[#2DD4BF] font-semibold text-xs border border-[#B2EBE0] dark:border-[#1E4A3A] hover:bg-[#C8F0E8] transition-all cursor-pointer"
                    >
                      {gpsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                      {gpsLoading ? "Detecting..." : "📍 Auto-detect my location"}
                    </button>
                    {(settings.gpsLat || settings.userLocation) && (
                      <button
                        type="button"
                        onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(settings.userLocation || "")}`, "_blank")}
                        title="Open in Google Maps"
                        className="px-3 py-2 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] text-[#554F4A] dark:text-[#CBD5E1] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D] transition-all cursor-pointer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {gpsMsg && (
                    <div className={`p-2.5 rounded-lg border text-xs font-medium ${
                      gpsMsg.startsWith("✅") ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400" : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
                    }`}>{gpsMsg}</div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">
                      Your Address / Location
                    </label>
                    <input
                      type="text"
                      value={settings.userLocation}
                      onChange={e => setSettings({ ...settings, userLocation: e.target.value })}
                      placeholder="e.g. Flat 301, Sunshine Heights, Main Road"
                      className="ss-input mt-1 text-sm"
                      required
                    />
                    <p className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC] mt-1">
                      Used to calculate exact distance to nearby supermarkets.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">
                      Neighborhood Area
                    </label>
                    <input
                      type="text"
                      value={settings.selectedArea}
                      onChange={e => setSettings({ ...settings, selectedArea: e.target.value })}
                      placeholder="e.g. Central Market"
                      className="ss-input mt-1 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Search Radius</label>
                      <span className="text-xs font-bold text-[#FF6548]">{settings.searchRadiusKm} km</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="25"
                      step="1"
                      value={settings.searchRadiusKm}
                      onChange={e => setSettings({ ...settings, searchRadiusKm: Number(e.target.value) })}
                      className="w-full mt-2 accent-[#00897B] cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "operations" && (
            <div className="space-y-4 ss-reveal">
              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Reservation Hold Timeout</label>
                  <span className="text-xs font-bold text-[#FF6548]">{settings.holdMinutes} Minutes</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={settings.holdMinutes}
                  onChange={e => setSettings({ ...settings, holdMinutes: Number(e.target.value) })}
                  className="w-full mt-2 accent-[#FF6548] cursor-pointer"
                />
                <p className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC] mt-1">
                  How long food holds remain reserved for customer checkout before automatically returning to available stock.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#161D1B] space-y-2">
                <span className="text-xs font-bold text-[#00897B] uppercase tracking-wider">Surplus Policy</span>
                <p className="text-xs text-[#554F4A] dark:text-[#CBD5E1]">
                  • <strong>Near Expiry:</strong> 20% - 40% discount applied to save fresh surplus.
                </p>
                <p className="text-xs text-[#554F4A] dark:text-[#CBD5E1]">
                  • <strong>Urgent Rescue:</strong> 50% - 60% emergency surplus discount for immediate customer rescue.
                </p>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-3 ss-reveal">
              <label className="flex items-center justify-between p-3 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D] cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-[#2D2320] dark:text-[#E2E8E5]">Email Notifications</p>
                  <p className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC]">Receive order confirmations and pickup summaries via email.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.emailAlerts}
                  onChange={e => setSettings({ ...settings, emailAlerts: e.target.checked })}
                  className="h-4 w-4 accent-[#00897B] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D] cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-[#2D2320] dark:text-[#E2E8E5]">SMS & WhatsApp Alerts</p>
                  <p className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC]">Instant text message with Pass code when orders are placed.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.smsAlerts}
                  onChange={e => setSettings({ ...settings, smsAlerts: e.target.checked })}
                  className="h-4 w-4 accent-[#00897B] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D] cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-[#2D2320] dark:text-[#E2E8E5]">In-App Audio Chimes</p>
                  <p className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC]">Play confirmation sound on successful checkout handoff.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={e => setSettings({ ...settings, soundEnabled: e.target.checked })}
                  className="h-4 w-4 accent-[#00897B] rounded cursor-pointer"
                />
              </label>
            </div>
          )}

          {activeTab === "system" && (
            <div className="space-y-4 ss-reveal">
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
                <h4 className="text-xs font-bold text-red-700 dark:text-red-400">Clear All Storage Data</h4>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                  Wipe all registered inventory, test reservations, and store listings to start completely new.
                </p>
                <button
                  type="button"
                  onClick={handleResetData}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Clear All Data (Fresh Start)
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex gap-2 pt-3 border-t border-[#EAE6DF] dark:border-[#2D3835]">
            <button
              type="submit"
              className="ss-btn-coral flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="h-4 w-4" /> Save Settings
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ss-btn-soft px-4 py-2.5 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
