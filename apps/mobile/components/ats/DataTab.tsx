import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { AtsRow, STAGE_CONFIG, STAGE_ORDER, RowStage } from './types'

// ─── Column layout ────────────────────────────────────────────────────────────
const COL_NUM   = 38
const COL_NAME  = 158
const COL_STAGE = 118
const COL_NOTES = 158
const COL_ADDED = 82
const TOTAL_W   = COL_NUM + COL_NAME + COL_STAGE + COL_NOTES + COL_ADDED // 554

const ROW_H    = 50
const HEADER_H = 40

// Heights we subtract to get the scrollable grid body height
// (safe-area top ~44 + screen header ~56 + tab bar ~52 + grid header HEADER_H + footer ~36)
const CHROME_H = 44 + 56 + 52 + HEADER_H + 36

// ─── Icons ───────────────────────────────────────────────────────────────────
function ChevronDownIcon() {
  return (
    <Svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="#5A4F6E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  )
}

function PlusIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function TrashIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </Svg>
  )
}

// ─── Header cell ─────────────────────────────────────────────────────────────
interface HeaderCellProps {
  label: string
  width: number
  isLast?: boolean
}

function HeaderCell({ label, width, isLast }: HeaderCellProps) {
  return (
    <View style={{
      width,
      height: HEADER_H,
      justifyContent: 'center',
      paddingHorizontal: 10,
      backgroundColor: '#DDD6C9',
      borderRightWidth: isLast ? 0 : 1,
      borderRightColor: '#C8BFB0',
    }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: '#5A4F6E', letterSpacing: 0.9, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  )
}

// ─── Grid row ─────────────────────────────────────────────────────────────────
interface GridRowProps {
  row: AtsRow
  index: number
  onStagePress: (row: AtsRow) => void
  onNotesPress: (row: AtsRow) => void
  onDeletePress: (row: AtsRow) => void
  isEven: boolean
}

function GridRow({ row, index, onStagePress, onNotesPress, onDeletePress, isEven }: GridRowProps) {
  const cfg   = STAGE_CONFIG[row.stage] ?? STAGE_CONFIG.prospect
  const rowBg = isEven ? '#F5F0E8' : '#EDE7DB'

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diff / 86_400_000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yest.'
    if (days < 7)  return `${days}d`
    return `${Math.floor(days / 7)}w`
  }

  const borderBottom = { borderBottomWidth: 1, borderBottomColor: '#DDD6C9' } as const
  const borderRight  = { borderRightWidth: 1, borderRightColor: '#C8BFB0' } as const

  return (
    <View style={{ flexDirection: 'row', height: ROW_H, backgroundColor: rowBg }}>
      {/* # */}
      <View style={[{ width: COL_NUM, alignItems: 'center', justifyContent: 'center' }, borderRight, borderBottom]}>
        <Text style={{ fontSize: 11, color: '#9A8FA6', fontWeight: '500' }}>{index + 1}</Text>
      </View>

      {/* Candidate name */}
      <View style={[{ width: COL_NAME, justifyContent: 'center', paddingHorizontal: 10 }, borderRight, borderBottom]}>
        <Text style={{ fontSize: 13, color: '#1A1625', fontWeight: '500' }} numberOfLines={1}>
          {row.label}
        </Text>
      </View>

      {/* Stage — tappable */}
      <Pressable
        onPress={() => onStagePress(row)}
        style={({ pressed }) => [
          { width: COL_STAGE, justifyContent: 'center', paddingHorizontal: 8, opacity: pressed ? 0.7 : 1 },
          borderRight,
          borderBottom,
        ]}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          backgroundColor: cfg.bg,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 5,
          borderWidth: 1,
          borderColor: cfg.color + '50',
        }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: cfg.color }}>
            {cfg.label}
          </Text>
          <ChevronDownIcon />
        </View>
      </Pressable>

      {/* Notes — tappable */}
      <Pressable
        onPress={() => onNotesPress(row)}
        style={({ pressed }) => [
          { width: COL_NOTES, justifyContent: 'center', paddingHorizontal: 10, opacity: pressed ? 0.7 : 1 },
          borderRight,
          borderBottom,
        ]}
      >
        {row.notes ? (
          <Text style={{ fontSize: 11, color: '#5A4F6E', lineHeight: 15 }} numberOfLines={2}>
            {row.notes}
          </Text>
        ) : (
          <Text style={{ fontSize: 11, color: '#C8BFB0', fontStyle: 'italic' }}>
            Add note…
          </Text>
        )}
      </Pressable>

      {/* Added + delete */}
      <View style={[{ width: COL_ADDED, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 }, borderBottom]}>
        <Text style={{ flex: 1, fontSize: 10, color: '#9A8FA6' }} numberOfLines={1}>
          {timeAgo(row.created_at)}
        </Text>
        <Pressable
          onPress={() => onDeletePress(row)}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <TrashIcon />
        </Pressable>
      </View>
    </View>
  )
}

// ─── Stage picker bottom sheet ────────────────────────────────────────────────
interface StagePickerProps {
  visible: boolean
  currentStage: RowStage
  onSelect: (stage: RowStage) => void
  onClose: () => void
  isPending: boolean
}

function StagePicker({ visible, currentStage, onSelect, onClose, isPending }: StagePickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{
            backgroundColor: '#F5F0E8',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 44,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1625', marginBottom: 16 }}>
              Move to stage
            </Text>

            {STAGE_ORDER.map((stage) => {
              const cfg      = STAGE_CONFIG[stage]
              const isActive = stage === currentStage
              return (
                <Pressable
                  key={stage}
                  onPress={() => onSelect(stage)}
                  disabled={isPending}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderRadius: 14,
                    marginBottom: 8,
                    backgroundColor: isActive ? cfg.bg : '#EDE7DB',
                    borderWidth: 1,
                    borderColor: isActive ? cfg.color + '60' : '#C8BFB0',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cfg.color, marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: isActive ? '700' : '500', color: isActive ? cfg.color : '#1A1625' }}>
                    {cfg.label}
                  </Text>
                  {isActive && !isPending && (
                    <View style={{ backgroundColor: cfg.color, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Current</Text>
                    </View>
                  )}
                  {isPending && isActive && (
                    <ActivityIndicator size="small" color={cfg.color} />
                  )}
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Notes editor bottom sheet ────────────────────────────────────────────────
interface NotesEditorProps {
  visible: boolean
  initial: string
  candidateName: string
  onSave: (notes: string) => void
  onClose: () => void
  isSaving: boolean
}

function NotesEditor({ visible, initial, candidateName, onSave, onClose, isSaving }: NotesEditorProps) {
  const [text, setText] = useState(initial)

  useEffect(() => {
    if (visible) setText(initial)
  }, [visible, initial])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#F5F0E8',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 44,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1625', marginBottom: 4 }}>
              Notes
            </Text>
            <Text style={{ fontSize: 12, color: '#5A4F6E', marginBottom: 16 }}>
              {candidateName}
            </Text>

            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder="Write notes about this candidate…"
              placeholderTextColor="#9A8FA6"
              autoFocus
              style={{
                backgroundColor: '#EDE7DB',
                borderRadius: 14,
                padding: 14,
                fontSize: 14,
                color: '#1A1625',
                borderWidth: 1,
                borderColor: '#C8BFB0',
                height: 120,
                textAlignVertical: 'top',
                marginBottom: 16,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={onClose}
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
                onPress={() => onSave(text)}
                disabled={isSaving}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: 14,
                  backgroundColor: '#FF6240',
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── DataTab ──────────────────────────────────────────────────────────────────
export interface DataTabProps {
  rows: AtsRow[]
  isLoading: boolean
  onStageUpdate: (id: string, stage: RowStage) => void
  onNotesUpdate: (id: string, notes: string) => void
  onDeleteRow:   (id: string, label: string) => void
  onAddRow:      () => void
  isUpdatingStage: boolean
  isUpdatingNotes: boolean
}

export function DataTab({
  rows,
  isLoading,
  onStageUpdate,
  onNotesUpdate,
  onDeleteRow,
  onAddRow,
  isUpdatingStage,
  isUpdatingNotes,
}: DataTabProps) {
  const { height } = useWindowDimensions()
  const gridBodyH  = height - CHROME_H

  const headerScrollRef = useRef<ScrollView>(null)

  const [stagePicker, setStagePicker] = useState<{ visible: boolean; row: AtsRow | null }>({
    visible: false,
    row: null,
  })
  const [notesEditor, setNotesEditor] = useState<{ visible: boolean; row: AtsRow | null }>({
    visible: false,
    row: null,
  })

  const handleStagePress  = useCallback((row: AtsRow) => setStagePicker({ visible: true, row }), [])
  const handleNotesPress  = useCallback((row: AtsRow) => setNotesEditor({ visible: true, row }), [])
  const handleDeletePress = useCallback((row: AtsRow) => onDeleteRow(row.id, row.label), [onDeleteRow])

  const handleStageSelect = useCallback((stage: RowStage) => {
    if (!stagePicker.row) return
    onStageUpdate(stagePicker.row.id, stage)
    setStagePicker({ visible: false, row: null })
  }, [stagePicker.row, onStageUpdate])

  const handleNotesSave = useCallback((notes: string) => {
    if (!notesEditor.row) return
    onNotesUpdate(notesEditor.row.id, notes)
    setNotesEditor({ visible: false, row: null })
  }, [notesEditor.row, onNotesUpdate])

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF6240" size="large" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#C8BFB0' }}>

        {/* ── Frozen header row (mirrors horizontal scroll of body) ── */}
        <ScrollView
          ref={headerScrollRef}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          bounces={false}
        >
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#C8BFB0' }}>
            <HeaderCell label="#"         width={COL_NUM}   />
            <HeaderCell label="Candidate" width={COL_NAME}  />
            <HeaderCell label="Stage"     width={COL_STAGE} />
            <HeaderCell label="Notes"     width={COL_NOTES} />
            <HeaderCell label="Added"     width={COL_ADDED} isLast />
          </View>
        </ScrollView>

        {/* ── Grid body: horizontal scroll + vertical scroll ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={(e) => {
            headerScrollRef.current?.scrollTo({
              x: e.nativeEvent.contentOffset.x,
              animated: false,
            })
          }}
          scrollEventThrottle={16}
        >
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={{ width: TOTAL_W, height: gridBodyH }}
          >
            {rows.length === 0 ? (
              <View style={{ width: TOTAL_W, height: 200, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '600' }}>
                  No rows yet
                </Text>
                <Text style={{ color: '#9A8FA6', fontSize: 12 }}>
                  Tap "+ Add row" below to start tracking
                </Text>
              </View>
            ) : (
              rows.map((row, index) => (
                <GridRow
                  key={row.id}
                  row={row}
                  index={index}
                  onStagePress={handleStagePress}
                  onNotesPress={handleNotesPress}
                  onDeletePress={handleDeletePress}
                  isEven={index % 2 === 0}
                />
              ))
            )}

            {/* + Add row button at bottom of grid */}
            <Pressable
              onPress={onAddRow}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 12,
                height: ROW_H,
                borderBottomWidth: 1,
                borderBottomColor: '#DDD6C9',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <PlusIcon />
              <Text style={{ fontSize: 12, color: '#FF6240', fontWeight: '600' }}>
                Add row
              </Text>
            </Pressable>
          </ScrollView>
        </ScrollView>

        {/* ── Footer ── */}
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: '#C8BFB0',
        }}>
          <Text style={{ fontSize: 11, color: '#9A8FA6' }}>
            {rows.length} {rows.length === 1 ? 'record' : 'records'}
          </Text>
        </View>
      </View>

      {/* ── Stage picker modal ── */}
      <StagePicker
        visible={stagePicker.visible}
        currentStage={(stagePicker.row?.stage as RowStage) ?? 'prospect'}
        onSelect={handleStageSelect}
        onClose={() => setStagePicker({ visible: false, row: null })}
        isPending={isUpdatingStage}
      />

      {/* ── Notes editor modal ── */}
      <NotesEditor
        visible={notesEditor.visible}
        initial={notesEditor.row?.notes ?? ''}
        candidateName={notesEditor.row?.label ?? ''}
        onSave={handleNotesSave}
        onClose={() => setNotesEditor({ visible: false, row: null })}
        isSaving={isUpdatingNotes}
      />
    </View>
  )
}
