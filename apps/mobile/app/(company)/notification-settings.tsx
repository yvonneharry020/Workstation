import { View, Text, Pressable, ScrollView, Switch, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface NotificationPrefs {
  push_enabled: boolean
  email_new_application: boolean
  email_status_change: boolean
  email_interview_reminder: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  email_new_application: true,
  email_status_change: true,
  email_interview_reminder: true,
}

function ArrowLeftIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#DDD6C9', marginLeft: 20 }} />
}

function PrefRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string
  sub?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '500' }}>{label}</Text>
        {sub && <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#DDD6C9', true: '#FF6240' }}
        thumbColor="#fff"
      />
    </View>
  )
}

export default function NotificationSettingsScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-prefs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('push_enabled, email_new_application, email_status_change, email_interview_reminder')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return (data ?? DEFAULT_PREFS) as NotificationPrefs
    },
    enabled: !!user?.id,
  })

  const updatePref = useMutation({
    mutationFn: async (update: Partial<NotificationPrefs>) => {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({ user_id: user!.id, ...prefs, ...update }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-prefs'] }),
  })

  const toggle = (key: keyof NotificationPrefs) => (value: boolean) => {
    updatePref.mutate({ [key]: value })
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center gap-3 px-5 py-4 border-b border-surface-border">
        <Pressable onPress={() => router.back()} className="active:opacity-70 p-1">
          <ArrowLeftIcon />
        </Pressable>
        <Text style={{ color: '#1A1625', fontSize: 23, fontWeight: '700' }}>Notification Settings</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FF6240" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48, paddingTop: 8 }}>
          <Animated.View entering={FadeInDown.delay(50).duration(300)}>
            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, paddingTop: 16, paddingBottom: 8 }}>
              Push notifications
            </Text>
            <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', overflow: 'hidden' }}>
              <PrefRow
                label="Push notifications"
                sub="Alerts on this device"
                value={prefs?.push_enabled ?? true}
                onChange={toggle('push_enabled')}
              />
            </View>

            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, paddingTop: 20, paddingBottom: 8 }}>
              Email notifications
            </Text>
            <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', overflow: 'hidden' }}>
              <PrefRow
                label="New application"
                sub="When a candidate applies to one of your jobs"
                value={prefs?.email_new_application ?? true}
                onChange={toggle('email_new_application')}
              />
              <Divider />
              <PrefRow
                label="Status updates"
                sub="When a candidate's pipeline stage changes"
                value={prefs?.email_status_change ?? true}
                onChange={toggle('email_status_change')}
              />
              <Divider />
              <PrefRow
                label="Interview reminders"
                sub="Reminders before scheduled interviews"
                value={prefs?.email_interview_reminder ?? true}
                onChange={toggle('email_interview_reminder')}
              />
            </View>
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
