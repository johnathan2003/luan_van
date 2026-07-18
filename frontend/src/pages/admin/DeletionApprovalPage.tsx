import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import { rejectionStore } from '../../utils/rejectionStore'
import { shopFlagStore } from '../../utils/shopFlagStore'
import { addNotificationFor } from '../../utils/notificationStore'
import { productApprovalStore } from '../../utils/productApprovalStore'
import { getImageUrl } from '../../utils/helpers'
import Loading from '../../components/common/Loading'
import { toast } from 'react-toastify'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Chờ xử lý', color: C.warning, bg: '#FEF3C7' },
  approved: { label: 'Đã xóa',    color: C.success, bg: '#DCFCE7' },
  rejected: { label: 'Từ chối',   color: C.error,   bg: '#FEE2E2' },
}

const PROD_STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Chờ duyệt', color: C.warning, bg: '#FEF3C7' },
  rejected: { label: 'Từ chối',   color: C.error,   bg: '#FEE2E2' },
}

type MainTab = 'deletion' | 'pending' | 'rejected'

const DeletionApprovalPage: React.FC = () => {
  const [mainTab, setMainTab] = useState<MainTab>('pending')

  // Deletion requests
  const [requests, setRequests] = useState<any[]>([])
  const [loadingDel, setLoadingDel] = useState(false)

  // Products pending/rejected
  const [products, setProducts] = useState<any[]>([])
  const [loadingProd, setLoadingProd] = useState(false)

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ id: number; shop_id: number; reason: string; flagCount: number } | null>(null)

  // Load deletion requests
  const loadDeletion = () => {
    setLoadingDel(true)
    adminService.getDeletionRequests()
      .then(r => { const d = r.data?.requests ?? r.data; if (Array.isArray(d)) setRequests(d) })
      .catch(() => setRequests([]))
      .finally(() => setLoadingDel(false))
  }

  // Load products by status
  const loadProducts = (status: string) => {
    setLoadingProd(true)
    adminService.getAllProducts(status)
      .then(r => setProducts(r.data?.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProd(false))
  }

  useEffect(() => {
    if (mainTab === 'deletion') loadDeletion()
    else loadProducts(mainTab)
  }, [mainTab])

  // Deletion actions
  const handleDelApprove = (id: number) => {
    if (window.confirm('Xác nhận xóa sản phẩm này?'))
      setRequests(rs => rs.map(r => r.deletion_req_id === id ? { ...r, status: 'approved' } : r))
  }
  const handleDelReject = (id: number) => {
    setRequests(rs => rs.map(r => r.deletion_req_id === id ? { ...r, status: 'rejected' } : r))
  }

  // Product approve
  const handleApprove = async (id: number) => {
    try {
      await adminService.approveProduct(id)
      const prod = products.find(x => x.product_id === id)
      productApprovalStore.setApproved(id, prod?.product_name, prod?.shop_id)
      addNotificationFor('', 'shop', prod?.shop_id ?? 0, {
        title: '✅ Sản phẩm được duyệt — Sẵn sàng đăng bán!',
        message: `"${prod?.product_name ?? 'Sản phẩm'}" đã được admin duyệt. Vào mục Sản phẩm → tab Sẵn sàng bán để đăng lên sàn.`,
        type: 'product_approved',
        action_url: '/shop/products',
        related_entity_type: 'product',
        related_entity_id: id,
      })
      toast.success('✅ Đã duyệt sản phẩm')
      setProducts(p => p.filter(x => x.product_id !== id))
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Lỗi') }
  }

  // Product reject submit
  const handleRejectSubmit = async () => {
    if (!rejectModal || !rejectModal.reason.trim()) { toast.warning('Nhập lý do'); return }
    try {
      await adminService.rejectProduct(rejectModal.id, rejectModal.reason)
      productApprovalStore.setRejected(rejectModal.id)
      rejectionStore.save({
        product_id: rejectModal.id,
        rejected_at: new Date().toISOString(),
        reason: rejectModal.reason,
        violations: [],
      })
      shopFlagStore.addFlags(rejectModal.shop_id, rejectModal.flagCount, rejectModal.reason, rejectModal.id)
      toast.success(`Đã từ chối · +${rejectModal.flagCount} cờ vi phạm`)
      setProducts(p => p.filter(x => x.product_id !== rejectModal.id))
      setRejectModal(null)
    } catch { toast.error('Lỗi') }
  }

  const TABS: { key: MainTab; label: string; icon: string }[] = [
    { key: 'pending',  label: 'Chờ duyệt',        icon: '🕐' },
    { key: 'rejected', label: 'Sản phẩm từ chối', icon: '❌' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>📋 Duyệt & Xử lý sản phẩm</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Duyệt sản phẩm mới, xử lý từ chối và yêu cầu xóa</p>
      </div>

      {/* ── Pending / Rejected products ── */}
      {(mainTab === 'pending' || mainTab === 'rejected') && (
        <>
          {/* Stats cards = Tab switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {TABS.map(t => {
              const active = mainTab === t.key
              const st = PROD_STATUS_STYLE[t.key]
              return (
                <div key={t.key} className="card" onClick={() => setMainTab(t.key)} style={{
                  padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s',
                  borderLeft: `3px solid ${active ? st.color : '#E2E8F0'}`,
                  outline: active ? `2px solid ${st.color}30` : 'none',
                  outlineOffset: 0,
                  opacity: active ? 1 : 0.65,
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: active ? st.color : C.gray, marginBottom: 4 }}>
                    {t.icon} {t.label}
                  </p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: active ? st.color : C.gray }}>
                    {active ? products.length : '—'}
                  </p>
                  {active && (
                    <p style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                      {new Set(products.map(p => p.shop_id)).size} shop liên quan
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {loadingProd ? <Loading /> : products.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>
              Không có sản phẩm nào {mainTab === 'pending' ? 'chờ duyệt' : 'bị từ chối'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {products.map(p => {
                const img = p.image_urls?.[0]
                const st  = PROD_STATUS_STYLE[p.status] ?? PROD_STATUS_STYLE.pending
                return (
                  <div key={p.product_id} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative', width: '100%', paddingTop: '55%', background: '#F1F5F9', overflow: 'hidden' }}>
                      {img
                        ? <img src={getImageUrl(img)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, color: '#CBD5E1' }}>🛍️</div>}
                      <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.navy, lineHeight: 1.3 }}>{p.product_name}</div>
                      <div style={{ fontSize: 12, color: C.gray }}>Shop #{p.shop_id}</div>
                      <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
                        {mainTab === 'pending' && (
                          <button onClick={() => handleApprove(p.product_id)}
                            style={{ flex: 1, padding: '7px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            ✅ Duyệt
                          </button>
                        )}
                        <button onClick={() => setRejectModal({ id: p.product_id, shop_id: p.shop_id, reason: '', flagCount: 1 })}
                          style={{ flex: 1, padding: '7px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          {mainTab === 'rejected' ? '🔄 Cập nhật từ chối' : '❌ Từ chối'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Deletion requests ── */}
      {mainTab === 'deletion' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {Object.entries(STATUS_STYLE).map(([k, v]) => (
              <div key={k} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${v.color}` }}>
                <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{v.label}</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: v.color }}>{requests.filter(r => r.status === k).length}</p>
              </div>
            ))}
          </div>

          {loadingDel ? <Loading /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {requests.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>Không có yêu cầu nào</div>
              ) : requests.map(r => {
                const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending
                return (
                  <div key={r.deletion_req_id} className="card" style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                        <p style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{r.product_name}</p>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                      <p style={{ fontSize: 13, color: C.gray, marginBottom: 4 }}>
                        Sản phẩm <strong>#{r.product_id}</strong> · Shop <strong>#{r.shop_id}</strong>
                      </p>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.error, background: '#FEE2E2', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>Lý do</span>
                        <p style={{ fontSize: 13, color: C.navy }}>{r.reason}</p>
                      </div>
                      <p style={{ fontSize: 11, color: C.gray, marginTop: 6 }}>🕐 {r.created_at}</p>
                    </div>
                    {r.status === 'pending' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 20, flexShrink: 0 }}>
                        <button onClick={() => handleDelApprove(r.deletion_req_id)}
                          style={{ padding: '8px 18px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                          🗑️ Xóa SP
                        </button>
                        <button onClick={() => handleDelReject(r.deletion_req_id)}
                          style={{ padding: '8px 18px', background: C.tint, color: C.gray, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                          Từ chối
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Reject modal */}
      {rejectModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setRejectModal(null)}>
          <div className="card" style={{ width: 500, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>❌ Lý do từ chối</h2>
              <button onClick={() => setRejectModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', marginBottom: 8 }}>🚩 Số cờ vi phạm cho shop này:</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setRejectModal(r => r ? { ...r, flagCount: n } : r)}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                      background: rejectModal.flagCount === n ? (n <= 2 ? '#FEF3C7' : n <= 4 ? '#FFEDD5' : '#FEE2E2') : '#F1F5F9',
                      color: rejectModal.flagCount === n ? (n <= 2 ? '#D97706' : n <= 4 ? '#EA580C' : '#DC2626') : '#64748B',
                      outline: rejectModal.flagCount === n ? `2px solid ${n <= 2 ? '#F59E0B' : n <= 4 ? '#F97316' : '#EF4444'}` : 'none',
                    }}>
                    {'🚩'.repeat(n)}
                    <div style={{ fontSize: 10, marginTop: 2 }}>{n} cờ</div>
                  </button>
                ))}
              </div>
            </div>
            <textarea className="input" rows={5} placeholder="Nhập lý do từ chối..." value={rejectModal.reason}
              onChange={e => setRejectModal(r => r ? { ...r, reason: e.target.value } : r)}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectModal(null)}
                style={{ padding: '9px 20px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer', color: C.gray }}>
                Hủy
              </button>
              <button onClick={handleRejectSubmit}
                style={{ padding: '9px 24px', background: C.error, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                Từ chối & Gửi shop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeletionApprovalPage
