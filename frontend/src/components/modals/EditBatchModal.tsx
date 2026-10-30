import React, { useState, useEffect } from "react";
import { X, Check, Trash2, Tag, CalendarClock, DollarSign, Activity, History, Sparkles } from "lucide-react";
import { InventoryItem, FreshnessHistoryPoint } from "@/data/mockStore";
import { getCloudInventoryHistory } from "@/api/batches";
import { TIER_CONFIG } from "@/config/tierConfig";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

interface EditBatchModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: InventoryItem) => void;
  onDelete?: (id: string) => void;
}

export function EditBatchModal({ item, isOpen, onClose, onSave, onDelete }: EditBatchModalProps) {
  if (!isOpen || !item) return null;

  const [form, setForm] = useState<InventoryItem>(item);
  const [history, setHistory] = useState<FreshnessHistoryPoint[]>(() => {
    return item.freshnessHistory && item.freshnessHistory.length > 0
      ? item.freshnessHistory
      : [{
          timestamp: new Date().toISOString(),
          freshnessScore: item.freshnessScore || 0.95,
          tier: (item.freshnessScore || 0.95) >= TIER_CONFIG.tier1Max ? "FRESH" : (item.freshnessScore || 0.95) >= TIER_CONFIG.tier2Max ? "TIER_1" : (item.freshnessScore || 0.95) >= TIER_CONFIG.tier3Max ? "TIER_2" : (item.freshnessScore || 0.95) >= TIER_CONFIG.expiredMax ? "TIER_3" : "EXPIRED",
          source: "SCAN" as const
        }];
  });

  useEffect(() => {
    if (item) {
      setForm(item);
      if (item.id) {
        getCloudInventoryHistory(item.id)
          .then((pts) => {
            if (Array.isArray(pts) && pts.length > 0) {
              setHistory(pts);
            }
          })
          .catch(() => {
            if (item.freshnessHistory && item.freshnessHistory.length > 0) {
              setHistory(item.freshnessHistory);
            }
          });
      }
    }
  }, [item]);

  const handlePriceOrDiscountChange = (original: number, discountPct: number) => {
    const discounted = Math.round(original * (1 - discountPct / 100));
    setForm(prev => ({
      ...prev,
      originalPrice: original,
      discountPercent: discountPct,
      currentPrice: discounted
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      freshnessHistory: history
    });
    onClose();
  };

  const chartData = history.map((pt, idx) => ({
    index: idx + 1,
    time: new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    score: Math.round(pt.freshnessScore * 100),
    tier: pt.tier || "FRESH",
    source: pt.source || "SCAN",
    rawTime: pt.timestamp,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 ss-reveal">
      <div className="ss-card w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-[#1F2825] overflow-hidden shadow-2xl border border-[#EAE6DF] dark:border-[#2D3835]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#192220] shrink-0">
          <div>
            <h3 className="font-bold text-base text-[#2E221F] dark:text-[#F0F4F2]">Edit Inventory Lot</h3>
            <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">SKU: {form.sku} • {item.store || "Supermarket"}</p>
          </div>
          <button onClick={onClose} className="text-[#8A847E] hover:text-[#2E221F] dark:hover:text-[#F0F4F2] cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Product Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="ss-input mt-1 text-sm font-semibold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Category</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value as any })}
                className="ss-input mt-1 text-xs"
              >
                <option value="Dairy">Dairy</option>
                <option value="Vegetables">Vegetables</option>
                <option value="Fruit">Fruit</option>
                <option value="Bakery">Bakery</option>
                <option value="Staples">Staples</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Current Status</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as any, flagged: e.target.value === "Expiring soon" })}
                className="ss-input mt-1 text-xs"
              >
                <option value="Available">Available (Normal)</option>
                <option value="Expiring soon">Expiring Soon (Flagged)</option>
                <option value="Reserved">Reserved (On Hold)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Available Quantity</label>
              <input
                type="number"
                min="0"
                value={form.available}
                onChange={e => setForm({ ...form, available: Number(e.target.value) })}
                className="ss-input mt-1 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Unit of Measure</label>
              <input
                type="text"
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                className="ss-input mt-1 text-sm"
                required
              />
            </div>
          </div>

          {/* Pricing & Discounts */}
          <div className="p-3.5 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#161D1B] space-y-3">
            <span className="text-xs font-bold text-[#00897B] uppercase tracking-wider block">Pricing & Dynamic Discount</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC] block">Original (₹)</label>
                <input
                  type="number"
                  min="1"
                  value={form.originalPrice}
                  onChange={e => handlePriceOrDiscountChange(Number(e.target.value), form.discountPercent)}
                  className="ss-input mt-1 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC] block">Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  step="5"
                  value={form.discountPercent}
                  onChange={e => handlePriceOrDiscountChange(form.originalPrice, Number(e.target.value))}
                  className="ss-input mt-1 text-xs font-semibold text-[#FF6548]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC] block">Rescue Price (₹)</label>
                <div className="mt-1 h-9 flex items-center px-3 rounded-lg bg-white dark:bg-[#1F2825] border border-[#EAE6DF] dark:border-[#2D3835] font-black text-sm text-[#FF6548]">
                  ₹{form.currentPrice}
                </div>
              </div>
            </div>
          </div>

          {/* Expiry & Pickup Timelines */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Expiry Date / Note</label>
              <input
                type="text"
                value={form.expiry}
                onChange={e => setForm({ ...form, expiry: e.target.value })}
                className="ss-input mt-1 text-xs"
                placeholder="e.g. Today, 8:00 PM"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2D2320] dark:text-[#E2E8E5]">Pickup Deadline</label>
              <input
                type="text"
                value={form.pickupDeadline}
                onChange={e => setForm({ ...form, pickupDeadline: e.target.value })}
                className="ss-input mt-1 text-xs"
                placeholder="e.g. Today, 6:00 PM"
              />
            </div>
          </div>

          {/* Feature 2: Freshness History Panel */}
          <div className="pt-2">
            {history.length <= 1 ? (
              <div className="p-4 rounded-xl border border-dashed border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5]/80 dark:bg-[#161D1B]/80 text-center space-y-1.5">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#7A746E] dark:text-[#A3B2AC]">
                  <History className="h-4 w-4 text-[#00897B] dark:text-[#2DD4BF]" />
                  <span>Freshness History</span>
                </div>
                <p className="text-xs text-[#8A847E] dark:text-[#73827E] max-w-sm mx-auto">
                  Only 1 scan recorded ({item.freshnessScore ? Math.round(item.freshnessScore * 100) : 85}% Fresh). Freshness history trend will chart automatically as subsequent scans or decay updates occur.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#161D1B] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#00897B] dark:text-[#2DD4BF] flex items-center gap-1.5 uppercase tracking-wider">
                    <Activity className="h-3.5 w-3.5" /> Freshness Timeline ({history.length} points)
                  </span>
                  <span className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC]">Score over time</span>
                </div>
                <div className="h-44 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 15, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="p-2 rounded-lg bg-white dark:bg-[#1F2825] border border-[#EAE6DF] dark:border-[#2D3835] shadow-md text-xs space-y-0.5">
                                <p className="font-bold text-[#2E221F] dark:text-[#F0F4F2]">{d.time} • Tier: {d.tier}</p>
                                <p className="text-[#00897B] dark:text-[#2DD4BF] font-semibold">{d.score}% Freshness Score</p>
                                <p className="text-[10px] text-[#8A847E]">Source: {d.source}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine y={Math.round(TIER_CONFIG.tier1Max * 100)} stroke="#10B981" strokeDasharray="3 3" />
                      <ReferenceLine y={Math.round(TIER_CONFIG.tier2Max * 100)} stroke="#3B82F6" strokeDasharray="3 3" />
                      <ReferenceLine y={Math.round(TIER_CONFIG.tier3Max * 100)} stroke="#F59E0B" strokeDasharray="3 3" />
                      <ReferenceLine y={Math.round(TIER_CONFIG.expiredMax * 100)} stroke="#EF4444" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="score" stroke="#00897B" strokeWidth={2.5} dot={{ r: 3, fill: "#00897B" }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t border-[#EAE6DF] dark:border-[#2D3835]">
            <button
              type="submit"
              className="ss-btn-coral flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Check className="h-4 w-4" /> Save Lot Changes
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove ${form.name} from inventory?`)) {
                    onDelete(form.id);
                    onClose();
                  }
                }}
                className="p-2.5 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                title="Delete Batch"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
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
