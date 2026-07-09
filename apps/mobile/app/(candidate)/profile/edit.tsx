import {
  View, Text, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Switch, Modal, Dimensions, FlatList,
} from 'react-native'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const MAX_SKILLS = 20
const MAX_TOOLS = 20
const MAX_GALLERY = 10

const NIGERIAN_STATES = [
  { id: 1, name: 'Abia' }, { id: 2, name: 'Adamawa' }, { id: 3, name: 'Akwa Ibom' },
  { id: 4, name: 'Anambra' }, { id: 5, name: 'Bauchi' }, { id: 6, name: 'Bayelsa' },
  { id: 7, name: 'Benue' }, { id: 8, name: 'Borno' }, { id: 9, name: 'Cross River' },
  { id: 10, name: 'Delta' }, { id: 11, name: 'Ebonyi' }, { id: 12, name: 'Edo' },
  { id: 13, name: 'Ekiti' }, { id: 14, name: 'Enugu' }, { id: 15, name: 'Federal Capital Territory' },
  { id: 16, name: 'Gombe' }, { id: 17, name: 'Imo' }, { id: 18, name: 'Jigawa' },
  { id: 19, name: 'Kaduna' }, { id: 20, name: 'Kano' }, { id: 21, name: 'Katsina' },
  { id: 22, name: 'Kebbi' }, { id: 23, name: 'Kogi' }, { id: 24, name: 'Kwara' },
  { id: 25, name: 'Lagos' }, { id: 26, name: 'Nasarawa' }, { id: 27, name: 'Niger' },
  { id: 28, name: 'Ogun' }, { id: 29, name: 'Ondo' }, { id: 30, name: 'Osun' },
  { id: 31, name: 'Oyo' }, { id: 32, name: 'Plateau' }, { id: 33, name: 'Rivers' },
  { id: 34, name: 'Sokoto' }, { id: 35, name: 'Taraba' }, { id: 36, name: 'Yobe' },
  { id: 37, name: 'Zamfara' },
]

interface GalleryImage { id: string; image_url: string; sort_order: number }
interface CandidateProfile {
  first_name: string; last_name: string; headline: string | null; bio: string | null
  avatar_url: string | null; github_url: string | null; linkedin_url: string | null
  portfolio_url: string | null; is_open_to_work: boolean; tools: string[] | null
  date_of_birth: string | null; state_of_origin_id: number | null
}
interface SkillRow { id: string; skills: { name: string } | null }
interface WorkRow { id: string; role_title: string; company_name: string; start_date: string; end_date: string | null; is_current: boolean; description: string | null }
interface EduRow { id: string; institution: string; degree: string; field_of_study: string | null; start_year: number | null; end_year: number | null }

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
function StyledInput({ value, onChangeText, placeholder, multiline, maxLength, keyboardType, autoCapitalize, editable }: {
  value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean
  maxLength?: number; keyboardType?: 'default' | 'url' | 'email-address' | 'phone-pad'
  autoCapitalize?: 'none' | 'words' | 'sentences'; editable?: boolean
}) {
  return (
    <TextInput
      value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor="#475569" multiline={multiline} maxLength={maxLength}
      keyboardType={keyboardType ?? 'default'} autoCapitalize={autoCapitalize ?? 'sentences'}
      textAlignVertical={multiline ? 'top' : 'center'} editable={editable !== false}
      style={{
        backgroundColor: editable === false ? '#E8E3D8' : '#F5F0E8',
        borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12, color: editable === false ? '#64748B' : '#1A1625',
        fontSize: 14, minHeight: multiline ? 88 : undefined,
      }}
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
      <Pressable onPress={onAdd} disabled={disabled} style={{ backgroundColor: disabled ? '#DDD6C9' : '#FF6240', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Add</Text>
      </Pressable>
    </View>
  )
}

async function uploadImageToStorage(uri: string, bucket: string, path: string, contentType: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const formData = new FormData()
  const filename = path.split('/').pop() ?? 'upload'
  formData.append('file', { uri, name: filename, type: contentType } as unknown as Blob)

  const res = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'x-upsert': 'true' },
      body: formData,
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Upload failed (${res.status}): ${body}`)
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export default function EditProfileScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [locationId, setLocationId] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
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

  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [isUploadingGallery, setIsUploadingGallery] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [showStatePicker, setShowStatePicker] = useState(false)

  // ── Queries — use the SAME keys as profile.tsx so invalidation works ──

  const { data: profile } = useQuery<CandidateProfile>({
    queryKey: ['candidate-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select('first_name,last_name,headline,bio,avatar_url,github_url,linkedin_url,portfolio_url,is_open_to_work,tools,date_of_birth,state_of_origin_id')
        .eq('id', user!.id).maybeSingle()
      if (error) throw new Error(error.message)
      return (data ?? {}) as CandidateProfile
    },
    enabled: !!user?.id,
  })

  const { data: profileRow } = useQuery<{ email: string | null; phone: string | null }>({
    queryKey: ['profile-contact', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('email,phone').eq('id', user!.id).maybeSingle()
      return (data ?? {}) as { email: string | null; phone: string | null }
    },
    enabled: !!user?.id,
  })

  const { data: skillRows = [], refetch: refetchSkills } = useQuery<SkillRow[]>({
    queryKey: ['candidate-skills', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('candidate_skills').select('id,skills(name)').eq('candidate_id', user!.id)
      return (data ?? []) as unknown as SkillRow[]
    },
    enabled: !!user?.id,
  })

  const { data: workRows = [], refetch: refetchWork } = useQuery<WorkRow[]>({
    queryKey: ['candidate-work', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('candidate_work_history').select('*').eq('candidate_id', user!.id).order('start_date', { ascending: false })
      return (data ?? []) as WorkRow[]
    },
    enabled: !!user?.id,
  })

  const { data: eduRows = [], refetch: refetchEdu } = useQuery<EduRow[]>({
    queryKey: ['candidate-education', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('candidate_education').select('*').eq('candidate_id', user!.id)
      return (data ?? []) as EduRow[]
    },
    enabled: !!user?.id,
  })

  const { data: galleryRows = [] } = useQuery<GalleryImage[]>({
    queryKey: ['candidate-gallery', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('candidate_gallery').select('id,image_url,sort_order').eq('candidate_id', user!.id).order('sort_order')
      return (data ?? []) as GalleryImage[]
    },
    enabled: !!user?.id,
  })

  useEffect(() => { setGallery(galleryRows) }, [galleryRows])

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
    setDateOfBirth(profile.date_of_birth ?? '')
    setLocationId(profile.state_of_origin_id ?? null)
  }, [profile])

  useEffect(() => {
    if (!profileRow) return
    setEmail(profileRow.email ?? user?.email ?? '')
    setPhone(profileRow.phone ?? '')
  }, [profileRow, user?.email])

  // ── Photo upload — no FileSystem, uses native FormData + fetch ──
  const pickAndUploadPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    setIsUploading(true)
    try {
      const asset = result.assets[0]
      const rawExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg'
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      // Unique path per upload so the public URL changes and cache busting works
      const path = `${user!.id}/avatar_${Date.now()}.${ext}`
      const publicUrl = await uploadImageToStorage(asset.uri, 'avatars', path, contentType)
      setAvatarUrl(publicUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not upload photo.'
      Alert.alert('Upload failed', msg)
    } finally {
      setIsUploading(false)
    }
  }

  // ── Save ──
  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', 'First and last name are required.')
      return
    }
    setIsSaving(true)
    try {
      const { error: profileErr } = await supabase.from('candidate_profiles').update({
        first_name: firstName.trim(), last_name: lastName.trim(),
        headline: headline.trim() || null, bio: bio.trim() || null,
        github_url: githubUrl.trim() || null, linkedin_url: linkedinUrl.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
        is_open_to_work: isOpenToWork, avatar_url: avatarUrl,
        tools: tools.length ? tools : [],
        date_of_birth: dateOfBirth.trim() || null,
        state_of_origin_id: locationId,
      }).eq('id', user!.id)
      if (profileErr) throw profileErr

      if (phone.trim()) {
        await supabase.from('profiles').update({ phone: phone.trim() }).eq('id', user!.id)
      }

      queryClient.invalidateQueries({ queryKey: ['candidate-profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['profile-contact', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['candidate-skills', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['candidate-work', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['candidate-education', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['candidate-gallery', user?.id] })
      router.back()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save profile.'
      Alert.alert('Error', msg)
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
    if (skillRows.some((s) => s.skills?.name?.toLowerCase() === name.toLowerCase())) {
      setSkillInput('')
      return
    }
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not add skill.'
      Alert.alert('Error', msg)
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
    if (!role_title.trim() || !company_name.trim() || !start_date.trim()) {
      Alert.alert('Required', 'Role, company, and start date are required.')
      return
    }
    const { error } = await supabase.from('candidate_work_history').insert({
      candidate_id: user!.id, role_title: role_title.trim(), company_name: company_name.trim(),
      start_date, end_date: is_current ? null : (end_date || null), is_current,
      description: description.trim() || null,
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
    if (!institution.trim() || !degree.trim()) {
      Alert.alert('Required', 'Institution and degree are required.')
      return
    }
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

  const addGalleryImage = async () => {
    if (gallery.length >= MAX_GALLERY) {
      Alert.alert('Limit reached', `Maximum ${MAX_GALLERY} gallery images.`)
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    setIsUploadingGallery(true)
    try {
      const asset = result.assets[0]
      const rawExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg'
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      const path = `${user!.id}/gallery_${Date.now()}.${ext}`

      const publicUrl = await uploadImageToStorage(asset.uri, 'candidate-gallery', path, contentType)

      const { data: inserted, error } = await supabase
        .from('candidate_gallery')
        .insert({ candidate_id: user!.id, image_url: publicUrl, sort_order: gallery.length })
        .select('id,image_url,sort_order')
        .single()
      if (error) throw error
      setGallery((prev) => [...prev, inserted as GalleryImage])
      queryClient.invalidateQueries({ queryKey: ['candidate-gallery', user?.id] })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not upload image.'
      Alert.alert('Upload failed', msg)
    } finally {
      setIsUploadingGallery(false)
    }
  }

  const removeGalleryImage = async (id: string) => {
    await supabase.from('candidate_gallery').delete().eq('id', id)
    setGallery((prev) => prev.filter((g) => g.id !== id))
    queryClient.invalidateQueries({ queryKey: ['candidate-gallery', user?.id] })
  }

  const selectedStateName = locationId ? (NIGERIAN_STATES.find((s) => s.id === locationId)?.name ?? '') : ''
  const initials = `${firstName[0] ?? 'U'}${lastName[0] ?? ''}`.toUpperCase()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: '#5A4F6E', fontSize: 14 }}>← Back</Text>
          </Pressable>
          <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '700' }}>Edit Profile</Text>
          <Pressable onPress={handleSave} disabled={isSaving} hitSlop={12}>
            <Text style={{ color: isSaving ? '#64748B' : '#FF6240', fontSize: 14, fontWeight: '600' }}>
              {isSaving ? 'Saving…' : 'Save'}
            </Text>
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
                {isUploading
                  ? <ActivityIndicator color="#FF6240" size="small" />
                  : <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>Change photo</Text>}
              </Pressable>
            </View>
          </SectionCard>

          {/* ── Basic Info ── */}
          <SectionCard>
            <SectionTitle text="Basic Info" />

            {/* Name row */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel text="First name" />
                <StyledInput value={firstName} onChangeText={setFirstName} placeholder="First name" autoCapitalize="words" />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel text="Last name" />
                <StyledInput value={lastName} onChangeText={setLastName} placeholder="Last name" autoCapitalize="words" />
              </View>
            </View>

            {/* Headline */}
            <View style={{ marginBottom: 12 }}>
              <FieldLabel text="Professional headline" />
              <StyledInput value={headline} onChangeText={setHeadline} placeholder="e.g. Senior Software Engineer" autoCapitalize="words" />
            </View>

            {/* Email — read only */}
            <View style={{ marginBottom: 12 }}>
              <FieldLabel text="Email address" />
              <StyledInput value={email} onChangeText={setEmail} placeholder="Your email" keyboardType="email-address" autoCapitalize="none" editable={false} />
            </View>

            {/* Phone */}
            <View style={{ marginBottom: 12 }}>
              <FieldLabel text="Phone number" />
              <StyledInput value={phone} onChangeText={setPhone} placeholder="+234 000 000 0000" keyboardType="phone-pad" autoCapitalize="none" />
            </View>

            {/* Date of birth */}
            <View style={{ marginBottom: 12 }}>
              <FieldLabel text="Date of birth (YYYY-MM-DD)" />
              <StyledInput value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="e.g. 1998-07-15" autoCapitalize="none" keyboardType="default" />
            </View>

            {/* Location — state picker */}
            <View>
              <FieldLabel text="Location (State)" />
              <Pressable
                onPress={() => setShowStatePicker(true)}
                style={{
                  backgroundColor: '#F5F0E8', borderWidth: 1, borderColor: '#DDD6C9',
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: selectedStateName ? '#1A1625' : '#475569', fontSize: 14 }}>
                  {selectedStateName || 'Select a state…'}
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 12 }}>▼</Text>
              </Pressable>
            </View>
          </SectionCard>

          {/* ── Professional Summary ── */}
          <SectionCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700' }}>Professional Summary</Text>
              <Text style={{ color: '#64748B', fontSize: 12 }}>{bio.length}/500</Text>
            </View>
            <StyledInput value={bio} onChangeText={(t) => { if (t.length <= 500) setBio(t) }} placeholder="Tell employers about your background…" multiline />
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
            <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 10 }}>Software, frameworks, or platforms (e.g. Figma, Docker, PostgreSQL)</Text>
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
              <Pressable onPress={() => setShowAddWork(true)} style={{ borderWidth: 1, borderColor: '#FF624040', borderRadius: 12, borderStyle: 'dashed', paddingVertical: 12, alignItems: 'center' }}>
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
              <Pressable onPress={() => setShowAddEdu(true)} style={{ borderWidth: 1, borderColor: '#FF624040', borderRadius: 12, borderStyle: 'dashed', paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>+ Add education</Text>
              </Pressable>
            )}
          </SectionCard>

          {/* ── Gallery ── */}
          <SectionCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <SectionTitle text="Gallery" />
              <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 14 }}>{gallery.length}/{MAX_GALLERY}</Text>
            </View>
            <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 12 }}>Up to 10 photos companies will see on your profile</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
              {gallery.map((img) => (
                <View key={img.id} style={{ width: 90, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                  <Pressable onPress={() => setLightboxUrl(img.image_url)} style={{ width: '100%', height: '100%' }}>
                    <Image source={{ uri: img.image_url }} style={{ width: 90, height: 90 }} contentFit="cover" />
                  </Pressable>
                  <Pressable
                    onPress={() => removeGalleryImage(img.id)}
                    style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#DC262690', alignItems: 'center', justifyContent: 'center' }}
                    hitSlop={6}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 14 }}>×</Text>
                  </Pressable>
                </View>
              ))}
              {gallery.length < MAX_GALLERY && (
                <Pressable
                  onPress={addGalleryImage}
                  disabled={isUploadingGallery}
                  style={{ width: 90, height: 90, borderRadius: 10, borderWidth: 1, borderColor: '#FF624040', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', opacity: isUploadingGallery ? 0.5 : 1 }}
                >
                  {isUploadingGallery ? <ActivityIndicator color="#FF6240" size="small" /> : <Text style={{ color: '#FF6240', fontSize: 28 }}>+</Text>}
                </Pressable>
              )}
            </ScrollView>
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
            {isSaving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Save changes</Text>}
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── State picker modal ── */}
      <Modal visible={showStatePicker} transparent animationType="slide" onRequestClose={() => setShowStatePicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowStatePicker(false)} />
        <View style={{ backgroundColor: '#F5F0E8', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: Dimensions.get('window').height * 0.7, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#DDD6C9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 16 }}>Select your state</Text>
            <Pressable onPress={() => setShowStatePicker(false)} hitSlop={12}>
              <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={NIGERIAN_STATES}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { setLocationId(item.id); setShowStatePicker(false) }}
                style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#EDE9E0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ color: '#1A1625', fontSize: 15 }}>{item.name}</Text>
                {locationId === item.id && <Text style={{ color: '#FF6240', fontWeight: '700', fontSize: 14 }}>✓</Text>}
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* ── Gallery lightbox ── */}
      <Modal visible={!!lightboxUrl} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setLightboxUrl(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setLightboxUrl(null)}>
          {lightboxUrl && (
            <Image
              source={{ uri: lightboxUrl }}
              style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').width, maxHeight: Dimensions.get('window').height * 0.8 }}
              contentFit="contain"
            />
          )}
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 16 }}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}
