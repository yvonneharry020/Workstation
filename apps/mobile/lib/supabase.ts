import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

const NativeStorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

const WebStorageAdapter = {
  getItem: (key: string) => {
    if (typeof localStorage === 'undefined') return Promise.resolve(null)
    return Promise.resolve(localStorage.getItem(key))
  },
  setItem: (key: string, value: string) => {
    if (typeof localStorage === 'undefined') return Promise.resolve()
    return Promise.resolve(localStorage.setItem(key, value))
  },
  removeItem: (key: string) => {
    if (typeof localStorage === 'undefined') return Promise.resolve()
    return Promise.resolve(localStorage.removeItem(key))
  },
}

const storage = Platform.OS === 'web' ? WebStorageAdapter : NativeStorageAdapter

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
