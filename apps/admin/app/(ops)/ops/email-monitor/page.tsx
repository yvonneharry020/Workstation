'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

type EmailStatus = 'sent' | 'failed' | 'bounced' | 'flagged'

interface Email {
  id: string
  user_id: string | null
  company_id: string | null
  recipient_email: string
  subject: string
  body: string | null
  template_id: string | null
  status: EmailStatus
  sent_at: string | null
  created_at: string
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  category: string
  created_at: string
}

const STATUS_STYLE: Record<EmailStatus, { text: string; bg: string; border: string }> = {
  sent:    { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  flagged: { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  bounced: { text: '#FB923C', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.3)' },
  failed:  { text: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)' },
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function EmailMonitorPage() {
  const supabase = createClient()
  const [emails, setEmails] = useState<Email[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [tabStatus, setTabStatus] = useState<'all' | EmailStatus>('all')
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [viewEmail, setViewEmail] = useState<Email | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [emailsRes, templatesRes] = await Promise.all([
      supabase.from('emails_sent').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('email_templates').select('*').order('created_at', { ascending: false }),
    ])
    setEmails((emailsRes.data ?? []) as Email[])
    setTemplates((templatesRes.data ?? []) as EmailTemplate[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function flagSpam(email: Email) {
    setActing(`flag-${email.id}`)
    await supabase.from('emails_sent').update({ status: 'flagged' }).eq('id', email.id)
    await supabase.from('flagged_content').insert({
      content_type: 'email',
      content_id: email.id,
      reason: 'Flagged as spam by admin',
      severity: 'high',
      status: 'pending',
    })
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.email_flagged_spam',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: email.id,
      target_type: 'email',
      severity: 'warning',
      app: 'admin_panel',
    })
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, status: 'flagged' } : e))
    setActing(null)
  }

  async function markBounced(email: Email) {
    setActing(`bounce-${email.id}`)
    await supabase.from('emails_sent').update({ status: 'bounced' }).eq('id', email.id)
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, status: 'bounced' } : e))
    setActing(null)
  }

  // Detect high-volume senders (>20 emails in 24h)
  const oneDayAgo = Date.now() - 86400000
  const recentSenders: Record<string, number> = {}
  emails.forEach(e => {
    if (e.company_id && new Date(e.created_at).getTime() > oneDayAgo) {
      recentSenders[e.company_id] = (recentSenders[e.company_id] ?? 0) + 1
    }
  })
  const highVolumeSenders = Object.entries(recentSenders).filter(([, count]) => count > 20).map(([id]) => id)

  const filtered = emails.filter(e => {
    if (tabStatus !== 'all' && e.status !== tabStatus) return false
    if (search) {
      const s = search.toLowerCase()
      if (!e.recipient_email.toLowerCase().includes(s) && !e.subject.toLowerCase().includes(s) && !(e.company_id ?? '').toLowerCase().includes(s)) return false
    }
    return true
  })

  const stats = {
    total: emails.length,
    flagged: emails.filter(e => e.status === 'flagged').length,
    bounced: emails.filter(e => e.status === 'bounced').length,
    failed: emails.filter(e => e.status === 'failed').length,
    flaggedRate: emails.length > 0 ? ((emails.filter(e => e.status === 'flagged').length / emails.length) * 100).toFixed(1) : '0',
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Email Monitor" subtitle="Monitor company communications for spam and harassment" />
      <div className="p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Total Sent', value: stats.total, color: '#38BDF8' },
            { label: 'Flagged', value: stats.flagged, color: '#F87171' },
            { label: 'Bounced', value: stats.bounced, color: '#FB923C' },
            { label: 'Failed', value: stats.failed, color: '#9CA3AF' },
            { label: 'Flag Rate', value: `${stats.flaggedRate}%`, color: stats.flaggedRate === '0' ? '#34D399' : parseFloat(stats.flaggedRate) < 5 ? '#FBBF24' : '#F87171' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[22px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* High volume alert */}
        {highVolumeSenders.length > 0 && (
          <div style={{ padding: '12px 16px', borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#F87171', marginBottom: 4 }}>High Volume Senders Detected</p>
            <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>
              {highVolumeSenders.length} company{highVolumeSenders.length > 1 ? 'ies have' : ' has'} sent {'>'}20 emails in the last 24 hours. Review immediately.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {highVolumeSenders.map(id => (
                <span key={id} style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontFamily: 'monospace' }}>
                  {id.slice(0, 8)}… · {recentSenders[id]} emails
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tabs + Search */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['all', 'sent', 'flagged', 'bounced', 'failed'] as const).map(s => (
            <button key={s} onClick={() => setTabStatus(s)}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${tabStatus === s ? '#F59E0B' : 'var(--border)'}`, backgroundColor: tabStatus === s ? 'rgba(245,158,11,0.1)' : 'transparent', color: tabStatus === s ? '#F59E0B' : 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email, subject, or company ID…"
            style={{ flex: 1, minWidth: 220, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }}
          />
        </div>

        {/* Email table */}
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {loading ? (
            <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading emails…</p></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>No emails found</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {['Company', 'Recipient', 'Subject', 'Template', 'Status', 'Sent', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map(email => {
                  const isHigh = email.company_id ? highVolumeSenders.includes(email.company_id) : false
                  const ss = STATUS_STYLE[email.status] ?? STATUS_STYLE.sent
                  return (
                    <tr key={email.id} style={{ borderBottom: '1px solid var(--border)', backgroundColor: isHigh ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--tx-3)', fontFamily: 'monospace' }}>{email.company_id?.slice(0, 8) ?? '—'}</span>
                          {isHigh && <span style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>HIGH VOL</span>}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-2)' }}>{email.recipient_email}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-1)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject.slice(0, 50)}{email.subject.length > 50 ? '…' : ''}</td>
                      <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--tx-3)' }}>{email.template_id ?? '—'}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ color: ss.text, backgroundColor: ss.bg, border: `1px solid ${ss.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{email.status}</span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{formatDate(email.sent_at ?? email.created_at)}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => setViewEmail(email)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>View</button>
                          {email.status !== 'flagged' && (
                            <button onClick={() => flagSpam(email)} disabled={acting === `flag-${email.id}`} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                              {acting === `flag-${email.id}` ? '…' : 'Flag'}
                            </button>
                          )}
                          {email.status === 'sent' && (
                            <button onClick={() => markBounced(email)} disabled={acting === `bounce-${email.id}`} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(251,146,60,0.4)', backgroundColor: 'rgba(251,146,60,0.08)', color: '#FB923C', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                              {acting === `bounce-${email.id}` ? '…' : 'Bounce'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Email Templates */}
        {templates.length > 0 && (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 12 }}>Email Templates</h3>
            <div style={{ ...CARD, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Name', 'Subject', 'Category', 'Created'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {templates.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{t.name}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-2)' }}>{t.subject}</td>
                      <td style={{ padding: '10px 16px' }}><span style={{ backgroundColor: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{t.category}</span></td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View drawer */}
        {viewEmail && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 480, height: '100%', backgroundColor: 'var(--bg-surface)', padding: 24, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>Email Content</h3>
                <button onClick={() => setViewEmail(null)} style={{ border: 'none', background: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
              {[
                { label: 'Company ID', value: viewEmail.company_id ?? '—' },
                { label: 'Recipient', value: viewEmail.recipient_email },
                { label: 'Subject', value: viewEmail.subject },
                { label: 'Template', value: viewEmail.template_id ?? '—' },
                { label: 'Status', value: viewEmail.status.toUpperCase() },
                { label: 'Sent', value: formatDate(viewEmail.sent_at ?? viewEmail.created_at) },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{row.label}</p>
                  <p style={{ fontSize: 13, color: 'var(--tx-1)' }}>{row.value}</p>
                </div>
              ))}
              <div>
                <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Body Preview</p>
                <div style={{ padding: 12, borderRadius: 10, backgroundColor: 'var(--bg-base)', fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                  {viewEmail.body?.slice(0, 500) ?? 'No body content'}{viewEmail.body && viewEmail.body.length > 500 ? '\n\n[Truncated…]' : ''}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
