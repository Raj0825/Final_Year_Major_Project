// LiveMapView.tsx - Interactive Leaflet map for FreshRescue
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, RefreshCw, Filter, Store, AlertTriangle, X, ZoomIn, ZoomOut, Clock3, Leaf, Package } from 'lucide-react';
import { loadInventory, loadStores, loadSettings, calculateDistance } from '@/data/mockStore';

function injectLeafletCSS() {
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

function deterministicCoords(seed, baseLat, baseLng) {
  let h1 = 0, h2 = 0;
  for (let i = 0; i < seed.length; i++) {
    h1 = (Math.imul(31, h1) + seed.charCodeAt(i)) | 0;
    h2 = (Math.imul(37, h2) + seed.charCodeAt(i)) | 0;
  }
  return { lat: baseLat + ((Math.abs(h1) % 80) - 40) / 1000, lng: baseLng + ((Math.abs(h2) % 80) - 40) / 1000 };
}

const DC = { lat: 28.6139, lng: 77.209 };

export default function LiveMapView() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const lmRef = useRef<any>(null);
  const mksRef = useRef<any[]>([]);
  const radRef = useRef<any>(null);
  const uMkRef = useRef<any>(null);
  const [settings, setSettings] = useState(() => loadSettings());
  const [inventory, setInventory] = useState(() => loadInventory());
  const [stores, setStores] = useState(() => loadStores());
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [filterMode, setFilterMode] = useState('all');
  const [mapReady, setMapReady] = useState(false);
  const [stats, setStats] = useState({ total: 0, urgent: 0, sw: 0 });

  useEffect(() => {
    const reload = () => { setInventory(loadInventory()); setStores(loadStores()); setSettings(loadSettings()); };
    window.addEventListener('ss_inventory_updated', reload);
    window.addEventListener('ss_stores_updated', reload);
    window.addEventListener('ss_settings_updated', reload);
    return () => {
      window.removeEventListener('ss_inventory_updated', reload);
      window.removeEventListener('ss_stores_updated', reload);
      window.removeEventListener('ss_settings_updated', reload);
    };
  }, []);

  const storePins = stores.map(store => {
    const items = inventory.filter(i => {
      if (i.store && store.name) {
        return i.store.trim().toLowerCase() === store.name.trim().toLowerCase();
      }
      return Boolean(i.storeId && store.id && i.storeId === store.id);
    });
    const urgentCount = items.filter(i => i.expiryHoursLeft <= 24 || i.status === 'Expiring soon').length;
    const centre = userPos || DC;
    const coords = deterministicCoords(store.id + store.name, centre.lat, centre.lng);
    const dist = calculateDistance(settings.userCity || 'Delhi', store.area || store.city || '');
    return { store, items, urgentCount, ...coords, distanceKm: dist.km };
  });

  const filteredPins = storePins.filter(p => {
    if (filterMode === 'urgent') return p.urgentCount > 0;
    if (filterMode === 'available') return p.items.length > 0;
    if (filterMode === 'in-radius') return p.distanceKm <= settings.searchRadiusKm;
    return true;
  });

  useEffect(() => {
    const total = inventory.reduce((s, i) => s + i.available, 0);
    const urgent = inventory.filter(i => i.expiryHoursLeft <= 24 || i.status === 'Expiring soon').length;
    setStats({ total, urgent, sw: storePins.filter(p => p.items.length > 0).length });
  }, [inventory, stores]);

  const fetchGPS = useCallback(() => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported.'); return; }
    setGpsLoading(true); setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      p => { setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGpsLoading(false); },
      e => { setGpsError(e.message || 'Could not get location.'); setGpsLoading(false); },
      { timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    injectLeafletCSS();
    let cancelled = false;
    import('leaflet').then(mod => {
      if (cancelled) return;
      const L = mod.default || mod;
      if (lmRef.current) { lmRef.current.remove(); lmRef.current = null; }
      const c = userPos || DC;
      const map = L.map(mapRef.current, { center: [c.lat, c.lng], zoom: 13, zoomControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OpenStreetMap', maxZoom: 19 }).addTo(map);
      lmRef.current = map;
      setMapReady(true);
    });
    return () => { cancelled = true; if (lmRef.current) { lmRef.current.remove(); lmRef.current = null; } setMapReady(false); };
  }, []);

  useEffect(() => { if (lmRef.current && userPos) lmRef.current.flyTo([userPos.lat, userPos.lng], 14, { animate: true, duration: 1 }); }, [userPos]);

  useEffect(() => {
    if (!mapReady || !lmRef.current) return;
    import('leaflet').then(mod => {
      const L = mod.default || mod;
      const map = lmRef.current;
      mksRef.current.forEach(m => m.remove()); mksRef.current = [];
      if (radRef.current) { radRef.current.remove(); radRef.current = null; }
      if (uMkRef.current) { uMkRef.current.remove(); uMkRef.current = null; }
      const c = userPos || DC;
      const uIcon = L.divIcon({ html: '<div style="width:18px;height:18px;border-radius:50%;background:#4F46E5;border:3px solid #fff;box-shadow:0 0 0 4px rgba(79,70,229,0.3);"></div>', className: '', iconSize: [18,18], iconAnchor: [9,9] });
      uMkRef.current = L.marker([c.lat, c.lng], { icon: uIcon }).addTo(map).bindPopup('<b>You are here</b>');
      if (settings.searchRadiusKm > 0) {
        radRef.current = L.circle([c.lat, c.lng], { radius: settings.searchRadiusKm * 1000, color: '#4F46E5', fillColor: '#4F46E5', fillOpacity: 0.05, dashArray: '6 4', weight: 2 }).addTo(map);
      }
      filteredPins.forEach(pin => {
        const isU = pin.urgentCount > 0;
        const hasI = pin.items.length > 0;
        const bg = isU ? '#EF4444' : hasI ? '#10B981' : '#6B7280';
        const pIcon = L.divIcon({
          html: '<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:' + bg + ';border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.25);color:#fff;font-size:11px;font-weight:700;">' + pin.items.length + '</div>',
          className: '', iconSize: [36,36], iconAnchor: [18,36]
        });
        const mk = L.marker([pin.lat, pin.lng], { icon: pIcon }).addTo(map)
          .bindPopup('<div style="min-width:180px;font-family:Inter,sans-serif"><strong>' + pin.store.name + '</strong><br/><span style="color:#6B7280;font-size:12px">' + (pin.store.location || pin.store.area || '') + '</span><br/><span style="color:#10B981;font-size:12px;font-weight:600">' + pin.items.length + ' items</span></div>');
        mk.on('click', () => setSelected(pin));
        mksRef.current.push(mk);
      });
    });
  }, [mapReady, filteredPins.length, userPos, settings.searchRadiusKm, filterMode]);

  const fBtns = [
    { mode: 'all', label: 'All Stores', color: '#6B7280' },
    { mode: 'available', label: 'Has Items', color: '#10B981' },
    { mode: 'urgent', label: 'Urgent', color: '#EF4444' },
    { mode: 'in-radius', label: 'In Radius', color: '#4F46E5' },
  ];

  return (
    <div className="ss-reveal max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#4F46E5] dark:text-[#818CF8]">LIVE MAP</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">Store Location Map</h1>
          <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1">Real-time view of stores, food availability, and urgent pickups near you.</p>
        </div>
        <button onClick={fetchGPS} disabled={gpsLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4F46E5] text-white text-xs font-bold hover:bg-[#4338CA] transition-all shadow-md cursor-pointer disabled:opacity-60">
          {gpsLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
          {gpsLoading ? 'Getting Location...' : 'Use My GPS Location'}
        </button>
      </div>
      {gpsError && (
        <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-900/20 px-4 py-3 text-sm text-orange-700 dark:text-orange-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span>{gpsError}</span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {[
          { Icon: Store, label: 'Stores With Food', value: stats.sw, color: '#10B981' },
          { Icon: Package, label: 'Total Items', value: stats.total, color: '#4F46E5' },
          { Icon: AlertTriangle, label: 'Urgent Pickups', value: stats.urgent, color: '#EF4444' },
        ].map(({ Icon, label, value, color }) => (
          <div key={label} className="ss-card p-4 bg-white dark:bg-[#1F2825] flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '22' }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="text-xs text-[#7D7670] dark:text-[#A3B2AC]">{label}</p>
              <p className="text-xl font-extrabold text-[#2E221F] dark:text-[#F0F4F2]">{value}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-[#7D7670]" />
        {fBtns.map(({ mode, label, color }) => (
          <button key={mode} onClick={() => setFilterMode(mode)}
            className={'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ' + (filterMode === mode ? 'text-white border-transparent' : 'bg-white dark:bg-[#1F2825] text-[#554F4A] dark:text-[#A3B2AC] border-[#EAE6DF] dark:border-[#2D3835]')}
            style={filterMode === mode ? { background: color } : {}}>
            <span className="h-2 w-2 rounded-full" style={{ background: filterMode === mode ? '#fff' : color }} />
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#8A847E]">{filteredPins.length} / {storePins.length} stores</span>
      </div>
      <div className="flex gap-4" style={{ height: '520px' }}>
        <div className="relative flex-1 rounded-2xl overflow-hidden border border-[#EAE6DF] dark:border-[#2D3835] shadow-lg">
          <div ref={mapRef} className="w-full h-full" />
          <div className="absolute bottom-4 left-4 z-[400] bg-white/90 dark:bg-[#1F2825]/90 backdrop-blur-sm rounded-xl p-3 border border-[#EAE6DF] shadow-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7D7670] mb-2">Legend</p>
            {[{ color: '#4F46E5', label: 'Your location' }, { color: '#10B981', label: 'Store (has items)' }, { color: '#EF4444', label: 'Store (urgent)' }, { color: '#6B7280', label: 'Empty store' }].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 text-[11px] text-[#554F4A] dark:text-[#A3B2AC] mb-1">
                <span className="h-3 w-3 rounded-full" style={{ background: color }} />{label}
              </div>
            ))}
          </div>
          <div className="absolute top-4 right-4 z-[400] flex flex-col gap-1.5">
            <button onClick={() => lmRef.current?.zoomIn()} className="h-8 w-8 flex items-center justify-center rounded-lg bg-white border border-[#EAE6DF] shadow-sm cursor-pointer"><ZoomIn className="h-4 w-4 text-[#554F4A]" /></button>
            <button onClick={() => lmRef.current?.zoomOut()} className="h-8 w-8 flex items-center justify-center rounded-lg bg-white border border-[#EAE6DF] shadow-sm cursor-pointer"><ZoomOut className="h-4 w-4 text-[#554F4A]" /></button>
          </div>
          {storePins.length === 0 && (
            <div className="absolute inset-0 z-[350] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
              <MapPin className="h-10 w-10 text-[#D1CEC8] mb-3" />
              <p className="text-sm font-semibold text-[#7D7670]">No stores registered yet</p>
              <p className="text-xs text-[#9D9590] mt-1">Store managers need to set city in Settings</p>
            </div>
          )}
        </div>
        <div className="w-72 flex flex-col gap-3 overflow-y-auto">
          {selected ? (
            <div className="ss-card p-5 bg-white dark:bg-[#1F2825]">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-[#2E221F] dark:text-[#F0F4F2] text-sm">{selected.store.name}</h3>
                  <p className="text-xs text-[#7D7670] mt-0.5">{selected.store.location || selected.store.area}</p>
                </div>
                <button onClick={() => setSelected(null)} className="h-6 w-6 rounded-full flex items-center justify-center bg-[#F3F2F0] hover:bg-[#EAE6DF] cursor-pointer"><X className="h-3 w-3 text-[#8A847E]" /></button>
              </div>
              <div className="flex gap-2 mb-4">
                <div className="flex-1 rounded-xl bg-[#F8F6F1] dark:bg-[#26312E] p-2.5 text-center"><p className="text-[10px] text-[#7D7670]">Items</p><p className="text-lg font-extrabold text-[#2E221F] dark:text-[#F0F4F2]">{selected.items.length}</p></div>
                <div className="flex-1 rounded-xl bg-red-50 p-2.5 text-center"><p className="text-[10px] text-red-500">Urgent</p><p className="text-lg font-extrabold text-red-600">{selected.urgentCount}</p></div>
              </div>
              {selected.items.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#7D7670] mb-1">Items</p>
                  {selected.items.slice(0, 6).map(item => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl bg-[#F8F6F1] dark:bg-[#26312E] px-3 py-2">
                      <div><p className="text-xs font-semibold text-[#2E221F] dark:text-[#F0F4F2]">{item.name}</p><p className="text-[10px] text-[#8A847E]">{item.available} {item.unit}</p></div>
                      <div className="text-right"><p className="text-xs font-bold text-[#10B981]">Rs.{item.currentPrice}</p>{(item.expiryHoursLeft <= 24 || item.status === 'Expiring soon') && <span className="text-[9px] font-bold text-red-500">URGENT</span>}</div>
                    </div>
                  ))}
                  {selected.items.length > 6 && <p className="text-xs text-center text-[#8A847E]">+{selected.items.length - 6} more</p>}
                </div>
              ) : (<p className="text-xs text-center text-[#8A847E] py-3">No items currently listed</p>)}
            </div>
          ) : (
            <div className="ss-card p-4 bg-white dark:bg-[#1F2825]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#7D7670] mb-2">Nearby Stores</p>
              <p className="text-xs text-[#8A847E]">Click a map pin to see store details.</p>
            </div>
          )}
          <div className="space-y-2 overflow-y-auto flex-1">
            {filteredPins.length === 0 ? (
              <div className="ss-card p-4 bg-white dark:bg-[#1F2825] text-center"><p className="text-xs text-[#8A847E]">No stores match filter.</p></div>
            ) : filteredPins.map(pin => (
              <button key={pin.store.id}
                onClick={() => { setSelected(pin); if (lmRef.current) lmRef.current.flyTo([pin.lat, pin.lng], 15, { animate: true }); }}
                className="w-full text-left ss-card p-3.5 bg-white dark:bg-[#1F2825] hover:bg-[#F8F6F1] dark:hover:bg-[#26312E] transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="min-w-0"><p className="text-xs font-bold text-[#2E221F] dark:text-[#F0F4F2] truncate">{pin.store.name}</p><p className="text-[10px] text-[#8A847E] truncate">{pin.store.city || pin.store.area}</p></div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2" style={{ background: pin.urgentCount > 0 ? '#FEE2E2' : pin.items.length > 0 ? '#D1FAE5' : '#F3F4F6', color: pin.urgentCount > 0 ? '#DC2626' : pin.items.length > 0 ? '#059669' : '#6B7280' }}>
                    {pin.urgentCount > 0 ? pin.urgentCount + ' urgent' : pin.items.length > 0 ? pin.items.length + ' items' : 'Empty'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-[#8A847E] pt-1">
        <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Live updates as stores add inventory</span>
        <span className="flex items-center gap-1"><Leaf className="h-3 w-3 text-[#10B981]" /> Radius: {settings.searchRadiusKm} km</span>
      </div>
    </div>
  );
}
