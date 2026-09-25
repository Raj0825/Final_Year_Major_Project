import React, { useState } from "react";
import { X, Sparkles, MapPin, Clock, ShieldCheck, Check, ShoppingBag, Minus, Plus } from "lucide-react";
import { InventoryItem } from "@/data/mockStore";

interface ProductDetailModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onReserve: (item: InventoryItem, qty: number) => void;
}

export function ProductDetailModal({ item, isOpen, onClose, onReserve }: ProductDetailModalProps) {
  if (!isOpen || !item) return null;

  const [qty, setQty] = useState(1);
  const savings = ((item.originalPrice - item.currentPrice) * qty).toFixed(2);
  const total = (item.currentPrice * qty).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 ss-reveal">
      <div className="ss-card w-full max-w-lg bg-white dark:bg-[#1F2825] overflow-hidden shadow-2xl border border-[#EAE6DF] dark:border-[#2D3835]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#192220]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#00897B] dark:text-[#2DD4BF] uppercase tracking-wider">
              {item.category} • {item.sku}
            </span>
          </div>
          <button onClick={onClose} className="text-[#8A847E] hover:text-[#2E221F] dark:hover:text-[#F0F4F2]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Title and Freshness */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2]">{item.name}</h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-[#7A746E] dark:text-[#A3B2AC]">
                <MapPin className="h-3.5 w-3.5 text-[#00897B] dark:text-[#2DD4BF]" />
                <span>{item.store} • {item.distance}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#8A847E] line-through block">₹{item.originalPrice}</span>
              <span className="text-2xl font-black text-[#FF6548]">₹{item.currentPrice}</span>
              <span className="text-[11px] text-[#7A746E] dark:text-[#A3B2AC] block">/ {item.unit.replace(/s$/, "")}</span>
            </div>
          </div>

          {/* AI Inspection Card */}
          <div className="p-4 rounded-2xl bg-[#E8F8F4] dark:bg-[#18332B]/60 border border-[#C4EFE4] dark:border-[#214C3F] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white dark:bg-[#1F2825] text-[#00897B] dark:text-[#2DD4BF] shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#00897B] dark:text-[#2DD4BF]">AI CNN Freshness Verified</p>
                <p className="text-[11px] text-[#2D2320] dark:text-[#E2E8E5] mt-0.5">
                  MobileNetV2 quality rating: <strong>{Math.round(item.freshnessScore * 100)}% fresh</strong>
                </p>
              </div>
            </div>
            <span className="ss-chip badge-available">Certified Quality</span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#161D1B]">
              <span className="text-[#8A847E] dark:text-[#73827E] block">Pickup Deadline</span>
              <span className="font-bold text-[#2D2320] dark:text-[#E2E8E5] mt-0.5 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-[#FF6548]" /> {item.pickupDeadline}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#161D1B]">
              <span className="text-[#8A847E] dark:text-[#73827E] block">Stock Available</span>
              <span className="font-bold text-[#2D2320] dark:text-[#E2E8E5] mt-0.5 block">
                {item.available} {item.unit}
              </span>
            </div>
          </div>

          {/* Storage Tips */}
          {item.storageTip && (
            <div className="p-3.5 rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] text-xs space-y-1">
              <span className="font-bold text-[#2D2320] dark:text-[#E2E8E5] flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#00897B] dark:text-[#2DD4BF]" /> Storage & Consumption Tip:
              </span>
              <p className="text-[#65605A] dark:text-[#A3B2AC]">{item.storageTip}</p>
            </div>
          )}

          {/* Quantity Selector & Summary */}
          <div className="p-4 rounded-2xl bg-[#FAF8F5] dark:bg-[#192220] border border-[#EAE6DF] dark:border-[#2D3835] flex items-center justify-between">
            <div>
              <span className="text-xs text-[#7A746E] dark:text-[#A3B2AC]">Select Quantity ({item.unit})</span>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex items-center border border-[#EAE6DF] dark:border-[#2D3835] rounded-xl bg-white dark:bg-[#1F2825] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="p-2 hover:bg-[#FAF8F5] dark:hover:bg-[#2A3532] text-[#554F4A] dark:text-[#E2E8E5] cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-3.5 py-1 text-sm font-bold text-[#2D2320] dark:text-[#F0F4F2] min-w-[32px] text-center">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(Math.min(item.available, qty + 1))}
                    className="p-2 hover:bg-[#FAF8F5] dark:hover:bg-[#2A3532] text-[#554F4A] dark:text-[#E2E8E5] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-[#00897B] font-semibold block">You save ₹{savings}</span>
              <span className="text-2xl font-black text-[#FF6548]">₹{total}</span>
              <span className="text-[10px] text-[#7A746E] block">Pay at store counter</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                onReserve(item, qty);
                onClose();
              }}
              className="ss-btn-coral flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <ShoppingBag className="h-4 w-4" /> Reserve & Generate Pass
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ss-btn-soft px-4 py-3 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
