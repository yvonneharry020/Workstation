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
import Svg, { Path } from 'react-native-svg'

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
      { text: 'Apply to unlimited jobs', included: true },
      { text: 'Basic profile & CV', included: true },
      { text: 'Profile visible to companies', included: true },
      { text: 'Application tracking', included: true },
      { text: 'Job match alerts', included: false },
      { text: 'Priority profile placement', included: false },
      { text: 'Verified badge', included: false },
      { text: 'Direct recruiter messaging', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₦5,000',
    period: 'per month',
    color: '#FF6240',
    isCurrent: false,
    features: [
      { text: 'Apply to unlimited jobs', included: true },
      { text: 'Full profile & portfolio', included: true },
      { text: 'Profile visible to companies', included: true },
      { text: 'Application tracking', included: true },
      { text: 'Job match alerts', included: true },
      { text: 'Priority profile placement', included: true },
      { text: 'Verified badge', included: true },
      { text: 'Direct recruiter messaging', included: true },
    ],
  },
]

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  )
}

function XIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#C8BFB0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  const handleUpgrade = () => {
    if (plan.isCurrent) return
    Alert.alert('Coming Soon', 'Subscription upgrades will be available soon. Check back later!')
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(plan.id === 'free' ? 80 : 160).duration(350)}
      style={{
        backgroundColor: plan.isCurrent ? '#EDE7DB' : '#1A1625',
        borderWidth: plan.isCurrent ? 1 : 2,
        borderColor: plan.isCurrent ? '#DDD6C9' : plan.color,
        borderRadius: 20,
        padding: 20,
        marginBottom: 14,
      }}
    >
      {!plan.isCurrent && (
        <View style={{
          position: 'absolute', top: -10, right: 16,
          backgroundColor: plan.color, borderRadius: 20,
          paddingHorizontal: 12, paddingVertical: 4,
        }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>RECOMMENDED</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: plan.isCurrent ? '#1A1625' : '#fff', fontSize: 20, fontWeight: '800' }}>
          {plan.name}
        </Text>
        {plan.isCurrent && (
          <View style={{ backgroundColor: '#22C55E20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#22C55E40' }}>
            <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>Current Plan</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 18 }}>
        <Text style={{ color: plan.isCurrent ? plan.color : plan.color, fontSize: 28, fontWeight: '800' }}>
          {plan.price}
        </Text>
        <Text style={{ color: plan.isCurrent ? '#64748B' : '#94A3B8', fontSize: 13 }}>
          {plan.period}
        </Text>
      </View>

      <View style={{ gap: 10, marginBottom: 18 }}>
        {plan.features.map((f, idx) => (
          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {f.included ? <CheckIcon color={plan.color} /> : <XIcon />}
            <Text style={{
              color: f.included
                ? (plan.isCurrent ? '#1A1625' : '#fff')
                : '#94A3B8',
              fontSize: 13,
              opacity: f.included ? 1 : 0.6,
            }}>
              {f.text}
            </Text>
          </View>
        ))}
      </View>

      {!plan.isCurrent && (
        <Pressable
          onPress={handleUpgrade}
          style={{
            backgroundColor: plan.color,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
          }}
          className="active:opacity-80"
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
            Upgrade to {plan.name}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  )
}

export default function SubscriptionScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#DDD6C9',
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12} className="active:opacity-70">
          <BackIcon />
        </Pressable>
        <Text style={{ color: '#1A1625', fontSize: 23, fontWeight: '700' }}>Subscription</Text>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 48 }}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
            Your Plan
          </Text>
          <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 20, lineHeight: 18 }}>
            Upgrade to get priority placement and connect directly with recruiters.
          </Text>
        </Animated.View>

        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}

        <Animated.View
          entering={FadeInDown.delay(240).duration(350)}
          style={{
            backgroundColor: '#EDE7DB',
            borderWidth: 1,
            borderColor: '#DDD6C9',
            borderRadius: 16,
            padding: 16,
            marginTop: 4,
          }}
        >
          <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
            Need help choosing?
          </Text>
          <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18 }}>
            All plans include access to thousands of Nigerian job listings. Upgrade for more visibility and recruiter access. Cancel anytime.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}
