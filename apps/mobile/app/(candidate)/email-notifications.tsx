import { View, Text, Pressable, ScrollView, Switch, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface EmailPrefs {
  email_application: boolean
  email_interview: boolean
  email_badge: boolean
  email_job_match: boolean
}

const DEFAULTS: EmailPrefs = {
  email_application: true,
  email_interview: true,
  email_badge: true,
  email_job_match: true,
}

const ROWS: { key: keyof EmailPrefs; label: string; sub: string }[] = [
  { key: 'email_application', label: 'Application updates', sub: 'Stage changes and decisions on your applications' },
  { key: 'email_interview',   label: 'Interview reminders', sub: 'Reminders before scheduled interviews' },
  { key: 'email_badge',       label: 'Badge notifications', sub: 'When a company issues you a verified work badge' },
  { key: 'email_job_match',   label: 'Job matches', sub: 'Weekly digest of jobs matching your profile' },
]

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

export default function EmailNotificationsScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [localPrefs, setLocalPrefs] = useState<EmailPrefs>(DEFAULTS)

  const { data, isLoading } = useQuery({
    queryKey: ['notif-prefs', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('email_application,email_interview,email_badge,email_job_match')
        .eq('user_id', user!.id)
        .maybeSingle()
      return (data as EmailPrefs | null) ?? DEFAULTS
    },
    enabled: !!user?.id,
  })

  useEffect(() => { if (data) setLocalPrefs(data) }, [data])

  const updateMutation = useMutation({
    mutationFn: async (update: Partial<EmailPrefs>) => {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({ user_id: user!.id, ...localPrefs, ...update }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notif-prefs'] }),
  })

  const toggle = (key: keyof EmailPrefs) => {
    const updated = { ...localPrefs, [key]: !localPrefs[key] }
    setLocalPrefs(updated)
    updateMutation.mutate({ [key]: updated[key] })
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
        <Pressable onPress={() => router.back()} hitSlop={12} className="active:opacity-70">
          <BackIcon />
        </Pressable>
        <Text style={{ color: '#1A1625', fontSize: 17, fontWeight: '700' }}>Email Notifications</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FF6240" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}>
          <Animated.View entering={FadeInDown.delay(50).duration(300)} style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', overflow: 'hidden' }}>
            {ROWS.map((row, idx) => (
              <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: idx < ROWS.length - 1 ? 1 : 0, borderBottomColor: '#DDD6C9' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '500' }}>{row.label}</Text>
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{row.sub}</Text>
                </View>
                <Switch
                  value={localPrefs[row.key]}
                  onValueChange={() => toggle(row.key)}
                  trackColor={{ false: '#DDD6C9', true: '#FF6240' }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
