import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supportAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { formatDate, formatDateTime } from '@/utils/formatters'
import toast from 'react-hot-toast'
import {
  Headphones, Plus, X, Send, ArrowLeft, CheckCircle2,
  Clock, AlertCircle, XCircle, Inbox, RefreshCw, ThumbsUp, Check
} from 'lucide-react'

const STATUS = {
  open:        { badge: 'bg-red-100 text-red-700',     label: 'Open',        icon: AlertCircle  },
  in_progress: { badge: 'bg-amber-100 text-amber-700', label: 'In Progress', icon: Clock        },
  resolved:    { badge: 'bg-green-100 text-green-700', label: 'Resolved',    icon: CheckCircle2 },
  closed:      { badge: 'bg-gray-100 text-gray-500',   label: 'Closed',      icon: XCircle      },
}

const CATEGORIES = ['billing', 'technical', 'account', 'feature_request', 'other']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

function isSystemMsg(m) {
  return m.is_system === true || m.sender_id === null
}

// ─── Feedback modal ──────────────────────────────────────────────────────────

function FeedbackModal({ ticketId, onDone }) {
  const qc = useQueryClient()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [feedback, setFeedback] = useState('')

  const mutation = useMutation({
    mutationFn: () => supportAPI.submitFeedback(ticketId, { rating, feedback }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-ticket', ticketId] })
      qc.invalidateQueries({ queryKey: ['customer-support-tickets'] })
      toast.success('Thank you for your feedback!')
      onDone()
    },
    onError: () => toast.error('Failed to submit feedback'),
  })

  const stars = [1, 2, 3, 4, 5]
  const labels = ['Poor', 'Fair', 'Good', 'Great', 'Excellent']
  const active = hovered || rating

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <ThumbsUp size={24} className="text-brand-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">How did we do?</h2>
          <p className="text-gray-500 text-sm mt-1">Your feedback helps us improve our support.</p>
        </div>

        <div className="flex justify-center gap-3 mb-2">
          {stars.map(star => (
            <button
              key={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="text-4xl transition-transform hover:scale-110 focus:outline-none"
            >
              <span className={active >= star ? 'text-amber-400' : 'text-gray-200'}>★</span>
            </button>
          ))}
        </div>
        {active > 0 && (
          <p className="text-center text-sm font-medium text-amber-600 mb-4">{labels[active - 1]}</p>
        )}
        {!active && <div className="mb-4" />}

        <textarea
          className="input resize-none w-full mb-4"
          rows={3}
          placeholder="Any additional comments? (optional)"
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
        />

        <div className="flex gap-3">
          <button onClick={onDone} className="btn-secondary flex-1 py-2.5">Skip</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!rating || mutation.isPending}
            className="btn-primary flex-1 py-2.5"
          >
            {mutation.isPending ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── New ticket modal ────────────────────────────────────────────────────────

function NewTicketModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ subject: '', category: 'technical', priority: 'normal', message: '' })
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const mutation = useMutation({
    mutationFn: () => supportAPI.createTicket(form),
    onSuccess: (res) => { toast.success('Ticket created'); onCreated(res.data) },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create ticket'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">New Support Ticket</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="p-5 space-y-4">
          <div>
            <label className="label">Subject <span className="text-red-500">*</span></label>
            <input className="input" placeholder="Brief description of your issue"
              value={form.subject} onChange={e => set('subject', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Describe your issue <span className="text-red-500">*</span></label>
            <textarea className="input resize-none" rows={5}
              placeholder="Please describe the problem in detail — what happened, what you expected, and any error messages you saw."
              value={form.message} onChange={e => set('message', e.target.value)} required />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'Submitting…' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Chat view ───────────────────────────────────────────────────────────────

function ChatView({ ticket, onBack }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [reply, setReply] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const bottomRef = useRef(null)

  const QUERY_KEY = ['customer-ticket', ticket.id]

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
          sender_name: user?.full_name || 'You',
          is_staff: false,
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
    },
  })

  const closeMutation = useMutation({
    mutationFn: () => supportAPI.updateStatus(ticket.id, 'closed'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['customer-support-tickets'] })
      setShowFeedback(true)
    },
    onError: () => toast.error('Failed to close ticket'),
  })

  const reopenMutation = useMutation({
    mutationFn: () => supportAPI.updateStatus(ticket.id, 'open'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['customer-support-tickets'] })
      toast.success('Ticket reopened')
    },
    onError: () => toast.error('Failed to reopen ticket'),
  })

  const t = detail || ticket
  const s = STATUS[t.status] || STATUS.open
  const isClosed = t.status === 'closed' || t.status === 'resolved'
  const needsConfirmation = isClosed && !t.customer_rating && !showFeedback
  const messages = detail?.messages || []

  // Find index of last customer message that support has read (for "Seen" receipt)
  const lastSeenIdx = (() => {
    const readAt = t.staff_last_read_at ? new Date(t.staff_last_read_at) : null
    if (!readAt) return -1
    let idx = -1
    messages.forEach((m, i) => {
      if (!isSystemMsg(m) && !m.is_staff && new Date(m.created_at) <= readAt) {
        idx = i
      }
    })
    return idx
  })()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 md:hidden">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
              <s.icon size={11} /> {s.label}
            </span>
            <span className="text-xs text-gray-400">{t.ticket_number}</span>
          </div>
          <p className="font-bold text-gray-900 text-sm mt-0.5 truncate">{t.subject}</p>
          <p className="text-xs text-gray-400">{formatDateTime(t.created_at)}</p>
        </div>
        {!isClosed && (
          <button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium">
            Close Ticket
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {isLoading ? (
          <div className="text-center text-gray-400 py-12 text-sm">Loading…</div>
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
          const isMe = !m.is_staff
          const isLastSeenMsg = idx === lastSeenIdx
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isMe
                ? 'bg-brand-500 text-white rounded-br-sm'
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
                <p className={`text-xs font-semibold mb-1 ${isMe ? 'text-brand-100' : 'text-brand-600'}`}>
                  {isMe ? 'You' : 'CheesePOS Support'}
                </p>
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                <p className={`text-xs mt-1.5 ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>
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

      {/* Resolved/Closed confirmation banner */}
      {needsConfirmation && (
        <div className="border-t border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {t.status === 'resolved' ? 'Your ticket has been resolved' : 'Your ticket has been closed'} by our support team
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Please let us know if your issue was solved, or reopen the ticket if you need more help.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 font-medium flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={13} /> Reopen
            </button>
            <button
              onClick={() => setShowFeedback(true)}
              className="flex-1 text-sm px-3 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-medium flex items-center justify-center gap-1.5"
            >
              <ThumbsUp size={13} /> Confirm & Rate
            </button>
          </div>
        </div>
      )}

      {/* Already rated */}
      {isClosed && t.customer_rating && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Ticket {t.status} · You rated:
          </span>
          <span className="flex items-center gap-0.5 text-xl">
            {[1,2,3,4,5].map(i => (
              <span key={i} className={i <= t.customer_rating ? 'text-amber-400' : 'text-gray-200'}>★</span>
            ))}
          </span>
          <button
            onClick={() => reopenMutation.mutate()}
            disabled={reopenMutation.isPending}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium flex items-center gap-1"
          >
            <RefreshCw size={11} /> Reopen
          </button>
        </div>
      )}

      {/* Reply bar */}
      {!isClosed && (
        <form
          onSubmit={e => { e.preventDefault(); if (reply.trim()) replyMutation.mutate(reply.trim()) }}
          className="p-3 border-t border-gray-200 bg-white flex gap-2"
        >
          <input
            className="input flex-1 text-sm"
            placeholder="Type your message…"
            value={reply}
            onChange={e => setReply(e.target.value)}
          />
          <button type="submit" disabled={replyMutation.isPending || !reply.trim()} className="btn-primary px-3">
            <Send size={15} />
          </button>
        </form>
      )}

      {showFeedback && (
        <FeedbackModal ticketId={ticket.id} onDone={() => setShowFeedback(false)} />
      )}
    </div>
  )
}

// ─── Ticket list ─────────────────────────────────────────────────────────────

function TicketList({ tickets, isLoading, selected, onSelect, onNew, fullWidth }) {
  return (
    <div className={`flex flex-col border-r border-gray-200 bg-white ${fullWidth ? 'flex-1' : 'w-80 lg:w-96 flex-shrink-0'}`}>
      <div className="flex items-center justify-between p-5 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Support</h1>
          <p className="text-sm text-gray-400">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onNew} className="btn-primary text-sm px-3 py-2 flex items-center gap-2">
          <Plus size={15} /> New Ticket
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-gray-400 px-6">
            <Inbox size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No tickets yet</p>
            <p className="text-xs mt-1">Create a ticket if you need help with anything.</p>
          </div>
        ) : tickets.map(t => {
          const s = STATUS[t.status] || STATUS.open
          const isActive = selected?.id === t.id
          const needsAction = (t.status === 'closed' || t.status === 'resolved') && !t.customer_rating
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className={`w-full text-left px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${isActive ? 'bg-brand-50 border-l-2 border-l-brand-500' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-gray-900 text-sm truncate">{t.subject}</p>
                    {needsAction && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Awaiting your response" />
                    )}
                    {t.has_unread && !needsAction && (
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="New messages" />
                    )}
                  </div>
                  {t.preview && <p className="text-xs text-gray-400 truncate mt-0.5">{t.preview}</p>}
                  {t.customer_rating && (
                    <span className="flex items-center gap-0.5 mt-0.5">
                      {[1,2,3,4,5].map(i => (
                        <span key={i} className={`text-xs ${i <= t.customer_rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                      ))}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
                    {s.label}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(t.created_at)}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CustomerSupport() {
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['customer-support-tickets'],
    queryFn: () => supportAPI.listTickets().then(r => r.data),
    staleTime: 15000,
    refetchInterval: 30000,
  })

  const tickets = data?.tickets || []

  const handleCreated = (ticket) => {
    setShowNew(false)
    qc.invalidateQueries({ queryKey: ['customer-support-tickets'] })
    setSelected(ticket)
  }

  if (selected) {
    return (
      <div className="h-full flex flex-col">
        <div className="md:hidden h-full">
          <ChatView ticket={selected} onBack={() => setSelected(null)} />
        </div>
        <div className="hidden md:flex h-full">
          <TicketList tickets={tickets} isLoading={isLoading} selected={selected}
            onSelect={setSelected} onNew={() => setShowNew(true)} />
          <div className="flex-1 flex flex-col">
            <ChatView ticket={selected} onBack={() => setSelected(null)} />
          </div>
        </div>
        {showNew && <NewTicketModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col md:flex-row">
      <TicketList tickets={tickets} isLoading={isLoading} selected={selected}
        onSelect={setSelected} onNew={() => setShowNew(true)} fullWidth />
      <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <Headphones size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Select a ticket to view the conversation</p>
          <p className="text-xs mt-1">Or create a new ticket if you need help</p>
        </div>
      </div>
      {showNew && <NewTicketModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}
    </div>
  )
}
