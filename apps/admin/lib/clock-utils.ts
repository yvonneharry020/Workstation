export interface WorkConfig {
  monthly_salary_naira: number
  work_days: number[]
  work_start_time: string  // 'HH:MM:SS'
  work_end_time: string    // 'HH:MM:SS'
  break_duration_minutes: number
}

/** Compute hourly rate from monthly salary and schedule. */
export function computeHourlyRate(config: WorkConfig): number {
  const daysPerWeek = config.work_days.length
  if (daysPerWeek === 0) return 0

  const avgWorkingDaysPerMonth = (52 * daysPerWeek) / 12

  const [startH, startM] = config.work_start_time.split(':').map(Number)
  const [endH, endM]     = config.work_end_time.split(':').map(Number)
  const scheduledMinutes = (endH * 60 + endM) - (startH * 60 + startM)
  const effectiveMinutes = scheduledMinutes - config.break_duration_minutes
  const effectiveHoursPerDay = Math.max(effectiveMinutes / 60, 0)

  const totalEffectiveHoursPerMonth = avgWorkingDaysPerMonth * effectiveHoursPerDay
  if (totalEffectiveHoursPerMonth === 0) return 0

  return config.monthly_salary_naira / totalEffectiveHoursPerMonth
}

/** Standard work seconds per day (excluding break). */
export function computeStandardWorkSeconds(config: WorkConfig): number {
  const [startH, startM] = config.work_start_time.split(':').map(Number)
  const [endH, endM]     = config.work_end_time.split(':').map(Number)
  const scheduledMinutes = (endH * 60 + endM) - (startH * 60 + startM)
  const effectiveMinutes = scheduledMinutes - config.break_duration_minutes
  return Math.max(effectiveMinutes * 60, 0)
}

/** Format seconds as HH:MM:SS string. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':')
}

/** Compute pay earned for a completed or in-progress session (in Naira). */
export function computeSessionPay(
  totalWorkedSeconds: number,
  overtimeSeconds: number,
  overtimeApproved: boolean,
  hourlyRateNaira: number,
): { regularPay: number; overtimePay: number; totalPay: number } {
  const regularSeconds = Math.max(totalWorkedSeconds - overtimeSeconds, 0)
  const regularPay     = (regularSeconds / 3600) * hourlyRateNaira
  const overtimePay    = overtimeApproved ? (overtimeSeconds / 3600) * hourlyRateNaira * 1.5 : 0
  const totalPay       = regularPay + overtimePay
  return { regularPay, overtimePay, totalPay }
}

/** Format Naira amount with ₦ symbol and commas. */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Next presence check timestamp: interval + random 0–15 min jitter. */
export function nextPresenceCheckAt(
  fromDate: Date,
  intervalMinutes: number,
): Date {
  const jitterMs = Math.random() * 15 * 60 * 1000
  return new Date(fromDate.getTime() + intervalMinutes * 60 * 1000 + jitterMs)
}

/** Session status label. */
export function statusLabel(status: string): string {
  switch (status) {
    case 'active':          return 'Working'
    case 'on_break':        return 'On Break'
    case 'completed':       return 'Clocked Out'
    case 'auto_logged_out': return 'Auto Logged Out'
    default:                return 'Unknown'
  }
}
