const ACCESS_KEY = "showroompro_access_token"
const REFRESH_KEY = "showroompro_refresh_token"

export const tokenStorage = {
  getAccess(): string | null {
    try {
      return localStorage.getItem(ACCESS_KEY)
    } catch {
      return null
    }
  },
  getRefresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },
  set(accessToken: string, refreshToken: string): void {
    try {
      localStorage.setItem(ACCESS_KEY, accessToken)
      localStorage.setItem(REFRESH_KEY, refreshToken)
    } catch {
      // Ignore storage quota errors
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    } catch {
      // Ignore
    }
  },
}
