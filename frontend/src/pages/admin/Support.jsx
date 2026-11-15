import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supportAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { formatDate, formatDateTime } from '@/utils/formatters'
import toast from 'react-hot-toast'
import {
  MessageSquare, X, Send, CheckCircle2, Clock,
  AlertCircle, XCircle, RefreshCw, Inbox, Building2, User2, Tag, Star, Check
} from 'lucide-react'

const STATUS = {
  open:        { badge: 'bg-red-100 text-red-700',     label: 'Open',        icon: AlertCircle  },
  in_progress: { badge: 'bg-amber-100 text-amber-700', label: 'In Progress', icon: Clock        },
  resolved:    { badge: 'bg-green-100 text-green-700', label: 'Resolved',    icon: CheckCircle2 },
  closed:      { badge: 'bg-gray-100 text-gray-500',   label: 'Closed',      icon: XCircle      },
}
const PRIORITY = {
  low:    'bg-gray-100 text-gray-500',
  normal: 'bg-blue-100 text-blue-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

function StarDisplay({ rating }) {
  if (!rating) return null
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= rating ? 'text-amber-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

function isSystemMsg(m) {
  return m.is_system === true || m.sender_id === null
}

function ChatPanel({ ticket, onClose, onStatusChange }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [reply, setReply] = useState('')
  const bottomRef = useRef(null)

  const QUERY_KEY = ['admin-ticket', ticket.id]

  const { data: detail, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => supportAPI.getTicket(ticket.id).then(r => r.data),
    staleTime: 10000,
    refetchInterval: 20000,
  })

  // Mark read when opening
  useEffect(() => {
    supportAPI.markRead(ticket.id).catch(() => {})
    qc.invalidateQueries({ queryKey: ['support-unread-count'] })
  }, [ticket.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages?.length])

  const replyMutation = useMutation({
    mutationFn: (msg) => supportAPI.reply(ticket.id, { message: msg }),
    onMutate: async (msg) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY })
      const prev = qc.getQueryData(QUERY_KEY)
      qc.setQueryData(QUERY_KEY, old => old ? {
        ...old,
        messages: [...(old.messages || []), {
          id: `tmp-${Date.now()}`,
          message: msg,
          sender_id: user?.id,
          sender_name: user?.full_name || 'Support Team',
          is_staff: true,
          is_system: false,
          created_at: new Date().toISOString(),
        }],
      } : old)
      setReply('')
      return { prev, msg }
    },
    onError: (_e, _m, ctx) => {
      qc.setQueryData(QUERY_KEY, ctx.prev)
      setReply(ctx.msg)
      toast.error('Failed to send reply')
    },
    onSuccess: (res) => {
      const message = res.data.message || res.data
      const systemMessage = res.data.system_message || null
      qc.setQueryData(QUERY_KEY, old => {
        if (!old) return old
        const filtered = (old.messages || []).filter(m => !String(m.id).startsWith('tmp-'))
        const newMessages = systemMessage ? [...filtered, message, systemMessage] : [...filtered, message]
        return { ...old, messages: newMessages }
      })
      qc.invalidateQueries({ queryKey: ['support-unread-count'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status) => supportAPI.updateStatus(ticket.id, status),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['admin-support-tickets'] })
      onStatusChange(res.data)
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const t = detail || ticket
  const s = STATUS[t.status] || STATUS.open
  const messages = detail?.messages || []

  // Find index of last staff message that the customer has read (for "Seen" receipt)
  const lastSeenIdx = (() => {
    const readAt = t.customer_last_read_at ? new Date(t.customer_last_read_at) : null
    if (!readAt) return -1
    let idx = -1
    messages.forEach((m, i) => {
      if (!isSystemMsg(m) && m.is_staff && new Date(m.created_at) <= readAt) {
        idx = i
      }
    })
    return idx
  })()

  return (
    <div className="flex flex-col h-full">
      {/* Rich client header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5 font-semibold text-gray-700">
            <Building2 size={12} className="text-brand-500" />
            {t.tenant_name || '—'}
          </span>
          {t.raised_by_name && (
            <span className="flex items-center gap-1.5">
              <User2 size={12} />
              {t.raised_by_name}
            </span>
          )}
          {t.category && (
            <span className="flex items-center gap-1.5 capitalize">
              <Tag size={12} />
              {t.category.replace('_', ' ')}
            </span>
          )}
          <span className="text-gray-400">{t.ticket_number}</span>
          {t.customer_rating && (
            <span className="flex items-center gap-1">
              <StarDisplay rating={t.customer_rating} />
              <span className="text-gray-500">customer rating</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
                <s.icon size={11} /> {s.label}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY[t.priority] || PRIORITY.normal}`}>
                {t.priority}
              </span>
            </div>
            <p className="font-bold text-gray-900 text-sm truncate">{t.subject}</p>
            <p className="text-xs text-gray-400">{formatDateTime(t.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {t.status !== 'in_progress' && t.status !== 'resolved' && t.status !== 'closed' && (
              <button onClick={() => statusMutation.mutate('in_progress')} disabled={statusMutation.isPending}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-medium">
                In Progress
              </button>
            )}
            {t.status !== 'resolved' && (
              <button onClick={() => statusMutation.mutate('resolved')} disabled={statusMutation.isPending}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium">
                Resolve
              </button>
            )}
            {t.status !== 'closed' && (
              <button onClick={() => statusMutation.mutate('closed')} disabled={statusMutation.isPending}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-500 text-white hover:bg-gray-600 font-medium">
                Close
              </button>
            )}
            {(t.status === 'resolved' || t.status === 'closed') && (
              <button onClick={() => statusMutation.mutate('open')} disabled={statusMutation.isPending}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium flex items-center gap-1">
                <RefreshCw size={11} /> Reopen
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-1">
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {isLoading ? (
          <div className="text-center text-gray-400 py-12">Loading…</div>
        ) : messages.map((m, idx) => {
          if (isSystemMsg(m)) {
            return (
              <div key={m.id} className="flex justify-center my-1">
                <span className="bg-gray-200/80 text-gray-500 text-xs px-4 py-1.5 rounded-full italic">
                  {m.message}
                  <span className="ml-2 not-italic opacity-60">· {formatDateTime(m.created_at)}</span>
                </span>
              </div>
            )
          }
          const isMe = m.is_staff
          const isLastSeenMsg = idx === lastSeenIdx
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isMe
                ? 'bg-brand-500 text-white rounded-br-sm'
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
                <p className={`text-xs font-semibold mb-1 ${isMe ? 'text-brand-100' : 'text-brand-600'}`}>
                  {m.sender_name}
                </p>
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>
                  {formatDateTime(m.created_at)}
                </p>
              </div>
              {isMe && isLastSeenMsg && (
                <span className="flex items-center gap-1 text-xs text-gray-400 mt-0.5 mr-1">
                  <Check size={11} className="text-blue-500" /><Check size={11} className="text-blue-500 -ml-2" />
                  Seen
                </span>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply */}
      <form
        onSubmit={e => { e.preventDefault(); if (reply.trim()) replyMutation.mutate(reply.trim()) }}
        className="p-3 border-t border-gray-200 bg-white flex gap-2"
      >
        <input
          className="input flex-1 text-sm"
          placeholder="Reply to customer…"
          value={reply}
          onChange={e => setReply(e.target.value)}
        />
        <button type="submit" disabled={replyMutation.isPending || !reply.trim()} className="btn-primary px-3">
          <Send size={15} />
        </button>
      </form>
    </div>
  )
}


export default function AdminSupport() {
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-support-tickets', statusFilter],
    queryFn: () => supportAPI.listTickets({ status: statusFilter || undefined }).then(r => r.data),
    staleTime: 15000,
    refetchInterval: 30000,
  })

  const tickets = data?.tickets || []
  const total = data?.total || 0

  const handleStatusChange = (updated) => {
    setSelected(prev => prev?.id === updated.id ? updated : prev)
  }

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Ticket list */}
      <div className={`flex flex-col border-r border-gray-200 bg-white ${selected ? 'hidden md:flex md:w-80 lg:w-96' : 'flex-1'}`}>
        <div className="p-5 border-b border-gray-200 flex-shrink-0">
          <h1 className="text-xl font-bold text-gray-900">Support</h1>
          <p className="text-sm text-gray-400">{total} ticket{total !== 1 ? 's' : ''}</p>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <select className="input w-full text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Tickets</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Inbox size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No tickets</p>
            </div>
          ) : tickets.map(t => {
            const s = STATUS[t.status] || STATUS.open
            const isActive = selected?.id === t.id
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`w-full text-left px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${isActive ? 'bg-brand-50 border-l-2 border-l-brand-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-gray-900 text-sm truncate">{t.subject}</p>
                      {t.has_unread && (
                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Unread messages" />
                      )}
                    </div>
                    <p className="text-xs font-medium text-brand-600 truncate mt-0.5 flex items-center gap-1">
                      <Building2 size={10} /> {t.tenant_name}
                    </p>
                    {t.raised_by_name && (
                      <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                        <User2 size={10} /> {t.raised_by_name}
                      </p>
                    )}
                    {t.preview && <p className="text-xs text-gray-400 truncate mt-0.5">{t.preview}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
                      {s.label}
                    </span>
                    {t.customer_rating && <StarDisplay rating={t.customer_rating} />}
                    <span className="text-xs text-gray-400">{formatDate(t.created_at)}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Chat panel */}
      {selected ? (
        <div className="flex-1 flex flex-col bg-white">
          <ChatPanel ticket={selected} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center text-gray-400">
            <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Select a ticket to view conversation</p>
          </div>
        </div>
      )}
    </div>
  )
}
