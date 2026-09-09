import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import { registerStore } from '../api/stores'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function StoreRegisterPage() {
  const navigate = useNavigate()
  const { login, user } = useAuth()
  const { addToast } = useToast()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [latitude, setLatitude] = useState<number | ''>('')
  const [longitude, setLongitude] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by your browser', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude)
        setLongitude(pos.coords.longitude)
        addToast('Store GPS coordinates acquired!', 'success')
      },
      (err) => {
        addToast('Location error: ' + err.message, 'error')
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const store = await registerStore({
        name,
        address,
        phone,
        latitude: latitude === '' ? undefined : Number(latitude),
        longitude: longitude === '' ? undefined : Number(longitude),
      })

      if (user) {
        login({
          ...user,
          storeId: store.id,
        })
      }

      addToast(`Store "${store.name}" registered successfully! Store ID: ${store.id}`, 'success')
      navigate('/store/dashboard')
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to register store', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">Register Your Store 🏪</h1>
        <p className="page-subtitle">
          Set up your store location so local buyers and NGOs can find and rescue your discounted items.
        </p>
      </div>

      <div style={{ maxWidth: 600 }}>
        <div className="card card-body">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="text-xs text-muted font-semibold">Store / Branch Name *</label>
              <input
                className="w-full mt-2"
                style={{ padding: '10px 14px' }}
                placeholder="e.g. FreshMart Metro Center"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs text-muted font-semibold">Physical Address *</label>
              <textarea
                className="w-full mt-2"
                style={{ padding: '10px 14px', minHeight: 80 }}
                placeholder="Street address, building, city, postal code"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs text-muted font-semibold">Contact Phone Number</label>
              <input
                className="w-full mt-2"
                style={{ padding: '10px 14px' }}
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-muted font-semibold">Geographical Coordinates (for Map & Nearby Feed)</label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDetectLocation}
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  📍 Get Current GPS
                </button>
              </div>
              <div className="flex gap-3">
                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    step="any"
                    placeholder="Latitude (e.g. 12.9716)"
                    className="w-full"
                    style={{ padding: '10px 14px' }}
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    step="any"
                    placeholder="Longitude (e.g. 77.5946)"
                    className="w-full"
                    style={{ padding: '10px 14px' }}
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="text-xs text-muted mt-2">
                Coordinates enable real-time distance calculation for buyers within your notification radius.
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? 'Creating store...' : '🏪 Register Store & Open Dashboard'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
