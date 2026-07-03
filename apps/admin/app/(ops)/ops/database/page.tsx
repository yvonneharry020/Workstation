'use client'

import TopBar from '@/components/layout/TopBar'
import DatabaseGate from '@/components/database/DatabaseGate'
import DatabaseListContent from '@/components/database/DatabaseListContent'

export default function OpsDatabasePage() {
  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Database" subtitle="User digital footprint system" />
      <DatabaseGate room="ops">
        <DatabaseListContent baseRoute="/ops/database" />
      </DatabaseGate>
    </div>
  )
}
