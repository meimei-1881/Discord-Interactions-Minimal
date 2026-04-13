require('dotenv').config()

const express = require('express')
const nacl = require('tweetnacl')

const app = express()
const PORT = Number(process.env.PORT || 8080)
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || ''
const FORWARD_INTERACTIONS_URL = process.env.FORWARD_INTERACTIONS_URL || ''
const PUBLIC_KEY_RESOLVER_URL = process.env.PUBLIC_KEY_RESOLVER_URL || ''
const PUBLIC_KEY_RESOLVER_SECRET = process.env.PUBLIC_KEY_RESOLVER_SECRET || ''

process.on('unhandledRejection', (error) => {
  console.error('[process] unhandledRejection', error)
})

process.on('uncaughtException', (error) => {
  console.error('[process] uncaughtException', error)
})

function verifySignature(signature, timestamp, rawBody, publicKey) {
  return nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, 'hex'),
    Buffer.from(publicKey, 'hex')
  )
}

async function resolvePublicKey(applicationId) {
  if (!applicationId) return null

  if (PUBLIC_KEY_RESOLVER_URL && PUBLIC_KEY_RESOLVER_SECRET) {
    try {
      const response = await fetch(PUBLIC_KEY_RESOLVER_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${PUBLIC_KEY_RESOLVER_SECRET}`,
        },
        body: JSON.stringify({ applicationId }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data?.publicKey) {
          return data.publicKey
        }
      }
    } catch (error) {
      console.error('[interactions] resolver request failed', error)
    }
  }

  return DISCORD_PUBLIC_KEY || null
}

app.disable('x-powered-by')

app.use((req, _res, next) => {
  console.log('[http] incoming', {
    method: req.method,
    path: req.path,
    userAgent: req.get('user-agent') || null,
    hasSignature: Boolean(req.get('x-signature-ed25519')),
    timestampHeader: req.get('x-signature-timestamp') || null,
  })
  next()
})

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

app.post('/api/discord/interactions', express.raw({ type: '*/*' }), async (req, res) => {
  const debugId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const signature = req.get('x-signature-ed25519')
  const timestamp = req.get('x-signature-timestamp')

  if (!signature || !timestamp) {
    console.error('[interactions] missing signature headers')
    return res.status(401).json({ error: 'Missing signature headers' })
  }

  if (!DISCORD_PUBLIC_KEY) {
    console.error('[interactions] DISCORD_PUBLIC_KEY is not set')
    return res.status(500).json({ error: 'DISCORD_PUBLIC_KEY is not set' })
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''

  let interaction
  try {
    interaction = JSON.parse(rawBody)
  } catch {
    console.error('[interactions] invalid JSON body', { debugId })
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  console.log('[interactions] received', {
    debugId,
    interactionId: interaction?.id,
    type: interaction?.type,
    customId: interaction?.data?.custom_id,
    guildId: interaction?.guild_id,
    applicationId: interaction?.application_id,
    hasSignature: Boolean(signature),
    contentType: req.get('content-type') || null,
  })

  const resolvedPublicKey = await resolvePublicKey(String(interaction?.application_id || ''))
  if (!resolvedPublicKey) {
    return res.status(500).json({ error: 'No public key resolved for application' })
  }

  const isValid = verifySignature(signature, timestamp, rawBody, resolvedPublicKey)

  if (!isValid) {
    console.error('[interactions] invalid signature', {
      debugId,
      applicationId: interaction?.application_id,
      publicKeyPrefix: resolvedPublicKey.slice(0, 12),
    })
    return res.status(401).json({ error: 'Invalid request signature' })
  }

  console.log('[interactions] signature verified')

  if (interaction.type === 1) {
    console.log('[interactions] ping pong', { debugId })
    const payload = '{"type":1}'
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    return res.end(payload)
  }

  if (!FORWARD_INTERACTIONS_URL) {
    return res.status(200).json({ type: 5 })
  }

  try {
    console.log('[interactions] forwarding to upstream', {
      debugId,
      url: FORWARD_INTERACTIONS_URL,
    })

    const upstream = await fetch(FORWARD_INTERACTIONS_URL, {
      method: 'POST',
      headers: {
        'content-type': req.get('content-type') || 'application/json',
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
        'x-interaction-debug-id': debugId,
      },
      body: rawBody,
    })

    const text = await upstream.text()
    console.log('[interactions] upstream response', {
      debugId,
      status: upstream.status,
      contentType: upstream.headers.get('content-type') || null,
      bodyPreview: text.slice(0, 300),
    })
    res.statusCode = upstream.status
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    return res.end(text)
  } catch (error) {
    console.error('[interactions] forward failed', { debugId, error })
    return res.status(502).json({ error: 'Failed to forward interaction' })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log('[startup] config', {
    port: PORT,
    hasDiscordPublicKey: Boolean(DISCORD_PUBLIC_KEY),
    hasForwardUrl: Boolean(FORWARD_INTERACTIONS_URL),
    hasResolverUrl: Boolean(PUBLIC_KEY_RESOLVER_URL),
    hasResolverSecret: Boolean(PUBLIC_KEY_RESOLVER_SECRET),
  })
  console.log(`Discord minimal webhook listening on 0.0.0.0:${PORT}`)
})
