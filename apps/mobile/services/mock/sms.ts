import { VERIFICATION } from '@/lib/constants'

export interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
}

export const sendOTP = async (phone: string): Promise<SMSResult> => {
  await new Promise((r) => setTimeout(r, 800))
  console.log(`[DEV] OTP for ${phone}: ${VERIFICATION.DEV_OTP}`)
  return { success: true, messageId: `mock-sms-${Date.now()}` }
}

export const verifyOTP = async (
  _phone: string,
  code: string
): Promise<{ valid: boolean }> => {
  return { valid: code === VERIFICATION.DEV_OTP }
}
