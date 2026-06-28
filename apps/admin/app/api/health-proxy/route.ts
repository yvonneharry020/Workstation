import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Only http/https allowed' }, { status: 400 })
  }

  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Workstation-HealthCheck/1.0' },
    })
    const responseTime = Date.now() - start
    return NextResponse.json({ ok: res.ok, status: res.status, responseTime })
  } catch (err: unknown) {
    const responseTime = Date.now() - start
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, status: 0, responseTime, error: message })
  }
}
