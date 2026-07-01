import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useState, useEffect } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface CvSections {
  summary: string
  experience: string
  education: string
  skills: string
  portfolio: string
}

const SECTION_LABELS: { key: keyof CvSections; title: string; placeholder: string }[] = [
  { key: 'summary', title: 'Professional Summary', placeholder: 'A concise overview of your background and career goals…' },
  { key: 'experience', title: 'Work Experience', placeholder: 'List your past roles, companies, and key responsibilities…' },
  { key: 'education', title: 'Education', placeholder: 'Universities, degrees, certifications…' },
  { key: 'skills', title: 'Skills', placeholder: 'List technical and soft skills…' },
  { key: 'portfolio', title: 'Portfolio & Projects', placeholder: 'Notable projects, links, and achievements…' },
]

export default function CvEditScreen() {
  const { templateId, versionId } = useLocalSearchParams<{ templateId?: string; versionId?: string }>()
  const user = useAuthStore((s) => s.user)

  const [cvName, setCvName] = useState('My CV')
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [sections, setSections] = useState<CvSections>({
    summary: '',
    experience: '',
    education: '',
    skills: '',
    portfolio: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  // Load existing version if editing
  const { data: existingVersion } = useQuery({
    queryKey: ['cv-version', versionId],
    queryFn: async () => {
      const { data } = await supabase.from('cv_versions').select('*').eq('id', versionId!).single()
      return data
    },
    enabled: !!versionId,
  })

  // Pre-fill from candidate profile
  const { data: candidateData } = useQuery({
    queryKey: ['cv-candidate-data', user?.id],
    queryFn: async () => {
      const [profileRes, workRes, eduRes, skillsRes] = await Promise.all([
        supabase.from('candidate_profiles').select('bio, headline').eq('id', user!.id).single(),
        supabase.from('candidate_work_history').select('job_title, company_name, start_date, end_date, is_current, description').eq('candidate_id', user!.id).order('start_date', { ascending: false }),
        supabase.from('candidate_education').select('institution, degree, field_of_study, start_year, end_year').eq('candidate_id', user!.id).order('end_year', { ascending: false }),
        supabase.from('candidate_skills').select('skills(name)').eq('candidate_id', user!.id),
      ])
      return {
        bio: profileRes.data?.bio ?? '',
        work: workRes.data ?? [],
        education: eduRes.data ?? [],
        skills: skillsRes.data ?? [],
      }
    },
    enabled: !!user?.id && !versionId,
  })

  useEffect(() => {
    if (existingVersion) {
      setCvName(existingVersion.name)
      setSections(existingVersion.content as CvSections)
    }
  }, [existingVersion])

  useEffect(() => {
    if (candidateData && !versionId) {
      const workText = (candidateData.work as { job_title: string; company_name: string; start_date: string; end_date: string | null; is_current: boolean; description: string | null }[])
        .map((w) => `${w.job_title} at ${w.company_name} (${w.start_date?.slice(0, 7) ?? ''} – ${w.is_current ? 'Present' : w.end_date?.slice(0, 7) ?? ''})${w.description ? '\n' + w.description : ''}`)
        .join('\n\n')

      const eduText = (candidateData.education as { institution: string; degree: string; field_of_study: string | null; start_year: number | null; end_year: number | null }[])
        .map((e) => `${e.degree}${e.field_of_study ? ` in ${e.field_of_study}` : ''} — ${e.institution} (${e.start_year ?? ''} – ${e.end_year ?? 'Present'})`)
        .join('\n')

      const skillsText = (candidateData.skills as unknown as { skills: { name: string } | null }[])
        .map((s) => s.skills?.name)
        .filter(Boolean)
        .join(', ')

      setSections({
        summary: candidateData.bio ?? '',
        experience: workText,
        education: eduText,
        skills: skillsText,
        portfolio: '',
      })
    }
  }, [candidateData, versionId])

  const updateSection = (key: keyof CvSections, value: string) =>
    setSections((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!cvName.trim()) return Alert.alert('Required', 'Please enter a CV name.')
    setIsSaving(true)
    try {
      if (versionId) {
        await supabase
          .from('cv_versions')
          .update({ name: cvName.trim(), content: sections, updated_at: new Date().toISOString() })
          .eq('id', versionId)
      } else {
        await supabase.from('cv_versions').insert({
          candidate_id: user!.id,
          template_id: templateId ?? 'pro',
          name: cvName.trim(),
          content: sections,
        })
      }
      router.replace('/(candidate)/cv/versions' as Parameters<typeof router.replace>[0])
    } catch {
      Alert.alert('Error', 'Could not save your CV. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 5l-7 7 7 7" />
          </Svg>
        </Pressable>
        <Text className="text-[#1A1625] text-base font-semibold">{versionId ? 'Edit CV' : 'Build CV'}</Text>
        <Pressable onPress={handleSave} disabled={isSaving} className="active:opacity-70">
          <Text style={{ color: '#FF6240', fontSize: 15, fontWeight: '700', opacity: isSaving ? 0.5 : 1 }}>
            {isSaving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* CV Name */}
          <View className="mt-5 mb-4">
            <Text className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">CV Name</Text>
            <TextInput
              value={cvName}
              onChangeText={setCvName}
              placeholder="e.g. Senior Engineer CV"
              placeholderTextColor="#475569"
              className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-[#1A1625] text-base font-semibold"
            />
          </View>

          {/* Tab Bar */}
          <View className="flex-row bg-surface-card border border-surface-border rounded-2xl p-1 mb-5">
            {(['edit', 'preview'] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 14,
                  backgroundColor: activeTab === tab ? '#FF6240' : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: activeTab === tab ? '#1A1625' : '#5A4F6E', fontSize: 14, fontWeight: '600', textTransform: 'capitalize' }}>
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeTab === 'edit' ? (
            SECTION_LABELS.map(({ key, title, placeholder }) => (
              <View key={key} className="mb-4">
                <Text className="text-slate-300 text-sm font-semibold mb-2">{title}</Text>
                <TextInput
                  value={sections[key]}
                  onChangeText={(t) => updateSection(key, t)}
                  placeholder={placeholder}
                  placeholderTextColor="#475569"
                  multiline
                  textAlignVertical="top"
                  className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-[#1A1625] text-sm"
                  style={{ minHeight: 100 }}
                />
              </View>
            ))
          ) : (
            <View className="bg-surface-card border border-surface-border rounded-2xl p-5">
              <Text className="text-[#1A1625] text-xl font-bold mb-1">{cvName}</Text>
              <View style={{ height: 1, backgroundColor: '#DDD6C9', marginBottom: 16 }} />
              {SECTION_LABELS.map(({ key, title }) =>
                sections[key] ? (
                  <View key={key} className="mb-4">
                    <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
                      {title}
                    </Text>
                    <Text className="text-slate-300 text-sm leading-5">{sections[key]}</Text>
                  </View>
                ) : null
              )}
              {Object.values(sections).every((v) => !v) && (
                <Text className="text-slate-600 text-sm text-center py-4">Fill in the Edit tab to see your preview here.</Text>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
