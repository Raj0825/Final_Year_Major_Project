import React from "react";
import { X, CheckCircle2, QrCode, Store, Printer, Share2, MapPin, Clock, Package } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { StoreOrder } from "@/data/mockStore";

interface ReceiptModalProps {
  order: StoreOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptModal({ order, isOpen, onClose }: ReceiptModalProps) {
  if (!isOpen || !order) return null;

  const isFulfilled = order.status === "FULFILLED";
  const passCode = order.qrCode || order.id.slice(-6).toUpperCase();

  const handlePrint = () => window.print();

  const handleWhatsAppShare = () => {
    const msg = `🛒 *SmartSurplus Pickup Pass*\n\n` +
      `Product: *${order.productName}*\n` +
      `Store: ${order.storeName}\n` +
      `Quantity: ${order.quantity} ${order.unit}\n` +
      `Amount: ₹${order.priceAtOrder.toFixed(2)}\n` +
      `Pass Code: *${passCode}*\n\n` +
      `Show this pass at the store counter to collect your order. Thank you for reducing food waste! 🌱`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleGoogleMapsStore = () => {
    const q = order.storeLocation || order.storeName;
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(q)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 ss-reveal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ss-card w-full max-w-md bg-white dark:bg-[#1F2825] overflow-hidden shadow-2xl border border-[#EAE6DF] dark:border-[#2D3835] max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#192220]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#FF6548] bg-[#FDF2EF] dark:bg-[#382420] px-2.5 py-1 rounded-md">
              PASS #{passCode}
            </span>
            {isFulfilled && (
              <span className="text-xs font-bold text-[#00897B] dark:text-[#2DD4BF] bg-[#E8F8F4] dark:bg-[#18332B] px-2 py-0.5 rounded-full">✓ Collected</span>
            )}
          </div>
          <button onClick={onClose} className="text-[#8A847E] hover:text-[#2E221F] dark:hover:text-[#F0F4F2] cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Status Banner */}
          <div className="text-center">
            {isFulfilled ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F8F4] dark:bg-[#18332B] text-[#00897B] dark:text-[#2DD4BF] text-xs font-bold mb-2">
                <CheckCircle2 className="h-4 w-4" /> Order Fulfilled & Collected
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF2EC] dark:bg-[#362920] text-[#9C674E] dark:text-[#F6AA84] text-xs font-bold mb-2">
                <QrCode className="h-4 w-4" /> Active — Ready for Pickup
              </div>
            )}
            <h3 className="text-xl font-black text-[#2E221F] dark:text-[#F0F4F2]">{order.productName}</h3>
            <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">Reserved by {order.customerName}</p>
          </div>

          {/* QR Code */}
          <div className="p-5 bg-white dark:bg-[#25302D] rounded-2xl border border-[#EAE6DF] dark:border-[#2D3835] shadow-xs flex flex-col items-center justify-center">
            <QRCodeSVG value={passCode} size={160} level="M" includeMargin />
            <p className="mt-3 font-mono text-2xl font-bold tracking-widest text-[#FF6548]">{passCode}</p>
            <p className="text-[10px] text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">Show QR or Pass Code at checkout counter</p>
          </div>

          {/* Order Details */}
          <div className="rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#161D1B] divide-y divide-[#EAE6DF] dark:divide-[#2D3835] text-xs">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-[#7A746E] dark:text-[#A3B2AC]"><Store className="h-3.5 w-3.5" /> Store</span>
              <strong className="text-[#2D2320] dark:text-[#E2E8E5]">{order.storeName}</strong>
            </div>
            {order.storeLocation && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-[#7A746E] dark:text-[#A3B2AC]"><MapPin className="h-3.5 w-3.5" /> Address</span>
                <span className="text-[#2D2320] dark:text-[#E2E8E5] text-right max-w-[55%]">{order.storeLocation}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-[#7A746E] dark:text-[#A3B2AC]"><Package className="h-3.5 w-3.5" /> Quantity</span>
              <strong className="text-[#2D2320] dark:text-[#E2E8E5]">{order.quantity} {order.unit}</strong>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-[#7A746E] dark:text-[#A3B2AC]"><Clock className="h-3.5 w-3.5" /> Reserved</span>
              <span className="text-[#2D2320] dark:text-[#E2E8E5]">{new Date(order.reservedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {order.pickupTime && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-[#7A746E] dark:text-[#A3B2AC]"><Clock className="h-3.5 w-3.5" /> Pickup</span>
                <span className="text-[#2D2320] dark:text-[#E2E8E5]">{order.pickupTime}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-2.5 font-bold text-sm">
              <span className="text-[#2E221F] dark:text-[#F0F4F2]">Amount to Pay</span>
              <span className="text-[#FF6548]">₹{order.priceAtOrder.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#128C7E] dark:text-[#25D366] font-semibold text-xs hover:bg-[#25D366]/20 transition-all cursor-pointer"
            >
              <Share2 className="h-4 w-4" /> Share on WhatsApp
            </button>
            <button
              onClick={handleGoogleMapsStore}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#4285F4]/10 border border-[#4285F4]/30 text-[#4285F4] font-semibold text-xs hover:bg-[#4285F4]/20 transition-all cursor-pointer"
            >
              <MapPin className="h-4 w-4" /> Open in Maps
            </button>
            <button
              onClick={handlePrint}
              className="ss-btn-soft py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print Pass
            </button>
            <button
              onClick={onClose}
              className="ss-btn-coral py-2.5 text-xs font-semibold cursor-pointer"
            >
              Done ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
