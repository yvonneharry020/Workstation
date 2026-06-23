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
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle, Rect } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const STEPS_TOTAL = 7

type ConnectionState = 'disconnected' | 'connecting' | 'connected'

function GmailIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect width={24} height={24} rx={4} fill="#EA4335" opacity={0.15} />
      <Path d="M20 8l-8 5-8-5V18h16V8z" stroke="#EA4335" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 8l8 5 8-5" stroke="#EA4335" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function OutlookIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect width={24} height={24} rx={4} fill="#0072C6" opacity={0.15} />
      <Path d="M20 8l-8 5-8-5V18h16V8z" stroke="#0072C6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 8l8 5 8-5" stroke="#0072C6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function CheckIcon({ color = '#22C55E' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  )
}

function InfoIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 8h.01M12 12v4" />
    </Svg>
  )
}

function EmailProviderCard({
  provider,
  icon,
  accentColor,
  accountName,
  connectionState,
  onConnect,
  onDisconnect,
}: {
  provider: string
  icon: React.ReactNode
  accentColor: string
  accountName: string | null
  connectionState: ConnectionState
  onConnect: () => void
  onDisconnect: () => void
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      style={{
        backgroundColor: '#131118',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: connectionState === 'connected' ? `${accentColor}40` : '#1E1B2E',
        padding: 16,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{provider}</Text>
          {connectionState === 'connected' && accountName && (
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {accountName}
            </Text>
          )}
          {connectionState === 'disconnected' && (
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>Not connected</Text>
          )}
          {connectionState === 'connecting' && (
            <Text style={{ color: accentColor, fontSize: 12, marginTop: 2 }}>Connecting…</Text>
          )}
        </View>

        {connectionState === 'connected' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: '#22C55E20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <CheckIcon />
              <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '600' }}>Connected</Text>
            </View>
            <Pressable
              onPress={onDisconnect}
              style={{ backgroundColor: '#1E1B2E', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
              className="active:opacity-70"
            >
              <Text style={{ color: '#94A3B8', fontSize: 12 }}>Remove</Text>
            </Pressable>
          </View>
        ) : connectionState === 'connecting' ? (
          <ActivityIndicator color={accentColor} size="small" />
        ) : (
          <Pressable
            onPress={onConnect}
            style={{
              backgroundColor: `${accentColor}15`,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: `${accentColor}30`,
            }}
            className="active:opacity-70"
          >
            <Text style={{ color: accentColor, fontSize: 13, fontWeight: '600' }}>Connect</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  )
}

export default function CompanyStep6() {
  const user = useAuthStore((s) => s.user)
  const [gmailState, setGmailState] = useState<ConnectionState>('disconnected')
  const [gmailAccount, setGmailAccount] = useState<string | null>(null)
  const [outlookState, setOutlookState] = useState<ConnectionState>('disconnected')
  const [outlookAccount, setOutlookAccount] = useState<string | null>(null)
  const [isSkipping, setIsSkipping] = useState(false)

  const handleConnectGmail = async () => {
    setGmailState('connecting')
    await new Promise((res) => setTimeout(res, 1500))
    Alert.alert(
      'Gmail OAuth',
      "In production, this opens the Gmail OAuth consent screen. For now we'll simulate a successful connection.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setGmailState('disconnected') },
        {
          text: 'Simulate Connect',
          onPress: async () => {
            const mockEmail = user?.email?.replace('@', '+gmail@') ?? 'company@gmail.com'
            await supabase
              .from('company_profiles')
              .update({ gmail_connected: true, gmail_account: mockEmail })
              .eq('id', user!.id)
            setGmailAccount(mockEmail)
            setGmailState('connected')
          },
        },
      ],
    )
  }

  const handleDisconnectGmail = () => {
    setGmailState('disconnected')
    setGmailAccount(null)
    supabase
      .from('company_profiles')
      .update({ gmail_connected: false, gmail_account: null })
      .eq('id', user?.id ?? '')
  }

  const handleConnectOutlook = async () => {
    setOutlookState('connecting')
    await new Promise((res) => setTimeout(res, 1500))
    Alert.alert(
      'Outlook OAuth',
      "In production, this opens the Microsoft OAuth consent screen. For now we'll simulate a successful connection.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setOutlookState('disconnected') },
        {
          text: 'Simulate Connect',
          onPress: async () => {
            const mockEmail = user?.email?.replace('@', '+outlook@') ?? 'company@outlook.com'
            await supabase
              .from('company_profiles')
              .update({ outlook_connected: true, outlook_account: mockEmail })
              .eq('id', user!.id)
            setOutlookAccount(mockEmail)
            setOutlookState('connected')
          },
        },
      ],
    )
  }

  const handleDisconnectOutlook = () => {
    setOutlookState('disconnected')
    setOutlookAccount(null)
    supabase
      .from('company_profiles')
      .update({ outlook_connected: false, outlook_account: null })
      .eq('id', user?.id ?? '')
  }

  const handleSkip = async () => {
    setIsSkipping(true)
    await new Promise((res) => setTimeout(res, 300))
    setIsSkipping(false)
    router.push('/(onboarding)/company/pending')
  }

  const handleContinue = () => {
    router.push('/(onboarding)/company/pending')
  }

  const hasConnection = gmailState === 'connected' || outlookState === 'connected'

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} className="mt-6 mb-8">
          <Text className="text-primary-400 text-base">← Back</Text>
        </Pressable>

        <View className="flex-row items-center mb-2">
          {Array.from({ length: STEPS_TOTAL }).map((_, i) => (
            <View
              key={i}
              className={`h-1 flex-1 rounded-full mr-1 ${i < 6 ? 'bg-primary-500' : 'bg-surface-card'}`}
            />
          ))}
        </View>
        <Text className="text-slate-500 text-xs mb-8">Step 6 of {STEPS_TOTAL}</Text>

        <Text className="text-white text-3xl font-bold mb-2">Email integration</Text>
        <Text className="text-slate-400 text-base mb-8">
          Connect your company email to send application notifications directly from your own domain.
        </Text>

        <View className="mb-6">
          <EmailProviderCard
            provider="Gmail / Google Workspace"
            icon={<GmailIcon />}
            accentColor="#EA4335"
            accountName={gmailAccount}
            connectionState={gmailState}
            onConnect={handleConnectGmail}
            onDisconnect={handleDisconnectGmail}
          />
          <EmailProviderCard
            provider="Outlook / Microsoft 365"
            icon={<OutlookIcon />}
            accentColor="#0072C6"
            accountName={outlookAccount}
            connectionState={outlookState}
            onConnect={handleConnectOutlook}
            onDisconnect={handleDisconnectOutlook}
          />
        </View>

        <View
          className="rounded-2xl p-4 mb-8"
          style={{ backgroundColor: '#0DD4C308', borderWidth: 1, borderColor: '#0DD4C320' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
            <InfoIcon />
            <Text style={{ color: '#0DD4C3', fontSize: 12, fontWeight: '600', flex: 1 }}>Why connect email?</Text>
          </View>
          <Text className="text-slate-400 text-xs leading-5">
            • Application notifications send from your company address, not a generic platform email{'\n'}
            • Candidates see a professional email — increasing response rates{'\n'}
            • Track which candidates open your emails directly in the ATS{'\n'}
            • You can skip this now and connect later from Settings
          </Text>
        </View>

        {hasConnection ? (
          <Pressable
            onPress={handleContinue}
            className="bg-primary-500 rounded-2xl py-4 items-center mb-4 active:opacity-80"
          >
            <Text className="text-white font-bold text-base">Continue with connected email</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleSkip}
          disabled={isSkipping}
          className="bg-surface-card border border-surface-border rounded-2xl py-4 items-center mb-12 active:opacity-80"
        >
          {isSkipping ? (
            <ActivityIndicator color="#94A3B8" size="small" />
          ) : (
            <Text className="text-slate-300 font-semibold text-base">
              {hasConnection ? 'Skip for now' : 'Skip — connect email later'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
