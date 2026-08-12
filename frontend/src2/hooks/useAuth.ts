import { useAppSelector, useAppDispatch } from '../store/hooks'
import { logout, setCurrentRole } from '../store/slices/authSlice'
import API from '../services/api'

export const useAuth = () => {
  const dispatch = useAppDispatch()
  const { user, isAuthenticated, loading, error } = useAppSelector(s => s.auth)

  const hasRole = (role: string) => user?.roles?.some(r => r.role_name === role) ?? false
  const isAdmin = hasRole('admin')
  const isShop = hasRole('shop')
  const isShipper = hasRole('shipper')
  const currentRole = user?.current_role

  const switchRole = async (role: string) => {
    await API.put('/api/v1/users/me/current-role', { role })
    dispatch(setCurrentRole(role))
  }

  const signOut = () => dispatch(logout())

  return { user, isAuthenticated, loading, error, hasRole, isAdmin, isShop, isShipper, currentRole, switchRole, signOut }
}
