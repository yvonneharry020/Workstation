export const APP_NAME = 'Workstation' as const
export const APP_SCHEME = 'workstation' as const

export const TRUST_SCORE = {
  LOW_THRESHOLD: 50,
  WEIGHTS: {
    PHONE_VERIFIED: 10,
    NIN_VERIFIED: 20,
    LIVENESS_VERIFIED: 15,
    DOCUMENTS_VERIFIED: 20,
    BADGE_RECEIVED: 5,
    POSITIVE_INTERACTION: 2,
  },
} as const

export const VERIFICATION = {
  MAX_NIN_ATTEMPTS: 3,
  MAX_LIVENESS_ATTEMPTS: 3,
  OTP_EXPIRY_MINUTES: 15,
  OTP_RESEND_SECONDS: 60,
  DEV_OTP: '123456',
} as const

export const FILE_UPLOAD = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024,
  MAX_SIZE_LABEL: '5MB',
  ACCEPTED_TYPES: ['application/pdf', 'image/jpeg', 'image/png'] as const,
} as const

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  ATS_PAGE_SIZE: 50,
  JOBS_PAGE_SIZE: 20,
} as const

export const EMAIL_LIMITS = {
  MAX_BULK_PER_DAY: 500,
} as const

export const IS_MOCK_VERIFICATION =
  process.env.EXPO_PUBLIC_MOCK_VERIFICATION === 'true'
