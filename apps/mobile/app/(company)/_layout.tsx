import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function CompanyLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D0C14',
          borderTopColor: '#1E1B2E',
          borderTopWidth: 1,
          height: 90,
          paddingBottom: 28,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#FF6240',
        tabBarInactiveTintColor: '#475569',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="applicants"
        options={{
          title: 'Applicants',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="support-chat" options={{ href: null }} />
      <Tabs.Screen name="support-ticket" options={{ href: null }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="billing" options={{ href: null }} />
      <Tabs.Screen name="team" options={{ href: null }} />

      <Tabs.Screen name="jobs/post" options={{ href: null }} />
      <Tabs.Screen name="jobs/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="jobs/[id]/edit" options={{ href: null }} />
      <Tabs.Screen name="jobs/[id]/ats" options={{ href: null }} />
      <Tabs.Screen name="jobs/[id]/kanban" options={{ href: null }} />

      <Tabs.Screen name="candidates/[id]" options={{ href: null }} />
      <Tabs.Screen name="candidates/shortlisted" options={{ href: null }} />
      <Tabs.Screen name="candidates/browse" options={{ href: null }} />
      <Tabs.Screen name="candidates/saved" options={{ href: null }} />

      <Tabs.Screen name="email/compose" options={{ href: null }} />
      <Tabs.Screen name="email/templates" options={{ href: null }} />
      <Tabs.Screen name="email/history" options={{ href: null }} />

      <Tabs.Screen name="interviews/schedule" options={{ href: null }} />
      <Tabs.Screen name="interviews/calendar" options={{ href: null }} />
      <Tabs.Screen name="interviews/notes/[id]" options={{ href: null }} />

      <Tabs.Screen name="badges/issue" options={{ href: null }} />
      <Tabs.Screen name="badges/history" options={{ href: null }} />

      <Tabs.Screen name="profile/index" options={{ href: null }} />
      <Tabs.Screen name="profile/edit" options={{ href: null }} />
    </Tabs>
  )
}
