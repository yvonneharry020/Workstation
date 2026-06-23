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
import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as DocumentPicker from 'expo-document-picker'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface BadgeInfo {
  id: string
  role_held: string
  start_date: string
  end_date: string | null
  is_current: boolean
  company_profiles: { company_name: string } | null
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function UploadIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </Svg>
  )
}

function FileIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
    </Svg>
  )
}

function XIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

export default function BadgeDisputeScreen() {
  const { id: badgeId } = useLocalSearchParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)

  const [reason, setReason] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<{ name: string; url: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: badge } = useQuery({
    queryKey: ['badge-for-dispute', badgeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('badges')
        .select('id, role_held, start_date, end_date, is_current, company_profiles(company_name)')
        .eq('id', badgeId)
        .single()
      if (error) throw error
      return data as unknown as BadgeInfo
    },
    enabled: !!badgeId,
  })

  const addEvidence = async () => {
    if (evidenceFiles.length >= 3) {
      Alert.alert('Limit reached', 'You can attach a maximum of 3 files.')
      return
    }
    const result = await DocumentPicker.getDocumentAsync({ multiple: false })
    if (!result.canceled && result.assets[0]) {
      setIsUploading(true)
      try {
        const asset = result.assets[0]
        const path = `${user!.id}/${badgeId}/${Date.now()}-${asset.name}`
        const resp = await fetch(asset.uri)
        const blob = await resp.blob()
        await supabase.storage.from('disputes').upload(path, blob, {
          contentType: asset.mimeType ?? 'application/octet-stream',
        })
        const { data } = supabase.storage.from('disputes').getPublicUrl(path)
        setEvidenceFiles((prev) => [...prev, { name: asset.name, url: data.publicUrl }])
      } catch {
        Alert.alert('Upload failed', 'Could not upload file. Please try again.')
      } finally {
        setIsUploading(false)
      }
    }
  }

  const removeEvidence = (url: string) =>
    setEvidenceFiles((prev) => prev.filter((f) => f.url !== url))

  const submitDispute = async () => {
    if (!reason.trim()) return
    setIsSubmitting(true)
    try {
      await supabase.from('badge_disputes').insert({
        badge_id: badgeId,
        raised_by: user!.id,
        reason: reason.trim(),
        evidence_urls: evidenceFiles.map((f) => f.url),
      })
      Alert.alert(
        'Dispute submitted',
        'Our moderation team will review your dispute within 5 business days.',
        [{ text: 'OK', onPress: () => router.replace('/(candidate)/badges' as Parameters<typeof router.replace>[0]) }]
      )
    } catch {
      Alert.alert('Error', 'Could not submit dispute. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center gap-4 px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: '#1E1B2E' }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackIcon />
        </Pressable>
        <Text className="text-white text-base font-semibold">Dispute Badge</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Badge summary */}
          {badge && (
            <Animated.View
              entering={FadeInDown.duration(400)}
              className="bg-surface-card border border-surface-border rounded-2xl p-4 mt-5 mb-4"
            >
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Badge being disputed</Text>
              <Text className="text-white font-bold text-base">{badge.role_held}</Text>
              <Text className="text-slate-400 text-sm mt-0.5">{badge.company_profiles?.company_name ?? 'Unknown company'}</Text>
              <Text className="text-slate-500 text-xs mt-1">
                {formatDate(badge.start_date)} – {badge.is_current ? 'Present' : badge.end_date ? formatDate(badge.end_date) : '?'}
              </Text>
            </Animated.View>
          )}

          {/* Warning */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            className="rounded-2xl p-4 mb-5"
            style={{ backgroundColor: '#78350F20', borderWidth: 1, borderColor: '#F59E0B30' }}
          >
            <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>Before you submit</Text>
            <Text style={{ color: '#D97706', fontSize: 12, lineHeight: 18 }}>
              Disputes are reviewed by our moderation team within 5 business days. False or frivolous disputes may negatively impact your trust score.
            </Text>
          </Animated.View>

          {/* Reason */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text className="text-slate-300 text-sm font-medium mb-2">
              Reason for dispute <Text style={{ color: '#FF6240' }}>*</Text>
            </Text>
            <TextInput
              value={reason}
              onChangeText={(t) => { if (t.length <= 500) setReason(t) }}
              placeholder="Explain why you are disputing this badge. Be specific and include relevant dates, facts, or context…"
              placeholderTextColor="#475569"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-sm mb-1"
              style={{ minHeight: 130 }}
            />
            <Text className="text-slate-600 text-xs text-right mb-5">{reason.length}/500</Text>

            {/* Evidence */}
            <Text className="text-slate-300 text-sm font-medium mb-2">
              Supporting evidence <Text className="text-slate-500">(optional, max 3 files)</Text>
            </Text>

            {evidenceFiles.map((file) => (
              <View
                key={file.url}
                className="flex-row items-center gap-3 bg-surface-card border border-surface-border rounded-xl px-4 py-3 mb-2"
              >
                <FileIcon />
                <Text className="text-white text-sm flex-1" numberOfLines={1}>{file.name}</Text>
                <Pressable onPress={() => removeEvidence(file.url)} hitSlop={8}>
                  <XIcon />
                </Pressable>
              </View>
            ))}

            {evidenceFiles.length < 3 && (
              <Pressable
                onPress={addEvidence}
                disabled={isUploading}
                className="flex-row items-center justify-center gap-2 border border-surface-border rounded-xl py-4 mb-6 active:opacity-80"
                style={{ borderStyle: 'dashed', opacity: isUploading ? 0.6 : 1 }}
              >
                <UploadIcon />
                <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '600' }}>
                  {isUploading ? 'Uploading…' : '+ Add evidence file'}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={submitDispute}
              disabled={!reason.trim() || isSubmitting}
              className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
              style={{ opacity: !reason.trim() || isSubmitting ? 0.5 : 1 }}
            >
              <Text className="text-white font-bold text-base">
                {isSubmitting ? 'Submitting…' : 'Submit Dispute'}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
