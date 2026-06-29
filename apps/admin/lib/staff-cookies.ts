'use client'

import { useState, useEffect, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'

// useLayoutEffect runs before paint on the client; fall back to useEffect on server to avoid SSR warning
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export interface StaffInfo {
  role: string      // 'admin' | 'staff' | 'viewer' | 'superadmin'
  name: string
  permissions: {
    admin: boolean
    management: boolean
    technical: boolean
    finance: boolean
  }
}

const SUPER_ADMIN_DEFAULTS: StaffInfo = {
  role: 'superadmin',
  name: '',
  permissions: { admin: true, management: true, technical: true, finance: true },
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find(c => c.startsWith(name + '='))
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
}

function parseCookies(): StaffInfo {
  const role     = readCookie('_wk_role')
  const name     = readCookie('_wk_name')
  const permsRaw = readCookie('_wk_perms')

  if (role && permsRaw) {
    try {
      const permissions = JSON.parse(permsRaw) as StaffInfo['permissions']
      return { role, name: name ?? '', permissions }
    } catch {
      // malformed cookie — fall through
    }
  }

  return SUPER_ADMIN_DEFAULTS
}

export function useStaffInfo(): StaffInfo {
  const pathname = usePathname()
  const [info, setInfo] = useState<StaffInfo>(SUPER_ADMIN_DEFAULTS)

  useIsomorphicLayoutEffect(() => {
    setInfo(parseCookies())
  }, [pathname])

  return info
}

export function useIsViewer(): boolean {
  const { role } = useStaffInfo()
  return role === 'viewer'
}

export function useAllowedRooms(): StaffInfo['permissions'] {
  const { permissions } = useStaffInfo()
  return permissions
}
