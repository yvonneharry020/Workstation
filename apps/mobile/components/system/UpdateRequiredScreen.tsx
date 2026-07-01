import { View, Text, Pressable, Platform, Linking } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

const APP_STORE_URL = 'https://apps.apple.com/app/workstation/id0000000000'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.hivedigital.workstation'

function UpdateIcon() {
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="32" fill="#0D0B13" />
      <Circle cx="32" cy="32" r="20" fill="none" stroke="#FF6240" strokeWidth="2" strokeOpacity="0.3" />
      <Path
        d="M32,20 L32,36"
        stroke="#FF6240"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <Path
        d="M24,30 L32,40 L40,30"
        fill="none"
        stroke="#FF6240"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M24,44 L40,44"
        stroke="#FF6240"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </Svg>
  )
}

export function UpdateRequiredScreen() {
  const handleUpdate = async () => {
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      await Linking.openURL(url)
    }
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="flex-1 bg-surface items-center justify-center px-8 gap-6"
    >
      <UpdateIcon />

      <View className="items-center gap-2">
        <Text className="text-[#1A1625] font-display text-2xl text-center">
          Update required
        </Text>
        <Text className="text-slate-400 font-sans text-base text-center leading-relaxed">
          This version of Workstation is no longer supported. Download the latest update to continue.
        </Text>
      </View>

      <View className="w-full gap-3">
        <Pressable
          onPress={handleUpdate}
          className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-[#1A1625] font-semibold text-base">Update app</Text>
        </Pressable>

        <View className="bg-surface-card rounded-2xl p-4 border border-surface-border">
          <Text className="text-slate-400 font-sans text-xs text-center">
            For your security, this app requires the latest version to function.
          </Text>
        </View>
      </View>

      <View className="absolute bottom-12 flex-row items-center gap-2">
        <View className="w-2 h-2 rounded-full bg-primary-500" />
        <Text className="text-slate-400 font-sans text-xs">Update available</Text>
      </View>
    </Animated.View>
  )
}
