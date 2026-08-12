export const getImageUrl = (url?: string | null): string => {
  if (!url) return '/images/placeholder.png'
  if (url.startsWith('http')) return url
  return `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${url}`
}

export const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

export const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export const groupBy = <T>(arr: T[], key: keyof T): Record<string, T[]> =>
  arr.reduce((acc, item) => {
    const k = String(item[key])
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)

export const clsx = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(' ')
