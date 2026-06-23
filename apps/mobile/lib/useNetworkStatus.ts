import { useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

const CHECK_INTERVAL_MS = 5_000
const TIMEOUT_MS = 4_000

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch('https://www.gstatic.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(id)
    return res.status === 204 || res.ok
  } catch {
    return false
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const runCheck = async () => {
    const online = await checkConnectivity()
    setIsOnline(online)
  }

  useEffect(() => {
    runCheck()
    intervalRef.current = setInterval(runCheck, CHECK_INTERVAL_MS)

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') runCheck()
    })

    return () => {
      clearInterval(intervalRef.current)
      sub.remove()
    }
  }, [])

  return isOnline
}
