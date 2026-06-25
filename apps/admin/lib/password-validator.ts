const SPECIAL = /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/

export interface PasswordValidation {
  valid: boolean
  errors: string[]
  score: number
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = []

  if (password.length < 12) errors.push('At least 12 characters required')
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('At least one number')
  if (!SPECIAL.test(password)) errors.push('At least one special character')
  if (/\s/.test(password)) errors.push('No spaces allowed')

  return { valid: errors.length === 0, errors, score: computeScore(password) }
}

function computeScore(p: string): number {
  let s = 0
  if (p.length >= 12) s++
  if (p.length >= 16) s++
  if (p.length >= 20) s++
  if (/[A-Z]/.test(p)) s++
  if (/[a-z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (SPECIAL.test(p)) s++
  if ((p.match(/[A-Z]/g) ?? []).length >= 2) s++
  if ((p.match(/[0-9]/g) ?? []).length >= 2) s++
  if (SPECIAL.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p) && p.length >= 16) s++
  return Math.min(s, 10)
}
