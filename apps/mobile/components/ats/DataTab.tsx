import { useState, useCallback } from 'react'
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
  Alert,
  FlatList,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  AtsRowFull,
  PipelineStage,
  PIPELINE_CONFIG,
  COMPANY_STAGES,
  AiMatchCriteria,
  calcAge,
} from './types'
import { AiMatchModal } from './AiMatchModal'

// ─── Column definitions ───────────────────────────────────────────────────────
const COLS = [
  { key: 'num',        label: '#',            width: 36,  align: 'center' as const },
  { key: 'full_name',  label: 'Full Name',    width: 145, align: 'left'   as const },
  { key: 'email',      label: 'Email',        width: 165, align: 'left'   as const },
  { key: 'phone',      label: 'Phone',        width: 120, align: 'left'   as const },
  { key: 'location',   label: 'Location',     width: 115, align: 'left'   as const },
  { key: 'gender',     label: 'Gender',       width: 85,  align: 'left'   as const },
  { key: 'age',        label: 'Age',          width: 65,  align: 'center' as const },
  { key: 'cover',      label: 'Cover Letter', width: 110, align: 'center' as const },
  { key: 'profile',    label: 'Profile',      width: 90,  align: 'center' as const },
  { key: 'pipeline',   label: 'Pipeline',     width: 135, align: 'left'   as const },
  { key: 'notes',      label: 'Notes',        width: 155, align: 'left'   as const },
  { key: 'screening',  label: 'Screening',    width: 110, align: 'center' as const },
  { key: 'interview',  label: 'Interview',    width: 100, align: 'center' as const },
  { key: 'attendance', label: 'Attendance',   width: 100, align: 'center' as const },
  { key: 'aiScore',    label: 'AI Scoring',   width: 110, align: 'center' as const },
] as const

const TOTAL_W  = COLS.reduce((s, c) => s + c.width, 0)
const ROW_H    = 54
const HEADER_H = 44
const CHROME_H = 44 + 62 + 52 + HEADER_H + 46

// Pre-compute each column's left offset from COLS so header and body
// both use the exact same x-coordinates — alignment is guaranteed.
const COL_OFFSETS: number[] = (() => {
  const offsets: number[] = []
  let x = 0
  for (const col of COLS) {
    offsets.push(x)
    x += col.width
  }
  return offsets
})()

// ─── Icons ────────────────────────────────────────────────────────────────────
function ChevronDown() {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" stroke="#6366F1" />
    </Svg>
  )
}

function EyeIcon({ color = '#FF6240' }: { color?: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" fill={color} stroke="none" />
    </Svg>
  )
}

function EditPencil() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#9A8FA6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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

function CloseIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

function LinkIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <Path d="M15 3h6v6M10 14L21 3" />
    </Svg>
  )
}

// ─── Shared modal shell ───────────────────────────────────────────────────────
function ModalShell({
  visible, onClose, title, subtitle, children,
}: {
  visible: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={e => e.stopPropagation()}>
          <View style={{
            backgroundColor: '#F5F0E8',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '88%',
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD6C9', alignSelf: 'center', marginTop: 12 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A1625' }}>{title}</Text>
                {subtitle ? <Text style={{ fontSize: 12, color: '#9A8FA6', marginTop: 2 }} numberOfLines={1}>{subtitle}</Text> : null}
              </View>
              <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <CloseIcon />
              </Pressable>
            </View>
            {children}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Cover Letter Modal ───────────────────────────────────────────────────────
function CoverModal({ row, onClose }: { row: AtsRowFull | null; onClose: () => void }) {
  if (!row) return null
  return (
    <ModalShell visible title="Cover Letter" subtitle={row.full_name} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {row.cover_note ? (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E5DFD3' }}>
            <Text style={{ color: '#1A1625', fontSize: 14, lineHeight: 22 }}>{row.cover_note}</Text>
          </View>
        ) : (
          <Text style={{ color: '#9A8FA6', fontSize: 13, textAlign: 'center', paddingVertical: 32 }}>No cover letter provided.</Text>
        )}
      </ScrollView>
    </ModalShell>
  )
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
interface ProfileDetails {
  tools: string[] | null
  candidate_work_history: { company_name: string; role_title: string; start_date: string; end_date: string | null; is_current: boolean; sort_order: number }[]
  candidate_education:    { institution: string; degree: string; field_of_study: string | null; end_year: number | null; sort_order: number }[]
  candidate_skills:       { skills: { name: string } | null }[]
  candidate_gallery:      { image_url: string; sort_order: number }[]
}

function ProfileModal({ row, onClose }: { row: AtsRowFull | null; onClose: () => void }) {
  const [galleryLightbox, setGalleryLightbox] = useState<string | null>(null)

  const { data: details } = useQuery({
    queryKey: ['candidate-profile-details', row?.candidate_id],
    enabled: !!row?.candidate_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('candidate_profiles')
        .select(`
          tools,
          candidate_work_history(company_name, role_title, start_date, end_date, is_current, sort_order),
          candidate_education(institution, degree, field_of_study, end_year, sort_order),
          candidate_skills(skills(name)),
          candidate_gallery(image_url, sort_order)
        `)
        .eq('id', row!.candidate_id!)
        .maybeSingle()
      return data as unknown as ProfileDetails | null
    },
  })

  if (!row) return null

  const age     = calcAge(row.date_of_birth)
  const work    = [...(details?.candidate_work_history ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const edu     = [...(details?.candidate_education ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const skills  = (details?.candidate_skills ?? []).map((s) => s.skills?.name).filter(Boolean) as string[]
  const tools   = (details?.tools ?? []).filter(Boolean) as string[]
  const gallery = [...(details?.candidate_gallery ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  const initials = row.full_name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()

  const gLetter = row.gender === 'male' ? 'M' : row.gender === 'female' ? 'F' : null
  const ageNum  = age !== '—' ? age : null
  const nameTag = gLetter && ageNum ? `(${gLetter}|${ageNum})` : gLetter ? `(${gLetter})` : ageNum ? `(${ageNum})` : null

  return (
    <ModalShell visible title="Candidate Profile" subtitle={row.full_name} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Avatar + basic info */}
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          {row.avatar_url ? (
            <Image source={{ uri: row.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#FF624040', marginBottom: 10 }} contentFit="cover" />
          ) : (
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Text style={{ color: '#FF6240', fontSize: 24, fontWeight: '800' }}>{initials}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#1A1625' }}>{row.full_name}</Text>
            {nameTag ? <Text style={{ fontSize: 13, color: '#64748B' }}>{nameTag}</Text> : null}
          </View>
          {row.headline ? <Text style={{ fontSize: 12, color: '#64748B', marginTop: 3, textAlign: 'center' }} numberOfLines={2}>{row.headline}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, justifyContent: 'center' }}>
            {row.location ? <InfoChip label={row.location} /> : null}
          </View>
        </View>

        {/* Contact */}
        <SectionTitle>Contact</SectionTitle>
        <InfoRow label="Email"  value={row.email} />
        <InfoRow label="Phone"  value={row.phone ?? '—'} />

        {/* Bio */}
        {row.bio ? (
          <>
            <SectionTitle>About</SectionTitle>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5DFD3', marginBottom: 16 }}>
              <Text style={{ color: '#1A1625', fontSize: 13, lineHeight: 20 }}>{row.bio}</Text>
            </View>
          </>
        ) : null}

        {/* Gallery */}
        {gallery.length > 0 ? (
          <>
            <SectionTitle>Gallery</SectionTitle>
            <FlatList
              data={gallery}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ gap: 10, marginBottom: 16 }}
              renderItem={({ item }) => (
                <Pressable onPress={() => setGalleryLightbox(item.image_url)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
                  <Image source={{ uri: item.image_url }} style={{ width: 130, height: 100, borderRadius: 12, borderWidth: 1, borderColor: '#E5DFD3' }} contentFit="cover" />
                </Pressable>
              )}
            />
          </>
        ) : null}

        {/* Skills */}
        {skills.length > 0 ? (
          <>
            <SectionTitle>Skills</SectionTitle>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
              {skills.map((s) => (
                <View key={s} style={{ backgroundColor: '#10B98110', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#10B98130' }}>
                  <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '500' }}>{s}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Tools */}
        {tools.length > 0 ? (
          <>
            <SectionTitle>Tools</SectionTitle>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
              {tools.map((t) => (
                <View key={t} style={{ backgroundColor: '#8B5CF610', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#8B5CF630' }}>
                  <Text style={{ color: '#8B5CF6', fontSize: 12, fontWeight: '500' }}>{t}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Work History */}
        {work.length > 0 ? (
          <>
            <SectionTitle>Work History</SectionTitle>
            {work.map((w, i) => (
              <View key={i} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5DFD3', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1625' }}>{w.role_title}</Text>
                <Text style={{ fontSize: 12, color: '#5A4F6E', marginTop: 2 }}>{w.company_name}</Text>
                <Text style={{ fontSize: 11, color: '#9A8FA6', marginTop: 4 }}>
                  {w.start_date?.slice(0, 7)} – {w.is_current ? 'Present' : (w.end_date?.slice(0, 7) ?? '?')}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {/* Education */}
        {edu.length > 0 ? (
          <>
            <SectionTitle>Education</SectionTitle>
            {edu.map((e, i) => (
              <View key={i} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5DFD3', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1625' }}>{e.degree}{e.field_of_study ? ` · ${e.field_of_study}` : ''}</Text>
                <Text style={{ fontSize: 12, color: '#5A4F6E', marginTop: 2 }}>{e.institution}</Text>
                {e.end_year ? <Text style={{ fontSize: 11, color: '#9A8FA6', marginTop: 4 }}>{e.end_year}</Text> : null}
              </View>
            ))}
          </>
        ) : null}

        {/* Links */}
        {(row.linkedin_url || row.portfolio_url || row.github_url) ? (
          <>
            <SectionTitle>Links</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {row.linkedin_url  ? <LinkBtn label="LinkedIn"  url={row.linkedin_url}  /> : null}
              {row.portfolio_url ? <LinkBtn label="Portfolio" url={row.portfolio_url} /> : null}
              {row.github_url    ? <LinkBtn label="GitHub"    url={row.github_url}    /> : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Gallery lightbox */}
      {galleryLightbox ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setGalleryLightbox(null)}>
          <Pressable style={{ flex: 1, backgroundColor: '#000000F0', alignItems: 'center', justifyContent: 'center' }} onPress={() => setGalleryLightbox(null)}>
            <Image source={{ uri: galleryLightbox }} style={{ width: '100%', height: '60%' }} contentFit="contain" />
            <Pressable
              onPress={() => setGalleryLightbox(null)}
              style={{ position: 'absolute', top: 52, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff30', alignItems: 'center', justifyContent: 'center' }}
              hitSlop={12}
            >
              <CloseIcon />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </ModalShell>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 9, fontWeight: '700', color: '#9A8FA6', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 }}>
      {children}
    </Text>
  )
}

function InfoChip({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: '#EDE7DB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, color: '#5A4F6E', fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5DFD3' }}>
      <Text style={{ width: 80, fontSize: 12, color: '#9A8FA6', fontWeight: '600' }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 12, color: '#1A1625' }}>{value || '—'}</Text>
    </View>
  )
}

function normalizeUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

function LinkBtn({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(normalizeUrl(url)).catch(() => {})}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#EDE9FE', borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: '#C4B5FD',
        opacity: pressed ? 0.7 : 1, marginBottom: 8,
      })}
    >
      <LinkIcon />
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#6366F1' }}>{label}</Text>
    </Pressable>
  )
}

// ─── Screening Questions Modal ────────────────────────────────────────────────
function ScreeningModal({
  row, questions, onClose,
}: {
  row: AtsRowFull | null
  questions: { question: string; required: boolean }[] | null
  onClose: () => void
}) {
  if (!row) return null
  const answers = row.screening_answers ?? {}

  return (
    <ModalShell visible title="Screening Q&A" subtitle={row.full_name} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {!questions || questions.length === 0 ? (
          <Text style={{ color: '#9A8FA6', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>
            No screening questions for this job.
          </Text>
        ) : (
          questions.map((q, i) => {
            const answer = (answers[`q${i}`] ?? answers[i] ?? answers[String(i)] ?? '') as string
            return (
              <View key={i} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FF6240', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#1A1625', lineHeight: 19 }}>{q.question}</Text>
                </View>
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5DFD3', marginLeft: 26 }}>
                  <Text style={{ fontSize: 13, color: answer ? '#1A1625' : '#C8BFB0', lineHeight: 20, fontStyle: answer ? 'normal' : 'italic' }}>
                    {answer || 'No answer provided'}
                  </Text>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
    </ModalShell>
  )
}

// ─── Interview Modal ──────────────────────────────────────────────────────────
interface BookingRecord {
  status: string
  interview_slots: {
    slot_date: string
    start_time: string
    duration_mins: number
    meeting_type: string
    meeting_link: string | null
    company_message: string | null
  } | null
}

function InterviewModal({ row, onClose }: { row: AtsRowFull | null; onClose: () => void }) {
  const { data: booking, isLoading } = useQuery({
    queryKey: ['interview-booking', row?.application_id],
    enabled: !!row?.application_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('interview_bookings')
        .select('status, interview_slots!slot_id(slot_date, start_time, duration_mins, meeting_type, meeting_link, company_message)')
        .eq('application_id', row!.application_id!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data as unknown as BookingRecord | null
    },
  })

  if (!row) return null

  const slot = booking?.interview_slots

  return (
    <ModalShell visible title="Interview Details" subtitle={row.full_name} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color="#FF6240" style={{ marginVertical: 32 }} />
        ) : !slot ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ color: '#9A8FA6', fontSize: 13 }}>No interview scheduled yet.</Text>
          </View>
        ) : (
          <>
            {slot.company_message ? (
              <View style={{ backgroundColor: '#EDE9FE', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#C4B5FD', marginBottom: 16 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#8B5CF6', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>Message</Text>
                <Text style={{ fontSize: 13, color: '#1A1625', lineHeight: 20 }}>{slot.company_message}</Text>
              </View>
            ) : null}

            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E5DFD3' }}>
              <InfoRow label="Date"     value={new Date(slot.slot_date).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
              <InfoRow label="Time"     value={slot.start_time.slice(0, 5)} />
              <InfoRow label="Duration" value={`${slot.duration_mins} minutes`} />
              <InfoRow label="Format"   value={slot.meeting_type.replace('_', ' ')} />
              {slot.meeting_link ? (
                <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
                  <Text style={{ width: 80, fontSize: 12, color: '#9A8FA6', fontWeight: '600' }}>Link</Text>
                  <Pressable onPress={() => slot.meeting_link && Linking.openURL(slot.meeting_link)} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: '#6366F1', textDecorationLine: 'underline' }} numberOfLines={1}>{slot.meeting_link}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </ModalShell>
  )
}

// ─── AI Match Reasoning Modal ─────────────────────────────────────────────────
function AiReasoningModal({ row, onClose }: { row: AtsRowFull | null; onClose: () => void }) {
  if (!row) return null
  const analysis = row.ai_match_analysis
  const pct = row.skills_match_pct

  return (
    <ModalShell visible title="AI Match Reasoning" subtitle={row.full_name} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {pct != null && (
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: scoreColor(pct) }}>{pct}%</Text>
            <Text style={{ fontSize: 12, color: '#9A8FA6' }}>match score</Text>
          </View>
        )}

        {analysis?.matchedCriteria && analysis.matchedCriteria.length > 0 && (
          <>
            <SectionTitle>Matched</SectionTitle>
            <View style={{ marginBottom: 16 }}>
              {analysis.matchedCriteria.map((c, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                  <Text style={{ color: '#22C55E', fontSize: 13 }}>✓</Text>
                  <Text style={{ color: '#1A1625', fontSize: 13, flex: 1, lineHeight: 19 }}>{c}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {analysis?.missingCriteria && analysis.missingCriteria.length > 0 && (
          <>
            <SectionTitle>Missing</SectionTitle>
            <View style={{ marginBottom: 16 }}>
              {analysis.missingCriteria.map((c, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                  <Text style={{ color: '#EF4444', fontSize: 13 }}>✗</Text>
                  <Text style={{ color: '#1A1625', fontSize: 13, flex: 1, lineHeight: 19 }}>{c}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {analysis?.reasoning ? (
          <>
            <SectionTitle>Reasoning</SectionTitle>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E5DFD3' }}>
              <Text style={{ color: '#1A1625', fontSize: 13, lineHeight: 20 }}>{analysis.reasoning}</Text>
            </View>
          </>
        ) : (
          <Text style={{ color: '#9A8FA6', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>
            No AI scoring has been run for this candidate yet.
          </Text>
        )}
      </ScrollView>
    </ModalShell>
  )
}

// ─── Pipeline Picker ──────────────────────────────────────────────────────────
function PipelinePicker({
  visible, row, onSelect, onClose, isPending,
}: {
  visible: boolean; row: AtsRowFull | null; onSelect: (s: PipelineStage) => void; onClose: () => void; isPending: boolean
}) {
  if (!row) return null
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={e => e.stopPropagation()} style={{ alignSelf: 'stretch' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 44, alignSelf: 'stretch' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD6C9', alignSelf: 'center', marginBottom: 20 }} />
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A1625', marginBottom: 4 }}>Update Pipeline</Text>
              <Text style={{ fontSize: 12, color: '#9A8FA6', marginBottom: 20 }} numberOfLines={1}>{row.full_name}</Text>

                <Text style={{ fontSize: 11, color: '#9A8FA6', marginBottom: 16, lineHeight: 17 }}>
                Select a stage to move this candidate to.
              </Text>

              {COMPANY_STAGES.map((stage) => {
                const cfg      = PIPELINE_CONFIG[stage]
                const isActive = stage === row.pipeline_stage
                return (
                  <Pressable
                    key={stage}
                    onPress={() => onSelect(stage)}
                    disabled={isPending}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center',
                      paddingVertical: 16, paddingHorizontal: 18,
                      borderRadius: 16, marginBottom: 10,
                      backgroundColor: isActive ? cfg.bg : '#FFFFFF',
                      borderWidth: 2, borderColor: isActive ? cfg.color : '#E5DFD3',
                      opacity: pressed ? 0.75 : 1,
                      shadowColor: isActive ? cfg.color : 'transparent',
                      shadowOpacity: 0.12,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 2 },
                    })}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: cfg.bg,
                      borderWidth: 2, borderColor: cfg.color + '50',
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: 14, flexShrink: 0,
                    }}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: cfg.color }} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1625' }}>
                        {cfg.label}
                      </Text>
                      <Text style={{ fontSize: 11, color: cfg.color, fontWeight: '600', marginTop: 2 }}>
                        {stage.replace('_', ' ')}
                      </Text>
                    </View>
                    {isActive && !isPending && <CheckIcon color={cfg.color} />}
                    {isActive &&  isPending && <ActivityIndicator size="small" color={cfg.color} />}
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

// ─── Notes Modal ──────────────────────────────────────────────────────────────
function NotesModal({
  visible, row, onSave, onClose, isSaving,
}: {
  visible: boolean; row: AtsRowFull | null; onSave: (applicationId: string, notes: string) => void; onClose: () => void; isSaving: boolean
}) {
  const [text, setText] = useState('')

  const handleOpen = useCallback(() => {
    if (row) setText(row.internal_notes ?? '')
  }, [row])

  if (!row) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#F5F0E8',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 44,
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD6C9', alignSelf: 'center', marginBottom: 14 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A1625' }}>Internal Notes</Text>
                <Text style={{ fontSize: 12, color: '#9A8FA6', marginTop: 2 }} numberOfLines={1}>{row.full_name}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <CloseIcon />
              </Pressable>
            </View>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Add private notes about this candidate…"
              placeholderTextColor="#C8BFB0"
              multiline
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#DDD6C9',
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                color: '#1A1625',
                height: 120,
                textAlignVertical: 'top',
                marginBottom: 16,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
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
                onPress={() => {
                  if (!row.application_id) {
                    Alert.alert('Cannot Save', 'No linked application found for this candidate.')
                    return
                  }
                  onSave(row.application_id, text)
                  onClose()
                }}
                disabled={isSaving}
                style={({ pressed }) => ({
                  flex: 1, borderRadius: 14,
                  backgroundColor: isSaving ? '#FFA994' : '#FF6240',
                  paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.8 : 1,
                })}
              >
                {isSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save Notes</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Grid header — absolute positioning from COL_OFFSETS ─────────────────────
function GridHeader() {
  return (
    <View style={{ width: TOTAL_W, height: HEADER_H, backgroundColor: '#1A1625' }}>
      {COLS.map((col, i) => (
        <View
          key={col.key}
          style={{
            position: 'absolute',
            left: COL_OFFSETS[i],
            top: 0,
            width: col.width,
            height: HEADER_H,
            justifyContent: 'center',
            paddingHorizontal: col.align === 'center' ? 0 : 10,
            alignItems: col.align === 'center' ? 'center' : 'flex-start',
            borderRightWidth: i < COLS.length - 1 ? 1 : 0,
            borderRightColor: '#2D2646',
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: '700', color: '#9A8FA6', letterSpacing: 1, textTransform: 'uppercase' }}>
            {col.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

// ─── Absolute-positioned cell helpers ────────────────────────────────────────
const CELL_BORDER = { borderRightWidth: 1 as const, borderRightColor: '#E5DFD3' as const }

type CellPos = { left: number; width: number }

function AbsTxt({ left, width, value, center, bg }: CellPos & { value: string | null | undefined; center?: boolean; bg: string }) {
  return (
    <View style={[CELL_BORDER, {
      position: 'absolute', left, top: 0, width, height: ROW_H,
      paddingHorizontal: center ? 4 : 10,
      paddingVertical: 10,
      alignItems: center ? 'center' : 'flex-start',
      justifyContent: 'flex-start',
      backgroundColor: bg,
    }]}>
      {(value && value !== '—') ? (
        <Text style={{ fontSize: 12, color: '#1A1625', lineHeight: 17 }} numberOfLines={2}>{value}</Text>
      ) : (
        <Text style={{ fontSize: 12, color: '#D4CCBE', fontStyle: 'italic' }}>—</Text>
      )}
    </View>
  )
}

function AbsView({ left, width, onPress, bg }: CellPos & { onPress: () => void; bg: string }) {
  return (
    <View style={{
      position: 'absolute', left, top: 0, width, height: ROW_H,
      backgroundColor: bg,
      borderRightWidth: 1, borderRightColor: '#E5DFD3',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: '#FF624015', borderRadius: 8,
          paddingHorizontal: 8, paddingVertical: 5,
          borderWidth: 1, borderColor: '#FF624040',
        }}>
          <EyeIcon />
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF6240' }}>View</Text>
        </View>
      </Pressable>
    </View>
  )
}

function AbsPipeline({ left, width, row, onPress, bg }: CellPos & { row: AtsRowFull; onPress: () => void; bg: string }) {
  const cfg = PIPELINE_CONFIG[row.pipeline_stage]
  return (
    <View style={{
      position: 'absolute', left, top: 0, width, height: ROW_H,
      backgroundColor: bg,
      borderRightWidth: 1, borderRightColor: '#E5DFD3',
      justifyContent: 'center', paddingHorizontal: 8,
    }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
      >
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: cfg.bg, borderRadius: 10,
          paddingHorizontal: 8, paddingVertical: 6,
          borderWidth: 1.5, borderColor: cfg.color + '55',
        }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cfg.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color, flex: 1 }} numberOfLines={1}>{cfg.label}</Text>
          <ChevronDown />
        </View>
      </Pressable>
    </View>
  )
}

function scoreColor(pct: number): string {
  if (pct >= 70) return '#22C55E'
  if (pct >= 40) return '#F59E0B'
  return '#EF4444'
}

function AbsAiScore({ left, width, row, onPress, bg }: CellPos & { row: AtsRowFull; onPress: () => void; bg: string }) {
  const pct = row.skills_match_pct
  return (
    <View style={{
      position: 'absolute', left, top: 0, width, height: ROW_H,
      backgroundColor: bg,
      borderRightWidth: 1, borderRightColor: '#E5DFD3',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {pct == null ? (
        <Text style={{ fontSize: 12, color: '#D4CCBE', fontStyle: 'italic' }}>—</Text>
      ) : (
        <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, width: '80%' })}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: scoreColor(pct) }}>{pct}%</Text>
          </View>
          <View style={{ height: 4, backgroundColor: '#E5DFD3', borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${pct}%`, backgroundColor: scoreColor(pct), borderRadius: 2 }} />
          </View>
        </Pressable>
      )}
    </View>
  )
}

function AbsNotes({ left, width, row, onPress, bg }: CellPos & { row: AtsRowFull; onPress: () => void; bg: string }) {
  return (
    <View style={{
      position: 'absolute', left, top: 0, width, height: ROW_H,
      backgroundColor: bg,
      borderRightWidth: 1, borderRightColor: '#E5DFD3',
      paddingHorizontal: 10, paddingVertical: 10,
      flexDirection: 'row', alignItems: 'center',
    }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, flexDirection: 'row', alignItems: 'center', flex: 1 })}
      >
        <EditPencil />
        <View style={{ flex: 1, marginLeft: 6 }}>
          {row.internal_notes ? (
            <Text style={{ fontSize: 11, color: '#5A4F6E', lineHeight: 16 }} numberOfLines={2}>{row.internal_notes}</Text>
          ) : (
            <Text style={{ fontSize: 11, color: '#D4CCBE', fontStyle: 'italic' }}>Add note…</Text>
          )}
        </View>
      </Pressable>
    </View>
  )
}

// ─── Grid row — every column pinned by absolute position from COL_OFFSETS ────
interface CellHandlers {
  onCoverPress:       () => void
  onProfilePress:     () => void
  onPipelinePress:    () => void
  onNotesPress:       () => void
  onScreeningPress:   () => void
  onInterviewPress:   () => void
  onAiScorePress:     () => void
  screeningQuestions: { question: string; required: boolean }[] | null
}

function GridRow({ row, index, isEven, handlers }: { row: AtsRowFull; index: number; isEven: boolean; handlers: CellHandlers }) {
  const bg = isEven ? '#FFFFFF' : '#F9F7F4'

  return (
    <View style={{ width: TOTAL_W, height: ROW_H, backgroundColor: bg, borderBottomWidth: 1, borderBottomColor: '#E5DFD3' }}>

      {/* col[0]  #  left=0  w=36 */}
      <View style={[CELL_BORDER, { position: 'absolute', left: COL_OFFSETS[0], top: 0, width: COLS[0].width, height: ROW_H, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }]}>
        <Text style={{ fontSize: 11, color: '#C8BFB0', fontWeight: '600' }}>{index + 1}</Text>
      </View>

      {/* col[1]  Full Name  left=36  w=145 */}
      <AbsTxt left={COL_OFFSETS[1]!} width={COLS[1].width} value={row.full_name}              bg={bg} />

      {/* col[2]  Email  left=181  w=165 */}
      <AbsTxt left={COL_OFFSETS[2]!} width={COLS[2].width} value={row.email}                  bg={bg} />

      {/* col[3]  Phone  left=346  w=120 */}
      <AbsTxt left={COL_OFFSETS[3]!} width={COLS[3].width} value={row.phone}                  bg={bg} />

      {/* col[4]  Location  left=466  w=115 */}
      <AbsTxt left={COL_OFFSETS[4]!} width={COLS[4].width} value={row.location}               bg={bg} />

      {/* col[5]  Gender  left=581  w=85 */}
      <AbsTxt left={COL_OFFSETS[5]!} width={COLS[5].width} value={row.gender}                 bg={bg} />

      {/* col[6]  Age  left=666  w=65 */}
      <AbsTxt left={COL_OFFSETS[6]!} width={COLS[6].width} value={calcAge(row.date_of_birth)} bg={bg} center />

      {/* col[7]  Cover Letter  left=731  w=110 — always shows View, modal handles empty state */}
      <AbsView left={COL_OFFSETS[7]!} width={COLS[7].width} onPress={handlers.onCoverPress}    bg={bg} />

      {/* col[8]  Profile  left=841  w=90 */}
      <AbsView left={COL_OFFSETS[8]!} width={COLS[8].width} onPress={handlers.onProfilePress}  bg={bg} />

      {/* col[9]  Pipeline  left=931  w=135 */}
      <AbsPipeline left={COL_OFFSETS[9]!} width={COLS[9].width} row={row} onPress={handlers.onPipelinePress} bg={bg} />

      {/* col[10]  Notes  left=1066  w=155 */}
      <AbsNotes left={COL_OFFSETS[10]!} width={COLS[10].width} row={row} onPress={handlers.onNotesPress} bg={bg} />

      {/* col[11]  Screening  left=1221  w=110 */}
      <AbsView left={COL_OFFSETS[11]!} width={COLS[11].width} onPress={handlers.onScreeningPress} bg={bg} />

      {/* col[12]  Interview  left=1331  w=100 */}
      <AbsView left={COL_OFFSETS[12]!} width={COLS[12].width} onPress={handlers.onInterviewPress} bg={bg} />

      {/* col[13]  Attendance  left=1431  w=100 — not yet tracked */}
      <View style={{ position: 'absolute', left: COL_OFFSETS[13], top: 0, width: COLS[13].width, height: ROW_H, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <Text style={{ fontSize: 12, color: '#D4CCBE', fontStyle: 'italic' }}>—</Text>
      </View>

      {/* col[14]  AI Scoring  left=1531  w=110 — always last, per the 200-candidate scan use case */}
      <AbsAiScore left={COL_OFFSETS[14]!} width={COLS[14].width} row={row} onPress={handlers.onAiScorePress} bg={bg} />

    </View>
  )
}

// ─── DataTab ──────────────────────────────────────────────────────────────────
export interface DataTabProps {
  rows:               AtsRowFull[]
  isLoading:          boolean
  screeningQuestions: { question: string; required: boolean }[] | null
  onPipelineUpdate:   (applicationId: string, candidateId: string | null, stage: PipelineStage) => void
  onNotesUpdate:      (applicationId: string, notes: string) => void
  isUpdatingPipeline: boolean
  isSavingNotes:      boolean
  jobId:              string | null
  aiMatchCriteria:    AiMatchCriteria | null
  onAiScoringRun:     () => void
}

export function DataTab({
  rows,
  isLoading,
  screeningQuestions,
  onPipelineUpdate,
  onNotesUpdate,
  isUpdatingPipeline,
  isSavingNotes,
  jobId,
  aiMatchCriteria,
  onAiScoringRun,
}: DataTabProps) {
  const { height } = useWindowDimensions()
  const gridBodyH  = Math.max(height - CHROME_H, 200)

  const [coverModal,    setCoverModal]    = useState<AtsRowFull | null>(null)
  const [profileModal,  setProfileModal]  = useState<AtsRowFull | null>(null)
  const [screenModal,   setScreenModal]   = useState<AtsRowFull | null>(null)
  const [interviewModal,setInterviewModal]= useState<AtsRowFull | null>(null)
  const [pipelinePicker,setPipelinePicker]= useState<{ row: AtsRowFull | null; visible: boolean }>({ row: null, visible: false })
  const [notesModal,    setNotesModal]    = useState<{ row: AtsRowFull | null; visible: boolean }>({ row: null, visible: false })
  const [aiReasoningModal, setAiReasoningModal] = useState<AtsRowFull | null>(null)
  const [aiMatchModalVisible, setAiMatchModalVisible] = useState(false)

  const makeHandlers = useCallback((row: AtsRowFull): CellHandlers => ({
    onCoverPress:     () => setCoverModal(row),
    onProfilePress:   () => setProfileModal(row),
    onPipelinePress:  () => setPipelinePicker({ row, visible: true }),
    onNotesPress:     () => setNotesModal({ row, visible: true }),
    onScreeningPress: () => setScreenModal(row),
    onInterviewPress: () => setInterviewModal(row),
    onAiScorePress:   () => setAiReasoningModal(row),
    screeningQuestions,
  }), [screeningQuestions])

  const handlePipelineSelect = useCallback((stage: PipelineStage) => {
    const row = pipelinePicker.row
    if (!row?.application_id) return
    onPipelineUpdate(row.application_id, row.candidate_id, stage)
    setPipelinePicker({ row: null, visible: false })
  }, [pipelinePicker.row, onPipelineUpdate])

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F0E8' }}>
        <ActivityIndicator color="#FF6240" size="large" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F0E8', paddingTop: 8 }}>

      {jobId && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Pressable
            onPress={() => setAiMatchModalVisible(true)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: '#1A1625', borderRadius: 12, paddingVertical: 12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2-6.3-4.6-6.3 4.6 2.3-7.2-6-4.4h7.6L12 2z" />
            </Svg>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>AI Candidate Scoring</Text>
          </Pressable>
        </View>
      )}

      {/* Single horizontal scroll — header + body share the same TOTAL_W container */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        bounces={false}
        indicatorStyle="black"
        style={{ flex: 1 }}
      >
        <View style={{ width: TOTAL_W }}>
          <GridHeader />

          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={{ width: TOTAL_W, height: gridBodyH }}
            contentContainerStyle={{ minHeight: 80 }}
          >
            {rows.length === 0 ? (
              <View style={{ width: TOTAL_W, height: 180, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1625' }}>No candidates yet</Text>
                <Text style={{ fontSize: 12, color: '#9A8FA6' }}>Candidates auto-appear as they apply for this job</Text>
              </View>
            ) : (
              rows.map((row, i) => (
                <GridRow
                  key={row.id}
                  row={row}
                  index={i}
                  isEven={i % 2 === 0}
                  handlers={makeHandlers(row)}
                />
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: '#DDD6C9',
        backgroundColor: '#F5F0E8',
      }}>
        <Text style={{ fontSize: 11, color: '#9A8FA6', fontWeight: '500' }}>
          {rows.length} {rows.length === 1 ? 'record' : 'records'}
        </Text>
      </View>

      {/* Modals */}
      <CoverModal   row={coverModal}    onClose={() => setCoverModal(null)} />
      <ProfileModal row={profileModal}  onClose={() => setProfileModal(null)} />
      <ScreeningModal
        row={screenModal}
        questions={screeningQuestions}
        onClose={() => setScreenModal(null)}
      />
      <InterviewModal row={interviewModal} onClose={() => setInterviewModal(null)} />

      <PipelinePicker
        visible={pipelinePicker.visible}
        row={pipelinePicker.row}
        onSelect={handlePipelineSelect}
        onClose={() => setPipelinePicker({ row: null, visible: false })}
        isPending={isUpdatingPipeline}
      />

      <NotesModal
        visible={notesModal.visible}
        row={notesModal.row}
        onSave={onNotesUpdate}
        onClose={() => setNotesModal({ row: null, visible: false })}
        isSaving={isSavingNotes}
      />

      <AiReasoningModal row={aiReasoningModal} onClose={() => setAiReasoningModal(null)} />

      {jobId && (
        <AiMatchModal
          visible={aiMatchModalVisible}
          jobId={jobId}
          initialCriteria={aiMatchCriteria}
          onClose={() => setAiMatchModalVisible(false)}
          onRun={onAiScoringRun}
        />
      )}
    </View>
  )
}
