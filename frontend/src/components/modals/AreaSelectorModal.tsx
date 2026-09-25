import React, { useState } from "react";
import { X, MapPin, Navigation, Compass } from "lucide-react";
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

  const popularAreas = [
    "Central Market",
    "Station Road",
    "North Enclave",
    "West District",
    "South Town",
    "Commercial Hub"
  ];

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const finalLocation = userLocation.trim() || selectedArea;
    saveSettings({
      ...currentSettings,
      userLocation: finalLocation,
      selectedArea: selectedArea.trim() || finalLocation,
      searchRadiusKm: radiusKm
    });
    onSelected(selectedArea.trim() || finalLocation, radiusKm);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 ss-reveal">
      <div className="ss-card w-full max-w-md bg-white dark:bg-[#1F2825] overflow-hidden shadow-2xl border border-[#EAE6DF] dark:border-[#2D3835]">
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
          <button onClick={onClose} className="text-[#8A847E] hover:text-[#2E221F] dark:hover:text-[#F0F4F2]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5] mb-1">
              Your Current Street Address / Locality
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
          </div>

          <div className="pt-2 border-t border-[#EAE6DF] dark:border-[#2D3835]">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Maximum Search Radius</label>
              <span className="text-xs font-bold text-[#FF6548]">{radiusKm} km</span>
            </div>
            <input
              type="range"
              min="1"
              max="25"
              step="1"
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
            <button
              type="submit"
              className="ss-btn-coral flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Navigation className="h-3.5 w-3.5" /> Save Location & Update Food
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
