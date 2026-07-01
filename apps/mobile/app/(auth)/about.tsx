import { View, Text, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle, Rect } from 'react-native-svg'

function ShieldIcon({ size = 22, color = '#FF6240' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z"
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 12L11 14L15 10"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function PersonIcon({ color = '#FF6240' }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  )
}

function BuildingIcon({ color = '#0DD4C3' }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Path d="M3 9h18M9 21V9" />
    </Svg>
  )
}

function FileCheckIcon({ color = '#22C55E' }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M9 15l2 2 4-4" />
    </Svg>
  )
}

function TrendIcon({ color = '#F59E0B' }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 6l-9.5 9.5-5-5L1 18" />
      <Path d="M17 6h6v6" />
    </Svg>
  )
}

type Step = {
  number: string
  icon: React.ReactNode
  title: string
  desc: string
  forCandidate: boolean
}

const CANDIDATE_STEPS: Step[] = [
  {
    number: '01',
    icon: <PersonIcon color="#FF6240" />,
    title: 'Create your profile',
    desc: 'Sign up with your email. Your NIN verification happens automatically — just enter your number and complete a quick liveness check.',
    forCandidate: true,
  },
  {
    number: '02',
    icon: <FileCheckIcon color="#22C55E" />,
    title: 'Build your trust score',
    desc: 'Upload your academic certificates and employment history. Our system checks them and builds your verified profile. Companies see your real score.',
    forCandidate: true,
  },
  {
    number: '03',
    icon: <BuildingIcon color="#0DD4C3" />,
    title: 'Apply with confidence',
    desc: 'Browse jobs at CAC-verified companies. Apply knowing the company is real — and they know you are too. No more fake job offers.',
    forCandidate: true,
  },
  {
    number: '04',
    icon: <TrendIcon color="#F59E0B" />,
    title: 'Track every application',
    desc: 'See the exact moment your email is opened. Know where you stand. No more radio silence.',
    forCandidate: true,
  },
]

type StatItem = {
  value: string
  label: string
  color: string
}

const STATS: StatItem[] = [
  { value: '₦22M+', label: 'fraud prevented annually', color: '#FF6240' },
  { value: '100%', label: 'companies CAC-verified', color: '#0DD4C3' },
  { value: 'NIN', label: 'verified every candidate', color: '#22C55E' },
]

function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 80).duration(400)}>
      <View className="flex-row items-start gap-4 mb-5">
        <View className="items-center">
          <View
            className="bg-surface-card border border-surface-border rounded-xl items-center justify-center"
            style={{ width: 44, height: 44 }}
          >
            {step.icon}
          </View>
          {index < CANDIDATE_STEPS.length - 1 && (
            <View
              style={{ width: 1, height: 24, backgroundColor: '#C8BFB0', marginTop: 4 }}
            />
          )}
        </View>
        <View className="flex-1 pt-2">
          <View className="flex-row items-center gap-2 mb-1">
            <Text
              style={{
                color: '#FF6240',
                fontSize: 11,
                fontWeight: '700',
                fontFamily: 'JetBrainsMono_700Bold',
                letterSpacing: 2,
              }}
            >
              {step.number}
            </Text>
            <Text className="text-[#1A1625] font-semibold text-sm">{step.title}</Text>
          </View>
          <Text className="text-slate-400 text-sm leading-5">{step.desc}</Text>
        </View>
      </View>
    </Animated.View>
  )
}

export default function AboutScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} className="mt-4 mb-8">
          <Text className="text-primary-400 text-base">← Back</Text>
        </Pressable>

        <View className="mb-8">
          <Text
            style={{
              color: '#94a3b8',
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 3,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            How it works
          </Text>
          <Text
            style={{
              color: '#1A1625',
              fontSize: 28,
              fontWeight: '700',
              letterSpacing: -0.5,
              lineHeight: 34,
              marginBottom: 10,
            }}
          >
            Built for trust.{'\n'}
            <Text style={{ color: '#FF6240' }}>Not promises.</Text>
          </Text>
          <Text className="text-slate-400 text-sm leading-5">
            Workstation doesn't just ask companies and candidates to be honest — it verifies them against government registries before they can interact.
          </Text>
        </View>

        <View className="flex-row gap-3 mb-8">
          {STATS.map((stat) => (
            <View
              key={stat.label}
              className="flex-1 bg-surface-card border border-surface-border rounded-2xl p-3 items-center"
            >
              <Text style={{ color: stat.color, fontSize: 18, fontWeight: '800', marginBottom: 2 }}>
                {stat.value}
              </Text>
              <Text className="text-slate-500 text-xs text-center leading-3">{stat.label}</Text>
            </View>
          ))}
        </View>

        <Text
          style={{
            color: '#1A1625',
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 16,
          }}
        >
          For job seekers
        </Text>

        {CANDIDATE_STEPS.map((step, i) => (
          <StepCard key={step.number} step={step} index={i} />
        ))}

        <View className="bg-surface-card border border-surface-border rounded-2xl p-5 mt-2 mb-6">
          <View className="flex-row items-start gap-3">
            <ShieldIcon size={20} color="#0DD4C3" />
            <View className="flex-1">
              <Text className="text-[#1A1625] font-semibold text-sm mb-1">For companies</Text>
              <Text className="text-slate-400 text-sm leading-5">
                Register with your CAC RC number. Get verified in 24–48 hours by our team. Post jobs immediately after approval. Access a pre-screened pool of NIN-verified candidates.
              </Text>
            </View>
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)} className="gap-3">
          <Pressable
            onPress={() => router.push('/(auth)/register')}
            className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-[#1A1625] font-semibold text-base">Get started</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(auth)/contact')}
            className="bg-surface-card border border-surface-border rounded-2xl py-4 items-center active:opacity-70"
          >
            <Text className="text-slate-300 font-medium text-base">Have questions? Contact us</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}
