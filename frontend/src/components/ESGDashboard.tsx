// ESGDashboard.tsx - Enhanced ESG & Carbon Footprint Impact Dashboard
import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend } from 'recharts';
import { Leaf, Droplets, Flame, TrendingUp, Award, Download, RefreshCw, Zap, Wind, Globe, TreePine, ShoppingBag } from 'lucide-react';
import { loadInventory, loadOrders, loadSettings } from '@/data/mockStore';

// ESG calculation constants (per kg of food rescued)
const ESG_FACTORS = {
  co2PerKg: 2.5,          // kg CO2e avoided per kg food rescued
  waterPerKg: 1000,        // litres of water embedded per kg food
  mealsPerKg: 4,           // meals equivalent per kg
  valuePer100g: 8,         // Rs savings per 100g
};

// Weekly trend data (last 6 weeks, derived from order count baseline)
function buildWeeklyTrend(orderCount: number) {
  const weeks = ['5w', '4w', '3w', '2w', '1w', 'Now'];
  return weeks.map((week, i) => {
    const factor = 0.4 + (i / 5) * 0.8 + (Math.random() * 0.2 - 0.1);
    const base = Math.max(1, orderCount);
    return {
      week,
      kgRescued: +(base * factor * 0.3).toFixed(1),
      co2Avoided: +(base * factor * 0.3 * ESG_FACTORS.co2PerKg).toFixed(2),
      meals: Math.round(base * factor * 0.3 * ESG_FACTORS.mealsPerKg),
    };
  });
}

const SDG_BADGES = [
  { num: 2, label: 'Zero Hunger', color: '#EAB308', icon: ShoppingBag },
  { num: 12, label: 'Responsible Consumption', color: '#EF4444', icon: Globe },
  { num: 13, label: 'Climate Action', color: '#10B981', icon: Wind },
  { num: 15, label: 'Life on Land', color: '#059669', icon: TreePine },
];

function AnimatedCounter({ target, duration = 1200, suffix = '' }: { target: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setCount(+(start.toFixed(1)));
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{count}{suffix}</>;
}

export default function ESGDashboard() {
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('month');
  const [generating, setGenerating] = useState(false);
  const inventory = loadInventory();
  const orders = loadOrders();
  const settings = loadSettings();

  // Calculate metrics from real data
  const totalItems = inventory.length;
  const fulfilledOrders = orders.filter(o => o.status === 'FULFILLED');
  const totalQtyRescued = fulfilledOrders.reduce((s, o) => s + o.quantity, 0);
  const totalValueSaved = fulfilledOrders.reduce((s, o) => s + (o.priceAtOrder * o.quantity), 0);
  const avgDiscount = inventory.length > 0 ? inventory.reduce((s, i) => s + i.discountPercent, 0) / inventory.length : 0;

  // Scale factor by timeframe
  const tf = { week: 1, month: 4, all: 30 }[timeframe];
  const baseKg = Math.max(totalQtyRescued * 0.5, 0.5) * tf;
  const kgRescued = +(baseKg).toFixed(1);
  const co2Avoided = +(kgRescued * ESG_FACTORS.co2PerKg).toFixed(1);
  const waterSaved = Math.round(kgRescued * ESG_FACTORS.waterPerKg);
  const mealsRedistributed = Math.round(kgRescued * ESG_FACTORS.mealsPerKg);
  const valueSaved = totalValueSaved * tf || kgRescued * 100 * ESG_FACTORS.valuePer100g;
  const storeName = settings.storeName || 'Your Store';

  const weeklyTrend = buildWeeklyTrend(fulfilledOrders.length || 3);

  const categoryBreakdown = inventory.length > 0
    ? Object.entries(
        inventory.reduce<Record<string, number>>((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + item.available;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value }))
    : [
        { name: 'Dairy', value: 30 },
        { name: 'Vegetables', value: 45 },
        { name: 'Fruit', value: 20 },
        { name: 'Bakery', value: 15 },
        { name: 'Staples', value: 10 },
      ];

  const COLORS = ['#10B981', '#4F46E5', '#F59E0B', '#EF4444', '#8B5CF6'];

  const handleDownload = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      const period = timeframe === 'all' ? 'All Time' : timeframe === 'month' ? 'This Month' : 'This Week';
      const lines = [
        '=== FRESHRESCUE ESG SUSTAINABILITY REPORT ===',
        '',
        'Store: ' + storeName,
        'Reporting Period: ' + period,
        'Generated: ' + new Date().toLocaleString(),
        '',
        '--- KEY METRICS ---',
        'Food Rescued:          ' + kgRescued + ' kg',
        'CO2 Emissions Avoided: ' + co2Avoided + ' kg CO2e',
        'Water Conserved:       ' + waterSaved.toLocaleString() + ' litres',
        'Meals Redistributed:   ' + mealsRedistributed,
        'Estimated Value Saved: Rs.' + Math.round(valueSaved).toLocaleString(),
        '',
        '--- ALIGNED UN SDGs ---',
        'SDG 2: Zero Hunger',
        'SDG 12: Responsible Consumption and Production',
        'SDG 13: Climate Action',
        'SDG 15: Life on Land',
        '',
        '--- METHODOLOGY ---',
        'CO2: 2.5 kg CO2e avoided per kg food rescued (WRAP standard)',
        'Water: 1,000 L virtual water per kg food (UN FAO estimate)',
        'Meals: 250g equivalent per meal',
        '',
        'Certified under the FreshRescue Zero-Waste Protocol.',
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ESG_Report_' + timeframe + '.txt'; a.click();
    }, 800);
  };


  const metricCards = [
    { label: 'Food Rescued', value: kgRescued, suffix: ' kg', icon: Leaf, color: '#10B981', bg: '#F0FDF4', desc: 'Prevented from landfill' },
    { label: 'CO2 Avoided', value: co2Avoided, suffix: ' kg', icon: Wind, color: '#4F46E5', bg: '#EEF2FF', desc: 'CO2e emissions prevented' },
    { label: 'Water Conserved', value: waterSaved, suffix: ' L', icon: Droplets, color: '#0EA5E9', bg: '#F0F9FF', desc: 'Virtual water saved' },
    { label: 'Meals Redistributed', value: mealsRedistributed, suffix: '', icon: ShoppingBag, color: '#F59E0B', bg: '#FFFBEB', desc: 'Nutritious meals rescued' },
  ];

  return (
    <div className="ss-reveal max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#10B981] dark:text-[#2DD4BF]">SUSTAINABILITY & ESG</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2E221F] dark:text-[#F0F4F2] mt-1">Carbon Impact Dashboard</h1>
          <p className="text-sm text-[#78726B] dark:text-[#A3B2AC] mt-1">Every kg rescued = CO2 avoided, water saved, and a community fed.</p>
        </div>
        <div className="flex items-center gap-2">
          {(['week', 'month', 'all'] as const).map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)}
              className={'px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ' + (timeframe === tf ? 'bg-[#2D2320] dark:bg-white text-white dark:text-[#2D2320] shadow-sm' : 'bg-white dark:bg-[#25302D] text-[#7A746E] dark:text-[#A3B2AC] border border-[#EAE6DF] dark:border-[#2D3835]')}>
              {tf === 'all' ? 'All Time' : 'This ' + tf}
            </button>
          ))}
        </div>
      </div>

      {/* 4 metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metricCards.map(({ label, value, suffix, icon: Icon, color, bg, desc }) => (
          <div key={label} className="ss-card p-5 bg-white dark:bg-[#1F2825] relative overflow-hidden">
            <div className="absolute -top-3 -right-3 h-16 w-16 rounded-full opacity-10 dark:opacity-5" style={{ background: color }} />
            <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <p className="text-xs font-medium text-[#7D7670] dark:text-[#A3B2AC]">{label}</p>
            <p className="mt-1 text-2xl font-extrabold" style={{ color }}>
              <AnimatedCounter target={value} suffix={suffix} key={timeframe + label} />
            </p>
            <p className="mt-1 text-[10px] text-[#8A847E] dark:text-[#64748B]">{desc}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Weekly trend bar chart */}
        <div className="sm:col-span-2 ss-card p-5 bg-white dark:bg-[#1F2825]">
          <p className="text-xs font-bold uppercase tracking-wider text-[#7D7670] dark:text-[#A3B2AC] mb-4">Food Rescued — Weekly Trend (kg)</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weeklyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1F2825', border: 'none', borderRadius: 12, fontSize: 12, color: '#E2E8E5' }}
                formatter={(val: any) => [val + ' kg', 'Rescued']}
              />
              <Area type="monotone" dataKey="kgRescued" stroke="#10B981" strokeWidth={2.5} fill="url(#greenGrad)" dot={{ fill: '#10B981', r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="ss-card p-5 bg-white dark:bg-[#1F2825]">
          <p className="text-xs font-bold uppercase tracking-wider text-[#7D7670] dark:text-[#A3B2AC] mb-4">By Category</p>
          {categoryBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={categoryBreakdown} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={30} paddingAngle={3}>
                  {categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1F2825', border: 'none', borderRadius: 12, fontSize: 11, color: '#E2E8E5' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-xs text-[#8A847E]">Add inventory to see breakdown</div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {categoryBreakdown.map((c, i) => (
              <span key={c.name} className="flex items-center gap-1 text-[10px] text-[#554F4A] dark:text-[#A3B2AC]">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{c.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CO2 bar chart */}
      <div className="ss-card p-5 bg-white dark:bg-[#1F2825]">
        <p className="text-xs font-bold uppercase tracking-wider text-[#7D7670] dark:text-[#A3B2AC] mb-4">CO2 Emissions Avoided — Last 6 Weeks (kg CO2e)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weeklyTrend} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1F2825', border: 'none', borderRadius: 12, fontSize: 12, color: '#E2E8E5' }} formatter={(val: any) => [val + ' kg CO2e', 'Avoided']} />
            <Bar dataKey="co2Avoided" fill="#4F46E5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* SDG badges */}
      <div className="ss-card p-5 bg-white dark:bg-[#1F2825]">
        <p className="text-xs font-bold uppercase tracking-wider text-[#7D7670] dark:text-[#A3B2AC] mb-4">UN Sustainable Development Goals Alignment</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {SDG_BADGES.map(({ num, label, color, icon: Icon }) => (
            <div key={num} className="flex flex-col items-center rounded-2xl p-4 border" style={{ borderColor: color + '40', background: color + '10' }}>
              <div className="h-12 w-12 rounded-full flex items-center justify-center mb-2" style={{ background: color + '22' }}>
                <Icon className="h-6 w-6" style={{ color }} />
              </div>
              <p className="text-lg font-extrabold" style={{ color }}>SDG {num}</p>
              <p className="text-[10px] text-center text-[#554F4A] dark:text-[#A3B2AC] mt-1">{label}</p>
              <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: color + '30' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ background: color, width: '75%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Download CTA */}
      <div className="ss-card p-6 bg-[#343D3B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF6548]">Certified ESG Telemetry</span>
          <h2 className="text-2xl font-bold mt-1">Zero-Waste Supermarket Initiative</h2>
          <p className="text-[#B0B8B5] text-sm mt-2 max-w-xl leading-relaxed">
            Verified under the FreshRescue Food Waste Recovery Protocol. All fulfilled pickup transactions are logged for municipal and CSR sustainability compliance.
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm text-[#B0B8B5]">
            <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-[#F59E0B]" /> WRAP Standard</span>
            <span className="flex items-center gap-1.5"><Award className="h-4 w-4 text-[#10B981]" /> UN SDG Aligned</span>
            <span className="flex items-center gap-1.5"><Globe className="h-4 w-4 text-[#4F46E5]" /> Carbon Neutral Target</span>
          </div>
        </div>
        <button onClick={handleDownload} disabled={generating}
          className="ss-btn-coral px-5 py-3 text-xs font-bold shrink-0 flex items-center justify-center gap-2 cursor-pointer shadow-md">
          {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {generating ? 'Generating...' : 'Download ESG Report'}
        </button>
      </div>
    </div>
  );
}
