import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI } from '@/api'
import toast from 'react-hot-toast'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid link</h2>
        <p className="text-gray-500 text-sm mb-4">
          This reset link is missing or malformed.
        </p>
        <Link to="/forgot-password" className="text-brand-600 hover:underline text-sm font-medium">
          Request a new reset link
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await authAPI.resetPassword(token, form.password)
      setDone(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={26} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Password reset!</h2>
        <p className="text-gray-500 text-sm mb-6">
          Your password has been updated. You can now sign in.
        </p>
        <button
          className="btn-primary w-full py-2.5"
          onClick={() => navigate('/login')}
        >
          Sign in
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Set new password</h2>
      <p className="text-gray-500 text-sm mb-6">
        Choose a strong password (min. 8 characters).
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">New password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={show ? 'text' : 'password'}
              className="input pl-9 pr-10"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Confirm new password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={show ? 'text' : 'password'}
              className="input pl-9"
              placeholder="Repeat password"
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full py-2.5 mt-2"
          disabled={loading}
        >
          {loading ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    </div>
  )
}
