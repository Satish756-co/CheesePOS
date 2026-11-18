import { useState } from 'react'
import { contactAPI } from '@/api'
import { CheckCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

const BUSINESS_TYPES = [
  { value: 'bar_restaurant', label: 'Bar & Restaurant' },
  { value: 'saloon',         label: 'Saloon / Spa' },
  { value: 'daily_store',    label: 'Daily Store / Kirana' },
  { value: 'scanning_lab',   label: 'Scanning Center / Lab' },
  { value: 'pharmacy',       label: 'Pharmacy' },
  { value: 'retail_shop',    label: 'Retail Shop' },
  { value: 'hr_operations',  label: 'HR Operations' },
  { value: 'other',          label: 'Other' },
]

export default function EnquiryModal({ onClose }) {
  const [form, setForm] = useState({
    business_name: '',
    email: '',
    phone: '',
    business_type: 'bar_restaurant',
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await contactAPI.submitEnquiry(form)
      setSent(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-8 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Enquiry Sent!</h2>
            <p className="text-gray-500 mb-6">
              Thank you! We've received your enquiry and will get back to you within a few hours.
            </p>
            <button onClick={onClose} className="btn-primary px-8 py-2.5">Close</button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Get started with CheesePOS</h2>
            <p className="text-gray-500 text-sm mb-6">Fill in your details and we'll set up your account.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Business Type <span className="text-red-500">*</span></label>
                <select
                  className="input"
                  value={form.business_type}
                  onChange={e => set('business_type', e.target.value)}
                  required
                >
                  {BUSINESS_TYPES.map(bt => (
                    <option key={bt.value} value={bt.value}>{bt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Business Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Sharma Bar & Restaurant"
                  value={form.business_name}
                  onChange={e => set('business_name', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Email Address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  className="input"
                  placeholder="owner@yourbusiness.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Phone Number <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Message <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Tell us about your business — number of outlets, staff size, anything else..."
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 mt-2"
              >
                {loading ? 'Sending...' : 'Send Enquiry'}
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-4">
              We typically respond within a few hours on working days.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
