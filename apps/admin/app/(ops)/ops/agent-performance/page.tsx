'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

interface Ticket {
  id: string
  assigned_to: string | null
  status: string | null
  created_at: string
  resolved_at: string | null
}

interface AuditEntry {
  actor_email: string | null
}

interface AgentStat {
  email: string
  total: number
  resolved: number
  open: number
  rate: number
  avgResolutionHrs: number | null
  adminActions: number
}

type DateRange = '7d' | '30d' | '90d'

function rateBadge(rate: number) {
  const color = rate >= 80 ? '#34D399' : rate >= 50 ? '#FBBF24' : '#F87171'
  const bg = rate >= 80 ? 'rgba(52,211,153,0.1)' : rate >= 50 ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)'
  const border = rate >= 80 ? 'rgba(52,211,153,0.3)' : rate >= 50 ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'
  return <span style={{ color, backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{rate}%</span>
}

export default function AgentPerformancePage() {
  const supabase = createClient()
  const [agents, setAgents] = useState<AgentStat[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('30d')

  const load = useCallback(async () => {
    setLoading(true)
    const cutoffMs = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    const cutoff = new Date(Date.now() - cutoffMs * 86400000).toISOString()

    const [ticketsRes, auditRes] = await Promise.all([
      supabase.from('support_tickets').select('id,assigned_to,status,created_at,resolved_at').gte('created_at', cutoff),
      supabase.from('audit_logs').select('actor_email').eq('actor_type', 'admin').gte('created_at', cutoff),
    ])

    const tickets = (ticketsRes.data ?? []) as Ticket[]
    const audits = (auditRes.data ?? []) as AuditEntry[]

    const auditCounts: Record<string, number> = {}
    audits.forEach(a => {
      if (a.actor_email) auditCounts[a.actor_email] = (auditCounts[a.actor_email] ?? 0) + 1
    })

    const agentMap: Record<string, { total: number; resolved: number; open: number; resTimes: number[] }> = {}
    tickets.forEach(t => {
      const email = t.assigned_to ?? 'unassigned'
      if (!agentMap[email]) agentMap[email] = { total: 0, resolved: 0, open: 0, resTimes: [] }
      agentMap[email].total++
      if (t.status === 'resolved') {
        agentMap[email].resolved++
        if (t.resolved_at) {
          const hrs = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 3600000
          agentMap[email].resTimes.push(hrs)
        }
      } else {
        agentMap[email].open++
      }
    })

    const allEmails = new Set([...Object.keys(agentMap), ...Object.keys(auditCounts)])
    const stats: AgentStat[] = Array.from(allEmails).map(email => {
      const a = agentMap[email] ?? { total: 0, resolved: 0, open: 0, resTimes: [] }
      const avgHrs = a.resTimes.length > 0 ? Math.round(a.resTimes.reduce((s, x) => s + x, 0) / a.resTimes.length) : null
      return {
        email,
        total: a.total,
        resolved: a.resolved,
        open: a.open,
        rate: a.total > 0 ? Math.round((a.resolved / a.total) * 100) : 0,
        avgResolutionHrs: avgHrs,
        adminActions: auditCounts[email] ?? 0,
      }
    }).sort((a, b) => b.rate - a.rate || b.total - a.total)

    setAgents(stats)
    setLoading(false)
  }, [supabase, dateRange])

  useEffect(() => { void load() }, [load])

  const totalTickets = agents.reduce((s, a) => s + a.total, 0)
  const avgRate = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.rate, 0) / agents.length) : 0
  const bestAgent = agents.find(a => a.total > 0)

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Agent Performance" subtitle="Support team ticket resolution metrics and activity" />
      <div className="p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active Agents', value: agents.filter(a => a.total > 0 || a.adminActions > 0).length, color: '#38BDF8' },
            { label: `Total Tickets (${dateRange})`, value: totalTickets, color: '#F59E0B' },
            { label: 'Avg Resolution Rate', value: `${avgRate}%`, color: avgRate >= 70 ? '#34D399' : '#FBBF24' },
            { label: 'Top Agent', value: bestAgent ? bestAgent.email.split('@')[0] : '—', color: '#A78BFA' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[22px] font-bold font-display truncate" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Date filter */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['7d', '30d', '90d'] as DateRange[]).map(d => (
            <button key={d} onClick={() => setDateRange(d)}
              style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${dateRange === d ? '#F59E0B' : 'var(--border)'}`, backgroundColor: dateRange === d ? 'rgba(245,158,11,0.1)' : 'transparent', color: dateRange === d ? '#F59E0B' : 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {d === '7d' ? 'Last 7 days' : d === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {loading ? (
            <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading…</p></div>
          ) : agents.length === 0 ? (
            <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>No agent data found</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {['Rank', 'Agent', 'Tickets', 'Resolved', 'Open', 'Resolution Rate', 'Avg Time', 'Admin Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, i) => (
                  <tr key={agent.email} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: i < 3 ? ['#F59E0B', '#9CA3AF', '#CD7C2C'][i] : 'var(--bg-surface)', color: i < 3 ? '#fff' : 'var(--tx-3)', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{agent.email}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tx-2)', textAlign: 'center' }}>{agent.total}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#34D399', textAlign: 'center', fontWeight: 600 }}>{agent.resolved}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#F87171', textAlign: 'center', fontWeight: 600 }}>{agent.open}</td>
                    <td style={{ padding: '10px 14px' }}>{rateBadge(agent.rate)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--tx-3)' }}>{agent.avgResolutionHrs != null ? `${agent.avgResolutionHrs}h` : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tx-2)', textAlign: 'center' }}>{agent.adminActions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
