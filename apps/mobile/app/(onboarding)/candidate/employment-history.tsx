import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { Input } from '@/components/ui/Input'
import { PickerModal } from '@/components/ui/PickerModal'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const YEARS = Array.from({ length: 40 }, (_, i) => {
  const y = new Date().getFullYear() - i
  return { label: String(y), value: String(y) }
})

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
].map((m, i) => ({ label: m, value: String(i + 1) }))

const schema = z.object({
  jobTitle: z.string().min(2, 'Enter your job title'),
  companyName: z.string().min(2, 'Enter company name'),
  startMonth: z.string().min(1, 'Select start month'),
  startYear: z.string().min(1, 'Select start year'),
  endMonth: z.string().optional(),
  endYear: z.string().optional(),
  isCurrent: z.boolean().default(false),
  description: z.string().max(500).optional(),
})

type FormData = z.infer<typeof schema>

interface EmploymentEntry extends FormData {
  id: string
}

function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function TrashIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Svg>
  )
}

function EditIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  )
}

function formatPeriod(entry: EmploymentEntry): string {
  const monthName = (m: string) => MONTHS.find((mo) => mo.value === m)?.label?.slice(0, 3) ?? m
  const start = `${monthName(entry.startMonth)} ${entry.startYear}`
  const end = entry.isCurrent
    ? 'Present'
    : entry.endMonth && entry.endYear
    ? `${monthName(entry.endMonth)} ${entry.endYear}`
    : ''
  return end ? `${start} – ${end}` : start
}

function EntryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: EmploymentEntry
  onSave: (data: FormData) => void
  onCancel: () => void
}) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      jobTitle: initial?.jobTitle ?? '',
      companyName: initial?.companyName ?? '',
      startMonth: initial?.startMonth ?? '',
      startYear: initial?.startYear ?? '',
      endMonth: initial?.endMonth ?? '',
      endYear: initial?.endYear ?? '',
      isCurrent: initial?.isCurrent ?? false,
      description: initial?.description ?? '',
    },
  })

  const isCurrent = watch('isCurrent')

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row items-center justify-between py-5">
            <Text className="text-[#1A1625] text-base font-semibold">
              {initial ? 'Edit experience' : 'Add experience'}
            </Text>
            <Pressable onPress={onCancel} hitSlop={12}>
              <Text className="text-slate-400 text-sm">Cancel</Text>
            </Pressable>
          </View>

          <Controller
            control={control}
            name="jobTitle"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Job title"
                placeholder="e.g. Software Engineer"
                value={value}
                onChangeText={onChange}
                error={errors.jobTitle?.message}
                autoCapitalize="words"
              />
            )}
          />

          <Controller
            control={control}
            name="companyName"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Company name"
                placeholder="e.g. Flutterwave"
                value={value}
                onChangeText={onChange}
                error={errors.companyName?.message}
                autoCapitalize="words"
              />
            )}
          />

          {/* Currently working here toggle */}
          <Controller
            control={control}
            name="isCurrent"
            render={({ field: { onChange, value } }) => (
              <Pressable
                onPress={() => onChange(!value)}
                className="flex-row items-center justify-between bg-surface-card border border-surface-border rounded-xl px-4 py-4 mb-4"
              >
                <Text className="text-[#1A1625] text-sm">I currently work here</Text>
                <View
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: value ? '#FF6240' : '#C8BFB0',
                    padding: 2,
                    justifyContent: 'center',
                    alignItems: value ? 'flex-end' : 'flex-start',
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: '#1A1625',
                    }}
                  />
                </View>
              </Pressable>
            )}
          />

          {/* Start date */}
          <View className="mb-1">
            <Text className="text-slate-300 text-sm font-medium mb-2">Start date</Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="startMonth"
                  render={({ field: { onChange, value } }) => (
                    <PickerModal
                      placeholder="Month"
                      value={value}
                      options={MONTHS}
                      onSelect={onChange}
                      error={errors.startMonth?.message}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="startYear"
                  render={({ field: { onChange, value } }) => (
                    <PickerModal
                      placeholder="Year"
                      value={value}
                      options={YEARS}
                      onSelect={onChange}
                      error={errors.startYear?.message}
                    />
                  )}
                />
              </View>
            </View>
          </View>

          {/* End date — hidden if current */}
          {!isCurrent && (
            <View className="mb-1">
              <Text className="text-slate-300 text-sm font-medium mb-2">End date</Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Controller
                    control={control}
                    name="endMonth"
                    render={({ field: { onChange, value } }) => (
                      <PickerModal
                        placeholder="Month"
                        value={value ?? ''}
                        options={MONTHS}
                        onSelect={onChange}
                      />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Controller
                    control={control}
                    name="endYear"
                    render={({ field: { onChange, value } }) => (
                      <PickerModal
                        placeholder="Year"
                        value={value ?? ''}
                        options={YEARS}
                        onSelect={onChange}
                      />
                    )}
                  />
                </View>
              </View>
            </View>
          )}

          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Key responsibilities (optional)"
                placeholder="Brief description of your role and achievements…"
                value={value}
                onChangeText={(t) => { if (t.length <= 500) onChange(t) }}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{ minHeight: 90 }}
              />
            )}
          />

          <Pressable
            onPress={handleSubmit(onSave)}
            className="bg-primary-500 rounded-2xl py-4 items-center mt-2 active:opacity-80"
          >
            <Text className="text-[#1A1625] font-semibold text-base">
              {initial ? 'Save changes' : 'Add experience'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default function CandidateEmploymentHistory() {
  const user = useAuthStore((s) => s.user)
  const [entries, setEntries] = useState<EmploymentEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<EmploymentEntry | undefined>()
  const [isSaving, setIsSaving] = useState(false)

  const handleAdd = (data: FormData) => {
    const newEntry: EmploymentEntry = { ...data, id: `entry_${Date.now()}` }
    setEntries((prev) => [newEntry, ...prev])
    setShowForm(false)
  }

  const handleEdit = (data: FormData) => {
    if (!editEntry) return
    setEntries((prev) =>
      prev.map((e) => (e.id === editEntry.id ? { ...data, id: e.id } : e))
    )
    setEditEntry(undefined)
  }

  const handleDelete = (id: string) => {
    Alert.alert(
      'Remove experience',
      'Are you sure you want to remove this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setEntries((prev) => prev.filter((e) => e.id !== id)),
        },
      ]
    )
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      if (user?.id && entries.length > 0) {
        const rows = entries.map((e) => ({
          candidate_id: user.id,
          job_title: e.jobTitle,
          company_name: e.companyName,
          start_date: `${e.startYear}-${e.startMonth.padStart(2, '0')}-01`,
          end_date: e.isCurrent
            ? null
            : e.endYear && e.endMonth
            ? `${e.endYear}-${e.endMonth.padStart(2, '0')}-01`
            : null,
          is_current: e.isCurrent,
          description: e.description || null,
        }))

        await supabase.from('employment_history').insert(rows)
      }
      router.push('/(onboarding)/candidate/approved')
    } catch {
      Alert.alert('Error', 'Could not save your employment history. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Pressable onPress={() => router.back()} className="mt-6 mb-6">
          <Text className="text-primary-400 text-base">← Back</Text>
        </Pressable>

        <Animated.View entering={FadeInDown.duration(400)}>
          <Text
            style={{
              color: '#1A1625',
              fontSize: 26,
              fontWeight: '700',
              letterSpacing: -0.3,
              marginBottom: 6,
            }}
          >
            Employment history
          </Text>
          <Text className="text-slate-400 text-sm leading-5 mb-8">
            Add your past positions. Verified candidates with work history are shortlisted 3× more often.
          </Text>

          {/* Entries list */}
          {entries.length > 0 && (
            <View className="mb-6">
              {entries.map((entry) => (
                <Animated.View
                  key={entry.id}
                  entering={FadeInUp.duration(300)}
                  layout={Layout.springify()}
                  className="bg-surface-card border border-surface-border rounded-2xl px-5 py-4 mb-3"
                >
                  <View className="flex-row items-start justify-between mb-1">
                    <View className="flex-1 mr-4">
                      <Text className="text-[#1A1625] text-sm font-semibold">{entry.jobTitle}</Text>
                      <Text className="text-slate-400 text-sm mt-0.5">{entry.companyName}</Text>
                      <Text className="text-slate-500 text-xs mt-1">{formatPeriod(entry)}</Text>
                      {entry.isCurrent && (
                        <View
                          className="self-start mt-2 px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: '#22C55E20' }}
                        >
                          <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '600' }}>
                            Current role
                          </Text>
                        </View>
                      )}
                      {entry.description ? (
                        <Text className="text-slate-500 text-xs mt-2 leading-4" numberOfLines={2}>
                          {entry.description}
                        </Text>
                      ) : null}
                    </View>
                    <View className="flex-row gap-3">
                      <Pressable
                        onPress={() => setEditEntry(entry)}
                        hitSlop={10}
                      >
                        <EditIcon />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDelete(entry.id)}
                        hitSlop={10}
                      >
                        <TrashIcon />
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}

          {/* Add button */}
          <Pressable
            onPress={() => setShowForm(true)}
            className="flex-row items-center justify-center gap-2 border rounded-2xl py-4 mb-6 active:opacity-80"
            style={{ borderColor: '#FF6240', borderStyle: 'dashed' }}
          >
            <PlusIcon />
            <Text className="text-primary-400 text-sm font-semibold">Add experience</Text>
          </Pressable>

          {entries.length > 0 && (
            <Pressable
              onPress={handleSaveAll}
              disabled={isSaving}
              className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80 mb-4"
              style={{ opacity: isSaving ? 0.7 : 1 }}
            >
              <Text className="text-[#1A1625] font-semibold text-base">
                {isSaving ? 'Saving…' : 'Save and continue'}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push('/(onboarding)/candidate/approved')}
            className="py-3 items-center"
          >
            <Text className="text-slate-400 text-sm">
              {entries.length === 0 ? 'Skip for now →' : 'Skip and continue without saving →'}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* Add form modal */}
      <Modal
        visible={showForm && !editEntry}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <EntryForm onSave={handleAdd} onCancel={() => setShowForm(false)} />
      </Modal>

      {/* Edit form modal */}
      <Modal
        visible={Boolean(editEntry)}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <EntryForm
          initial={editEntry}
          onSave={handleEdit}
          onCancel={() => setEditEntry(undefined)}
        />
      </Modal>
    </SafeAreaView>
  )
}
