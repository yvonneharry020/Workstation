import { useState } from 'react'
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
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Input as FormInput } from '@/components/ui/Input'
import { PickerModal } from '@/components/ui/PickerModal'

const STEPS_TOTAL = 7

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
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

const schema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  about: z.string().min(50, 'Write at least 50 characters about your company').max(1000),
  cultureDescription: z.string().max(500).optional(),
  industry: z.string().min(1, 'Select an industry'),
  companySize: z.string().min(1, 'Select company size'),
  websiteUrl: z.string().url('Enter a valid URL (include https://)').optional().or(z.literal('')),
  linkedinUrl: z.string().url('Enter a valid LinkedIn URL').optional().or(z.literal('')),
  headquartersState: z.string().min(1, 'Select your state'),
  headquartersCity: z.string().min(2, 'Enter your city'),
  headquartersAddress: z.string().min(5, 'Enter your business address'),
})

type FormData = z.infer<typeof schema>

function CameraIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </Svg>
  )
}

function ImageUploadButton({
  label,
  imageUri,
  onPress,
  isUploading,
  aspectRatio,
}: {
  label: string
  imageUri: string | null
  onPress: () => void
  isUploading: boolean
  aspectRatio: number
}) {
  return (
    <View className="mb-5">
      <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '500', marginBottom: 8 }}>{label}</Text>
      <Pressable
        onPress={onPress}
        disabled={isUploading}
        style={{
          width: '100%',
          aspectRatio,
          backgroundColor: '#131118',
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: imageUri ? '#FF624040' : '#1E1B2E',
          borderStyle: imageUri ? 'solid' : 'dashed',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="active:opacity-70"
      >
        {imageUri ? (
          <>
            <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: '#09080ECC', borderRadius: 8, padding: 6 }}>
              <CameraIcon />
            </View>
          </>
        ) : (
          <View className="items-center gap-2">
            {isUploading ? <ActivityIndicator color="#FF6240" /> : <CameraIcon />}
            <Text style={{ color: '#64748B', fontSize: 12 }}>{isUploading ? 'Uploading…' : 'Tap to upload'}</Text>
          </View>
        )}
      </Pressable>
    </View>
  )
}

export default function CompanyStep5() {
  const user = useAuthStore((s) => s.user)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logoUri, setLogoUri] = useState<string | null>(null)
  const [bannerUri, setBannerUri] = useState<string | null>(null)
  const [uploadingField, setUploadingField] = useState<'logo' | 'banner' | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: '',
      about: '',
      cultureDescription: '',
      industry: '',
      companySize: '',
      websiteUrl: '',
      linkedinUrl: '',
      headquartersState: '',
      headquartersCity: '',
      headquartersAddress: '',
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
      const fileExt = asset.uri.split('.').pop() ?? 'jpg'
      const bucket = field === 'logo' ? 'company-logos' : 'company-banners'
      const filePath = `${user?.id ?? 'unknown'}/${field}_${Date.now()}.${fileExt}`

      const response = await fetch(asset.uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)

      if (field === 'logo') setLogoUri(data.publicUrl)
      else setBannerUri(data.publicUrl)
    } catch {
      Alert.alert('Upload failed', 'Could not upload the image. Please try again.')
    } finally {
      setUploadingField(null)
    }
  }

  const onSubmit = async (data: FormData) => {
    if (!user?.id) return
    setIsSubmitting(true)

    try {
      const { error } = await supabase.from('company_profiles').upsert({
        id: user.id,
        company_name: data.companyName,
        about: data.about,
        culture_description: data.cultureDescription ?? null,
        industry: data.industry,
        company_size: data.companySize,
        website_url: data.websiteUrl || null,
        linkedin_url: data.linkedinUrl || null,
        headquarters_city: data.headquartersCity,
        headquarters_address: data.headquartersAddress,
        logo_url: logoUri,
        cover_banner_url: bannerUri,
        is_profile_complete: true,
      }, { onConflict: 'id' })

      if (error) throw error

      router.push('/(onboarding)/company/step-6')
    } catch {
      Alert.alert('Error', 'Could not save your profile. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} className="mt-6 mb-8">
            <Text className="text-primary-400 text-base">← Back</Text>
          </Pressable>

          <View className="flex-row items-center mb-2">
            {Array.from({ length: STEPS_TOTAL }).map((_, i) => (
              <View
                key={i}
                className={`h-1 flex-1 rounded-full mr-1 ${i < 5 ? 'bg-primary-500' : 'bg-surface-card'}`}
              />
            ))}
          </View>
          <Text className="text-slate-500 text-xs mb-8">Step 5 of {STEPS_TOTAL}</Text>

          <Text className="text-white text-3xl font-bold mb-2">Company profile</Text>
          <Text className="text-slate-400 text-base mb-8">
            This is what candidates see when they browse your jobs. Make a strong first impression.
          </Text>

          <Animated.View entering={FadeInDown.duration(300)}>
            <Text className="text-slate-300 font-semibold text-sm mb-4">Brand assets</Text>

            <ImageUploadButton
              label="Company logo"
              imageUri={logoUri}
              onPress={() => pickAndUploadImage('logo')}
              isUploading={uploadingField === 'logo'}
              aspectRatio={1}
            />

            <ImageUploadButton
              label="Cover banner"
              imageUri={bannerUri}
              onPress={() => pickAndUploadImage('banner')}
              isUploading={uploadingField === 'banner'}
              aspectRatio={3.5}
            />
          </Animated.View>

          <View className="gap-4 mb-2">
            <Controller
              control={control}
              name="companyName"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="Company display name"
                  placeholder="Acme Technology Ltd"
                  value={value}
                  onChangeText={onChange}
                  error={errors.companyName?.message}
                />
              )}
            />

            <View>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '500', marginBottom: 6 }}>
                About your company
              </Text>
              <Controller
                control={control}
                name="about"
                render={({ field: { onChange, value } }) => (
                  <View>
                    <TextInput
                      multiline
                      numberOfLines={5}
                      placeholder="Tell candidates what your company does, your mission, and why people love working here…"
                      placeholderTextColor="#475569"
                      value={value}
                      onChangeText={onChange}
                      style={{
                        backgroundColor: '#131118',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: errors.about ? '#EF4444' : '#1E1B2E',
                        color: '#fff',
                        fontSize: 14,
                        padding: 14,
                        minHeight: 120,
                        textAlignVertical: 'top',
                      }}
                    />
                    {errors.about && (
                      <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>{errors.about.message}</Text>
                    )}
                  </View>
                )}
              />
            </View>

            <View>
              <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '500', marginBottom: 6 }}>
                Culture & values <Text style={{ color: '#475569', fontWeight: '400' }}>(optional)</Text>
              </Text>
              <Controller
                control={control}
                name="cultureDescription"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    multiline
                    numberOfLines={3}
                    placeholder="Describe your work culture, values, and what makes your team unique…"
                    placeholderTextColor="#475569"
                    value={value}
                    onChangeText={onChange}
                    style={{
                      backgroundColor: '#131118',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#1E1B2E',
                      color: '#fff',
                      fontSize: 14,
                      padding: 14,
                      minHeight: 80,
                      textAlignVertical: 'top',
                    }}
                  />
                )}
              />
            </View>

            <Controller
              control={control}
              name="industry"
              render={({ field: { onChange, value } }) => (
                <PickerModal
                  label="Industry"
                  value={value}
                  options={INDUSTRIES.map((i) => ({ label: i, value: i }))}
                  onSelect={onChange}
                  placeholder="Select industry"
                  error={errors.industry?.message}
                  searchable
                />
              )}
            />

            <Controller
              control={control}
              name="companySize"
              render={({ field: { onChange, value } }) => (
                <PickerModal
                  label="Company size"
                  value={value}
                  options={COMPANY_SIZES}
                  onSelect={onChange}
                  placeholder="Select team size"
                  error={errors.companySize?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="websiteUrl"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="Website URL (optional)"
                  placeholder="https://yourcompany.com"
                  value={value ?? ''}
                  onChangeText={onChange}
                  error={errors.websiteUrl?.message}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              )}
            />

            <Controller
              control={control}
              name="linkedinUrl"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="LinkedIn URL (optional)"
                  placeholder="https://linkedin.com/company/yourcompany"
                  value={value ?? ''}
                  onChangeText={onChange}
                  error={errors.linkedinUrl?.message}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              )}
            />
          </View>

          <View className="mb-2 mt-4">
            <Text className="text-slate-300 font-semibold text-sm mb-4">Headquarters location</Text>
            <View className="gap-4">
              <Controller
                control={control}
                name="headquartersState"
                render={({ field: { onChange, value } }) => (
                  <PickerModal
                    label="State"
                    value={value}
                    options={NIGERIAN_STATES.map((s) => ({ label: s, value: s }))}
                    onSelect={onChange}
                    placeholder="Select state"
                    error={errors.headquartersState?.message}
                    searchable
                  />
                )}
              />

              <Controller
                control={control}
                name="headquartersCity"
                render={({ field: { onChange, value } }) => (
                  <FormInput
                    label="City"
                    placeholder="Lagos Island"
                    value={value}
                    onChangeText={onChange}
                    error={errors.headquartersCity?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="headquartersAddress"
                render={({ field: { onChange, value } }) => (
                  <FormInput
                    label="Business address"
                    placeholder="12 Victoria Island, Lagos"
                    value={value}
                    onChangeText={onChange}
                    error={errors.headquartersAddress?.message}
                  />
                )}
              />
            </View>
          </View>

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className={`rounded-2xl py-4 items-center mt-8 mb-12 ${isSubmitting ? 'bg-primary-700' : 'bg-primary-500 active:opacity-80'}`}
          >
            {isSubmitting ? (
              <View className="flex-row items-center gap-3">
                <ActivityIndicator color="#fff" size="small" />
                <Text className="text-white font-bold text-base">Saving profile…</Text>
              </View>
            ) : (
              <Text className="text-white font-bold text-base">Continue</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
