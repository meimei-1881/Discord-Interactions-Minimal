require('dotenv').config()

const express = require('express')
const { verifyKey } = require('discord-interactions')

const app = express()
const PORT = Number(process.env.PORT || 8080)
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || ''

app.disable('x-powered-by')

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

app.post('/api/discord/interactions', express.raw({ type: '*/*' }), (req, res) => {
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
    console.error('[interactions] invalid JSON body')
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  console.log('[interactions] received', {
    type: interaction?.type,
    applicationId: interaction?.application_id,
    hasSignature: Boolean(signature),
    contentType: req.get('content-type') || null,
  })

  const isValid = verifyKey(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY)

  if (!isValid) {
    console.error('[interactions] invalid signature', {
      applicationId: interaction?.application_id,
      publicKeyPrefix: DISCORD_PUBLIC_KEY.slice(0, 12),
    })
    return res.status(401).json({ error: 'Invalid request signature' })
  }

  console.log('[interactions] signature verified')

  if (interaction.type === 1) {
    const payload = JSON.stringify({ type: 1 })
    res.status(200)
    res.setHeader('Content-Type', 'application/json')
    return res.send(payload)
  }

  return res.status(200).json({ type: 5 })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Discord minimal webhook listening on 0.0.0.0:${PORT}`)
})
