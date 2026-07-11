import { useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

import {
  AtsRowFull,
  AtsRowRaw,
  PipelineStage,
  PIPELINE_CONFIG,
  AiMatchCriteria,
  transformAtsRow,
} from '@/components/ats/types'
import { OverviewTab }  from '@/components/ats/OverviewTab'
import { DataTab }      from '@/components/ats/DataTab'
import { AnalysisTab }  from '@/components/ats/AnalysisTab'

type TabKey = 'overview' | 'data' | 'analysis'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'data',     label: 'Data'     },
  { key: 'analysis', label: 'Analysis' },
]

function ArrowLeft() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

// ─── Segmented Tab Bar ────────────────────────────────────────────────────────
interface TabBarProps {
  activeTab:   TabKey
  onTabChange: (t: TabKey) => void
  rowCount:    number
}

function TabBar({ activeTab, onTabChange, rowCount }: TabBarProps) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 4,
    }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key
        const hasBadge = tab.key === 'data' && rowCount > 0

        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 12,
              paddingHorizontal: 22,
              borderRadius: 14,
              backgroundColor: isActive ? '#FFFFFF' : '#EDE7DB',
              opacity: pressed ? 0.8 : 1,
              shadowColor: '#1A1625',
              shadowOpacity: isActive ? 0.1 : 0,
              shadowRadius: isActive ? 8 : 0,
              shadowOffset: { width: 0, height: 3 },
              borderWidth: isActive ? 1 : 0,
              borderColor: '#E5DFD3',
            })}
          >
            <Text style={{
              fontSize: 17,
              fontWeight: isActive ? '800' : '600',
              color: isActive ? '#1A1625' : '#9A8FA6',
              letterSpacing: -0.3,
            }}>
              {tab.label}
            </Text>
            {hasBadge && (
              <View style={{
                backgroundColor: isActive ? '#FF6240' : '#C8BFB0',
                borderRadius: 8,
                minWidth: 20,
                height: 20,
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
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AtsTableDetailScreen() {
  const { id: tableId }   = useLocalSearchParams<{ id: string }>()
  const queryClient       = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('data')

  // ── Table info (name + job_id) ───────────────────────────────────────────────
  const { data: tableInfo } = useQuery({
    queryKey: ['ats-table-info', tableId],
    enabled: !!tableId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ats_tables')
        .select('name, job_id')
        .eq('id', tableId!)
        .maybeSingle()
      return data as { name: string; job_id: string | null } | null
    },
  })

  // ── Screening questions + AI match criteria for the linked job ──────────────
  const { data: jobExtras } = useQuery({
    queryKey: ['ats-job-extras', tableInfo?.job_id],
    enabled: !!tableInfo?.job_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('job_postings')
        .select('screening_questions, ai_match_criteria')
        .eq('id', tableInfo!.job_id!)
        .maybeSingle()
      return data as { screening_questions: { question: string; required: boolean }[] | null; ai_match_criteria: AiMatchCriteria | null } | null
    },
  })
  const screeningQuestions = jobExtras?.screening_questions ?? null
  const aiMatchCriteria = jobExtras?.ai_match_criteria ?? null

  // ── Rows (full join) ─────────────────────────────────────────────────────────
  const { data: rows, isLoading } = useQuery({
    queryKey: ['ats-rows', tableId],
    enabled: !!tableId,
    queryFn: async () => {
      const { data: rawRows, error } = await supabase
        .from('ats_rows')
        .select(`
          id, table_id, application_id, candidate_id, created_at,
          job_applications!application_id(
            pipeline_stage, cover_note, screening_answers, internal_notes,
            skills_match_pct, ai_match_analysis
          ),
          candidate_profiles!candidate_id(
            first_name, last_name, gender, date_of_birth, avatar_url,
            headline, bio, linkedin_url, portfolio_url, github_url,
            nigerian_states!state_of_origin_id(name)
          )
        `)
        .eq('table_id', tableId!)
        .order('created_at', { ascending: true })
      if (error) throw error

      const candidateIds = (rawRows ?? [])
        .map(r => r.candidate_id as string | null)
        .filter((id): id is string => !!id)

      let profileMap: Record<string, { email: string; phone: string | null }> = {}
      if (candidateIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, email, phone')
          .in('id', candidateIds)
        profileMap = (profileData ?? []).reduce<Record<string, { email: string; phone: string | null }>>((acc, p) => {
          acc[p.id] = { email: p.email, phone: p.phone ?? null }
          return acc
        }, {})
      }

      return (rawRows ?? []).map(r => transformAtsRow(r as unknown as AtsRowRaw, profileMap)) as AtsRowFull[]
    },
  })

  // ── Update pipeline stage on job_applications ────────────────────────────────
  const { mutate: updatePipeline, isPending: isUpdatingPipeline } = useMutation({
    mutationFn: async ({
      applicationId,
      stage,
      candidateId,
    }: {
      applicationId: string
      stage: PipelineStage
      candidateId: string | null
    }) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ pipeline_stage: stage })
        .eq('id', applicationId)
      if (error) throw error

      if (candidateId) {
        const cfg = PIPELINE_CONFIG[stage]
        await supabase.from('notifications').insert({
          user_id:    candidateId,
          type:       'application_status_changed',
          title:      'Your application status has been updated',
          body:       `Your application has been moved to ${cfg.label}.`,
          data:       { stage, table_id: tableId },
          action_url: null,
        })
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] }),
    onError:   () => Alert.alert('Error', 'Could not update pipeline. Please try again.'),
  })

  // ── Update notes on job_applications ────────────────────────────────────────
  const { mutate: updateNotes, isPending: isSavingNotes } = useMutation({
    mutationFn: async ({ applicationId, notes }: { applicationId: string; notes: string }) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ internal_notes: notes.trim() || null })
        .eq('id', applicationId)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] }),
    onError:   () => Alert.alert('Error', 'Could not save notes. Please try again.'),
  })

  const handlePipelineUpdate = useCallback((
    applicationId: string,
    candidateId: string | null,
    stage: PipelineStage,
  ) => {
    updatePipeline({ applicationId, stage, candidateId })
  }, [updatePipeline])

  const handleNotesUpdate = useCallback((applicationId: string, notes: string) => {
    updateNotes({ applicationId, notes })
  }, [updateNotes])

  const safeRows = rows ?? []

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }} edges={['top']}>

      {/* ── Screen header ── */}
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
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: '#EDE7DB',
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <ArrowLeft />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontSize: 17, fontWeight: '800', color: '#1A1625', letterSpacing: -0.3 }}
            numberOfLines={1}
          >
            {tableInfo?.name ?? '…'}
          </Text>
          <Text style={{ fontSize: 11, color: '#9A8FA6', marginTop: 1 }}>
            {safeRows.length} {safeRows.length === 1 ? 'candidate' : 'candidates'}
          </Text>
        </View>
      </View>

      {/* ── Segmented tab bar ── */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} rowCount={safeRows.length} />

      <View style={{ height: 12 }} />

      {/* ── Active tab content ── */}
      <View style={{ flex: 1 }}>
        {activeTab === 'overview' && <OverviewTab rows={safeRows} />}

        {activeTab === 'data' && (
          <DataTab
            rows={safeRows}
            isLoading={isLoading}
            screeningQuestions={screeningQuestions}
            onPipelineUpdate={handlePipelineUpdate}
            onNotesUpdate={handleNotesUpdate}
            isUpdatingPipeline={isUpdatingPipeline}
            isSavingNotes={isSavingNotes}
            jobId={tableInfo?.job_id ?? null}
            aiMatchCriteria={aiMatchCriteria}
            onAiScoringRun={() => void queryClient.invalidateQueries({ queryKey: ['ats-rows', tableId] })}
          />
        )}

        {activeTab === 'analysis' && <AnalysisTab rows={safeRows} />}
      </View>
    </SafeAreaView>
  )
}
