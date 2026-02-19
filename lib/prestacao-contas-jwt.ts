import { createHmac, timingSafeEqual } from 'crypto'

const ALG = 'sha256'
const EXP_DAYS = 90

export interface PrestacaoTokenPayload {
  projectId: string
  department: string
  exp: number
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Buffer {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  if (pad) b64 += '='.repeat(4 - pad)
  return Buffer.from(b64, 'base64')
}

export function signPrestacaoToken(projectId: string, department: string): string {
  const secret = process.env.PRESTACAO_CONTAS_JWT_SECRET
  if (!secret) throw new Error('PRESTACAO_CONTAS_JWT_SECRET não definida.')
  const exp = Math.floor(Date.now() / 1000) + EXP_DAYS * 24 * 3600
  const payload: PrestacaoTokenPayload = { projectId, department, exp }
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = createHmac(ALG, secret).update(payloadB64).digest()
  return `${payloadB64}.${base64UrlEncode(sig)}`
}

export function verifyPrestacaoToken(token: string): PrestacaoTokenPayload | null {
  const secret = process.env.PRESTACAO_CONTAS_JWT_SECRET
  if (!secret) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  const sig = createHmac(ALG, secret).update(payloadB64).digest()
  const sigReceived = base64UrlDecode(sigB64)
  if (sig.length !== sigReceived.length || !timingSafeEqual(sig, sigReceived)) return null
  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as PrestacaoTokenPayload
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    if (!payload.projectId || !payload.department) return null
    return payload
  } catch {
    return null
  }
}
