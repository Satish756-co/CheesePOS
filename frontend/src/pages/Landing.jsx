import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { subscriptionsAPI } from '@/api'
import { CheckCircle, ArrowRight, IndianRupee, Shield, TrendingUp, Smartphone } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import EnquiryModal from '@/components/EnquiryModal'

const FEATURE_LABELS = {
  billing: 'Counter Billing',
  table_billing: 'Table Billing',
  kot: 'KOT & Kitchen Display',
  inventory: 'Inventory Management',
  basic_reports: 'Basic Reports',
  advanced_reports: 'Advanced Reports',
  multi_outlet: 'Multi-Outlet Support',
  custom_reports: 'Custom Reports',
  api_access: 'API Access',
  priority_support: 'Priority Support',
  purchases: 'Purchase Management',
  expenses: 'Expense Tracking',
}

function formatPrice(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`
}

export default function Landing() {
  const [showContact, setShowContact] = useState(false)

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
      <nav className="border-b border-gray-100 px-4 md:px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <BrandLogo theme="light" size="sm" showSubtitle={false} />
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Sign in</Link>
          <button onClick={() => setShowContact(true)} className="btn-primary text-sm px-4 py-2">Contact us</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-sm px-4 py-1.5 rounded-full mb-6 border border-brand-200">
          <span className="w-2 h-2 bg-brand-500 rounded-full" />
          Built for bars &amp; restaurants across India
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Complete POS & Business<br />
          Management for <span className="text-brand-500">Bars & Restaurants</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Cloud-based billing, inventory, KOT, and analytics platform built for Indian bars and restaurants.
          Multi-outlet. Multi-user. Subscription-based.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <button onClick={() => setShowContact(true)} className="btn-primary text-lg px-8 py-3 flex items-center gap-2">
            Get started <ArrowRight size={18} />
          </button>
          <Link to="/login" className="btn-secondary text-lg px-8 py-3">Sign in</Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Everything you need to run your bar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[
              { icon: IndianRupee, title: 'Fast Billing', desc: 'Counter, table, and takeaway billing with 80mm thermal receipt printing' },
              { icon: Shield, title: 'Inventory Control', desc: 'Bottle-level and peg-level stock tracking with low-stock alerts' },
              { icon: TrendingUp, title: 'Business Reports', desc: 'Daily, monthly, and outlet-wise sales, profit, and tax reports' },
              { icon: Smartphone, title: 'KOT System', desc: 'Digital kitchen order tickets. Separate bar and kitchen stations' },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mb-4">
                  <f.icon size={20} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans — only shown when admin has enabled pricing visibility */}
      {config.show_pricing && (
      <section className="py-20 max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Simple, transparent pricing</h2>
        <p className="text-gray-500 text-center mb-12">Pay per business, not per user. All prices in Indian Rupees + 18% GST.</p>
        {plans.length === 0 ? (
          <p className="text-center text-gray-400">Loading plans…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan, idx) => {
              const isHighlighted = plans.length === 3 && idx === 1
              const features = plan.features ? Object.entries(plan.features).filter(([, v]) => v) : []
              return (
                <div key={plan.id} className={`rounded-2xl border-2 p-6 ${isHighlighted ? 'border-brand-500 shadow-lg shadow-brand-100' : 'border-gray-200'}`}>
                  {isHighlighted && (
                    <div className="bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3">
                      RECOMMENDED
                    </div>
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
                        <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
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
      </section>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        <p>© 2024 CheesePOS. Built for bars and restaurants across India.</p>
        <p className="mt-1">Tax rates vary by state. Verify your applicable excise and GST rules before production use.</p>
      </footer>

      {showContact && <EnquiryModal onClose={() => setShowContact(false)} />}
    </div>
  )
}
