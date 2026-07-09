import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path, Circle } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface EmailSent {
  id: string
  recipient_id: string
  subject: string
  body_html: string
  sent_at: string
  opened_at: string | null
  open_count: number
  recipient: { candidate_profiles: { first_name: string; last_name: string; avatar_url: string | null } | null } | null
}

interface EmailRow {
  id: string
  recipient_id: string
  subject: string
  body_html: string
  sent_at: string
  opened_at: string | null
  open_count: number
  recipient: { candidate_profiles: { first_name: string; last_name: string; avatar_url: string | null } | null } | null
}

type FilterTab = 'all' | 'opened' | 'not_opened'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function thisMonth(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function XIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

function MailOpenIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 13V6a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 2 6v12a2 2 0 0 0 2 2h7" />
      <Path d="m22 6-10 7L2 6" />
      <Path d="m16 19 2 2 4-4" />
    </Svg>
  )
}

export default function EmailHistoryScreen() {
  const user = useAuthStore((s) => s.user)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [selected, setSelected] = useState<EmailSent | null>(null)

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['email-history', user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('emails_sent')
          .select('id, recipient_id, subject, body_html, sent_at, recipient:recipient_id(candidate_profiles(first_name, last_name, avatar_url))')
          .eq('company_id', user!.id)
          .order('sent_at', { ascending: false })
          .limit(200)
        if (error) throw error
        return (data as unknown as EmailRow[]).map((r) => ({
          ...r,
          opened_at: null,
          open_count: 0,
        })) as EmailSent[]
      } catch {
        return [] as EmailSent[]
      }
    },
    enabled: !!user?.id,
  })

  const filtered = emails.filter((e) => {
    if (filter === 'opened') return !!e.opened_at
    if (filter === 'not_opened') return !e.opened_at
    return true
  })

  const thisMonthEmails = emails.filter((e) => thisMonth(e.sent_at))
  const openedCount = thisMonthEmails.filter((e) => !!e.opened_at).length
  const openRate = thisMonthEmails.length > 0 ? Math.round((openedCount / thisMonthEmails.length) * 100) : 0

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'opened', label: 'Opened' },
    { key: 'not_opened', label: 'Not opened' },
  ]

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-4 border-b border-surface-border">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <Text className="text-[#1A1625] text-2xl font-bold">Email History</Text>
      </View>

      <View className="px-5 py-4 flex-row gap-3">
        <View style={{ flex: 1, backgroundColor: '#EDE7DB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#DDD6C9' }}>
          <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>SENT THIS MONTH</Text>
          <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '800' }}>{thisMonthEmails.length}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#EDE7DB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#DDD6C9' }}>
          <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>OPENED</Text>
          <Text style={{ color: '#22C55E', fontSize: 22, fontWeight: '800' }}>{openedCount}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#EDE7DB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#DDD6C9' }}>
          <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>OPEN RATE</Text>
          <Text style={{ color: '#0DD4C3', fontSize: 22, fontWeight: '800' }}>{openRate}%</Text>
        </View>
      </View>

      <View className="flex-row px-5 mb-3 gap-2">
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setFilter(t.key)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: filter === t.key ? '#FF6240' : '#EDE7DB', borderWidth: 1, borderColor: filter === t.key ? '#FF6240' : '#DDD6C9' }}
          >
            <Text style={{ color: filter === t.key ? '#1A1625' : '#5A4F6E', fontSize: 13, fontWeight: '600' }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF6240" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ color: '#475569', fontSize: 15 }}>No emails found</Text>
              <Text style={{ color: '#334155', fontSize: 13, marginTop: 4 }}>
                {filter !== 'all' ? 'Try changing the filter above' : 'Emails you send will appear here'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const rcp = item.recipient?.candidate_profiles
            const fullName = rcp ? `${rcp.first_name} ${rcp.last_name}`.trim() : 'Unknown'
            const initials = fullName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
            return (
              <Pressable
                onPress={() => setSelected(item)}
                style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                {rcp?.avatar_url ? (
                  <Image source={{ uri: rcp.avatar_url }} style={{ width: 42, height: 42, borderRadius: 21 }} />
                ) : (
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '700' }}>{initials}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                    {fullName}
                  </Text>
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {item.subject}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    {item.opened_at ? (
                      <>
                        <MailOpenIcon color="#22C55E" />
                        <Text style={{ color: '#22C55E', fontSize: 11 }}>
                          Opened {relativeTime(item.opened_at)}
                          {item.open_count > 1 ? ` · ${item.open_count}×` : ''}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Circle cx={4} cy={4} r={4} />
                        <Text style={{ color: '#475569', fontSize: 11 }}>Not yet opened</Text>
                      </>
                    )}
                  </View>
                </View>
                <Text style={{ color: '#334155', fontSize: 11 }}>{relativeTime(item.sent_at)}</Text>
              </Pressable>
            )
          }}
        />
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
              <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700', flex: 1 }} numberOfLines={1}>{selected.subject}</Text>
              <Pressable onPress={() => setSelected(null)}><XIcon /></Pressable>
            </View>
            <ScrollView style={{ flex: 1, padding: 20 }}>
              <Text style={{ color: '#5A4F6E', fontSize: 12, marginBottom: 4 }}>
                To: {[selected.recipient?.candidate_profiles?.first_name, selected.recipient?.candidate_profiles?.last_name].filter(Boolean).join(' ') || 'Unknown'} · {relativeTime(selected.sent_at)}
              </Text>
              {selected.opened_at && (
                <Text style={{ color: '#22C55E', fontSize: 12, marginBottom: 16 }}>
                  Opened {relativeTime(selected.opened_at)}{selected.open_count > 1 ? ` (${selected.open_count} times)` : ''}
                </Text>
              )}
              <View style={{ height: 1, backgroundColor: '#DDD6C9', marginBottom: 16 }} />
              <Text style={{ color: '#1A1625', fontSize: 14, lineHeight: 22 }}>{selected.body_html}</Text>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  )
}
