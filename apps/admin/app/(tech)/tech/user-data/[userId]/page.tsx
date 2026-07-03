'use client'

import { use } from 'react'
import TopBar from '@/components/layout/TopBar'
import DatabaseGate from '@/components/database/DatabaseGate'
import UserFolderContent from '@/components/database/UserFolderContent'

export default function TechUserFolderPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="User Folder" subtitle="Full digital footprint — Technical Room" />
      <DatabaseGate room="tech">
        <UserFolderContent userId={userId} room="tech" baseRoute="/tech/user-data" />
      </DatabaseGate>
    </div>
  )
}
