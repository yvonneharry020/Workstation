'use client'

import TopBar from '@/components/layout/TopBar'
import DatabaseGate from '@/components/database/DatabaseGate'
import DatabaseListContent from '@/components/database/DatabaseListContent'

export default function TechUserDataPage() {
  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="User Data" subtitle="User digital footprint system" />
      <DatabaseGate room="tech">
        <DatabaseListContent baseRoute="/tech/user-data" />
      </DatabaseGate>
    </div>
  )
}
