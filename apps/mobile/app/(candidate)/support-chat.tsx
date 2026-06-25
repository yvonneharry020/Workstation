import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { logEvent } from '@/lib/audit'

interface Message {
  id: string
  created_at: string
  thread_id: string
  sender_type: 'user' | 'admin'
  sender_name: string
  content: string
  is_read: boolean
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

export default function CandidateSupportChatScreen() {
  const [thread, setThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const listRef = useRef<FlatList>(null)

  const initThread = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Find existing open thread for this user
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
      // Fetch messages
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', existing.id)
        .order('created_at', { ascending: true })
      if (msgs) setMessages(msgs as Message[])
      // Mark admin messages as read
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
      // Create new thread on first open
      const profile = await supabase.from('candidate_profiles').select('full_name').eq('user_id', user.id).maybeSingle()
      const name = profile?.data?.full_name ?? user.email?.split('@')[0] ?? 'Candidate'
      const { data: newThread, error } = await supabase.from('chat_threads').insert({
        user_id: user.id,
        user_name: name,
        user_email: user.email ?? '',
        user_type: 'candidate',
        subject: 'Support Request',
        status: 'open',
        last_message: null,
        last_message_at: new Date().toISOString(),
      }).select().single()
      if (!error && newThread) {
        setThread(newThread as Thread)
        logEvent({ event: 'candidate.support_chat_started', app: 'candidate_app', targetId: newThread.id, targetType: 'chat_thread' })
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { void initThread() }, [initThread])

  // Real-time subscription for new messages
  useEffect(() => {
    if (!thread) return
    const channel = supabase
      .channel(`support-chat-candidate-${thread.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `thread_id=eq.${thread.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [thread])

  async function sendMessage() {
    if (!input.trim() || !thread || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)

    const { data: { user } } = await supabase.auth.getUser()
    const profile = await supabase.from('candidate_profiles').select('full_name').eq('user_id', user?.id ?? '').maybeSingle()
    const name = profile?.data?.full_name ?? user?.email?.split('@')[0] ?? 'Candidate'

    const { error } = await supabase.from('chat_messages').insert({
      thread_id: thread.id,
      sender_id: user?.id ?? null,
      sender_type: 'user',
      sender_name: name,
      content,
      is_read: false,
    })

    if (!error) {
      await supabase.from('chat_threads').update({
        last_message: content,
        last_message_at: new Date().toISOString(),
        unread_admin: (thread.status === 'open' ? 1 : 0),
      }).eq('id', thread.id)
      logEvent({ event: 'candidate.support_message_sent', app: 'candidate_app', targetId: thread.id, targetType: 'chat_thread' })
    } else {
      Alert.alert('Error', 'Failed to send message. Please try again.')
      setInput(content)
    }

    setSending(false)
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0DD4C3" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-100 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center rounded-full bg-gray-100">
          <Text className="text-gray-600 text-lg">←</Text>
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
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View className="py-12 items-center">
              <Text className="text-4xl mb-3">💬</Text>
              <Text className="text-base font-semibold text-gray-800 mb-1">How can we help?</Text>
              <Text className="text-sm text-gray-500 text-center px-8">Send a message and our team will get back to you as soon as possible.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.sender_type === 'user'
            return (
              <View className={`mb-3 ${isUser ? 'items-end' : 'items-start'}`}>
                {!isUser && (
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <View className="w-6 h-6 rounded-full bg-teal-500 items-center justify-center">
                      <Text className="text-white text-[9px] font-bold">WS</Text>
                    </View>
                    <Text className="text-[10px] text-gray-500 font-semibold">{item.sender_name}</Text>
                  </View>
                )}
                <View className={`max-w-[78%] px-4 py-2.5 rounded-2xl ${isUser ? 'bg-teal-500 rounded-br-sm' : 'bg-gray-100 rounded-bl-sm'}`}>
                  <Text className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-gray-800'}`}>{item.content}</Text>
                </View>
                <Text className="text-[10px] text-gray-400 mt-1 px-1">{formatTime(item.created_at)}</Text>
              </View>
            )
          }}
        />

        {/* Input area */}
        <View className="px-4 py-3 border-t border-gray-100 flex-row items-end gap-2">
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
            className={`w-10 h-10 rounded-full items-center justify-center ${!input.trim() || sending ? 'bg-gray-200' : 'bg-teal-500'}`}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className={`text-base ${!input.trim() ? 'text-gray-400' : 'text-white'}`}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
