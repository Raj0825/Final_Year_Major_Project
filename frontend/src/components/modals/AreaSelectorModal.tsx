import React, { useState } from "react";
import { X, MapPin, Navigation, Loader2, ExternalLink } from "lucide-react";
import { loadSettings, saveSettings } from "@/data/mockStore";

interface AreaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelected: (area: string, radiusKm: number) => void;
}

export function AreaSelectorModal({ isOpen, onClose, onSelected }: AreaSelectorModalProps) {
  if (!isOpen) return null;

  const currentSettings = loadSettings();
  const [userLocation, setUserLocation] = useState(currentSettings.userLocation || "");
  const [selectedArea, setSelectedArea] = useState(currentSettings.selectedArea || "Central Market");
  const [radiusKm, setRadiusKm] = useState(currentSettings.searchRadiusKm || 5);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  const popularAreas = [
    "Central Market", "Station Road", "North Enclave",
    "West District", "South Town", "Commercial Hub"
  ];

  // Use browser Geolocation API + Nominatim reverse geocoding (free, no API key)
  const handleDetectGPS = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setGpsCoords({ lat: latitude, lng: longitude });
        try {
          // Free reverse geocoding with OpenStreetMap Nominatim
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const addr = data.address || {};
          // Build a human-friendly address
          const parts = [
            addr.road || addr.pedestrian || addr.footway,
            addr.neighbourhood || addr.suburb || addr.quarter || addr.village,
            addr.city || addr.town || addr.county,
            addr.state
          ].filter(Boolean);
          const detectedAddress = parts.slice(0, 3).join(", ");
          const detectedArea = addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || addr.city || "Local Area";

          setUserLocation(detectedAddress || `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
          setSelectedArea(detectedArea);
          setGpsError(null);
        } catch {
          // Fallback to raw coordinates if reverse geocoding fails
          setUserLocation(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
          setGpsError("Could not resolve address name, but coordinates captured.");
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) setGpsError("Location access denied. Please allow location in browser settings.");
        else if (err.code === 2) setGpsError("Location unavailable. Try again or enter manually.");
        else setGpsError("Timed out getting location. Enter address manually.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const handleOpenGoogleMaps = () => {
    if (gpsCoords) {
      window.open(`https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`, "_blank");
    } else if (userLocation) {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(userLocation)}`, "_blank");
    }
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const finalLocation = userLocation.trim() || selectedArea;
    saveSettings({
      ...currentSettings,
      userLocation: finalLocation,
      selectedArea: selectedArea.trim() || finalLocation,
      searchRadiusKm: radiusKm,
      ...(gpsCoords ? { gpsLat: gpsCoords.lat, gpsLng: gpsCoords.lng } : {})
    });
    onSelected(selectedArea.trim() || finalLocation, radiusKm);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 ss-reveal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ss-card w-full max-w-md bg-white dark:bg-[#1F2825] overflow-hidden shadow-2xl border border-[#EAE6DF] dark:border-[#2D3835]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#192220]">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#E0F7F2] dark:bg-[#18332B] text-[#00897B] dark:text-[#2DD4BF]">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#2E221F] dark:text-[#F0F4F2]">Your Location & Radius</h3>
              <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">Find supermarkets and food surplus near you</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8A847E] hover:text-[#2E221F] dark:hover:text-[#F0F4F2] cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-6 space-y-4">
          {/* GPS Detect Button */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={gpsLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E0F7F2] dark:bg-[#18332B] text-[#00897B] dark:text-[#2DD4BF] font-semibold text-xs border border-[#B2EBE0] dark:border-[#1E4A3A] hover:bg-[#C8F0E8] dark:hover:bg-[#1D3D30] transition-all cursor-pointer"
            >
              {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              {gpsLoading ? "Detecting location..." : "📍 Auto-detect my location"}
            </button>
            {(gpsCoords || userLocation) && (
              <button
                type="button"
                onClick={handleOpenGoogleMaps}
                title="Open in Google Maps"
                className="px-3 py-2.5 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] text-[#554F4A] dark:text-[#CBD5E1] hover:bg-[#FAF8F5] dark:hover:bg-[#25302D] transition-all cursor-pointer"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* GPS Error */}
          {gpsError && (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
              ⚠️ {gpsError}
            </div>
          )}

          {/* GPS Success */}
          {gpsCoords && !gpsError && (
            <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400 flex items-center gap-2">
              ✅ GPS detected — {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
            </div>
          )}

          {/* Manual Address Input */}
          <div>
            <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5] mb-1">
              Street Address / Locality
            </label>
            <input
              type="text"
              value={userLocation}
              onChange={e => setUserLocation(e.target.value)}
              placeholder="e.g. Flat 402, Green Valley Apartments, MG Road"
              className="ss-input text-sm"
              required
            />
          </div>

          {/* Area Quick Picks */}
          <div>
            <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5] mb-1.5">
              Neighborhood / Area Zone
            </label>
            <div className="flex flex-wrap gap-1.5">
              {popularAreas.map(area => {
                const isSelected = selectedArea.toLowerCase() === area.toLowerCase();
                return (
                  <button
                    type="button"
                    key={area}
                    onClick={() => setSelectedArea(area)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#00897B] bg-[#E0F7F2] dark:bg-[#18332B] text-[#00897B] dark:text-[#2DD4BF] font-bold"
                        : "border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1F2825] text-[#554F4A] dark:text-[#CBD5E1] hover:bg-[#FAF8F5]"
                    }`}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={selectedArea}
              onChange={e => setSelectedArea(e.target.value)}
              placeholder="Or type custom area..."
              className="ss-input text-xs mt-2"
            />
          </div>

          {/* Radius Slider */}
          <div className="pt-2 border-t border-[#EAE6DF] dark:border-[#2D3835]">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Search Radius</label>
              <span className="text-xs font-bold text-[#FF6548]">{radiusKm} km</span>
            </div>
            <input
              type="range" min="1" max="25" step="1"
              value={radiusKm}
              onChange={e => setRadiusKm(Number(e.target.value))}
              className="w-full mt-2 accent-[#00897B] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#8A847E] dark:text-[#64748B] mt-1">
              <span>1 km (Walking)</span>
              <span>5 km (Local)</span>
              <span>25 km (Citywide)</span>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-[#EAE6DF] dark:border-[#2D3835]">
            <button type="submit" className="ss-btn-coral flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
              <Navigation className="h-3.5 w-3.5" /> Save & Find Food
            </button>
            <button type="button" onClick={onClose} className="ss-btn-soft px-4 py-2.5 text-xs font-semibold cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
