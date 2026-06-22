import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ApplicantsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface px-6 pt-6">
      <Text className="text-white text-2xl font-bold mb-2">Applicants</Text>
      <Text className="text-slate-400 text-sm">Your ATS — manage and track all candidates</Text>
    </SafeAreaView>
  )
}
