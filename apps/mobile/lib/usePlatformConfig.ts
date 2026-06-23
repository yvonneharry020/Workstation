import { useEffect, useState } from 'react'
import Constants from 'expo-constants'
import { supabase } from './supabase'

interface PlatformConfig {
  isMaintenanceMode: boolean
  maintenanceMessage: string | null
  minimumAppVersion: string | null
}

const DEFAULT: PlatformConfig = {
  isMaintenanceMode: false,
  maintenanceMessage: null,
  minimumAppVersion: null,
}

function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map(Number)
  const [aMajor, aMinor = 0, aPatch = 0] = parse(a)
  const [bMajor, bMinor = 0, bPatch = 0] = parse(b)
  if (aMajor !== bMajor) return aMajor - bMajor
  if (aMinor !== bMinor) return aMinor - bMinor
  return aPatch - bPatch
}

export function usePlatformConfig() {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT)
  const [isUpdateRequired, setIsUpdateRequired] = useState(false)

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data } = await supabase
          .from('platform_config')
          .select('key, value')

        if (!data) return

        const map = Object.fromEntries(data.map((row) => [row.key, row.value]))

        const resolved: PlatformConfig = {
          isMaintenanceMode: map['maintenance_mode'] === 'true',
          maintenanceMessage: map['maintenance_message'] ?? null,
          minimumAppVersion: map['minimum_app_version'] ?? null,
        }

        setConfig(resolved)

        if (resolved.minimumAppVersion) {
          const currentVersion = Constants.expoConfig?.version ?? '0.0.0'
          const needsUpdate =
            compareVersions(currentVersion, resolved.minimumAppVersion) < 0
          setIsUpdateRequired(needsUpdate)
        }
      } catch {
        // Fail silently — don't block app startup on a config fetch failure
      }
    }

    fetchConfig()
  }, [])

  return { ...config, isUpdateRequired }
}
