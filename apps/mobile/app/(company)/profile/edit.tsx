import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Input as FormInput } from '@/components/ui/Input'
import { PickerModal } from '@/components/ui/PickerModal'

const INDUSTRIES = [
  'Technology', 'Finance & Banking', 'Healthcare', 'Education', 'E-Commerce',
  'Manufacturing', 'Real Estate', 'Media & Entertainment', 'Telecoms',
  'Oil & Gas', 'Agriculture', 'Construction', 'Logistics & Supply Chain',
  'Consulting', 'Legal', 'Food & Beverage', 'Fashion & Retail', 'Other',
]

const COMPANY_SIZES = [
  { label: '1–10 employees', value: '1_10' },
  { label: '11–50 employees', value: '11_50' },
  { label: '51–200 employees', value: '51_200' },
  { label: '201–500 employees', value: '201_500' },
  { label: '500+ employees', value: '500_plus' },
]

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT (Abuja)','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara',
]

interface CompanyProfile {
  id: string
  company_name: string | null
  business_email: string | null
  business_phone: string | null
  rc_number: string | null
  about: string | null
  culture_description: string | null
  industry: string | null
  company_size: string | null
  founded_year: number | null
  website_url: string | null
  linkedin_url: string | null
  twitter_url: string | null
  instagram_url: string | null
  logo_url: string | null
  cover_banner_url: string | null
  headquarters_state: string | null
  headquarters_city: string | null
  headquarters_address: string | null
}

interface GalleryImage {
  id: string
  image_url: string
  caption: string | null
  sort_order: number
}

function ArrowLeftIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function CameraIcon({ color = '#1A1625' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </Svg>
  )
}

function PlusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function TrashIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </Svg>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 }}>
      {children}
    </Text>
  )
}

export default function EditCompanyProfileScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    company_name: '',
    business_email: '',
    business_phone: '',
    rc_number: '',
    about: '',
    culture_description: '',
    industry: '',
    company_size: '',
    founded_year: '',
    website_url: '',
    linkedin_url: '',
    twitter_url: '',
    instagram_url: '',
    headquarters_state: '',
    headquarters_city: '',
    headquarters_address: '',
  })
  const [personalPhone, setPersonalPhone] = useState('')
  const [logoUri, setLogoUri] = useState<string | null>(null)
  const [bannerUri, setBannerUri] = useState<string | null>(null)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [gallery, setGallery] = useState<GalleryImage[]>([])

  const { isLoading, data: profileData } = useQuery({
    queryKey: ['company-profile-edit', user?.id],
    queryFn: async () => {
      const [profileRes, profilesRes] = await Promise.all([
        supabase.from('company_profiles').select('*').eq('id', user!.id).maybeSingle(),
        supabase.from('profiles').select('phone').eq('id', user!.id).maybeSingle(),
      ])
      if (profileRes.error) throw profileRes.error
      return {
        profile: profileRes.data as unknown as CompanyProfile | null,
        personalPhone: (profilesRes.data as any)?.phone ?? '',
      }
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (!profileData) return
    const p = profileData.profile
    if (p) {
      setForm({
        company_name: p.company_name ?? '',
        business_email: p.business_email ?? '',
        business_phone: p.business_phone ?? '',
        rc_number: p.rc_number ?? '',
        about: p.about ?? '',
        culture_description: p.culture_description ?? '',
        industry: p.industry ?? '',
        company_size: p.company_size ?? '',
        founded_year: p.founded_year?.toString() ?? '',
        website_url: p.website_url ?? '',
        linkedin_url: p.linkedin_url ?? '',
        twitter_url: p.twitter_url ?? '',
        instagram_url: p.instagram_url ?? '',
        headquarters_state: p.headquarters_state ?? '',
        headquarters_city: p.headquarters_city ?? '',
        headquarters_address: p.headquarters_address ?? '',
      })
      setLogoUri(p.logo_url)
      setBannerUri(p.cover_banner_url)
    }
    setPersonalPhone(profileData.personalPhone)
  }, [profileData])

  const { data: galleryData } = useQuery({
    queryKey: ['company-gallery', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_gallery')
        .select('id, image_url, caption, sort_order')
        .eq('company_id', user!.id)
        .order('sort_order')
      if (error) throw error
      return data as unknown as GalleryImage[]
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (galleryData) setGallery(galleryData)
  }, [galleryData])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated')
      const [profileErr, profilesErr] = await Promise.all([
        supabase.from('company_profiles').upsert({
          id: user.id,
          company_name: form.company_name || null,
          business_email: form.business_email || null,
          business_phone: form.business_phone || null,
          rc_number: form.rc_number || null,
          about: form.about || null,
          culture_description: form.culture_description || null,
          industry: form.industry || null,
          company_size: form.company_size || null,
          founded_year: form.founded_year ? parseInt(form.founded_year, 10) : null,
          website_url: form.website_url || null,
          linkedin_url: form.linkedin_url || null,
          twitter_url: form.twitter_url || null,
          instagram_url: form.instagram_url || null,
          headquarters_state: form.headquarters_state || null,
          headquarters_city: form.headquarters_city || null,
          headquarters_address: form.headquarters_address || null,
          logo_url: logoUri,
          cover_banner_url: bannerUri,
        }, { onConflict: 'id' }).then((r) => r.error),
        personalPhone
          ? supabase.from('profiles').update({ phone: personalPhone }).eq('id', user.id).then((r) => r.error)
          : Promise.resolve(null),
      ])
      if (profileErr) throw profileErr
      if (profilesErr) throw profilesErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile-view', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['company-profile-edit', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['company-dashboard', user?.id] })
      Alert.alert('Saved', 'Your company profile has been updated.')
      router.back()
    },
    onError: () => {
      Alert.alert('Error', 'Could not save your profile. Please try again.')
    },
  })

  const pickAndUploadImage = async (field: 'logo' | 'banner') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: field === 'logo' ? [1, 1] : [16, 9],
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setUploadingField(field)
    try {
      const rawExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const fileExt = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg'
      const contentType = fileExt === 'png' ? 'image/png' : fileExt === 'webp' ? 'image/webp' : 'image/jpeg'
      const bucket = field === 'logo' ? 'company-logos' : 'company-banners'
      const filePath = `${user?.id}/${field}_${Date.now()}.${fileExt}`
      const response = await fetch(asset.uri)
      const arrayBuffer = await response.arrayBuffer()
      const { error } = await supabase.storage.from(bucket).upload(filePath, arrayBuffer, { contentType, upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
      if (field === 'logo') setLogoUri(data.publicUrl)
      else setBannerUri(data.publicUrl)
    } catch {
      Alert.alert('Upload failed', 'Could not upload the image. Please try again.')
    } finally {
      setUploadingField(null)
    }
  }

  const addGalleryImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setUploadingField('gallery')
    try {
      const rawExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const fileExt = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg'
      const contentType = fileExt === 'png' ? 'image/png' : fileExt === 'webp' ? 'image/webp' : 'image/jpeg'
      const filePath = `${user?.id}/gallery_${Date.now()}.${fileExt}`
      const response = await fetch(asset.uri)
      const arrayBuffer = await response.arrayBuffer()
      const { error: uploadError } = await supabase.storage.from('company-gallery').upload(filePath, arrayBuffer, { contentType, upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('company-gallery').getPublicUrl(filePath)
      const { data: inserted, error: insertError } = await supabase
        .from('company_gallery')
        .insert({ company_id: user?.id, image_url: data.publicUrl, sort_order: gallery.length })
        .select()
        .single()
      if (insertError) throw insertError
      setGallery((prev) => [...prev, inserted as unknown as GalleryImage])
    } catch {
      Alert.alert('Upload failed', 'Could not add the gallery image.')
    } finally {
      setUploadingField(null)
    }
  }

  const removeGalleryImage = async (id: string) => {
    const { error } = await supabase.from('company_gallery').delete().eq('id', id)
    if (!error) setGallery((prev) => prev.filter((g) => g.id !== id))
  }

  const updateField = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-surface-border">
          <Pressable onPress={() => router.back()} className="active:opacity-70 p-1">
            <ArrowLeftIcon />
          </Pressable>
          <Text style={{ color: '#1A1625', fontSize: 17, fontWeight: '700' }}>Edit Profile</Text>
          <Pressable
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            style={{ backgroundColor: '#FF6240', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
            className="active:opacity-80"
          >
            {saveMutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 14 }}>Save</Text>
            }
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>

          <Animated.View entering={FadeInDown.delay(50).duration(300)}>
            <SectionLabel>Brand assets</SectionLabel>

            <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 8 }}>Cover banner</Text>
            <Pressable
              onPress={() => pickAndUploadImage('banner')}
              disabled={uploadingField === 'banner'}
              style={{ width: '100%', aspectRatio: 3.5, backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1.5, borderColor: bannerUri ? '#FF624040' : '#DDD6C9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}
              className="active:opacity-70"
            >
              {bannerUri
                ? <Image source={{ uri: bannerUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                : uploadingField === 'banner'
                  ? <ActivityIndicator color="#FF6240" />
                  : <CameraIcon color="#475569" />
              }
            </Pressable>

            <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 8 }}>Company logo</Text>
            <Pressable
              onPress={() => pickAndUploadImage('logo')}
              disabled={uploadingField === 'logo'}
              style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EDE7DB', borderWidth: 1.5, borderColor: logoUri ? '#FF624040' : '#DDD6C9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}
              className="active:opacity-70"
            >
              {logoUri
                ? <>
                    <Image source={{ uri: logoUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#09080ECC', borderRadius: 10, padding: 4 }}>
                      <CameraIcon />
                    </View>
                  </>
                : uploadingField === 'logo'
                  ? <ActivityIndicator color="#FF6240" size="small" />
                  : <CameraIcon color="#475569" />
              }
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(300)} className="gap-4">
            <SectionLabel>Account details</SectionLabel>

            <View>
              <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '500', marginBottom: 6 }}>Personal email</Text>
              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', paddingHorizontal: 14, paddingVertical: 14 }}>
                <Text style={{ color: '#64748B', fontSize: 14 }}>{user?.email ?? '—'}</Text>
              </View>
              <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 4 }}>Contact support to change your login email.</Text>
            </View>

            <FormInput
              label="Personal phone"
              placeholder="+234 801 234 5678"
              value={personalPhone}
              onChangeText={setPersonalPhone}
              keyboardType="phone-pad"
            />

            <FormInput
              label="RC Number"
              placeholder="RC1234567"
              value={form.rc_number}
              onChangeText={updateField('rc_number')}
              autoCapitalize="characters"
            />

            <SectionLabel>Company information</SectionLabel>

            <FormInput
              label="Company display name"
              placeholder="Acme Technology Ltd"
              value={form.company_name}
              onChangeText={updateField('company_name')}
            />

            <FormInput
              label="Business email"
              placeholder="hr@yourcompany.com"
              value={form.business_email}
              onChangeText={updateField('business_email')}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View>
              <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '500', marginBottom: 6 }}>About</Text>
              <TextInput
                multiline
                numberOfLines={5}
                placeholder="Tell candidates what your company does…"
                placeholderTextColor="#475569"
                value={form.about}
                onChangeText={updateField('about')}
                style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, minHeight: 110, textAlignVertical: 'top' }}
              />
            </View>

            <View>
              <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '500', marginBottom: 6 }}>
                Culture & values <Text style={{ color: '#475569', fontWeight: '400' }}>(optional)</Text>
              </Text>
              <TextInput
                multiline
                numberOfLines={3}
                placeholder="Describe your work culture and values…"
                placeholderTextColor="#475569"
                value={form.culture_description}
                onChangeText={updateField('culture_description')}
                style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>

            <PickerModal
              label="Industry"
              value={form.industry}
              options={INDUSTRIES.map((i) => ({ label: i, value: i }))}
              onSelect={updateField('industry')}
              placeholder="Select industry"
              searchable
            />

            <PickerModal
              label="Company size"
              value={form.company_size}
              options={COMPANY_SIZES}
              onSelect={updateField('company_size')}
              placeholder="Select team size"
            />

            <FormInput
              label="Founded year (optional)"
              placeholder="2019"
              value={form.founded_year}
              onChangeText={updateField('founded_year')}
              keyboardType="number-pad"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(300)} className="gap-4 mt-4">
            <SectionLabel>Online presence</SectionLabel>

            <FormInput label="Website URL" placeholder="https://yourcompany.com" value={form.website_url} onChangeText={updateField('website_url')} keyboardType="url" autoCapitalize="none" />
            <FormInput label="LinkedIn URL" placeholder="https://linkedin.com/company/..." value={form.linkedin_url} onChangeText={updateField('linkedin_url')} keyboardType="url" autoCapitalize="none" />
            <FormInput label="Twitter URL (optional)" placeholder="https://twitter.com/..." value={form.twitter_url} onChangeText={updateField('twitter_url')} keyboardType="url" autoCapitalize="none" />
            <FormInput label="Instagram URL (optional)" placeholder="https://instagram.com/..." value={form.instagram_url} onChangeText={updateField('instagram_url')} keyboardType="url" autoCapitalize="none" />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(300)} className="gap-4 mt-4">
            <SectionLabel>Location & contact</SectionLabel>

            <PickerModal
              label="State"
              value={form.headquarters_state}
              options={NIGERIAN_STATES.map((s) => ({ label: s, value: s }))}
              onSelect={updateField('headquarters_state')}
              placeholder="Select state"
              searchable
            />
            <FormInput label="City" placeholder="Lagos Island" value={form.headquarters_city} onChangeText={updateField('headquarters_city')} />
            <FormInput label="Business address" placeholder="12 Victoria Island, Lagos" value={form.headquarters_address} onChangeText={updateField('headquarters_address')} />
            <FormInput label="Business phone" placeholder="+234 801 234 5678" value={form.business_phone} onChangeText={updateField('business_phone')} keyboardType="phone-pad" />

          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).duration(300)} className="mt-4">
            <SectionLabel>Company gallery</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
              {gallery.map((img) => (
                <View key={img.id} style={{ width: 100, height: 100, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                  <Image source={{ uri: img.image_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  <Pressable
                    onPress={() => removeGalleryImage(img.id)}
                    style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#09080ECC', borderRadius: 8, padding: 5 }}
                    className="active:opacity-70"
                  >
                    <TrashIcon />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={addGalleryImage}
                disabled={uploadingField === 'gallery'}
                style={{ width: 100, height: 100, borderRadius: 12, backgroundColor: '#EDE7DB', borderWidth: 1.5, borderColor: '#DDD6C9', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}
                className="active:opacity-70"
              >
                {uploadingField === 'gallery'
                  ? <ActivityIndicator color="#94A3B8" size="small" />
                  : <PlusIcon />
                }
              </Pressable>
            </ScrollView>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
