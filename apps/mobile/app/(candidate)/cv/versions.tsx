import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface CvVersion {
  id: string
  name: string
  template_id: string
  created_at: string
  updated_at: string
  cv_templates: { name: string } | null
}

function timeAgo(d: string): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function EditIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  )
}

function TrashIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Svg>
  )
}

function DownloadIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </Svg>
  )
}

function CvCard({ cv, onDelete }: { cv: CvVersion; onDelete: (id: string) => void }) {
  const templateName = cv.cv_templates?.name ?? `Template ${cv.template_id.slice(0, 6)}`

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-3"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-4">
          <Text className="text-white font-bold text-base">{cv.name}</Text>
          <Text className="text-slate-500 text-xs mt-1">{templateName} · Updated {timeAgo(cv.updated_at)}</Text>
        </View>
        <View style={{ width: 36, height: 48, borderRadius: 6, backgroundColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FF6240', fontSize: 8, fontWeight: '700' }}>PDF</Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => router.push(`/(candidate)/cv/edit?versionId=${cv.id}` as Parameters<typeof router.push>[0])}
          className="flex-row items-center gap-1.5 active:opacity-70"
          style={{ flex: 1, backgroundColor: '#1E1B2E', borderRadius: 10, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' }}
        >
          <EditIcon />
          <Text className="text-slate-300 text-xs font-semibold">Edit</Text>
        </Pressable>

        <Pressable
          onPress={() => Alert.alert('Coming soon', 'PDF download will be available in the next update.')}
          className="flex-row items-center gap-1.5 active:opacity-70"
          style={{ flex: 1, backgroundColor: '#1E1B2E', borderRadius: 10, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' }}
        >
          <DownloadIcon />
          <Text className="text-slate-300 text-xs font-semibold">Download</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            Alert.alert('Delete CV?', `"${cv.name}" will be permanently removed.`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onDelete(cv.id) },
            ])
          }
          style={{ width: 38, height: 38, backgroundColor: '#7F1D1D20', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
          className="active:opacity-70"
        >
          <TrashIcon />
        </Pressable>
      </View>
    </Animated.View>
  )
}

export default function CvVersionsScreen() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  const { data: versions = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['cv-versions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cv_versions')
        .select('*, cv_templates(name)')
        .eq('candidate_id', user!.id)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CvVersion[]
    },
    enabled: !!user?.id,
  })

  const handleDelete = async (id: string) => {
    await supabase.from('cv_versions').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['cv-versions', user?.id] })
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-5 pt-5 pb-4">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 5l-7 7 7 7" />
          </Svg>
        </Pressable>
        <Text className="text-white text-base font-semibold">My CVs</Text>
        <Pressable
          onPress={() => router.push('/(candidate)/cv' as Parameters<typeof router.push>[0])}
          hitSlop={12}
          className="active:opacity-70"
        >
          <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '600' }}>+ New</Text>
        </Pressable>
      </View>

      <FlatList
        data={versions}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />}
        ListEmptyComponent={
          isLoading ? (
            <View className="py-20 items-center">
              <Text className="text-slate-500 text-sm">Loading CVs…</Text>
            </View>
          ) : (
            <View className="py-16 items-center px-6">
              <View
                style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
              >
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </Svg>
              </View>
              <Text className="text-white text-base font-semibold text-center mb-2">No CVs yet</Text>
              <Text className="text-slate-400 text-sm text-center leading-5 mb-6">
                Create your first CV from one of our professional templates.
              </Text>
              <Pressable
                onPress={() => router.push('/(candidate)/cv' as Parameters<typeof router.push>[0])}
                className="bg-primary-500 rounded-2xl px-8 py-4 active:opacity-80"
              >
                <Text className="text-white font-semibold">Create CV</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => <CvCard cv={item} onDelete={handleDelete} />}
      />
    </SafeAreaView>
  )
}
