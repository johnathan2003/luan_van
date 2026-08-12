export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export const isValidPhone = (phone: string): boolean =>
  /^(\+84|0)[3|5|7|8|9][0-9]{8}$/.test(phone)

export const isValidPassword = (pwd: string): boolean => pwd.length >= 6

export const isValidUrl = (url: string): boolean => {
  try { new URL(url); return true } catch { return false }
}
