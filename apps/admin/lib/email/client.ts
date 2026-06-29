export async function sendEmailClient(type: string, to: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, to, data }),
  })
  const json = await res.json() as { success?: boolean; error?: string }
  if (!res.ok) return { success: false, error: json.error ?? 'Failed to send email' }
  return { success: true }
}
