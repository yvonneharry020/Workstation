import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle, G } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type PipelineStage = 'new' | 'reviewed' | 'shortlisted' | 'interview_scheduled' | 'offer_made' | 'rejected' | 'withdrawn'

interface CandidateProfile {
  id: string
  headline: string | null
  overall_status: string | null
  profiles: { full_name: string; avatar_url: string | null; email: string | null } | null
  candidate_skills: { skills: { name: string } | null }[]
  candidate_work_history: {
    job_title: string
    company_name: string
    start_date: string
    end_date: string | null
    is_current: boolean
  }[]
}

interface ApplicationData {
  id: string
  pipeline_stage: PipelineStage
  cover_note: string | null
  screening_answers: Record<string, string> | null
  email_sent_at: string | null
  email_opened_at: string | null
  skills_match_pct: number | null
  internal_notes: string | null
  submitted_at: string
}

const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string; bg: string }> = {
  new:                  { label: 'New',        color: '#818CF8', bg: '#1E293B' },
  reviewed:             { label: 'Reviewed',   color: '#38BDF8', bg: '#082F49' },
  shortlisted:          { label: 'Shortlisted',color: '#0DD4C3', bg: '#042F2E' },
  interview_scheduled:  { label: 'Interview',  color: '#F59E0B', bg: '#451A03' },
  offer_made:           { label: 'Offer Made', color: '#22C55E', bg: '#052E16' },
  rejected:             { label: 'Rejected',   color: '#EF4444', bg: '#450A0A' },
  withdrawn:            { label: 'Withdrawn',  color: '#64748B', bg: '#1E293B' },
}

const MOVABLE_STAGES: PipelineStage[] = ['new', 'reviewed', 'shortlisted', 'interview_scheduled', 'offer_made', 'rejected']

function formatWorkDate(dateStr: string | null, isCurrent: boolean): string {
  if (isCurrent) return 'Present'
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function MailIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Path d="M22 6l-10 7L2 6" />
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

function TrustRing({ score }: { score: number }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const strokeDash = (score / 100) * circumference

  return (
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={44} height={44} viewBox="0 0 44 44" style={{ position: 'absolute' }}>
        <G transform="rotate(-90 22 22)">
          <Circle cx={22} cy={22} r={radius} fill="none" stroke="#1E1B2E" strokeWidth={4} />
          <Circle
            cx={22} cy={22} r={radius} fill="none"
            stroke="#FF6240" strokeWidth={4}
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <Text style={{ color: '#FF6240', fontSize: 10, fontWeight: '700' }}>{score}</Text>
    </View>
  )
}

export default function CandidateProfileScreen() {
  const { id: candidateId, applicationId } = useLocalSearchParams<{ id: string; applicationId?: string }>()
  const [internalNotes, setInternalNotes] = useState('')
  const [notesInitialized, setNotesInitialized] = useState(false)
  const [showScreeningAnswers, setShowScreeningAnswers] = useState(false)
  const queryClient = useQueryClient()

  const { data: candidate, isLoading: loadingProfile } = useQuery({
    queryKey: ['candidate-profile', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select(`
          id, headline, overall_status,
          profiles ( full_name, avatar_url, email ),
          candidate_skills ( skills ( name ) ),
          candidate_work_history ( job_title, company_name, start_date, end_date, is_current )
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
        .select('id, pipeline_stage, cover_note, screening_answers, email_sent_at, email_opened_at, skills_match_pct, internal_notes, submitted_at')
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

  const { mutate: updateStage } = useMutation({
    mutationFn: async (stage: PipelineStage) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ pipeline_stage: stage })
        .eq('id', applicationId!)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['application-detail', applicationId] })
    },
  })

  const { mutate: saveNotes } = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ internal_notes: notes })
        .eq('id', applicationId!)
      if (error) throw error
    },
  })

  const handleMoveStage = () => {
    if (!application) return
    const options = MOVABLE_STAGES.filter((s) => s !== application.pipeline_stage)
    Alert.alert(
      'Move to stage',
      `Current: ${STAGE_CONFIG[application.pipeline_stage].label}`,
      [
        ...options.map((stage) => ({
          text: STAGE_CONFIG[stage].label,
          onPress: () => updateStage(stage),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    )
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

  const name = candidate.profiles?.full_name ?? 'Unknown'
  const avatarUrl = candidate.profiles?.avatar_url
  const email = candidate.profiles?.email
  const currentStage = application?.pipeline_stage
  const stageConfig = currentStage ? STAGE_CONFIG[currentStage] : null
  const emailSeen = !!application?.email_opened_at
  const emailSent = !!application?.email_sent_at
  const skills = candidate.candidate_skills.map((s) => s.skills?.name).filter(Boolean) as string[]
  const workHistory = [...(candidate.candidate_work_history ?? [])].sort((a, b) => {
    if (a.is_current) return -1
    if (b.is_current) return 1
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  })

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-5 pt-4 pb-2 flex-row items-center gap-3 border-b border-surface-border">
        <Pressable onPress={() => router.back()} hitSlop={10} className="active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <Text className="flex-1 text-[#1A1625] font-semibold text-base" numberOfLines={1}>{name}</Text>
        {application && (
          <Pressable
            onPress={handleMoveStage}
            style={{ backgroundColor: stageConfig?.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
            className="active:opacity-70"
          >
            <Text style={{ color: stageConfig?.color, fontSize: 12, fontWeight: '600' }}>
              {stageConfig?.label}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Animated.View entering={FadeInDown.duration(300)} className="px-5 pt-5">
          <View className="flex-row items-center gap-4 mb-5">
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: 80, height: 80, borderRadius: 40 }} contentFit="cover" />
            ) : (
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FF6240', fontSize: 24, fontWeight: '700' }}>{getInitials(name)}</Text>
              </View>
            )}
            <View className="flex-1">
              <Text className="text-[#1A1625] text-xl font-bold mb-0.5">{name}</Text>
              {candidate.headline && (
                <Text className="text-slate-400 text-sm mb-1" numberOfLines={2}>{candidate.headline}</Text>
              )}
              {email && (
                <Text className="text-slate-500 text-xs" numberOfLines={1}>{email}</Text>
              )}
            </View>
            <TrustRing score={75} />
          </View>

          {application && (
            <>
              {(emailSeen || emailSent) && (
                <View
                  style={{
                    backgroundColor: emailSeen ? '#22C55E10' : '#64748B10',
                    borderWidth: 1,
                    borderColor: emailSeen ? '#22C55E30' : '#334155',
                    borderRadius: 12, padding: 12,
                    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: emailSeen ? '#22C55E' : '#64748B' }} />
                  <View className="flex-1">
                    <Text style={{ color: emailSeen ? '#22C55E' : '#5A4F6E', fontSize: 13, fontWeight: '600' }}>
                      {emailSeen ? 'Email opened' : 'Email sent — not yet opened'}
                    </Text>
                    {emailSeen && application.email_opened_at && (
                      <Text style={{ color: '#64748B', fontSize: 11, marginTop: 1 }}>
                        {new Date(application.email_opened_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                  </View>
                  <MailIcon />
                </View>
              )}

              {application.skills_match_pct != null && (
                <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-4">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-slate-300 font-semibold text-sm">Skills Match</Text>
                    <Text style={{ color: '#FF6240', fontSize: 16, fontWeight: '800' }}>
                      {application.skills_match_pct}%
                    </Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: '#DDD6C9', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${application.skills_match_pct}%`, backgroundColor: '#FF6240', borderRadius: 3 }} />
                  </View>
                </View>
              )}

              {application.cover_note && (
                <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-4">
                  <Text className="text-slate-300 font-semibold text-sm mb-2">Cover Note</Text>
                  <Text className="text-slate-400 text-sm leading-5">{application.cover_note}</Text>
                </View>
              )}

              {application.screening_answers && Object.keys(application.screening_answers).length > 0 && (
                <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-4">
                  <Pressable
                    onPress={() => setShowScreeningAnswers((v) => !v)}
                    className="flex-row items-center justify-between"
                  >
                    <Text className="text-slate-300 font-semibold text-sm">Screening Answers</Text>
                    <Text style={{ color: '#FF6240', fontSize: 12 }}>{showScreeningAnswers ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                  {showScreeningAnswers && (
                    <View className="mt-3 gap-3">
                      {Object.entries(application.screening_answers).map(([q, a]) => (
                        <View key={q}>
                          <Text className="text-slate-400 text-xs font-medium mb-1">{q}</Text>
                          <Text className="text-[#1A1625] text-sm">{a}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {applicationId && (
                <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-4">
                  <Text className="text-slate-300 font-semibold text-sm mb-2">Internal Notes</Text>
                  <TextInput
                    multiline
                    placeholder="Add private notes about this candidate…"
                    placeholderTextColor="#475569"
                    value={internalNotes}
                    onChangeText={setInternalNotes}
                    onBlur={() => saveNotes(internalNotes)}
                    style={{
                      color: '#1A1625', fontSize: 13, minHeight: 80,
                      textAlignVertical: 'top', lineHeight: 20,
                    }}
                  />
                </View>
              )}

              <View className="flex-row gap-2 mb-4">
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/(company)/interviews/schedule', params: { applicationId } })
                  }
                  style={{ flex: 1, backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                  className="active:opacity-70"
                >
                  <Text className="text-[#1A1625] font-semibold text-sm">Schedule Interview</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/(company)/badges/issue', params: { candidateId } })
                  }
                  style={{ flex: 1, backgroundColor: '#FF624015', borderWidth: 1, borderColor: '#FF624030', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                  className="active:opacity-70"
                >
                  <Text style={{ color: '#FF6240', fontWeight: '600', fontSize: 14 }}>Issue Badge</Text>
                </Pressable>
              </View>
            </>
          )}

          {workHistory.length > 0 && (
            <View className="mb-4">
              <View className="flex-row items-center gap-2 mb-3">
                <BriefcaseIcon />
                <Text className="text-slate-300 font-semibold text-sm">Work History</Text>
              </View>
              {workHistory.map((job, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1,
                    borderColor: '#DDD6C9', padding: 12, marginBottom: 8,
                  }}
                >
                  <Text className="text-[#1A1625] font-semibold text-sm">{job.job_title}</Text>
                  <Text className="text-slate-400 text-xs mt-0.5">{job.company_name}</Text>
                  <Text className="text-slate-500 text-xs mt-1">
                    {formatWorkDate(job.start_date, false)} — {formatWorkDate(job.end_date, job.is_current)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {skills.length > 0 && (
            <View className="mb-4">
              <Text className="text-slate-300 font-semibold text-sm mb-3">Skills</Text>
              <View className="flex-row flex-wrap gap-2">
                {skills.map((skill) => (
                  <View
                    key={skill}
                    style={{ backgroundColor: '#0DD4C310', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#0DD4C330' }}
                  >
                    <Text style={{ color: '#0DD4C3', fontSize: 12, fontWeight: '500' }}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Animated.View>

        {!application && (
          <View className="px-5">
            <Pressable
              onPress={() =>
                router.push({ pathname: '/(company)/badges/issue', params: { candidateId } })
              }
              style={{ backgroundColor: '#FF624015', borderWidth: 1, borderColor: '#FF624030', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              className="active:opacity-70"
            >
              <Text style={{ color: '#FF6240', fontWeight: '600', fontSize: 14 }}>Issue Badge</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
