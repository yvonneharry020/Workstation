import { View, Text, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function CompanyDashboard() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        <Text className="text-slate-400 text-sm mb-1">Company Dashboard</Text>
        <Text className="text-white text-2xl font-bold mb-6">Overview</Text>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surface-card border border-surface-border rounded-2xl p-4">
            <Text className="text-slate-400 text-xs mb-1">Active Jobs</Text>
            <Text className="text-white font-bold text-2xl">0</Text>
          </View>
          <View className="flex-1 bg-surface-card border border-surface-border rounded-2xl p-4">
            <Text className="text-slate-400 text-xs mb-1">Total Applicants</Text>
            <Text className="text-white font-bold text-2xl">0</Text>
          </View>
        </View>

        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-surface-card border border-surface-border rounded-2xl p-4">
            <Text className="text-slate-400 text-xs mb-1">Interviews Today</Text>
            <Text className="text-white font-bold text-2xl">0</Text>
          </View>
          <View className="flex-1 bg-surface-card border border-surface-border rounded-2xl p-4">
            <Text className="text-slate-400 text-xs mb-1">Profile Views</Text>
            <Text className="text-white font-bold text-2xl">0</Text>
          </View>
        </View>

        <Text className="text-white font-semibold text-lg mb-3">Recent activity</Text>
        <View className="bg-surface-card border border-surface-border rounded-2xl p-6 items-center">
          <Text className="text-slate-400 text-sm text-center">
            No activity yet. Post your first job to get started.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
