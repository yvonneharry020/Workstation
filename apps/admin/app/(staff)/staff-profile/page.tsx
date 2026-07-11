'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

type Step = 1 | 2 | 3 | 4 | 5

interface ProfileForm {
  full_name: string
  phone: string
  date_of_birth: string
  gender: string
  street_address: string
  city: string
  state: string
  country: string
  emergency_name: string
  emergency_relationship: string
  emergency_phone: string
  job_title: string
  department: string
  start_date: string
  bio: string
  national_id_type: string
  national_id_number: string
}

const STEPS = [
  { num: 1, label: 'Personal', desc: 'Your basic information' },
  { num: 2, label: 'Address', desc: 'Where you live' },
  { num: 3, label: 'Emergency', desc: 'Who to contact' },
  { num: 4, label: 'Professional', desc: 'Your role details' },
  { num: 5, label: 'Documents', desc: 'Upload required files' },
]

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  { value: 'other', label: 'Other' },
]

const ID_TYPE_OPTIONS = [
  { value: 'nin', label: 'National ID Number (NIN)' },
  { value: 'bvn', label: 'Bank Verification Number (BVN)' },
  { value: 'passport', label: 'International Passport' },
  { value: 'drivers_license', label: "Driver's Licence" },
  { value: 'voters_card', label: "Voter's Card" },
]

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
]

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-text-secondary mb-1.5 block">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-surface-elevated border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none transition-colors'
const selectCls = `${inputCls} cursor-pointer`

export default function StaffProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const cvInputRef = useRef<HTMLInputElement>(null)
  const certInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [cvUrl, setCvUrl] = useState<string | null>(null)
  const [certUrls, setCertUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState<'photo' | 'cv' | 'cert' | null>(null)
  const [form, setForm] = useState<ProfileForm>({
    full_name: '', phone: '', date_of_birth: '', gender: '',
    street_address: '', city: '', state: '', country: 'Nigeria',
    emergency_name: '', emergency_relationship: '', emergency_phone: '',
    job_title: '', department: '', start_date: '', bio: '',
    national_id_type: '', national_id_number: '',
  })

  const set = (key: keyof ProfileForm, val: string) =>
    setForm(f => ({ ...f, [key]: val }))

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUserId(user.id)

      const { data: existing } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (existing) {
        setProfileId(existing.id as string)
        setPhotoUrl(existing.profile_photo_url as string | null)
        setCvUrl(existing.cv_url as string | null)
        setCertUrls((existing.certificate_urls as string[] | null) ?? [])
        setForm({
          full_name: existing.full_name ?? '',
          phone: existing.phone ?? '',
          date_of_birth: existing.date_of_birth ?? '',
          gender: existing.gender ?? '',
          street_address: existing.street_address ?? '',
          city: existing.city ?? '',
          state: existing.state ?? '',
          country: existing.country ?? 'Nigeria',
          emergency_name: existing.emergency_name ?? '',
          emergency_relationship: existing.emergency_relationship ?? '',
          emergency_phone: existing.emergency_phone ?? '',
          job_title: existing.job_title ?? '',
          department: existing.department ?? '',
          start_date: existing.start_date ?? '',
          bio: existing.bio ?? '',
          national_id_type: existing.national_id_type ?? '',
          national_id_number: existing.national_id_number ?? '',
        })
      }
    }
    void init()
  }, [supabase, router])

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const { error } = await supabase.storage
      .from('staff-documents')
      .upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('staff-documents').getPublicUrl(path)
    return data.publicUrl
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading('photo')
    const url = await uploadFile(file, `${userId}/photo-${Date.now()}.${file.name.split('.').pop()}`)
    if (url) setPhotoUrl(url)
    setUploading(null)
  }

  async function handleCvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading('cv')
    const url = await uploadFile(file, `${userId}/cv-${Date.now()}.${file.name.split('.').pop()}`)
    if (url) setCvUrl(url)
    setUploading(null)
  }

  async function handleCertChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !userId) return
    setUploading('cert')
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      const url = await uploadFile(file, `${userId}/cert-${Date.now()}-${file.name}`)
      if (url) newUrls.push(url)
    }
    setCertUrls(prev => [...prev, ...newUrls])
    setUploading(null)
  }

  async function saveStep(isLast = false) {
    if (!userId) return
    setSaving(true)

    const payload = {
      user_id: userId,
      ...form,
      profile_photo_url: photoUrl,
      cv_url: cvUrl,
      certificate_urls: certUrls,
      ...(isLast && { profile_complete: true }),
      updated_at: new Date().toISOString(),
    }

    let error
    if (profileId) {
      const res = await supabase.from('staff_profiles').update(payload).eq('id', profileId)
      error = res.error
    } else {
      const res = await supabase.from('staff_profiles').insert(payload).select('id').single()
      error = res.error
      if (!error && res.data) setProfileId((res.data as { id: string }).id)
    }

    setSaving(false)
    if (!error) {
      if (isLast) router.push('/login?profile=complete')
      else setStep(s => (s + 1) as Step)
    }
  }

  const progress = ((step - 1) / 4) * 100

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar step tracker */}
      <aside className="w-72 flex-shrink-0 bg-surface-card border-r border-surface-border flex flex-col">
        <div className="px-6 py-6 border-b border-surface-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-admin-500 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Staff Onboarding</p>
              <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Step {step} of 5</p>
            </div>
          </div>
          <div className="w-full h-1 bg-surface-elevated rounded-full mt-3">
            <div className="h-1 bg-admin-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <nav className="flex-1 py-4 px-4 space-y-1">
          {STEPS.map(s => {
            const isDone = step > s.num
            const isActive = step === s.num
            return (
              <div key={s.num} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${isActive ? 'bg-admin-900/50 border border-admin-800/30' : 'opacity-60'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isDone ? 'bg-success text-white' : isActive ? 'bg-admin-500 text-white' : 'bg-surface-elevated text-text-muted'}`}>
                  {isDone ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : s.num}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isActive ? 'text-text-primary' : 'text-text-muted'}`}>{s.label}</p>
                  <p className="text-[10px] text-text-muted">{s.desc}</p>
                </div>
              </div>
            )
          })}
        </nav>

        <div className="px-6 py-4 border-t border-surface-border">
          <p className="text-xs text-text-muted">Fill in all required fields to complete your onboarding. Your profile is saved at each step.</p>
        </div>
      </aside>

      {/* Main form */}
      <div className="flex-1 flex flex-col">
        <div className="px-10 py-8 border-b border-surface-border">
          <h1 className="text-xl font-semibold font-display text-text-primary">{STEPS[step - 1].label} Information</h1>
          <p className="text-sm text-text-secondary mt-0.5">{STEPS[step - 1].desc}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-8">
          <div className="max-w-2xl space-y-5">

            {/* Step 1 — Personal */}
            {step === 1 && (
              <>
                <div className="flex items-center gap-6 mb-6">
                  <div
                    className="w-24 h-24 rounded-2xl bg-surface-elevated border-2 border-dashed border-surface-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-admin-500 transition-colors"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {photoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        {uploading === 'photo' ? (
                          <div className="w-5 h-5 border-2 border-admin-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        ) : (
                          <>
                            <svg className="w-7 h-7 text-text-muted mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                            </svg>
                            <p className="text-[10px] text-text-muted">Upload photo</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Profile Photo</p>
                    <p className="text-xs text-text-muted mt-0.5">JPG or PNG, max 5MB</p>
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Choose photo
                    </button>
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </div>

                <Field label="Full Name" required>
                  <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Your full legal name" className={inputCls} />
                </Field>
                <Field label="Phone Number" required>
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+234 800 000 0000" className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date of Birth">
                    <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Gender">
                    <select value={form.gender} onChange={e => set('gender', e.target.value)} className={selectCls}>
                      <option value="">Select gender</option>
                      {GENDER_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            )}

            {/* Step 2 — Address */}
            {step === 2 && (
              <>
                <Field label="Street Address" required>
                  <input type="text" value={form.street_address} onChange={e => set('street_address', e.target.value)} placeholder="House number, street name" className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="City" required>
                    <input type="text" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Lagos" className={inputCls} />
                  </Field>
                  <Field label="State" required>
                    <select value={form.state} onChange={e => set('state', e.target.value)} className={selectCls}>
                      <option value="">Select state</option>
                      {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Country">
                  <input type="text" value={form.country} onChange={e => set('country', e.target.value)} className={inputCls} />
                </Field>
              </>
            )}

            {/* Step 3 — Emergency Contact */}
            {step === 3 && (
              <>
                <div className="bg-surface-card border border-surface-border rounded-xl p-4 mb-2">
                  <p className="text-xs text-text-muted">This person will be contacted in case of an emergency. They must not be the same as you.</p>
                </div>
                <Field label="Full Name" required>
                  <input type="text" value={form.emergency_name} onChange={e => set('emergency_name', e.target.value)} placeholder="e.g. Chidi Okonkwo" className={inputCls} />
                </Field>
                <Field label="Relationship" required>
                  <input type="text" value={form.emergency_relationship} onChange={e => set('emergency_relationship', e.target.value)} placeholder="e.g. Spouse, Parent, Sibling" className={inputCls} />
                </Field>
                <Field label="Phone Number" required>
                  <input type="tel" value={form.emergency_phone} onChange={e => set('emergency_phone', e.target.value)} placeholder="+234 800 000 0000" className={inputCls} />
                </Field>
              </>
            )}

            {/* Step 4 — Professional */}
            {step === 4 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Job Title" required>
                    <input type="text" value={form.job_title} onChange={e => set('job_title', e.target.value)} placeholder="e.g. Support Specialist" className={inputCls} />
                  </Field>
                  <Field label="Department">
                    <input type="text" value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. Management" className={inputCls} />
                  </Field>
                </div>
                <Field label="Start Date">
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls} />
                </Field>
                <Field label="About You">
                  <textarea
                    value={form.bio}
                    onChange={e => set('bio', e.target.value)}
                    placeholder="A brief description of your professional background and what you bring to the team…"
                    rows={5}
                    className="w-full bg-surface-elevated border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none transition-colors"
                  />
                </Field>
              </>
            )}

            {/* Step 5 — Documents */}
            {step === 5 && (
              <>
                {/* CV Upload */}
                <div>
                  <p className="text-xs font-semibold text-text-secondary mb-2">Curriculum Vitae (CV) <span className="text-error">*</span></p>
                  <div
                    className="border-2 border-dashed border-surface-border rounded-xl p-6 text-center cursor-pointer hover:border-admin-500 transition-colors"
                    onClick={() => cvInputRef.current?.click()}
                  >
                    {uploading === 'cv' ? (
                      <div className="w-6 h-6 border-2 border-admin-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : cvUrl ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span className="text-sm text-success font-semibold">CV uploaded</span>
                        <button onClick={e => { e.stopPropagation(); cvInputRef.current?.click() }} className="text-xs text-admin-400 ml-2 underline">Replace</button>
                      </div>
                    ) : (
                      <>
                        <svg className="w-8 h-8 text-text-muted mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                        <p className="text-sm text-text-primary font-semibold mb-0.5">Upload your CV</p>
                        <p className="text-xs text-text-muted">PDF format, max 10MB</p>
                      </>
                    )}
                  </div>
                  <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleCvChange} />
                </div>

                {/* Certificates */}
                <div>
                  <p className="text-xs font-semibold text-text-secondary mb-2">Certificates & Qualifications</p>
                  <div
                    className="border-2 border-dashed border-surface-border rounded-xl p-6 text-center cursor-pointer hover:border-admin-500 transition-colors"
                    onClick={() => certInputRef.current?.click()}
                  >
                    {uploading === 'cert' ? (
                      <div className="w-6 h-6 border-2 border-admin-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      <>
                        <svg className="w-7 h-7 text-text-muted mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
                        </svg>
                        <p className="text-sm text-text-primary font-semibold mb-0.5">
                          {certUrls.length > 0 ? `${certUrls.length} certificate${certUrls.length > 1 ? 's' : ''} uploaded · Add more` : 'Upload certificates'}
                        </p>
                        <p className="text-xs text-text-muted">PDF or images, multiple allowed</p>
                      </>
                    )}
                  </div>
                  {certUrls.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {certUrls.map((url, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-text-secondary bg-surface-elevated rounded-lg px-3 py-2">
                          <svg className="w-3.5 h-3.5 text-success flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          <a href={url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-admin-400 transition-colors">Certificate {i + 1}</a>
                          <button onClick={() => setCertUrls(prev => prev.filter((_, j) => j !== i))} className="ml-auto text-text-muted hover:text-error transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <input ref={certInputRef} type="file" accept=".pdf,image/*" multiple className="hidden" onChange={handleCertChange} />
                </div>

                {/* National ID */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Government ID Type" required>
                    <select value={form.national_id_type} onChange={e => set('national_id_type', e.target.value)} className={selectCls}>
                      <option value="">Select ID type</option>
                      {ID_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="ID Number" required>
                    <input type="text" value={form.national_id_number} onChange={e => set('national_id_number', e.target.value)} placeholder="Enter number" className={inputCls} />
                  </Field>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Navigation footer */}
        <div className="px-10 py-5 border-t border-surface-border flex items-center justify-between bg-surface-card/50">
          <button
            onClick={() => setStep(s => (s - 1) as Step)}
            disabled={step === 1}
            className="px-5 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-sm font-semibold text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>

          <div className="flex items-center gap-1.5">
            {STEPS.map(s => (
              <div key={s.num} className={`w-2 h-2 rounded-full transition-all ${step === s.num ? 'bg-admin-500 w-4' : step > s.num ? 'bg-success' : 'bg-surface-elevated'}`} />
            ))}
          </div>

          <button
            onClick={() => saveStep(step === 5)}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-admin-500 hover:bg-admin-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
            ) : step === 5 ? (
              <>
                Complete Onboarding
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </>
            ) : (
              <>
                Save & Continue
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
