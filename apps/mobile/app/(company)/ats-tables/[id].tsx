import { useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

import { AtsRow, AtsRowData, RowStage, STAGE_CONFIG, STAGE_ORDER } from '@/components/ats/types'
import { OverviewTab }  from '@/components/ats/OverviewTab'
import { DataTab }      from '@/components/ats/DataTab'
import { AnalysisTab }  from '@/components/ats/AnalysisTab'

type TabKey = 'overview' | 'data' | 'analysis'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'data',     label: 'Data'     },
  { key: 'analysis', label: 'Analysis' },
]

// ─── Icons ────────────────────────────────────────────────────────────────────
function ArrowLeft() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function CloseIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

// ─── Add Row Modal ─────────────────────────────────────────────────────────────
interface AddRowModalProps {
  visible:   boolean
  onClose:   () => void
  onSubmit:  (label: string, stage: RowStage) => void
  isPending: boolean
}

function AddRowModal({ visible, onClose, onSubmit, isPending }: AddRowModalProps) {
  const [label, setLabel] = useState('')
  const [stage, setStage] = useState<RowStage>('prospect')

  const handleSubmit = useCallback(() => {
    if (!label.trim()) return
    onSubmit(label.trim(), stage)
    setLabel('')
    setStage('prospect')
  }, [label, stage, onSubmit])

  const handleClose = useCallback(() => {
    setLabel('')
    setStage('prospect')
    onClose()
  }, [onClose])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#F5F0E8',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 44,
          }}>
            {/* Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD6C9', alignSelf: 'center', marginBottom: 18 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A1625' }}>Add Candidate</Text>
                <Text style={{ fontSize: 12, color: '#9A8FA6', marginTop: 2 }}>Fill in details, edit more after adding</Text>
              </View>
              <Pressable onPress={handleClose} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <CloseIcon />
              </Pressable>
            </View>

            {/* Name */}
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#9A8FA6', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
              Full Name *
            </Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. John Doe"
              placeholderTextColor="#C8BFB0"
              autoFocus
              maxLength={100}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: '#1A1625',
                borderWidth: 1,
                borderColor: '#DDD6C9',
                marginBottom: 20,
              }}
            />

            {/* Stage */}
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#9A8FA6', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
              Initial Status
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                {STAGE_ORDER.map((s) => {
                  const cfg    = STAGE_CONFIG[s]
                  const active = stage === s
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setStage(s)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: active ? cfg.bg : '#FFFFFF',
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderWidth: 1.5,
                        borderColor: active ? cfg.color : '#DDD6C9',
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cfg.color }} />
                      <Text style={{ color: active ? cfg.color : '#5A4F6E', fontSize: 12, fontWeight: active ? '700' : '500' }}>
                        {cfg.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => ({
                  flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9',
                  paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: '#5A4F6E', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={isPending || !label.trim()}
                style={({ pressed }) => ({
                  flex: 1, borderRadius: 14,
                  backgroundColor: label.trim() ? '#FF6240' : '#DDD6C9',
                  paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.8 : 1,
                })}
              >
                {isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Add Candidate</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Segmented Tab Bar ────────────────────────────────────────────────────────
interface TabBarProps {
  activeTab:    TabKey
  onTabChange:  (t: TabKey) => void
  rowCount:     number
}

function TabBar({ activeTab, onTabChange, rowCount }: TabBarProps) {
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 0 }}>
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#EDE7DB',
        borderRadius: 14,
        padding: 3,
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          const badge    = tab.key === 'data' && rowCount > 0

          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              style={({ pressed }) => ({
                flex: 1,
                borderRadius: 11,
                paddingVertical: 8,
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 5,
                opacity: pressed ? 0.85 : 1,
                shadowColor: isActive ? '#1A1625' : 'transparent',
                shadowOpacity: isActive ? 0.08 : 0,
                shadowRadius: isActive ? 6 : 0,
                shadowOffset: { width: 0, height: 2 },
              })}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: isActive ? '700' : '500',
                color: isActive ? '#1A1625' : '#9A8FA6',
                letterSpacing: -0.1,
              }}>
                {tab.label}
              </Text>
              {badge && (
                <View style={{
                  backgroundColor: isActive ? '#FF6240' : '#C8BFB0',
                  borderRadius: 8,
                  minWidth: 18,
                  height: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 5,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{rowCount}</Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AtsTableDetailScreen() {
  const { id: tableId }   = useLocalSearchParams<{ id: string }>()
  const queryClient       = useQueryClient()
  const [activeTab, setActiveTab]   = useState<TabKey>('data')
  const [showAddRow, setShowAddRow] = useState(false)

  // ── Table name ──────────────────────────────────────────────────────────────
  const { data: tableName } = useQuery({
    queryKey: ['ats-table-name', tableId],
    enabled: !!tableId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ats_tables')
        .select('name')
        .eq('id', tableId!)
        .maybeSingle()
      return (data as { name: string } | null)?.name ?? 'Table'
    },
  })

  // ── Rows ────────────────────────────────────────────────────────────────────
  const { data: rows, isLoading } = useQuery({
    queryKey: ['ats-rows', tableId],
    enabled: !!tableId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ats_rows')
        .select('id, table_id, candidate_id, label, stage, notes, data, created_at')
        .eq('table_id', tableId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as AtsRow[]
    },
  })

  // ── Add row ─────────────────────────────────────────────────────────────────
  const { mutate: addRow, isPending: isAdding } = useMutation({
    mutationFn: async ({ label, stage }: { label: string; stage: RowStage }) => {
      const { error } = await supabase.from('ats_rows').insert({
        table_id: tableId!,
        label,
        stage,
        notes: null,
        data: null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] })
      void queryClient.invalidateQueries({ queryKey: ['ats-tables'] })
      setShowAddRow(false)
    },
    onError: () => Alert.alert('Error', 'Could not add candidate. Please try again.'),
  })

  // ── Update stage ─────────────────────────────────────────────────────────────
  const { mutate: updateStage, isPending: isUpdatingStage } = useMutation({
    mutationFn: async ({ id, stage, candidateId }: { id: string; stage: RowStage; candidateId: string | null }) => {
      const { error } = await supabase
        .from('ats_rows')
        .update({ stage, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error

      if (candidateId) {
        const stageCfg = STAGE_CONFIG[stage]
        await supabase.from('notifications').insert({
          user_id:    candidateId,
          type:       'application_status_changed',
          title:      'Your application status has been updated',
          body:       `Your application has been moved to ${stageCfg.label}.`,
          data:       { stage, table_id: tableId },
          action_url: null,
        })
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] }),
    onError: ()  => Alert.alert('Error', 'Could not update status. Please try again.'),
  })

  // ── Update row (label + notes + extra data) ────────────────────────────────
  const { mutate: updateRow, isPending: isSavingRow } = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<{ label: string; notes: string; data: AtsRowData }>
    }) => {
      const existing = (rows ?? []).find((r) => r.id === id)
      const mergedData = patch.data
        ? { ...(existing?.data ?? {}), ...patch.data }
        : undefined

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.label !== undefined) update.label = patch.label
      if (patch.notes !== undefined) update.notes = patch.notes || null
      if (mergedData !== undefined) update.data   = mergedData

      const { error } = await supabase.from('ats_rows').update(update).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] }),
    onError: ()  => Alert.alert('Error', 'Could not save changes. Please try again.'),
  })

  // ── Delete row ───────────────────────────────────────────────────────────────
  const { mutate: deleteRow } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ats_rows').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] })
      void queryClient.invalidateQueries({ queryKey: ['ats-tables'] })
    },
    onError: () => Alert.alert('Error', 'Could not remove row. Please try again.'),
  })

  // ── Callbacks ─────────────────────────────────────────────────────────────────
  const handleStatusUpdate = useCallback((id: string, stage: RowStage, candidateId: string | null) => {
    updateStage({ id, stage, candidateId })
  }, [updateStage])

  const handleRowUpdate = useCallback((
    id: string,
    patch: Partial<{ label: string; notes: string; data: AtsRowData }>,
  ) => {
    updateRow({ id, patch })
  }, [updateRow])

  const handleDeleteRow = useCallback((id: string, label: string) => {
    Alert.alert(
      'Remove Candidate',
      `Remove "${label}" from this table?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteRow(id) },
      ],
    )
  }, [deleteRow])

  const handleAddRow = useCallback(() => setShowAddRow(true), [])

  const handleAddRowSubmit = useCallback((label: string, stage: RowStage) => {
    addRow({ label, stage })
  }, [addRow])

  const safeRows = rows ?? []

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }} edges={['top']}>

      {/* ── Screen header — no Add Row button here ── */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 16,
        gap: 12,
      }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: '#EDE7DB',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <ArrowLeft />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#1A1625', letterSpacing: -0.3 }} numberOfLines={1}>
            {tableName ?? '…'}
          </Text>
          <Text style={{ fontSize: 11, color: '#9A8FA6', marginTop: 1 }}>
            {safeRows.length} {safeRows.length === 1 ? 'candidate' : 'candidates'}
          </Text>
        </View>
      </View>

      {/* ── Segmented tab bar ── */}
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        rowCount={safeRows.length}
      />

      {/* ── 12px gap below tab bar ── */}
      <View style={{ height: 12 }} />

      {/* ── Active tab content ── */}
      <View style={{ flex: 1 }}>
        {activeTab === 'overview' && (
          <OverviewTab rows={safeRows} />
        )}

        {activeTab === 'data' && (
          <DataTab
            rows={safeRows}
            isLoading={isLoading}
            onStatusUpdate={handleStatusUpdate}
            onRowUpdate={handleRowUpdate}
            onDeleteRow={handleDeleteRow}
            onAddRow={handleAddRow}
            isUpdatingStatus={isUpdatingStage}
            isSavingRow={isSavingRow}
          />
        )}

        {activeTab === 'analysis' && (
          <AnalysisTab rows={safeRows} />
        )}
      </View>

      {/* ── Add Row Modal ── */}
      <AddRowModal
        visible={showAddRow}
        onClose={() => setShowAddRow(false)}
        onSubmit={handleAddRowSubmit}
        isPending={isAdding}
      />
    </SafeAreaView>
  )
}
