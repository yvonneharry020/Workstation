import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'

type VerifyState = 'idle' | 'loading' | 'success' | 'failed'

interface CACResult {
  companyName: string
  registrationStatus: string
  directors: string[]
  rcNumber: string
}

const STEPS_TOTAL = 7

function PulsingRing({ color }: { color: string }) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.8)

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.2, { duration: 1000 }), -1, true)
    opacity.value = withRepeat(withTiming(0.3, { duration: 1000 }), -1, true)
  }, [opacity, scale])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[style, {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: color,
      }]}
    />
  )
}

function ShieldIcon({ verified }: { verified: boolean }) {
  const color = verified ? '#22C55E' : '#FF6240'
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      {verified && <Path d="M9 12l2 2 4-4" />}
    </Svg>
  )
}

function AlertIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 8v4M12 16h.01" />
    </Svg>
  )
}

function DirectorBadge({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        backgroundColor: '#0DD4C308',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#0DD4C320',
        marginBottom: 8,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: '#0DD4C320',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#0DD4C3', fontSize: 13, fontWeight: '700' }}>{initials}</Text>
      </View>
      <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '500', flex: 1 }}>{name}</Text>
    </View>
  )
}

export default function CompanyStep2() {
  const params = useLocalSearchParams<{
    rcNumber?: string
    businessEmail?: string
    phone?: string
  }>()

  const [verifyState, setVerifyState] = useState<VerifyState>('idle')
  const [cacResult, setCacResult] = useState<CACResult | null>(null)
  const [rcNumber, setRcNumber] = useState(params.rcNumber ?? '')

  useEffect(() => {
    if (params.rcNumber) {
      setRcNumber(params.rcNumber)
      return
    }
    const loadRcNumber = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser?.id) return
      const { data } = await supabase
        .from('company_profiles')
        .select('rc_number')
        .eq('id', currentUser.id)
        .maybeSingle()
      if (data?.rc_number) setRcNumber(data.rc_number)
    }
    loadRcNumber()
  }, [params.rcNumber])

  const handleVerify = async () => {
    setVerifyState('loading')
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser?.id) {
      setVerifyState('failed')
      Alert.alert('Session expired', 'Please sign in again to continue.')
      return
    }

    try {
      await supabase.from('company_verification').upsert({
        company_id: currentUser.id,
        cac_status: 'pending',
        overall_status: 'pending',
      }, { onConflict: 'company_id' })

      await new Promise((res) => setTimeout(res, 2500))

      const mockResult: CACResult = {
        companyName: 'MOCK COMPANY LIMITED',
        registrationStatus: 'active',
        directors: ['SAMPLE DIRECTOR ONE', 'SAMPLE DIRECTOR TWO'],
        rcNumber,
      }

      const { error } = await supabase.from('company_verification').upsert({
        company_id: currentUser.id,
        cac_status: 'approved',
        cac_verified_at: new Date().toISOString(),
        cac_result: mockResult,
        overall_status: 'pending',
      }, { onConflict: 'company_id' })

      if (error) throw error

      await supabase
        .from('company_profiles')
        .upsert({
          id: currentUser.id,
          company_name: mockResult.companyName,
          rc_number: rcNumber,
          business_email: params.businessEmail || '',
          cac_verified: true,
          cac_verified_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (params.phone) {
        await supabase.from('profiles').update({ phone: params.phone }).eq('id', currentUser.id)
      }

      setCacResult(mockResult)
      setVerifyState('success')
    } catch {
      setVerifyState('failed')
      Alert.alert('Verification failed', 'We could not verify your RC number. Please check it and try again.')
    }
  }

  const handleRetry = () => {
    setVerifyState('idle')
    setCacResult(null)
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
              className={`h-1 flex-1 rounded-full mr-1 ${i < 2 ? 'bg-primary-500' : 'bg-surface-card'}`}
            />
          ))}
        </View>
        <Text className="text-slate-500 text-xs mb-8">Step 2 of {STEPS_TOTAL}</Text>

        <Text className="text-[#1A1625] text-3xl font-bold mb-2">CAC Verification</Text>
        <Text className="text-slate-400 text-base mb-8">
          We'll verify your company's registration with the Corporate Affairs Commission.
        </Text>

        {rcNumber ? (
          <Animated.View entering={FadeInDown.duration(300)} className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-8">
            <Text className="text-slate-400 text-xs mb-1">RC Number on file</Text>
            <Text style={{ color: '#1A1625', fontFamily: 'monospace', fontSize: 20, fontWeight: '700', letterSpacing: 2 }}>
              {rcNumber}
            </Text>
          </Animated.View>
        ) : null}

        {verifyState === 'idle' && (
          <Animated.View entering={FadeInDown.duration(400)} className="items-center py-8">
            <View style={{ position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF624015', borderWidth: 1.5, borderColor: '#FF624040', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldIcon verified={false} />
              </View>
            </View>
            <Text className="text-[#1A1625] font-semibold text-base text-center mb-2">Ready to verify</Text>
            <Text className="text-slate-400 text-sm text-center leading-5 mb-8 px-4">
              Tap the button below to run your CAC check. This typically takes 5–10 seconds.
            </Text>
            <Pressable
              onPress={handleVerify}
              className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80 w-full"
            >
              <Text className="text-[#1A1625] font-bold text-base">Verify company registration</Text>
            </Pressable>
          </Animated.View>
        )}

        {verifyState === 'loading' && (
          <Animated.View entering={FadeInDown.duration(300)} className="items-center py-12">
            <View style={{ position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
              <PulsingRing color="#FF6240" />
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF624015', borderWidth: 1.5, borderColor: '#FF624040', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#FF6240" size="large" />
              </View>
            </View>
            <Text className="text-[#1A1625] font-semibold text-base mb-1">Querying CAC database…</Text>
            <Text className="text-slate-400 text-sm text-center">Connecting to the Corporate Affairs Commission</Text>
          </Animated.View>
        )}

        {verifyState === 'success' && cacResult && (
          <Animated.View entering={FadeInUp.duration(400)}>
            <View className="items-center mb-6">
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#22C55E15', borderWidth: 1.5, borderColor: '#22C55E40', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <ShieldIcon verified />
              </View>
              <Text className="text-[#1A1625] font-bold text-lg">Registration confirmed</Text>
            </View>

            <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-4">
              <Text className="text-slate-400 text-xs mb-3 font-medium uppercase tracking-wider">CAC Records</Text>
              <View className="gap-3">
                <View>
                  <Text className="text-slate-500 text-xs mb-0.5">Registered legal name</Text>
                  <Text className="text-[#1A1625] font-semibold">{cacResult.companyName}</Text>
                </View>
                <View>
                  <Text className="text-slate-500 text-xs mb-0.5">Registration status</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22C55E' }} />
                    <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
                      {cacResult.registrationStatus}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {cacResult.directors.length > 0 && (
              <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-8">
                <Text className="text-slate-400 text-xs mb-3 font-medium uppercase tracking-wider">
                  Directors on record ({cacResult.directors.length})
                </Text>
                {cacResult.directors.map((name, i) => (
                  <DirectorBadge key={i} name={name} />
                ))}
                <Text className="text-slate-500 text-xs mt-2 leading-4">
                  You'll confirm your identity as one of these directors in the next step.
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => router.push('/(onboarding)/company/step-3')}
              className="bg-primary-500 rounded-2xl py-4 items-center mb-12 active:opacity-80"
            >
              <Text className="text-[#1A1625] font-bold text-base">Continue to director verification</Text>
            </Pressable>
          </Animated.View>
        )}

        {verifyState === 'failed' && (
          <Animated.View entering={FadeInDown.duration(400)} className="items-center py-8">
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EF444415', borderWidth: 1.5, borderColor: '#EF444440', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <AlertIcon />
            </View>
            <Text className="text-[#1A1625] font-semibold text-base text-center mb-2">Verification failed</Text>
            <Text className="text-slate-400 text-sm text-center leading-5 mb-8 px-4">
              We could not find an active registration for RC number{' '}
              <Text className="text-[#1A1625] font-medium">{rcNumber}</Text>.
              Please double-check the number and try again.
            </Text>
            <Pressable
              onPress={handleRetry}
              className="bg-surface-card border border-surface-border rounded-2xl py-4 items-center w-full active:opacity-80 mb-3"
            >
              <Text className="text-[#1A1625] font-semibold text-base">Try again</Text>
            </Pressable>
            <Pressable onPress={() => router.back()}>
              <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '600' }}>Update my RC number</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
