/**
 * warehouseRole.ts
 * ------------------
 * Role "employee" giờ dùng CHUNG cho cả nhân viên shop (ShopEmployee, chỉ
 * xem) lẫn nhân viên kho hub/district/ward (SystemEmployee, do Admin_emp/
 * admin tạo, có quyền theo phạm vi được giao). Cùng 1 role string nên FE
 * cần gọi API này để biết một tài khoản "employee" cụ thể là loại nào.
 */
import API from '../services/api'

export type EmployeeTier = 'hub' | 'district' | 'ward' | null

/** true + tier nếu đây là nhân viên kho; false/null nếu là nhân viên shop. */
export async function getEmployeeTier(): Promise<EmployeeTier> {
  try {
    const r = await API.get('/api/v1/warehouse-accounts/me')
    if (r.data?.is_warehouse) {
      const tier = r.data.tier
      if (tier === 'hub' || tier === 'district' || tier === 'ward') return tier
    }
    return null
  } catch {
    return null
  }
}

/** Đường dẫn dashboard đúng cho role "employee" — /hub, /district, /ward hoặc /employee (shop). */
export async function resolveEmployeeDestination(): Promise<string> {
  const tier = await getEmployeeTier()
  if (tier === 'hub') return '/hub'
  if (tier === 'district') return '/district'
  if (tier === 'ward') return '/ward'
  return '/employee'
}
