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
  RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Rect } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface AtsTable {
  id: string
  company_id: string
  name: string
  description: string | null
  created_at: string
  row_count?: number
}

function TableIcon({ size = 20, color = '#FF6240' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <Path d="M3 9h18M3 15h18M9 3v18" />
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

function ChevronRightIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function TableCard({ item, index }: { item: AtsTable; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
      <Pressable
        onPress={() => router.push({ pathname: '/(company)/ats-tables/[id]', params: { id: item.id } })}
        className="active:opacity-75"
        style={{ marginBottom: 12 }}
      >
        <View className="bg-surface-card border border-surface-border rounded-2xl p-4">
          <View className="flex-row items-center gap-3">
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FF624015', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TableIcon size={20} color="#FF6240" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[#1A1625] font-semibold text-sm" numberOfLines={1}>{item.name}</Text>
              {item.description ? (
                <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>{item.description}</Text>
              ) : null}
              <Text className="text-slate-500 text-[11px] mt-1">
                {item.row_count ?? 0} {(item.row_count ?? 0) === 1 ? 'row' : 'rows'} · {formatDate(item.created_at)}
              </Text>
            </View>
            <ChevronRightIcon />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
}

export default function AtsTablesScreen() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')

  const { data: companyId } = useQuery({
    queryKey: ['company-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase.from('company_profiles').select('id').eq('id', user.id).maybeSingle()
      return (data as { id: string } | null)?.id ?? null
    },
  })

  const { data: tables, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ats-tables', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: tableData, error } = await supabase
        .from('ats_tables')
        .select('id, company_id, name, description, created_at')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
      if (error) throw error

      if (!tableData || tableData.length === 0) return [] as AtsTable[]

      const ids = tableData.map(t => t.id)
      const { data: counts } = await supabase
        .from('ats_rows')
        .select('table_id')
        .in('table_id', ids)

      const countMap = (counts ?? []).reduce<Record<string, number>>((acc, r) => {
        const key = r.table_id as string
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      }, {})

      return tableData.map(t => ({ ...t, row_count: countMap[t.id] ?? 0 })) as AtsTable[]
    },
  })

  const { mutate: createTable, isPending: isCreating } = useMutation({
    mutationFn: async (): Promise<string | null> => {
      if (!companyId || !formName.trim()) return null
      const { data, error } = await supabase.from('ats_tables').insert({
        company_id: companyId,
        name: formName.trim(),
        description: formDesc.trim() || null,
      }).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (newId) => {
      void queryClient.invalidateQueries({ queryKey: ['ats-tables', companyId] })
      setShowCreate(false)
      setFormName('')
      setFormDesc('')
      if (newId) router.push({ pathname: '/(company)/ats-tables/[id]', params: { id: newId } })
    },
    onError: () => {
      Alert.alert('Error', 'Could not create table. Please try again.')
    },
  })

  const handleCreate = useCallback(() => {
    if (!formName.trim()) return
    createTable()
  }, [formName, createTable])

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-[#1A1625] text-xl font-bold">Tables</Text>
          <Text className="text-slate-400 text-xs mt-0.5">
            {tables?.length ?? 0} custom ATS table{(tables?.length ?? 0) !== 1 ? 's' : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={{ backgroundColor: '#FF6240', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          className="active:opacity-80"
        >
          <PlusIcon />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>New Table</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={tables ?? []}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => <TableCard item={item} index={index} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />
          }
          ListEmptyComponent={
            <View className="items-center py-20">
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#FF624015', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <TableIcon size={28} color="#FF6240" />
              </View>
              <Text className="text-[#1A1625] font-semibold text-base mb-1">No tables yet</Text>
              <Text className="text-slate-400 text-sm text-center px-8">
                Create a table to track candidates, stages, and notes in a spreadsheet view.
              </Text>
              <Pressable
                onPress={() => setShowCreate(true)}
                style={{ marginTop: 20, backgroundColor: '#FF6240', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}
                className="active:opacity-80"
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Create First Table</Text>
              </Pressable>
            </View>
          }
        />
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
              <View className="flex-row items-center justify-between mb-5">
                <Text className="text-[#1A1625] text-base font-bold">New ATS Table</Text>
                <Pressable onPress={() => setShowCreate(false)} hitSlop={10} className="active:opacity-70">
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M18 6L6 18M6 6l12 12" />
                  </Svg>
                </Pressable>
              </View>

              <Text className="text-slate-500 text-xs font-semibold mb-1.5">Table name *</Text>
              <TextInput
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Q3 Engineering Hires"
                placeholderTextColor="#94A3B8"
                style={{ backgroundColor: '#F5F0E8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A1625', borderWidth: 1, borderColor: '#DDD6C9', marginBottom: 14 }}
                autoFocus
                maxLength={80}
              />

              <Text className="text-slate-500 text-xs font-semibold mb-1.5">Description (optional)</Text>
              <TextInput
                value={formDesc}
                onChangeText={setFormDesc}
                placeholder="What is this table for?"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                style={{ backgroundColor: '#F5F0E8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A1625', borderWidth: 1, borderColor: '#DDD6C9', height: 80, textAlignVertical: 'top', marginBottom: 20 }}
                maxLength={200}
              />

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setShowCreate(false)}
                  className="active:opacity-70"
                  style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', paddingVertical: 13, alignItems: 'center' }}
                >
                  <Text style={{ color: '#64748B', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreate}
                  disabled={isCreating || !formName.trim()}
                  className="active:opacity-80"
                  style={{ flex: 1, borderRadius: 14, backgroundColor: formName.trim() ? '#FF6240' : '#DDD6C9', paddingVertical: 13, alignItems: 'center' }}
                >
                  {isCreating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Create</Text>
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
