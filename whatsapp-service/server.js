const express = require('express')
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(express.json())

// tenant_id -> { client, status, qr }
const sessions = {}

function normalisePhone(phone) {
  const digits = String(phone).replace(/\D/g, '')
  const full = digits.length === 10 ? '91' + digits : digits
  return full + '@c.us'
}

// Remove stale Chromium profile locks from the actual session directory path
function cleanupLocks(key) {
  // wwebjs v1.x stores sessions at <dataPath>/session-<clientId>/
  const sessionDir = path.join('./sessions', `session-tenant_${key}`)
  try {
    if (!fs.existsSync(sessionDir)) return
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) { walk(full); continue }
        if (entry.name === 'SingletonLock' || entry.name === 'SingletonSocket') {
          try { fs.unlinkSync(full); console.log(`[${key}] Removed lock: ${full}`) } catch (_) {}
        }
      }
    }
    walk(sessionDir)
  } catch (_) {}
}

function getOrCreate(tenantId) {
  const key = String(tenantId)
  if (sessions[key]) return sessions[key]

  cleanupLocks(key)

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `tenant_${key}`,
      dataPath: './sessions',
    }),
    authTimeoutMs: 300000,  // 5 minutes — give user time to scan; 0 falls through to 60s default
    webVersion: '2.3000.1017673279',
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/',
    },
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-extensions',
        '--no-first-run',
        '--window-size=1280,800',
        '--disable-blink-features=AutomationControlled',
      ],
      headless: true,
      defaultViewport: { width: 1280, height: 800 },
    },
  })

  const state = { client, status: 'initializing', qr: null }
  sessions[key] = state

  client.on('qr', async (qr) => {
    state.qr = await qrcode.toDataURL(qr)
    state.status = 'qr_ready'
    console.log(`[${key}] QR ready`)
  })

  client.on('loading_screen', () => {
    state.status = 'loading'
  })

  client.on('authenticated', () => {
    state.status = 'authenticated'
    state.qr = null
    console.log(`[${key}] Authenticated`)
  })

  client.on('ready', () => {
    state.status = 'connected'
    state.qr = null
    console.log(`[${key}] Ready`)
  })

  client.on('auth_failure', () => {
    state.status = 'auth_failed'
    console.log(`[${key}] Auth failed`)
  })

  client.on('disconnected', (reason) => {
    state.status = 'disconnected'
    console.log(`[${key}] Disconnected: ${reason}`)
    delete sessions[key]
  })

  client.initialize().catch(async err => {
    console.error(`[${key}] Init error:`, err?.message || err)
    state.status = 'error'
    delete sessions[key]
    // Destroy the browser process so it doesn't block next attempt
    try { await client.destroy() } catch (_) {}
  })

  return state
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/status/:tenantId', (req, res) => {
  const key = String(req.params.tenantId)
  const state = sessions[key]
  if (!state) return res.json({ status: 'not_connected' })
  res.json({ status: state.status, qr: state.qr || null })
})

app.post('/connect/:tenantId', (req, res) => {
  const key = String(req.params.tenantId)
  const state = getOrCreate(key)
  res.json({ status: state.status, qr: state.qr || null })
})

app.post('/send', async (req, res) => {
  const { tenantId, phone, message } = req.body
  if (!tenantId || !phone || !message)
    return res.status(400).json({ error: 'tenantId, phone and message are required' })

  const key = String(tenantId)
  const state = sessions[key]

  if (!state || state.status !== 'connected')
    return res.status(400).json({ error: 'WhatsApp not connected for this tenant' })

  try {
    const chatId = normalisePhone(phone)
    await state.client.sendMessage(chatId, message)
    res.json({ success: true })
  } catch (err) {
    console.error(`[${key}] Send failed: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

app.delete('/disconnect/:tenantId', async (req, res) => {
  const key = String(req.params.tenantId)
  const state = sessions[key]
  if (state) {
    try { await state.client.destroy() } catch (_) {}
    delete sessions[key]
  }
  res.json({ success: true })
})

app.get('/health', (_, res) => res.json({ ok: true, sessions: Object.keys(sessions).length }))

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`WhatsApp service listening on :${PORT}`))
