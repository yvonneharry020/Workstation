'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggle: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

function applyCSSTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
  document.cookie = `ws-theme=${t};path=/;max-age=31536000;SameSite=Lax`
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
}: {
  children: React.ReactNode
  defaultTheme?: Theme
}) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('user_preferences')
        .select('theme')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.theme && data.theme !== theme) {
            const saved = data.theme as Theme
            setTheme(saved)
            applyCSSTheme(saved)
          }
        })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyCSSTheme(next)

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('user_preferences').upsert({
        user_id: user.id,
        theme: next,
        updated_at: new Date().toISOString(),
      })
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
