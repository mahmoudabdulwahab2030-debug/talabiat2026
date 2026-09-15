import { createFileRoute } from '@tanstack/react-router'
import { createHmac, timingSafeEqual } from 'crypto'

const GRAPH = 'https://graph.facebook.com/v21.0'
const BUCKET = 'whatsapp-inbox'

type WaDoc = {
  id?: string
  filename?: string
  mime_type?: string
  caption?: string
}

function sanitize(name: string) {
  return name.replace(/[^\w.\-\u0600-\u06FF ]+/g, '_').slice(0, 120) || 'file.xlsx'
}

export const Route = createFileRoute('/api/public/whatsapp/webhook')({
  server: {
    handlers: {
      // تحقق ميتا من الرابط
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const verifyToken = process.env['WHATSAPP_VERIFY_TOKEN']
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge') ?? ''
        if (mode === 'subscribe' && verifyToken && token === verifyToken) {
          return new Response(challenge, { status: 200 })
        }
        return new Response('Forbidden', { status: 403 })
      },

      POST: async ({ request }) => {
        const appSecret = process.env['WHATSAPP_APP_SECRET']
        const accessToken = process.env['WHATSAPP_ACCESS_TOKEN']
        const body = await request.text()

        if (appSecret) {
          const header = request.headers.get('x-hub-signature-256') ?? ''
          const expected = 'sha256=' + createHmac('sha256', appSecret).update(body).digest('hex')
          const a = Buffer.from(header)
          const b = Buffer.from(expected)
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response('Invalid signature', { status: 401 })
          }
        }

        if (!accessToken) return new Response('Not configured', { status: 503 })

        let payload: any
        try {
          payload = JSON.parse(body)
        } catch {
          return new Response('Bad request', { status: 400 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        let saved = 0

        for (const entry of payload?.entry ?? []) {
          for (const change of entry?.changes ?? []) {
            const value = change?.value ?? {}
            const contacts: any[] = value?.contacts ?? []
            for (const message of value?.messages ?? []) {
              const doc: WaDoc | undefined = message?.document
              if (!doc?.id) continue
              const mime = doc.mime_type ?? ''
              const filename = sanitize(doc.filename ?? 'file.xlsx')
              const isSheet =
                /sheet|excel|spreadsheet|csv/i.test(mime) || /\.(xlsx|xls|csv)$/i.test(filename)
              if (!isSheet) continue

              try {
                const metaRes = await fetch(`${GRAPH}/${doc.id}`, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                })
                if (!metaRes.ok) continue
                const meta = (await metaRes.json()) as { url?: string }
                if (!meta.url) continue

                const fileRes = await fetch(meta.url, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                })
                if (!fileRes.ok) continue
                const bytes = new Uint8Array(await fileRes.arrayBuffer())

                const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${filename}`
                const up = await supabaseAdmin.storage
                  .from(BUCKET)
                  .upload(path, bytes, {
                    contentType: mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    upsert: true,
                  })
                if (up.error) continue

                const sender = contacts[0] ?? {}
                await supabaseAdmin.from('whatsapp_files').insert({
                  data: {
                    filename,
                    mime,
                    caption: doc.caption ?? '',
                    storagePath: path,
                    size: bytes.byteLength,
                    messageId: message?.id ?? '',
                    from: message?.from ?? '',
                    senderName: sender?.profile?.name ?? '',
                    receivedAt: message?.timestamp
                      ? new Date(Number(message.timestamp) * 1000).toISOString()
                      : new Date().toISOString(),
                    status: 'pending',
                    branch: '',
                    orderDate: '',
                  },
                })
                saved++
              } catch (err) {
                console.error('whatsapp document ingest failed', err)
              }
            }
          }
        }

        return Response.json({ ok: true, saved })
      },
    },
  },
})
