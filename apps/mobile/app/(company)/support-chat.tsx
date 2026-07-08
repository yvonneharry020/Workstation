import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Modal, ActionSheetIOS, Dimensions, Pressable,
  AppState, type AppStateStatus,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import Svg, { Path } from 'react-native-svg'
import * as WebBrowser from 'expo-web-browser'
import * as Sentry from '@sentry/react-native'
import { supabase } from '@/lib/supabase'
import { logEvent } from '@/lib/audit'
import type { RealtimeChannel } from '@supabase/supabase-js'

const MAX_FILE_BYTES = 10 * 1024 * 1024

interface Message {
  id: string
  created_at: string
  thread_id: string
  sender_type: 'user' | 'admin'
  sender_name: string
  content: string
  is_read: boolean
  attachment_url: string | null
  attachment_type: 'image' | 'file' | null
  attachment_name: string | null
}

interface Thread {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_type: 'candidate' | 'company'
  subject: string
  status: 'open' | 'in_progress' | 'resolved'
  last_message: string | null
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NG', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function PaperclipIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </Svg>
  )
}

function FileIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
    </Svg>
  )
}

function DownloadIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </Svg>
  )
}

function SendIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" />
    </Svg>
  )
}

function SingleTick({ color }: { color: string }) {
  return (
    <Svg width={12} height={9} viewBox="0 0 12 9" fill="none">
      <Path d="M1 4.5l2.5 2.5L9 1" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function DoubleTick() {
  return (
    <Svg width={18} height={9} viewBox="0 0 18 9" fill="none">
      <Path d="M1 4.5l2.5 2.5L9 1" stroke="#3B82F6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 4.5l2.5 2.5L14 1" stroke="#3B82F6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function ImageBubble({ url, isUser, onPress }: { url: string; isUser: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Image
        source={{ uri: url }}
        style={{
          width: 200, height: 150, borderRadius: 12,
          borderWidth: 1,
          borderColor: isUser ? 'rgba(255,255,255,0.15)' : '#E5E7EB',
        }}
        contentFit="cover"
      />
      <Text style={{ color: isUser ? 'rgba(255,255,255,0.6)' : '#9CA3AF', fontSize: 10, marginTop: 3 }}>
        Tap to view full size
      </Text>
    </TouchableOpacity>
  )
}

function FileBubble({ name, url, isUser }: { name: string; url: string; isUser: boolean }) {
  return (
    <TouchableOpacity
      onPress={() => WebBrowser.openBrowserAsync(url)}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : '#F3F4F6',
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
        borderWidth: 1,
        borderColor: isUser ? 'rgba(255,255,255,0.2)' : '#E5E7EB',
        maxWidth: 220,
      }}
    >
      <FileIcon />
      <Text style={{ color: isUser ? '#1A1625' : '#374151', fontSize: 13, flex: 1 }} numberOfLines={2}>
        {name}
      </Text>
      <DownloadIcon />
    </TouchableOpacity>
  )
}

const SCREEN_WIDTH = Dimensions.get('window').width

export default function CompanySupportChatScreen() {
  const [thread, setThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const listRef = useRef<FlatList>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const threadIdRef = useRef<string | null>(null)

  const initThread = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: existing } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      setThread(existing as Thread)
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', existing.id)
        .order('created_at', { ascending: true })
      if (msgs) setMessages(msgs as Message[])
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('thread_id', existing.id)
        .eq('sender_type', 'admin')
        .eq('is_read', false)
      await supabase
        .from('chat_threads')
        .update({ unread_user: 0 })
        .eq('id', existing.id)
    } else {
      const profile = await supabase.from('company_profiles').select('company_name').eq('id', user.id).maybeSingle()
      const name = profile?.data?.company_name ?? user.email?.split('@')[0] ?? 'Company'
      const { data: newThread, error } = await supabase.from('chat_threads').insert({
        user_id: user.id,
        user_name: name,
        user_email: user.email ?? '',
        user_type: 'company',
        subject: 'Support Request',
        status: 'open',
        last_message: null,
        last_message_at: new Date().toISOString(),
      }).select().single()
      if (!error && newThread) {
        setThread(newThread as Thread)
        logEvent({ event: 'company.support_chat_started', app: 'company_app', targetId: newThread.id, targetType: 'chat_thread' })
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { void initThread() }, [initThread])

  const subscribeToMessages = useCallback((threadId: string) => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
    if (channelRef.current) { void supabase.removeChannel(channelRef.current) }
    channelRef.current = supabase
      .channel(`support-chat-company-${threadId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `thread_id=eq.${threadId}`,
      }, (payload) => {
        const incoming = payload.new as Message
        setMessages(prev => {
          if (prev.some(m => m.id === incoming.id)) return prev
          return [...prev, incoming]
        })
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_messages',
        filter: `thread_id=eq.${threadId}`,
      }, (payload) => {
        const updated = payload.new as Message
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, is_read: updated.is_read } : m))
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
          reconnectTimerRef.current = setTimeout(() => subscribeToMessages(threadId), 5_000)
        }
      })
  }, [])

  useEffect(() => {
    if (!thread?.id) return
    threadIdRef.current = thread.id
    subscribeToMessages(thread.id)
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (channelRef.current) void supabase.removeChannel(channelRef.current)
    }
  }, [thread?.id, subscribeToMessages])

  // Reconnect when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && threadIdRef.current) {
        subscribeToMessages(threadIdRef.current)
      }
    })
    return () => sub.remove()
  }, [subscribeToMessages])

  async function uploadAndSend(uri: string, mimeType: string, filename: string, type: 'image' | 'file', fileSize?: number) {
    if (!thread) return
    if (fileSize && fileSize > MAX_FILE_BYTES) {
      Alert.alert('File too large', 'Please send files under 10 MB.')
      return
    }
    setUploading(true)
    const optimisticId = `optimistic-${Date.now()}`
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const path = `${thread.id}/${Date.now()}-${filename}`

      const formData = new FormData()
      formData.append('file', { uri, name: filename, type: mimeType } as unknown as Blob)

      const uploadRes = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/chat-attachments/${path}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      )
      if (!uploadRes.ok) {
        const body = await uploadRes.text()
        throw new Error(`Upload failed (${uploadRes.status}): ${body}`)
      }

      const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path)

      const { data: { user } } = await supabase.auth.getUser()
      const profile = await supabase.from('company_profiles').select('company_name').eq('id', user?.id ?? '').maybeSingle()
      const name = profile?.data?.company_name ?? user?.email?.split('@')[0] ?? 'Company'

      // Add optimistic message so the sender sees it immediately
      const optimisticMsg: Message = {
        id: optimisticId,
        created_at: new Date().toISOString(),
        thread_id: thread.id,
        sender_type: 'user',
        sender_name: name,
        content: '',
        is_read: false,
        attachment_url: urlData.publicUrl,
        attachment_type: type,
        attachment_name: filename,
      }
      setMessages(prev => [...prev, optimisticMsg])
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)

      const { data: inserted, error: insertError } = await supabase.from('chat_messages').insert({
        thread_id: thread.id,
        sender_id: user?.id ?? null,
        sender_type: 'user',
        sender_name: name,
        content: '',
        is_read: false,
        attachment_url: urlData.publicUrl,
        attachment_type: type,
        attachment_name: filename,
      }).select('id').single()

      if (insertError) throw insertError

      if (inserted) {
        setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, id: (inserted as { id: string }).id } : m))
      }

      // DB trigger handles last_message, last_message_at, unread_admin increment
      logEvent({ event: 'company.support_attachment_sent', app: 'company_app', targetId: thread.id, targetType: 'chat_thread' })
    } catch (err) {
      Sentry.captureException(err)
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      const detail = err instanceof Error ? err.message : String(err)
      Alert.alert('Upload failed', detail)
    } finally {
      setUploading(false)
    }
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const filename = asset.fileName ?? `image-${Date.now()}.jpg`
    const mime = asset.mimeType ?? 'image/jpeg'
    await uploadAndSend(asset.uri, mime, filename, 'image', asset.fileSize ?? undefined)
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'],
      multiple: false,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    await uploadAndSend(asset.uri, asset.mimeType ?? 'application/octet-stream', asset.name, 'file', asset.size ?? undefined)
  }

  function openAttachmentPicker() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Send Image', 'Send File (PDF, Word, Excel)'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) void pickImage()
          if (idx === 2) void pickFile()
        },
      )
    } else {
      Alert.alert('Attach', 'What would you like to send?', [
        { text: 'Image from gallery', onPress: () => void pickImage() },
        { text: 'File (PDF, Word, Excel)', onPress: () => void pickFile() },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }

  async function sendMessage() {
    if (!input.trim() || !thread || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)

    const { data: { user } } = await supabase.auth.getUser()
    const profile = await supabase.from('company_profiles').select('company_name').eq('id', user?.id ?? '').maybeSingle()
    const name = profile?.data?.company_name ?? user?.email?.split('@')[0] ?? 'Company'

    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      created_at: new Date().toISOString(),
      thread_id: thread.id,
      sender_type: 'user',
      sender_name: name,
      content,
      is_read: false,
      attachment_url: null,
      attachment_type: null,
      attachment_name: null,
    }
    setMessages(prev => [...prev, optimisticMsg])
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)

    const { data: inserted, error } = await supabase.from('chat_messages').insert({
      thread_id: thread.id,
      sender_id: user?.id ?? null,
      sender_type: 'user',
      sender_name: name,
      content,
      is_read: false,
      attachment_url: null,
      attachment_type: null,
      attachment_name: null,
    }).select('id').single()

    if (!error && inserted) {
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...m, id: (inserted as { id: string }).id } : m))
      // DB trigger handles last_message, last_message_at, unread_admin increment
      logEvent({ event: 'company.support_message_sent', app: 'company_app', targetId: thread.id, targetType: 'chat_thread' })
    } else if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      Alert.alert('Error', 'Failed to send message. Please try again.')
      setInput(content)
    }

    setSending(false)
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#F59E0B" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="px-4 py-3 border-b border-gray-100 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center rounded-full bg-gray-100">
          <BackIcon />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-sm font-bold text-gray-900">Workstation Support</Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <View className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <Text className="text-xs text-gray-500">We typically reply within a few hours</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View className="py-12 items-center">
              <Text className="text-4xl mb-3">💼</Text>
              <Text className="text-base font-semibold text-gray-800 mb-1">How can we help?</Text>
              <Text className="text-sm text-gray-500 text-center px-8">
                Send a message and our support team will respond shortly. You can also attach images or files as evidence.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.sender_type === 'user'
            return (
              <View className={`mb-3 ${isUser ? 'items-end' : 'items-start'}`}>
                {!isUser && (
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <View className="w-6 h-6 rounded-full bg-amber-500 items-center justify-center">
                      <Text className="text-[#1A1625] text-[9px] font-bold">WS</Text>
                    </View>
                    <Text className="text-[10px] text-gray-500 font-semibold">{item.sender_name}</Text>
                  </View>
                )}

                {item.attachment_type === 'image' && item.attachment_url ? (
                  <View className={`${isUser ? 'items-end' : 'items-start'}`}>
                    <ImageBubble url={item.attachment_url} isUser={isUser} onPress={() => setPreviewImageUrl(item.attachment_url)} />
                    {item.content ? (
                      <View className={`mt-1.5 max-w-[78%] px-4 py-2.5 rounded-2xl ${isUser ? 'bg-amber-500 rounded-br-sm' : 'bg-gray-100 rounded-bl-sm'}`}>
                        <Text className={`text-sm leading-relaxed ${isUser ? 'text-[#1A1625]' : 'text-gray-800'}`}>{item.content}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : item.attachment_type === 'file' && item.attachment_url ? (
                  <FileBubble name={item.attachment_name ?? 'File'} url={item.attachment_url} isUser={isUser} />
                ) : (
                  <View className={`max-w-[78%] px-4 py-2.5 rounded-2xl ${isUser ? 'bg-amber-500 rounded-br-sm' : 'bg-gray-100 rounded-bl-sm'}`}>
                    <Text className={`text-sm leading-relaxed ${isUser ? 'text-[#1A1625]' : 'text-gray-800'}`}>{item.content}</Text>
                  </View>
                )}

                <View className={`flex-row items-center gap-1 mt-1 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <Text className="text-[10px] text-gray-400">{formatTime(item.created_at)}</Text>
                  {isUser && (
                    item.id.startsWith('optimistic-') ? (
                      <SingleTick color="rgba(156,163,175,0.5)" />
                    ) : item.is_read ? (
                      <DoubleTick />
                    ) : (
                      <SingleTick color="rgba(156,163,175,0.7)" />
                    )
                  )}
                </View>
              </View>
            )
          }}
        />

        <View className="px-4 py-3 border-t border-gray-100 flex-row items-end gap-2">
          <TouchableOpacity
            onPress={openAttachmentPicker}
            disabled={uploading}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mb-0.5"
            style={{ opacity: uploading ? 0.5 : 1 }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#9CA3AF" />
            ) : (
              <PaperclipIcon />
            )}
          </TouchableOpacity>

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message…"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 max-h-28"
            style={{ lineHeight: 20 }}
          />

          <TouchableOpacity
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            className={`w-10 h-10 rounded-full items-center justify-center ${!input.trim() || sending ? 'bg-gray-200' : 'bg-amber-500'}`}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <SendIcon />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!previewImageUrl} transparent animationType="fade" onRequestClose={() => setPreviewImageUrl(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: '#000000EE', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setPreviewImageUrl(null)}
        >
          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH, maxHeight: '80%' }}
              contentFit="contain"
            />
          )}
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 16 }}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}
