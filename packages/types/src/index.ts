export type UserRole = 'candidate' | 'company' | 'admin'

export type VerificationStatus =
  | 'not_started'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'requires_resubmission'

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'freelance'

export type WorkMode = 'remote' | 'hybrid' | 'on_site'
export type JobStatus = 'draft' | 'active' | 'paused' | 'closed' | 'expired'

export type ExperienceLevel =
  | 'entry'
  | 'junior'
  | 'mid'
  | 'senior'
  | 'lead'
  | 'executive'

export type PipelineStage =
  | 'new'
  | 'reviewed'
  | 'shortlisted'
  | 'interview_scheduled'
  | 'offer_made'
  | 'rejected'
  | 'withdrawn'

export type BadgeStatus = 'active' | 'revoked'
export type ScanStatus = 'pending' | 'processing' | 'passed' | 'flagged' | 'failed'

export type CompanySize = '1_10' | '11_50' | '51_200' | '201_500' | '500_plus'

export interface Profile {
  id: string
  role: UserRole
  email: string
  phone?: string
  isActive: boolean
  isSuspended: boolean
  createdAt: string
  updatedAt: string
}

export interface TrustScore {
  profileId: string
  score: number
  updatedAt: string
}

export interface CandidateProfile {
  id: string
  firstName: string
  lastName: string
  otherNames?: string
  headline?: string
  bio?: string
  avatarUrl?: string
  dateOfBirth?: string
  ninVerified: boolean
  livenessVerified: boolean
  phoneVerified: boolean
  experienceYears?: number
  experienceLevel?: ExperienceLevel
  desiredSalaryMin?: number
  desiredSalaryMax?: number
  preferredWorkMode?: WorkMode
  isOpenToWork: boolean
  profileCompletion: number
  githubUrl?: string
  linkedinUrl?: string
  portfolioUrl?: string
  createdAt: string
  updatedAt: string
}

export interface CompanyProfile {
  id: string
  companyName: string
  legalName?: string
  rcNumber?: string
  industry?: string
  companySize?: CompanySize
  foundedYear?: number
  websiteUrl?: string
  logoUrl?: string
  coverBannerUrl?: string
  about?: string
  cultureDescription?: string
  businessEmail: string
  cacVerified: boolean
  directorNinVerified: boolean
  isProfileComplete: boolean
  createdAt: string
  updatedAt: string
}

export interface JobPosting {
  id: string
  companyId: string
  title: string
  department?: string
  employmentType: EmploymentType
  workMode: WorkMode
  experienceLevel: ExperienceLevel
  description: string
  requirements?: string
  benefits?: string
  salaryMin?: number
  salaryMax?: number
  salaryIsConfidential: boolean
  applicationDeadline?: string
  status: JobStatus
  viewsCount: number
  applicationsCount: number
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface JobApplication {
  id: string
  jobId: string
  candidateId: string
  cvVersionId?: string
  coverNote?: string
  status: string
  pipelineStage: PipelineStage
  emailSentAt?: string
  emailOpenedAt?: string
  internalNotes?: string
  skillsMatchPct?: number
  submittedAt: string
  updatedAt: string
}

export interface Badge {
  id: string
  issuerId: string
  recipientId: string
  issuedBy: string
  roleHeld: string
  startDate: string
  endDate?: string
  isCurrent: boolean
  recommendation?: string
  performanceRating?: number
  status: BadgeStatus
  revokedAt?: string
  revocationReason?: string
  issuedAt: string
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body?: string
  data?: Record<string, unknown>
  isRead: boolean
  readAt?: string
  actionUrl?: string
  createdAt: string
}

export interface NigerianState {
  id: number
  name: string
  code: string
}

export interface Skill {
  id: string
  name: string
  category?: string
}

export interface ProfileView {
  id: string
  viewerId: string
  viewedId: string
  viewedAt: string
}
