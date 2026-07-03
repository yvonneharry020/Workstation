'use client'

import { use } from 'react'
import TopBar from '@/components/layout/TopBar'
import DatabaseGate from '@/components/database/DatabaseGate'
import UserFolderContent from '@/components/database/UserFolderContent'

export default function OpsUserFolderPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="User Folder" subtitle="Full digital footprint — Management Room" />
      <DatabaseGate room="ops">
        <UserFolderContent userId={userId} room="ops" baseRoute="/ops/database" />
      </DatabaseGate>
    </div>
  )
}
