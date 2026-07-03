import { NextResponse } from 'next/server'

const VERCEL_TOKEN      = process.env.VERCEL_API_TOKEN
const VERCEL_TEAM_ID    = process.env.VERCEL_TEAM_ID
const VERCEL_PROJECT_ID = process.env.VERCEL_ADMIN_PROJECT_ID
const EAS_TOKEN         = process.env.EAS_ACCOUNT_TOKEN
const EAS_PROJECT_ID    = process.env.EAS_PROJECT_ID

export const dynamic = 'force-dynamic'

async function fetchVercel() {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return { deployments: [], error: 'Vercel credentials not configured', notConfigured: true }
  }
  try {
    const url = new URL('https://api.vercel.com/v6/deployments')
    url.searchParams.set('projectId', VERCEL_PROJECT_ID)
    url.searchParams.set('limit', '20')
    if (VERCEL_TEAM_ID) url.searchParams.set('teamId', VERCEL_TEAM_ID)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      cache: 'no-store',
    })
    if (!res.ok) return { deployments: [], error: `Vercel API returned ${res.status}`, notConfigured: false }

    const json = await res.json() as { deployments: unknown[] }
    return { deployments: json.deployments ?? [], error: null, notConfigured: false }
  } catch (e) {
    return { deployments: [], error: e instanceof Error ? e.message : 'Fetch failed', notConfigured: false }
  }
}

async function fetchVercelBuildLogs(deploymentId: string) {
  if (!VERCEL_TOKEN) return null
  try {
    const url = new URL(`https://api.vercel.com/v2/deployments/${deploymentId}/events`)
    if (VERCEL_TEAM_ID) url.searchParams.set('teamId', VERCEL_TEAM_ID)
    url.searchParams.set('direction', 'backward')
    url.searchParams.set('limit', '50')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const events = await res.json() as Array<{ type?: string; payload?: { text?: string } }>
    const errorLines = events
      .filter(e => e.type === 'stderr' || (e.payload?.text ?? '').toLowerCase().includes('error'))
      .slice(0, 10)
      .map(e => e.payload?.text ?? '')
      .filter(Boolean)
    return errorLines.length > 0 ? errorLines.join('\n') : null
  } catch {
    return null
  }
}

async function fetchEAS() {
  const notReady = !EAS_TOKEN || !EAS_PROJECT_ID || EAS_PROJECT_ID === 'YOUR_EAS_PROJECT_ID' || EAS_PROJECT_ID === ''
  if (notReady) {
    return { builds: [], error: null, notConfigured: true }
  }
  try {
    const res = await fetch(
      `https://api.expo.dev/v2/projects/${EAS_PROJECT_ID}/builds?limit=10`,
      {
        headers: { Authorization: `Bearer ${EAS_TOKEN}` },
        cache: 'no-store',
      }
    )
    if (res.status === 404) return { builds: [], error: null, notConfigured: false }
    if (!res.ok) return { builds: [], error: `EAS API returned ${res.status}`, notConfigured: false }
    const json = await res.json() as { data: unknown[] }
    return { builds: json.data ?? [], error: null, notConfigured: false }
  } catch (e) {
    return { builds: [], error: e instanceof Error ? e.message : 'Fetch failed', notConfigured: false }
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const failedId = searchParams.get('buildLogs')

  if (failedId) {
    const logs = await fetchVercelBuildLogs(failedId)
    return NextResponse.json({ logs })
  }

  const [vercel, expo] = await Promise.all([fetchVercel(), fetchEAS()])
  return NextResponse.json({ vercel, expo })
}
