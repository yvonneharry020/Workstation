import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Input as FormInput } from '@/components/ui/Input'

const schema = z.object({
  nin: z
    .string()
    .length(11, 'NIN must be exactly 11 digits')
    .regex(/^\d{11}$/, 'NIN must contain only digits'),
})

type FormData = z.infer<typeof schema>

const STEPS_TOTAL = 7

type VerifyState = 'idle' | 'loading' | 'success' | 'mismatch'

function UserIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  )
}

function CheckIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  )
}

function AlertIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 8v4M12 16h.01" />
    </Svg>
  )
}

function DirectorOption({
  name,
  selected,
  onSelect,
}: {
  name: string
  selected: boolean
  onSelect: () => void
}) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <Pressable
      onPress={onSelect}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        backgroundColor: selected ? '#FF624015' : '#EDE7DB',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: selected ? '#FF6240' : '#DDD6C9',
        marginBottom: 8,
      }}
      className="active:opacity-80"
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: selected ? '#FF624025' : '#DDD6C9',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: selected ? '#FF6240' : '#64748B', fontSize: 13, fontWeight: '700' }}>
          {initials}
        </Text>
      </View>
      <Text style={{ flex: 1, color: selected ? '#1A1625' : '#5A4F6E', fontSize: 14, fontWeight: '500' }}>
        {name}
      </Text>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: selected ? '#FF6240' : 'transparent',
          borderWidth: 2,
          borderColor: selected ? '#FF6240' : '#334155',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && (
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M20 6L9 17l-5-5" />
          </Svg>
        )}
      </View>
    </Pressable>
  )
}

export default function CompanyStep3() {
  const user = useAuthStore((s) => s.user)
  const [directors, setDirectors] = useState<string[]>([])
  const [selectedDirector, setSelectedDirector] = useState<string | null>(null)
  const [verifyState, setVerifyState] = useState<VerifyState>('idle')

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nin: '' },
  })

  useEffect(() => {
    const loadDirectors = async () => {
      if (!user?.id) return
      const { data } = await supabase
        .from('company_verification')
        .select('cac_result')
        .eq('company_id', user.id)
        .maybeSingle()
      if (data?.cac_result) {
        const result = data.cac_result as { directors?: string[] }
        setDirectors(result.directors ?? [])
      }
    }
    loadDirectors()
  }, [user?.id])

  const handleVerify = async (formData: FormData) => {
    if (!selectedDirector) {
      Alert.alert('Select yourself', 'Please select which director you are before submitting.')
      return
    }
    if (!user?.id) return
    setVerifyState('loading')

    try {
      await new Promise((res) => setTimeout(res, 2000))

      const { error } = await supabase.from('company_verification').upsert({
        company_id: user.id,
        director_nin_status: 'approved',
        director_nin_verified_at: new Date().toISOString(),
        director_nin_provider_ref: `NIN-${formData.nin.slice(0, 4)}-MOCK`,
      }, { onConflict: 'company_id' })

      if (error) throw error

      await supabase
        .from('company_profiles')
        .update({ director_nin_verified: true })
        .eq('id', user.id)

      setVerifyState('success')
    } catch {
      Alert.alert('Verification error', 'Something went wrong. Please try again.')
      setVerifyState('idle')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
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
                className={`h-1 flex-1 rounded-full mr-1 ${i < 3 ? 'bg-primary-500' : 'bg-surface-card'}`}
              />
            ))}
          </View>
          <Text className="text-slate-500 text-xs mb-8">Step 3 of {STEPS_TOTAL}</Text>

          {verifyState !== 'success' ? (
            <>
              <Text className="text-[#1A1625] text-3xl font-bold mb-2">Director identity</Text>
              <Text className="text-slate-400 text-base mb-8">
                Confirm you are one of the directors registered with the CAC.
              </Text>

              {directors.length > 0 && (
                <View className="mb-6">
                  <Text className="text-slate-300 font-semibold text-sm mb-3">
                    Select which director you are
                  </Text>
                  {directors.map((name) => (
                    <DirectorOption
                      key={name}
                      name={name}
                      selected={selectedDirector === name}
                      onSelect={() => setSelectedDirector(name)}
                    />
                  ))}
                </View>
              )}

              {directors.length === 0 && (
                <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-6 items-center">
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF624015', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <UserIcon />
                  </View>
                  <Text className="text-slate-400 text-sm text-center">Loading director list…</Text>
                </View>
              )}

              <View className="mb-4">
                <Text className="text-slate-300 font-semibold text-sm mb-3">
                  Your National Identification Number (NIN)
                </Text>
                <Controller
                  control={control}
                  name="nin"
                  render={({ field: { onChange, value } }) => (
                    <FormInput
                      label="NIN (11 digits)"
                      placeholder="12345678901"
                      value={value}
                      onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 11))}
                      error={errors.nin?.message}
                      keyboardType="number-pad"
                    />
                  )}
                />
              </View>

              <View
                className="rounded-2xl p-4 mb-8"
                style={{ backgroundColor: '#FF624008', borderWidth: 1, borderColor: '#FF624020' }}
              >
                <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                  Why we need your NIN
                </Text>
                <Text className="text-slate-400 text-xs leading-4">
                  Your NIN is cross-referenced against the CAC director list to confirm you are authorised to act for this company. We do not store your NIN — only the verification outcome.
                </Text>
              </View>

              <Pressable
                onPress={handleSubmit(handleVerify)}
                disabled={verifyState === 'loading' || !selectedDirector}
                className={`rounded-2xl py-4 items-center mb-12 ${verifyState === 'loading' || !selectedDirector ? 'bg-primary-800' : 'bg-primary-500 active:opacity-80'}`}
              >
                {verifyState === 'loading' ? (
                  <View className="flex-row items-center gap-3">
                    <ActivityIndicator color="#fff" size="small" />
                    <Text className="text-[#1A1625] font-bold text-base">Verifying identity…</Text>
                  </View>
                ) : (
                  <Text className="text-[#1A1625] font-bold text-base">Verify my identity</Text>
                )}
              </Pressable>
            </>
          ) : (
            <Animated.View entering={FadeInUp.duration(400)} className="items-center py-8">
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#22C55E15', borderWidth: 1.5, borderColor: '#22C55E40', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <CheckIcon />
              </View>
              <Text className="text-[#1A1625] font-bold text-xl mb-2">Identity confirmed</Text>
              <Text className="text-slate-400 text-sm text-center leading-5 mb-8 px-4">
                We've confirmed you are <Text className="text-[#1A1625] font-medium">{selectedDirector}</Text>, an authorised director of this company.
              </Text>

              <View
                className="rounded-2xl p-4 mb-8 w-full"
                style={{ backgroundColor: '#22C55E10', borderWidth: 1, borderColor: '#22C55E30' }}
              >
                <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
                  Director NIN verified +20 Trust Score
                </Text>
                <Text className="text-slate-400 text-xs leading-4">
                  This verification has been recorded. Your company's Trust Score has increased.
                </Text>
              </View>

              <Pressable
                onPress={() => router.push('/(onboarding)/company/step-4')}
                className="bg-primary-500 rounded-2xl py-4 items-center w-full active:opacity-80 mb-12"
              >
                <Text className="text-[#1A1625] font-bold text-base">Continue to document upload</Text>
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
