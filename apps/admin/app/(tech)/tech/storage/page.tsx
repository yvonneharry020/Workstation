'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

interface Bucket {
  id: string
  name: string
  public: boolean
  created_at: string | null
  file_count?: number
}

interface StorageFile {
  name: string
  id: string | null
  metadata: {
    size?: number
    mimetype?: string
    lastModified?: string
  } | null
  created_at: string | null
  updated_at: string | null
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fileIcon(mime: string | undefined) {
  if (!mime) return '📄'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.startsWith('video/')) return '🎬'
  if (mime === 'application/pdf') return '📕'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('sheet') || mime.includes('excel')) return '📊'
  if (mime.includes('zip') || mime.includes('archive')) return '📦'
  return '📄'
}

export default function StoragePage() {
  const supabase = createClient()
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null)
  const [files, setFiles] = useState<StorageFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [dangerInput, setDangerInput] = useState('')
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadBuckets = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.storage.listBuckets()
    if (!error && data) {
      const enriched: Bucket[] = await Promise.all(
        data.map(async b => {
          try {
            const { data: fileList } = await supabase.storage.from(b.name).list('', { limit: 1000 })
            return { ...b, file_count: fileList?.length ?? 0 }
          } catch {
            return { ...b, file_count: 0 }
          }
        })
      )
      setBuckets(enriched)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadBuckets() }, [loadBuckets])

  async function openBucket(bucket: Bucket) {
    setSelectedBucket(bucket)
    setFiles([])
    setFilesLoading(true)
    setDangerInput('')
    const { data } = await supabase.storage.from(bucket.name).list('', {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    setFiles((data ?? []) as StorageFile[])
    setFilesLoading(false)
  }

  async function deleteFile(fileName: string) {
    if (!selectedBucket) return
    setActing(fileName)
    const { error } = await supabase.storage.from(selectedBucket.name).remove([fileName])
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('audit_logs').insert({
        event: 'admin.storage_file_deleted',
        actor_email: user?.email ?? null,
        actor_id: user?.id ?? null,
        actor_type: 'admin',
        target_id: fileName,
        target_type: 'storage_file',
        severity: 'warning',
        app: 'admin_panel',
      })
      setFiles(prev => prev.filter(f => f.name !== fileName))
      showToast(`Deleted: ${fileName}`)
    } else {
      showToast(`Error: ${(error as { message?: string }).message ?? 'Delete failed'}`)
    }
    setConfirmDelete(null)
    setActing(null)
  }

  async function bulkDeleteAll() {
    if (!selectedBucket || dangerInput !== selectedBucket.name) return
    setBulkDeleteLoading(true)
    const names = files.map(f => f.name)
    if (names.length > 0) {
      const { error } = await supabase.storage.from(selectedBucket.name).remove(names)
      if (!error) {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('audit_logs').insert({
          event: 'admin.storage_bulk_delete',
          actor_email: user?.email ?? null,
          actor_id: user?.id ?? null,
          actor_type: 'admin',
          target_id: selectedBucket.name,
          target_type: 'storage_bucket',
          severity: 'critical',
          app: 'admin_panel',
        })
        setFiles([])
        showToast(`Deleted all ${names.length} files from ${selectedBucket.name}`)
      }
    }
    setDangerInput('')
    setBulkDeleteLoading(false)
  }

  function getPublicUrl(bucket: Bucket, fileName: string) {
    const { data } = supabase.storage.from(bucket.name).getPublicUrl(fileName)
    return data.publicUrl
  }

  const totalFiles = buckets.reduce((s, b) => s + (b.file_count ?? 0), 0)
  const publicBuckets = buckets.filter(b => b.public).length
  const largestFile = files.reduce((max, f) =>
    (f.metadata?.size ?? 0) > (max?.metadata?.size ?? 0) ? f : max, files[0])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Storage Manager" subtitle="Manage Supabase storage buckets and files" />

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, backgroundColor: '#1F2937', color: '#F9FAFB', fontSize: 13, fontWeight: 600, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      <div style={{ padding: '24px 32px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Buckets',  value: buckets.length,                  color: '#6366F1' },
            { label: 'Total Files',    value: totalFiles,                       color: '#38BDF8' },
            { label: 'Public Buckets', value: publicBuckets,                    color: '#34D399' },
            { label: 'Largest File',   value: largestFile ? formatBytes(largestFile.metadata?.size ?? 0) : '—', color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
              <p style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 4 }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedBucket ? '300px 1fr' : '1fr', gap: 20 }}>
          {/* Bucket list */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Buckets</p>
            {loading ? (
              <p style={{ color: 'var(--tx-3)', fontSize: 13 }}>Loading buckets…</p>
            ) : buckets.length === 0 ? (
              <div style={{ ...CARD, padding: 24, textAlign: 'center' }}>
                <p style={{ color: 'var(--tx-3)', fontSize: 13 }}>No buckets found.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {buckets.map(b => (
                  <div
                    key={b.id}
                    onClick={() => void openBucket(b)}
                    style={{
                      ...CARD, padding: '14px 16px', cursor: 'pointer',
                      border: selectedBucket?.id === b.id ? '1px solid #6366F1' : '1px solid var(--border)',
                      backgroundColor: selectedBucket?.id === b.id ? 'rgba(99,102,241,0.06)' : 'var(--bg-card)',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>🗄️ {b.name}</p>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 5,
                        color: b.public ? '#34D399' : '#9CA3AF',
                        backgroundColor: b.public ? 'rgba(52,211,153,0.1)' : 'rgba(156,163,175,0.1)',
                        border: `1px solid ${b.public ? 'rgba(52,211,153,0.3)' : 'rgba(156,163,175,0.3)'}`,
                      }}>
                        {b.public ? 'Public' : 'Private'}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>{(b.file_count ?? 0).toLocaleString()} files · Created {formatDate(b.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File browser */}
          {selectedBucket && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Files in <span style={{ color: '#6366F1' }}>{selectedBucket.name}</span>
                </p>
                <button onClick={() => setSelectedBucket(null)} style={{ fontSize: 11, color: 'var(--tx-3)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', backgroundColor: 'transparent', cursor: 'pointer' }}>← Back</button>
              </div>

              <div style={{ ...CARD, overflow: 'hidden', marginBottom: 20 }}>
                {filesLoading ? (
                  <div style={{ padding: 32, textAlign: 'center' }}><p style={{ color: 'var(--tx-3)', fontSize: 13 }}>Loading files…</p></div>
                ) : files.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center' }}><p style={{ color: 'var(--tx-3)', fontSize: 13 }}>No files in this bucket.</p></div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr>
                        {['File', 'Type', 'Size', 'Last Modified', 'Actions'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {files.map(file => (
                        <tr key={file.name} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-1)', fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ marginRight: 6 }}>{fileIcon(file.metadata?.mimetype)}</span>
                            {file.name}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--tx-3)' }}>{file.metadata?.mimetype ?? '—'}</td>
                          <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-2)', whiteSpace: 'nowrap' }}>{formatBytes(file.metadata?.size ?? 0)}</td>
                          <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{formatDate(file.updated_at ?? file.created_at)}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {selectedBucket.public && (
                                <button
                                  onClick={() => { navigator.clipboard.writeText(getPublicUrl(selectedBucket, file.name)); showToast('URL copied!') }}
                                  style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                                  Copy URL
                                </button>
                              )}
                              <a href={selectedBucket.public ? getPublicUrl(selectedBucket, file.name) : '#'} target="_blank" rel="noopener noreferrer"
                                style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(56,189,248,0.4)', backgroundColor: 'rgba(56,189,248,0.08)', color: '#38BDF8', fontSize: 10, cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>
                                View
                              </a>
                              {confirmDelete === file.name ? (
                                <>
                                  <button onClick={() => void deleteFile(file.name)} disabled={acting === file.name}
                                    style={{ padding: '3px 8px', borderRadius: 5, border: 'none', backgroundColor: '#F87171', color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                                    {acting === file.name ? '…' : 'Confirm'}
                                  </button>
                                  <button onClick={() => setConfirmDelete(null)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 10, cursor: 'pointer' }}>Cancel</button>
                                </>
                              ) : (
                                <button onClick={() => setConfirmDelete(file.name)}
                                  style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Danger zone */}
              <div style={{ ...CARD, border: '1px solid rgba(239,68,68,0.3)', padding: '20px 24px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#F87171', marginBottom: 6 }}>⚠️ Danger Zone</p>
                <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 14 }}>
                  Permanently delete ALL {files.length} files from <strong style={{ color: 'var(--tx-1)' }}>{selectedBucket.name}</strong>. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    value={dangerInput}
                    onChange={e => setDangerInput(e.target.value)}
                    placeholder={`Type "${selectedBucket.name}" to confirm`}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: 12, outline: 'none' }}
                  />
                  <button
                    onClick={() => void bulkDeleteAll()}
                    disabled={dangerInput !== selectedBucket.name || bulkDeleteLoading || files.length === 0}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: dangerInput === selectedBucket.name && files.length > 0 ? '#EF4444' : 'rgba(239,68,68,0.2)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: dangerInput === selectedBucket.name && files.length > 0 ? 'pointer' : 'not-allowed', opacity: dangerInput !== selectedBucket.name || files.length === 0 ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                    {bulkDeleteLoading ? 'Deleting…' : 'Delete All Files'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
