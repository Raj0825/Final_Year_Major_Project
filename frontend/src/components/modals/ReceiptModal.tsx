import React from "react";
import { X, CheckCircle2, QrCode, Download, Store, Calendar, MapPin, Printer } from "lucide-react";
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 ss-reveal">
      <div className="ss-card w-full max-w-md bg-white dark:bg-[#1F2825] overflow-hidden shadow-2xl border border-[#EAE6DF] dark:border-[#2D3835]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#192220]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#FF6548] bg-[#FDF2EF] dark:bg-[#382420] px-2.5 py-1 rounded-md">
              PASS #{order.qrCode || order.id.slice(-6).toUpperCase()}
            </span>
          </div>
          <button onClick={onClose} className="text-[#8A847E] hover:text-[#2E221F] dark:hover:text-[#F0F4F2]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Status Badge */}
          <div className="text-center">
            {isFulfilled ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F8F4] dark:bg-[#18332B] text-[#00897B] dark:text-[#2DD4BF] text-xs font-bold mb-2">
                <CheckCircle2 className="h-4 w-4" /> Order Fulfilled & Collected
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF2EC] dark:bg-[#362920] text-[#9C674E] dark:text-[#F6AA84] text-xs font-bold mb-2">
                <QrCode className="h-4 w-4" /> Active Reservation — Ready at Counter
              </div>
            )}
            <h3 className="text-xl font-black text-[#2E221F] dark:text-[#F0F4F2]">{order.productName}</h3>
            <p className="text-xs text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">Recipient: {order.customerName}</p>
          </div>

          {/* QR Code */}
          <div className="p-4 bg-white dark:bg-[#25302D] rounded-2xl border border-[#EAE6DF] dark:border-[#2D3835] shadow-xs flex flex-col items-center justify-center">
            <QRCodeSVG value={order.qrCode || order.id} size={150} level="M" />
            <p className="mt-2 font-mono text-xl font-bold tracking-widest text-[#FF6548]">{order.qrCode || order.id.slice(-6).toUpperCase()}</p>
            <p className="text-[10px] text-[#7A746E] dark:text-[#A3B2AC] mt-0.5">Show this at checkout counter</p>
          </div>

          {/* Order Details Table */}
          <div className="rounded-xl border border-[#EAE6DF] dark:border-[#2D3835] bg-[#FAF8F5] dark:bg-[#161D1B] p-3.5 text-xs space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-[#EAE6DF] dark:border-[#2D3835]">
              <span className="text-[#7A746E] dark:text-[#A3B2AC]">Pickup Location</span>
              <strong className="text-[#2D2320] dark:text-[#E2E8E5]">{order.storeName}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#7A746E] dark:text-[#A3B2AC]">Quantity Rescued</span>
              <strong className="text-[#2D2320] dark:text-[#E2E8E5]">{order.quantity} {order.unit}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#7A746E] dark:text-[#A3B2AC]">Reserved Date & Time</span>
              <span className="text-[#2D2320] dark:text-[#E2E8E5]">{new Date(order.reservedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#EAE6DF] dark:border-[#2D3835] text-sm font-bold">
              <span className="text-[#2E221F] dark:text-[#F0F4F2]">Amount Due / Paid</span>
              <span className="text-[#FF6548]">₹{order.priceAtOrder.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handlePrint}
              className="ss-btn-soft flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="ss-btn-coral px-6 py-2.5 text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
