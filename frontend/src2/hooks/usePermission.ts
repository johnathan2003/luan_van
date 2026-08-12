import { useAuth } from './useAuth'

export const usePermission = () => {
  const { user } = useAuth()

  const hasPermission = (permCode: string): boolean => {
    // Admin always has all permissions
    if (user?.roles?.some(r => r.role_name === 'admin')) return true
    return false // fine-grained checks would be done server-side
  }

  const canAccess = (roles: string[]): boolean =>
    user?.roles?.some(r => roles.includes(r.role_name)) ?? false

  return { hasPermission, canAccess }
}
