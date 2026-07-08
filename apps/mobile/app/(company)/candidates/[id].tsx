import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Dimensions,
  StatusBar,
  FlatList,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Rect } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { PIPELINE_CONFIG } from '@/components/ats/types'

const { width: SCREEN_W } = Dimensions.get('window')

const NIGERIAN_STATES: Record<number, string> = {
  1: 'Abia', 2: 'Adamawa', 3: 'Akwa Ibom', 4: 'Anambra', 5: 'Bauchi',
  6: 'Bayelsa', 7: 'Benue', 8: 'Borno', 9: 'Cross River', 10: 'Delta',
  11: 'Ebonyi', 12: 'Edo', 13: 'Ekiti', 14: 'Enugu', 15: 'FCT',
  16: 'Gombe', 17: 'Imo', 18: 'Jigawa', 19: 'Kaduna', 20: 'Kano',
  21: 'Katsina', 22: 'Kebbi', 23: 'Kogi', 24: 'Kwara', 25: 'Lagos',
  26: 'Nasarawa', 27: 'Niger', 28: 'Ogun', 29: 'Ondo', 30: 'Osun',
  31: 'Oyo', 32: 'Plateau', 33: 'Rivers', 34: 'Sokoto', 35: 'Taraba',
  36: 'Yobe', 37: 'Zamfara',
}

type PipelineStage = 'new' | 'reviewed' | 'shortlisted' | 'interview_scheduled' | 'hired' | 'rejected' | 'withdrawn'

interface CandidateProfile {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  headline: string | null
  gender: string | null
  date_of_birth: string | null
  state_of_origin_id: number | null
  bio: string | null
  github_url: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  tools: string[] | null
  profiles: { email: string | null } | null
  candidate_skills: { skills: { name: string } | null }[]
  candidate_work_history: {
    role_title: string
    company_name: string
    start_date: string
    end_date: string | null
    is_current: boolean
    description: string | null
  }[]
  candidate_education: {
    institution: string
    degree: string
    field_of_study: string | null
    start_year: number | null
    end_year: number | null
  }[]
  candidate_gallery: {
    image_url: string
    sort_order: number
  }[]
}

interface ApplicationData {
  id: string
  job_id: string
  pipeline_stage: PipelineStage
  cover_note: string | null
  screening_answers: Record<string, string> | null
  email_sent_at: string | null
  email_opened_at: string | null
  internal_notes: string | null
  submitted_at: string
}


function getAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function genderLetter(gender: string | null): string {
  if (gender === 'male') return 'M'
  if (gender === 'female') return 'F'
  return ''
}

function formatWorkDate(dateStr: string | null, isCurrent: boolean): string {
  if (isCurrent) return 'Present'
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function MailIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Path d="M22 6l-10 7L2 6" />
    </Svg>
  )
}

function MapPinIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Path d="M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="#64748B" />
    </Svg>
  )
}

function UserIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </Svg>
  )
}

function BriefcaseIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 14H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2z" />
      <Path d="M16 14v3a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-3M8 5V3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  )
}

function GraduationIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <Path d="M6 12v5c3 3 9 3 12 0v-5" />
    </Svg>
  )
}

function LinkIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  )
}

function XIcon({ color = '#1A1625' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

function ImageIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Path d="M3 9l4-4 4 4 4-5 6 8H3z" />
    </Svg>
  )
}

// ─── Avatar lightbox ─────────────────────────────────────────────────────────

function AvatarLightbox({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Pressable style={{ flex: 1, backgroundColor: '#000000E0', alignItems: 'center', justifyContent: 'center' }} onPress={onClose}>
        <Image source={{ uri }} style={{ width: SCREEN_W - 40, height: SCREEN_W - 40, borderRadius: 20 }} contentFit="cover" />
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 52, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff30', alignItems: 'center', justifyContent: 'center' }}
          hitSlop={12}
        >
          <XIcon color="#fff" />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Gallery image lightbox ───────────────────────────────────────────────────

function GalleryLightbox({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Pressable style={{ flex: 1, backgroundColor: '#000000F0', alignItems: 'center', justifyContent: 'center' }} onPress={onClose}>
        <Image source={{ uri }} style={{ width: SCREEN_W, height: SCREEN_W * 0.9 }} contentFit="contain" />
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 52, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff30', alignItems: 'center', justifyContent: 'center' }}
          hitSlop={12}
        >
          <XIcon color="#fff" />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Full profile modal ───────────────────────────────────────────────────────

function ViewProfileModal({ candidateId, visible, onClose }: {
  candidateId: string
  visible: boolean
  onClose: () => void
}) {
  const [galleryLightbox, setGalleryLightbox] = useState<string | null>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['full-profile-view', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select(`
          first_name, last_name, avatar_url, headline, bio, gender, date_of_birth,
          state_of_origin_id, github_url, linkedin_url, portfolio_url, tools,
          candidate_skills ( skills ( name ) ),
          candidate_work_history ( role_title, company_name, start_date, end_date, is_current, description ),
          candidate_education ( institution, degree, field_of_study, start_year, end_year ),
          candidate_gallery ( image_url, sort_order )
        `)
        .eq('id', candidateId)
        .maybeSingle()
      if (error) throw error
      return data as unknown as CandidateProfile | null
    },
    enabled: visible && !!candidateId,
  })

  if (!visible) return null

  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : ''
  const gLetter = genderLetter(profile?.gender ?? null)
  const age = profile?.date_of_birth ? getAge(profile.date_of_birth) : null
  const location = profile?.state_of_origin_id ? NIGERIAN_STATES[profile.state_of_origin_id] : null
  const skills = (profile?.candidate_skills ?? []).map((s) => s.skills?.name).filter(Boolean) as string[]
  const tools = (profile?.tools ?? []).filter(Boolean) as string[]
  const gallery = [...(profile?.candidate_gallery ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const workHistory = [...(profile?.candidate_work_history ?? [])].sort((a, b) => {
    if (a.is_current) return -1
    if (b.is_current) return 1
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  })

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F0E8" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ marginRight: 12 }}>
            <XIcon />
          </Pressable>
          <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {name}'s Profile
          </Text>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#FF6240" size="large" />
          </View>
        ) : !profile ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#64748B' }}>Profile not available</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

            {/* Identity */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: '#FF624040', marginBottom: 12 }} contentFit="cover" />
              ) : (
                <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Text style={{ color: '#FF6240', fontSize: 28, fontWeight: '800' }}>{getInitials(name)}</Text>
                </View>
              )}
              <Text style={{ color: '#1A1625', fontSize: 20, fontWeight: '800', marginBottom: 4, textAlign: 'center' }}>
                {name}{gLetter || age ? <Text style={{ color: '#64748B', fontWeight: '400', fontSize: 16 }}> ({[gLetter, age].filter(Boolean).join('|')})</Text> : null}
              </Text>
              {profile.headline && <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{profile.headline}</Text>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                {location && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MapPinIcon />
                    <Text style={{ color: '#64748B', fontSize: 12 }}>{location}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Bio */}
            {profile.bio && (
              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 14, marginBottom: 16 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>About</Text>
                <Text style={{ color: '#1A1625', fontSize: 13, lineHeight: 20 }}>{profile.bio}</Text>
              </View>
            )}

            {/* Gallery */}
            {gallery.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Gallery</Text>
                <FlatList
                  data={gallery}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, i) => String(i)}
                  contentContainerStyle={{ gap: 10 }}
                  renderItem={({ item }) => (
                    <Pressable onPress={() => setGalleryLightbox(item.image_url)} className="active:opacity-80">
                      <Image source={{ uri: item.image_url }} style={{ width: 140, height: 110, borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9' }} contentFit="cover" />
                    </Pressable>
                  )}
                />
              </View>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Skills</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {skills.map((s) => (
                    <View key={s} style={{ backgroundColor: '#0DD4C310', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#0DD4C330' }}>
                      <Text style={{ color: '#0DD4C3', fontSize: 12, fontWeight: '500' }}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Tools */}
            {tools.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Tools</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {tools.map((t) => (
                    <View key={t} style={{ backgroundColor: '#818CF810', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#818CF830' }}>
                      <Text style={{ color: '#818CF8', fontSize: 12, fontWeight: '500' }}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Work history */}
            {workHistory.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <BriefcaseIcon />
                  <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Work Experience</Text>
                </View>
                {workHistory.map((job, i) => (
                  <View key={i} style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', padding: 14, marginBottom: 10 }}>
                    <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 14 }}>{job.role_title}</Text>
                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{job.company_name}</Text>
                    <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 4 }}>
                      {formatWorkDate(job.start_date, false)} — {formatWorkDate(job.end_date, job.is_current)}
                    </Text>
                    {job.description && (
                      <Text style={{ color: '#5A4F6E', fontSize: 12, marginTop: 8, lineHeight: 18 }}>{job.description}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Education */}
            {(profile.candidate_education ?? []).length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <GraduationIcon />
                  <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Education</Text>
                </View>
                {profile.candidate_education.map((edu, i) => (
                  <View key={i} style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', padding: 14, marginBottom: 10 }}>
                    <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 14 }}>{edu.degree}</Text>
                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{edu.institution}</Text>
                    {edu.field_of_study && (
                      <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>{edu.field_of_study}</Text>
                    )}
                    {(edu.start_year || edu.end_year) && (
                      <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 4 }}>
                        {edu.start_year ?? '?'} — {edu.end_year ?? 'Present'}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Links */}
            {(profile.github_url || profile.linkedin_url || profile.portfolio_url) && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Links</Text>
                <View style={{ gap: 8 }}>
                  {[
                    { label: 'GitHub', url: profile.github_url },
                    { label: 'LinkedIn', url: profile.linkedin_url },
                    { label: 'Portfolio', url: profile.portfolio_url },
                  ].filter((l) => !!l.url).map((l) => (
                    <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EDE7DB', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#DDD6C9' }}>
                      <LinkIcon />
                      <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', width: 70 }}>{l.label}</Text>
                      <Text style={{ color: '#818CF8', fontSize: 12, flex: 1 }} numberOfLines={1}>{l.url}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {galleryLightbox && (
        <GalleryLightbox uri={galleryLightbox} onClose={() => setGalleryLightbox(null)} />
      )}
    </Modal>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CandidateApplicationScreen() {
  const { id: candidateId, applicationId } = useLocalSearchParams<{ id: string; applicationId?: string }>()
  const user = useAuthStore((s) => s.user)
  const [internalNotes, setInternalNotes] = useState('')
  const [notesInitialized, setNotesInitialized] = useState(false)
  const [showScreeningAnswers, setShowScreeningAnswers] = useState(false)
  const [avatarLightbox, setAvatarLightbox] = useState(false)
  const [showFullProfile, setShowFullProfile] = useState(false)
  const [hasRecordedView, setHasRecordedView] = useState(false)
  const { data: candidate, isLoading: loadingProfile } = useQuery({
    queryKey: ['candidate-profile', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select(`
          id, first_name, last_name, avatar_url, headline,
          gender, date_of_birth, state_of_origin_id,
          profiles ( email ),
          candidate_skills ( skills ( name ) ),
          candidate_work_history ( role_title, company_name, start_date, end_date, is_current )
        `)
        .eq('id', candidateId!)
        .maybeSingle()
      if (error) throw error
      return data as unknown as CandidateProfile | null
    },
    enabled: !!candidateId,
  })

  const { data: application, isLoading: loadingApp } = useQuery({
    queryKey: ['application-detail', applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select('id, job_id, pipeline_stage, cover_note, screening_answers, email_sent_at, email_opened_at, internal_notes, submitted_at')
        .eq('id', applicationId!)
        .maybeSingle()
      if (error) throw error
      const appData = data as unknown as ApplicationData | null
      if (appData?.internal_notes && !notesInitialized) {
        setInternalNotes(appData.internal_notes)
        setNotesInitialized(true)
      }
      return appData
    },
    enabled: !!applicationId,
  })

  const { data: screeningQuestions } = useQuery({
    queryKey: ['job-screening-questions', application?.job_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_postings')
        .select('screening_questions')
        .eq('id', application!.job_id!)
        .maybeSingle()
      return (data as { screening_questions: { question: string; required: boolean }[] } | null)?.screening_questions ?? []
    },
    enabled: !!application?.job_id,
  })

  const { mutate: saveNotes } = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase.from('job_applications').update({ internal_notes: notes }).eq('id', applicationId!)
      if (error) throw error
    },
  })

  const recordViewMutation = useMutation({
    mutationFn: async () => {
      if (hasRecordedView || !user?.id || !candidateId) return
      const { count } = await supabase
        .from('profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('viewer_id', user.id)
        .eq('viewed_id', candidateId)
      if ((count ?? 0) === 0) {
        await supabase.from('profile_views').insert({ viewer_id: user.id, viewed_id: candidateId })
        const { data: companyRow } = await supabase
          .from('company_profiles')
          .select('company_name')
          .eq('id', user.id)
          .maybeSingle()
        const companyName = (companyRow as { company_name: string } | null)?.company_name ?? 'A company'
        await supabase.from('notifications').insert({
          user_id:    candidateId,
          type:       'profile_viewed',
          title:      'Someone viewed your profile',
          body:       `${companyName} viewed your profile`,
          data:       { viewer_id: user.id },
          action_url: null,
        })
      }
      setHasRecordedView(true)
    },
  })

  const handleOpenProfile = () => {
    setShowFullProfile(true)
    void recordViewMutation.mutate()
  }

  const isLoading = loadingProfile || (!!applicationId && loadingApp)

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['top']}>
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  if (!candidate) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-5" edges={['top']}>
        <Text className="text-slate-400 text-base">Candidate not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text style={{ color: '#FF6240' }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const name = `${candidate.first_name} ${candidate.last_name}`.trim() || 'Unknown'
  const email = candidate.profiles?.email ?? null
  const avatarUrl = candidate.avatar_url
  const gLetter = genderLetter(candidate.gender)
  const age = candidate.date_of_birth ? getAge(candidate.date_of_birth) : null
  const location = candidate.state_of_origin_id ? NIGERIAN_STATES[candidate.state_of_origin_id] : null
  const currentStage = application?.pipeline_stage
  const stageConfig = currentStage ? PIPELINE_CONFIG[currentStage] : null
  const emailSeen = !!application?.email_opened_at
  const emailSent = !!application?.email_sent_at

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
        <Pressable onPress={() => router.back()} hitSlop={10} className="active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <Text style={{ flex: 1, color: '#1A1625', fontWeight: '600', fontSize: 16 }} numberOfLines={1}>{name}</Text>
        {application && stageConfig && (
          <View style={{ backgroundColor: stageConfig.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: stageConfig.border }}>
            <Text style={{ color: stageConfig.color, fontSize: 12, fontWeight: '600' }}>{stageConfig.label}</Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: 20, paddingTop: 20 }}>

          {/* Candidate identity card */}
          <View style={{ backgroundColor: '#EDE7DB', borderRadius: 20, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
              {/* Avatar — tappable */}
              <Pressable onPress={() => avatarUrl && setAvatarLightbox(true)} className="active:opacity-80">
                {avatarUrl ? (
                  <View>
                    <Image source={{ uri: avatarUrl }} style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: '#FF624040' }} contentFit="cover" />
                    <View style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FF6240', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#F5F0E8' }}>
                      <ImageIcon />
                    </View>
                  </View>
                ) : (
                  <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FF6240', fontSize: 22, fontWeight: '700' }}>{getInitials(name)}</Text>
                  </View>
                )}
              </Pressable>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1A1625', fontSize: 17, fontWeight: '800', marginBottom: 2 }}>
                  {name}
                  {(gLetter || age) ? (
                    <Text style={{ color: '#64748B', fontWeight: '400', fontSize: 14 }}>
                      {' '}({[gLetter, age].filter(Boolean).join('|')})
                    </Text>
                  ) : null}
                </Text>
                {candidate.headline && (
                  <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 6 }} numberOfLines={2}>{candidate.headline}</Text>
                )}
                <View style={{ gap: 4 }}>
                  {email && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <MailIcon />
                      <Text style={{ color: '#64748B', fontSize: 12 }}>{email}</Text>
                    </View>
                  )}
                  {location && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <MapPinIcon />
                      <Text style={{ color: '#64748B', fontSize: 12 }}>{location}</Text>
                    </View>
                  )}
                  {(gLetter || age) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <UserIcon />
                      <Text style={{ color: '#64748B', fontSize: 12 }}>
                        {gLetter ? (gLetter === 'M' ? 'Male' : 'Female') : ''}{age ? `${gLetter ? ', ' : ''}${age} yrs` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* View Profile button */}
            <Pressable
              onPress={handleOpenProfile}
              style={{ marginTop: 14, backgroundColor: '#FF6240', borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}
              className="active:opacity-80"
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>View Full Profile</Text>
            </Pressable>
          </View>

          {application && (
            <>
              {/* Email status */}
              {(emailSeen || emailSent) && (
                <View style={{ backgroundColor: emailSeen ? '#22C55E10' : '#64748B10', borderWidth: 1, borderColor: emailSeen ? '#22C55E30' : '#334155', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: emailSeen ? '#22C55E' : '#64748B' }} />
                  <Text style={{ color: emailSeen ? '#22C55E' : '#5A4F6E', fontSize: 13, fontWeight: '600' }}>
                    {emailSeen ? 'Email opened' : 'Email sent — not yet opened'}
                  </Text>
                </View>
              )}

              {/* Cover Note */}
              {application.cover_note && (
                <View style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 16, padding: 14, marginBottom: 14 }}>
                  <Text style={{ color: '#5A4F6E', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Cover Note</Text>
                  <Text style={{ color: '#1A1625', fontSize: 13, lineHeight: 20 }}>{application.cover_note}</Text>
                </View>
              )}

              {/* Screening Answers */}
              {application.screening_answers && Object.keys(application.screening_answers).length > 0 && (
                <View style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 16, padding: 14, marginBottom: 14 }}>
                  <Pressable onPress={() => setShowScreeningAnswers((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#5A4F6E', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Screening Answers</Text>
                    <Text style={{ color: '#FF6240', fontSize: 12 }}>{showScreeningAnswers ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                  {showScreeningAnswers && (
                    <View style={{ marginTop: 12, gap: 10 }}>
                      {Object.keys(application.screening_answers).map((key, i) => {
                        const answer = application.screening_answers![key]
                        const questionText = screeningQuestions?.[i]?.question ?? key
                        return (
                          <View key={key}>
                            <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600', marginBottom: 3 }}>{questionText}</Text>
                            <Text style={{ color: '#1A1625', fontSize: 13 }}>{answer || '—'}</Text>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Internal Notes */}
              {applicationId && (
                <View style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 16, padding: 14, marginBottom: 14 }}>
                  <Text style={{ color: '#5A4F6E', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Internal Notes</Text>
                  <TextInput
                    multiline
                    placeholder="Add private notes about this candidate…"
                    placeholderTextColor="#94A3B8"
                    value={internalNotes}
                    onChangeText={setInternalNotes}
                    onBlur={() => saveNotes(internalNotes)}
                    style={{ color: '#1A1625', fontSize: 13, minHeight: 80, textAlignVertical: 'top', lineHeight: 20 }}
                  />
                </View>
              )}

              {/* Schedule Interview */}
              <Pressable
                onPress={() => router.push({
                  pathname: '/(company)/interviews/schedule' as never,
                  params: { applicationId, candidateId },
                })}
                style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 14 }}
                className="active:opacity-70"
              >
                <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 14 }}>Schedule Interview</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </ScrollView>

      {/* Avatar lightbox */}
      {avatarLightbox && avatarUrl && (
        <AvatarLightbox uri={avatarUrl} onClose={() => setAvatarLightbox(false)} />
      )}

      {/* Full profile modal */}
      <ViewProfileModal
        candidateId={candidateId!}
        visible={showFullProfile}
        onClose={() => setShowFullProfile(false)}
      />
    </SafeAreaView>
  )
}
