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
  Linking,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { AtsRow, AtsRowData, STAGE_CONFIG, STAGE_ORDER, RowStage } from './types'

// ─── Column definitions ───────────────────────────────────────────────────────
const COLS = [
  { key: 'num',          label: '#',            width: 36,  align: 'center' as const },
  { key: 'label',        label: 'Full Name',    width: 140, align: 'left'   as const },
  { key: 'email',        label: 'Email',        width: 165, align: 'left'   as const },
  { key: 'phone',        label: 'Phone',        width: 120, align: 'left'   as const },
  { key: 'location',     label: 'Location',     width: 120, align: 'left'   as const },
  { key: 'role',         label: 'Role',         width: 130, align: 'left'   as const },
  { key: 'cover_letter', label: 'Cover Letter', width: 190, align: 'left'   as const },
  { key: 'profile',      label: 'Profile',      width: 90,  align: 'center' as const },
  { key: 'stage',        label: 'Status',       width: 120, align: 'left'   as const },
  { key: 'notes',        label: 'Notes',        width: 180, align: 'left'   as const },
] as const

type ColKey = typeof COLS[number]['key']

const TOTAL_W       = COLS.reduce((s, c) => s + c.width, 0)  // 1,291
const ROW_MIN_H     = 56
const HEADER_H      = 44
const CHROME_H      = 44 + 60 + 52 + HEADER_H + 48   // safe + screen header + tab bar + grid header + footer

// ─── Icons ────────────────────────────────────────────────────────────────────
function ChevronDown() {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" stroke="#6366F1" />
    </Svg>
  )
}

function EditIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#9A8FA6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  )
}

function LinkIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <Path d="M15 3h6v6" />
      <Path d="M10 14L21 3" />
    </Svg>
  )
}

function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  )
}

// ─── Grid header row ──────────────────────────────────────────────────────────
function GridHeader() {
  return (
    <View style={{ flexDirection: 'row', height: HEADER_H, backgroundColor: '#1A1625' }}>
      {COLS.map((col, i) => (
        <View
          key={col.key}
          style={{
            width: col.width,
            height: HEADER_H,
            justifyContent: 'center',
            paddingHorizontal: col.key === 'num' ? 0 : 10,
            alignItems: col.key === 'num' ? 'center' : 'flex-start',
            borderRightWidth: i < COLS.length - 1 ? 1 : 0,
            borderRightColor: '#2D2646',
          }}
        >
          <Text style={{
            fontSize: 9,
            fontWeight: '700',
            color: '#9A8FA6',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            {col.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

// ─── Cell renderer ────────────────────────────────────────────────────────────
interface CellProps {
  colKey: ColKey
  row: AtsRow
  isEven: boolean
  onStatusPress: () => void
  onEditPress:   () => void
}

function Cell({ colKey, row, isEven, onStatusPress, onEditPress }: CellProps) {
  const rowBg   = isEven ? '#FFFFFF' : '#F9F7F4'
  const d       = row.data ?? {}
  const baseStyle = {
    backgroundColor: rowBg,
    borderRightColor: '#E5DFD3',
    borderBottomColor: '#E5DFD3',
    borderBottomWidth: 1 as const,
  }

  if (colKey === 'num') {
    return (
      <View style={[baseStyle, { width: 36, minHeight: ROW_MIN_H, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1 }]}>
        <Text style={{ fontSize: 11, color: '#C8BFB0', fontWeight: '600' }}>
          {/* index passed separately */}
        </Text>
      </View>
    )
  }

  if (colKey === 'stage') {
    const cfg = STAGE_CONFIG[row.stage]
    return (
      <Pressable
        onPress={onStatusPress}
        style={({ pressed }) => [
          baseStyle,
          { width: 120, minHeight: ROW_MIN_H, justifyContent: 'center', paddingHorizontal: 8, borderRightWidth: 1, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: cfg.bg,
          borderRadius: 7,
          paddingHorizontal: 8,
          paddingVertical: 5,
          borderWidth: 1,
          borderColor: cfg.border,
          alignSelf: 'flex-start',
        }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.color }} />
          <Text style={{ fontSize: 10, fontWeight: '700', color: cfg.color }} numberOfLines={1}>
            {cfg.label}
          </Text>
          <ChevronDown />
        </View>
      </Pressable>
    )
  }

  if (colKey === 'profile') {
    const url = d.profile_url
    return (
      <Pressable
        onPress={() => url ? Linking.openURL(url) : onEditPress()}
        style={({ pressed }) => [
          baseStyle,
          { width: 90, minHeight: ROW_MIN_H, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {url ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <LinkIcon />
            <Text style={{ fontSize: 10, color: '#FF6240', fontWeight: '600' }}>View</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 10, color: '#C8BFB0', fontStyle: 'italic' }}>—</Text>
        )}
      </Pressable>
    )
  }

  // Text columns
  const colMap: Record<string, string | null | undefined> = {
    label:        row.label,
    email:        d.email,
    phone:        d.phone,
    location:     d.location,
    role:         d.role,
    cover_letter: d.cover_letter,
    notes:        row.notes,
  }
  const value = colMap[colKey]
  const col   = COLS.find((c) => c.key === colKey)!

  return (
    <Pressable
      onPress={onEditPress}
      style={({ pressed }) => [
        baseStyle,
        {
          width: col.width,
          minHeight: ROW_MIN_H,
          justifyContent: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 10,
          borderRightWidth: colKey === 'notes' ? 0 : 1,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {value ? (
        <Text style={{ fontSize: 12, color: '#1A1625', lineHeight: 17, flexWrap: 'wrap' }}>
          {value}
        </Text>
      ) : (
        <Text style={{ fontSize: 12, color: '#D4CCBE', fontStyle: 'italic' }}>—</Text>
      )}
    </Pressable>
  )
}

// ─── Grid row ─────────────────────────────────────────────────────────────────
interface GridRowProps {
  row:           AtsRow
  index:         number
  onStatusPress: (row: AtsRow) => void
  onEditPress:   (row: AtsRow) => void
  isEven:        boolean
}

function GridRow({ row, index, onStatusPress, onEditPress, isEven }: GridRowProps) {
  const rowBg = isEven ? '#FFFFFF' : '#F9F7F4'
  return (
    <View style={{ flexDirection: 'row', backgroundColor: rowBg }}>
      {/* Row number */}
      <View style={{ width: 36, minHeight: ROW_MIN_H, alignItems: 'center', justifyContent: 'center', backgroundColor: rowBg, borderRightWidth: 1, borderRightColor: '#E5DFD3', borderBottomWidth: 1, borderBottomColor: '#E5DFD3' }}>
        <Text style={{ fontSize: 11, color: '#C8BFB0', fontWeight: '600' }}>{index + 1}</Text>
      </View>

      {COLS.slice(1).map((col) => (
        <Cell
          key={col.key}
          colKey={col.key}
          row={row}
          isEven={isEven}
          onStatusPress={() => onStatusPress(row)}
          onEditPress={() => onEditPress(row)}
        />
      ))}
    </View>
  )
}

// ─── Status picker ─────────────────────────────────────────────────────────────
interface StatusPickerProps {
  visible:      boolean
  row:          AtsRow | null
  onSelect:     (stage: RowStage) => void
  onClose:      () => void
  isPending:    boolean
}

function StatusPicker({ visible, row, onSelect, onClose, isPending }: StatusPickerProps) {
  if (!row) return null
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 12,
            paddingBottom: 44,
          }}>
            {/* Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD6C9', alignSelf: 'center', marginBottom: 20 }} />

            <View style={{ paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A1625', marginBottom: 4 }}>
                Update Status
              </Text>
              <Text style={{ fontSize: 12, color: '#9A8FA6', marginBottom: 20 }} numberOfLines={1}>
                {row.label}
              </Text>

              {STAGE_ORDER.map((stage) => {
                const cfg      = STAGE_CONFIG[stage]
                const isActive = stage === row.stage
                return (
                  <Pressable
                    key={stage}
                    onPress={() => onSelect(stage)}
                    disabled={isPending}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      marginBottom: 8,
                      backgroundColor: isActive ? cfg.bg : '#F9F7F4',
                      borderWidth: 1.5,
                      borderColor: isActive ? cfg.color : '#E5DFD3',
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    {/* Colored left indicator */}
                    <View style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: cfg.color,
                      marginRight: 14,
                      flexShrink: 0,
                    }} />

                    {/* Label */}
                    <Text style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: isActive ? '700' : '500',
                      color: isActive ? cfg.color : '#1A1625',
                    }}>
                      {cfg.label}
                    </Text>

                    {/* Selected indicator */}
                    {isActive && !isPending && (
                      <CheckIcon color={cfg.color} />
                    )}
                    {isActive && isPending && (
                      <ActivityIndicator size="small" color={cfg.color} />
                    )}
                  </Pressable>
                )
              })}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Edit Row Modal ────────────────────────────────────────────────────────────
interface EditRowModalProps {
  visible:   boolean
  row:       AtsRow | null
  onSave:    (id: string, patch: Partial<{ label: string; notes: string; data: AtsRowData }>) => void
  onDelete:  (id: string, label: string) => void
  onClose:   () => void
  isSaving:  boolean
}

function EditRowModal({ visible, row, onSave, onDelete, onClose, isSaving }: EditRowModalProps) {
  const [label,       setLabel]       = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [location,    setLocation]    = useState('')
  const [role,        setRole]        = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [profileUrl,  setProfileUrl]  = useState('')
  const [notes,       setNotes]       = useState('')

  useEffect(() => {
    if (visible && row) {
      setLabel(row.label)
      setEmail(row.data?.email ?? '')
      setPhone(row.data?.phone ?? '')
      setLocation(row.data?.location ?? '')
      setRole(row.data?.role ?? '')
      setCoverLetter(row.data?.cover_letter ?? '')
      setProfileUrl(row.data?.profile_url ?? '')
      setNotes(row.notes ?? '')
    }
  }, [visible, row])

  const handleSave = useCallback(() => {
    if (!row || !label.trim()) return
    onSave(row.id, {
      label: label.trim(),
      notes: notes.trim() || undefined,
      data: {
        email:        email.trim()       || undefined,
        phone:        phone.trim()       || undefined,
        location:     location.trim()    || undefined,
        role:         role.trim()        || undefined,
        cover_letter: coverLetter.trim() || undefined,
        profile_url:  profileUrl.trim()  || undefined,
      },
    })
  }, [row, label, email, phone, location, role, coverLetter, profileUrl, notes, onSave])

  if (!row) return null

  const field = (label: string, value: string, onChange: (v: string) => void, opts?: { multiline?: boolean; placeholder?: string }) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: '#9A8FA6', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={opts?.placeholder ?? `Enter ${label.toLowerCase()}…`}
        placeholderTextColor="#C8BFB0"
        multiline={opts?.multiline}
        style={{
          backgroundColor: '#F5F0E8',
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 11,
          fontSize: 14,
          color: '#1A1625',
          borderWidth: 1,
          borderColor: '#DDD6C9',
          ...(opts?.multiline && { height: 90, textAlignVertical: 'top' }),
        }}
      />
    </View>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#F5F0E8',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '92%',
          }}>
            {/* Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD6C9', alignSelf: 'center', marginTop: 12, marginBottom: 16 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A1625' }}>Edit Candidate</Text>
                <Text style={{ fontSize: 12, color: '#9A8FA6', marginTop: 2 }}>Tap any field to update</Text>
              </View>
              <Pressable
                onPress={() => onDelete(row.id, row.label)}
                style={({ pressed }) => ({
                  backgroundColor: '#FEE2E2',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>Remove</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {field('Full Name *', label,       setLabel,       { placeholder: 'e.g. John Doe' })}
              {field('Email',        email,       setEmail,       { placeholder: 'email@example.com' })}
              {field('Phone',        phone,       setPhone,       { placeholder: '+234 800 000 0000' })}
              {field('Location',     location,    setLocation,    { placeholder: 'e.g. Lagos, Nigeria' })}
              {field('Role Applied', role,        setRole,        { placeholder: 'e.g. Senior Engineer' })}
              {field('Cover Letter', coverLetter, setCoverLetter, { multiline: true, placeholder: 'Paste or summarise…' })}
              {field('Profile URL',  profileUrl,  setProfileUrl,  { placeholder: 'https://linkedin.com/in/…' })}
              {field('Notes',        notes,       setNotes,       { multiline: true, placeholder: 'Internal notes about this candidate…' })}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => ({
                    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9',
                    paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: '#5A4F6E', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={isSaving || !label.trim()}
                  style={({ pressed }) => ({
                    flex: 1, borderRadius: 14,
                    backgroundColor: label.trim() ? '#FF6240' : '#DDD6C9',
                    paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.8 : 1,
                  })}
                >
                  {isSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save Changes</Text>
                  }
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── DataTab ──────────────────────────────────────────────────────────────────
export interface DataTabProps {
  rows:            AtsRow[]
  isLoading:       boolean
  onStatusUpdate:  (id: string, stage: RowStage, candidateId: string | null) => void
  onRowUpdate:     (id: string, patch: Partial<{ label: string; notes: string; data: AtsRowData }>) => void
  onDeleteRow:     (id: string, label: string) => void
  onAddRow:        () => void
  isUpdatingStatus: boolean
  isSavingRow:     boolean
}

export function DataTab({
  rows,
  isLoading,
  onStatusUpdate,
  onRowUpdate,
  onDeleteRow,
  onAddRow,
  isUpdatingStatus,
  isSavingRow,
}: DataTabProps) {
  const { height } = useWindowDimensions()
  const gridBodyH  = Math.max(height - CHROME_H, 200)

  const headerScrollRef = useRef<ScrollView>(null)

  const [statusPicker, setStatusPicker] = useState<{ visible: boolean; row: AtsRow | null }>({ visible: false, row: null })
  const [editModal,    setEditModal]    = useState<{ visible: boolean; row: AtsRow | null }>({ visible: false, row: null })

  const handleStatusPress = useCallback((row: AtsRow) => setStatusPicker({ visible: true, row }), [])
  const handleEditPress   = useCallback((row: AtsRow) => setEditModal({ visible: true, row }), [])

  const handleStatusSelect = useCallback((stage: RowStage) => {
    if (!statusPicker.row) return
    onStatusUpdate(statusPicker.row.id, stage, statusPicker.row.candidate_id)
    setStatusPicker({ visible: false, row: null })
  }, [statusPicker.row, onStatusUpdate])

  const handleRowSave = useCallback((id: string, patch: Partial<{ label: string; notes: string; data: AtsRowData }>) => {
    onRowUpdate(id, patch)
    setEditModal({ visible: false, row: null })
  }, [onRowUpdate])

  const handleDelete = useCallback((id: string, label: string) => {
    setEditModal({ visible: false, row: null })
    onDeleteRow(id, label)
  }, [onDeleteRow])

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F0E8' }}>
        <ActivityIndicator color="#FF6240" size="large" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F0E8' }}>

      {/* ── Frozen header (mirrors horizontal scroll) ── */}
      <ScrollView
        ref={headerScrollRef}
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        bounces={false}
      >
        <GridHeader />
      </ScrollView>

      {/* ── Grid body ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        bounces={false}
        onScroll={(e) =>
          headerScrollRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false })
        }
        scrollEventThrottle={16}
        indicatorStyle="black"
      >
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ width: TOTAL_W, height: gridBodyH }}
          contentContainerStyle={{ minHeight: gridBodyH }}
        >
          {rows.length === 0 ? (
            <View style={{ width: TOTAL_W, height: 220, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1625' }}>No rows yet</Text>
              <Text style={{ fontSize: 12, color: '#9A8FA6' }}>Tap "+ Add Row" to start tracking candidates</Text>
            </View>
          ) : (
            rows.map((row, i) => (
              <GridRow
                key={row.id}
                row={row}
                index={i}
                onStatusPress={handleStatusPress}
                onEditPress={handleEditPress}
                isEven={i % 2 === 0}
              />
            ))
          )}
        </ScrollView>
      </ScrollView>

      {/* ── Footer bar ── */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#DDD6C9',
        backgroundColor: '#F5F0E8',
      }}>
        <Text style={{ fontSize: 11, color: '#9A8FA6', fontWeight: '500' }}>
          {rows.length} {rows.length === 1 ? 'record' : 'records'}
        </Text>
        <Pressable
          onPress={onAddRow}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#FF6240',
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <PlusIcon />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Add Row</Text>
        </Pressable>
      </View>

      {/* ── Status picker modal ── */}
      <StatusPicker
        visible={statusPicker.visible}
        row={statusPicker.row}
        onSelect={handleStatusSelect}
        onClose={() => setStatusPicker({ visible: false, row: null })}
        isPending={isUpdatingStatus}
      />

      {/* ── Edit row modal ── */}
      <EditRowModal
        visible={editModal.visible}
        row={editModal.row}
        onSave={handleRowSave}
        onDelete={handleDelete}
        onClose={() => setEditModal({ visible: false, row: null })}
        isSaving={isSavingRow}
      />
    </View>
  )
}
