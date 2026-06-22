import { z } from 'zod'

const nigerianPhone = z
  .string()
  .regex(/^(\+234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number (e.g. 08012345678)')

// ─── Auth ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const registerSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  role: z.enum(['candidate', 'company']),
})

export const otpSchema = z.object({
  code: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d+$/, 'OTP must contain only numbers'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

// ─── Candidate Onboarding ────────────────────────────────────────────────────

export const candidateBasicInfoSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: nigerianPhone,
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['male', 'female', 'prefer_not_to_say'], {
    errorMap: () => ({ message: 'Select your gender' }),
  }),
  stateOfOriginId: z.number().int().positive('Select your state of origin'),
})

export const ninSchema = z.object({
  nin: z
    .string()
    .length(11, 'NIN must be exactly 11 digits')
    .regex(/^\d+$/, 'NIN must contain only numbers'),
})

export const candidatePreferencesSchema = z.object({
  jobCategories: z.array(z.string().uuid()).min(1, 'Select at least one job category'),
  experienceYears: z.number().int().min(0).max(50),
  desiredSalaryMin: z.number().int().positive().optional(),
  desiredSalaryMax: z.number().int().positive().optional(),
  preferredWorkMode: z.enum(['remote', 'hybrid', 'on_site']).optional(),
  preferredStateId: z.number().int().positive().optional(),
  employmentStatus: z.string().optional(),
})

// ─── Company Onboarding ──────────────────────────────────────────────────────

export const companyBasicInfoSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  rcNumber: z
    .string()
    .min(5, 'Enter a valid RC number')
    .regex(/^RC\d+$/i, 'RC number must start with RC followed by digits (e.g. RC123456)'),
  industry: z.string().min(1, 'Select an industry'),
  companySize: z.enum(['1_10', '11_50', '51_200', '201_500', '500_plus']),
  businessEmail: z
    .string()
    .email('Enter a valid email address')
    .refine(
      (email) =>
        !['@gmail.', '@yahoo.', '@hotmail.', '@outlook.'].some((d) => email.includes(d)),
      'Use your company domain email, not a personal email address'
    ),
  businessPhone: nigerianPhone,
})

export const companyProfileSchema = z.object({
  about: z.string().min(50, 'Write at least 50 characters about your company'),
  cultureDescription: z.string().optional(),
  websiteUrl: z.string().url('Enter a valid website URL').optional().or(z.literal('')),
  linkedinUrl: z.string().url('Enter a valid LinkedIn URL').optional().or(z.literal('')),
  foundedYear: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear())
    .optional(),
})

// ─── Job Posting ─────────────────────────────────────────────────────────────

export const jobPostingSchema = z.object({
  title: z.string().min(3, 'Job title must be at least 3 characters'),
  categoryId: z.string().uuid('Select a job category'),
  department: z.string().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']),
  workMode: z.enum(['remote', 'hybrid', 'on_site']),
  experienceLevel: z.enum(['entry', 'junior', 'mid', 'senior', 'lead', 'executive']),
  stateId: z.number().int().positive().optional(),
  city: z.string().optional(),
  description: z.string().min(100, 'Job description must be at least 100 characters'),
  requirements: z.string().optional(),
  benefits: z.string().optional(),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  salaryIsConfidential: z.boolean().default(false),
  applicationDeadline: z.string().optional(),
})

// ─── Badge ───────────────────────────────────────────────────────────────────

export const issueBadgeSchema = z.object({
  recipientEmail: z.string().email('Enter the candidate\'s registered email address'),
  roleHeld: z.string().min(2, 'Enter the role title'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  isCurrent: z.boolean().default(false),
  recommendation: z
    .string()
    .max(300, 'Recommendation cannot exceed 300 characters')
    .optional(),
  performanceRating: z.number().int().min(1).max(5).optional(),
})

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type LoginSchema = z.infer<typeof loginSchema>
export type RegisterSchema = z.infer<typeof registerSchema>
export type OTPSchema = z.infer<typeof otpSchema>
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>
export type CandidateBasicInfoSchema = z.infer<typeof candidateBasicInfoSchema>
export type NINSchema = z.infer<typeof ninSchema>
export type CandidatePreferencesSchema = z.infer<typeof candidatePreferencesSchema>
export type CompanyBasicInfoSchema = z.infer<typeof companyBasicInfoSchema>
export type CompanyProfileSchema = z.infer<typeof companyProfileSchema>
export type JobPostingSchema = z.infer<typeof jobPostingSchema>
export type IssueBadgeSchema = z.infer<typeof issueBadgeSchema>
