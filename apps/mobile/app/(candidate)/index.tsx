import { View, Text, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function CandidateDashboard() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        <Text className="text-slate-400 text-sm mb-1">Good morning 👋</Text>
        <Text className="text-white text-2xl font-bold mb-6">Dashboard</Text>

        <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-4">
          <Text className="text-slate-400 text-sm mb-1">Profile completion</Text>
          <Text className="text-white font-bold text-xl">0%</Text>
          <View className="h-2 bg-surface-border rounded-full mt-2">
            <View className="h-2 bg-primary-500 rounded-full w-0" />
          </View>
        </View>

        <Text className="text-white font-semibold text-lg mb-3">Recommended jobs</Text>
        <View className="bg-surface-card border border-surface-border rounded-2xl p-6 items-center">
          <Text className="text-slate-400 text-sm text-center">
            Complete your profile to see personalised job recommendations
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
