import { useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type RowStage = 'prospect' | 'contacted' | 'interviewing' | 'offer' | 'hired' | 'rejected'

interface AtsRow {
  id: string
  table_id: string
  candidate_id: string | null
  label: string
  stage: RowStage
  notes: string | null
  created_at: string
}

const STAGE_CONFIG: Record<RowStage, { label: string; color: string; bg: string }> = {
  prospect:     { label: 'Prospect',    color: '#818CF8', bg: 'rgba(129,140,248,0.15)' },
  contacted:    { label: 'Contacted',   color: '#38BDF8', bg: 'rgba(56,189,248,0.15)' },
  interviewing: { label: 'Interviewing',color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  offer:        { label: 'Offer',       color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  hired:        { label: 'Hired',       color: '#0DD4C3', bg: 'rgba(13,212,195,0.15)' },
  rejected:     { label: 'Rejected',    color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
}

const STAGE_OPTIONS: RowStage[] = ['prospect', 'contacted', 'interviewing', 'offer', 'hired', 'rejected']

function ArrowLeft() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function TrashIcon({ color = '#EF4444' }: { color?: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </Svg>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

function RowCard({
  item,
  index,
  onStage,
  onDelete,
}: {
  item: AtsRow
  index: number
  onStage: (id: string, current: RowStage) => void
  onDelete: (id: string, label: string) => void
}) {
  const stage = STAGE_CONFIG[item.stage]
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(280)}>
      <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-3">
        <View className="flex-row items-center gap-3 mb-2">
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '700' }}>{getInitials(item.label)}</Text>
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[#1A1625] font-semibold text-sm" numberOfLines={1}>{item.label}</Text>
            <Text className="text-slate-400 text-[11px] mt-0.5">{timeAgo(item.created_at)}</Text>
          </View>
          <Pressable
            onPress={() => onStage(item.id, item.stage)}
            style={{ backgroundColor: stage.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}
            className="active:opacity-70"
          >
            <Text style={{ color: stage.color, fontSize: 11, fontWeight: '600' }}>{stage.label}</Text>
          </Pressable>
        </View>

        {item.notes ? (
          <Text className="text-slate-500 text-xs leading-relaxed mb-2" numberOfLines={2}>{item.notes}</Text>
        ) : null}

        <View className="flex-row items-center justify-between">
          <View />
          <View className="flex-row gap-2">
            {item.candidate_id ? (
              <Pressable
                onPress={() => router.push({ pathname: '/(company)/candidates/[id]', params: { id: item.candidate_id! } })}
                style={{ backgroundColor: '#FF624015', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#FF624030' }}
                className="active:opacity-70"
              >
                <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '600' }}>Profile</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => onDelete(item.id, item.label)}
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center' }}
              className="active:opacity-70"
            >
              <TrashIcon />
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  )
}

export default function AtsTableDetailScreen() {
  const { id: tableId } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [filterStage, setFilterStage] = useState<RowStage | 'all'>('all')
  const [formLabel, setFormLabel] = useState('')
  const [formStage, setFormStage] = useState<RowStage>('prospect')
  const [formNotes, setFormNotes] = useState('')

  const { data: tableName } = useQuery({
    queryKey: ['ats-table-name', tableId],
    enabled: !!tableId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ats_tables').select('name').eq('id', tableId!).maybeSingle()
      return (data as { name: string } | null)?.name ?? 'Table'
    },
  })

  const { data: rows, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ats-rows', tableId],
    enabled: !!tableId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ats_rows')
        .select('id, table_id, candidate_id, label, stage, notes, created_at')
        .eq('table_id', tableId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AtsRow[]
    },
  })

  const { mutate: addRow, isPending: isAdding } = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ats_rows').insert({
        table_id: tableId!,
        label: formLabel.trim(),
        stage: formStage,
        notes: formNotes.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] })
      void queryClient.invalidateQueries({ queryKey: ['ats-tables'] })
      setShowAdd(false)
      setFormLabel('')
      setFormStage('prospect')
      setFormNotes('')
    },
    onError: () => Alert.alert('Error', 'Could not add row. Please try again.'),
  })

  const { mutate: updateStage } = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: RowStage }) => {
      const { error } = await supabase.from('ats_rows').update({ stage }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] })
    },
  })

  const { mutate: deleteRow } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ats_rows').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] })
      void queryClient.invalidateQueries({ queryKey: ['ats-tables'] })
    },
  })

  const handleStage = useCallback((id: string, current: RowStage) => {
    const others = STAGE_OPTIONS.filter(s => s !== current)
    Alert.alert(
      'Move to stage',
      `Current: ${STAGE_CONFIG[current].label}`,
      [
        ...others.map(s => ({ text: STAGE_CONFIG[s].label, onPress: () => updateStage({ id, stage: s }) })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    )
  }, [updateStage])

  const handleDelete = useCallback((id: string, label: string) => {
    Alert.alert('Remove row', `Remove "${label}" from this table?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteRow(id) },
    ])
  }, [deleteRow])

  const handleAdd = useCallback(() => {
    if (!formLabel.trim()) return
    addRow()
  }, [formLabel, addRow])

  const filtered = (rows ?? []).filter(r => filterStage === 'all' || r.stage === filterStage)

  const stageCounts = (rows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.stage] = (acc[r.stage] ?? 0) + 1
    return acc
  }, {})

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row items-center gap-3 mb-3">
          <Pressable onPress={() => router.back()} hitSlop={10} className="active:opacity-70">
            <ArrowLeft />
          </Pressable>
          <View className="flex-1 min-w-0">
            <Text className="text-[#1A1625] text-lg font-bold" numberOfLines={1}>{tableName ?? '…'}</Text>
            <Text className="text-slate-400 text-xs">{(rows ?? []).length} {(rows ?? []).length === 1 ? 'row' : 'rows'}</Text>
          </View>
          <Pressable
            onPress={() => setShowAdd(true)}
            style={{ backgroundColor: '#FF6240', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            className="active:opacity-80"
          >
            <PlusIcon />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Add Row</Text>
          </Pressable>
        </View>

        {/* Stage filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
          <View className="flex-row gap-2 px-1 pb-1">
            {[{ key: 'all' as const, label: 'All', count: rows?.length ?? 0 },
              ...STAGE_OPTIONS.map(s => ({ key: s, label: STAGE_CONFIG[s].label, count: stageCounts[s] ?? 0 })),
            ].map(tab => {
              const active = filterStage === tab.key
              const stageColor = tab.key === 'all' ? '#FF6240' : STAGE_CONFIG[tab.key]?.color ?? '#FF6240'
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setFilterStage(tab.key)}
                  style={{
                    backgroundColor: active ? (tab.key === 'all' ? '#FF6240' : STAGE_CONFIG[tab.key as RowStage]?.bg ?? '#FF624015') : '#EDE7DB',
                    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: active ? (tab.key === 'all' ? '#FF6240' : stageColor) : '#DDD6C9',
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                  }}
                >
                  <Text style={{ color: active ? (tab.key === 'all' ? '#fff' : stageColor) : '#64748B', fontSize: 12, fontWeight: active ? '600' : '400' }}>
                    {tab.label}
                  </Text>
                  {tab.count > 0 && (
                    <View style={{ backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#DDD6C9', borderRadius: 99, minWidth: 16, paddingHorizontal: 4, alignItems: 'center' }}>
                      <Text style={{ color: active ? '#fff' : '#64748B', fontSize: 10, fontWeight: '600' }}>{tab.count}</Text>
                    </View>
                  )}
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <RowCard item={item} index={index} onStage={handleStage} onDelete={handleDelete} />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-slate-400 font-semibold text-sm mb-1">
                {filterStage === 'all' ? 'No rows yet' : `No ${STAGE_CONFIG[filterStage].label.toLowerCase()} rows`}
              </Text>
              <Text className="text-slate-500 text-xs text-center">
                {filterStage === 'all' ? 'Tap "Add Row" to start tracking candidates.' : 'Try a different filter.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Add Row Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
              <View className="flex-row items-center justify-between mb-5">
                <Text className="text-[#1A1625] text-base font-bold">Add Row</Text>
                <Pressable onPress={() => setShowAdd(false)} hitSlop={10} className="active:opacity-70">
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M18 6L6 18M6 6l12 12" />
                  </Svg>
                </Pressable>
              </View>

              <Text className="text-slate-500 text-xs font-semibold mb-1.5">Name / Label *</Text>
              <TextInput
                value={formLabel}
                onChangeText={setFormLabel}
                placeholder="Candidate name or identifier"
                placeholderTextColor="#94A3B8"
                style={{ backgroundColor: '#F5F0E8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A1625', borderWidth: 1, borderColor: '#DDD6C9', marginBottom: 14 }}
                autoFocus
                maxLength={100}
              />

              <Text className="text-slate-500 text-xs font-semibold mb-2">Stage</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View className="flex-row gap-2 pb-1">
                  {STAGE_OPTIONS.map(s => {
                    const active = formStage === s
                    const cfg = STAGE_CONFIG[s]
                    return (
                      <Pressable
                        key={s}
                        onPress={() => setFormStage(s)}
                        style={{
                          backgroundColor: active ? cfg.bg : '#F5F0E8',
                          borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                          borderWidth: 1, borderColor: active ? cfg.color : '#DDD6C9',
                        }}
                        className="active:opacity-70"
                      >
                        <Text style={{ color: active ? cfg.color : '#64748B', fontSize: 12, fontWeight: active ? '600' : '400' }}>{cfg.label}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </ScrollView>

              <Text className="text-slate-500 text-xs font-semibold mb-1.5">Notes (optional)</Text>
              <TextInput
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Any notes about this candidate…"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                style={{ backgroundColor: '#F5F0E8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A1625', borderWidth: 1, borderColor: '#DDD6C9', height: 80, textAlignVertical: 'top', marginBottom: 20 }}
                maxLength={500}
              />

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setShowAdd(false)}
                  className="active:opacity-70"
                  style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', paddingVertical: 13, alignItems: 'center' }}
                >
                  <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleAdd}
                  disabled={isAdding || !formLabel.trim()}
                  className="active:opacity-80"
                  style={{ flex: 1, borderRadius: 14, backgroundColor: formLabel.trim() ? '#FF6240' : '#DDD6C9', paddingVertical: 13, alignItems: 'center' }}
                >
                  {isAdding ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Add</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}
