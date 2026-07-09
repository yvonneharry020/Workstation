import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  variables: string[]
  is_system: boolean
  created_at?: string
}

const SYSTEM_TEMPLATES: EmailTemplate[] = [
  {
    id: 'sys-1',
    name: 'Application Received',
    subject: 'We received your application for {{jobTitle}}',
    body: 'Dear {{firstName}},\n\nThank you for applying for the {{jobTitle}} position at {{companyName}}. We have received your application and will review it shortly.\n\nWe will be in touch with next steps.\n\nBest regards,\n{{companyName}} Recruitment Team',
    variables: ['firstName', 'jobTitle', 'companyName'],
    is_system: true,
  },
  {
    id: 'sys-2',
    name: 'Shortlisted',
    subject: 'Great news! You have been shortlisted for {{jobTitle}}',
    body: 'Congratulations {{firstName}},\n\nWe are pleased to inform you that you have been shortlisted for the {{jobTitle}} role at {{companyName}}. We will be in touch shortly with next steps.\n\nBest regards,\n{{companyName}} Recruitment Team',
    variables: ['firstName', 'jobTitle', 'companyName'],
    is_system: true,
  },
  {
    id: 'sys-3',
    name: 'Interview Invitation',
    subject: 'Interview invitation — {{jobTitle}} at {{companyName}}',
    body: "Dear {{firstName}},\n\nWe'd like to invite you to interview for the {{jobTitle}} position at {{companyName}}. Please check your interview portal for available time slots.\n\nLooking forward to speaking with you.\n\nBest regards,\n{{companyName}} Recruitment Team",
    variables: ['firstName', 'jobTitle', 'companyName'],
    is_system: true,
  },
  {
    id: 'sys-4',
    name: 'Offer Letter',
    subject: 'Job offer — {{jobTitle}} at {{companyName}}',
    body: 'Dear {{firstName}},\n\nWe are pleased to offer you the position of {{jobTitle}} at {{companyName}}. Please review your offer details on the portal and confirm your acceptance within 5 business days.\n\nWelcome to the team!\n\nBest regards,\n{{companyName}} Recruitment Team',
    variables: ['firstName', 'jobTitle', 'companyName'],
    is_system: true,
  },
  {
    id: 'sys-5',
    name: 'Rejection',
    subject: 'Your application for {{jobTitle}} at {{companyName}}',
    body: 'Dear {{firstName}},\n\nThank you for your interest in the {{jobTitle}} position at {{companyName}} and for the time you invested in our process.\n\nAfter careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs. We encourage you to apply for future openings.\n\nWe wish you the best in your job search.\n\nBest regards,\n{{companyName}} Recruitment Team',
    variables: ['firstName', 'jobTitle', 'companyName'],
    is_system: true,
  },
  {
    id: 'sys-6',
    name: 'Interview Reminder',
    subject: 'Reminder: Your interview for {{jobTitle}} is tomorrow',
    body: 'Hi {{firstName}},\n\nThis is a friendly reminder that your interview for the {{jobTitle}} position at {{companyName}} is scheduled for tomorrow. Please check your portal for the exact time and joining instructions.\n\nLooking forward to speaking with you!\n\nBest regards,\n{{companyName}} Recruitment Team',
    variables: ['firstName', 'jobTitle', 'companyName'],
    is_system: true,
  },
]

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function PlusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function TrashIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </Svg>
  )
}

function VariableChip({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: '#0DD4C315', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: '#0DD4C3', fontSize: 10, fontFamily: 'monospace' }}>{`{{${label}}}`}</Text>
    </View>
  )
}

function TemplateCard({
  template,
  isSystem,
  onUse,
  onDelete,
}: {
  template: EmailTemplate
  isSystem: boolean
  onUse: () => void
  onDelete?: () => void
}) {
  const vars = template.variables ?? []
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 10 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700', marginBottom: 3 }}>{template.name}</Text>
          <Text style={{ color: '#64748B', fontSize: 12 }} numberOfLines={1}>{template.subject}</Text>
        </View>
        {isSystem && (
          <View style={{ backgroundColor: '#DDD6C9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: '#475569', fontSize: 10, fontWeight: '600' }}>SYSTEM</Text>
          </View>
        )}
      </View>

      {vars.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {vars.map((v) => <VariableChip key={v} label={v} />)}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onUse}
          style={{ flex: 1, backgroundColor: '#FF624015', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FF624030' }}
        >
          <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>Use template</Text>
        </Pressable>
        {!isSystem && onDelete && (
          <Pressable
            onPress={onDelete}
            style={{ backgroundColor: '#EF444415', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#EF444430' }}
          >
            <TrashIcon />
          </Pressable>
        )}
      </View>
    </Animated.View>
  )
}

interface NewTemplateForm {
  name: string
  subject: string
  body: string
}

export default function EmailTemplatesScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [showNewForm, setShowNewForm] = useState(false)
  const [form, setForm] = useState<NewTemplateForm>({ name: '', subject: '', body: '' })

  const { data: customTemplates = [], isLoading } = useQuery({
    queryKey: ['custom-email-templates', user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('email_templates')
          .select('*')
          .eq('company_id', user!.id)
          .eq('is_system', false)
          .order('created_at', { ascending: false })
        if (error) throw error
        return (data as unknown as EmailTemplate[]) ?? []
      } catch {
        return []
      }
    },
    enabled: !!user?.id,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const vars = (form.body.match(/\{\{(\w+)\}\}/g) ?? []).map((m) => m.slice(2, -2))
      const { error } = await supabase.from('email_templates').insert({
        company_id: user!.id,
        name: form.name,
        subject: form.subject,
        body: form.body,
        variables: [...new Set(vars)],
        is_system: false,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-email-templates'] })
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      setForm({ name: '', subject: '', body: '' })
      setShowNewForm(false)
    },
    onError: () => Alert.alert('Error', 'Failed to save template.'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-email-templates'] })
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
    },
  })

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete template', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ])
  }

  const handleUse = (template: EmailTemplate) => {
    router.push({ pathname: '/(company)/email/compose', params: { templateKey: template.id } })
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-4 border-b border-surface-border">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <Text className="text-[#1A1625] text-2xl font-bold flex-1">Email Templates</Text>
        <Pressable
          onPress={() => setShowNewForm((v) => !v)}
          style={{ backgroundColor: '#FF6240', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <PlusIcon />
          <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '700' }}>New</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingVertical: 20 }}>
          {showNewForm && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1.5, borderColor: '#FF624040', padding: 16, marginBottom: 24 }}
            >
              <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '700', marginBottom: 12 }}>New Template</Text>
              <TextInput
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Template name…"
                placeholderTextColor="#475569"
                style={{ backgroundColor: '#F5F0E8', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 12, marginBottom: 10 }}
              />
              <TextInput
                value={form.subject}
                onChangeText={(v) => setForm((f) => ({ ...f, subject: v }))}
                placeholder="Subject line…"
                placeholderTextColor="#475569"
                style={{ backgroundColor: '#F5F0E8', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 12, marginBottom: 10 }}
              />
              <TextInput
                value={form.body}
                onChangeText={(v) => setForm((f) => ({ ...f, body: v }))}
                placeholder="Email body… Use {{firstName}}, {{jobTitle}}, {{companyName}}"
                placeholderTextColor="#475569"
                multiline
                style={{ backgroundColor: '#F5F0E8', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 12, minHeight: 120, textAlignVertical: 'top', marginBottom: 12 }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => { setShowNewForm(false); setForm({ name: '', subject: '', body: '' }) }}
                  style={{ flex: 1, backgroundColor: '#DDD6C9', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#5A4F6E', fontWeight: '600' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => createMutation.mutate()}
                  disabled={!form.name || !form.subject || !form.body || createMutation.isPending}
                  style={{ flex: 1, backgroundColor: '#FF6240', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#1A1625', fontWeight: '700' }}>Save</Text>
                  )}
                </Pressable>
              </View>
            </Animated.View>
          )}

          <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>SYSTEM TEMPLATES</Text>
          {SYSTEM_TEMPLATES.map((t) => (
            <TemplateCard key={t.id} template={t} isSystem onUse={() => handleUse(t)} />
          ))}

          <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 16, marginBottom: 12 }}>
            CUSTOM TEMPLATES {customTemplates.length > 0 ? `(${customTemplates.length})` : ''}
          </Text>
          {isLoading ? (
            <ActivityIndicator color="#FF6240" style={{ marginTop: 20 }} />
          ) : customTemplates.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 30, backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', borderStyle: 'dashed' }}>
              <Text style={{ color: '#475569', fontSize: 14 }}>No custom templates yet</Text>
              <Text style={{ color: '#334155', fontSize: 12, marginTop: 4 }}>Tap "New" to create your first template</Text>
            </View>
          ) : (
            customTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                isSystem={false}
                onUse={() => handleUse(t)}
                onDelete={() => handleDelete(t.id, t.name)}
              />
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
