export const storage = {
  get: <T>(key: string): T | null => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch { return null }
  },
  set: (key: string, value: unknown): void => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  },
  remove: (key: string): void => {
    try { localStorage.removeItem(key) } catch {}
  },
  clear: (): void => {
    try { localStorage.clear() } catch {}
  },
}

export const TOKEN_KEY = 'access_token'
export const REFRESH_TOKEN_KEY = 'refresh_token'
export const USER_KEY = 'user'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token)
export const removeToken = (): void => localStorage.removeItem(TOKEN_KEY)
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY)
export const setRefreshToken = (token: string): void => localStorage.setItem(REFRESH_TOKEN_KEY, token)
