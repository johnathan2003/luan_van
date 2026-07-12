/**
 * Lưu ảnh banner vào IndexedDB — không bị giới hạn 5MB như localStorage
 */
const DB_NAME = 'buyzo_image_store'
const STORE   = 'images'
const VERSION = 1

let _db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onerror   = () => reject(req.error)
    req.onsuccess = () => { _db = req.result; resolve(req.result) }
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
  })
}

export const IDB_PREFIX = 'idb:'

export function isIDBRef(s: string): boolean { return s.startsWith(IDB_PREFIX) }

export async function idbSave(dataUrl: string): Promise<string> {
  const key = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(dataUrl, key)
    tx.oncomplete = () => resolve()   // chờ transaction commit hẳn mới resolve
    tx.onerror    = () => reject(tx.error)
    tx.onabort    = () => reject(tx.error)
  })
  return IDB_PREFIX + key
}

export async function idbGet(ref: string): Promise<string> {
  const key = ref.startsWith(IDB_PREFIX) ? ref.slice(IDB_PREFIX.length) : ref
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? '')
    req.onerror   = () => reject(req.error)
  })
}

export async function idbDelete(ref: string): Promise<void> {
  if (!ref.startsWith(IDB_PREFIX)) return
  const key = ref.slice(IDB_PREFIX.length)
  const db  = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

/** Resolve bất kỳ loại ref nào → actual data URL (async) */
export async function resolveImageAsync(imageOrRef: string): Promise<string> {
  if (!imageOrRef) return ''
  if (imageOrRef.startsWith(IDB_PREFIX))  return idbGet(imageOrRef)
  if (imageOrRef.startsWith('ref:'))       return localStorage.getItem(imageOrRef.slice(4)) ?? ''
  return imageOrRef // raw data URL hoặc https:// URL
}
