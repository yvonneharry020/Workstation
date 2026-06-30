import { Stack } from 'expo-router'

export default function TutorialLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        gestureEnabled: false,
        contentStyle: { backgroundColor: '#09080E' },
      }}
    />
  )
}
