import {
  View,
  Text,
  Pressable,
  FlatList,
  Alert,
  Dimensions,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2

interface CvTemplate {
  id: string
  name: string
  description: string | null
  preview_image_url: string | null
  is_premium: boolean
}

const FALLBACK_TEMPLATES: CvTemplate[] = [
  { id: 'pro', name: 'Professional', description: 'Classic layout for all industries', preview_image_url: null, is_premium: false },
  { id: 'modern', name: 'Modern', description: 'Clean, contemporary design', preview_image_url: null, is_premium: false },
  { id: 'minimal', name: 'Minimal', description: 'Refined and elegant', preview_image_url: null, is_premium: true },
  { id: 'bold', name: 'Bold', description: 'High-impact visual style', preview_image_url: null, is_premium: true },
]

const PLACEHOLDER_COLORS: Record<string, string> = {
  pro: '#1A1528',
  modern: '#0C1A1A',
  minimal: '#1A1215',
  bold: '#0F1A0C',
}

function DocumentIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M16 13H8M16 17H8M10 9H8" />
    </Svg>
  )
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: CvTemplate
  selected: boolean
  onSelect: (t: CvTemplate) => void
}) {
  return (
    <Pressable
      onPress={() => onSelect(template)}
      style={{
        width: CARD_WIDTH,
        marginBottom: 16,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: selected ? '#FF6240' : '#DDD6C9',
        backgroundColor: '#EDE7DB',
        overflow: 'hidden',
      }}
      className="active:opacity-80"
    >
      {template.preview_image_url ? (
        <Image
          source={{ uri: template.preview_image_url }}
          style={{ width: CARD_WIDTH - 4, height: 160 }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: CARD_WIDTH - 4, height: 160,
            backgroundColor: PLACEHOLDER_COLORS[template.id] ?? '#1A1528',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {selected && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FF624015' }} />
          )}
          <View
            style={{ width: 52, height: 68, borderRadius: 4, backgroundColor: '#ffffff10', alignItems: 'center', justifyContent: 'center' }}
          >
            <DocumentIcon />
          </View>
          <View style={{ marginTop: 10, width: CARD_WIDTH - 32 }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ height: 3, backgroundColor: '#ffffff15', borderRadius: 2, marginBottom: 5, width: i === 3 ? '60%' : '100%' }} />
            ))}
          </View>
        </View>
      )}

      <View className="p-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-[#1A1625] font-semibold text-sm">{template.name}</Text>
          {template.is_premium && (
            <View style={{ backgroundColor: '#FF624020', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: '#FF6240', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>PREMIUM</Text>
            </View>
          )}
        </View>
        {template.description && (
          <Text className="text-slate-500 text-xs mt-1">{template.description}</Text>
        )}
      </View>

      {selected && (
        <View style={{ position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF6240', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '700' }}>✓</Text>
        </View>
      )}
    </Pressable>
  )
}

export default function CvTemplateScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: dbTemplates = [] } = useQuery({
    queryKey: ['cv-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('cv_templates').select('*').order('id')
      return (data ?? []) as CvTemplate[]
    },
    staleTime: 1000 * 60 * 10,
  })

  const templates = dbTemplates.length > 0 ? dbTemplates : FALLBACK_TEMPLATES

  const handleSelect = (template: CvTemplate) => {
    if (template.is_premium) {
      Alert.alert('Premium template', 'Premium templates are coming soon. Free templates are available now.')
      return
    }
    setSelectedId(template.id)
  }

  const handleUse = () => {
    if (!selectedId) return
    router.push(`/(candidate)/cv/edit?templateId=${selectedId}` as Parameters<typeof router.push>[0])
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pt-5 pb-4">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 5l-7 7 7 7" />
          </Svg>
        </Pressable>
        <Text className="text-[#1A1625] text-base font-semibold">Choose Template</Text>
        <Pressable onPress={() => router.push('/(candidate)/cv/versions' as Parameters<typeof router.push>[0])} hitSlop={12}>
          <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '600' }}>My CVs</Text>
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(400)} className="px-5 mb-4">
        <Text className="text-slate-400 text-sm leading-5">
          Your CV is auto-populated from your Workstation profile. Choose a template to get started.
        </Text>
      </Animated.View>

      <FlatList
        data={templates}
        keyExtractor={(t) => t.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TemplateCard
            template={item}
            selected={item.id === selectedId}
            onSelect={handleSelect}
          />
        )}
      />

      <View
        className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-4"
        style={{ backgroundColor: '#F5F0E8', borderTopWidth: 1, borderTopColor: '#DDD6C9' }}
      >
        <Pressable
          onPress={handleUse}
          disabled={!selectedId}
          className="rounded-2xl py-4 items-center active:opacity-80"
          style={{ backgroundColor: selectedId ? '#FF6240' : '#DDD6C9', opacity: selectedId ? 1 : 0.5 }}
        >
          <Text className="text-[#1A1625] font-bold text-base">
            {selectedId ? 'Use this template' : 'Select a template'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
