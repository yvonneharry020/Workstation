import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Rect, Circle } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface CvTemplate { id: string; name: string; sort_order: number }
interface CvVersion { id: string; label: string; template_id: string | null }

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function TemplatePreview({ name }: { name: string }) {
  if (name === 'Classic') {
    return (
      <Svg width={100} height={130} viewBox="0 0 100 130">
        <Rect width={100} height={130} rx={6} fill="#F5F0E8" />
        <Rect x={8} y={8} width={84} height={28} rx={4} fill="#DDD6C9" />
        <Rect x={8} y={44} width={50} height={5} rx={2} fill="#C8BFB0" />
        <Rect x={8} y={54} width={40} height={4} rx={2} fill="#DDD6C9" />
        <Rect x={8} y={66} width={84} height={3} rx={1} fill="#EDE7DB" />
        <Rect x={8} y={74} width={76} height={3} rx={1} fill="#EDE7DB" />
        <Rect x={8} y={82} width={60} height={3} rx={1} fill="#EDE7DB" />
        <Rect x={8} y={96} width={50} height={5} rx={2} fill="#C8BFB0" />
        <Rect x={8} y={106} width={84} height={3} rx={1} fill="#EDE7DB" />
        <Rect x={8} y={114} width={76} height={3} rx={1} fill="#EDE7DB" />
      </Svg>
    )
  }
  if (name === 'Modern') {
    return (
      <Svg width={100} height={130} viewBox="0 0 100 130">
        <Rect width={30} height={130} rx={0} fill="#FF624020" />
        <Rect width={100} height={130} rx={6} fill="none" stroke="#DDD6C9" strokeWidth={1} />
        <Circle cx={15} cy={22} r={10} fill="#FF624040" />
        <Rect x={5} y={36} width={20} height={3} rx={1} fill="#C8BFB0" />
        <Rect x={5} y={44} width={20} height={3} rx={1} fill="#DDD6C9" />
        <Rect x={5} y={52} width={20} height={3} rx={1} fill="#DDD6C9" />
        <Rect x={36} y={10} width={56} height={6} rx={2} fill="#1A162520" />
        <Rect x={36} y={22} width={40} height={4} rx={2} fill="#DDD6C9" />
        <Rect x={36} y={38} width={50} height={4} rx={2} fill="#C8BFB0" />
        <Rect x={36} y={48} width={56} height={3} rx={1} fill="#EDE7DB" />
        <Rect x={36} y={56} width={50} height={3} rx={1} fill="#EDE7DB" />
        <Rect x={36} y={76} width={50} height={4} rx={2} fill="#C8BFB0" />
        <Rect x={36} y={86} width={56} height={3} rx={1} fill="#EDE7DB" />
        <Rect x={36} y={94} width={44} height={3} rx={1} fill="#EDE7DB" />
      </Svg>
    )
  }
  // Minimal
  return (
    <Svg width={100} height={130} viewBox="0 0 100 130">
      <Rect width={100} height={130} rx={6} fill="#FAFAF8" />
      <Rect x={8} y={12} width={60} height={7} rx={2} fill="#1A162530" />
      <Rect x={8} y={24} width={40} height={4} rx={2} fill="#C8BFB0" />
      <Rect x={8} y={38} width={84} height={1} rx={0} fill="#DDD6C9" />
      <Rect x={8} y={46} width={30} height={4} rx={2} fill="#C8BFB0" />
      <Rect x={8} y={56} width={84} height={3} rx={1} fill="#EDE7DB" />
      <Rect x={8} y={64} width={76} height={3} rx={1} fill="#EDE7DB" />
      <Rect x={8} y={76} width={30} height={4} rx={2} fill="#C8BFB0" />
      <Rect x={8} y={86} width={84} height={3} rx={1} fill="#EDE7DB" />
      <Rect x={8} y={94} width={64} height={3} rx={1} fill="#EDE7DB" />
      <Rect x={8} y={104} width={30} height={4} rx={2} fill="#C8BFB0" />
      <Rect x={8} y={114} width={84} height={3} rx={1} fill="#EDE7DB" />
    </Svg>
  )
}

export default function ProfileTemplateScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const { data: templates = [], isLoading: templatesLoading } = useQuery<CvTemplate[]>({
    queryKey: ['cv-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cv_templates')
        .select('id, name, sort_order')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as CvTemplate[]
    },
  })

  const { data: activeVersion } = useQuery<CvVersion | null>({
    queryKey: ['active-cv-version', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('cv_versions')
        .select('id, label, template_id')
        .eq('candidate_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return (data as CvVersion | null) ?? null
    },
    enabled: !!user?.id,
  })

  const [selectedId, setSelectedId] = useState<string | null>(activeVersion?.template_id ?? null)

  const applyMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (activeVersion?.id) {
        const { error } = await supabase
          .from('cv_versions')
          .update({ template_id: templateId })
          .eq('id', activeVersion.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('cv_versions').insert({
          candidate_id: user!.id,
          template_id: templateId,
          label: 'My CV',
        })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-cv-version'] })
      queryClient.invalidateQueries({ queryKey: ['cv-versions'] })
      Alert.alert('Template applied', 'Your profile template has been updated.')
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  })

  const handleSelect = (id: string) => {
    setSelectedId(id)
    applyMutation.mutate(id)
  }

  const TEMPLATE_DESC: Record<string, string> = {
    Classic: 'Traditional layout. Sections stack cleanly. Best for corporate and finance roles.',
    Modern: 'Left sidebar with your key details. Accent colour highlights. Great for tech and creative roles.',
    Minimal: 'Clean white space, thin lines. No colour distractions. Best for senior and executive positions.',
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
        <Pressable onPress={() => router.back()} hitSlop={12} className="active:opacity-70">
          <BackIcon />
        </Pressable>
        <View>
          <Text style={{ color: '#1A1625', fontSize: 17, fontWeight: '700' }}>Profile Template</Text>
          <Text style={{ color: '#64748B', fontSize: 12 }}>Choose how companies see your profile</Text>
        </View>
      </View>

      {templatesLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FF6240" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            {templates.map((t, i) => {
              const isSelected = selectedId === t.id || (!selectedId && i === 0)
              return (
                <Animated.View key={t.id} entering={FadeInDown.delay(i * 60).duration(300)} style={{ width: '47%' }}>
                  <Pressable
                    onPress={() => handleSelect(t.id)}
                    style={{
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: isSelected ? '#FF6240' : '#DDD6C9',
                      backgroundColor: isSelected ? '#FF624008' : '#EDE7DB',
                      overflow: 'hidden',
                      padding: 12,
                      alignItems: 'center',
                    }}
                    className="active:opacity-80"
                    disabled={applyMutation.isPending}
                  >
                    <View style={{ marginBottom: 10, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#DDD6C9' }}>
                      <TemplatePreview name={t.name} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {isSelected && (
                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF6240', alignItems: 'center', justifyContent: 'center' }}>
                          <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M20 6L9 17l-5-5" />
                          </Svg>
                        </View>
                      )}
                      <Text style={{ color: isSelected ? '#FF6240' : '#1A1625', fontSize: 13, fontWeight: '700' }}>{t.name}</Text>
                    </View>
                    <Text style={{ color: '#64748B', fontSize: 11, textAlign: 'center', lineHeight: 15 }}>{TEMPLATE_DESC[t.name] ?? ''}</Text>
                  </Pressable>
                </Animated.View>
              )
            })}
          </View>

          <View style={{ marginTop: 24, backgroundColor: '#EDE7DB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#DDD6C9' }}>
            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>How templates work</Text>
            <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18 }}>
              Your selected template controls how your CV looks when shared with companies. It applies to your most recent CV version. You can change it at any time.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
