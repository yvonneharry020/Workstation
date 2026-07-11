'use client'

import { useState, useEffect } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

interface TableInfo {
  table_name: string
  row_count: number
}

export default function DatabasePage() {
  const supabase = createClient()
  const [tables, setTables] = useState<TableInfo[]>([])
  const [query, setQuery] = useState('SELECT id, email FROM candidates LIMIT 10')
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tablesLoading, setTablesLoading] = useState(true)

  const KNOWN_TABLES = ['candidates','companies','jobs','support_tickets','audit_logs','staff_members','badges','chat_messages','feature_flags','incidents','platform_subscriptions','platform_costs','announcements','webhook_logs']

  useEffect(() => { void loadTableCounts() }, [])

  async function loadTableCounts() {
    const counts = await Promise.all(
      KNOWN_TABLES.map(async (t) => {
        const { count } = await supabase.from(t).select('*', { count: 'exact', head: true })
        return { table_name: t, row_count: count ?? 0 }
      })
    )
    setTables(counts)
    setTablesLoading(false)
  }

  async function runQuery() {
    const q = query.trim()
    if (!q.toLowerCase().startsWith('select')) {
      setError('Only SELECT queries are allowed for safety.')
      setResults(null)
      return
    }
    setLoading(true)
    setError(null)
    setResults(null)
    // The database itself enforces the real guard (single SELECT statement,
    // no stacking, RLS still applies) — this client-side check above is only
    // a fast pre-flight for UX, not the security boundary.
    const { data, error: e } = await supabase.rpc('execute_readonly_sql' as never, { sql: q })
    if (e) {
      setError(`Query failed: ${e.message}`)
    } else {
      setResults((data ?? []) as Record<string, unknown>[])
    }
    setLoading(false)
  }

  function quickQuery(tableName: string) {
    setQuery(`SELECT * FROM ${tableName} LIMIT 20`)
  }

  const columns = results && results.length > 0 ? Object.keys(results[0]) : []

  return (
    <div className="flex h-screen">
      <div className="w-56 flex-shrink-0 border-r border-surface-border flex flex-col">
        <div className="px-4 py-4 border-b border-surface-border">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Tables</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {tablesLoading ? (
            <div className="text-text-muted text-xs px-2 py-3">Loading…</div>
          ) : (
            tables.map(t => (
              <button key={t.table_name} onClick={() => quickQuery(t.table_name)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors text-left">
                <span className="text-xs text-text-secondary font-mono">{t.table_name}</span>
                <span className="text-[10px] text-text-muted bg-surface-elevated px-1.5 py-0.5 rounded font-mono">{t.row_count.toLocaleString()}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-surface-border">
          <div className="flex items-start gap-3">
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void runQuery() }}
              rows={3}
              className="flex-1 bg-surface-elevated border border-surface-border rounded-xl px-4 py-3 text-sm font-mono text-text-primary focus:outline-none focus:border-tech-500 resize-none"
              placeholder="SELECT * FROM table_name LIMIT 20"
            />
            <div className="flex flex-col gap-2">
              <button onClick={runQuery} disabled={loading} className="px-5 py-2.5 bg-tech-500 hover:bg-tech-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
                {loading ? 'Running…' : 'Run'}
              </button>
              <p className="text-[10px] text-text-muted text-center">⌘+Enter</p>
            </div>
          </div>
          <p className="text-[10px] text-tech-400 mt-2">Read-only — only SELECT queries are permitted.</p>
        </div>

        <div className="flex-1 overflow-auto">
          {error && (
            <div className="px-6 py-4">
              <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4">
                <p className="text-sm text-red-400 font-mono">{error}</p>
              </div>
            </div>
          )}
          {results && (
            <div className="px-6 py-4">
              <p className="text-xs text-text-muted mb-3">{results.length} row{results.length !== 1 ? 's' : ''} returned</p>
              {results.length === 0 ? (
                <p className="text-sm text-text-muted">No rows returned.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-surface-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface-elevated border-b border-surface-border">
                        {columns.map(col => (
                          <th key={col} className="px-3 py-2.5 text-left font-semibold text-text-muted font-mono whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {results.map((row, i) => (
                        <tr key={i} className="hover:bg-surface-elevated/50 transition-colors">
                          {columns.map(col => (
                            <td key={col} className="px-3 py-2 font-mono text-text-secondary max-w-[200px] truncate" title={String(row[col] ?? '')}>
                              {row[col] === null ? <span className="text-text-muted italic">null</span> : typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {!error && !results && !loading && (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              Run a SELECT query to see results
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
