'use server'

import { createAdminClient } from './supabase/admin'
import { createClient } from './supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EducationEntry {
  id: string
  institution: string
  degree: string
  field_of_study: string
  start_year: number
  end_year: number | null
  grade: string
  locked: boolean
}

export interface WorkEntry {
  id: string
  company: string
  position: string
  start_date: string
  end_date: string | null
  is_current: boolean
  locked: boolean
}

export interface StaffProfile {
  id: string
  staff_member_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  nationality: string | null
  street_address: string | null
  city: string | null
  state: string | null
  country: string | null
  emergency_name: string | null
  emergency_relationship: string | null
  emergency_phone: string | null
  linkedin_url: string | null
  bio: string | null
  national_id_type: string | null
  national_id_number: string | null
  education: EducationEntry[]
  work_history: WorkEntry[]
  cv_url: string | null
  cv_filename: string | null
  cv_size_bytes: number | null
  cv_uploaded_at: string | null
  locked_fields: Record<string, boolean>
}

type ActionResult = { success?: boolean; error?: string }
type ProfileResult = { profile?: StaffProfile; error?: string }

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthenticatedStaffId(): Promise<{ staffMemberId: string; email: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('staff_members')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()

  if (!data) return null
  return { staffMemberId: data.id, email: user.email }
}

// ─── Get or create profile ────────────────────────────────────────────────────

export async function getOrCreateProfileAction(): Promise<ProfileResult> {
  const auth = await getAuthenticatedStaffId()
  if (!auth) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('staff_profiles')
    .select('*')
    .eq('staff_member_id', auth.staffMemberId)
    .maybeSingle()

  if (existing) {
    return { profile: existing as unknown as StaffProfile }
  }

  const { data: created, error } = await admin
    .from('staff_profiles')
    .insert({
      staff_member_id: auth.staffMemberId,
      user_id: auth.staffMemberId,
      email: auth.email,
      locked_fields: {},
      education: [],
      work_history: [],
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { profile: created as unknown as StaffProfile }
}

// ─── Save personal fields ─────────────────────────────────────────────────────

export async function savePersonalFieldsAction(
  staffMemberId: string,
  fields: Record<string, string | null>,
): Promise<ActionResult & { lockedFields?: Record<string, boolean> }> {
  const auth = await getAuthenticatedStaffId()
  if (!auth || auth.staffMemberId !== staffMemberId) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('staff_profiles')
    .select('locked_fields')
    .eq('staff_member_id', staffMemberId)
    .maybeSingle()

  const currentLocked = (profile?.locked_fields ?? {}) as Record<string, boolean>
  const newLocked = { ...currentLocked }
  const update: Record<string, string | null> = {}

  for (const [key, value] of Object.entries(fields)) {
    if (currentLocked[key]) continue
    if (value === null || value === '') continue
    update[key] = value
    newLocked[key] = true
  }

  if (Object.keys(update).length === 0) return { error: 'No new fields to save.' }

  const { error } = await admin
    .from('staff_profiles')
    .update({ ...update, locked_fields: newLocked, updated_at: new Date().toISOString() })
    .eq('staff_member_id', staffMemberId)

  if (error) return { error: error.message }
  return { success: true, lockedFields: newLocked }
}

// ─── Add education entry ──────────────────────────────────────────────────────

export async function addEducationEntryAction(
  staffMemberId: string,
  entry: Omit<EducationEntry, 'id' | 'locked'>,
): Promise<ActionResult & { entry?: EducationEntry }> {
  const auth = await getAuthenticatedStaffId()
  if (!auth || auth.staffMemberId !== staffMemberId) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('staff_profiles')
    .select('education')
    .eq('staff_member_id', staffMemberId)
    .maybeSingle()

  const current = ((profile?.education ?? []) as EducationEntry[])
  const newEntry: EducationEntry = {
    ...entry,
    id: crypto.randomUUID(),
    locked: true,
  }

  const { error } = await admin
    .from('staff_profiles')
    .update({
      education: [...current, newEntry],
      updated_at: new Date().toISOString(),
    })
    .eq('staff_member_id', staffMemberId)

  if (error) return { error: error.message }
  return { success: true, entry: newEntry }
}

// ─── Add work history entry ───────────────────────────────────────────────────

export async function addWorkEntryAction(
  staffMemberId: string,
  entry: Omit<WorkEntry, 'id' | 'locked'>,
): Promise<ActionResult & { entry?: WorkEntry }> {
  const auth = await getAuthenticatedStaffId()
  if (!auth || auth.staffMemberId !== staffMemberId) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('staff_profiles')
    .select('work_history')
    .eq('staff_member_id', staffMemberId)
    .maybeSingle()

  const current = ((profile?.work_history ?? []) as WorkEntry[])
  const newEntry: WorkEntry = {
    ...entry,
    id: crypto.randomUUID(),
    locked: true,
  }

  const { error } = await admin
    .from('staff_profiles')
    .update({
      work_history: [...current, newEntry],
      updated_at: new Date().toISOString(),
    })
    .eq('staff_member_id', staffMemberId)

  if (error) return { error: error.message }
  return { success: true, entry: newEntry }
}

// ─── Save CV ──────────────────────────────────────────────────────────────────

export async function saveCvAction(
  staffMemberId: string,
  cvUrl: string,
  cvFilename: string,
  cvSizeBytes: number,
): Promise<ActionResult> {
  const auth = await getAuthenticatedStaffId()
  if (!auth || auth.staffMemberId !== staffMemberId) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('staff_profiles')
    .select('locked_fields')
    .eq('staff_member_id', staffMemberId)
    .maybeSingle()

  const locked = (profile?.locked_fields ?? {}) as Record<string, boolean>
  if (locked.cv) return { error: 'CV is already locked and cannot be replaced.' }

  const { error } = await admin
    .from('staff_profiles')
    .update({
      cv_url: cvUrl,
      cv_filename: cvFilename,
      cv_size_bytes: cvSizeBytes,
      cv_uploaded_at: new Date().toISOString(),
      locked_fields: { ...locked, cv: true },
      updated_at: new Date().toISOString(),
    })
    .eq('staff_member_id', staffMemberId)

  if (error) return { error: error.message }
  return { success: true }
}
