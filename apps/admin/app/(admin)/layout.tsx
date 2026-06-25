import Sidebar from '@/components/layout/Sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar
        pendingCandidates={23}
        pendingCompanies={8}
        flaggedItems={14}
        openTickets={2}
        badgeDisputes={2}
      />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  )
}
