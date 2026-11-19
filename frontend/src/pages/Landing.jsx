import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { subscriptionsAPI } from '@/api'
import {
  CheckCircle, ArrowRight, IndianRupee, Shield, TrendingUp, Smartphone,
  Users, Store, Scissors, Pill, ShoppingBag, BarChart2, Package,
  Receipt, ChefHat, Star, Zap, Globe, Lock,
} from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import EnquiryModal from '@/components/EnquiryModal'

const FEATURE_LABELS = {
  billing: 'Counter Billing', table_billing: 'Table Billing',
  kot: 'KOT & Kitchen Display', inventory: 'Inventory Management',
  basic_reports: 'Basic Reports', advanced_reports: 'Advanced Reports',
  multi_outlet: 'Multi-Outlet Support', custom_reports: 'Custom Reports',
  api_access: 'API Access', priority_support: 'Priority Support',
  purchases: 'Purchase Management', expenses: 'Expense Tracking',
}

const BUSINESS_TYPES = [
  {
    icon: ChefHat,
    label: 'Bar & Restaurant',
    color: 'text-orange-600 bg-orange-50',
    features: ['Table & counter billing', 'KOT system', 'Multi-bar inventory', 'Recipe costing'],
  },
  {
    icon: Scissors,
    label: 'Salon & Spa',
    color: 'text-pink-600 bg-pink-50',
    features: ['Service & package billing', 'Staff performance tracking', 'Coupon management', 'Appointment summaries'],
  },
  {
    icon: ShoppingBag,
    label: 'Retail Shop',
    color: 'text-blue-600 bg-blue-50',
    features: ['Quick counter billing', 'Product catalog', 'GST invoices', 'Stock management'],
  },
  {
    icon: Pill,
    label: 'Pharmacy',
    color: 'text-green-600 bg-green-50',
    features: ['Medicine billing', 'Expiry tracking', 'Purchase orders', 'Sales reports'],
  },
  {
    icon: Store,
    label: 'Daily Store / Kirana',
    color: 'text-yellow-600 bg-yellow-50',
    features: ['Fast counter billing', 'Supplier management', 'Low-stock alerts', 'Daily profit reports'],
  },
  {
    icon: Users,
    label: 'HR Operations',
    color: 'text-purple-600 bg-purple-50',
    features: ['Staff management', 'Role-based access', 'Expense tracking', 'Performance reports'],
  },
]

const FEATURES = [
  { icon: IndianRupee, title: 'Fast Billing', desc: 'Counter, table, and takeaway billing with 80mm thermal receipt printing and GST invoices.' },
  { icon: Package, title: 'Inventory Control', desc: 'Real-time stock tracking, low-stock alerts, purchase orders, and supplier management.' },
  { icon: BarChart2, title: 'Business Reports', desc: 'Daily, monthly, and outlet-wise sales, profit, expense, and tax analytics.' },
  { icon: Smartphone, title: 'KOT System', desc: 'Digital kitchen order tickets with separate bar, kitchen, and counter stations.' },
  { icon: Users, title: 'Multi-User & Roles', desc: 'Invite staff with custom roles and permissions. Owner, manager, cashier, and more.' },
  { icon: Globe, title: 'Multi-Outlet', desc: 'Manage all your outlets from a single account with consolidated reporting.' },
  { icon: Lock, title: 'Secure & Reliable', desc: 'Role-based access control, encrypted data, and automatic daily backups.' },
  { icon: Zap, title: 'Works on Any Device', desc: 'Browser-based app works on tablets, laptops, and phones — no installation needed.' },
]

/* ── Inline app preview mockups ───────────────────────────────────── */

function DashboardMockup() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-xs select-none">
      {/* top bar */}
      <div className="bg-gray-900 flex items-center gap-1.5 px-3 py-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="ml-3 text-gray-400 text-[10px]">CheesePOS — Dashboard</span>
      </div>
      <div className="p-3 space-y-2.5 bg-gray-50">
        {/* stat cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Today's Revenue", val: '₹14,820', color: 'text-brand-600' },
            { label: 'Total Bills',     val: '38',       color: 'text-gray-800' },
            { label: 'Net Profit',      val: '₹9,210',   color: 'text-green-600' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-lg p-2 border border-gray-100">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide">{c.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>
        {/* chart placeholder */}
        <div className="bg-white rounded-lg border border-gray-100 p-2">
          <p className="text-[9px] text-gray-400 mb-1.5 font-medium">REVENUE THIS WEEK</p>
          <div className="flex items-end gap-1 h-12">
            {[40, 65, 50, 80, 55, 90, 70].map((h, i) => (
              <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 5 ? '#f97316' : '#fed7aa' }} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <span key={d} className="text-[8px] text-gray-300 flex-1 text-center">{d}</span>
            ))}
          </div>
        </div>
        {/* recent bills */}
        <div className="bg-white rounded-lg border border-gray-100 p-2">
          <p className="text-[9px] text-gray-400 mb-1.5 font-medium">RECENT BILLS</p>
          <div className="space-y-1">
            {[
              { no: '#B-042', amt: '₹1,240', pay: 'UPI',  col: 'text-blue-600' },
              { no: '#B-041', amt: '₹880',   pay: 'Cash', col: 'text-green-600' },
              { no: '#B-040', amt: '₹2,100', pay: 'Card', col: 'text-purple-600' },
            ].map(b => (
              <div key={b.no} className="flex items-center justify-between">
                <span className="text-[9px] font-medium text-gray-700">{b.no}</span>
                <span className={`text-[9px] font-bold ${b.col}`}>{b.pay}</span>
                <span className="text-[9px] font-semibold text-gray-900">{b.amt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BillingMockup() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-xs select-none">
      <div className="bg-gray-900 flex items-center gap-1.5 px-3 py-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="ml-3 text-gray-400 text-[10px]">CheesePOS — Billing</span>
      </div>
      <div className="flex bg-gray-50" style={{ minHeight: 220 }}>
        {/* product grid */}
        <div className="flex-1 p-2.5 space-y-2">
          <input className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-[9px] text-gray-400" placeholder="🔍 Search products…" readOnly />
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { name: 'Whisky 60ml', price: '₹180' },
              { name: 'Beer Pint',   price: '₹120' },
              { name: 'Chicken 65',  price: '₹240' },
              { name: 'Rum 60ml',    price: '₹140' },
              { name: 'Fries',       price: '₹80'  },
              { name: 'Soft Drink',  price: '₹60'  },
            ].map(p => (
              <div key={p.name} className="bg-white rounded-lg border border-gray-100 p-1.5 text-center cursor-pointer hover:border-brand-300">
                <p className="text-[8px] font-medium text-gray-700 leading-tight">{p.name}</p>
                <p className="text-[9px] font-bold text-brand-600 mt-0.5">{p.price}</p>
              </div>
            ))}
          </div>
        </div>
        {/* cart */}
        <div className="w-28 bg-white border-l border-gray-100 p-2 flex flex-col">
          <p className="text-[9px] font-bold text-gray-700 mb-1.5">Cart</p>
          <div className="space-y-1 flex-1">
            {[
              { name: 'Whisky 60ml', qty: 2, amt: '₹360' },
              { name: 'Chicken 65',  qty: 1, amt: '₹240' },
              { name: 'Beer Pint',   qty: 1, amt: '₹120' },
            ].map(item => (
              <div key={item.name} className="flex justify-between items-start">
                <div>
                  <p className="text-[8px] text-gray-700 leading-tight">{item.name}</p>
                  <p className="text-[8px] text-gray-400">×{item.qty}</p>
                </div>
                <p className="text-[8px] font-semibold text-gray-900">{item.amt}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-1.5 mt-1 space-y-1">
            <div className="flex justify-between">
              <span className="text-[8px] text-gray-500">Subtotal</span>
              <span className="text-[8px] font-medium">₹720</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[8px] text-gray-500">GST 5%</span>
              <span className="text-[8px] font-medium">₹36</span>
            </div>
            <div className="flex justify-between font-bold">
              <span className="text-[9px]">Total</span>
              <span className="text-[9px] text-brand-600">₹756</span>
            </div>
          </div>
          <button className="mt-2 w-full bg-brand-500 text-white rounded py-1 text-[9px] font-bold">Pay ₹756</button>
        </div>
      </div>
    </div>
  )
}

function ReportsMockup() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-xs select-none">
      <div className="bg-gray-900 flex items-center gap-1.5 px-3 py-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="ml-3 text-gray-400 text-[10px]">CheesePOS — Reports</span>
      </div>
      <div className="p-3 bg-gray-50 space-y-2.5">
        {/* tabs */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-lg p-0.5 w-fit">
          {['Sales','Payments','Products','Staff'].map((t, i) => (
            <span key={t} className={`px-2 py-0.5 rounded text-[9px] font-medium ${i === 0 ? 'bg-brand-500 text-white' : 'text-gray-400'}`}>{t}</span>
          ))}
        </div>
        {/* payment breakdown */}
        <div className="bg-white rounded-lg border border-gray-100 p-2">
          <p className="text-[9px] text-gray-400 font-medium mb-1.5">PAYMENT BREAKDOWN</p>
          {[
            { mode: 'UPI',  pct: 52, amt: '₹7,710', col: '#3b82f6' },
            { mode: 'Cash', pct: 31, amt: '₹4,590', col: '#22c55e' },
            { mode: 'Card', pct: 17, amt: '₹2,520', col: '#a855f7' },
          ].map(p => (
            <div key={p.mode} className="mb-1.5">
              <div className="flex justify-between mb-0.5">
                <span className="text-[8px] text-gray-600">{p.mode}</span>
                <span className="text-[8px] font-semibold text-gray-900">{p.amt}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: p.col }} />
              </div>
            </div>
          ))}
        </div>
        {/* top products */}
        <div className="bg-white rounded-lg border border-gray-100 p-2">
          <p className="text-[9px] text-gray-400 font-medium mb-1.5">TOP PRODUCTS</p>
          <div className="space-y-1">
            {[
              { name: 'Whisky 60ml', qty: 84, rev: '₹15,120' },
              { name: 'Beer Pint',   qty: 62, rev: '₹7,440'  },
              { name: 'Chicken 65',  qty: 51, rev: '₹12,240' },
            ].map((p, i) => (
              <div key={p.name} className="flex items-center gap-1.5">
                <span className="text-[8px] text-gray-300 w-3">{i + 1}</span>
                <span className="text-[8px] text-gray-700 flex-1">{p.name}</span>
                <span className="text-[8px] text-gray-400">{p.qty}×</span>
                <span className="text-[8px] font-semibold text-brand-600">{p.rev}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatPrice(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`
}

export default function Landing() {
  const [showContact, setShowContact] = useState(false)
  const [activeBiz, setActiveBiz] = useState(0)

  const { data: config = {} } = useQuery({
    queryKey: ['public-config'],
    queryFn: () => subscriptionsAPI.getConfig().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: plans = [] } = useQuery({
    queryKey: ['public-plans'],
    queryFn: () => subscriptionsAPI.getPlans().then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: !!config.show_pricing,
  })

  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="border-b border-gray-100 px-4 md:px-6 py-4 flex items-center justify-between max-w-7xl mx-auto sticky top-0 bg-white/95 backdrop-blur z-40">
        <BrandLogo theme="light" size="sm" showSubtitle={false} />
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Sign in</Link>
          <button onClick={() => setShowContact(true)} className="btn-primary text-sm px-4 py-2">Get started</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-sm px-4 py-1.5 rounded-full mb-6 border border-brand-200">
          <span className="w-2 h-2 bg-brand-500 rounded-full" />
          Complete POS platform for Indian businesses
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-5 leading-tight">
          One platform for<br />
          <span className="text-brand-500">every business type</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Cloud-based billing, inventory, and analytics for bars, restaurants, salons, pharmacies,
          retail stores and more. Multi-outlet. Multi-user. Built for India.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <button onClick={() => setShowContact(true)} className="btn-primary text-lg px-8 py-3 flex items-center gap-2">
            Start for free <ArrowRight size={18} />
          </button>
          <Link to="/login" className="btn-secondary text-lg px-8 py-3">Sign in</Link>
        </div>
        {/* trust badges */}
        <div className="flex flex-wrap gap-6 justify-center mt-10 text-sm text-gray-400">
          {['No setup fees', '14-day free trial', 'No credit card required', 'Indian support team'].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-500" />
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* App screenshots */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 text-center">Dashboard</p>
            <DashboardMockup />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 text-center">Billing</p>
            <BillingMockup />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 text-center">Reports</p>
            <ReportsMockup />
          </div>
        </div>
      </section>

      {/* Business types */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Built for your industry</h2>
            <p className="text-gray-500">Pick your business type — CheesePOS adapts to your workflow.</p>
          </div>

          {/* type selector tabs */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {BUSINESS_TYPES.map((bt, i) => {
              const Icon = bt.icon
              return (
                <button
                  key={i}
                  onClick={() => setActiveBiz(i)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    activeBiz === i
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon size={15} />
                  {bt.label}
                </button>
              )
            })}
          </div>

          {/* active type detail */}
          {(() => {
            const bt = BUSINESS_TYPES[activeBiz]
            const Icon = bt.icon
            return (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-2xl mx-auto text-center shadow-sm">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${bt.color}`}>
                  <Icon size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-5">{bt.label}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {bt.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
                      <CheckCircle size={14} className="text-green-500 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowContact(true)} className="mt-6 btn-primary px-6 py-2.5 text-sm flex items-center gap-2 mx-auto">
                  Get started with {bt.label} <ArrowRight size={15} />
                </button>
              </div>
            )
          })()}
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything you need, nothing you don't</h2>
          <p className="text-gray-500">Powerful tools designed for how Indian businesses actually operate.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 hover:border-brand-200 hover:shadow-sm transition-all">
              <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mb-4">
                <f.icon size={20} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Up and running in minutes</h2>
          <p className="text-gray-500 mb-12">No hardware to install. No IT team required.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Send an enquiry', desc: 'Fill in your business details. Our team will set up your account and send login credentials within a few hours.' },
              { step: '02', title: 'Configure & onboard', desc: 'Add your products, staff, and outlets. Our guided setup takes under 30 minutes for most businesses.' },
              { step: '03', title: 'Start billing', desc: 'Open the app on any browser — tablet, laptop, or phone. Start billing, tracking stock, and viewing reports.' },
            ].map(s => (
              <div key={s.step} className="relative">
                <div className="w-14 h-14 rounded-2xl bg-brand-500 text-white text-xl font-bold flex items-center justify-center mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 max-w-7xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { val: '6+',   label: 'Business types supported' },
            { val: '100%', label: 'Cloud-based, no install'  },
            { val: '₹0',   label: 'Setup or hidden fees'     },
            { val: '24×7', label: 'Data accessible anytime'  },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-2xl p-6">
              <p className="text-4xl font-bold text-brand-500 mb-1">{s.val}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing — only shown when admin enables it */}
      {config.show_pricing && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">Simple, transparent pricing</h2>
            <p className="text-gray-500 text-center mb-12">Pay per business, not per user. All prices in Indian Rupees + 18% GST.</p>
            {plans.length === 0 ? (
              <p className="text-center text-gray-400">Loading plans…</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {plans.map((plan, idx) => {
                  const isHighlighted = plans.length === 3 && idx === 1
                  const features = plan.features ? Object.entries(plan.features).filter(([, v]) => v) : []
                  return (
                    <div key={plan.id} className={`rounded-2xl border-2 p-6 bg-white ${isHighlighted ? 'border-brand-500 shadow-lg shadow-brand-100' : 'border-gray-200'}`}>
                      {isHighlighted && (
                        <div className="bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3">RECOMMENDED</div>
                      )}
                      <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                      {plan.description && <p className="text-sm text-gray-500 mt-1 mb-3">{plan.description}</p>}
                      <div className="mt-3 mb-4">
                        <span className="text-3xl font-bold text-gray-900">{formatPrice(plan.price_monthly)}</span>
                        <span className="text-gray-400">/month</span>
                      </div>
                      <div className="flex gap-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mb-4">
                        <span><strong>{plan.max_outlets}</strong> outlet{plan.max_outlets !== 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span><strong>{plan.max_users}</strong> users</span>
                      </div>
                      <ul className="space-y-2 mb-6">
                        {features.map(([key]) => (
                          <li key={key} className="flex items-center gap-2 text-sm">
                            <CheckCircle size={14} className="text-green-500 shrink-0" />
                            <span className="text-gray-600">{FEATURE_LABELS[key] || key}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => setShowContact(true)}
                        className={`w-full py-2.5 rounded-xl font-medium transition-colors ${isHighlighted ? 'bg-brand-500 text-white hover:bg-brand-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                      >
                        Contact us to get started
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20 max-w-7xl mx-auto px-4 md:px-6 text-center">
        <div className="bg-brand-500 rounded-3xl px-6 py-14">
          <h2 className="text-3xl font-bold text-white mb-3">Ready to modernise your business?</h2>
          <p className="text-brand-100 mb-8 max-w-xl mx-auto">
            Join businesses across India using CheesePOS to manage billing, inventory, and growth — all from one place.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => setShowContact(true)}
              className="bg-white text-brand-600 hover:bg-brand-50 font-semibold px-8 py-3 rounded-xl text-lg flex items-center gap-2 transition-colors"
            >
              Get started today <ArrowRight size={18} />
            </button>
            <a
              href="mailto:cheesepossupport@gmail.com"
              className="border border-white/30 text-white hover:bg-white/10 font-medium px-8 py-3 rounded-xl text-lg transition-colors"
            >
              Email us
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-10 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <BrandLogo theme="light" size="sm" showSubtitle={false} />
            <div className="flex flex-wrap gap-6 text-sm text-gray-500">
              <Link to="/terms" className="hover:text-gray-900">Terms of Service</Link>
              <a href="mailto:cheesepossupport@gmail.com" className="hover:text-gray-900">cheesepossupport@gmail.com</a>
              <span>Nellore, Andhra Pradesh – 524002</span>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-6 flex flex-col md:flex-row justify-between gap-2 text-xs text-gray-400">
            <p>© {new Date().getFullYear()} CheesePOS. All rights reserved.</p>
            <p>Tax rates vary by state. Verify applicable GST and excise rules before production use.</p>
          </div>
        </div>
      </footer>

      {showContact && <EnquiryModal onClose={() => setShowContact(false)} />}
    </div>
  )
}
