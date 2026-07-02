import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ScrollView, ActivityIndicator, Alert,} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { logEvent } from '@/lib/audit'

type TicketStatus = 'sent' | 'in_progress' | 'resolved' | 'closed'
type TicketCategory = 'general' | 'verification' | 'billing' | 'technical' | 'account' | 'other'

interface Ticket {
  id: string
  ticket_number: string
  created_at: string
  updated_at: string
  subject: string
  description: string
  category: TicketCategory
  status: TicketStatus
  priority: string
  resolution_note: string | null
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string; border: string }> = {
  sent:        { label: 'Sent',        bg: '#F59E0B15', text: '#F59E0B', border: '#F59E0B30' },
  in_progress: { label: 'In Progress', bg: '#0DD4C315', text: '#0DD4C3', border: '#0DD4C330' },
  resolved:    { label: 'Resolved',    bg: '#10B98115', text: '#10B981', border: '#10B98130' },
  closed:      { label: 'Closed',      bg: '#47556920', text: '#5A4F6E', border: '#47556940' },
}

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'general',      label: 'General Enquiry' },
  { value: 'verification', label: 'Verification Issue' },
  { value: 'account',      label: 'Account Problem' },
  { value: 'technical',    label: 'Technical Bug' },
  { value: 'billing',      label: 'Billing / Payment' },
  { value: 'other',        label: 'Other' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CandidateSupportTicketScreen() {
  const [view, setView] = useState<'list' | 'new'>('list')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TicketCategory>('general')

  const fetchTickets = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('support_tickets')
      .select('id,ticket_number,created_at,updated_at,subject,description,category,status,priority,resolution_note')
      .eq('submitted_by', user.id)
      .order('created_at', { ascending: false })
    if (data) setTickets(data as Ticket[])
    setLoading(false)
  }, [])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  // Real-time: watch for status changes on user's tickets
  useEffect(() => {
    let channelName = 'candidate-tickets'
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'support_tickets',
          filter: `submitted_by=eq.${user.id}`,
        }, (payload) => {
          setTickets(prev => prev.map(t =>
            t.id === (payload.new as Ticket).id ? { ...t, ...(payload.new as Ticket) } : t
          ))
        })
        .subscribe()
      channelName = `candidate-tickets-${user.id}`
    })
    return () => { void supabase.removeChannel(supabase.channel(channelName)) }
  }, [])

  async function handleSubmit() {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Missing info', 'Please fill in the subject and description.')
      return
    }
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const profile = await supabase.from('candidate_profiles').select('first_name, last_name').eq('id', user?.id ?? '').maybeSingle()
    const name = profile?.data ? `${profile.data.first_name ?? ''} ${profile.data.last_name ?? ''}`.trim() || (user?.email?.split('@')[0] ?? 'Candidate') : (user?.email?.split('@')[0] ?? 'Candidate')

    const { data, error } = await supabase.from('support_tickets').insert({
      submitted_by: user?.id ?? null,
      submitter_type: 'candidate',
      submitter_name: name,
      submitter_email: user?.email ?? '',
      subject: subject.trim(),
      description: description.trim(),
      category,
      priority: 'normal',
      status: 'sent',
      source: 'user_app',
    }).select().single()

    if (error || !data) {
      Alert.alert('Error', 'Failed to submit ticket. Please try again.')
    } else {
      logEvent({ event: 'candidate.badge_dispute_filed', app: 'candidate_app', targetId: (data as Ticket).id, targetType: 'support_ticket', metadata: { subject: subject.trim(), category } })
      setTickets(prev => [data as Ticket, ...prev])
      setSubject('')
      setDescription('')
      setCategory('general')
      setView('list')
      Alert.alert('Ticket submitted', `Your ticket ${(data as Ticket).ticket_number} has been submitted. We'll get back to you shortly.`)
    }
    setSubmitting(false)
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F5F0E8]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-[#DDD6C9] flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => view === 'new' ? setView('list') : router.back()}
          className="w-9 h-9 items-center justify-center rounded-full bg-[#EDE7DB]"
        >
          <Text className="text-[#94A3B8] text-lg">←</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-sm font-bold text-[#1A1625]">{view === 'new' ? 'New Ticket' : 'My Support Tickets'}</Text>
          {view === 'list' && <Text className="text-xs text-[#475569] mt-0.5">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</Text>}
        </View>
        {view === 'list' && (
          <TouchableOpacity onPress={() => setView('new')} className="px-3 py-1.5 rounded-lg bg-[#FF6240] flex-row items-center gap-1.5">
            <Text className="text-[#1A1625] text-xs font-bold">+ New Ticket</Text>
          </TouchableOpacity>
        )}
      </View>

      {view === 'list' ? (
        /* ── Ticket list ── */
        loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FF6240" />
          </View>
        ) : tickets.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-4xl mb-3">🎫</Text>
            <Text className="text-base font-bold text-[#1A1625] mb-1">No tickets yet</Text>
            <Text className="text-sm text-[#475569] text-center mb-6">Have an issue? Submit a support ticket and we'll get back to you.</Text>
            <TouchableOpacity onPress={() => setView('new')} className="px-5 py-2.5 rounded-xl bg-[#FF6240]">
              <Text className="text-[#1A1625] text-sm font-bold">Submit your first ticket</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={t => t.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item: t }) => {
              const s = STATUS_CONFIG[t.status]
              return (
                <View className="bg-[#F0EBE1] border border-[#DDD6C9] rounded-2xl p-4">
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-3">
                      <Text className="text-[10px] font-mono text-[#475569] mb-0.5">{t.ticket_number}</Text>
                      <Text className="text-sm font-semibold text-[#1A1625] leading-snug">{t.subject}</Text>
                    </View>
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full border" style={{ backgroundColor: s.bg, borderColor: s.border }}>
                      {t.status === 'in_progress' && (
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.text }} />
                      )}
                      <Text className="text-[10px] font-bold" style={{ color: s.text }}>{s.label}</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-[#475569] mb-3 leading-relaxed" numberOfLines={2}>{t.description}</Text>
                  <View className="flex-row items-center justify-between">
                    <View className="px-2 py-0.5 rounded bg-[#EDE7DB]">
                      <Text className="text-[10px] text-[#64748B] capitalize">{t.category.replace('_', ' ')}</Text>
                    </View>
                    <Text className="text-[10px] text-[#475569] font-mono">{formatDate(t.created_at)}</Text>
                  </View>
                  {t.status === 'resolved' && t.resolution_note && (
                    <View className="mt-3 pt-3 border-t border-[#DDD6C9]">
                      <Text className="text-[10px] text-[#10B981] font-semibold mb-0.5">Resolution</Text>
                      <Text className="text-xs text-[#64748B]">{t.resolution_note}</Text>
                    </View>
                  )}
                </View>
              )
            }}
          />
        )
      ) : (
        /* ── New ticket form ── */
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text className="text-xs text-[#475569] mb-4">Describe your issue and we'll assign it to the right team.</Text>

          {/* Subject */}
          <Text className="text-xs font-semibold text-[#475569] mb-1.5">Subject *</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Brief summary of your issue"
            placeholderTextColor="#475569"
            maxLength={120}
            className="bg-[#F0EBE1] border border-[#DDD6C9] rounded-xl px-4 py-3 text-sm text-[#1A1625] mb-4"
          />

          {/* Category */}
          <Text className="text-xs font-semibold text-[#475569] mb-1.5">Category *</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.value}
                onPress={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-lg border ${category === c.value ? 'bg-[#FF6240] border-[#FF6240]' : 'bg-[#F0EBE1] border-[#DDD6C9]'}`}
              >
                <Text className={`text-xs font-semibold ${category === c.value ? 'text-[#1A1625]' : 'text-[#64748B]'}`}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text className="text-xs font-semibold text-[#475569] mb-1.5">Description *</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Explain your issue in detail — the more info, the faster we can help"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={6}
            maxLength={2000}
            textAlignVertical="top"
            className="bg-[#F0EBE1] border border-[#DDD6C9] rounded-xl px-4 py-3 text-sm text-[#1A1625] mb-2"
            style={{ minHeight: 140 }}
          />
          <Text className="text-[10px] text-[#475569] text-right mb-6">{description.length}/2000</Text>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || !subject.trim() || !description.trim()}
            className={`py-4 rounded-xl items-center ${submitting || !subject.trim() || !description.trim() ? 'bg-[#DDD6C9]' : 'bg-[#FF6240]'}`}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`text-sm font-bold ${submitting || !subject.trim() || !description.trim() ? 'text-[#475569]' : 'text-[#1A1625]'}`}>
                Submit Ticket
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
