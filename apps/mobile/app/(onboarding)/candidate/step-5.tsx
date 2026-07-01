import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import * as DocumentPicker from 'expo-document-picker'
import Svg, { Path, Rect } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const TOTAL_STEPS = 5
const IS_MOCK = process.env.EXPO_PUBLIC_MOCK_VERIFICATION === 'true'

type SlotStatus = 'idle' | 'uploading' | 'scanning' | 'passed' | 'failed' | 'required'

interface DocSlot {
  id: string
  label: string
  description: string
  required: boolean
  status: SlotStatus
  fileName?: string
  feedback?: string
}

const INITIAL_SLOTS: DocSlot[] = [
  {
    id: 'government_id',
    label: "Government-issued ID",
    description: "Driver's licence, international passport, or voter's card",
    required: true,
    status: 'idle',
  },
  {
    id: 'proof_of_address',
    label: 'Proof of address',
    description: 'Utility bill, bank statement, or NEPA bill (within 3 months)',
    required: true,
    status: 'idle',
  },
  {
    id: 'educational_cert',
    label: 'Highest educational certificate',
    description: 'WAEC, OND, HND, BSc, or equivalent',
    required: false,
    status: 'idle',
  },
]

function UploadIcon({ color = '#64748B' }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5" />
      <Path d="M12 3v12" />
    </Svg>
  )
}

function FileIcon({ color = '#64748B' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
    </Svg>
  )
}

function statusColor(status: SlotStatus): string {
  switch (status) {
    case 'passed': return '#22C55E'
    case 'failed': return '#EF4444'
    case 'uploading':
    case 'scanning': return '#FF6240'
    default: return '#C8BFB0'
  }
}

function statusLabel(status: SlotStatus): string {
  switch (status) {
    case 'uploading': return 'Uploading…'
    case 'scanning': return 'AI scan in progress…'
    case 'passed': return 'Document accepted'
    case 'failed': return 'Review required'
    default: return 'Tap to upload'
  }
}

export default function CandidateStep5() {
  const user = useAuthStore((s) => s.user)
  const [slots, setSlots] = useState<DocSlot[]>(INITIAL_SLOTS)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateSlot = (id: string, patch: Partial<DocSlot>) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    )
  }

  const handlePickDocument = async (slotId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
        copyToCacheDirectory: true,
        multiple: false,
      })

      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      updateSlot(slotId, { status: 'uploading', fileName: asset.name })

      if (IS_MOCK) {
        await new Promise((r) => setTimeout(r, 1000))
        updateSlot(slotId, { status: 'scanning' })
        await new Promise((r) => setTimeout(r, 2000))
        const passed = !asset.name.toLowerCase().includes('fail')
        updateSlot(slotId, {
          status: passed ? 'passed' : 'failed',
          feedback: passed
            ? undefined
            : 'Document appears blurry or partially obscured. Please upload a clearer image.',
        })
        return
      }

      // Production: upload to Supabase Storage, then call AI scan function
      const fileExt = asset.name.split('.').pop()
      const filePath = `${user?.id}/${slotId}_${Date.now()}.${fileExt}`
      const response = await fetch(asset.uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('verification-docs')
        .upload(filePath, blob)

      if (uploadError) {
        updateSlot(slotId, { status: 'failed', feedback: 'Upload failed. Please try again.' })
        return
      }

      updateSlot(slotId, { status: 'scanning' })

      const { error: scanError } = await supabase.functions.invoke('scan-document', {
        body: { userId: user?.id, docType: slotId, filePath },
      })

      updateSlot(slotId, {
        status: scanError ? 'failed' : 'passed',
        feedback: scanError ? 'Scan failed. Please retry with a clearer image.' : undefined,
      })
    } catch {
      updateSlot(slotId, { status: 'failed', feedback: 'An error occurred. Please try again.' })
    }
  }

  const requiredSlots = slots.filter((s) => s.required)
  const allRequiredPassed = requiredSlots.every((s) => s.status === 'passed')
  const anyFailed = slots.some((s) => s.status === 'failed')

  const handleSubmit = async () => {
    if (!allRequiredPassed) {
      Alert.alert('Required documents', 'Please upload all required documents before continuing.')
      return
    }

    setIsSubmitting(true)
    try {
      if (user?.id) {
        await supabase.from('candidate_profiles').update({
          documents_submitted: true,
          verification_status: 'documents_submitted',
        }).eq('id', user.id)
      }
      router.push('/(onboarding)/candidate/profile-setup')
    } catch {
      Alert.alert('Error', 'Could not save progress. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Pressable onPress={() => router.back()} className="mt-6 mb-6">
          <Text className="text-primary-400 text-base">← Back</Text>
        </Pressable>

        {/* Progress bar — all 5 filled */}
        <View className="flex-row items-center gap-1 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: '#FF6240',
              }}
            />
          ))}
        </View>
        <Text className="text-slate-500 text-xs mb-8">Step 5 of {TOTAL_STEPS}</Text>

        <Animated.View entering={FadeInDown.duration(400)}>
          <Text
            style={{
              color: '#1A1625',
              fontSize: 24,
              fontWeight: '700',
              letterSpacing: -0.3,
              marginBottom: 6,
            }}
          >
            Upload documents
          </Text>
          <Text className="text-slate-400 text-sm leading-5 mb-8">
            Upload clear, legible photos or scans. Accepted formats: PDF, JPG, PNG — max 10 MB.
          </Text>

          {slots.map((slot) => {
            const isActive = slot.status === 'uploading' || slot.status === 'scanning'
            const borderColor = statusColor(slot.status)

            return (
              <Pressable
                key={slot.id}
                onPress={() => !isActive && handlePickDocument(slot.id)}
                disabled={isActive}
                className="mb-4 rounded-2xl border p-5"
                style={{
                  backgroundColor: '#EDE7DB',
                  borderColor,
                  opacity: isActive ? 0.85 : 1,
                }}
              >
                <View className="flex-row items-center gap-3 mb-2">
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor:
                        slot.status === 'passed'
                          ? '#22C55E20'
                          : slot.status === 'failed'
                          ? '#EF444420'
                          : '#3D385020',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {slot.status === 'passed' ? (
                      <Text style={{ color: '#22C55E', fontSize: 18 }}>✓</Text>
                    ) : slot.status === 'failed' ? (
                      <Text style={{ color: '#EF4444', fontSize: 18 }}>✕</Text>
                    ) : isActive ? (
                      <ActivityIndicator color="#FF6240" size="small" />
                    ) : slot.fileName ? (
                      <FileIcon color="#FF6240" />
                    ) : (
                      <UploadIcon color="#64748B" />
                    )}
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[#1A1625] text-sm font-semibold">{slot.label}</Text>
                      {slot.required && (
                        <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700' }}>Required</Text>
                      )}
                    </View>
                    <Text className="text-slate-500 text-xs mt-0.5">{slot.description}</Text>
                  </View>
                </View>

                {slot.fileName && (
                  <View className="flex-row items-center gap-2 mt-1 mb-1">
                    <FileIcon color="#64748B" />
                    <Text className="text-slate-400 text-xs flex-1" numberOfLines={1}>
                      {slot.fileName}
                    </Text>
                  </View>
                )}

                <Text
                  style={{
                    color: statusColor(slot.status),
                    fontSize: 12,
                    fontWeight: slot.status !== 'idle' ? '500' : '400',
                  }}
                >
                  {statusLabel(slot.status)}
                </Text>

                {slot.feedback && (
                  <View
                    className="mt-2 rounded-xl px-3 py-2"
                    style={{ backgroundColor: '#EF444415' }}
                  >
                    <Text style={{ color: '#EF4444', fontSize: 12, lineHeight: 16 }}>
                      {slot.feedback}
                    </Text>
                  </View>
                )}

                {(slot.status === 'failed' || slot.status === 'idle' || slot.status === 'passed') && (
                  <View className="flex-row justify-end mt-2">
                    <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '500' }}>
                      {slot.status === 'passed' ? 'Replace file' : 'Upload file →'}
                    </Text>
                  </View>
                )}
              </Pressable>
            )
          })}

          <View
            className="rounded-xl px-4 py-3 mb-8 flex-row items-start gap-2"
            style={{ backgroundColor: '#0DD4C315', borderWidth: 1, borderColor: '#0DD4C330' }}
          >
            <Text style={{ color: '#0DD4C3', fontSize: 13, marginTop: 1 }}>🔒</Text>
            <Text style={{ color: '#0DD4C3', fontSize: 13, flex: 1, lineHeight: 18 }}>
              Documents are encrypted at rest. Access is restricted to your recruiter and our
              verification team under NDPR compliance.
            </Text>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={!allRequiredPassed || isSubmitting}
            className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
            style={{ opacity: !allRequiredPassed || isSubmitting ? 0.4 : 1 }}
          >
            <Text className="text-[#1A1625] font-semibold text-base">
              {isSubmitting ? 'Saving…' : 'Continue to profile setup'}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}
