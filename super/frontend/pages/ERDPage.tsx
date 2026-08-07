/**
 * super/frontend/pages/ERDPage.tsx
 * ----------------------------------
 * Interactive ERD diagram — hiển thị toàn bộ bảng DB và FK relationships.
 * Giống SQL Server Diagram / MySQL Workbench EER.
 *
 * Features:
 *  - Draggable table cards
 *  - SVG FK lines giữa các bảng
 *  - Click table để highlight relationships
 *  - Search/filter tables
 *  - Auto-layout theo grid khi load lần đầu
 *  - Zoom in/out + pan
 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import superApi from '../superApi'

// ── Types ────────────────────────────────────────────────────────────────────

interface ColInfo {
  name: string
  type: string
  nullable: boolean
  pk: boolean
  fk: { to_table: string; to_col: string } | null
}

interface Relationship {
  from_table: string
  from_col: string
  to_table: string
  to_col: string
}

interface ERDData {
  tables: Record<string, ColInfo[]>
  relationships: Relationship[]
}

interface Pos { x: number; y: number }

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_WIDTH  = 220
const HEADER_H    = 36
const ROW_H       = 24
const CARD_GAP_X  = 60
const CARD_GAP_Y  = 50
const COLS_PER_ROW = 6

const C = {
  bg:        '#0a0a0f',
  card:      '#13131a',
  border:    '#1e1e2e',
  header:    '#1a1a2e',
  accent:    '#dc2626',
  accentDim: 'rgba(220,38,38,0.15)',
  text:      '#f1f5f9',
  dim:       '#64748b',
  pk:        '#facc15',
  fk:        '#60a5fa',
  line:      '#334155',
  lineHl:    '#dc2626',
  nullable:  '#475569',
}

// ── Helper: card height ───────────────────────────────────────────────────────

function cardHeight(cols: ColInfo[]) {
  return HEADER_H + cols.length * ROW_H + 8
}

// ── Helper: auto-layout positions ────────────────────────────────────────────

function autoLayout(names: string[], cols: Record<string, ColInfo[]>): Record<string, Pos> {
  const positions: Record<string, Pos> = {}
  names.forEach((name, i) => {
    const col = i % COLS_PER_ROW
    const row = Math.floor(i / COLS_PER_ROW)
    positions[name] = {
      x: 40 + col * (CARD_WIDTH + CARD_GAP_X),
      y: 40 + row * ((cols[name]?.length ?? 5) * ROW_H + HEADER_H + CARD_GAP_Y),
    }
  })
  return positions
}

// ── Sub-components ────────────────────────────────────────────────────────────

const TableCard: React.FC<{
  name: string
  cols: ColInfo[]
  pos: Pos
  selected: boolean
  highlighted: boolean
  dimmed: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onClick: () => void
}> = ({ name, cols, pos, selected, highlighted, dimmed, onMouseDown, onClick }) => {
  const h = cardHeight(cols)
  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      style={{ cursor: 'grab', userSelect: 'none', opacity: dimmed ? 0.25 : 1 }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {/* Shadow */}
      <rect
        x={3} y={3}
        width={CARD_WIDTH} height={h}
        rx={8} ry={8}
        fill="rgba(0,0,0,0.5)"
      />
      {/* Body */}
      <rect
        width={CARD_WIDTH} height={h}
        rx={8} ry={8}
        fill={C.card}
        stroke={selected ? C.accent : highlighted ? '#3b82f6' : C.border}
        strokeWidth={selected ? 2 : highlighted ? 1.5 : 1}
      />
      {/* Header */}
      <rect
        width={CARD_WIDTH} height={HEADER_H}
        rx={8} ry={8}
        fill={selected ? 'rgba(220,38,38,0.2)' : C.header}
      />
      <rect
        y={HEADER_H - 8}
        width={CARD_WIDTH} height={8}
        fill={selected ? 'rgba(220,38,38,0.2)' : C.header}
      />
      <text
        x={CARD_WIDTH / 2} y={HEADER_H / 2 + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={12} fontWeight={700}
        fill={selected ? '#fca5a5' : C.text}
        fontFamily="'Inter','Segoe UI',sans-serif"
      >
        {name}
      </text>

      {/* Rows */}
      {cols.map((col, i) => {
        const y = HEADER_H + 4 + i * ROW_H
        const icon = col.pk ? '🔑' : col.fk ? '🔗' : '·'
        const color = col.pk ? C.pk : col.fk ? C.fk : col.nullable ? C.nullable : C.dim
        return (
          <g key={col.name}>
            <text
              x={8} y={y + ROW_H / 2 + 1}
              dominantBaseline="middle"
              fontSize={10}
              fill={color}
              fontFamily="monospace"
            >
              {icon}
            </text>
            <text
              x={22} y={y + ROW_H / 2 + 1}
              dominantBaseline="middle"
              fontSize={11}
              fill={col.pk ? C.pk : C.text}
              fontFamily="'Inter','Segoe UI',sans-serif"
              fontWeight={col.pk ? 700 : 400}
            >
              {col.name}
            </text>
            <text
              x={CARD_WIDTH - 6} y={y + ROW_H / 2 + 1}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={9}
              fill={C.dim}
              fontFamily="monospace"
            >
              {col.type.length > 14 ? col.type.slice(0, 14) + '…' : col.type}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ── FK line helper ────────────────────────────────────────────────────────────

function fkLinePoints(
  fromPos: Pos, fromCols: ColInfo[], fromColName: string,
  toPos: Pos,   toCols: ColInfo[],   toColName: string,
): string {
  const fromRowIdx = fromCols.findIndex(c => c.name === fromColName)
  const toRowIdx   = toCols.findIndex(c => c.name === toColName)

  const fy = fromPos.y + HEADER_H + 4 + (fromRowIdx < 0 ? 0 : fromRowIdx) * ROW_H + ROW_H / 2
  const ty = toPos.y   + HEADER_H + 4 + (toRowIdx   < 0 ? 0 : toRowIdx)   * ROW_H + ROW_H / 2

  // Connect right or left edge depending on which side is closer
  const fromRight = fromPos.x + CARD_WIDTH
  const toRight   = toPos.x   + CARD_WIDTH

  let fx: number, tx: number
  if (fromPos.x > toPos.x + CARD_WIDTH) {
    // from is to the right of to
    fx = fromPos.x
    tx = toRight
  } else if (toPos.x > fromRight) {
    // to is to the right of from
    fx = fromRight
    tx = toPos.x
  } else {
    // overlapping x — use right sides
    fx = fromRight
    tx = toRight
  }

  const midX = (fx + tx) / 2
  return `M${fx},${fy} C${midX},${fy} ${midX},${ty} ${tx},${ty}`
}

// ── Main Component ────────────────────────────────────────────────────────────

const ERDPage: React.FC = () => {
  const [data,       setData]       = useState<ERDData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [positions,  setPositions]  = useState<Record<string, Pos>>({})
  const [selected,   setSelected]   = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [scale,      setScale]      = useState(0.75)
  const [pan,        setPan]        = useState<Pos>({ x: 0, y: 0 })

  // drag state
  const dragging    = useRef<{ table: string; startMouse: Pos; startPos: Pos } | null>(null)
  const panDragging = useRef<{ startMouse: Pos; startPan: Pos } | null>(null)
  const svgRef      = useRef<SVGSVGElement>(null)

  // ── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    superApi.get<ERDData>('/db-viewer/erd')
      .then(r => {
        setData(r.data)
        const names = Object.keys(r.data.tables)
        setPositions(autoLayout(names, r.data.tables))
      })
      .catch(e => setError(e?.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────

  const tableNames = data ? Object.keys(data.tables) : []

  const visibleTables = search
    ? tableNames.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    : tableNames

  const selectedRels = selected && data
    ? data.relationships.filter(r => r.from_table === selected || r.to_table === selected)
    : []
  const selectedRelSet = new Set(selectedRels.flatMap(r => [r.from_table, r.to_table]))

  // ── Drag: table card ──────────────────────────────────────────────────────

  const onCardMouseDown = useCallback((e: React.MouseEvent, table: string) => {
    e.stopPropagation()
    dragging.current = {
      table,
      startMouse: { x: e.clientX, y: e.clientY },
      startPos:   { ...positions[table] },
    }
  }, [positions])

  // ── Drag: pan canvas ──────────────────────────────────────────────────────

  const onSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    panDragging.current = {
      startMouse: { x: e.clientX, y: e.clientY },
      startPan:   { ...pan },
    }
  }, [pan])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) {
      const dx = (e.clientX - dragging.current.startMouse.x) / scale
      const dy = (e.clientY - dragging.current.startMouse.y) / scale
      setPositions(prev => ({
        ...prev,
        [dragging.current!.table]: {
          x: dragging.current!.startPos.x + dx,
          y: dragging.current!.startPos.y + dy,
        },
      }))
    } else if (panDragging.current) {
      const dx = e.clientX - panDragging.current.startMouse.x
      const dy = e.clientY - panDragging.current.startMouse.y
      setPan({
        x: panDragging.current.startPan.x + dx,
        y: panDragging.current.startPan.y + dy,
      })
    }
  }, [scale])

  const onMouseUp = useCallback(() => {
    dragging.current    = null
    panDragging.current = null
  }, [])

  // ── Wheel zoom ────────────────────────────────────────────────────────────

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale(s => Math.min(2, Math.max(0.2, s - e.deltaY * 0.001)))
  }, [])

  // ── Reset layout ─────────────────────────────────────────────────────────

  const resetLayout = () => {
    if (!data) return
    setPositions(autoLayout(Object.keys(data.tables), data.tables))
    setScale(0.75)
    setPan({ x: 0, y: 0 })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ color: C.dim, padding: 40, textAlign: 'center', fontSize: 14 }}>
      Đang tải schema…
    </div>
  )

  if (error) return (
    <div style={{ color: '#f87171', padding: 40, fontSize: 14 }}>
      Lỗi: {error}
    </div>
  )

  if (!data) return null

  const visibleSet = new Set(visibleTables)

  const defs = (
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill={C.line} />
      </marker>
      <marker id="arrow-hl" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill={C.lineHl} />
      </marker>
    </defs>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', gap: 0 }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
        background: '#13131a',
        borderBottom: '1px solid #1e1e2e',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 18 }}>🔗</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Sơ đồ ERD</span>
        <span style={{ fontSize: 11, color: C.dim, marginLeft: 4 }}>
          {tableNames.length} bảng · {data.relationships.length} quan hệ
        </span>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm bảng…"
          style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid #1e1e2e',
            background: '#0a0a0f', color: C.text, fontSize: 12, width: 180,
            outline: 'none',
          }}
        />

        {/* Zoom */}
        <button onClick={() => setScale(s => Math.min(2, s + 0.1))} style={btnStyle}>＋</button>
        <span style={{ fontSize: 11, color: C.dim, minWidth: 36, textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} style={btnStyle}>－</button>
        <button onClick={resetLayout} style={{ ...btnStyle, fontSize: 11 }}>↺ Reset</button>

        {selected && (
          <button
            onClick={() => setSelected(null)}
            style={{ ...btnStyle, background: C.accentDim, color: '#fca5a5', borderColor: C.accent }}
          >
            ✕ {selected}
          </button>
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{
        display: 'flex', gap: 16, padding: '6px 16px',
        background: '#0d0d14', borderBottom: '1px solid #1a1a2a',
        flexShrink: 0,
      }}>
        {[
          { color: C.pk,  label: '🔑 Primary Key' },
          { color: C.fk,  label: '🔗 Foreign Key' },
          { color: C.dim, label: '· Column' },
        ].map(l => (
          <span key={l.label} style={{ fontSize: 11, color: l.color }}>{l.label}</span>
        ))}
        <span style={{ fontSize: 11, color: C.dim, marginLeft: 8 }}>
          Kéo bảng để di chuyển · Cuộn để zoom · Kéo nền để pan · Click bảng để xem quan hệ
        </span>
      </div>

      {/* ── Canvas ── */}
      <div style={{ flex: 1, overflow: 'hidden', background: C.bg, position: 'relative' }}>
        {/* dot grid */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <defs>
            <pattern id="grid" width={20 * scale} height={20 * scale} patternUnits="userSpaceOnUse"
              x={pan.x % (20 * scale)} y={pan.y % (20 * scale)}>
              <circle cx={1} cy={1} r={0.8} fill="#1e1e2e" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <svg
          ref={svgRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          onMouseDown={onSvgMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        >
          {defs}
          <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>

            {/* ── FK Lines ── */}
            {data.relationships.map((rel, i) => {
              if (!visibleSet.has(rel.from_table) || !visibleSet.has(rel.to_table)) return null
              const fromPos = positions[rel.from_table]
              const toPos   = positions[rel.to_table]
              if (!fromPos || !toPos) return null

              const isHL = selected === rel.from_table || selected === rel.to_table
              const isHidden = selected && !isHL

              return (
                <path
                  key={i}
                  d={fkLinePoints(
                    fromPos, data.tables[rel.from_table], rel.from_col,
                    toPos,   data.tables[rel.to_table],   rel.to_col,
                  )}
                  fill="none"
                  stroke={isHL ? C.lineHl : C.line}
                  strokeWidth={isHL ? 2 : 1}
                  strokeOpacity={isHidden ? 0.06 : isHL ? 1 : 0.5}
                  markerEnd={isHL ? 'url(#arrow-hl)' : 'url(#arrow)'}
                  style={{ transition: 'opacity 0.2s' }}
                />
              )
            })}

            {/* ── Table Cards ── */}
            {tableNames.map(name => {
              if (!visibleSet.has(name)) return null
              const pos  = positions[name]
              if (!pos) return null
              const cols = data.tables[name] ?? []
              const isDimmed = !!selected && !selectedRelSet.has(name)
              return (
                <TableCard
                  key={name}
                  name={name}
                  cols={cols}
                  pos={pos}
                  selected={selected === name}
                  highlighted={selectedRelSet.has(name) && selected !== name}
                  dimmed={isDimmed}
                  onMouseDown={e => onCardMouseDown(e, name)}
                  onClick={() => setSelected(s => s === name ? null : name)}
                />
              )
            })}
          </g>
        </svg>
      </div>

      {/* ── Selected table info panel ── */}
      {selected && (
        <div style={{
          position: 'absolute', bottom: 24, right: 24,
          background: '#13131a',
          border: `1px solid ${C.accent}`,
          borderRadius: 10,
          padding: '14px 18px',
          minWidth: 280,
          maxHeight: 320,
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#fca5a5', marginBottom: 10 }}>
            📋 {selected}
          </div>
          {selectedRels.length === 0 ? (
            <div style={{ color: C.dim, fontSize: 12 }}>Không có FK relationship</div>
          ) : (
            selectedRels.map((r, i) => (
              <div key={i} style={{ fontSize: 11, color: C.text, marginBottom: 6, lineHeight: 1.6 }}>
                <span style={{ color: r.from_table === selected ? '#fca5a5' : C.fk }}>
                  {r.from_table}.{r.from_col}
                </span>
                <span style={{ color: C.dim }}> → </span>
                <span style={{ color: r.to_table === selected ? '#fca5a5' : C.fk }}>
                  {r.to_table}.{r.to_col}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '5px 10px',
  background: 'transparent',
  border: '1px solid #1e1e2e',
  borderRadius: 6,
  color: '#94a3b8',
  fontSize: 13,
  cursor: 'pointer',
}

export default ERDPage
