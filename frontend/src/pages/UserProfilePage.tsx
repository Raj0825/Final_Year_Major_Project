import React, { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { getMyProfile, updateMyProfile } from '../api/users'
import type { UserProfile } from '../types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const AVAILABLE_CATEGORIES = [
  'Bakery',
  'Dairy & Eggs',
  'Fruits & Vegetables',
  'Prepared Meals',
  'Meat & Seafood',
  'Beverages',
  'Snacks & Packaged',
]

export default function UserProfilePage() {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [radiusKm, setRadiusKm] = useState<number>(5)
  const [categories, setCategories] = useState<string[]>([])
  const [latitude, setLatitude] = useState<number | ''>('')
  const [longitude, setLongitude] = useState<number | ''>('')
  const [storeId, setStoreId] = useState('')

  useEffect(() => {
    getMyProfile()
      .then((p) => {
        setProfile(p)
        setName(p.name || '')
        setRadiusKm(p.notificationRadiusKm || 5)
        setCategories(p.preferredCategories || [])
        setLatitude(p.latitude ?? '')
        setLongitude(p.longitude ?? '')
        setStoreId(p.storeId || '')
      })
      .catch((err) => {
        addToast(err.response?.data?.message || 'Failed to load profile', 'error')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleToggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by your browser', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude)
        setLongitude(pos.coords.longitude)
        addToast('Location updated from GPS!', 'success')
      },
      (err) => {
        addToast('Unable to retrieve location: ' + err.message, 'error')
      }
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateMyProfile({
        name,
        notificationRadiusKm: radiusKm,
        preferredCategories: categories,
        latitude: latitude === '' ? undefined : Number(latitude),
        longitude: longitude === '' ? undefined : Number(longitude),
        storeId: storeId || undefined,
      })
      setProfile(updated)
      addToast('Profile preferences saved successfully!', 'success')
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const isStore = user?.role === 'STORE_MANAGER' || user?.role === 'STORE_STAFF'

  return (
    <AppLayout>
      <div className="page-header">
        <h1 className="page-title">My Profile & Preferences 👤</h1>
        <p className="page-subtitle">Manage your account details and rescue notification preferences.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }} className="text-muted">Loading profile...</div>
      ) : !profile ? (
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <div>Unable to load profile data</div>
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Account Basics */}
          <div className="card card-body">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Account Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="text-xs text-muted font-semibold">Full Name</label>
                <input
                  className="w-full mt-2"
                  style={{ padding: '10px 14px' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs text-muted font-semibold">Email Address</label>
                <input
                  className="w-full mt-2"
                  style={{ padding: '10px 14px', opacity: 0.6, cursor: 'not-allowed' }}
                  value={profile.email}
                  disabled
                />
              </div>

              <div className="flex gap-4">
                <div style={{ flex: 1 }}>
                  <label className="text-xs text-muted font-semibold">Role</label>
                  <input
                    className="w-full mt-2"
                    style={{ padding: '10px 14px', opacity: 0.6, cursor: 'not-allowed' }}
                    value={profile.role}
                    disabled
                  />
                </div>
                {isStore && (
                  <div style={{ flex: 1 }}>
                    <label className="text-xs text-muted font-semibold">Assigned Store ID</label>
                    <input
                      className="w-full mt-2"
                      style={{ padding: '10px 14px' }}
                      value={storeId}
                      onChange={(e) => setStoreId(e.target.value)}
                      placeholder="e.g. store_001"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rescue Notification & Discovery Preferences (for Buyers/NGOs) */}
          {!isStore && (
            <div className="card card-body">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Rescue Notification Settings</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <div className="flex justify-between text-sm">
                    <label className="font-semibold">Notification Radius</label>
                    <span className="text-accent font-bold">{radiusKm} km</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full mt-2"
                    style={{ cursor: 'pointer' }}
                  />
                  <div className="text-xs text-muted mt-2">
                    Receive urgent discounts & alerts for stores within this distance from your location.
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted font-semibold">Preferred Food Categories</label>
                  <div className="filter-bar mt-2">
                    {AVAILABLE_CATEGORIES.map((cat) => {
                      const selected = categories.includes(cat)
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`filter-chip${selected ? ' active' : ''}`}
                          onClick={() => handleToggleCategory(cat)}
                        >
                          {selected ? '✓ ' : '+ '}{cat}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-muted font-semibold">Location Coordinates</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleDetectLocation}
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    >
                      📍 Detect GPS
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <div style={{ flex: 1 }}>
                      <input
                        type="number"
                        step="any"
                        placeholder="Latitude"
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
                        placeholder="Longitude"
                        className="w-full"
                        style={{ padding: '10px 14px' }}
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Profile Preferences'}
          </button>
        </form>
      )}
    </AppLayout>
  )
}
