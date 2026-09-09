import React, { useState } from 'react'
import { createBatch } from '../../api/batches'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

interface Props {
  storeId?: string
  onClose: () => void
  onSaved: () => void
}

const CATEGORIES = ['Fruit', 'Vegetable', 'Dairy', 'Bakery', 'Meat', 'Seafood', 'Beverage', 'Snack']
const STATES = [
  { value: 'FRESH', label: 'Fresh (Normal Inventory)' },
  { value: 'TIER_1', label: 'Tier 1 — 20% Discount (Near-Expiry)' },
  { value: 'TIER_2', label: 'Tier 2 — 40% Discount (Expiring Soon)' },
  { value: 'TIER_3', label: 'Tier 3 — 60% Discount (Urgent Rescue 🔥)' },
]

export default function AddBatchModal({ storeId, onClose, onSaved }: Props) {
  const { addToast } = useToast()
  const { user, login } = useAuth()

  const [currentStoreId, setCurrentStoreId] = useState(storeId || user?.storeId || '')
  const [form, setForm] = useState({
    productName: '',
    category: 'Fruit',
    quantity: 1,
    unit: 'kg',
    stockedAt: new Date().toISOString().slice(0, 16),
    originalPrice: 100,
    state: 'FRESH',
  })
  const [loading, setLoading] = useState(false)

  function set(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const targetStoreId = currentStoreId.trim() || user?.storeId || undefined
      await createBatch({
        ...form,
        storeId: targetStoreId,
        stockedAt: new Date(form.stockedAt).toISOString(),
      })

      // Update user context if storeId wasn't previously set
      if (user && targetStoreId && !user.storeId) {
        login({ ...user, storeId: targetStoreId })
      }

      addToast('Batch registered successfully! 🎉', 'success')
      onSaved()
    } catch (err: any) {
      addToast(err.response?.data?.message ?? 'Failed to register batch', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">Register New Food Batch 📦</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Store ID input */}
          <div className="form-group">
            <label className="form-label">
              Store ID {!user?.storeId && <span className="text-urgent">*</span>}
            </label>
            <input
              id="batch-store"
              className="form-input"
              placeholder="e.g. store_001 or FreshMart"
              value={currentStoreId}
              onChange={(e) => setCurrentStoreId(e.target.value)}
              required={!user?.storeId}
            />
            <span className="text-xs text-muted" style={{ marginTop: 4 }}>
              The branch/store this batch belongs to.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input
              id="batch-product"
              className="form-input"
              placeholder="e.g. Organic Bananas, Sourdough Bread"
              value={form.productName}
              onChange={(e) => set('productName', e.target.value)}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                id="batch-category"
                className="form-select"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select
                id="batch-unit"
                className="form-select"
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
              >
                <option value="kg">kg</option>
                <option value="unit">units</option>
                <option value="pack">packs</option>
                <option value="liter">liters</option>
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input
                id="batch-qty"
                className="form-input"
                type="number"
                min={0.1}
                step={0.1}
                value={form.quantity}
                onChange={(e) => set('quantity', Number(e.target.value))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Original Price (₹)</label>
              <input
                id="batch-price"
                className="form-input"
                type="number"
                min={0}
                step={0.5}
                value={form.originalPrice}
                onChange={(e) => set('originalPrice', Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Initial Shelf Status</label>
            <select
              id="batch-state"
              className="form-select"
              value={form.state}
              onChange={(e) => set('state', e.target.value)}
            >
              {STATES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <span className="text-xs text-muted" style={{ marginTop: 4 }}>
              If set to Tier 1, 2, or 3, it automatically lists on the Customer Rescue Feed!
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Stocked Date & Time</label>
            <input
              id="batch-stocked"
              className="form-input"
              type="datetime-local"
              value={form.stockedAt}
              onChange={(e) => set('stockedAt', e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary w-full" onClick={onClose}>
              Cancel
            </button>
            <button id="save-batch" type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Registering...' : 'Register Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
