'use client'

import { useSyncExternalStore } from 'react'

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
  const match = document.cookie.split('; ').find(c => c.startsWith(name + '='))
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
}

// Module-level cache so useSyncExternalStore gets a stable reference
// when cookie values haven't changed (React requires this to avoid infinite loops).
let _cacheKey = ''
let _cached: StaffInfo = SUPER_ADMIN_DEFAULTS

function getSnapshot(): StaffInfo {
  const role     = readCookie('_wk_role')
  const name     = readCookie('_wk_name')
  const permsRaw = readCookie('_wk_perms')
  const key      = `${role ?? ''}|${name ?? ''}|${permsRaw ?? ''}`

  if (key === _cacheKey) return _cached
  _cacheKey = key

  if (role && permsRaw) {
    try {
      const permissions = JSON.parse(permsRaw) as StaffInfo['permissions']
      _cached = { role, name: name ?? '', permissions }
      return _cached
    } catch {
      // malformed — fall through
    }
  }

  _cached = SUPER_ADMIN_DEFAULTS
  return _cached
}

function subscribe(_cb: () => void) {
  return () => {}
}

export function useStaffInfo(): StaffInfo {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SUPER_ADMIN_DEFAULTS,
  )
}

export function useIsViewer(): boolean {
  const { role } = useStaffInfo()
  return role === 'viewer'
}

export function useAllowedRooms(): StaffInfo['permissions'] {
  const { permissions } = useStaffInfo()
  return permissions
}
