import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { tenantsAPI } from '@/api'
import toast from 'react-hot-toast'

const AP_CITIES = ['Nellore', 'Vijayawada', 'Visakhapatnam', 'Guntur', 'Tirupati', 'Kurnool', 'Rajahmundry', 'Kakinada', 'Other']

export default function Register() {
  const [form, setForm] = useState({
    business_name: '', owner_name: '', email: '', phone: '',
    password: '', confirm_password: '',
    city: '', state: 'Andhra Pradesh', address: '',
    business_type: 'bar_restaurant',
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await tenantsAPI.register(form)
      toast.success('Account created! Your 14-day free trial has started.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Start free trial</h2>
      <p className="text-gray-500 text-sm mb-6">14 days free, no credit card required</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Business Name</label>
            <input className="input" placeholder="The Barrel House" value={form.business_name}
              onChange={e => update('business_name', e.target.value)} required />
          </div>
          <div className="col-span-2">
            <label className="label">Owner / Your Name</label>
            <input className="input" placeholder="Your full name" value={form.owner_name}
              onChange={e => update('owner_name', e.target.value)} required />
          </div>
          <div className="col-span-2">
            <label className="label">Email</label>
            <input type="email" className="input" placeholder="you@business.com" value={form.email}
              onChange={e => update('email', e.target.value)} required />
          </div>
          <div>
            <label className="label">Phone</label>
            <input type="tel" className="input" placeholder="+91 9876543210" value={form.phone}
              onChange={e => update('phone', e.target.value)} required />
          </div>
          <div>
            <label className="label">City</label>
            <select className="input" value={form.city} onChange={e => update('city', e.target.value)} required>
              <option value="">Select city</option>
              {AP_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" placeholder="Min 8 chars" value={form.password}
              onChange={e => update('password', e.target.value)} required minLength={8} />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input type="password" className="input" placeholder="Repeat password" value={form.confirm_password}
              onChange={e => update('confirm_password', e.target.value)} required />
          </div>
        </div>

        <button type="submit" className="btn-primary w-full py-2.5 mt-2" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account & start trial'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Sign in</Link>
      </p>
    </div>
  )
}
