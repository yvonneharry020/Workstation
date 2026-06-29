'use client'

import { useState, useEffect } from 'react'

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

// Returns the current staff member's info from cookies set by middleware.
// Falls back to super-admin defaults if no cookies are present
// (i.e., the user has no staff_members record — they are the super admin).
export function useStaffInfo(): StaffInfo {
  const [info, setInfo] = useState<StaffInfo>(SUPER_ADMIN_DEFAULTS)

  useEffect(() => {
    const role  = readCookie('_wk_role')
    const name  = readCookie('_wk_name')
    const permsRaw = readCookie('_wk_perms')

    if (role && permsRaw) {
      try {
        const permissions = JSON.parse(permsRaw) as StaffInfo['permissions']
        setInfo({ role, name: name ?? '', permissions })
      } catch {
        // malformed cookie — keep defaults
      }
    }
  }, [])

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
