import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle, Rect } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type NotificationType =
  | 'profile_viewed'
  | 'application_update'
  | 'email_opened'
  | 'interview_scheduled'
  | 'badge_issued'
  | 'job_match'
  | 'badge_disputed'
  | 'system'

interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string | null
  is_read: boolean
  read_at: string | null
  action_url: string | null
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
  profile_viewed:      { color: '#0DD4C3' },
  application_update:  { color: '#FF6240' },
  email_opened:        { color: '#22C55E' },
  interview_scheduled: { color: '#A855F7' },
  badge_issued:        { color: '#F59E0B' },
  job_match:           { color: '#FF6240' },
  badge_disputed:      { color: '#EF4444' },
  system:              { color: '#64748B' },
}

function NotificationIcon({ type, color }: { type: NotificationType; color: string }) {
  if (type === 'profile_viewed') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <Circle cx={12} cy={12} r={3} />
      </Svg>
    )
  }
  if (type === 'application_update' || type === 'job_match') {
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
  if (type === 'badge_issued' || type === 'badge_disputed') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill={type === 'badge_issued' ? color : 'none'} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </Svg>
    )
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
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
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
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
        <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700', marginBottom: 4, lineHeight: 20 }}>{item.title}</Text>
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
    queryKey: ['admin-broadcasts-candidate'],
    queryFn: async () => {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('admin_broadcasts')
        .select('id, title, body, type, created_at, expires_at')
        .eq('is_active', true)
        .in('target', ['all', 'candidates'])
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false })
      return (data ?? []) as Broadcast[]
    },
    staleTime: 1000 * 60,
  })

  const { data: notifications = [], isLoading, isRefetching, refetch } = useQuery<NotificationItem[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, is_read, read_at, action_url, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw new Error(error.message)
      return (data ?? []) as NotificationItem[]
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user!.id)
        .eq('is_read', false)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markOneRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length + broadcasts.length

  const handleTap = (item: NotificationItem) => {
    if (!item.is_read) markOneRead.mutate(item.id)
    if (item.action_url) router.push(item.action_url as Parameters<typeof router.push>[0])
  }

  const renderItem = ({ item, index }: { item: NotificationItem; index: number }) => {
    const isUnread = !item.is_read
    const color = TYPE_CONFIG[item.type]?.color ?? '#64748B'

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
            {item.body ? (
              <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{item.body}</Text>
            ) : null}
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#DDD6C9',
      }}>
        <View>
          <Text style={{ color: '#1A1625', fontSize: 26, fontWeight: '800' }}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{unreadCount} unread</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {unreadCount > 0 && (
            <Pressable onPress={() => markAllRead.mutate()} disabled={markAllRead.isPending} className="active:opacity-70">
              <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600' }}>Mark all read</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.back()}
            style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}
            className="active:opacity-70"
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />
          }
          ListHeaderComponent={
            broadcasts.length > 0 ? (
              <View style={{ marginBottom: 4 }}>
                {broadcasts.map(b => <StickyBroadcast key={b.id} item={b} />)}
              </View>
            ) : null
          }
          ListEmptyComponent={
            broadcasts.length > 0 ? null : (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                  </Svg>
                </View>
                <Text style={{ color: '#475569', fontSize: 14, fontWeight: '500' }}>No notifications yet</Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  )
}
