import {
  View, Text, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Switch,
} from 'react-native'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const MAX_SKILLS = 20
const MAX_TOOLS = 20
const MAX_PORTFOLIO = 10

interface CandidateProfile {
  first_name: string
  last_name: string
  headline: string | null
  bio: string | null
  avatar_url: string | null
  github_url: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  is_open_to_work: boolean
  tools: string[] | null
}

interface SkillRow { id: string; skills: { name: string } | null }
interface WorkRow { id: string; role_title: string; company_name: string; start_date: string; end_date: string | null; is_current: boolean; description: string | null }
interface EduRow { id: string; institution: string; degree: string; field_of_study: string | null; start_year: number | null; end_year: number | null }
interface PortfolioRow { id: string; title: string; project_url: string | null; thumbnail_url: string | null }

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 16, padding: 16, marginBottom: 16 }}>
      {children}
    </View>
  )
}

function SectionTitle({ text }: { text: string }) {
  return <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700', marginBottom: 14 }}>{text}</Text>
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>{text}</Text>
}

function StyledInput({ value, onChangeText, placeholder, multiline, maxLength, keyboardType, autoCapitalize }: {
  value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean
  maxLength?: number; keyboardType?: 'default' | 'url' | 'email-address' | 'phone-pad'
  autoCapitalize?: 'none' | 'words' | 'sentences'
}) {
  return (
    <TextInput
      value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#475569"
      multiline={multiline} maxLength={maxLength} keyboardType={keyboardType ?? 'default'}
      autoCapitalize={autoCapitalize ?? 'sentences'} textAlignVertical={multiline ? 'top' : 'center'}
      style={{ backgroundColor: '#F5F0E8', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#1A1625', fontSize: 14, minHeight: multiline ? 88 : undefined }}
    />
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F0E8', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 }}>
      <Text style={{ color: '#1A1625', fontSize: 13 }}>{label}</Text>
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '700', lineHeight: 16 }}>×</Text>
      </Pressable>
    </View>
  )
}

function AddRow({ value, onChange, onAdd, placeholder, disabled }: {
  value: string; onChange: (t: string) => void; onAdd: () => void; placeholder: string; disabled?: boolean
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#475569"
        autoCapitalize="words"
        style={{ flex: 1, backgroundColor: '#F5F0E8', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#1A1625', fontSize: 13 }}
        onSubmitEditing={onAdd} returnKeyType="done"
      />
      <Pressable onPress={onAdd} disabled={disabled} style={{ backgroundColor: disabled ? '#DDD6C9' : '#FF6240', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' }} className="active:opacity-80">
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Add</Text>
      </Pressable>
    </View>
  )
}

export default function EditProfileScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [isOpenToWork, setIsOpenToWork] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [tools, setTools] = useState<string[]>([])
  const [toolInput, setToolInput] = useState('')

  const [skillInput, setSkillInput] = useState('')
  const [isAddingSkill, setIsAddingSkill] = useState(false)

  const [showAddWork, setShowAddWork] = useState(false)
  const [workForm, setWorkForm] = useState({ role_title: '', company_name: '', start_date: '', end_date: '', is_current: false, description: '' })

  const [showAddEdu, setShowAddEdu] = useState(false)
  const [eduForm, setEduForm] = useState({ institution: '', degree: '', field_of_study: '', start_year: '', end_year: '' })

  const [isUploadingPortfolio, setIsUploadingPortfolio] = useState(false)

  const { data: profile } = useQuery<CandidateProfile>({
    queryKey: ['candidate-profile-edit', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select('first_name,last_name,headline,bio,avatar_url,github_url,linkedin_url,portfolio_url,is_open_to_work,tools')
        .eq('id', user!.id).maybeSingle()
      if (error) throw new Error(error.message)
      return (data ?? {}) as CandidateProfile
    },
    enabled: !!user?.id,
  })

  const { data: skillRows = [], refetch: refetchSkills } = useQuery<SkillRow[]>({
    queryKey: ['edit-skills', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('candidate_skills').select('id,skills(name)').eq('candidate_id', user!.id)
      return (data ?? []) as unknown as SkillRow[]
    },
    enabled: !!user?.id,
  })

  const { data: workRows = [], refetch: refetchWork } = useQuery<WorkRow[]>({
    queryKey: ['edit-work', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('candidate_work_history').select('*').eq('candidate_id', user!.id).order('start_date', { ascending: false })
      return (data ?? []) as WorkRow[]
    },
    enabled: !!user?.id,
  })

  const { data: eduRows = [], refetch: refetchEdu } = useQuery<EduRow[]>({
    queryKey: ['edit-edu', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('candidate_education').select('*').eq('candidate_id', user!.id)
      return (data ?? []) as EduRow[]
    },
    enabled: !!user?.id,
  })

  const { data: portfolioRows = [], refetch: refetchPortfolio } = useQuery<PortfolioRow[]>({
    queryKey: ['edit-portfolio', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('portfolio_items').select('id,title,project_url,thumbnail_url').eq('candidate_id', user!.id).order('sort_order')
      return (data ?? []) as PortfolioRow[]
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (!profile) return
    setFirstName(profile.first_name ?? '')
    setLastName(profile.last_name ?? '')
    setHeadline(profile.headline ?? '')
    setBio(profile.bio ?? '')
    setGithubUrl(profile.github_url ?? '')
    setLinkedinUrl(profile.linkedin_url ?? '')
    setPortfolioUrl(profile.portfolio_url ?? '')
    setIsOpenToWork(profile.is_open_to_work ?? true)
    setAvatarUrl(profile.avatar_url ?? null)
    setTools(profile.tools ?? [])
  }, [profile])

  const pickAndUploadPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 })
    if (result.canceled || !result.assets[0]) return
    setIsUploading(true)
    try {
      const uri = result.assets[0].uri
      const ext = uri.split('.').pop() ?? 'jpg'
      const path = `${user!.id}/avatar.${ext}`
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: `image/${ext}` })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(urlData.publicUrl)
    } catch {
      Alert.alert('Error', 'Could not upload photo. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) { Alert.alert('Required', 'First and last name are required.'); return }
    setIsSaving(true)
    try {
      const { error } = await supabase.from('candidate_profiles').update({
        first_name: firstName.trim(), last_name: lastName.trim(),
        headline: headline.trim() || null, bio: bio.trim() || null,
        github_url: githubUrl.trim() || null, linkedin_url: linkedinUrl.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
        is_open_to_work: isOpenToWork, avatar_url: avatarUrl,
        tools: tools.length ? tools : [],
      }).eq('id', user!.id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] })
      router.back()
    } catch {
      Alert.alert('Error', 'Could not save profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const addTool = () => {
    const t = toolInput.trim()
    if (!t || tools.includes(t) || tools.length >= MAX_TOOLS) return
    setTools((prev) => [...prev, t])
    setToolInput('')
  }

  const addSkill = async () => {
    const name = skillInput.trim()
    if (!name || skillRows.length >= MAX_SKILLS) return
    if (skillRows.some((s) => s.skills?.name?.toLowerCase() === name.toLowerCase())) { setSkillInput(''); return }
    setIsAddingSkill(true)
    try {
      let skillId: string
      const { data: existing } = await supabase.from('skills').select('id').ilike('name', name).maybeSingle()
      if (existing) {
        skillId = (existing as { id: string }).id
      } else {
        const { data: inserted, error } = await supabase.from('skills').insert({ name }).select('id').single()
        if (error) throw error
        skillId = (inserted as { id: string }).id
      }
      const { error } = await supabase.from('candidate_skills').insert({ candidate_id: user!.id, skill_id: skillId })
      if (error) throw error
      setSkillInput('')
      refetchSkills()
    } catch {
      Alert.alert('Error', 'Could not add skill.')
    } finally {
      setIsAddingSkill(false)
    }
  }

  const removeSkill = async (rowId: string) => {
    await supabase.from('candidate_skills').delete().eq('id', rowId)
    refetchSkills()
  }

  const addWork = async () => {
    const { role_title, company_name, start_date, is_current, end_date, description } = workForm
    if (!role_title.trim() || !company_name.trim() || !start_date.trim()) { Alert.alert('Required', 'Role, company, and start date are required.'); return }
    const { error } = await supabase.from('candidate_work_history').insert({
      candidate_id: user!.id, role_title: role_title.trim(), company_name: company_name.trim(),
      start_date, end_date: is_current ? null : (end_date || null), is_current, description: description.trim() || null,
    })
    if (error) { Alert.alert('Error', error.message); return }
    setWorkForm({ role_title: '', company_name: '', start_date: '', end_date: '', is_current: false, description: '' })
    setShowAddWork(false)
    refetchWork()
  }

  const removeWork = async (id: string) => {
    await supabase.from('candidate_work_history').delete().eq('id', id)
    refetchWork()
  }

  const addEdu = async () => {
    const { institution, degree, field_of_study, start_year, end_year } = eduForm
    if (!institution.trim() || !degree.trim()) { Alert.alert('Required', 'Institution and degree are required.'); return }
    const { error } = await supabase.from('candidate_education').insert({
      candidate_id: user!.id, institution: institution.trim(), degree: degree.trim(),
      field_of_study: field_of_study.trim() || null,
      start_year: start_year ? parseInt(start_year) : null,
      end_year: end_year ? parseInt(end_year) : null,
    })
    if (error) { Alert.alert('Error', error.message); return }
    setEduForm({ institution: '', degree: '', field_of_study: '', start_year: '', end_year: '' })
    setShowAddEdu(false)
    refetchEdu()
  }

  const removeEdu = async (id: string) => {
    await supabase.from('candidate_education').delete().eq('id', id)
    refetchEdu()
  }

  const pickPortfolioImage = async () => {
    if (portfolioRows.length >= MAX_PORTFOLIO) { Alert.alert('Limit reached', `Maximum ${MAX_PORTFOLIO} portfolio items.`); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 })
    if (result.canceled || !result.assets[0]) return
    setIsUploadingPortfolio(true)
    try {
      const uri = result.assets[0].uri
      const ext = uri.split('.').pop() ?? 'jpg'
      const path = `${user!.id}/portfolio_${Date.now()}.${ext}`
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: false, contentType: `image/${ext}` })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error } = await supabase.from('portfolio_items').insert({ candidate_id: user!.id, title: `Portfolio item`, thumbnail_url: urlData.publicUrl, item_type: 'image', sort_order: portfolioRows.length })
      if (error) throw error
      refetchPortfolio()
    } catch {
      Alert.alert('Error', 'Could not upload image. Please try again.')
    } finally {
      setIsUploadingPortfolio(false)
    }
  }

  const removePortfolioItem = async (id: string) => {
    await supabase.from('portfolio_items').delete().eq('id', id)
    refetchPortfolio()
  }

  const initials = `${firstName[0] ?? 'U'}${lastName[0] ?? ''}`.toUpperCase()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: '#5A4F6E', fontSize: 14 }}>← Back</Text>
          </Pressable>
          <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700' }}>Edit Profile</Text>
          <Pressable onPress={handleSave} disabled={isSaving} hitSlop={12}>
            <Text style={{ color: isSaving ? '#64748B' : '#FF6240', fontSize: 14, fontWeight: '600' }}>{isSaving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60, paddingTop: 20 }} keyboardShouldPersistTaps="handled">

          {/* ── Photo ── */}
          <SectionCard>
            <View style={{ alignItems: 'center' }}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 12 }} contentFit="cover" />
              ) : (
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Text style={{ color: '#FF6240', fontSize: 26, fontWeight: '800' }}>{initials}</Text>
                </View>
              )}
              <Pressable onPress={pickAndUploadPhoto} disabled={isUploading} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FF6240', opacity: isUploading ? 0.5 : 1 }}>
                <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>{isUploading ? 'Uploading…' : 'Change photo'}</Text>
              </Pressable>
            </View>
          </SectionCard>

          {/* ── Basic Info ── */}
          <SectionCard>
            <SectionTitle text="Basic Info" />
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}><FieldLabel text="First name" /><StyledInput value={firstName} onChangeText={setFirstName} placeholder="First name" autoCapitalize="words" /></View>
              <View style={{ flex: 1 }}><FieldLabel text="Last name" /><StyledInput value={lastName} onChangeText={setLastName} placeholder="Last name" autoCapitalize="words" /></View>
            </View>
            <FieldLabel text="Professional headline" />
            <StyledInput value={headline} onChangeText={setHeadline} placeholder="e.g. Senior Software Engineer at Flutterwave" autoCapitalize="words" />
          </SectionCard>

          {/* ── Professional Summary ── */}
          <SectionCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700' }}>Professional Summary</Text>
              <Text style={{ color: '#64748B', fontSize: 12 }}>{bio.length}/500</Text>
            </View>
            <StyledInput value={bio} onChangeText={(t) => { if (t.length <= 500) setBio(t) }} placeholder="Tell employers about your background, skills, and what you're looking for…" multiline />
          </SectionCard>

          {/* ── Skills ── */}
          <SectionCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <SectionTitle text="Skills" />
              <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 14 }}>{skillRows.length}/{MAX_SKILLS}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {skillRows.map((s) => (
                <Chip key={s.id} label={s.skills?.name ?? ''} onRemove={() => removeSkill(s.id)} />
              ))}
            </View>
            {skillRows.length < MAX_SKILLS && (
              <AddRow value={skillInput} onChange={setSkillInput} onAdd={addSkill} placeholder="Add a skill…" disabled={isAddingSkill || !skillInput.trim()} />
            )}
          </SectionCard>

          {/* ── Tools ── */}
          <SectionCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <SectionTitle text="Tools" />
              <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 14 }}>{tools.length}/{MAX_TOOLS}</Text>
            </View>
            <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 10 }}>Software, frameworks, or platforms you work with (e.g. Figma, Docker, PostgreSQL)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tools.map((t) => (
                <Chip key={t} label={t} onRemove={() => setTools((prev) => prev.filter((x) => x !== t))} />
              ))}
            </View>
            {tools.length < MAX_TOOLS && (
              <AddRow value={toolInput} onChange={setToolInput} onAdd={addTool} placeholder="Add a tool…" disabled={!toolInput.trim()} />
            )}
          </SectionCard>

          {/* ── Work Experience ── */}
          <SectionCard>
            <SectionTitle text="Work Experience" />
            {workRows.map((w) => (
              <View key={w.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '700' }}>{w.role_title}</Text>
                  <Text style={{ color: '#5A4F6E', fontSize: 12, marginTop: 2 }}>{w.company_name}</Text>
                  <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>{w.start_date}{w.is_current ? ' – Present' : w.end_date ? ` – ${w.end_date}` : ''}</Text>
                </View>
                <Pressable onPress={() => removeWork(w.id)} hitSlop={10}>
                  <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Remove</Text>
                </Pressable>
              </View>
            ))}
            {showAddWork ? (
              <View style={{ borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 12, padding: 12, gap: 10 }}>
                <FieldLabel text="Role / Job title *" />
                <StyledInput value={workForm.role_title} onChangeText={(v) => setWorkForm((f) => ({ ...f, role_title: v }))} placeholder="e.g. Software Engineer" autoCapitalize="words" />
                <FieldLabel text="Company name *" />
                <StyledInput value={workForm.company_name} onChangeText={(v) => setWorkForm((f) => ({ ...f, company_name: v }))} placeholder="e.g. Paystack" autoCapitalize="words" />
                <FieldLabel text="Start date * (YYYY-MM-DD)" />
                <StyledInput value={workForm.start_date} onChangeText={(v) => setWorkForm((f) => ({ ...f, start_date: v }))} placeholder="2023-01-15" autoCapitalize="none" />
                <Pressable onPress={() => setWorkForm((f) => ({ ...f, is_current: !f.is_current }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Switch value={workForm.is_current} onValueChange={(v) => setWorkForm((f) => ({ ...f, is_current: v }))} trackColor={{ false: '#DDD6C9', true: '#FF6240' }} thumbColor="#fff" />
                  <Text style={{ color: '#1A1625', fontSize: 13 }}>Currently working here</Text>
                </Pressable>
                {!workForm.is_current && (
                  <>
                    <FieldLabel text="End date (YYYY-MM-DD)" />
                    <StyledInput value={workForm.end_date} onChangeText={(v) => setWorkForm((f) => ({ ...f, end_date: v }))} placeholder="2024-06-01" autoCapitalize="none" />
                  </>
                )}
                <FieldLabel text="Description" />
                <StyledInput value={workForm.description} onChangeText={(v) => setWorkForm((f) => ({ ...f, description: v }))} placeholder="What did you work on?" multiline />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => setShowAddWork(false)} style={{ flex: 1, backgroundColor: '#DDD6C9', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={addWork} style={{ flex: 1, backgroundColor: '#FF6240', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Add</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setShowAddWork(true)} style={{ borderWidth: 1, borderColor: '#FF624040', borderRadius: 12, borderStyle: 'dashed', paddingVertical: 12, alignItems: 'center' }} className="active:opacity-70">
                <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>+ Add work experience</Text>
              </Pressable>
            )}
          </SectionCard>

          {/* ── Education ── */}
          <SectionCard>
            <SectionTitle text="Education" />
            {eduRows.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '700' }}>{e.degree}</Text>
                  <Text style={{ color: '#5A4F6E', fontSize: 12, marginTop: 2 }}>{e.institution}</Text>
                  {e.field_of_study && <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>{e.field_of_study}</Text>}
                  {(e.start_year || e.end_year) && <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>{e.start_year} – {e.end_year ?? 'Present'}</Text>}
                </View>
                <Pressable onPress={() => removeEdu(e.id)} hitSlop={10}>
                  <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Remove</Text>
                </Pressable>
              </View>
            ))}
            {showAddEdu ? (
              <View style={{ borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 12, padding: 12, gap: 10 }}>
                <FieldLabel text="Institution *" />
                <StyledInput value={eduForm.institution} onChangeText={(v) => setEduForm((f) => ({ ...f, institution: v }))} placeholder="e.g. University of Lagos" autoCapitalize="words" />
                <FieldLabel text="Degree *" />
                <StyledInput value={eduForm.degree} onChangeText={(v) => setEduForm((f) => ({ ...f, degree: v }))} placeholder="e.g. B.Sc Computer Science" autoCapitalize="words" />
                <FieldLabel text="Field of study" />
                <StyledInput value={eduForm.field_of_study} onChangeText={(v) => setEduForm((f) => ({ ...f, field_of_study: v }))} placeholder="e.g. Software Engineering" autoCapitalize="words" />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <FieldLabel text="Start year" />
                    <StyledInput value={eduForm.start_year} onChangeText={(v) => setEduForm((f) => ({ ...f, start_year: v }))} placeholder="2018" keyboardType="phone-pad" autoCapitalize="none" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldLabel text="End year" />
                    <StyledInput value={eduForm.end_year} onChangeText={(v) => setEduForm((f) => ({ ...f, end_year: v }))} placeholder="2022" keyboardType="phone-pad" autoCapitalize="none" />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => setShowAddEdu(false)} style={{ flex: 1, backgroundColor: '#DDD6C9', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={addEdu} style={{ flex: 1, backgroundColor: '#FF6240', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Add</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setShowAddEdu(true)} style={{ borderWidth: 1, borderColor: '#FF624040', borderRadius: 12, borderStyle: 'dashed', paddingVertical: 12, alignItems: 'center' }} className="active:opacity-70">
                <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>+ Add education</Text>
              </Pressable>
            )}
          </SectionCard>

          {/* ── Portfolio Images ── */}
          <SectionCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <SectionTitle text="Portfolio" />
              <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 14 }}>{portfolioRows.length}/{MAX_PORTFOLIO}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {portfolioRows.map((p) => (
                <View key={p.id} style={{ width: 90, position: 'relative' }}>
                  <View style={{ width: 90, height: 90, borderRadius: 10, backgroundColor: '#DDD6C9', overflow: 'hidden' }}>
                    {p.thumbnail_url ? (
                      <Image source={{ uri: p.thumbnail_url }} style={{ width: 90, height: 90 }} contentFit="cover" />
                    ) : (
                      <View style={{ width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 28 }}>🖼️</Text>
                      </View>
                    )}
                  </View>
                  <Pressable onPress={() => removePortfolioItem(p.id)} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#DC262690', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 14 }}>×</Text>
                  </Pressable>
                </View>
              ))}
              {portfolioRows.length < MAX_PORTFOLIO && (
                <Pressable onPress={pickPortfolioImage} disabled={isUploadingPortfolio} style={{ width: 90, height: 90, borderRadius: 10, borderWidth: 1, borderColor: '#FF624040', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', opacity: isUploadingPortfolio ? 0.5 : 1 }} className="active:opacity-70">
                  {isUploadingPortfolio ? <ActivityIndicator color="#FF6240" size="small" /> : <Text style={{ color: '#FF6240', fontSize: 28 }}>+</Text>}
                </Pressable>
              )}
            </View>
          </SectionCard>

          {/* ── Social Links ── */}
          <SectionCard>
            <SectionTitle text="Social Links" />
            <FieldLabel text="GitHub URL" />
            <View style={{ marginBottom: 12 }}>
              <StyledInput value={githubUrl} onChangeText={setGithubUrl} placeholder="https://github.com/username" keyboardType="url" autoCapitalize="none" />
            </View>
            <FieldLabel text="LinkedIn URL" />
            <View style={{ marginBottom: 12 }}>
              <StyledInput value={linkedinUrl} onChangeText={setLinkedinUrl} placeholder="https://linkedin.com/in/username" keyboardType="url" autoCapitalize="none" />
            </View>
            <FieldLabel text="Portfolio URL" />
            <StyledInput value={portfolioUrl} onChangeText={setPortfolioUrl} placeholder="https://yourportfolio.com" keyboardType="url" autoCapitalize="none" />
          </SectionCard>

          {/* ── Preferences ── */}
          <SectionCard>
            <SectionTitle text="Preferences" />
            <Pressable onPress={() => setIsOpenToWork((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ color: '#1A1625', fontSize: 14 }}>Open to work</Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>Lets companies know you're actively looking</Text>
              </View>
              <Switch value={isOpenToWork} onValueChange={setIsOpenToWork} trackColor={{ false: '#DDD6C9', true: '#FF6240' }} thumbColor="#fff" />
            </Pressable>
          </SectionCard>

          <Pressable onPress={handleSave} disabled={isSaving} style={{ backgroundColor: '#FF6240', borderRadius: 16, paddingVertical: 16, alignItems: 'center', opacity: isSaving ? 0.6 : 1 }}>
            <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700' }}>{isSaving ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
