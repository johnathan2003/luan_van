/**
 * super/frontend/pages/DBViewerPage.tsx
 * ----------------------------------------
 * MySQL Workbench-like database viewer cho superadmin.
 * Tabs: Schema | Data | SQL Console
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import superApi from '../superApi'

// ── Types ─────────────────────────────────────────────────────────────────────
interface TableMeta { table_name: string; column_count: number; row_count: number }
interface ColSchema {
  name: string; type: string; nullable: boolean; default: string | null
  primary_key: boolean; foreign_key: { referred_table: string; referred_column: string } | null
}
interface DataResult {
  columns: string[]; rows: Record<string, any>[]; total: number
  page: number; pages: number; limit: number
}

// ── Palette (dark MySQL-like) ──────────────────────────────────────────────────
const C = {
  bg:        '#1a1b26',
  sidebar:   '#13131f',
  panel:     '#1e1f2e',
  header:    '#16172a',
  border:    '#2a2b3d',
  accent:    '#7c3aed',
  accentLt:  'rgba(124,58,237,0.15)',
  pk:        '#f59e0b',
  fk:        '#60a5fa',
  red:       '#ef4444',
  green:     '#22c55e',
  gray:      '#64748b',
  text:      '#e2e8f0',
  textDim:   '#94a3b8',
  rowHover:  'rgba(124,58,237,0.07)',
  rowAlt:    'rgba(255,255,255,0.02)',
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','Consolas',monospace" }

// ── Small components ──────────────────────────────────────────────────────────
const Badge: React.FC<{ label: string; color: string; bg: string }> = ({ label, color, bg }) => (
  <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 4, padding: '1px 5px', ...mono }}>
    {label}
  </span>
)

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: C.textDim }}>
    <span style={{ fontSize: 13 }}>⏳ Đang tải...</span>
  </div>
)

// ── Main component ─────────────────────────────────────────────────────────────
const DBViewerPage: React.FC = () => {
  const [tables, setTables]         = useState<TableMeta[]>([])
  const [tableSearch, setTableSearch] = useState('')
  const [selected, setSelected]     = useState<string | null>(null)
  const [schema, setSchema]         = useState<ColSchema[]>([])
  const [data, setData]             = useState<DataResult | null>(null)
  const [tab, setTab]               = useState<'schema' | 'data' | 'sql'>('schema')
  const [loading, setLoading]       = useState(false)
  const [page, setPage]             = useState(1)
  const [sortCol, setSortCol]       = useState<string | null>(null)
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')
  const [searchCol, setSearchCol]   = useState('')
  const [searchVal, setSearchVal]   = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sql, setSql]               = useState('SELECT *\nFROM users\nLIMIT 20;')
  const [sqlResult, setSqlResult]   = useState<{ columns: string[]; rows: Record<string, any>[]; total: number; error?: string } | null>(null)
  const [sqlLoading, setSqlLoading] = useState(false)
  const sqlRef = useRef<HTMLTextAreaElement>(null)

  // Load table list
  useEffect(() => {
    superApi.get('/db-viewer/tables')
      .then(r => setTables(r.data.tables))
      .catch(() => {})
  }, [])

  // Load schema when table selected
  const loadSchema = useCallback((t: string) => {
    setLoading(true)
    superApi.get(`/db-viewer/tables/${t}/schema`)
      .then(r => setSchema(r.data.columns))
      .finally(() => setLoading(false))
  }, [])

  // Load data
  const loadData = useCallback((t: string, pg = 1) => {
    setLoading(true)
    const params: Record<string, any> = { page: pg, limit: 50 }
    if (sortCol)   { params.sort_col = sortCol; params.sort_dir = sortDir }
    if (searchCol && searchVal) { params.search_col = searchCol; params.search_val = searchVal }
    superApi.get(`/db-viewer/tables/${t}/data`, { params })
      .then(r => { setData(r.data); setPage(pg) })
      .finally(() => setLoading(false))
  }, [sortCol, sortDir, searchCol, searchVal])

  const selectTable = (t: string) => {
    setSelected(t)
    setTab('schema')
    setSortCol(null); setSortDir('asc'); setSearchCol(''); setSearchVal(''); setSearchInput('')
    loadSchema(t)
  }

  useEffect(() => {
    if (selected && tab === 'data') loadData(selected, 1)
  }, [selected, tab, sortCol, sortDir, searchCol, searchVal, loadData])

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const execSql = async () => {
    setSqlLoading(true)
    setSqlResult(null)
    try {
      const r = await superApi.post('/db-viewer/exec', { sql })
      setSqlResult(r.data)
    } catch (e: any) {
      setSqlResult({ columns: [], rows: [], total: 0, error: e.response?.data?.detail || String(e) })
    } finally {
      setSqlLoading(false)
    }
  }

  const filteredTables = tables.filter(t =>
    t.table_name.toLowerCase().includes(tableSearch.toLowerCase())
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg, color: C.text, ...mono }}>

      {/* ── Sidebar: table list ── */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: C.sidebar, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 12px 8px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 8, letterSpacing: 1 }}>
            🗄️ DATABASE TABLES
          </div>
          <input
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
            placeholder="Tìm bảng..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0d0e1a', border: `1px solid ${C.border}`,
              borderRadius: 5, padding: '5px 8px', color: C.text,
              fontSize: 12, outline: 'none', ...mono,
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredTables.map(t => (
            <button
              key={t.table_name}
              onClick={() => selectTable(t.table_name)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', border: 'none', cursor: 'pointer',
                background: selected === t.table_name ? C.accentLt : 'transparent',
                borderLeft: selected === t.table_name ? `3px solid ${C.accent}` : '3px solid transparent',
                color: selected === t.table_name ? C.text : C.textDim,
                fontSize: 12, lineHeight: 1.5, ...mono,
                transition: 'all 0.1s',
              }}
            >
              <div style={{ fontWeight: selected === t.table_name ? 700 : 400 }}>
                📋 {t.table_name}
              </div>
              <div style={{ fontSize: 10, color: C.gray, marginTop: 1 }}>
                {t.column_count} cols · {t.row_count < 0 ? '?' : t.row_count.toLocaleString()} rows
              </div>
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.gray }}>
          {filteredTables.length} / {tables.length} bảng
        </div>
      </aside>

      {/* ── Main panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Tab bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          background: C.header, borderBottom: `1px solid ${C.border}`,
          padding: '0 16px',
        }}>
          {selected && (
            <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginRight: 20, paddingTop: 12, paddingBottom: 12 }}>
              {selected}
            </span>
          )}
          {(['schema', 'data', 'sql'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '11px 18px', border: 'none', cursor: 'pointer',
                background: 'transparent',
                borderBottom: tab === t ? `2px solid ${C.accent}` : '2px solid transparent',
                color: tab === t ? C.text : C.gray,
                fontSize: 12, fontWeight: tab === t ? 700 : 400, ...mono,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}
            >
              {t === 'schema' ? '📐 Schema' : t === 'data' ? '📊 Data' : '🔍 SQL Console'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>

          {/* ── Schema Tab ── */}
          {tab === 'schema' && (
            <div style={{ padding: 20 }}>
              {!selected ? (
                <div style={{ color: C.gray, textAlign: 'center', marginTop: 60, fontSize: 13 }}>
                  ← Chọn bảng để xem schema
                </div>
              ) : loading ? <Spinner /> : (
                <>
                  <div style={{ fontSize: 11, color: C.gray, marginBottom: 12 }}>
                    {schema.length} cột · table: <span style={{ color: C.accent }}>{selected}</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.header }}>
                        {['#', 'Tên cột', 'Kiểu dữ liệu', 'Nullable', 'Default', 'Key', 'Tham chiếu'].map(h => (
                          <th key={h} style={{
                            padding: '8px 12px', textAlign: 'left',
                            color: C.gray, fontWeight: 600, fontSize: 11,
                            borderBottom: `1px solid ${C.border}`, letterSpacing: 0.5,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schema.map((col, i) => (
                        <tr key={col.name} style={{ background: i % 2 === 0 ? 'transparent' : C.rowAlt }}>
                          <td style={{ padding: '7px 12px', color: C.gray, fontSize: 11 }}>{i + 1}</td>
                          <td style={{ padding: '7px 12px', fontWeight: col.primary_key ? 700 : 400, color: col.primary_key ? C.pk : C.text }}>
                            {col.name}
                          </td>
                          <td style={{ padding: '7px 12px', color: '#a78bfa' }}>{col.type}</td>
                          <td style={{ padding: '7px 12px' }}>
                            <Badge
                              label={col.nullable ? 'YES' : 'NO'}
                              color={col.nullable ? C.green : C.red}
                              bg={col.nullable ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}
                            />
                          </td>
                          <td style={{ padding: '7px 12px', color: C.gray, fontSize: 11 }}>
                            {col.default ?? <span style={{ color: C.border }}>NULL</span>}
                          </td>
                          <td style={{ padding: '7px 12px' }}>
                            {col.primary_key && <Badge label="PK" color={C.pk} bg="rgba(245,158,11,0.15)" />}
                            {col.foreign_key && <Badge label="FK" color={C.fk} bg="rgba(96,165,250,0.1)" />}
                          </td>
                          <td style={{ padding: '7px 12px', fontSize: 11, color: C.fk }}>
                            {col.foreign_key
                              ? `${col.foreign_key.referred_table}.${col.foreign_key.referred_column}`
                              : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {/* ── Data Tab ── */}
          {tab === 'data' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {!selected ? (
                <div style={{ color: C.gray, textAlign: 'center', marginTop: 60, fontSize: 13, padding: 20 }}>
                  ← Chọn bảng để xem dữ liệu
                </div>
              ) : (
                <>
                  {/* Toolbar */}
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
                    background: C.panel, flexWrap: 'wrap',
                  }}>
                    <select
                      value={searchCol}
                      onChange={e => setSearchCol(e.target.value)}
                      style={{ ...inputStyle, width: 160 }}
                    >
                      <option value="">— Cột tìm kiếm —</option>
                      {data?.columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      value={searchInput}
                      onChange={e => setSearchInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { setSearchVal(searchInput); setPage(1) } }}
                      placeholder="Giá trị cần tìm (Enter)"
                      style={{ ...inputStyle, width: 200 }}
                    />
                    <button onClick={() => { setSearchVal(searchInput); setPage(1) }} style={btnAccent}>🔍</button>
                    <button onClick={() => { setSearchCol(''); setSearchVal(''); setSearchInput(''); setSortCol(null) }} style={btnGhost}>✕ Reset</button>
                    {data && (
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: C.gray }}>
                        {data.total.toLocaleString()} hàng · trang {data.page}/{data.pages}
                      </span>
                    )}
                  </div>

                  {loading ? <Spinner /> : data ? (
                    <>
                      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
                        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr style={{ background: C.header }}>
                              {data.columns.map(col => (
                                <th
                                  key={col}
                                  onClick={() => toggleSort(col)}
                                  style={{
                                    padding: '8px 12px', textAlign: 'left', whiteSpace: 'nowrap',
                                    color: sortCol === col ? C.accent : C.gray,
                                    fontWeight: 600, fontSize: 11, cursor: 'pointer',
                                    borderBottom: `1px solid ${C.border}`,
                                    borderRight: `1px solid ${C.border}`,
                                    userSelect: 'none',
                                  }}
                                >
                                  {col} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.rows.map((row, ri) => (
                              <tr
                                key={ri}
                                style={{ background: ri % 2 === 0 ? 'transparent' : C.rowAlt }}
                                onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                                onMouseLeave={e => (e.currentTarget.style.background = ri % 2 === 0 ? 'transparent' : C.rowAlt)}
                              >
                                {data.columns.map(col => (
                                  <td
                                    key={col}
                                    title={String(row[col] ?? '')}
                                    style={{
                                      padding: '6px 12px', borderBottom: `1px solid ${C.border}`,
                                      borderRight: `1px solid rgba(42,43,61,0.5)`,
                                      maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                      color: row[col] === null ? C.gray : C.text,
                                      fontStyle: row[col] === null ? 'italic' : 'normal',
                                    }}
                                  >
                                    {row[col] === null ? 'NULL' : String(row[col])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div style={{
                        display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
                        padding: '10px 16px', borderTop: `1px solid ${C.border}`, background: C.panel,
                      }}>
                        <button onClick={() => loadData(selected, 1)}         disabled={page <= 1}           style={btnPager}>«</button>
                        <button onClick={() => loadData(selected, page - 1)}  disabled={page <= 1}           style={btnPager}>‹</button>
                        {Array.from({ length: Math.min(data.pages, 7) }, (_, i) => {
                          const start = Math.max(1, Math.min(page - 3, data.pages - 6))
                          const p = start + i
                          return p <= data.pages ? (
                            <button key={p} onClick={() => loadData(selected, p)} style={{ ...btnPager, ...(p === page ? { background: C.accent, color: '#fff', borderColor: C.accent } : {}) }}>{p}</button>
                          ) : null
                        })}
                        <button onClick={() => loadData(selected, page + 1)}  disabled={page >= data.pages}  style={btnPager}>›</button>
                        <button onClick={() => loadData(selected, data.pages)} disabled={page >= data.pages}  style={btnPager}>»</button>
                      </div>
                    </>
                  ) : null}
                </>
              )}
            </div>
          )}

          {/* ── SQL Console Tab ── */}
          {tab === 'sql' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12 }}>
              <div style={{ fontSize: 11, color: C.gray }}>
                Chỉ cho phép câu lệnh <span style={{ color: C.green }}>SELECT</span> / <span style={{ color: C.green }}>WITH</span> — không thể ghi/xoá dữ liệu
              </div>
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={sqlRef}
                  value={sql}
                  onChange={e => setSql(e.target.value)}
                  onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); execSql() } }}
                  style={{
                    width: '100%', height: 140, boxSizing: 'border-box',
                    background: '#0d0e1a', border: `1px solid ${C.border}`,
                    borderRadius: 8, color: C.text, padding: '12px 14px',
                    resize: 'vertical', fontSize: 13, lineHeight: 1.7,
                    outline: 'none', ...mono,
                  }}
                  spellCheck={false}
                />
                <button
                  onClick={execSql}
                  disabled={sqlLoading}
                  style={{
                    position: 'absolute', bottom: 12, right: 12,
                    ...btnAccent, fontSize: 12,
                  }}
                >
                  {sqlLoading ? '⏳' : '▶ Chạy'} <span style={{ fontSize: 10, opacity: 0.7 }}>Ctrl+Enter</span>
                </button>
              </div>

              {/* SQL Result */}
              {sqlResult && (
                <div style={{ flex: 1, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  {sqlResult.error ? (
                    <div style={{ padding: 16, color: C.red, fontSize: 12, ...mono }}>
                      ❌ {sqlResult.error}
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: '8px 12px', background: C.header, fontSize: 11, color: C.gray, borderBottom: `1px solid ${C.border}` }}>
                        ✅ {sqlResult.total} hàng trả về
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: C.header }}>
                              {sqlResult.columns.map(c => (
                                <th key={c} style={{ padding: '7px 12px', textAlign: 'left', color: C.gray, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sqlResult.rows.map((row, ri) => (
                              <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : C.rowAlt }}>
                                {sqlResult.columns.map(col => (
                                  <td key={col} style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid rgba(42,43,61,0.5)`, whiteSpace: 'nowrap', color: row[col] === null ? C.gray : C.text, fontStyle: row[col] === null ? 'italic' : 'normal' }}>
                                    {row[col] === null ? 'NULL' : String(row[col])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Quick queries */}
              <div>
                <div style={{ fontSize: 10, color: C.gray, marginBottom: 6 }}>QUICK QUERIES</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    ['Tất cả users', 'SELECT user_id, email, full_name, status, created_at FROM users ORDER BY user_id LIMIT 50;'],
                    ['Đơn hàng gần nhất', 'SELECT order_id, order_number, user_id, shop_id, final_price, order_status, created_at FROM orders ORDER BY created_at DESC LIMIT 20;'],
                    ['Top sản phẩm bán chạy', 'SELECT product_id, product_name, price, sales_count, rating, status FROM products ORDER BY sales_count DESC LIMIT 20;'],
                    ['Ví shop', 'SELECT sw.wallet_id, s.shop_name, sw.balance, sw.reserved, sw.balance - sw.reserved AS available FROM shop_wallet sw JOIN shops s ON sw.shop_id = s.shop_id ORDER BY sw.balance DESC;'],
                    ['Kho hàng phân cấp', 'SELECT warehouse_id, name, tier, province, district, parent_warehouse_id, is_active FROM warehouses ORDER BY tier, warehouse_id;'],
                    ['Banner slots', 'SELECT slot_id, name, position, base_price, duration_days, is_active FROM banner_slots ORDER BY slot_id;'],
                    ['Roles & quyền', 'SELECT r.role_name, COUNT(rp.permission_id) AS perm_count FROM roles r LEFT JOIN role_permissions rp ON r.role_id = rp.role_id GROUP BY r.role_name ORDER BY r.role_name;'],
                  ].map(([label, query]) => (
                    <button
                      key={label}
                      onClick={() => { setSql(query); setTab('sql') }}
                      style={{
                        padding: '4px 10px', fontSize: 11, border: `1px solid ${C.border}`,
                        borderRadius: 5, background: 'transparent', color: C.textDim,
                        cursor: 'pointer', ...mono,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared micro-styles ────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: '#0d0e1a', border: `1px solid #2a2b3d`,
  borderRadius: 5, padding: '5px 9px', color: '#e2e8f0',
  fontSize: 12, outline: 'none', fontFamily: "'JetBrains Mono','Fira Code','Consolas',monospace",
}
const btnAccent: React.CSSProperties = {
  background: '#7c3aed', color: '#fff', border: 'none',
  borderRadius: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: "'JetBrains Mono','Fira Code','Consolas',monospace",
}
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: '#64748b', border: '1px solid #2a2b3d',
  borderRadius: 5, padding: '5px 10px', fontSize: 11,
  cursor: 'pointer', fontFamily: "'JetBrains Mono','Fira Code','Consolas',monospace",
}
const btnPager: React.CSSProperties = {
  background: 'transparent', color: '#94a3b8', border: '1px solid #2a2b3d',
  borderRadius: 4, padding: '3px 9px', fontSize: 12, cursor: 'pointer',
  fontFamily: "'JetBrains Mono','Fira Code','Consolas',monospace",
}

export default DBViewerPage
