import nodemailer from 'nodemailer'
import { BusinessError } from '@/core/errors'

export interface SendMailInput {
  to: string
  subject: string
  html: string
  text?: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new BusinessError(`邮件服务未配置：${name}`)
  return value
}

function smtpPort(): number {
  const raw = process.env.SMTP_PORT?.trim()
  if (!raw) return 465
  const port = Number.parseInt(raw, 10)
  if (!Number.isFinite(port) || port <= 0) {
    throw new BusinessError('SMTP_PORT 配置不合法')
  }
  return port
}

function smtpSecure(): boolean {
  const raw = process.env.SMTP_SECURE?.trim().toLowerCase()
  if (!raw) return smtpPort() === 465
  return raw === 'true' || raw === '1' || raw === 'yes'
}

function smtpTimeoutMs(): number {
  const raw = process.env.SMTP_TIMEOUT_MS?.trim()
  if (!raw) return 10000
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1000) return 10000
  return Math.min(n, 60000)
}

function smtpTlsRejectUnauthorized(): boolean {
  const raw = process.env.SMTP_TLS_REJECT_UNAUTHORIZED?.trim().toLowerCase()
  if (!raw) return true
  return !(raw === 'false' || raw === '0' || raw === 'no')
}

function mailErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : ''
  const command =
    typeof error === 'object' && error && 'command' in error
      ? String((error as { command?: unknown }).command ?? '')
      : ''

  if (code === 'EAUTH') {
    return '邮件账号认证失败，请检查 SMTP_USER 和 SMTP_PASSWORD'
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNRESET') {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : ''
    if (message.includes('unable to verify the first certificate')) {
      return '邮件服务 TLS 证书校验失败，请让 Node 使用系统 CA，或配置 SMTP_TLS_REJECT_UNAUTHORIZED=false 进行本地临时测试'
    }
    return `邮件服务连接失败，请检查 SMTP_HOST、SMTP_PORT、SMTP_SECURE 和网络连通性${command ? `（${command}）` : ''}`
  }
  if (code === 'ECONNECTION') {
    return '无法连接邮件服务器，请检查 SMTP 地址和端口'
  }
  return '邮件发送失败，请检查邮件服务配置'
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const host = requiredEnv('SMTP_HOST')
  const port = smtpPort()
  const user = requiredEnv('SMTP_USER')
  const pass = requiredEnv('SMTP_PASSWORD')
  const from = requiredEnv('SMTP_FROM')
  const timeout = smtpTimeoutMs()
  const rejectUnauthorized = smtpTlsRejectUnauthorized()

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: smtpSecure(),
    auth: { user, pass },
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,
    tls: {
      servername: host,
      rejectUnauthorized,
    },
  })

  try {
    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    })
  } catch (error) {
    console.error('[MAIL]', error)
    throw new BusinessError(mailErrorMessage(error))
  }
}
