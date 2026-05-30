import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { shopService } from '../../services/shopService'
import Modal from '../../components/common/Modal'
import Loading from '../../components/common/Loading'

const VoucherManagementPage: React.FC = () => {
  const [vouchers, setVouchers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ code: '', discount_type: 'percentage', discount_value: 10, min_order_value: '', max_uses: '' })

  const load = async () => {
    setLoading(true)
    try { const res = await shopService.getVouchers(); setVouchers(res.data.vouchers) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      await shopService.createVoucher({ ...form, discount_value: Number(form.discount_value), min_order_value: form.min_order_value ? Number(form.min_order_value) : undefined, max_uses: form.max_uses ? Number(form.max_uses) : undefined })
      toast.success('Đã tạo voucher'); setModalOpen(false); load()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Lỗi') }
  }

  if (loading) return <Loading />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontWeight: 700, fontSize: 18 }}>Voucher ({vouchers.length})</h2>
        <button onClick={() => setModalOpen(true)} className="btn btn-primary">+ Tạo voucher</button>
      </div>
      <div className="card table-wrapper">
        <table>
          <thead><tr><th>Mã</th><th>Loại</th><th>Giá trị</th><th>Đã dùng</th><th>Tối đa</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {vouchers.map(v => (
              <tr key={v.voucher_id}>
                <td><code style={{ background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{v.code}</code></td>
                <td>{v.discount_type === 'percentage' ? '%' : 'VND cố định'}</td>
                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{v.discount_value}{v.discount_type === 'percentage' ? '%' : '₫'}</td>
                <td>{v.current_uses}</td>
                <td>{v.max_uses || '∞'}</td>
                <td><span style={{ color: v.status === 'active' ? 'var(--success)' : 'var(--gray-400)', fontWeight: 600, fontSize: 13 }}>{v.status === 'active' ? '● Đang hoạt động' : '● Không hoạt động'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {vouchers.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Chưa có voucher nào</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tạo voucher">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label className="input-label">Mã voucher</label><input className="input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="VD: GIAM50" /></div>
          <div><label className="input-label">Loại giảm giá</label>
            <select className="input" value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}>
              <option value="percentage">% Phần trăm</option>
              <option value="fixed">Số tiền cố định</option>
            </select>
          </div>
          <div><label className="input-label">Giá trị ({form.discount_type === 'percentage' ? '%' : 'VND'})</label><input className="input" type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: Number(e.target.value) }))} /></div>
          <div><label className="input-label">Đơn tối thiểu (VND)</label><input className="input" type="number" placeholder="Không bắt buộc" value={form.min_order_value} onChange={e => setForm(f => ({ ...f, min_order_value: e.target.value }))} /></div>
          <div><label className="input-label">Số lần dùng tối đa</label><input className="input" type="number" placeholder="Không giới hạn" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => setModalOpen(false)} className="btn btn-ghost">Hủy</button>
            <button onClick={handleCreate} className="btn btn-primary">Tạo voucher</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default VoucherManagementPage
