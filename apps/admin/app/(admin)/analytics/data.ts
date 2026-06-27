// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayData {
  dateObj:            Date
  label:              string   // "Jan 1"
  year:               number
  month:              number   // 1-12
  day:                number
  candidates:         number
  companies:          number
  activeUsers:        number
  applications:       number
  jobsPosted:         number
  jobsFilled:         number
  passRate:           number   // 0-100
  avgVerifHours:      number
  ninFail:            number
  livenessFail:       number
  docFail:            number
  badgesIssued:       number
  badgesDisputed:     number
  badgesRevoked:      number
  fraudFlags:         number
  securityEvents:     number
  blockedIPs:         number
  ticketsOpened:      number
  ticketsClosed:      number
  avgResolutionHours: number
  slaCompliance:      number   // 0-100
  revenueNGN:         number
}

export interface ChartPoint extends Omit<DayData, 'dateObj' | 'year' | 'month' | 'day'> {}

export interface PeriodStats {
  totalCandidates:     number
  totalCompanies:      number
  avgActiveUsers:      number
  totalApplications:   number
  totalJobsPosted:     number
  totalJobsFilled:     number
  fillRate:            number   // %
  avgPassRate:         number
  avgVerifHours:       number
  totalBadgesIssued:   number
  totalBadgesDisputed: number
  totalBadgesRevoked:  number
  disputeRate:         number   // %
  totalFraudFlags:     number
  avgFraudPerDay:      number
  totalTickets:        number
  avgSlaCompliance:    number
  totalRevenueNGN:     number
  candidateDelta:      number   // % vs prev period
  companyDelta:        number
  passDelta:           number
  fraudDelta:          number
  revenueDelta:        number
}

export interface Insight {
  type:  'positive' | 'warning' | 'milestone' | 'info'
  title: string
  body:  string
}

// ─── Month list for picker ────────────────────────────────────────────────────

const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const AVAILABLE_MONTHS: Array<{ year: number; month: number; label: string }> = []
for (let y = 2025; y <= 2026; y++) {
  for (let m = 1; m <= (y === 2026 ? 6 : 12); m++) {
    AVAILABLE_MONTHS.push({ year: y, month: m, label: `${MN[m - 1]} ${y}` })
  }
}

// ─── Static reference data ────────────────────────────────────────────────────

export const GEO_DATA = [
  { city: 'Lagos',          pct: 42, count: 773  },
  { city: 'Abuja',          pct: 18, count: 331  },
  { city: 'Port Harcourt',  pct: 12, count: 221  },
  { city: 'Kano',           pct:  8, count: 147  },
  { city: 'Ibadan',         pct:  6, count: 110  },
  { city: 'Enugu',          pct:  5, count:  92  },
  { city: 'Others',         pct:  9, count: 166  },
]

export const ACQUISITION_FUNNEL = [
  { stage: 'Registered',       pct: 100, count: 4219 },
  { stage: 'Email Verified',   pct:  94, count: 3966 },
  { stage: 'Profile Started',  pct:  87, count: 3670 },
  { stage: 'Verif. Submitted', pct:  72, count: 3038 },
  { stage: 'Approved',         pct:  63, count: 2658 },
  { stage: 'Active (30d)',     pct:  48, count: 2025 },
]

export const SUBSCRIPTION_TIERS = [
  { tier: 'Candidate Pro',   count: 892, color: '#6366F1' },
  { tier: 'Company Starter', count: 124, color: '#06B6D4' },
  { tier: 'Company Growth',  count:  67, color: '#10B981' },
  { tier: 'Enterprise',      count:  12, color: '#F59E0B' },
]

export const REJECTION_REASONS = [
  { reason: 'NIN Mismatch',       count: 412, color: '#EF4444' },
  { reason: 'Liveness Failure',   count: 318, color: '#F59E0B' },
  { reason: 'Doc Scan Failed',    count: 247, color: '#8B5CF6' },
  { reason: 'Expired Document',   count: 114, color: '#06B6D4' },
  { reason: 'Incomplete Profile', count:  89, color: '#6366F1' },
]

// ─── Deterministic pseudo-random (same seed → same value every run) ───────────

const rnd = (seed: number): number => {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}
const rr = (seed: number, lo: number, hi: number): number => lo + rnd(seed) * (hi - lo)

// ─── Generate 18 months of daily data (Jan 2025 → Jun 2026) ──────────────────

export const ALL_DATA: DayData[] = []

;(() => {
  let mi = 0  // month index 0-17
  for (let year = 2025; year <= 2026; year++) {
    const maxM = year === 2026 ? 6 : 12
    for (let month = 1; month <= maxM; month++) {
      const g  = Math.pow(1.085, mi)   // compound monthly growth
      const fg = Math.sqrt(g)           // fraud grows slower than platform
      const dim = new Date(year, month, 0).getDate()

      for (let day = 1; day <= dim; day++) {
        const dateObj   = new Date(year, month - 1, day)
        const dow       = dateObj.getDay()
        const wf        = dow === 0 || dow === 6 ? 0.62 : 1   // weekend dip
        const s         = mi * 1000 + day * 17                 // unique seed

        const candidates   = Math.max(1, Math.round(27  * g  * wf * rr(s,    0.78, 1.28)))
        const companies    = Math.max(0, Math.round(4.5 * g  * wf * rr(s+1,  0.70, 1.40)))
        const activeUsers  = Math.round(480 * g * rr(s+2, 0.88, 1.12))
        const applications = Math.round(135 * g  * wf * rr(s+3,  0.76, 1.28))
        const jobsPosted   = Math.max(1, Math.round(14  * g  * wf * rr(s+4,  0.65, 1.35)))
        const jobsFilled   = Math.round(jobsPosted * rr(s+5, 0.18, 0.36))

        // Pass rate: 65 % → 90 % over 17 months
        const passRate = Math.min(96, Math.round((65 + (mi / 17) * 25) * rr(s+6, 0.94, 1.06)))

        // Verif time: 52 h → 8 h
        const avgVerifHours = Math.max(6, Math.round((52 - (mi / 17) * 44) * rr(s+7, 0.82, 1.20)))

        const ninFail      = Math.round(candidates * rr(s+8,  0.06, 0.16))
        const livenessFail = Math.round(candidates * rr(s+9,  0.04, 0.13))
        const docFail      = Math.round(candidates * rr(s+10, 0.03, 0.10))

        const badgesIssued   = Math.round(candidates * 0.72 * rr(s+11, 0.55, 0.95))
        const badgesDisputed = Math.round(badgesIssued * rr(s+12, 0.01, 0.05))
        const badgesRevoked  = Math.round(badgesDisputed * rr(s+13, 0.25, 0.65))

        const fraudSpike = rnd(s+14) > 0.88 ? Math.round(rr(s+15, 3, 8)) : 0
        const fraudFlags = Math.max(0, Math.round(3 * fg * rr(s+16, 0.5, 1.8) + fraudSpike))

        const securityEvents   = Math.round(rr(s+17, 2, 9))
        const blockedIPs       = Math.round(rr(s+18, 0, 5))

        const ticketsOpened    = Math.max(0, Math.round(7 * g * wf * rr(s+19, 0.60, 1.40)))
        const ticketsClosed    = Math.round(ticketsOpened * rr(s+20, 0.72, 1.05))

        // Resolution time: 52 h → 6 h
        const avgResolutionHours = Math.max(3, Math.round((52 - (mi / 17) * 46) * rr(s+21, 0.82, 1.20)))

        // SLA: 68 % → 96 %
        const slaCompliance = Math.min(98, Math.round((68 + (mi / 17) * 28) * rr(s+22, 0.95, 1.03)))

        // Revenue: 450 k NGN/day → ~1.8 M NGN/day
        const revenueNGN = Math.round(450_000 * g * rr(s+23, 0.72, 1.28))

        ALL_DATA.push({
          dateObj, label: `${MN[month - 1]} ${day}`, year, month, day,
          candidates, companies, activeUsers, applications,
          jobsPosted, jobsFilled,
          passRate, avgVerifHours, ninFail, livenessFail, docFail,
          badgesIssued, badgesDisputed, badgesRevoked,
          fraudFlags, securityEvents, blockedIPs,
          ticketsOpened, ticketsClosed, avgResolutionHours, slaCompliance,
          revenueNGN,
        })
      }
      mi++
    }
  }
})()

// ─── Filter helpers ───────────────────────────────────────────────────────────

export function filterByRange(start: Date, end: Date): DayData[] {
  const s = start.getTime()
  const e = end.getTime()
  return ALL_DATA.filter(d => { const t = d.dateObj.getTime(); return t >= s && t <= e })
}

export function filterByMonth(year: number, month: number): DayData[] {
  return ALL_DATA.filter(d => d.year === year && d.month === month)
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

export type Granularity = 'day' | 'week' | 'month'

export function getGranularity(n: number): Granularity {
  if (n <= 62)  return 'day'
  if (n <= 180) return 'week'
  return 'month'
}

function collapse(days: DayData[], label: string): ChartPoint {
  const n = days.length || 1
  const sum = (f: keyof DayData) => days.reduce((a, d) => a + (d[f] as number), 0)
  const avg = (f: keyof DayData) => Math.round(sum(f) / n)
  return {
    label,
    candidates: sum('candidates'), companies: sum('companies'),
    activeUsers: avg('activeUsers'), applications: sum('applications'),
    jobsPosted: sum('jobsPosted'), jobsFilled: sum('jobsFilled'),
    passRate: avg('passRate'), avgVerifHours: avg('avgVerifHours'),
    ninFail: sum('ninFail'), livenessFail: sum('livenessFail'), docFail: sum('docFail'),
    badgesIssued: sum('badgesIssued'), badgesDisputed: sum('badgesDisputed'), badgesRevoked: sum('badgesRevoked'),
    fraudFlags: sum('fraudFlags'), securityEvents: sum('securityEvents'), blockedIPs: sum('blockedIPs'),
    ticketsOpened: sum('ticketsOpened'), ticketsClosed: sum('ticketsClosed'),
    avgResolutionHours: avg('avgResolutionHours'), slaCompliance: avg('slaCompliance'),
    revenueNGN: sum('revenueNGN'),
  }
}

export function aggregateData(raw: DayData[]): ChartPoint[] {
  const gran = getGranularity(raw.length)
  if (gran === 'day') return raw.map(d => collapse([d], d.label))
  if (gran === 'week') {
    const out: ChartPoint[] = []
    for (let i = 0; i < raw.length; i += 7) {
      const chunk = raw.slice(i, i + 7)
      const label = `${chunk[0].label}–${chunk[chunk.length - 1].label.split(' ')[1]}`
      out.push(collapse(chunk, label))
    }
    return out
  }
  // monthly
  const map = new Map<string, DayData[]>()
  raw.forEach(d => {
    const k = `${d.year}-${d.month}`
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(d)
  })
  return Array.from(map.values()).map(days =>
    collapse(days, `${MN[days[0].month - 1]} '${String(days[0].year).slice(2)}`)
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function computeStats(curr: DayData[], prev: DayData[]): PeriodStats {
  const sum = (a: DayData[], f: keyof DayData) => a.reduce((s, d) => s + (d[f] as number), 0)
  const avg = (a: DayData[], f: keyof DayData) => a.length ? sum(a, f) / a.length : 0
  const delta = (c: number, p: number) => p === 0 ? 0 : Math.round(((c - p) / p) * 1000) / 10

  const cCand = sum(curr, 'candidates'), pCand = sum(prev, 'candidates')
  const cComp = sum(curr, 'companies'),  pComp = sum(prev, 'companies')
  const cPass = avg(curr, 'passRate'),   pPass = avg(prev, 'passRate')
  const cFraud = avg(curr, 'fraudFlags'),pFraud = avg(prev, 'fraudFlags')
  const cRev  = sum(curr, 'revenueNGN'), pRev  = sum(prev, 'revenueNGN')
  const cBadge = sum(curr, 'badgesIssued')
  const cDisp  = sum(curr, 'badgesDisputed')
  const cJobsP = sum(curr, 'jobsPosted')
  const cJobsF = sum(curr, 'jobsFilled')

  return {
    totalCandidates:     cCand,
    totalCompanies:      cComp,
    avgActiveUsers:      Math.round(avg(curr, 'activeUsers')),
    totalApplications:   sum(curr, 'applications'),
    totalJobsPosted:     cJobsP,
    totalJobsFilled:     cJobsF,
    fillRate:            cJobsP ? Math.round((cJobsF / cJobsP) * 100) : 0,
    avgPassRate:         Math.round(cPass * 10) / 10,
    avgVerifHours:       Math.round(avg(curr, 'avgVerifHours') * 10) / 10,
    totalBadgesIssued:   cBadge,
    totalBadgesDisputed: cDisp,
    totalBadgesRevoked:  sum(curr, 'badgesRevoked'),
    disputeRate:         cBadge ? Math.round((cDisp / cBadge) * 1000) / 10 : 0,
    totalFraudFlags:     sum(curr, 'fraudFlags'),
    avgFraudPerDay:      Math.round(cFraud * 10) / 10,
    totalTickets:        sum(curr, 'ticketsOpened'),
    avgSlaCompliance:    Math.round(avg(curr, 'slaCompliance') * 10) / 10,
    totalRevenueNGN:     cRev,
    candidateDelta:      delta(cCand, pCand),
    companyDelta:        delta(cComp, pComp),
    passDelta:           delta(cPass, pPass),
    fraudDelta:          delta(cFraud, pFraud),
    revenueDelta:        delta(cRev, pRev),
  }
}

// ─── Health score (0-100) ─────────────────────────────────────────────────────

export function computeHealthScore(s: PeriodStats): number {
  const pass    = (s.avgPassRate / 100) * 35
  const fraud   = Math.max(0, 1 - (s.avgFraudPerDay * 3) / 100) * 25
  const sla     = (s.avgSlaCompliance / 100) * 22
  const growth  = Math.min(1, Math.max(0, s.candidateDelta) / 20) * 18
  return Math.min(99, Math.round(pass + fraud + sla + growth))
}

// ─── Auto-generated insights ──────────────────────────────────────────────────

export function generateInsights(data: DayData[], stats: PeriodStats): Insight[] {
  if (!data.length) return []
  const out: Insight[] = []

  const maxFraud = data.reduce((a, b) => a.fraudFlags > b.fraudFlags ? a : b)
  if (maxFraud.fraudFlags > stats.avgFraudPerDay * 2.2) {
    out.push({
      type: 'warning',
      title: `Fraud spike — ${maxFraud.label}`,
      body: `${maxFraud.fraudFlags} flags detected — ${Math.round((maxFraud.fraudFlags / stats.avgFraudPerDay - 1) * 100)}% above period average. Review flagged accounts.`,
    })
  }

  const bestPass = data.reduce((a, b) => a.passRate > b.passRate ? a : b)
  if (bestPass.passRate >= 82) {
    out.push({
      type: 'positive',
      title: `Peak pass rate: ${bestPass.passRate}%`,
      body: `Best verification day in this period was ${bestPass.label}. Platform trust quality is trending up.`,
    })
  }

  const revM = stats.totalRevenueNGN / 1_000_000
  out.push({
    type: 'milestone',
    title: `₦${revM.toFixed(1)}M revenue in period`,
    body: `${stats.totalCandidates.toLocaleString()} candidates · ${stats.totalCompanies.toLocaleString()} companies · ${stats.avgSlaCompliance}% SLA compliance.`,
  })

  const candDir = stats.candidateDelta >= 0
  out.push({
    type: candDir ? 'info' : 'warning',
    title: candDir
      ? `+${stats.candidateDelta}% candidate growth`
      : `${stats.candidateDelta}% candidate decline`,
    body: `${stats.totalBadgesIssued.toLocaleString()} badges issued, ${stats.totalBadgesDisputed} disputed (${stats.disputeRate}% dispute rate). Fill rate: ${stats.fillRate}%.`,
  })

  return out.slice(0, 4)
}
