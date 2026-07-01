import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  TextInput,
} from 'react-native'
import { ReactNode, useState } from 'react'
import Svg, { Path } from 'react-native-svg'
import { SafeAreaView } from 'react-native-safe-area-context'

type Option = { label: string; value: string }

interface PickerModalProps {
  label?: ReactNode
  placeholder?: string
  value: string
  options: Option[]
  onSelect: (value: string) => void
  error?: string
  searchable?: boolean
}

function ChevronIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  )
}

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  )
}

export function PickerModal({
  label,
  placeholder = 'Select…',
  value,
  options,
  onSelect,
  error,
  searchable = false,
}: PickerModalProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = options.find((o) => o.value === value)
  const filtered = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const handleSelect = (val: string) => {
    onSelect(val)
    setOpen(false)
    setSearch('')
  }

  return (
    <>
      <View className="mb-4">
        {label && (
          <Text className="text-slate-300 text-sm font-medium mb-2">{label}</Text>
        )}
        <Pressable
          onPress={() => setOpen(true)}
          className={`bg-surface-card border rounded-xl px-4 py-4 flex-row items-center justify-between ${error ? 'border-red-500' : 'border-surface-border'}`}
        >
          <Text style={{ color: selected ? '#1A1625' : '#475569', fontSize: 16 }}>
            {selected ? selected.label : placeholder}
          </Text>
          <ChevronIcon />
        </Pressable>
        {error && <Text className="text-red-400 text-xs mt-1">{error}</Text>}
      </View>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
          <View className="px-5 py-4 border-b border-surface-border flex-row items-center justify-between">
            <Text className="text-[#1A1625] font-semibold text-base">{label ?? 'Select'}</Text>
            <Pressable onPress={() => { setOpen(false); setSearch('') }} hitSlop={12}>
              <Text className="text-primary-400 text-base font-medium">Done</Text>
            </Pressable>
          </View>

          {searchable && (
            <View className="px-5 py-3">
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search…"
                placeholderTextColor="#475569"
                className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-[#1A1625] text-sm"
                autoFocus
              />
            </View>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item.value)}
                className="flex-row items-center justify-between py-4 border-b border-surface-border active:opacity-70"
              >
                <Text className="text-[#1A1625] text-base">{item.label}</Text>
                {item.value === value && <CheckIcon />}
              </Pressable>
            )}
            ListEmptyComponent={
              <Text className="text-slate-500 text-sm text-center py-10">No results</Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  )
}
