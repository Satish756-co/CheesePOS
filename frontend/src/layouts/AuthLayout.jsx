import { Outlet } from 'react-router-dom'
import BrandLogo from '@/components/BrandLogo'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <BrandLogo theme="dark" size="xl" showSubtitle={true} />
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
