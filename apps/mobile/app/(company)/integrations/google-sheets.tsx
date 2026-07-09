import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

WebBrowser.maybeCompleteAuthSession()

// REMINDER FOR YVONNE: Create a Google Cloud project at https://console.cloud.google.com
// Enable the Google Sheets API and Google Drive API
// Create OAuth 2.0 credentials (Web application type)
// Add your Expo redirect URI: https://auth.expo.io/@your-expo-username/workstation
// Then replace the placeholder below with your real Client ID
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'profile',
  'email',
]

interface GoogleToken {
  accessToken: string
  email: string
  connectedAt: string
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function SheetsIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6M8 13h8M8 17h8M10 9H8" />
    </Svg>
  )
}

function CheckIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  )
}

function ExportIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M7 10l5 5 5-5M12 15V3" />
    </Svg>
  )
}

async function createSpreadsheet(accessToken: string, title: string): Promise<string> {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties: { title } }),
  })
  if (!res.ok) throw new Error('Failed to create spreadsheet')
  const json = await res.json()
  return json.spreadsheetId as string
}

async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  rows: (string | number | null)[][]
): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    }
  )
  if (!res.ok) throw new Error('Failed to write to spreadsheet')
}

export default function GoogleSheetsScreen() {
  const user = useAuthStore((s) => s.user)
  const [token, setToken] = useState<GoogleToken | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [successModal, setSuccessModal] = useState<{ visible: boolean; sheetUrl: string }>({ visible: false, sheetUrl: '' })

  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true })

  const { data: candidateData, isLoading: loadingCandidates } = useQuery({
    queryKey: ['export-candidates', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id, pipeline_stage, submitted_at, skills_match_pct,
          job_postings ( title ),
          candidate_profiles ( first_name, last_name, headline, gender, date_of_birth )
        `)
        .eq('job_postings.company_id', user!.id)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data as unknown as {
        id: string
        pipeline_stage: string
        submitted_at: string
        skills_match_pct: number | null
        job_postings: { title: string } | null
        candidate_profiles: { first_name: string; last_name: string; headline: string | null; gender: string | null; date_of_birth: string | null } | null
      }[]
    },
    enabled: !!user?.id,
  })

  const handleConnect = async () => {
    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      Alert.alert(
        'Setup Required',
        'Please create a Google Cloud project and add your Client ID first. Check the code comment in this file for instructions.'
      )
      return
    }

    setIsConnecting(true)
    try {
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(GOOGLE_SCOPES.join(' '))}` +
        `&prompt=select_account`

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri)

      if (result.type === 'success' && result.url) {
        const params = new URLSearchParams(result.url.split('#')[1] ?? '')
        const accessToken = params.get('access_token')
        if (!accessToken) throw new Error('No access token returned')

        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const profile = await profileRes.json()

        setToken({
          accessToken,
          email: profile.email ?? 'Google Account',
          connectedAt: new Date().toISOString(),
        })
      }
    } catch {
      Alert.alert('Connection failed', 'Could not connect to Google. Please try again.')
    } finally {
      setIsConnecting(false)
    }
  }

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Not connected')
      if (!candidateData || candidateData.length === 0) throw new Error('No candidate data to export')

      const title = `Workstation Candidates — ${new Date().toLocaleDateString('en-NG')}`
      const spreadsheetId = await createSpreadsheet(token.accessToken, title)

      const headers = [
        'Full Name', 'Job Title', 'Pipeline Stage', 'Skills Match %',
        'Gender', 'Age', 'Headline', 'Applied At',
      ]

      const rows = candidateData.map((row) => {
        const cp = row.candidate_profiles
        const fullName = cp ? `${cp.first_name} ${cp.last_name}`.trim() : 'Unknown'
        const age = cp?.date_of_birth
          ? Math.floor((Date.now() - new Date(cp.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : ''
        return [
          fullName,
          row.job_postings?.title ?? '',
          row.pipeline_stage,
          row.skills_match_pct ?? '',
          cp?.gender ?? '',
          age,
          cp?.headline ?? '',
          new Date(row.submitted_at).toLocaleDateString('en-NG'),
        ] as (string | number | null)[]
      })

      await appendRows(token.accessToken, spreadsheetId, [headers, ...rows])
      return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    },
    onSuccess: (url) => {
      setSuccessModal({ visible: true, sheetUrl: url })
    },
    onError: (err) => {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Could not export data. Please try again.')
    },
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginRight: 12 })}>
          <ArrowLeftIcon />
        </Pressable>
        <Text style={{ color: '#1A1625', fontSize: 24, fontWeight: '800' }}>Google Spreadsheet</Text>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60, paddingTop: 24 }}>

        <Animated.View entering={FadeInDown.duration(300)}>
          <View style={{ backgroundColor: '#EDE7DB', borderRadius: 20, borderWidth: 1, borderColor: '#DDD6C9', padding: 24, alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#22C55E15', borderWidth: 1, borderColor: '#22C55E30', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <SheetsIcon size={32} />
            </View>
            <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>
              Export candidates to Google Sheets
            </Text>
            <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Connect your Google account to export all candidate data as a raw copy to a new spreadsheet.
            </Text>
          </View>
        </Animated.View>

        {!token ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 20, marginBottom: 20 }}>
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
                What gets exported
              </Text>
              {[
                'Candidate full name & job applied for',
                'Pipeline stage (New, Reviewed, Shortlisted…)',
                'Skills match percentage',
                'Gender, age, headline',
                'Date applied',
              ].map((item) => (
                <View key={item} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#22C55E15', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 }}>
                    <CheckIcon />
                  </View>
                  <Text style={{ color: '#1A1625', fontSize: 13, flex: 1, lineHeight: 20 }}>{item}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={handleConnect}
              disabled={isConnecting}
              style={({ pressed }) => ({
                backgroundColor: '#22C55E',
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 10,
                opacity: pressed || isConnecting ? 0.8 : 1,
              })}
            >
              {isConnecting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <SheetsIcon size={18} />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Connect Google Account</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <View style={{ backgroundColor: '#22C55E10', borderRadius: 16, borderWidth: 1, borderColor: '#22C55E30', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#22C55E20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckIcon />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#16A34A', fontSize: 13, fontWeight: '700' }}>Connected</Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{token.email}</Text>
              </View>
              <Pressable
                onPress={() => setToken(null)}
                style={{ backgroundColor: '#EDE7DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600' }}>Disconnect</Text>
              </Pressable>
            </View>

            <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 20 }}>
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Ready to export</Text>
              <Text style={{ color: '#64748B', fontSize: 13, lineHeight: 20 }}>
                {loadingCandidates
                  ? 'Loading candidate count…'
                  : `${candidateData?.length ?? 0} candidate record${(candidateData?.length ?? 0) !== 1 ? 's' : ''} will be exported to a new Google Sheet.`}
              </Text>
            </View>

            <Pressable
              onPress={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || loadingCandidates || (candidateData?.length ?? 0) === 0}
              style={({ pressed }) => ({
                backgroundColor: exportMutation.isPending ? '#DDD6C9' : '#22C55E',
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 10,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              {exportMutation.isPending ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Exporting…</Text>
                </>
              ) : (
                <>
                  <ExportIcon />
                  <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Export to Google Sheets</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={10} />
                <Path d="M12 8v4M12 16h.01" />
              </Svg>
              <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>Reminder</Text>
            </View>
            <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18 }}>
              You need to create a Google Cloud project and add the OAuth Client ID to this app before connecting. Check with your developer to complete the setup.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal visible={successModal.visible} transparent animationType="fade" onRequestClose={() => setSuccessModal(s => ({ ...s, visible: false }))}>
        <Pressable
          style={{ flex: 1, backgroundColor: '#00000060', justifyContent: 'center', padding: 24 }}
          onPress={() => setSuccessModal(s => ({ ...s, visible: false }))}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: '#F5F0E8', borderRadius: 20, padding: 24, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#22C55E15', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <SheetsIcon size={28} />
            </View>
            <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
              Export successful!
            </Text>
            <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
              Your candidate data has been exported to a new Google Sheet. Open it in your browser to view.
            </Text>
            <Pressable
              onPress={() => setSuccessModal(s => ({ ...s, visible: false }))}
              style={{ backgroundColor: '#22C55E', borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}
