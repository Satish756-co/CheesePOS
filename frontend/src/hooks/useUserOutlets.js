import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { outletsAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'

/**
 * Returns outlets filtered by the current user's assignment.
 * - owner / admin / super_admin → all active outlets
 * - all other roles → only their assigned outlets (from user.outlet_ids)
 * Also returns a stable defaultOutletId (first in the list).
 */
export function useUserOutlets() {
  const user = useAuthStore(s => s.user)

  const { data: allOutlets = [], isLoading, isError } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletsAPI.list().then(r => r.data),
  })

  const outlets = useMemo(() => {
    if (!user) return allOutlets
    // These roles can see all outlets regardless of assignment
    if (user.is_super_admin || ['owner', 'admin'].includes(user.role)) return allOutlets
    // Everyone else: filter to assigned outlets only
    const ids = user.outlet_ids || []
    if (ids.length === 0) return allOutlets  // no restrictions set → show all
    return allOutlets.filter(o => ids.includes(o.id))
  }, [allOutlets, user])

  const defaultOutletId = outlets[0]?.id ?? null

  return { outlets, defaultOutletId, isLoading, isError }
}
