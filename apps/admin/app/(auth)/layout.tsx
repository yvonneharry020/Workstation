export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">{children}</div>
    </div>
  )
}
