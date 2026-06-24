import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle, Rect } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type NotificationFilter = 'all' | 'applications' | 'interviews' | 'badges'

type NotificationType =
  | 'new_application'
  | 'application_status_changed'
  | 'email_opened'
  | 'interview_scheduled'
  | 'badge_received'
  | 'badge_revoked'
  | 'verification_approved'
  | 'verification_rejected'

interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  action_url: string | null
  read_at: string | null
  created_at: string
}

const TYPE_CONFIG: Record<NotificationType, { color: string; filter: NotificationFilter }> = {
  new_application: { color: '#FF6240', filter: 'applications' },
  application_status_changed: { color: '#FF6240', filter: 'applications' },
  email_opened: { color: '#0DD4C3', filter: 'applications' },
  interview_scheduled: { color: '#F59E0B', filter: 'interviews' },
  badge_received: { color: '#22C55E', filter: 'badges' },
  badge_revoked: { color: '#EF4444', filter: 'badges' },
  verification_approved: { color: '#22C55E', filter: 'all' },
  verification_rejected: { color: '#EF4444', filter: 'all' },
}

function NotificationIcon({ type, color }: { type: NotificationType; color: string }) {
  if (type === 'new_application' || type === 'application_status_changed') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={2} y={7} width={20} height={14} rx={2} />
        <Path d="M16 7V5a2 2 0 0 0-4 0v2M8 11h8M8 15h4" />
      </Svg>
    )
  }
  if (type === 'email_opened') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <Path d="M22 6l-10 7L2 6" />
      </Svg>
    )
  }
  if (type === 'interview_scheduled') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={3} y={4} width={18} height={18} rx={2} />
        <Path d="M16 2v4M8 2v4M3 10h18" />
      </Svg>
    )
  }
  if (type === 'badge_received' || type === 'badge_revoked') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill={type === 'badge_received' ? color : 'none'} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </Svg>
    )
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'applications', label: 'Applications' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'badges', label: 'Badges' },
]

export default function NotificationsScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all')

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, action_url, read_at, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as unknown as Notification[]
    },
    enabled: !!user?.id,
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user!.id)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const filtered = (notifications ?? []).filter((n) => {
    if (activeFilter === 'all') return true
    return TYPE_CONFIG[n.type]?.filter === activeFilter
  })

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length

  const handleTap = (notification: Notification) => {
    if (!notification.read_at) markReadMutation.mutate(notification.id)
    if (notification.action_url) router.push(notification.action_url as never)
  }

  const renderItem = ({ item, index }: { item: Notification; index: number }) => {
    const isUnread = !item.read_at
    const config = TYPE_CONFIG[item.type]
    const color = config?.color ?? '#64748B'

    return (
      <Animated.View entering={FadeInDown.delay(index * 40).duration(280)}>
        <Pressable
          onPress={() => handleTap(item)}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            padding: 14,
            backgroundColor: isUnread ? '#FF624006' : '#131118',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: isUnread ? '#FF624020' : '#1E1B2E',
            marginBottom: 8,
            borderLeftWidth: isUnread ? 3 : 1,
            borderLeftColor: isUnread ? color : '#1E1B2E',
          }}
          className="active:opacity-80"
        >
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${color}15`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <NotificationIcon type={item.type} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: isUnread ? '#fff' : '#CBD5E1', fontSize: 14, fontWeight: isUnread ? '600' : '400', marginBottom: 3, lineHeight: 19 }}>
              {item.title}
            </Text>
            <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{item.body}</Text>
            <Text style={{ color: '#334155', fontSize: 11, marginTop: 5 }}>{timeAgo(item.created_at)}</Text>
          </View>
          {isUnread && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, flexShrink: 0, marginTop: 4 }} />
          )}
        </Pressable>
      </Animated.View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-surface-border">
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable
            onPress={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="active:opacity-70"
          >
            <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, gap: 8 }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setActiveFilter(f.key)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: activeFilter === f.key ? '#FF6240' : '#131118',
              borderWidth: 1,
              borderColor: activeFilter === f.key ? '#FF6240' : '#1E1B2E',
            }}
            className="active:opacity-80"
          >
            <Text style={{ color: activeFilter === f.key ? '#fff' : '#64748B', fontSize: 13, fontWeight: '600' }}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#131118', borderWidth: 1, borderColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                </Svg>
              </View>
              <Text style={{ color: '#475569', fontSize: 14, fontWeight: '500' }}>
                {activeFilter === 'all' ? 'No notifications yet' : `No ${activeFilter} notifications`}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
