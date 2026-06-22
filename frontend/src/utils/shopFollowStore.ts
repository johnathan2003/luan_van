// Luu trang thai "theo doi shop" tam o localStorage - phuc vu demo/test, chua co backend thuc
const KEY = 'buyzo_followed_shops_v1'

function readAll(): number[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(ids: number[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* ignore */ }
}

export function isFollowingShop(shopId: number): boolean {
  return readAll().includes(shopId)
}

// Tra ve true neu day la lan dau theo doi (vua chuyen tu chua theo doi -> theo doi)
export function toggleFollowShop(shopId: number): { following: boolean; justFollowed: boolean } {
  const all = readAll()
  const idx = all.indexOf(shopId)
  if (idx >= 0) {
    all.splice(idx, 1)
    writeAll(all)
    return { following: false, justFollowed: false }
  }
  all.push(shopId)
  writeAll(all)
  return { following: true, justFollowed: true }
}
