export const formatCurrency = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '0₫'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num)
}

export const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export const formatDateOnly = (dateStr?: string | null): string => {
  if (!dateStr) return ''
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr))
}

export const formatNumber = (num: number): string =>
  new Intl.NumberFormat('vi-VN').format(num)

export const formatOrderId = (id: number): string =>
  `#${String(id).padStart(6, '0')}`

export const truncate = (str: string, max = 80): string =>
  str.length <= max ? str : str.slice(0, max) + '...'

export const formatRating = (rating: string | number): string =>
  Number(rating).toFixed(1)
