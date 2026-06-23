import { MMKV } from 'react-native-mmkv'

const storage = new MMKV({ id: 'workstation-storage' })

export const HAS_SEEN_TUTORIAL = 'has_seen_tutorial'

export const Storage = {
  hasSeenTutorial: (): boolean => storage.getBoolean(HAS_SEEN_TUTORIAL) ?? false,
  markTutorialSeen: (): void => storage.set(HAS_SEEN_TUTORIAL, true),
  clearAll: (): void => storage.clearAll(),
}
