import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  id: string
  name: string
  price: string
  period: string
  color: string
  features: PlanFeature[]
  isCurrent: boolean
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '₦0',
    period: 'forever',
    color: '#64748B',
    isCurrent: true,
    features: [
      { text: '3 active job postings', included: true },
      { text: '50 applicants per month', included: true },
      { text: 'Basic ATS table view', included: true },
      { text: 'Email templates (3 presets)', included: true },
      { text: 'Kanban board', included: false },
      { text: 'Bulk email composer', included: false },
      { text: 'Interview scheduler', included: false },
      { text: 'Badge issuer', included: false },
      { text: 'Analytics dashboard', included: false },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '₦25,000',
    period: 'per month',
    color: '#FF6240',
    isCurrent: false,
    features: [
      { text: '15 active job postings', included: true },
      { text: '500 applicants per month', included: true },
      { text: 'Full ATS + Kanban board', included: true },
      { text: 'Bulk email composer', included: true },
      { text: 'Interview scheduler & calendar', included: true },
      { text: 'Badge issuer', included: true },
      { text: 'Analytics dashboard', included: true },
      { text: 'Priority support', included: false },
      { text: 'API access', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '₦75,000',
    period: 'per month',
    color: '#0DD4C3',
    isCurrent: false,
    features: [
      { text: 'Unlimited job postings', included: true },
      { text: 'Unlimited applicants', included: true },
      { text: 'Everything in Growth', included: true },
      { text: 'API access', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'Custom integrations', included: true },
      { text: 'SLA guarantees', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'White-label options', included: true },
    ],
  },
]

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  )
}

function XIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  const handleUpgrade = () => {
    Alert.alert(
      `Upgrade to ${plan.name}`,
      `Contact our team to upgrade to the ${plan.name} plan.\n\nbilling@workstation.ng`,
      [{ text: 'OK' }],
    )
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(300)}
      style={{
        backgroundColor: '#131118',
        borderRadius: 18,
        borderWidth: plan.isCurrent ? 1 : 1.5,
        borderColor: plan.isCurrent ? '#1E1B2E' : `${plan.color}40`,
        padding: 20,
        marginBottom: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View>
          <Text style={{ color: plan.color, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{plan.name}</Text>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{plan.price}</Text>
          <Text style={{ color: '#475569', fontSize: 12 }}>{plan.period}</Text>
        </View>
        {plan.isCurrent && (
          <View style={{ backgroundColor: `${plan.color}20`, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: `${plan.color}30` }}>
            <Text style={{ color: plan.color, fontSize: 11, fontWeight: '700' }}>Current plan</Text>
          </View>
        )}
      </View>

      <View style={{ gap: 8, marginBottom: 16 }}>
        {plan.features.map((feature, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {feature.included ? <CheckIcon color={plan.color} /> : <XIcon />}
            <Text style={{ color: feature.included ? '#CBD5E1' : '#334155', fontSize: 13, flex: 1 }}>{feature.text}</Text>
          </View>
        ))}
      </View>

      {!plan.isCurrent && (
        <Pressable
          onPress={handleUpgrade}
          style={{ backgroundColor: `${plan.color}15`, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: `${plan.color}30` }}
          className="active:opacity-80"
        >
          <Text style={{ color: plan.color, fontSize: 14, fontWeight: '700' }}>Upgrade to {plan.name}</Text>
        </Pressable>
      )}
    </Animated.View>
  )
}

export default function BillingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-4 border-b border-surface-border gap-3">
        <Pressable
          onPress={() => router.back()}
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#1E1B2E' }}
          className="active:opacity-70"
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 5l-7 7 7 7" />
          </Svg>
        </Pressable>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>Billing & Plans</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 20, paddingBottom: 48 }}>

        <Animated.View
          entering={FadeInDown.delay(50).duration(300)}
          style={{ backgroundColor: '#131118', borderRadius: 16, borderWidth: 1, borderColor: '#1E1B2E', padding: 16, marginBottom: 24 }}
        >
          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Current plan</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Free</Text>
              <Text style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>No billing cycle</Text>
            </View>
            <View style={{ backgroundColor: '#64748B20', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700' }}>Active</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: '#1E1B2E', marginVertical: 12 }} />
          <Text style={{ color: '#475569', fontSize: 12 }}>Upgrade your plan to unlock more jobs, applicants, and features.</Text>
        </Animated.View>

        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 14 }}>Available plans</Text>

        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}

        <Animated.View
          entering={FadeInDown.delay(400).duration(300)}
          style={{ backgroundColor: '#131118', borderRadius: 16, borderWidth: 1, borderColor: '#1E1B2E', padding: 16, marginTop: 8 }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Invoice history</Text>
          <Text style={{ color: '#475569', fontSize: 13 }}>No invoices yet — upgrades will appear here.</Text>
        </Animated.View>

        <View style={{ marginTop: 20, backgroundColor: '#FF624008', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FF624020' }}>
          <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Enterprise enquiries</Text>
          <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18 }}>
            Need custom pricing, API access, or dedicated support?{'\n'}
            Email us at <Text style={{ color: '#fff' }}>billing@workstation.ng</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
