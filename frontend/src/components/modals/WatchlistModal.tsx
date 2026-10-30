import React, { useState, useEffect } from "react";
import { X, Bell, Trash2, Plus, Check, MapPin, Tag, AlertCircle } from "lucide-react";
import { getWatchlist, createWatch, deleteWatch } from "@/api/watchlist";
import type { WatchItem } from "@/types";

interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialKeyword?: string;
  initialCategory?: string;
  initialMaxPrice?: number;
  onAction?: (msg: string, kind?: "success" | "error" | "info") => void;
}

export function WatchlistModal({
  isOpen,
  onClose,
  initialKeyword = "",
  initialCategory,
  initialMaxPrice,
  onAction,
}: WatchlistModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<"create" | "list">(initialKeyword ? "create" : "list");
  const [watches, setWatches] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [keyword, setKeyword] = useState(initialKeyword);
  const [category, setCategory] = useState(initialCategory || "");
  const [maxPrice, setMaxPrice] = useState<string>(initialMaxPrice ? String(initialMaxPrice) : "");
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [errorMsg, setErrorMsg] = useState("");

  const loadWatches = async () => {
    try {
      setLoading(true);
      const data = await getWatchlist();
      setWatches(data);
    } catch (err: any) {
      // Fallback if not authenticated or error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWatches();
  }, []);

  useEffect(() => {
    if (initialKeyword) {
      setKeyword(initialKeyword);
      setActiveTab("create");
    }
    if (initialCategory) setCategory(initialCategory);
    if (initialMaxPrice) setMaxPrice(String(initialMaxPrice));
  }, [initialKeyword, initialCategory, initialMaxPrice]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      setErrorMsg("Product keyword is required.");
      return;
    }
    if (trimmedKeyword.length > 40) {
      setErrorMsg("Keyword must be at most 40 characters.");
      return;
    }
    if (watches.length >= 20) {
      setErrorMsg("Maximum limit of 20 watches reached. Please delete an older watch first.");
      return;
    }

    const priceNum = maxPrice ? parseFloat(maxPrice) : undefined;
    if (priceNum !== undefined && (isNaN(priceNum) || priceNum <= 0)) {
      setErrorMsg("Max price must be a positive number.");
      return;
    }

    try {
      setSubmitting(true);
      const newWatch = await createWatch({
        keyword: trimmedKeyword,
        category: category || undefined,
        maxPrice: priceNum,
        radiusKm: Number(radiusKm) || 5,
      });
      setWatches(prev => [newWatch, ...prev]);
      onAction?.(`Alert created for "${trimmedKeyword}"!`, "success");
      setActiveTab("list");
      setKeyword("");
      setMaxPrice("");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to create watch alert.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, kw: string) => {
    try {
      await deleteWatch(id);
      setWatches(prev => prev.filter(w => w.id !== id));
      onAction?.(`Removed alert for "${kw}"`, "info");
    } catch (err: any) {
      onAction?.("Failed to delete watch alert", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 ss-reveal">
      <div className="ss-card w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-[#1F2825] overflow-hidden shadow-2xl border border-[#EAE6DF] dark:border-[#2D3835]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#192220] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#2E221F] dark:text-[#F0F4F2]">Surplus Food Watchlist</h3>
              <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">Get notified instantly when items match your price or area</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8A847E] hover:text-[#2E221F] dark:hover:text-[#F0F4F2] cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5]/60 dark:bg-[#161D1B]/60 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === "create"
                ? "border-[#00897B] text-[#00897B] dark:text-[#2DD4BF]"
                : "border-transparent text-[#7A746E] dark:text-[#A3B2AC] hover:text-[#2E221F]"
            }`}
          >
            + Create Watch Alert
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              activeTab === "list"
                ? "border-[#00897B] text-[#00897B] dark:text-[#2DD4BF]"
                : "border-transparent text-[#7A746E] dark:text-[#A3B2AC] hover:text-[#2E221F]"
            }`}
          >
            My Active Watches ({watches.length}/20)
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === "create" ? (
            <form onSubmit={handleCreate} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">
                  Product Name / Keyword <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder="e.g. Tomato, Milk, Bread, Apples"
                  className="ss-input mt-1 text-sm font-medium"
                  required
                />
                <span className="text-[10px] text-[#8A847E] mt-0.5 block">{keyword.length}/40 characters</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Category (Optional)</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="ss-input mt-1 text-xs"
                  >
                    <option value="">All Categories</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Fruit">Fruit</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Staples">Staples</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Max Price (₹) (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)}
                    placeholder="e.g. 40"
                    className="ss-input mt-1 text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-[#2D2320] dark:text-[#E2E8E5] flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-[#00897B]" /> Search Radius: {radiusKm} km
                  </label>
                  <span className="text-[11px] text-[#8A847E]">1 km - 50 km</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={radiusKm}
                  onChange={e => setRadiusKm(Number(e.target.value))}
                  className="w-full mt-2 accent-[#00897B] cursor-pointer"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="ss-btn-coral flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Bell className="h-4 w-4" /> {submitting ? "Saving..." : "Set Watch Alert"}
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
          ) : (
            <div className="space-y-3">
              {loading ? (
                <div className="py-10 text-center text-xs text-[#7A746E]">Loading watchlist...</div>
              ) : watches.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto">
                    <Bell className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">No active watch alerts</h4>
                  <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] max-w-xs mx-auto">
                    Set alerts for food items you care about, and we will notify you when stores list them at a discount!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("create")}
                    className="mt-2 px-3 py-1.5 rounded-xl ss-btn-coral text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create Alert
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {watches.map(w => (
                    <div
                      key={w.id}
                      className="p-3.5 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-white dark:bg-[#1A2220] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#2E221F] dark:text-[#F0F4F2]">{w.keyword}</span>
                          {w.category && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#FAF8F5] dark:bg-[#25302D] border border-[#EAE6DF] dark:border-[#2D3835] text-[#7A746E] dark:text-[#A3B2AC] font-semibold">
                              {w.category}
                            </span>
                          )}
                          {w.maxPrice !== undefined && w.maxPrice !== null && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                              Max ₹{w.maxPrice}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#7A746E] dark:text-[#A3B2AC] mt-1">
                          <span>Radius: {w.radiusKm || 5} km</span>
                          <span>•</span>
                          <span>Created: {new Date(w.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(w.id, w.keyword)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                        title="Delete Alert"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

