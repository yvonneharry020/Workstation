import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native'
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#64748B"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
    >
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  )
}

type Faq = {
  q: string
  a: string
}

const FAQS: Faq[] = [
  {
    q: 'Is Workstation free for job seekers?',
    a: 'Yes. Workstation is completely free for candidates. Create a profile, get verified, apply to jobs, and track your applications at no cost.',
  },
  {
    q: 'How does NIN verification work?',
    a: 'You enter your 11-digit NIN. We verify it against the NIMC database via our partner APIs (Smile Identity and Dojah). You also complete a short liveness check — blink, turn, smile — to confirm it is actually you.',
  },
  {
    q: 'How do companies get verified?',
    a: 'Companies submit their CAC RC number, director NIN, business email domain, and supporting documents (Certificate of Incorporation, etc.). Our team reviews each submission within 24–48 hours. Approved companies can post jobs immediately.',
  },
  {
    q: 'What if I fail my NIN verification?',
    a: 'You have 3 attempts per session. If you fail 3 times, your account is locked for 24 hours. After that, you can try again. Make sure you are in good lighting for the liveness check.',
  },
  {
    q: 'How is the trust score calculated?',
    a: 'Your trust score starts at 0 and increases as you complete verifications: phone (+10), NIN (+20), liveness check (+15), documents approved (+20), employment history (+5), and each verified badge from past employers (+5, up to 25).',
  },
]

function FaqItem({ faq }: { faq: Faq }) {
  const [expanded, setExpanded] = useState(false)

  const toggle = () => {
    setExpanded((v) => !v)
  }

  return (
    <Pressable
      onPress={toggle}
      className="border-b border-surface-border py-4"
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[#1A1625] text-sm font-medium flex-1 leading-5" style={{ flexShrink: 1 }}>
          {faq.q}
        </Text>
        <ChevronIcon expanded={expanded} />
      </View>
      {expanded && (
        <Text className="text-slate-400 text-sm leading-5 mt-3 pr-6">{faq.a}</Text>
      )}
    </Pressable>
  )
}

const MAX_MESSAGE = 500

const schema = z.object({
  name: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email address'),
  subject: z.string().min(3, 'Enter a subject'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(MAX_MESSAGE, `Message cannot exceed ${MAX_MESSAGE} characters`),
})

type Form = z.infer<typeof schema>

export default function ContactScreen() {
  const [submitted, setSubmitted] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  const messageLength = watch('message')?.length ?? 0

  const onSubmit = async (data: Form) => {
    const { error } = await supabase.from('contact_submissions').insert({
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      submitted_at: new Date().toISOString(),
    })
    if (error) {
      Alert.alert('Failed to send', 'Something went wrong. Please email us directly at support@workstationng.com.')
      return
    }
    setSubmitted(true)
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
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
            Support
          </Text>
          <Text
            style={{
              color: '#1A1625',
              fontSize: 28,
              fontWeight: '700',
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            Get in touch
          </Text>
          <Text className="text-slate-400 text-sm leading-5">
            Have a question, feedback, or need help? We'll get back to you within 24 hours.
          </Text>
        </View>

        {submitted ? (
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="bg-surface-card border border-surface-border rounded-2xl p-6 items-center mb-8"
          >
            <Text style={{ fontSize: 40, marginBottom: 12 }}>✉️</Text>
            <Text className="text-[#1A1625] font-semibold text-lg mb-2">Message sent!</Text>
            <Text className="text-slate-400 text-sm text-center leading-5">
              We'll review your message and respond to your email within 24 hours.
            </Text>
          </Animated.View>
        ) : (
          <View className="mb-8">
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <View className="mb-4">
                  <Text className="text-slate-300 text-sm mb-2">Full name</Text>
                  <TextInput
                    className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-[#1A1625] text-sm"
                    placeholder="Your name"
                    placeholderTextColor="#475569"
                    autoComplete="name"
                    value={value}
                    onChangeText={onChange}
                  />
                  {errors.name && (
                    <Text className="text-red-400 text-xs mt-1">{errors.name.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <View className="mb-4">
                  <Text className="text-slate-300 text-sm mb-2">Email address</Text>
                  <TextInput
                    className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-[#1A1625] text-sm"
                    placeholder="you@example.com"
                    placeholderTextColor="#475569"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    value={value}
                    onChangeText={onChange}
                  />
                  {errors.email && (
                    <Text className="text-red-400 text-xs mt-1">{errors.email.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="subject"
              render={({ field: { onChange, value } }) => (
                <View className="mb-4">
                  <Text className="text-slate-300 text-sm mb-2">Subject</Text>
                  <TextInput
                    className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-[#1A1625] text-sm"
                    placeholder="What's this about?"
                    placeholderTextColor="#475569"
                    value={value}
                    onChangeText={onChange}
                  />
                  {errors.subject && (
                    <Text className="text-red-400 text-xs mt-1">{errors.subject.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="message"
              render={({ field: { onChange, value } }) => (
                <View className="mb-6">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-slate-300 text-sm">Message</Text>
                    <Text
                      className="text-xs"
                      style={{
                        color: messageLength > MAX_MESSAGE * 0.9 ? '#EF4444' : '#475569',
                      }}
                    >
                      {messageLength}/{MAX_MESSAGE}
                    </Text>
                  </View>
                  <TextInput
                    className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-[#1A1625] text-sm"
                    placeholder="Tell us what's on your mind…"
                    placeholderTextColor="#475569"
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    style={{ minHeight: 120 }}
                    value={value}
                    onChangeText={onChange}
                  />
                  {errors.message && (
                    <Text className="text-red-400 text-xs mt-1">{errors.message.message}</Text>
                  )}
                </View>
              )}
            />

            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
              style={{ opacity: isSubmitting ? 0.7 : 1 }}
            >
              <Text className="text-[#1A1625] font-semibold text-base">
                {isSubmitting ? 'Sending…' : 'Send message'}
              </Text>
            </Pressable>
          </View>
        )}

        <View className="mb-4">
          <Text className="text-[#1A1625] font-semibold text-base mb-1">Frequently asked</Text>
          <Text className="text-slate-500 text-xs mb-1">Common questions answered below.</Text>
        </View>

        <View className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden px-4">
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} faq={faq} />
          ))}
        </View>

        <View className="mt-6 items-center">
          <Text className="text-slate-600 text-xs">Or email us directly</Text>
          <Text className="text-primary-400 text-sm font-medium mt-0.5">
            support@workstationng.com
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
