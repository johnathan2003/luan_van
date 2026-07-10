/**
 * followStore.ts
 * ─────────────
 * Kho dữ liệu theo dõi xã hội (localStorage, per-user email).
 * Thay thế shopFollowStore.ts — dùng key mới, migrate tự động.
 *
 * Dữ liệu:
 *   followingShops  — danh sách shop tôi đang theo dõi (có tên/avatar)
 *   followingUsers  — danh sách người dùng tôi đang theo dõi
 *   myFollowers     — người dùng đang theo dõi tôi (seed + real)
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FollowedShop {
  shopId:   number
  shopName: string
  avatarUrl?: string
  followedAt: string  // ISO
}

export interface FollowedUser {
  userId:   number
  fullName: string
  avatarUrl?: string
  followedAt: string  // ISO
}

interface SocialData {
  followingShops:  FollowedShop[]
  followingUsers:  FollowedUser[]
  myFollowers:     FollowedUser[]
  seeded:          boolean
}

// ── Seed mock followers ────────────────────────────────────────────────────────

const MOCK_FOLLOWERS: FollowedUser[] = [
  { userId: 9001, fullName: 'Nguyễn Minh Tuấn',  avatarUrl: '', followedAt: '2025-10-05T08:00:00Z' },
  { userId: 9002, fullName: 'Trần Thị Hoa',       avatarUrl: '', followedAt: '2025-11-12T10:30:00Z' },
  { userId: 9003, fullName: 'Lê Văn Đức',         avatarUrl: '', followedAt: '2025-12-20T14:00:00Z' },
  { userId: 9004, fullName: 'Phạm Thị Lan',       avatarUrl: '', followedAt: '2026-01-08T09:15:00Z' },
  { userId: 9005, fullName: 'Hoàng Ẩnh Khoa',     avatarUrl: '', followedAt: '2026-02-14T11:00:00Z' },
  { userId: 9006, fullName: 'Đỗ Thị Thanh',       avatarUrl: '', followedAt: '2026-03-01T16:20:00Z' },
]

// ── Storage helpers ────────────────────────────────────────────────────────────

const STORE_KEY  = (email: string) => `buyzo_social_v1_${email}`
const LEGACY_KEY = 'buyzo_followed_shops_v1'  // key cũ của shopFollowStore

function readData(email: string): SocialData {
  try {
    const raw = localStorage.getItem(STORE_KEY(email))
    if (raw) return JSON.parse(raw) as SocialData
  } catch { /* ignore */ }
  return { followingShops: [], followingUsers: [], myFollowers: [], seeded: false }
}

function writeData(email: string, data: SocialData): void {
  try { localStorage.setItem(STORE_KEY(email), JSON.stringify(data)) } catch { /* ignore */ }
}

/** Khởi tạo lần đầu: seed mock followers + migrate từ shopFollowStore cũ */
function ensureInit(email: string): SocialData {
  let data = readData(email)

  if (!data.seeded) {
    // Seed mock followers
    data.myFollowers = [...MOCK_FOLLOWERS]

    // Migrate shop IDs từ legacy store (chỉ có IDs, không có tên)
    try {
      const legacyRaw = localStorage.getItem(LEGACY_KEY)
      if (legacyRaw) {
        const ids: number[] = JSON.parse(legacyRaw)
        const now = new Date().toISOString()
        const migrated: FollowedShop[] = ids
          .filter(id => !data.followingShops.some(s => s.shopId === id))
          .map(id => ({ shopId: id, shopName: `Shop #${id}`, followedAt: now }))
        data.followingShops = [...data.followingShops, ...migrated]
      }
    } catch { /* ignore */ }

    data.seeded = true
    writeData(email, data)
  }

  return data
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Thống kê nhanh */
export function getFollowStats(email: string) {
  const d = ensureInit(email)
  return {
    followingShops: d.followingShops.length,
    followingUsers: d.followingUsers.length,
    myFollowers:    d.myFollowers.length,
  }
}

export function getFollowingShops(email: string): FollowedShop[] {
  return ensureInit(email).followingShops
}

export function getFollowingUsers(email: string): FollowedUser[] {
  return ensureInit(email).followingUsers
}

export function getMyFollowers(email: string): FollowedUser[] {
  return ensureInit(email).myFollowers
}

// ── Shop follow ────────────────────────────────────────────────────────────────

export function isFollowingShop(email: string, shopId: number): boolean {
  return ensureInit(email).followingShops.some(s => s.shopId === shopId)
}

/**
 * Toggle theo dõi shop.
 * Truyền shopInfo để lưu tên/avatar khi theo dõi lần đầu.
 */
export function toggleFollowShop(
  email: string,
  shopId: number,
  shopInfo?: { shopName: string; avatarUrl?: string }
): { following: boolean; justFollowed: boolean } {
  const data = ensureInit(email)
  const idx  = data.followingShops.findIndex(s => s.shopId === shopId)

  if (idx >= 0) {
    // Bỏ theo dõi
    data.followingShops.splice(idx, 1)
    writeData(email, data)
    // Sync legacy key
    syncLegacyKey(data.followingShops)
    return { following: false, justFollowed: false }
  }

  // Theo dõi
  const entry: FollowedShop = {
    shopId,
    shopName:  shopInfo?.shopName  || `Shop #${shopId}`,
    avatarUrl: shopInfo?.avatarUrl || '',
    followedAt: new Date().toISOString(),
  }
  data.followingShops.push(entry)
  writeData(email, data)
  syncLegacyKey(data.followingShops)
  return { following: true, justFollowed: true }
}

function syncLegacyKey(shops: FollowedShop[]) {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(shops.map(s => s.shopId)))
  } catch { /* ignore */ }
}

// ── User follow ────────────────────────────────────────────────────────────────

export function isFollowingUser(email: string, userId: number): boolean {
  return ensureInit(email).followingUsers.some(u => u.userId === userId)
}

export function toggleFollowUser(
  email: string,
  userId: number,
  userInfo?: { fullName: string; avatarUrl?: string }
): { following: boolean } {
  const data = ensureInit(email)
  const idx  = data.followingUsers.findIndex(u => u.userId === userId)

  if (idx >= 0) {
    data.followingUsers.splice(idx, 1)
    writeData(email, data)
    return { following: false }
  }

  data.followingUsers.push({
    userId,
    fullName:  userInfo?.fullName  || `Người dùng #${userId}`,
    avatarUrl: userInfo?.avatarUrl || '',
    followedAt: new Date().toISOString(),
  })
  writeData(email, data)
  return { following: true }
}

// ── Backward-compat shims (dùng cho code cũ không truyền email) ───────────────
// ShopProfilePage gọi hàm này — sẽ được update dần

export function isFollowingShopLegacy(shopId: number): boolean {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    return raw ? (JSON.parse(raw) as number[]).includes(shopId) : false
  } catch { return false }
}
