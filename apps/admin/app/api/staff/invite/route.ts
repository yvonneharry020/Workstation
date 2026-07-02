import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email: string }
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
    const redirectTo = `${origin}/auth/callback?next=/setup-account`

    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'invite',
      email: email.toLowerCase().trim(),
      options: { redirectTo },
    })

    if (error || !data?.properties?.action_link) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to generate invite link' },
        { status: 500 },
      )
    }

    return NextResponse.json({ inviteUrl: data.properties.action_link })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
