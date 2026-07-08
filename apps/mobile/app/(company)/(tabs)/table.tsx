import { useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
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
  job_id: string | null
  created_at: string
  row_count?: number
}

interface JobOption {
  id: string
  title: string
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
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
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

function CheckCircleIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Path d="M22 4L12 14.01l-3-3" />
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
              <Text className="text-slate-500 text-[11px] mt-1">
                {item.row_count ?? 0} {(item.row_count ?? 0) === 1 ? 'candidate' : 'candidates'} · {formatDate(item.created_at)}
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
  const [selectedJobId, setSelectedJobId] = useState('')

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
        .select('id, company_id, name, job_id, created_at')
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

  // Available jobs = active jobs that don't have a table linked yet
  const { data: availableJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['available-jobs-for-ats', companyId],
    enabled: !!companyId && showCreate,
    queryFn: async () => {
      const [jobsRes, tablesRes] = await Promise.all([
        supabase
          .from('job_postings')
          .select('id, title')
          .eq('company_id', companyId!)
          .eq('status', 'active'),
        supabase
          .from('ats_tables')
          .select('job_id')
          .eq('company_id', companyId!)
          .not('job_id', 'is', null),
      ])

      const usedJobIds = new Set((tablesRes.data ?? []).map(t => t.job_id as string))
      return ((jobsRes.data ?? []) as JobOption[]).filter(j => !usedJobIds.has(j.id))
    },
  })

  const { mutate: createTable, isPending: isCreating } = useMutation({
    mutationFn: async (): Promise<string | null> => {
      if (!companyId || !selectedJobId) return null

      const selectedJob = availableJobs.find(j => j.id === selectedJobId)
      if (!selectedJob) return null

      // Create the ATS table linked to the job
      const { data: table, error } = await supabase
        .from('ats_tables')
        .insert({ company_id: companyId, name: selectedJob.title, job_id: selectedJobId })
        .select('id')
        .single()
      if (error) throw error

      const tableId = table.id as string

      // Backfill all existing applications for this job
      const { data: applications } = await supabase
        .from('job_applications')
        .select('id, candidate_id, pipeline_stage')
        .eq('job_id', selectedJobId)

      if (applications && applications.length > 0) {
        const rowsToInsert = applications.map(app => ({
          table_id:       tableId,
          candidate_id:   app.candidate_id,
          application_id: app.id,
          label:          'Candidate',
          stage:          'prospect',
        }))

        await supabase
          .from('ats_rows')
          .upsert(rowsToInsert, { onConflict: 'application_id', ignoreDuplicates: true })

        const newIds = (applications as { id: string; pipeline_stage: string }[])
          .filter(a => a.pipeline_stage === 'new')
          .map(a => a.id)

        if (newIds.length > 0) {
          await supabase
            .from('job_applications')
            .update({ pipeline_stage: 'reviewed' })
            .in('id', newIds)
        }
      }

      return tableId
    },
    onSuccess: (newId) => {
      void queryClient.invalidateQueries({ queryKey: ['ats-tables', companyId] })
      void queryClient.invalidateQueries({ queryKey: ['available-jobs-for-ats', companyId] })
      setShowCreate(false)
      setSelectedJobId('')
      if (newId) router.push({ pathname: '/(company)/ats-tables/[id]', params: { id: newId } })
    },
    onError: () => Alert.alert('Error', 'Could not create table. Please try again.'),
  })

  const handleOpenCreate = useCallback(() => {
    setSelectedJobId('')
    setShowCreate(true)
  }, [])

  const handleCloseCreate = useCallback(() => {
    setShowCreate(false)
    setSelectedJobId('')
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-[#1A1625] text-xl font-bold">Tables</Text>
          <Text className="text-slate-400 text-xs mt-0.5">
            {tables?.length ?? 0} ATS table{(tables?.length ?? 0) !== 1 ? 's' : ''}
          </Text>
        </View>
        <Pressable
          onPress={handleOpenCreate}
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
                Create a table to track candidates for each job post — candidates auto-populate as they apply.
              </Text>
              <Pressable
                onPress={handleOpenCreate}
                style={{ marginTop: 20, backgroundColor: '#FF6240', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}
                className="active:opacity-80"
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Create First Table</Text>
              </Pressable>
            </View>
          }
        />
      )}

      {/* Create Table Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={handleCloseCreate}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: '#F5F0E8',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: '85%',
            }}>
              {/* Handle */}
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD6C9', alignSelf: 'center', marginTop: 12, marginBottom: 0 }} />

              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
                <View>
                  <Text style={{ color: '#1A1625', fontSize: 17, fontWeight: '800' }}>New ATS Table</Text>
                  <Text style={{ color: '#9A8FA6', fontSize: 12, marginTop: 2 }}>Select the job post to link this table to</Text>
                </View>
                <Pressable onPress={handleCloseCreate} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                  <CloseIcon />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
              >
                {jobsLoading ? (
                  <ActivityIndicator color="#FF6240" style={{ marginVertical: 32 }} />
                ) : availableJobs.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 14, marginBottom: 6 }}>No available job posts</Text>
                    <Text style={{ color: '#9A8FA6', fontSize: 13, textAlign: 'center' }}>
                      All active job posts already have a table, or you have no active job posts.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#9A8FA6', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                      Select Job Post *
                    </Text>

                    {availableJobs.map((job) => {
                      const isSelected = selectedJobId === job.id
                      return (
                        <Pressable
                          key={job.id}
                          onPress={() => setSelectedJobId(job.id)}
                          style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            backgroundColor: isSelected ? '#FF624012' : '#FFFFFF',
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: isSelected ? '#FF6240' : '#DDD6C9',
                            padding: 14,
                            marginBottom: 10,
                            opacity: pressed ? 0.75 : 1,
                          })}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: isSelected ? '700' : '600' }}>
                              {job.title}
                            </Text>
                            <Text style={{ color: '#9A8FA6', fontSize: 11, marginTop: 2 }}>
                              Table name will be set to this job title
                            </Text>
                          </View>
                          {isSelected && <CheckCircleIcon color="#FF6240" />}
                        </Pressable>
                      )
                    })}

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                      <Pressable
                        onPress={handleCloseCreate}
                        style={({ pressed }) => ({
                          flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9',
                          paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text style={{ color: '#5A4F6E', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => createTable()}
                        disabled={isCreating || !selectedJobId}
                        style={({ pressed }) => ({
                          flex: 1, borderRadius: 14,
                          backgroundColor: selectedJobId ? '#FF6240' : '#DDD6C9',
                          paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        {isCreating
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Create Table</Text>
                        }
                      </Pressable>
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}
