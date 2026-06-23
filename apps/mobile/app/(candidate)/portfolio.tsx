import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native'
import { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2

interface PortfolioItem {
  id: string
  title: string
  description: string | null
  url: string | null
  image_url: string | null
  type: 'project' | 'design' | 'writing' | 'other'
  created_at: string
}

type ItemType = 'project' | 'design' | 'writing' | 'other'

const TYPE_CONFIG: Record<ItemType, { label: string; color: string; bg: string; placeholder: string }> = {
  project: { label: 'Project', color: '#FF6240', bg: '#FF624020', placeholder: '#1A0F0C' },
  design:  { label: 'Design',  color: '#0DD4C3', bg: '#0DD4C320', placeholder: '#091A19' },
  writing: { label: 'Writing', color: '#F59E0B', bg: '#F59E0B20', placeholder: '#1A140A' },
  other:   { label: 'Other',   color: '#94A3B8', bg: '#94A3B820', placeholder: '#131118' },
}

const EMPTY_FORM = { title: '', description: '', url: '', type: 'project' as ItemType, image_url: '' }

function PlusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function ExternalLinkIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <Path d="M15 3h6v6" />
      <Path d="M10 14L21 3" />
    </Svg>
  )
}

function ImageIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10" />
      <Path d="M16 3h5v5" />
      <Path d="M21 3l-9 9" />
      <Path d="M9 15l2-2 4 4" />
      <Path d="M7 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    </Svg>
  )
}

function PortfolioCard({
  item,
  onLongPress,
}: {
  item: PortfolioItem
  onLongPress: (item: PortfolioItem) => void
}) {
  const cfg = TYPE_CONFIG[item.type]
  return (
    <Pressable
      onLongPress={() => onLongPress(item)}
      style={{ width: CARD_WIDTH, marginBottom: 12 }}
      className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden active:opacity-80"
    >
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={{ width: CARD_WIDTH, height: 120 }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{ width: CARD_WIDTH, height: 120, backgroundColor: cfg.placeholder, alignItems: 'center', justifyContent: 'center' }}
        >
          <ImageIcon />
        </View>
      )}
      <View className="p-3">
        <Text className="text-white font-semibold" style={{ fontSize: 13 }} numberOfLines={2}>
          {item.title}
        </Text>
        <View className="flex-row items-center justify-between mt-2">
          <View style={{ backgroundColor: cfg.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color: cfg.color, fontSize: 10, fontWeight: '600' }}>{cfg.label}</Text>
          </View>
          {item.url ? <ExternalLinkIcon /> : null}
        </View>
      </View>
    </Pressable>
  )
}

function ItemModal({
  visible,
  initial,
  userId,
  onClose,
  onSaved,
}: {
  visible: boolean
  initial: PortfolioItem | null
  userId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(
    initial
      ? { title: initial.title, description: initial.description ?? '', url: initial.url ?? '', type: initial.type, image_url: initial.image_url ?? '' }
      : EMPTY_FORM
  )
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]) {
      setIsUploading(true)
      try {
        const uri = result.assets[0].uri
        const ext = uri.split('.').pop() ?? 'jpg'
        const path = `${userId}/${Date.now()}.${ext}`
        const resp = await fetch(uri)
        const blob = await resp.blob()
        await supabase.storage.from('portfolio').upload(path, blob, {
          upsert: false,
          contentType: `image/${ext}`,
        })
        const { data } = supabase.storage.from('portfolio').getPublicUrl(path)
        update('image_url', data.publicUrl)
      } catch {
        Alert.alert('Error', 'Could not upload image.')
      } finally {
        setIsUploading(false)
      }
    }
  }

  const handleSave = async () => {
    if (!form.title.trim()) return Alert.alert('Required', 'Please enter a title.')
    setIsSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        url: form.url.trim() || null,
        type: form.type,
        image_url: form.image_url || null,
      }
      if (initial) {
        await supabase.from('portfolio_items').update(payload).eq('id', initial.id)
      } else {
        await supabase.from('portfolio_items').insert({ ...payload, candidate_id: userId })
      }
      onSaved()
    } catch {
      Alert.alert('Error', 'Could not save item.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#09080E' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View className="flex-row items-center justify-between py-5">
              <Text className="text-white text-base font-semibold">{initial ? 'Edit item' : 'Add portfolio item'}</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text className="text-slate-400 text-sm">Cancel</Text>
              </Pressable>
            </View>

            <Text className="text-slate-300 text-sm font-medium mb-2">Title <Text style={{ color: '#FF6240' }}>*</Text></Text>
            <TextInput
              value={form.title}
              onChangeText={(t) => update('title', t)}
              placeholder="e.g. E-commerce checkout redesign"
              placeholderTextColor="#475569"
              className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-base mb-4"
            />

            <Text className="text-slate-300 text-sm font-medium mb-2">Description</Text>
            <TextInput
              value={form.description}
              onChangeText={(t) => { if (t.length <= 300) update('description', t) }}
              placeholder="Brief description…"
              placeholderTextColor="#475569"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-sm mb-1"
              style={{ minHeight: 80 }}
            />
            <Text className="text-slate-600 text-xs mb-4 text-right">{form.description.length}/300</Text>

            <Text className="text-slate-300 text-sm font-medium mb-3">Type</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {(Object.keys(TYPE_CONFIG) as ItemType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => update('type', t)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: form.type === t ? TYPE_CONFIG[t].color : '#3D3850',
                    backgroundColor: form.type === t ? TYPE_CONFIG[t].bg : '#131118',
                  }}
                >
                  <Text style={{ color: form.type === t ? TYPE_CONFIG[t].color : '#94A3B8', fontSize: 13, fontWeight: '600' }}>
                    {TYPE_CONFIG[t].label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-slate-300 text-sm font-medium mb-2">Link (optional)</Text>
            <TextInput
              value={form.url}
              onChangeText={(t) => update('url', t)}
              placeholder="https://…"
              placeholderTextColor="#475569"
              keyboardType="url"
              autoCapitalize="none"
              className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-base mb-4"
            />

            <Pressable
              onPress={pickImage}
              disabled={isUploading}
              className="border border-surface-border rounded-xl py-4 items-center mb-6 active:opacity-80"
              style={{ borderStyle: 'dashed', opacity: isUploading ? 0.6 : 1 }}
            >
              {form.image_url ? (
                <Image source={{ uri: form.image_url }} style={{ width: '100%', height: 120, borderRadius: 12 }} contentFit="cover" />
              ) : (
                <Text className="text-slate-400 text-sm">{isUploading ? 'Uploading…' : '+ Add cover image'}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
              style={{ opacity: isSaving ? 0.7 : 1 }}
            >
              <Text className="text-white font-semibold text-base">{isSaving ? 'Saving…' : initial ? 'Save changes' : 'Add item'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

export default function PortfolioScreen() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  const [modalVisible, setModalVisible] = useState(false)
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['portfolio', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('candidate_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PortfolioItem[]
    },
    enabled: !!user?.id,
  })

  const onLongPress = (item: PortfolioItem) => {
    Alert.alert(item.title, undefined, [
      { text: 'Edit', onPress: () => { setEditItem(item); setModalVisible(true) } },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete item?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await supabase.from('portfolio_items').delete().eq('id', item.id)
                qc.invalidateQueries({ queryKey: ['portfolio', user?.id] })
              },
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const openAdd = () => { setEditItem(null); setModalVisible(true) }

  const onSaved = () => {
    setModalVisible(false)
    setEditItem(null)
    qc.invalidateQueries({ queryKey: ['portfolio', user?.id] })
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-5 pt-5 pb-4">
        <Text className="text-white text-2xl font-bold">Portfolio</Text>
        <Pressable onPress={openAdd} className="flex-row items-center gap-1.5 active:opacity-70">
          <PlusIcon />
          <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '600' }}>Add</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-slate-500 text-sm">Loading portfolio…</Text>
        </View>
      ) : items.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(400)} className="flex-1 items-center justify-center px-8">
          <Text className="text-white text-lg font-semibold text-center mb-2">Showcase your work</Text>
          <Text className="text-slate-400 text-sm text-center leading-5 mb-6">
            Add projects, designs, or writing samples to stand out to employers.
          </Text>
          <Pressable
            onPress={openAdd}
            className="bg-primary-500 rounded-2xl px-8 py-4 active:opacity-80"
          >
            <Text className="text-white font-semibold">Add first item</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <PortfolioCard item={item} onLongPress={onLongPress} />}
        />
      )}

      <ItemModal
        visible={modalVisible}
        initial={editItem}
        userId={user?.id ?? ''}
        onClose={() => { setModalVisible(false); setEditItem(null) }}
        onSaved={onSaved}
      />
    </SafeAreaView>
  )
}
