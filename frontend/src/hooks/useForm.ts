import { useState, ChangeEvent, FormEvent } from 'react'

export function useForm<T extends Record<string, any>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setValues(prev => ({ ...prev, [name]: value }))
    if (errors[name as keyof T]) setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const setField = (name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }

  const setError = (name: keyof T, message: string) => {
    setErrors(prev => ({ ...prev, [name]: message }))
  }

  const reset = () => {
    setValues(initialValues)
    setErrors({})
  }

  const handleSubmit = (onSubmit: (values: T) => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try { await onSubmit(values) } finally { setSubmitting(false) }
  }

  return { values, errors, submitting, handleChange, setField, setError, reset, handleSubmit }
}
