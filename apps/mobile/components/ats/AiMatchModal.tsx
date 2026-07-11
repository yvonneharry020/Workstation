import { useState } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { AiMatchCriteria, AI_MATCH_COLUMNS } from './types'

function CloseIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

function CheckboxRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 }}>
      <View style={{
        width: 20, height: 20, borderRadius: 6,
        borderWidth: 1.5, borderColor: checked ? '#FF6240' : '#DDD6C9',
        backgroundColor: checked ? '#FF6240' : '#FFFFFF',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && (
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M20 6L9 17l-5-5" />
          </Svg>
        )}
      </View>
      <Text style={{ fontSize: 13, color: '#1A1625', flex: 1 }}>{label}</Text>
    </Pressable>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: '700', color: '#5A4F6E', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 18 }}>
      {children}
    </Text>
  )
}

function ChipInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setDraft('')
  }
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: values.length > 0 ? 8 : 0 }}>
        {values.map((v) => (
          <Pressable
            key={v}
            onPress={() => onChange(values.filter((x) => x !== v))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FF624015', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#FF624030' }}
          >
            <Text style={{ fontSize: 12, color: '#FF6240', fontWeight: '600' }}>{v}</Text>
            <Text style={{ fontSize: 12, color: '#FF6240' }}>×</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        onBlur={add}
        placeholder={placeholder}
        placeholderTextColor="#C8BFB0"
        returnKeyType="done"
        style={{ backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6C9', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1625' }}
      />
    </View>
  )
}

const EMPTY_CRITERIA: AiMatchCriteria = {
  customInstructions: '',
  mustHaveSkills: [],
  niceToHaveSkills: [],
  minYearsExperience: null,
  requiredDegree: null,
  requiredBadges: [],
  allowedColumns: ['full_name', 'profile', 'screening'],
}

export function AiMatchModal({
  visible, jobId, initialCriteria, onClose, onRun,
}: {
  visible: boolean
  jobId: string
  initialCriteria: AiMatchCriteria | null
  onClose: () => void
  onRun: (result: { scored: number; skipped: number }) => void
}) {
  const [criteria, setCriteria] = useState<AiMatchCriteria>(initialCriteria ?? EMPTY_CRITERIA)
  const [running, setRunning] = useState(false)
  const [yearsText, setYearsText] = useState(initialCriteria?.minYearsExperience?.toString() ?? '')

  const toggleBadge = (badge: 'admin' | 'company') => {
    setCriteria((prev) => ({
      ...prev,
      requiredBadges: prev.requiredBadges.includes(badge)
        ? prev.requiredBadges.filter((b) => b !== badge)
        : [...prev.requiredBadges, badge],
    }))
  }

  const toggleColumn = (key: string) => {
    setCriteria((prev) => ({
      ...prev,
      allowedColumns: prev.allowedColumns.includes(key)
        ? prev.allowedColumns.filter((c) => c !== key)
        : [...prev.allowedColumns, key],
    }))
  }

  const handleRun = async () => {
    setRunning(true)
    try {
      const { data, error } = await supabase.functions.invoke('ats-ai-score', {
        body: {
          jobId,
          criteria: {
            ...criteria,
            minYearsExperience: yearsText.trim() ? Number(yearsText.trim()) : null,
          },
        },
      })
      if (error) throw error
      onRun(data as { scored: number; skipped: number })
      onClose()
    } catch {
      Alert.alert('Error', 'Could not run AI scoring. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={(e) => e.stopPropagation()}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ backgroundColor: '#F5F0E8', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD6C9', alignSelf: 'center', marginTop: 12 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A1625' }}>AI Candidate Scoring</Text>
                  <Text style={{ fontSize: 12, color: '#9A8FA6', marginTop: 2 }}>Tell Groq what you're looking for</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={12}><CloseIcon /></Pressable>
              </View>

              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>

                <SectionLabel>Must-have skills</SectionLabel>
                <ChipInput values={criteria.mustHaveSkills} onChange={(v) => setCriteria((p) => ({ ...p, mustHaveSkills: v }))} placeholder="Type a skill, press enter…" />

                <SectionLabel>Nice-to-have skills</SectionLabel>
                <ChipInput values={criteria.niceToHaveSkills} onChange={(v) => setCriteria((p) => ({ ...p, niceToHaveSkills: v }))} placeholder="Type a skill, press enter…" />

                <SectionLabel>Minimum years of experience</SectionLabel>
                <TextInput
                  value={yearsText}
                  onChangeText={setYearsText}
                  placeholder="e.g. 3"
                  placeholderTextColor="#C8BFB0"
                  keyboardType="number-pad"
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6C9', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1625' }}
                />

                <SectionLabel>Required degree</SectionLabel>
                <TextInput
                  value={criteria.requiredDegree ?? ''}
                  onChangeText={(v) => setCriteria((p) => ({ ...p, requiredDegree: v || null }))}
                  placeholder="e.g. B.Sc Computer Science"
                  placeholderTextColor="#C8BFB0"
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6C9', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1625' }}
                />

                <SectionLabel>Required badges</SectionLabel>
                <CheckboxRow label="Admin badge (whole profile verified by Workstation)" checked={criteria.requiredBadges.includes('admin')} onToggle={() => toggleBadge('admin')} />
                <CheckboxRow label="Company badge (a previous employer verified this candidate)" checked={criteria.requiredBadges.includes('company')} onToggle={() => toggleBadge('company')} />

                <SectionLabel>Other instructions for Groq</SectionLabel>
                <TextInput
                  value={criteria.customInstructions}
                  onChangeText={(v) => setCriteria((p) => ({ ...p, customInstructions: v }))}
                  placeholder="Anything else Groq should weigh when scoring…"
                  placeholderTextColor="#C8BFB0"
                  multiline
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6C9', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1625', minHeight: 90, textAlignVertical: 'top' }}
                />

                <SectionLabel>Data Groq is allowed to read</SectionLabel>
                <Text style={{ fontSize: 11, color: '#9A8FA6', marginBottom: 8, lineHeight: 16 }}>
                  Only the columns you check here are sent to Groq for scoring.
                </Text>
                {AI_MATCH_COLUMNS.map((col) => (
                  <CheckboxRow
                    key={col.key}
                    label={col.label}
                    checked={criteria.allowedColumns.includes(col.key)}
                    onToggle={() => toggleColumn(col.key)}
                  />
                ))}

                <Pressable
                  onPress={handleRun}
                  disabled={running}
                  style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24, opacity: running ? 0.7 : 1 }}
                >
                  {running ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Save & Run Scoring</Text>}
                </Pressable>
                <Text style={{ fontSize: 11, color: '#9A8FA6', textAlign: 'center', marginTop: 10 }}>
                  Scores are a ranking aid — the full candidate list always stays visible.
                </Text>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
