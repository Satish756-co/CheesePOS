import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '@/api'
import toast from 'react-hot-toast'
import { Mail, ArrowLeft } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authAPI.forgotPassword(email)
      setSent(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail size={26} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your inbox</h2>
        <p className="text-gray-500 text-sm mb-6">
          We've sent a password reset link to <strong>{email}</strong>.
          The link expires in 1 hour.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Didn't receive it? Check your spam folder or{' '}
          <button
            className="text-brand-600 hover:underline"
            onClick={() => setSent(false)}
          >
            try again
          </button>.
        </p>
        <Link to="/login" className="text-brand-600 hover:text-brand-700 text-sm font-medium flex items-center justify-center gap-1">
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot password?</h2>
      <p className="text-gray-500 text-sm mb-6">
        Enter your email and we'll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              className="input pl-9"
              placeholder="owner@yourbar.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full py-2.5 mt-2"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium flex items-center justify-center gap-1">
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
