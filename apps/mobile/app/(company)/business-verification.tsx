import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface VerificationRow {
  documents_status: string
  address_proof_url: string | null
  address_proof_document_date: string | null
  office_video_url: string | null
  documents_reviewed_at: string | null
  documents_rejection_reason: string | null
}

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function CheckCircle({ color = '#22C55E' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  )
}

function LockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#5A4F6E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 10V7a6 6 0 1 1 12 0v3" />
      <Path d="M5 10h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V10z" />
    </Svg>
  )
}

function UploadIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#5A4F6E" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5M12 3v12" />
    </Svg>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BusinessVerificationScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [addressDocUri, setAddressDocUri] = useState<string | null>(null)
  const [addressDocName, setAddressDocName] = useState<string | null>(null)
  const [documentDate, setDocumentDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [videoUri, setVideoUri] = useState<string | null>(null)
  const [videoName, setVideoName] = useState<string | null>(null)

  const { data: verification, isLoading } = useQuery({
    queryKey: ['business-verification', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_verification')
        .select('documents_status, address_proof_url, address_proof_document_date, office_video_url, documents_reviewed_at, documents_rejection_reason')
        .eq('company_id', user!.id)
        .maybeSingle()
      return (data as VerificationRow | null) ?? null
    },
    enabled: !!user?.id,
  })

  const isLocked = verification?.documents_status === 'approved'
  const isInReview = verification?.documents_status === 'in_review'

  const isDocumentTooOld = documentDate ? (Date.now() - documentDate.getTime()) > SIX_MONTHS_MS : false

  async function pickAddressDoc() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.[0]) return
    setAddressDocUri(result.assets[0].uri)
    setAddressDocName(result.assets[0].name)
  }

  async function pickVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow access to your video library to upload the office video.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 240,
      quality: 0.7,
    })
    if (result.canceled || !result.assets?.[0]) return
    setVideoUri(result.assets[0].uri)
    setVideoName(result.assets[0].fileName ?? 'office-video.mp4')
  }

  async function uploadFile(uri: string, keyPrefix: string, contentType: string): Promise<string> {
    const fileExt = uri.split('.').pop() ?? 'dat'
    const filePath = `${user?.id}/${keyPrefix}_${Date.now()}.${fileExt}`
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
    const binaryStr = atob(base64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

    const { error } = await supabase.storage.from('company-docs').upload(filePath, bytes, { contentType, upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('company-docs').getPublicUrl(filePath)
    return data.publicUrl
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!addressDocUri || !documentDate || !videoUri) throw new Error('Please add the address document, its date, and the office video.')
      if (isDocumentTooOld) throw new Error('The address document must not be older than 6 months.')

      const addressProofUrl = await uploadFile(addressDocUri, 'address_proof', 'application/pdf')
      const officeVideoUrl = await uploadFile(videoUri, 'office_video', 'video/mp4')

      const { error } = await supabase.from('company_verification').upsert({
        company_id: user!.id,
        documents_status: 'in_review',
        address_proof_url: addressProofUrl,
        address_proof_document_date: documentDate.toISOString().slice(0, 10),
        office_video_url: officeVideoUrl,
        documents_reviewer_id: null,
        documents_reviewed_at: null,
        documents_rejection_reason: null,
      }, { onConflict: 'company_id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-verification', user?.id] })
      Alert.alert('Submitted', 'Your business verification has been sent to our team for review.')
    },
    onError: (err: unknown) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not submit. Please try again.')
    },
  })

  const canSubmit = !!addressDocUri && !!documentDate && !isDocumentTooOld && !!videoUri && !isLocked

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-4 border-b border-surface-border">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <Text className="text-[#1A1625] text-2xl font-bold flex-1">Business Verification</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingVertical: 20 }}>
        {isLoading ? (
          <ActivityIndicator color="#FF6240" style={{ marginTop: 40 }} />
        ) : (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={{ backgroundColor: '#0DD4C310', borderRadius: 12, borderWidth: 1, borderColor: '#0DD4C330', padding: 12, marginBottom: 20 }}>
              <Text style={{ color: '#0DD4C3', fontSize: 12, fontWeight: '600', lineHeight: 18 }}>
                Optional — only needed if you want to post on-site or hybrid jobs, or invite candidates for in-person interviews. Remote-only companies can skip this entirely.
              </Text>
            </View>

            {isLocked && (
              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#22C55E40', padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <CheckCircle />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700' }}>Business address verified</Text>
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                    {verification?.documents_reviewed_at ? `Approved ${formatDate(verification.documents_reviewed_at)}. ` : ''}
                    Your address is now locked on your profile and can't be resubmitted here.
                  </Text>
                </View>
              </View>
            )}

            {isInReview && (
              <View style={{ backgroundColor: '#F59E0B10', borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B30', padding: 12, marginBottom: 20 }}>
                <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>
                  Submitted — our team is reviewing your documents. This usually takes 1-2 business days.
                </Text>
              </View>
            )}

            {verification?.documents_status === 'rejected' && (
              <View style={{ backgroundColor: '#EF444410', borderRadius: 12, borderWidth: 1, borderColor: '#EF444430', padding: 12, marginBottom: 20 }}>
                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Not approved</Text>
                <Text style={{ color: '#EF4444', fontSize: 12 }}>
                  {verification.documents_rejection_reason || 'Please review and resubmit your documents.'}
                </Text>
              </View>
            )}

            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>PROOF OF BUSINESS ADDRESS</Text>
            <Text style={{ color: '#9A8FA6', fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
              A utility bill, bank statement, tenancy agreement, or property deed showing your business name/address — not older than 6 months.
            </Text>
            <Pressable
              onPress={isLocked ? undefined : pickAddressDoc}
              disabled={isLocked}
              style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1.5, borderColor: addressDocUri ? '#22C55E40' : '#DDD6C9', padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: isLocked ? 0.6 : 1 }}
            >
              {addressDocUri ? <CheckCircle /> : <UploadIcon />}
              <Text style={{ color: '#1A1625', fontSize: 13, flex: 1 }} numberOfLines={1}>
                {addressDocName ?? verification?.address_proof_url?.split('/').pop() ?? 'Tap to upload document'}
              </Text>
            </Pressable>

            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>DATE ON THE DOCUMENT</Text>
            <Pressable
              onPress={isLocked ? undefined : () => setShowDatePicker(true)}
              disabled={isLocked}
              style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', padding: 14, marginBottom: 8, opacity: isLocked ? 0.6 : 1 }}
            >
              <Text style={{ color: documentDate ? '#1A1625' : '#475569', fontSize: 14 }}>
                {documentDate ? formatDate(documentDate.toISOString()) : (verification?.address_proof_document_date ? formatDate(verification.address_proof_document_date) : 'Select date')}
              </Text>
            </Pressable>
            {isDocumentTooOld && (
              <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>This document is older than 6 months — please upload a more recent one.</Text>
            )}
            {showDatePicker && (
              <DateTimePicker
                value={documentDate ?? new Date()}
                mode="date"
                maximumDate={new Date()}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  setShowDatePicker(Platform.OS === 'ios')
                  if (date) setDocumentDate(date)
                }}
              />
            )}

            <View style={{ height: 8 }} />

            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 16 }}>OFFICE WALKTHROUGH VIDEO</Text>
            <Text style={{ color: '#9A8FA6', fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
              A 2-3 minute video showing your actual office space where a candidate would work.
            </Text>
            <Pressable
              onPress={isLocked ? undefined : pickVideo}
              disabled={isLocked}
              style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1.5, borderColor: videoUri ? '#22C55E40' : '#DDD6C9', padding: 16, marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: isLocked ? 0.6 : 1 }}
            >
              {videoUri ? <CheckCircle /> : <UploadIcon />}
              <Text style={{ color: '#1A1625', fontSize: 13, flex: 1 }} numberOfLines={1}>
                {videoName ?? (verification?.office_video_url ? 'Video already submitted' : 'Tap to upload video')}
              </Text>
            </Pressable>

            {!isLocked && (
              <Pressable
                onPress={() => submitMutation.mutate()}
                disabled={!canSubmit || submitMutation.isPending}
                style={{ backgroundColor: canSubmit ? '#FF6240' : '#DDD6C9', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
              >
                {submitMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: canSubmit ? '#1A1625' : '#475569', fontWeight: '700', fontSize: 15 }}>Submit for review</Text>
                )}
              </Pressable>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <LockIcon />
              <Text style={{ color: '#334155', fontSize: 11, textAlign: 'center' }}>
                Once approved, this address is locked — it's what we send to candidates for in-person interviews.
              </Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
