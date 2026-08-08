/**
 * Buy-Now Transaction Store — hoàn toàn độc lập với luồng đấu giá
 *
 * Luồng: Mua ngay → [pending_submission] → Đăng banner → [pending_review]
 *        → Admin duyệt → [approved] / Admin từ chối → [awaiting_edit] (n/10)
 *        → Sửa lại → [pending_review] → ... → [rejected] (hết lần)
 */

import type { BannerPositionKey } from './bannerAuctionStore'

export const MAX_BUYNOW_REVISIONS = 10

export type BuyNowStatus =
  | 'pending_submission' // đã mua, chưa đăng banner
  | 'pending_review'     // đã đăng banner, chờ admin duyệt
  | 'approved'           // admin duyệt, banner đang chạy
  | 'awaiting_edit'      // admin từ chối, shop cần sửa
  | 'rejected'           // từ chối vĩnh viễn (hết số lần sửa)

export interface BuyNowTransaction {
  id: string                   // unique per purchase
  position: BannerPositionKey
  positionLabel: string
  shopName: string
  purchasedAt: string          // ISO timestamp khi mua
  price: number                // giá đã thanh toán
  status: BuyNowStatus
  // Banner info (sau khi submit)
  title?: string
  link?: string
  image?: string               // idb: ref hoặc data URL
  // Review
  rejectCount: number
  rejectReason?: string
  approvedAt?: string
  submittedAt?: string
}

const STORE_KEY = 'buynow_transactions_v1'

function getStore(): BuyNowTransaction[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]') } catch { return [] }
}
function saveStore(data: BuyNowTransaction[]): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)) } catch {}
}

// ── SHOP functions ───────────────────────────────────────────────────────────

/** Tạo giao dịch buy-now mới ngay khi shop xác nhận mua */
export function createBuyNowTransaction(
  position: BannerPositionKey,
  positionLabel: string,
  shopName: string,
  price: number,
  bannerData?: { title?: string; link?: string; image?: string },
): BuyNowTransaction {
  const tx: BuyNowTransaction = {
    id: 'bn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    position, positionLabel, shopName, price,
    purchasedAt: new Date().toISOString(),
    status: 'pending_review',
    submittedAt: new Date().toISOString(),
    rejectCount: 0,
    ...(bannerData?.title  && { title:  bannerData.title }),
    ...(bannerData?.link   && { link:   bannerData.link  }),
    ...(bannerData?.image  && { image:  bannerData.image }),
  }
  const data = getStore()
  data.unshift(tx)
  saveStore(data)
  return tx
}

/** Lấy tất cả giao dịch buy-now của một shop */
export function getBuyNowTransactions(shopName: string): BuyNowTransaction[] {
  return getStore().filter(tx => tx.shopName === shopName)
}

/** Shop đăng / tái đăng banner */
export function submitBuyNowBanner(
  txId: string,
  payload: { title: string; link?: string; image: string },
): boolean {
  const data = getStore()
  const idx = data.findIndex(tx => tx.id === txId)
  if (idx === -1) return false
  const tx = data[idx]
  if (tx.status !== 'awaiting_edit') return false
  data[idx] = { ...tx, ...payload, status: 'pending_review', submittedAt: new Date().toISOString() }
  saveStore(data)
  return true
}

// ── ADMIN functions ──────────────────────────────────────────────────────────

/** Lấy tất cả giao dịch buy-now (cho admin) */
export function getAllBuyNowTransactions(): BuyNowTransaction[] {
  return getStore()
}

/** Admin duyệt banner */
export function approveBuyNow(txId: string): boolean {
  const data = getStore()
  const idx = data.findIndex(tx => tx.id === txId)
  if (idx === -1) return false
  data[idx] = { ...data[idx], status: 'approved', approvedAt: new Date().toISOString() }
  saveStore(data)
  return true
}

/** Admin từ chối banner (n/10 lần) */
export function rejectBuyNow(txId: string, reason?: string): boolean {
  const data = getStore()
  const idx = data.findIndex(tx => tx.id === txId)
  if (idx === -1) return false
  const tx = data[idx]
  const newCount = (tx.rejectCount ?? 0) + 1
  const nextStatus: BuyNowStatus = newCount >= MAX_BUYNOW_REVISIONS ? 'rejected' : 'awaiting_edit'
  data[idx] = { ...tx, status: nextStatus, rejectReason: reason, rejectCount: newCount }
  saveStore(data)
  return true
}

/** Xoá một giao dịch (admin cleanup) */
export function deleteBuyNowTransaction(txId: string): void {
  const data = getStore().filter(tx => tx.id !== txId)
  saveStore(data)
}
