import React, { useState, useEffect } from "react";
import { X, Check, Trash2, Tag, CalendarClock, DollarSign } from "lucide-react";
import { InventoryItem } from "@/data/mockStore";

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

  useEffect(() => {
    if (item) setForm(item);
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
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 ss-reveal">
      <div className="ss-card w-full max-w-lg bg-white dark:bg-[#1F2825] overflow-hidden shadow-2xl border border-[#EAE6DF] dark:border-[#2D3835]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#192220]">
          <div>
            <h3 className="font-bold text-base text-[#2E221F] dark:text-[#F0F4F2]">Edit Inventory Lot</h3>
            <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">SKU: {form.sku}</p>
          </div>
          <button onClick={onClose} className="text-[#8A847E] hover:text-[#2E221F] dark:hover:text-[#F0F4F2]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
