import { useState, useEffect, useCallback } from 'react'
import API from '../services/api'

interface UseFetchResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useFetch<T>(url: string, deps: any[] = []): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await API.get(url)
      setData(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => { fetch() }, [fetch, ...deps])

  return { data, loading, error, refetch: fetch }
}
