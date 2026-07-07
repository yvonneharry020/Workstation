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

import { AtsRow, RowStage, STAGE_CONFIG, STAGE_ORDER } from '@/components/ats/types'
import { OverviewTab }  from '@/components/ats/OverviewTab'
import { DataTab }      from '@/components/ats/DataTab'
import { AnalysisTab }  from '@/components/ats/AnalysisTab'

// ─── Types ────────────────────────────────────────────────────────────────────
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

function PlusIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
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
  visible: boolean
  onClose: () => void
  onSubmit: (label: string, stage: RowStage, notes: string) => void
  isPending: boolean
}

function AddRowModal({ visible, onClose, onSubmit, isPending }: AddRowModalProps) {
  const [label, setLabel]   = useState('')
  const [stage, setStage]   = useState<RowStage>('prospect')
  const [notes, setNotes]   = useState('')

  const handleSubmit = useCallback(() => {
    if (!label.trim()) return
    onSubmit(label.trim(), stage, notes.trim())
    setLabel('')
    setStage('prospect')
    setNotes('')
  }, [label, stage, notes, onSubmit])

  const handleClose = useCallback(() => {
    setLabel('')
    setStage('prospect')
    setNotes('')
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
            paddingTop: 20,
            paddingBottom: 44,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1625' }}>Add Candidate Row</Text>
              <Pressable onPress={handleClose} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <CloseIcon />
              </Pressable>
            </View>

            {/* Candidate name */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#5A4F6E', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
              Candidate name *
            </Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. John Doe"
              placeholderTextColor="#9A8FA6"
              autoFocus
              maxLength={100}
              style={{
                backgroundColor: '#EDE7DB',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                color: '#1A1625',
                borderWidth: 1,
                borderColor: '#C8BFB0',
                marginBottom: 16,
              }}
            />

            {/* Stage */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#5A4F6E', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
              Stage
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                {STAGE_ORDER.map((s) => {
                  const cfg    = STAGE_CONFIG[s]
                  const active = stage === s
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setStage(s)}
                      style={({ pressed }) => ({
                        backgroundColor: active ? cfg.bg : '#EDE7DB',
                        borderRadius: 20,
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderWidth: 1,
                        borderColor: active ? cfg.color : '#C8BFB0',
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text style={{ color: active ? cfg.color : '#5A4F6E', fontSize: 12, fontWeight: active ? '700' : '500' }}>
                        {cfg.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </ScrollView>

            {/* Notes */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#5A4F6E', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
              Notes (optional)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any notes about this candidate…"
              placeholderTextColor="#9A8FA6"
              multiline
              maxLength={500}
              style={{
                backgroundColor: '#EDE7DB',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                color: '#1A1625',
                borderWidth: 1,
                borderColor: '#C8BFB0',
                height: 80,
                textAlignVertical: 'top',
                marginBottom: 20,
              }}
            />

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#C8BFB0',
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: '#5A4F6E', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={isPending || !label.trim()}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: 14,
                  backgroundColor: label.trim() ? '#FF6240' : '#DDD6C9',
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                {isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Add Row</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
        .select('id, table_id, candidate_id, label, stage, notes, created_at')
        .eq('table_id', tableId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as AtsRow[]
    },
  })

  // ── Add row ─────────────────────────────────────────────────────────────────
  const { mutate: addRow, isPending: isAdding } = useMutation({
    mutationFn: async ({ label, stage, notes }: { label: string; stage: RowStage; notes: string }) => {
      const { error } = await supabase.from('ats_rows').insert({
        table_id: tableId!,
        label,
        stage,
        notes: notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] })
      void queryClient.invalidateQueries({ queryKey: ['ats-tables'] })
      setShowAddRow(false)
    },
    onError: () => Alert.alert('Error', 'Could not add row. Please try again.'),
  })

  // ── Update stage ─────────────────────────────────────────────────────────────
  const { mutate: updateStage, isPending: isUpdatingStage } = useMutation({
    mutationFn: async ({ id, stage, candidateId }: { id: string; stage: RowStage; candidateId: string | null }) => {
      const { error } = await supabase
        .from('ats_rows')
        .update({ stage, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error

      // If this row is linked to a real candidate, send them a notification
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] })
    },
    onError: () => Alert.alert('Error', 'Could not update stage. Please try again.'),
  })

  // ── Update notes ─────────────────────────────────────────────────────────────
  const { mutate: updateNotes, isPending: isUpdatingNotes } = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('ats_rows')
        .update({ notes: notes || null, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] })
    },
    onError: () => Alert.alert('Error', 'Could not save notes. Please try again.'),
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
    onError: () => Alert.alert('Error', 'Could not delete row. Please try again.'),
  })

  // ── Callbacks for child tabs ─────────────────────────────────────────────────
  const handleStageUpdate = useCallback((id: string, stage: RowStage) => {
    const row = (rows ?? []).find((r) => r.id === id)
    updateStage({ id, stage, candidateId: row?.candidate_id ?? null })
  }, [rows, updateStage])

  const handleNotesUpdate = useCallback((id: string, notes: string) => {
    updateNotes({ id, notes })
  }, [updateNotes])

  const handleDeleteRow = useCallback((id: string, label: string) => {
    Alert.alert(
      'Remove row',
      `Remove "${label}" from this table?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteRow(id) },
      ],
    )
  }, [deleteRow])

  const handleAddRow = useCallback(() => {
    setShowAddRow(true)
  }, [])

  const handleAddRowSubmit = useCallback((label: string, stage: RowStage, notes: string) => {
    addRow({ label, stage, notes })
  }, [addRow])

  const safeRows = rows ?? []

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }} edges={['top']}>

      {/* ── Screen header ── */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 12,
      }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ArrowLeft />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A1625', letterSpacing: -0.3 }} numberOfLines={1}>
            {tableName ?? '…'}
          </Text>
          <Text style={{ fontSize: 11, color: '#9A8FA6', marginTop: 1 }}>
            {safeRows.length} {safeRows.length === 1 ? 'candidate' : 'candidates'}
          </Text>
        </View>

        {/* Add row CTA — always visible */}
        <Pressable
          onPress={handleAddRow}
          style={({ pressed }) => ({
            backgroundColor: '#FF6240',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 7,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <PlusIcon />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Add Row</Text>
        </Pressable>
      </View>

      {/* ── Tab bar ── */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 12,
        gap: 8,
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          const badge    = tab.key === 'data' && safeRows.length > 0 ? ` (${safeRows.length})` : ''
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 9,
                borderRadius: 12,
                backgroundColor: isActive ? '#FF6240' : '#EDE7DB',
                borderWidth: 1,
                borderColor: isActive ? '#FF6240' : '#C8BFB0',
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{
                color: isActive ? '#fff' : '#5A4F6E',
                fontSize: 12,
                fontWeight: isActive ? '700' : '500',
              }}>
                {tab.label}{badge}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* ── Divider ── */}
      <View style={{ height: 1, backgroundColor: '#C8BFB0' }} />

      {/* ── Active tab content ── */}
      {activeTab === 'overview' && (
        <OverviewTab rows={safeRows} />
      )}

      {activeTab === 'data' && (
        <DataTab
          rows={safeRows}
          isLoading={isLoading}
          onStageUpdate={handleStageUpdate}
          onNotesUpdate={handleNotesUpdate}
          onDeleteRow={handleDeleteRow}
          onAddRow={handleAddRow}
          isUpdatingStage={isUpdatingStage}
          isUpdatingNotes={isUpdatingNotes}
        />
      )}

      {activeTab === 'analysis' && (
        <AnalysisTab rows={safeRows} />
      )}

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
