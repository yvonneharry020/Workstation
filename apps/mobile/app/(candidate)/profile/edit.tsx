import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface CandidateProfile {
  first_name: string
  last_name: string
  headline: string | null
  bio: string | null
  avatar_url: string | null
  github_url: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  is_open_to_work: boolean
}

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: value ? '#FF6240' : '#3D3850',
        padding: 2,
        justifyContent: 'center',
        alignItems: value ? 'flex-end' : 'flex-start',
      }}
    >
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
    </Pressable>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: '#131118',
      borderWidth: 1,
      borderColor: '#1E1B2E',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    }}>
      {children}
    </View>
  )
}

function FieldLabel({ text }: { text: string }) {
  return (
    <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>{text}</Text>
  )
}

function StyledInput({
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  keyboardType,
  autoCapitalize,
}: {
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  multiline?: boolean
  maxLength?: number
  keyboardType?: 'default' | 'url' | 'email-address'
  autoCapitalize?: 'none' | 'words' | 'sentences'
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#475569"
      multiline={multiline}
      maxLength={maxLength}
      keyboardType={keyboardType ?? 'default'}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={{
        backgroundColor: '#09080E',
        borderWidth: 1,
        borderColor: '#1E1B2E',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 14,
        minHeight: multiline ? 88 : undefined,
      }}
    />
  )
}

export default function EditProfileScreen() {
  const user = useAuthStore((s) => s.user)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [isOpenToWork, setIsOpenToWork] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { data: profile } = useQuery<CandidateProfile>({
    queryKey: ['candidate-profile-edit', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select('first_name, last_name, headline, bio, avatar_url, github_url, linkedin_url, portfolio_url, is_open_to_work')
        .eq('id', user!.id)
        .single()
      if (error) throw new Error(error.message)
      return data as CandidateProfile
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (!profile) return
    setFirstName(profile.first_name ?? '')
    setLastName(profile.last_name ?? '')
    setHeadline(profile.headline ?? '')
    setBio(profile.bio ?? '')
    setGithubUrl(profile.github_url ?? '')
    setLinkedinUrl(profile.linkedin_url ?? '')
    setPortfolioUrl(profile.portfolio_url ?? '')
    setIsOpenToWork(profile.is_open_to_work ?? true)
    setAvatarUrl(profile.avatar_url ?? null)
  }, [profile])

  const pickAndUploadPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    setIsUploading(true)
    try {
      const uri = result.assets[0].uri
      const ext = uri.split('.').pop() ?? 'jpg'
      const path = `${user!.id}/avatar.${ext}`
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(urlData.publicUrl)
    } catch {
      Alert.alert('Error', 'Could not upload photo. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', 'First and last name are required.')
      return
    }
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('candidate_profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          headline: headline.trim() || null,
          bio: bio.trim() || null,
          github_url: githubUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          portfolio_url: portfolioUrl.trim() || null,
          is_open_to_work: isOpenToWork,
          avatar_url: avatarUrl,
        })
        .eq('id', user!.id)
      if (error) throw error
      router.back()
    } catch {
      Alert.alert('Error', 'Could not save profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#1E1B2E',
        }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: '#94A3B8', fontSize: 14 }}>← Back</Text>
          </Pressable>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Edit Profile</Text>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            hitSlop={12}
          >
            <Text style={{ color: isSaving ? '#64748B' : '#FF6240', fontSize: 14, fontWeight: '600' }}>
              {isSaving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48, paddingTop: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo */}
          <SectionCard>
            <View style={{ alignItems: 'center' }}>
              <Image
                source={avatarUrl ? { uri: avatarUrl } : undefined}
                style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#1E1B2E', marginBottom: 12 }}
                contentFit="cover"
              />
              <Pressable
                onPress={pickAndUploadPhoto}
                disabled={isUploading}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#FF6240',
                  opacity: isUploading ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>
                  {isUploading ? 'Uploading…' : 'Change photo'}
                </Text>
              </Pressable>
            </View>
          </SectionCard>

          {/* Basic info */}
          <SectionCard>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 14 }}>Basic Info</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel text="First name" />
                <StyledInput value={firstName} onChangeText={setFirstName} placeholder="First name" autoCapitalize="words" />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel text="Last name" />
                <StyledInput value={lastName} onChangeText={setLastName} placeholder="Last name" autoCapitalize="words" />
              </View>
            </View>
            <FieldLabel text="Professional headline" />
            <StyledInput
              value={headline}
              onChangeText={setHeadline}
              placeholder="e.g. Senior Software Engineer at Flutterwave"
              autoCapitalize="words"
            />
          </SectionCard>

          {/* Bio */}
          <SectionCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Professional Summary</Text>
              <Text style={{ color: '#64748B', fontSize: 12 }}>{bio.length}/500</Text>
            </View>
            <StyledInput
              value={bio}
              onChangeText={(t) => { if (t.length <= 500) setBio(t) }}
              placeholder="Tell employers about your background, skills, and what you're looking for…"
              multiline
            />
          </SectionCard>

          {/* Social links */}
          <SectionCard>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 14 }}>Social Links</Text>
            <FieldLabel text="GitHub URL" />
            <View style={{ marginBottom: 12 }}>
              <StyledInput
                value={githubUrl}
                onChangeText={setGithubUrl}
                placeholder="https://github.com/username"
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
            <FieldLabel text="LinkedIn URL" />
            <View style={{ marginBottom: 12 }}>
              <StyledInput
                value={linkedinUrl}
                onChangeText={setLinkedinUrl}
                placeholder="https://linkedin.com/in/username"
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
            <FieldLabel text="Portfolio URL" />
            <StyledInput
              value={portfolioUrl}
              onChangeText={setPortfolioUrl}
              placeholder="https://yourportfolio.com"
              keyboardType="url"
              autoCapitalize="none"
            />
          </SectionCard>

          {/* Preferences */}
          <SectionCard>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 14 }}>Preferences</Text>
            <Pressable
              onPress={() => setIsOpenToWork((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ color: '#fff', fontSize: 14 }}>Open to work</Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                  Lets companies know you're actively looking
                </Text>
              </View>
              <Toggle value={isOpenToWork} onToggle={() => setIsOpenToWork((v) => !v)} />
            </Pressable>
          </SectionCard>

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={{
              backgroundColor: '#FF6240',
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
