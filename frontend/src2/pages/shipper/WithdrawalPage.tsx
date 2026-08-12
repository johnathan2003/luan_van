import React, { useEffect, useState } from 'react'
import { shipmentService } from '../../services/shipmentService'

const C = {
  amber: '#D97706', gold: '#F59E0B', light: '#FEF3C7', tint: '#FFFBEB',
  navy: '#1E3A8A', blue: '#1D4ED8', gray: '#64748B',
  success: '#16A34A', error: '#DC2626', warning: '#D97706',
}

// Danh sách ngân hàng — cấu hình tĩnh, không cần DB
const BANKS_LIST = [
  { value: 'Vietcombank', label: 'Vietcombank' },
  { value: 'Techcombank', label: 'Techcombank' },
  { value: 'MB Bank',     label: 'MB Bank' },
  { value: 'BIDV',        label: 'BIDV' },
  { value: 'ACB',         label: 'ACB' },
  { value: 'TPBank',      label: 'TPBank' },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '⏳ Đang xử lý', color: C.warning, bg: C.light   },
  completed: { label: '✓ Hoàn tất',    color: C.success, bg: '#DCFCE7' },
  rejected:  { label: '✗ Từ chối',     color: C.error,   bg: '#FEE2E2' },
}

const fmt = (n: number) => n.toLocaleString('vi-VN') + '₫'

const WithdrawalPage: React.FC = () => {
  const [balance, setBalance]     = useState(0)
  const [history, setHistory]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [amount, setAmount]       = useState('')
  const [bank, setBank]           = useState('')
  const [accNum, setAccNum]       = useState('')
  const [accName, setAccName]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]     = useState(false)
  const [errMsg, setErrMsg]       = useState('')

  const loadData = () => {
    setLoading(true)
    Promise.all([
      shipmentService.getMyBalance(),
      shipmentService.getMyWithdrawals({ limit: 50 }),
    ])
      .then(([balRes, wdRes]) => {
        setBalance(balRes.data?.balance ?? 0)
        const wds = wdRes.data?.withdrawals ?? wdRes.data
        if (Array.isArray(wds)) setHistory(wds)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleSubmit = async () => {
    setErrMsg('')
    const amt = parseInt(amount.replace(/\D/g, ''))
    if (!amt || amt < 50000) { setErrMsg('Số tiền tối thiểu là 50.000₫'); return }
    if (amt > balance)        { setErrMsg('Số dư không đủ'); return }
    if (!bank)                { setErrMsg('Vui lòng chọn ngân hàng'); return }
    if (!accNum || !accName)  { setErrMsg('Vui lòng điền thông tin tài khoản'); return }

    setSubmitting(true)
    try {
      await shipmentService.createWithdrawal({
        amount: amt,
        bank_name: bank,
        account_number: accNum,
        account_holder: accName,
      })
      setAmount(''); setBank(''); setAccNum(''); setAccName('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      loadData() // reload balance + history
    } catch (err: any) {
      setErrMsg(err?.response?.data?.detail ?? 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.amber, margin: 0 }}>🏦 Rút tiền</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 3 }}>Yêu cầu rút tiền về tài khoản ngân hàng</p>
      </div>

      {/* Balance card */}
      <div style={{ background: `linear-gradient(135deg, ${C.amber}, ${C.gold})`, borderRadius: 16, padding: '24px 28px', color: 'white' }}>
        <p style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 1 }}>Số dư khả dụng</p>
        <p style={{ fontSize: 38, fontWeight: 900, marginTop: 4 }}>
          {loading ? '...' : fmt(balance)}
        </p>
        <p style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>Rút tối thiểu 50.000₫ · Xử lý trong 1–2 giờ</p>
      </div>

      {success && (
        <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 12, padding: '14px 18px', color: C.success, fontWeight: 600, fontSize: 14 }}>
          ✅ Yêu cầu rút tiền đã được gửi! Hệ thống sẽ xử lý trong 1–2 giờ.
        </div>
      )}
      {errMsg && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '14px 18px', color: C.error, fontWeight: 600, fontSize: 14 }}>
          ⚠️ {errMsg}
        </div>
      )}

      {/* Form */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 18 }}>Yêu cầu rút tiền mới</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Amount */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 6 }}>Số tiền muốn rút *</label>
            <div style={{ position: 'relative' }}>
              <input
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/\D/g,'').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))}
                placeholder="VD: 500.000"
                style={{ width: '100%', padding: '11px 50px 11px 14px', border: `2px solid ${C.light}`, borderRadius: 10, fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: C.navy }}
              />
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.gray, fontWeight: 600 }}>₫</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {[100000, 200000, 500000, 1000000].map(v => (
                <button key={v} onClick={() => setAmount(v.toLocaleString('vi-VN').replace(/,/g,'.'))}
                  style={{ padding: '5px 12px', background: C.tint, border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.amber, cursor: 'pointer' }}>
                  {v >= 1000000 ? '1M' : (v / 1000) + 'K'}
                </button>
              ))}
            </div>
          </div>

          {/* Bank */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 6 }}>Ngân hàng *</label>
            <select value={bank} onChange={e => setBank(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', border: `2px solid ${C.light}`, borderRadius: 10, fontSize: 13, outline: 'none', color: C.navy }}>
              <option value="">-- Chọn ngân hàng --</option>
              {BANKS_LIST.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>

          {/* Account number */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 6 }}>Số tài khoản *</label>
            <input value={accNum} onChange={e => setAccNum(e.target.value)} placeholder="VD: 1234567890"
              style={{ width: '100%', padding: '11px 14px', border: `2px solid ${C.light}`, borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: C.navy }} />
          </div>

          {/* Account name */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 6 }}>Tên chủ tài khoản *</label>
            <input value={accName} onChange={e => setAccName(e.target.value)} placeholder="VD: NGUYEN VAN A (viết hoa, không dấu)"
              style={{ width: '100%', padding: '11px 14px', border: `2px solid ${C.light}`, borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: C.navy }} />
          </div>
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          style={{ marginTop: 20, width: '100%', padding: '13px', background: submitting ? '#9CA3AF' : C.amber, color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: submitting ? 'default' : 'pointer' }}>
          {submitting ? '⏳ Đang xử lý...' : '💸 Xác nhận rút tiền'}
        </button>
      </div>

      {/* History */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.tint}` }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: C.navy, margin: 0 }}>📋 Lịch sử rút tiền</h3>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.gray }}>Đang tải...</div>
        ) : history.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.gray }}>Chưa có lịch sử rút tiền</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {history.map((h: any) => {
              const meta = STATUS_META[h.status] ?? STATUS_META.pending
              const date = h.created_at ? String(h.created_at).slice(0, 10) : '—'
              const done = h.completed_at ? String(h.completed_at).slice(0, 10) : null
              return (
                <div key={h.wd_id} style={{ padding: '16px 20px', borderBottom: `1px solid ${C.tint}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 16, color: C.amber, margin: 0 }}>{fmt(h.amount)}</p>
                    <p style={{ fontSize: 12, color: C.gray, marginTop: 3 }}>
                      {h.bank_name} · ***{String(h.account_number).slice(-4)} · {date}
                    </p>
                    {done && <p style={{ fontSize: 11, color: C.success, marginTop: 2 }}>✓ Hoàn tất: {done}</p>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: meta.bg, color: meta.color }}>{meta.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default WithdrawalPage
