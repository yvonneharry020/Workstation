/**
 * Form ID: job-application-step1
 * Slug: apply-step1
 * Reference this identifier when linking this form to other screens.
 */
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useState } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface JobInfo {
  id: string
  title: string
  screening_type: 'normal' | 'timed_quiz'
  quiz_duration_minutes: number | null
  screening_questions: { question: string; required: boolean }[] | null
  company_profiles: { company_name: string; logo_url: string | null } | null
}

interface CandidateData {
  first_name: string
  last_name: string
  nigerian_states: { name: string } | null
  gender: string | null
  date_of_birth: string | null
}

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function LockIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  )
}

function StepDot({ step, active, done }: { step: number; active: boolean; done: boolean }) {
  return (
    <View style={{
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: done ? '#22C55E' : active ? '#FF6240' : '#E2DDD6',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {done ? (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 6L9 17l-5-5" />
        </Svg>
      ) : (
        <Text style={{ color: active ? '#fff' : '#94A3B8', fontSize: 12, fontWeight: '700' }}>{step}</Text>
      )}
    </View>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-4">
      <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#EDE9E0', borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 13,
        borderWidth: 1, borderColor: '#DDD6C9',
      }}>
        <Text style={{ color: '#1A1625', fontSize: 14, flex: 1 }}>{value || '—'}</Text>
        <LockIcon />
      </View>
    </View>
  )
}

export default function ApplyStep1Screen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const user = useAuthStore((s) => s.user)
  const [coverLetter, setCoverLetter] = useState('')

  const { data: jobInfo, isLoading: jobLoading } = useQuery({
    queryKey: ['job-apply-step1', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, title, screening_type, quiz_duration_minutes, screening_questions, company_profiles(company_name, logo_url)')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return data as unknown as JobInfo
    },
    enabled: !!jobId,
  })

  const { data: candidate, isLoading: profileLoading } = useQuery({
    queryKey: ['candidate-step1', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select('first_name, last_name, gender, date_of_birth, nigerian_states!state_of_origin_id(name)')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as unknown as CandidateData
    },
    enabled: !!user?.id,
  })

  const { data: profilePhone } = useQuery({
    queryKey: ['profile-phone', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user!.id)
        .maybeSingle()
      return (data as { phone: string | null } | null)?.phone ?? null
    },
    enabled: !!user?.id,
  })

  const isLoading = jobLoading || profileLoading

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" />
      </SafeAreaView>
    )
  }

  if (!jobInfo) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-5">
        <Text className="text-[#1A1625] font-semibold text-base mb-2">Job not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-primary-400 text-sm">← Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const fullName = candidate
    ? `${candidate.first_name} ${candidate.last_name}`.trim()
    : ''
  const email = user?.email ?? ''
  const location = candidate?.nigerian_states?.name ?? ''
  const gender   = candidate?.gender ?? ''
  const age      = candidate?.date_of_birth
    ? `${Math.floor((Date.now() - new Date(candidate.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))} yrs`
    : ''
  const phone = profilePhone ?? (user?.phone ?? '')
  const hasScreening = (jobInfo.screening_questions?.length ?? 0) > 0

  function handleContinue() {
    if (!coverLetter.trim()) {
      Alert.alert('Cover letter required', 'Please write a brief cover letter before continuing.')
      return
    }
    if (hasScreening) {
      router.push(
        `/(candidate)/jobs/apply-step2?jobId=${jobId}&coverLetter=${encodeURIComponent(coverLetter.trim())}`
      )
    } else {
      router.push(
        `/(candidate)/jobs/apply-step2?jobId=${jobId}&coverLetter=${encodeURIComponent(coverLetter.trim())}`
      )
    }
  }

  const company = jobInfo.company_profiles
  const initials = company?.company_name?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#DDD6C9' }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackIcon />
        </Pressable>
        <View className="flex-1">
          <Text style={{ color: '#94A3B8', fontSize: 11 }}>Applying for</Text>
          <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
            {jobInfo.title}
          </Text>
        </View>
      </View>

      {/* Step indicator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 8 }}>
        <StepDot step={1} active done={false} />
        <View style={{ flex: 1, height: 2, backgroundColor: '#DDD6C9', borderRadius: 1 }} />
        <StepDot step={2} active={false} done={false} />
        <View style={{ flex: 1, height: 2, backgroundColor: '#DDD6C9', borderRadius: 1 }} />
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2DDD6', alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M20 6L9 17l-5-5" />
          </Svg>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
        <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 16 }}>Your application</Text>
        <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>Your details are auto-filled from your profile</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Company preview */}
          <Animated.View entering={FadeInDown.duration(350)} style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: '#EDE9E0', borderRadius: 14,
            padding: 14, marginBottom: 20,
            borderWidth: 1, borderColor: '#DDD6C9',
          }}>
            {company?.logo_url ? (
              <Image source={{ uri: company.logo_url }} style={{ width: 40, height: 40, borderRadius: 10 }} contentFit="cover" />
            ) : (
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '700' }}>{initials}</Text>
              </View>
            )}
            <View className="flex-1">
              <Text style={{ color: '#94A3B8', fontSize: 11 }}>{company?.company_name}</Text>
              <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 14 }}>{jobInfo.title}</Text>
            </View>
          </Animated.View>

          {/* Auto-filled fields */}
          <Animated.View entering={FadeInDown.delay(60).duration(350)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <LockIcon />
              <Text style={{ color: '#94A3B8', fontSize: 11 }}>Auto-filled from your profile</Text>
            </View>

            <ReadOnlyField label="Full Name" value={fullName} />
            <ReadOnlyField label="Email Address" value={email} />
            <ReadOnlyField label="Phone Number" value={phone} />
            <ReadOnlyField label="Location" value={location} />
            <ReadOnlyField label="Gender" value={gender} />
            <ReadOnlyField label="Age" value={age} />
            <ReadOnlyField label="Role Applying For" value={jobInfo.title} />
          </Animated.View>

          {/* Cover Letter — manual */}
          <Animated.View entering={FadeInDown.delay(120).duration(350)} className="mb-4">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Cover Letter <Text style={{ color: '#FF6240' }}>*</Text>
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 11 }}>{coverLetter.length}/800</Text>
            </View>
            <TextInput
              value={coverLetter}
              onChangeText={(t) => { if (t.length <= 800) setCoverLetter(t) }}
              placeholder={`Tell ${company?.company_name ?? 'the company'} why you're the perfect fit for this role…`}
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={7}
              textAlignVertical="top"
              style={{
                backgroundColor: '#fff',
                borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9',
                paddingHorizontal: 14, paddingVertical: 14,
                color: '#1A1625', fontSize: 14, minHeight: 150,
              }}
            />
          </Animated.View>

          {/* Screening notice */}
          {hasScreening && (
            <Animated.View entering={FadeInDown.delay(180).duration(350)} style={{
              backgroundColor: jobInfo.screening_type === 'timed_quiz' ? '#F59E0B15' : '#6366F115',
              borderWidth: 1,
              borderColor: jobInfo.screening_type === 'timed_quiz' ? '#F59E0B40' : '#6366F130',
              borderRadius: 14, padding: 14, marginBottom: 8,
            }}>
              <Text style={{
                color: jobInfo.screening_type === 'timed_quiz' ? '#F59E0B' : '#818CF8',
                fontWeight: '700', fontSize: 13, marginBottom: 4,
              }}>
                {jobInfo.screening_type === 'timed_quiz'
                  ? `⏱ Timed screening — ${jobInfo.quiz_duration_minutes} min`
                  : `📋 ${jobInfo.screening_questions!.length} screening question${jobInfo.screening_questions!.length !== 1 ? 's' : ''}`}
              </Text>
              <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18 }}>
                {jobInfo.screening_type === 'timed_quiz'
                  ? 'The next step is a timed quiz set by the company. A countdown will be visible on screen.'
                  : 'The next step has screening questions set by the company. Take your time to answer carefully.'}
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom CTA */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36,
        borderTopWidth: 1, borderColor: '#DDD6C9', backgroundColor: '#F5F0E8',
      }}>
        <Pressable
          onPress={handleContinue}
          style={{ backgroundColor: '#FF6240', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          className="active:opacity-80"
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {hasScreening ? 'Continue to Screening →' : 'Submit Application'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
