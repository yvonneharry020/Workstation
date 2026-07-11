import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const STEPS_TOTAL = 6

interface UploadedDoc {
  name: string
  size: number
  uri: string
  uploadedUrl: string | null
}

interface DocSlot {
  key: 'cac_cert' | 'scuml'
  label: string
  description: string
  required: boolean
  uploaded: UploadedDoc | null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

function UploadIcon({ color = '#5A4F6E' }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5M12 3v12" />
    </Svg>
  )
}

function FileIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
    </Svg>
  )
}

function CheckCircle() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  )
}

function TrashIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </Svg>
  )
}

function DocUploadCard({
  slot,
  onUpload,
  onRemove,
  isUploading,
}: {
  slot: DocSlot
  onUpload: (key: DocSlot['key']) => void
  onRemove: (key: DocSlot['key']) => void
  isUploading: boolean
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={{
        backgroundColor: '#EDE7DB',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: slot.uploaded ? '#22C55E40' : '#DDD6C9',
        padding: 16,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '600' }}>{slot.label}</Text>
            {slot.required && (
              <View style={{ backgroundColor: '#FF624020', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: '#FF6240', fontSize: 10, fontWeight: '700' }}>Required</Text>
              </View>
            )}
          </View>
          <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 16 }}>{slot.description}</Text>
        </View>
        {slot.uploaded && <CheckCircle />}
      </View>

      {slot.uploaded ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0DD4C308', borderRadius: 10, padding: 10 }}>
          <FileIcon />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1A1625', fontSize: 12, fontWeight: '500' }} numberOfLines={1}>
              {slot.uploaded.name}
            </Text>
            <Text style={{ color: '#64748B', fontSize: 11 }}>{formatBytes(slot.uploaded.size)}</Text>
          </View>
          <Pressable onPress={() => onRemove(slot.key)} hitSlop={10}>
            <TrashIcon />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => onUpload(slot.key)}
          disabled={isUploading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: '#334155',
            borderRadius: 10,
            borderStyle: 'dashed',
            paddingVertical: 14,
          }}
          className="active:opacity-70"
        >
          {isUploading ? (
            <ActivityIndicator color="#94A3B8" size="small" />
          ) : (
            <>
              <UploadIcon />
              <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '500' }}>Upload file</Text>
              <Text style={{ color: '#475569', fontSize: 11 }}>PDF, JPG, PNG</Text>
            </>
          )}
        </Pressable>
      )}
    </Animated.View>
  )
}

export default function CompanyStep4() {
  const user = useAuthStore((s) => s.user)
  const [uploadingKey, setUploadingKey] = useState<DocSlot['key'] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [docs, setDocs] = useState<Record<DocSlot['key'], UploadedDoc | null>>({
    cac_cert: null,
    scuml: null,
  })

  const SLOTS: DocSlot[] = [
    {
      key: 'cac_cert',
      label: 'CAC Certificate of Incorporation',
      description: 'The certificate issued by the Corporate Affairs Commission confirming your company\'s registration.',
      required: true,
      uploaded: docs.cac_cert,
    },
    {
      key: 'scuml',
      label: 'SCUML Certificate',
      description: 'Special Control Unit against Money Laundering certificate (if applicable to your business type).',
      required: false,
      uploaded: docs.scuml,
    },
  ]

  // Business address proof moved to its own screen (Settings → Business
  // Verification) — it's optional at onboarding since remote-only
  // companies never need it, and is only required later to post
  // on-site/hybrid jobs or invite candidates in person.

  const handleUpload = async (key: DocSlot['key']) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      })

      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      setUploadingKey(key)

      const fileExt = asset.name.split('.').pop() ?? 'pdf'
      const filePath = `${user?.id ?? 'unknown'}/${key}_${Date.now()}.${fileExt}`

      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' })
      const binaryStr = atob(base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

      const { error: uploadError } = await supabase.storage
        .from('company-docs')
        .upload(filePath, bytes, { contentType: asset.mimeType ?? 'application/pdf', upsert: true })

      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('company-docs').getPublicUrl(filePath)

      setDocs((prev) => ({
        ...prev,
        [key]: {
          name: asset.name,
          size: asset.size ?? 0,
          uri: asset.uri,
          uploadedUrl: publicData.publicUrl,
        },
      }))
    } catch {
      Alert.alert('Upload failed', 'Could not upload the file. Please check your connection and try again.')
    } finally {
      setUploadingKey(null)
    }
  }

  const handleRemove = (key: DocSlot['key']) => {
    setDocs((prev) => ({ ...prev, [key]: null }))
  }

  const canContinue = docs.cac_cert !== null

  const handleContinue = async () => {
    if (!user?.id || !canContinue) return
    setIsSubmitting(true)

    try {
      const { error } = await supabase.from('company_verification').upsert({
        company_id: user.id,
        cac_cert_url: docs.cac_cert?.uploadedUrl ?? null,
        scuml_url: docs.scuml?.uploadedUrl ?? null,
      }, { onConflict: 'company_id' })

      if (error) throw error

      router.push('/(onboarding)/company/step-5')
    } catch {
      Alert.alert('Error', 'Could not save your documents. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} className="mt-6 mb-8">
          <Text className="text-primary-400 text-base">← Back</Text>
        </Pressable>

        <View className="flex-row items-center mb-2">
          {Array.from({ length: STEPS_TOTAL }).map((_, i) => (
            <View
              key={i}
              className={`h-1 flex-1 rounded-full mr-1 ${i < 4 ? 'bg-primary-500' : 'bg-surface-card'}`}
            />
          ))}
        </View>
        <Text className="text-slate-500 text-xs mb-8">Step 4 of {STEPS_TOTAL}</Text>

        <Text className="text-[#1A1625] text-4xl font-bold mb-2">Business documents</Text>
        <Text className="text-slate-400 text-base mb-8">
          Upload the documents below. All files go through automated fraud detection before human review.
        </Text>

        {SLOTS.map((slot) => (
          <DocUploadCard
            key={slot.key}
            slot={slot}
            onUpload={handleUpload}
            onRemove={handleRemove}
            isUploading={uploadingKey === slot.key}
          />
        ))}

        <View
          className="rounded-2xl p-4 mb-8"
          style={{ backgroundColor: '#FF624008', borderWidth: 1, borderColor: '#FF624020' }}
        >
          <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
            Document guidelines
          </Text>
          <Text className="text-slate-400 text-xs leading-5">
            • Files must be clear and legible{'\n'}
            • Maximum file size: 10 MB per document{'\n'}
            • Accepted formats: PDF, JPG, PNG{'\n'}
            • Address proof must be dated within the last 3 months
          </Text>
        </View>

        <Pressable
          onPress={handleContinue}
          disabled={!canContinue || isSubmitting}
          className={`rounded-2xl py-4 items-center mb-12 ${canContinue && !isSubmitting ? 'bg-primary-500 active:opacity-80' : 'bg-primary-800'}`}
        >
          {isSubmitting ? (
            <View className="flex-row items-center gap-3">
              <ActivityIndicator color="#fff" size="small" />
              <Text className="text-[#1A1625] font-bold text-base">Saving…</Text>
            </View>
          ) : (
            <Text className={`font-bold text-base ${canContinue ? 'text-[#1A1625]' : 'text-slate-500'}`}>
              Continue to profile setup
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
