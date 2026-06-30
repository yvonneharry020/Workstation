import AsyncStorage from '@react-native-async-storage/async-storage'

export const HAS_SEEN_TUTORIAL = 'has_seen_tutorial'

export const Storage = {
  hasSeenTutorial: async (): Promise<boolean> => {
    const val = await AsyncStorage.getItem(HAS_SEEN_TUTORIAL)
    return val === 'true'
  },
  markTutorialSeen: async (): Promise<void> => {
    await AsyncStorage.setItem(HAS_SEEN_TUTORIAL, 'true')
  },
  clearAll: async (): Promise<void> => {
    await AsyncStorage.clear()
  },
}
