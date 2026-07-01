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
import { useQuery } from '@tanstack/react-query'
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

const NOTIF_CONFIGS: Record<NotificationType, { color: string; emoji: string }> = {
  profile_viewed:      { color: '#0DD4C3', emoji: '👁' },
  application_update:  { color: '#FF6240', emoji: '📋' },
  email_opened:        { color: '#22C55E', emoji: '📧' },
  interview_scheduled: { color: '#A855F7', emoji: '📅' },
  badge_issued:        { color: '#F59E0B', emoji: '🏅' },
  job_match:           { color: '#FF6240', emoji: '💼' },
  badge_disputed:      { color: '#EF4444', emoji: '⚠️' },
  system:              { color: '#64748B', emoji: '⚡' },
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function NotifIcon({ type }: { type: NotificationType }) {
  const cfg = NOTIF_CONFIGS[type]
  return (
    <View style={{
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: cfg.color + '20',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Text style={{ fontSize: 20 }}>{cfg.emoji}</Text>
    </View>
  )
}

function NotifCard({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#131118',
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: item.is_read ? '#1E1B2E' : '#FF624030',
        borderLeftWidth: item.is_read ? 1 : 3,
        borderLeftColor: item.is_read ? '#1E1B2E' : '#FF6240',
      }}
    >
      <NotifIcon type={item.type} />
      <View style={{ flex: 1 }}>
        <Text style={{
          color: '#fff',
          fontSize: 14,
          fontWeight: item.is_read ? '400' : '600',
          marginBottom: 3,
          lineHeight: 20,
        }}>
          {item.title}
        </Text>
        {item.body ? (
          <Text style={{ color: '#94A3B8', fontSize: 12, lineHeight: 18 }} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <Text style={{ color: '#475569', fontSize: 11, marginTop: 5 }}>
          {timeAgo(item.created_at)}
        </Text>
      </View>
      {!item.is_read ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6240', marginTop: 6, flexShrink: 0 }} />
      ) : null}
    </Pressable>
  )
}

export default function NotificationsScreen() {
  const user = useAuthStore((s) => s.user)
  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery<NotificationItem[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw new Error(error.message)
      return (data ?? []) as NotificationItem[]
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const markRead = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notif.id)
      refetch()
    }
    if (notif.action_url) {
      router.push(notif.action_url as Parameters<typeof router.push>[0])
    }
  }

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user!.id)
      .eq('is_read', false)
    refetch()
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={{
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 10,
              backgroundColor: '#FF6240',
            }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead} hitSlop={12}>
            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '500' }}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#FF6240"
            />
          }
          renderItem={({ item }) => (
            <NotifCard item={item} onPress={() => markRead(item)} />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>🔔</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 }}>
                No notifications yet
              </Text>
              <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                You'll be notified when companies view your profile, open your emails, and more.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
