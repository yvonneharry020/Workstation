'use client'

import { useState, useEffect } from 'react'

interface SavedRequest {
  id: string
  name: string
  method: string
  endpoint: string
  body: string
  headers: string
}

const METHODS = ['GET', 'POST', 'PATCH', 'DELETE']
const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-900/30 text-blue-400 border-blue-800/30',
  POST: 'bg-green-900/30 text-green-400 border-green-800/30',
  PATCH: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/30',
  DELETE: 'bg-red-900/30 text-red-400 border-red-800/30',
}

const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export default function ApiConsolePage() {
  const [method, setMethod] = useState('GET')
  const [endpoint, setEndpoint] = useState('/rest/v1/candidates?select=id,email&limit=5')
  const [body, setBody] = useState('')
  const [headers, setHeaders] = useState(`{\n  "apikey": "${ANON_KEY.slice(0, 20)}…"\n}`)
  const [response, setResponse] = useState<string | null>(null)
  const [status, setStatus] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState<SavedRequest[]>([])
  const [saveName, setSaveName] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('ws-api-console-saved')
    if (stored) setSaved(JSON.parse(stored) as SavedRequest[])
  }, [])

  async function sendRequest() {
    setLoading(true)
    setResponse(null)
    setStatus(null)
    try {
      let parsedHeaders: Record<string, string> = {}
      try { parsedHeaders = JSON.parse(headers) as Record<string, string> } catch {}
      const finalHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        ...parsedHeaders,
      }
      const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`
      const opts: RequestInit = { method, headers: finalHeaders }
      if (body.trim() && method !== 'GET') opts.body = body
      const res = await fetch(url, opts)
      setStatus(res.status)
      const text = await res.text()
      try { setResponse(JSON.stringify(JSON.parse(text), null, 2)) }
      catch { setResponse(text) }
    } catch (e) {
      setResponse(e instanceof Error ? e.message : String(e))
      setStatus(0)
    }
    setLoading(false)
  }

  function saveRequest() {
    if (!saveName.trim()) return
    const req: SavedRequest = { id: Date.now().toString(), name: saveName, method, endpoint, body, headers }
    const next = [req, ...saved].slice(0, 20)
    setSaved(next)
    localStorage.setItem('ws-api-console-saved', JSON.stringify(next))
    setSaveName('')
  }

  function loadRequest(req: SavedRequest) {
    setMethod(req.method)
    setEndpoint(req.endpoint)
    setBody(req.body)
    setHeaders(req.headers)
  }

  function removeRequest(id: string) {
    const next = saved.filter(s => s.id !== id)
    setSaved(next)
    localStorage.setItem('ws-api-console-saved', JSON.stringify(next))
  }

  const statusColor = status === null ? '' : status >= 200 && status < 300 ? 'text-green-400' : status >= 400 ? 'text-red-400' : 'text-yellow-400'

  return (
    <div className="flex h-screen">
      <div className="w-56 flex-shrink-0 border-r border-surface-border flex flex-col">
        <div className="px-4 py-4 border-b border-surface-border">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Saved Requests</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {saved.length === 0 ? (
            <p className="text-[10px] text-text-muted px-2 py-3">No saved requests yet.</p>
          ) : (
            saved.map(req => (
              <div key={req.id} className="group flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-surface-elevated cursor-pointer" onClick={() => loadRequest(req)}>
                <div className="min-w-0">
                  <p className="text-xs text-text-primary truncate">{req.name}</p>
                  <span className={`text-[10px] font-bold ${METHOD_COLORS[req.method]?.split(' ')[1] ?? 'text-text-muted'}`}>{req.method}</span>
                </div>
                <button onClick={e => { e.stopPropagation(); removeRequest(req.id) }} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 text-xs transition-opacity">✕</button>
              </div>
            ))
          )}
        </div>
        <div className="px-3 py-3 border-t border-surface-border space-y-2">
          <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Request name…" className="w-full bg-surface-elevated border border-surface-border rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-tech-500" />
          <button onClick={saveRequest} disabled={!saveName.trim()} className="w-full py-1.5 text-xs font-semibold bg-tech-500/20 text-tech-400 border border-tech-800/30 rounded-lg hover:bg-tech-500/30 transition-colors disabled:opacity-40">Save Current</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-5 border-b border-surface-border flex items-center gap-3">
          <div className="flex gap-1">
            {METHODS.map(m => (
              <button key={m} onClick={() => setMethod(m)} className={`px-2.5 py-1.5 rounded text-xs font-black border transition-colors ${method === m ? (METHOD_COLORS[m] ?? '') : 'bg-surface-elevated text-text-muted border-surface-border'}`}>{m}</button>
            ))}
          </div>
          <div className="flex-1 flex items-center gap-2 bg-surface-elevated border border-surface-border rounded-lg px-3 py-2">
            <span className="text-[10px] text-text-muted font-mono truncate flex-shrink-0">{BASE_URL}</span>
            <input value={endpoint} onChange={e => setEndpoint(e.target.value)} className="flex-1 bg-transparent text-sm text-text-primary font-mono focus:outline-none min-w-0" placeholder="/rest/v1/table?select=*" />
          </div>
          <button onClick={sendRequest} disabled={loading} className="px-5 py-2 bg-tech-500 hover:bg-tech-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40">
            {loading ? '…' : 'Send'}
          </button>
        </div>

        <div className="flex-1 flex divide-x divide-surface-border overflow-hidden">
          <div className="w-1/3 flex flex-col">
            <p className="px-4 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider border-b border-surface-border">Headers (JSON)</p>
            <textarea value={headers} onChange={e => setHeaders(e.target.value)} className="flex-1 bg-surface-base p-4 text-xs font-mono text-text-secondary focus:outline-none resize-none" />
            <div className="border-t border-surface-border">
              <p className="px-4 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Request Body</p>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder={'{\n  "key": "value"\n}'} className="w-full bg-surface-base p-4 text-xs font-mono text-text-secondary focus:outline-none resize-none" />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Response</p>
              {status !== null && <span className={`text-sm font-bold font-mono ${statusColor}`}>{status}</span>}
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-secondary whitespace-pre-wrap">
              {loading ? 'Sending request…' : response ?? 'No response yet. Hit Send.'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
