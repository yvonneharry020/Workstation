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

interface Broadcast {
  id: string
  title: string
  body: string
  type: string
  created_at: string
  expires_at: string | null
}

const TYPE_CONFIG: Record<NotificationType, { color: string }> = {
  new_application: { color: '#FF6240' },
  application_status_changed: { color: '#FF6240' },
  email_opened: { color: '#0DD4C3' },
  interview_scheduled: { color: '#F59E0B' },
  badge_received: { color: '#22C55E' },
  badge_revoked: { color: '#EF4444' },
  verification_approved: { color: '#22C55E' },
  verification_rejected: { color: '#EF4444' },
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

function StickyBroadcast({ item }: { item: Broadcast }) {
  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      <View style={{
        backgroundColor: '#FEF2F2',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#FECACA',
        borderLeftWidth: 4,
        borderLeftColor: '#EF4444',
        padding: 14,
        marginBottom: 8,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <View style={{ backgroundColor: '#EF4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>📌 PINNED</Text>
          </View>
          <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '600', textTransform: 'capitalize' }}>{item.type}</Text>
        </View>
        <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700', marginBottom: 4, lineHeight: 20 }}>
          {item.title}
        </Text>
        <Text style={{ color: '#5A4F6E', fontSize: 12, lineHeight: 18 }}>{item.body}</Text>
        <Text style={{ color: '#94A3B8', fontSize: 10, marginTop: 6 }}>{timeAgo(item.created_at)}</Text>
      </View>
    </Animated.View>
  )
}

export default function NotificationsScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const { data: broadcasts = [] } = useQuery<Broadcast[]>({
    queryKey: ['admin-broadcasts-company'],
    queryFn: async () => {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('admin_broadcasts')
        .select('id, title, body, type, created_at, expires_at')
        .eq('is_active', true)
        .in('target', ['all', 'companies'])
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false })
      return (data ?? []) as Broadcast[]
    },
    staleTime: 1000 * 60,
  })

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

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length + broadcasts.length

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
            backgroundColor: isUnread ? '#FF624006' : '#EDE7DB',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: isUnread ? '#FF624020' : '#DDD6C9',
            marginBottom: 8,
            borderLeftWidth: isUnread ? 3 : 1,
            borderLeftColor: isUnread ? color : '#DDD6C9',
          }}
          className="active:opacity-80"
        >
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${color}15`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <NotificationIcon type={item.type} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: isUnread ? '#1A1625' : '#2D2640', fontSize: 14, fontWeight: isUnread ? '600' : '400', marginBottom: 3, lineHeight: 19 }}>
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
        <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '800' }}>Notifications</Text>
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

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            broadcasts.length > 0 ? (
              <View>
                {broadcasts.map(b => <StickyBroadcast key={b.id} item={b} />)}
              </View>
            ) : null
          }
          ListEmptyComponent={
            broadcasts.length > 0 ? null : (
              <View className="items-center justify-center py-20">
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                  </Svg>
                </View>
                <Text style={{ color: '#475569', fontSize: 14, fontWeight: '500' }}>
                  No notifications yet
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  )
}
