const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

export interface NINResult {
  status: 'passed' | 'failed' | 'pending'
  name?: string
  dateOfBirth?: string
  failureReason?: string
  providerRef?: string
}

export interface LivenessResult {
  status: 'passed' | 'failed' | 'pending'
  confidence?: number
  failureReason?: string
  providerRef?: string
}

export interface CACResult {
  status: 'passed' | 'failed' | 'pending'
  companyName?: string
  registrationStatus?: string
  directors?: string[]
  failureReason?: string
  providerRef?: string
}

export const verifyNIN = async (
  nin: string,
  firstName: string,
  lastName: string,
  dateOfBirth: string
): Promise<NINResult> => {
  await delay(1500)

  if (nin.length === 11 && /^\d+$/.test(nin)) {
    return {
      status: 'passed',
      name: `${firstName} ${lastName}`,
      dateOfBirth,
      providerRef: `mock-nin-${Date.now()}`,
    }
  }

  return {
    status: 'failed',
    failureReason: 'NIN not found or details do not match. Please check and try again.',
  }
}

export const performLivenessCheck = async (
  _selfieBase64: string
): Promise<LivenessResult> => {
  await delay(2000)

  return {
    status: 'passed',
    confidence: 0.97,
    providerRef: `mock-liveness-${Date.now()}`,
  }
}

export const verifyCAC = async (
  rcNumber: string,
  companyName: string
): Promise<CACResult> => {
  await delay(1500)

  if (rcNumber.toUpperCase().startsWith('RC') && rcNumber.length >= 5) {
    return {
      status: 'passed',
      companyName,
      registrationStatus: 'Active',
      directors: ['Director (Mock)'],
      providerRef: `mock-cac-${Date.now()}`,
    }
  }

  return {
    status: 'failed',
    failureReason: 'Company not found in CAC registry. RC number must start with RC.',
  }
}
