import { FlyToInterpolator, WebMercatorViewport, type Layer, type MapViewState, type PickingInfo } from '@deck.gl/core'
import { H3HexagonLayer } from '@deck.gl/geo-layers'
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import DeckGL from '@deck.gl/react'
import { cellToLatLng } from 'h3-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Map } from 'react-map-gl/maplibre'
import { useHex, useLineProfiles, useMeta, useScales, useStops, useTransfers } from '../api/hooks'
import type { Flow, HexCell, Interchange, LineProfile, StopPoint } from '../api/types'
import { hourLabel, int, pct } from '../lib/format'
import {
  hexDemandColor, loadColor, ratioColor, rgba, stopDemandColor, stopRadius, waitColor, type RGBA,
} from '../lib/scales'
import { applyWhatIf } from '../lib/whatif'
import { HOME, useApp } from '../state'
import Legend from './Legend'
import OperatorCard from './OperatorCard'

// Free vector basemap, no API key. Swap for any MapLibre style URL.
const BASEMAP = (import.meta.env.VITE_BASEMAP_URL as string | undefined) ?? 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

const INITIAL: MapViewState = { longitude: HOME.lon, latitude: HOME.lat, zoom: HOME.zoom, pitch: 0, bearing: 0 }
const WHITE: RGBA = [252, 252, 251, 255]
const INK: RGBA = [20, 20, 19, 255]
const GREY: RGBA = [150, 149, 144, 220]

type HexRow = HexCell & { color: string }
const pos = (d: { lon: number; lat: number }): [number, number] => [d.lon, d.lat]

/** A gentle 2D curve between two points (quadratic Bézier), so flows read as arcs on a flat map. */
function curve(a: [number, number], b: [number, number], bend = 0.22, n = 24): [number, number][] {
  const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const c: [number, number] = [mx - dy * bend, my + dx * bend]
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const u = 1 - t
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
  })
}
type FlowRow = Flow & { path: [number, number][] }

export default function MapView() {
  const { data: meta } = useMeta()
  const { mode, layer, hour, selStop, line, whatif, xsel, fly, pickStop, set } = useApp()
  const [viewState, setViewState] = useState<MapViewState>(INITIAL)

  const showHex = (mode === 'demand' || mode === 'anomalies') && layer === 'hex'
  const hexQ = useHex()
  const stopsQ = useStops()
  const transfersQ = useTransfers()
  const lineIds = useMemo(() => meta?.lines.map((l) => l.line_id) ?? [], [meta])
  const lineQs = useLineProfiles(lineIds)
  const profilesKey = lineQs.map((q) => q.dataUpdatedAt).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const profiles = useMemo(() => lineQs.map((q) => q.data).filter(Boolean) as LineProfile[], [profilesKey])
  const activeLine = line ?? lineIds[0] ?? null

  // Animate to a target when a panel asks (e.g. clicking an alert).
  useEffect(() => {
    if (!fly) return
    // eslint-disable-next-line react/set-state-in-effect -- syncing with a store-driven camera request
    setViewState((v) => ({
      ...v, longitude: fly.lon, latitude: fly.lat, zoom: fly.zoom ?? Math.max(v.zoom, 12),
      transitionDuration: 900, transitionInterpolator: new FlyToInterpolator(),
    }))
  }, [fly])

  // Entering the load view: frame all lines with capacity data.
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (mode !== 'load' || !profiles.length || !wrapRef.current) return
    const pts = profiles.flatMap((p) => p.shape)
    const lons = pts.map((p) => p[0])
    const lats = pts.map((p) => p[1])
    const { clientWidth: width, clientHeight: height } = wrapRef.current
    const fit = new WebMercatorViewport({ width, height }).fitBounds(
      [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 110 })
    // eslint-disable-next-line react/set-state-in-effect -- camera follows the view mode
    setViewState((v) => ({
      ...v, longitude: fit.longitude, latitude: fit.latitude, zoom: Math.min(fit.zoom, 13),
      transitionDuration: 800, transitionInterpolator: new FlyToInterpolator(),
    }))
  }, [mode, profiles])

  const scales = useScales()
  const stops = useMemo(() => stopsQ.data?.stops ?? [], [stopsQ.data])
  const stopById = useMemo(() => Object.fromEntries(stops.map((s) => [s.stop_id, s])), [stops])

  const layers = useMemo(() => {
    if (!scales) return []
    const out: Layer[] = []
    const stopMax = scales.stop_boardings_max

    // ---- hexagons (demand or observed/expected)
    if (showHex && hexQ.data) {
      const rows: HexRow[] = []
      for (const c of hexQ.data.cells) {
        if (mode === 'demand') {
          const color = hexDemandColor(c.boardings, scales.hex_boardings_max)
          if (color) rows.push({ ...c, color })
        } else if (c.expected / scales.hex_boardings_max >= 0.04) {
          rows.push({ ...c, color: ratioColor(c.ratio) })
        }
      }
      out.push(new H3HexagonLayer<HexRow>({
        id: 'hex', data: rows, pickable: true, extruded: false, stroked: true,
        getHexagon: (d) => d.h3, getFillColor: (d) => rgba(d.color, 225),
        getLineColor: [252, 252, 251, 160], lineWidthUnits: 'pixels', getLineWidth: 1,
      }))
    }

    // ---- stops as proportional circles
    if (!showHex && (mode === 'demand' || mode === 'anomalies')) {
      const anomaly = mode === 'anomalies'
      out.push(new ScatterplotLayer<StopPoint>({
        id: 'stops', getPosition: pos, data: [...stops].sort((a, b) => b.boardings - a.boardings), pickable: true,
        radiusUnits: 'pixels', stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.5, getLineColor: WHITE,
        getRadius: (d) => stopRadius(anomaly ? d.expected : d.boardings, stopMax),
        getFillColor: (d) => rgba(anomaly ? ratioColor(d.ratio) : stopDemandColor(d.boardings, stopMax)),
        updateTriggers: { getRadius: [anomaly, stopMax], getFillColor: [anomaly, stopMax] },
      }))
    }

    // ---- line capacity: every line coloured by load factor at this hour
    if (mode === 'load') {
      const rows = profiles.map((p) => {
        const hours = p.line_id === activeLine ? applyWhatIf(p, whatif) : p.hours
        return { p, lf: hours.find((h) => h.hour === hour)?.load_factor ?? 0, sel: p.line_id === activeLine }
      }).sort((a, b) => Number(a.sel) - Number(b.sel))
      out.push(new ScatterplotLayer<StopPoint>({
        id: 'stop-dots', data: stops, getPosition: pos, pickable: true, radiusUnits: 'pixels', getRadius: 3, getFillColor: GREY,
      }))
      out.push(new PathLayer<(typeof rows)[number]>({
        id: 'lines', data: rows, pickable: true, widthUnits: 'pixels', capRounded: true, jointRounded: true,
        getPath: (d) => d.p.shape, getWidth: (d) => (d.sel ? 8 : 5),
        getColor: (d) => rgba(loadColor(d.lf), d.sel ? 255 : 170),
        updateTriggers: { getColor: [hour, whatif, activeLine], getWidth: [activeLine] },
      }))
      out.push(new TextLayer<(typeof rows)[number]>({
        id: 'line-labels', data: rows, characterSet: 'auto', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 700,
        getPosition: (d) => d.p.shape[d.p.shape.length - 1], getText: (d) => d.p.label, getSize: 13,
        getColor: INK, outlineWidth: 3, outlineColor: WHITE, fontSettings: { sdf: true },
        getPixelOffset: [12, 12],
      }))
    }

    // ---- transfers: journey arcs + interchange rings
    if (mode === 'transfers' && transfersQ.data) {
      const { flows, interchanges } = transfersQ.data
      const maxJ = Math.max(1, ...flows.map((f) => f.journeys))
      const maxT = Math.max(1, ...interchanges.map((i) => i.transfers))
      out.push(new ScatterplotLayer<StopPoint>({
        id: 'stop-dots', data: stops, getPosition: pos, pickable: true, radiusUnits: 'pixels', getRadius: 2.5, getFillColor: GREY,
      }))
      const rows: FlowRow[] = flows.map((f) => ({ ...f, path: curve([f.from_lon, f.from_lat], [f.to_lon, f.to_lat]) }))
      out.push(new PathLayer<FlowRow>({
        id: 'flows', data: rows, pickable: true, widthUnits: 'pixels', capRounded: true,
        getPath: (d) => d.path, getWidth: (d) => 1.5 + 7 * (d.journeys / maxJ), getColor: [57, 135, 229, 175],
      }))
      out.push(new ScatterplotLayer<Interchange>({
        id: 'rings', data: interchanges, getPosition: pos, pickable: true, radiusUnits: 'pixels', stroked: true,
        lineWidthUnits: 'pixels', getLineWidth: (d) => (d.stop_id === (xsel ?? interchanges[0]?.stop_id) ? 5.5 : 3.5), getFillColor: WHITE,
        getLineColor: (d) => rgba(waitColor(d.worst_median_wait_min)),
        getRadius: (d) => 6 + 12 * Math.sqrt(d.transfers / maxT),
        updateTriggers: { getLineWidth: [xsel] },
      }))
      out.push(new TextLayer<Interchange>({
        id: 'ring-labels', data: interchanges, characterSet: 'auto', fontFamily: 'IBM Plex Sans, sans-serif',
        fontWeight: 600, getPosition: pos, getText: (d) => d.name, getSize: 12,
        getColor: INK, outlineWidth: 3, outlineColor: WHITE, fontSettings: { sdf: true },
        getPixelOffset: [0, -22],
      }))
    }

    // ---- selected stop ring + label
    const sel = selStop ? stopById[selStop] : null
    if (sel && (mode === 'demand' || mode === 'anomalies')) {
      const r = showHex ? 10 : stopRadius(mode === 'anomalies' ? sel.expected : sel.boardings, stopMax) + 5
      out.push(new ScatterplotLayer<StopPoint>({
        id: 'selected', data: [sel], radiusUnits: 'pixels', filled: false, stroked: true, lineWidthUnits: 'pixels',
        getLineWidth: 2.5, getLineColor: INK, getRadius: r, getPosition: pos,
      }))
      out.push(new TextLayer<StopPoint>({
        id: 'selected-label', data: [sel], characterSet: 'auto', fontFamily: 'IBM Plex Sans, sans-serif',
        fontWeight: 700, getPosition: pos, getText: (d) => d.name, getSize: 13, getColor: INK,
        outlineWidth: 3, outlineColor: WHITE, fontSettings: { sdf: true }, getPixelOffset: [0, -r - 12],
      }))
    }
    return out
  }, [scales, showHex, hexQ.data, mode, stops, profiles, activeLine, whatif, hour, transfersQ.data, xsel, selStop, stopById])

  function nearestStop(lon: number, lat: number): StopPoint | null {
    let best: StopPoint | null = null
    let bd = Infinity
    for (const s of stops) {
      const d = (s.lon - lon) ** 2 + (s.lat - lat) ** 2
      if (d < bd) { bd = d; best = s }
    }
    return best
  }

  function onClick(info: PickingInfo) {
    const o = info.object
    if (!o) return
    switch (info.layer?.id) {
      case 'hex': {
        const [lat, lon] = cellToLatLng((o as HexCell).h3)
        const s = nearestStop(lon, lat)
        if (s) pickStop(s.stop_id)
        break
      }
      case 'stops':
      case 'stop-dots':
        pickStop((o as StopPoint).stop_id)
        break
      case 'lines':
        set({ line: (o as { p: LineProfile }).p.line_id, whatif: 0 })
        break
      case 'rings':
        set({ xsel: (o as Interchange).stop_id })
        break
    }
  }

  function getTooltip(info: PickingInfo) {
    const o = info.object
    if (!o) return null
    const t = (title: string, value: string) => ({
      html: `<div style="font-weight:600">${title}</div><div style="font-family:'IBM Plex Mono',monospace;color:#d9d8d2;margin-top:2px">${value}</div>`,
      style: { background: '#141413', color: '#fff', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', maxWidth: '240px', fontFamily: 'IBM Plex Sans, sans-serif' },
    })
    const at = hourLabel(hour)
    switch (info.layer?.id) {
      case 'hex': {
        const c = o as HexCell
        return mode === 'demand'
          ? t('Area (H3 cell)', `${int(c.boardings)} boardings at ${at}`)
          : t('Area (H3 cell)', `observed ${pct(c.ratio)} of expected`)
      }
      case 'stops':
      case 'stop-dots': {
        const s = o as StopPoint
        return mode === 'anomalies'
          ? t(s.name, `${int(s.boardings)} vs ${int(s.expected)} expected (${pct(s.ratio)})`)
          : t(s.name, `${int(s.boardings)} boardings at ${at}`)
      }
      case 'lines': {
        const d = o as { p: LineProfile; lf: number }
        return t(`Line ${d.p.label} · ${d.p.name}`, `load ${pct(d.lf)} of places at ${at}`)
      }
      case 'flows': {
        const f = o as Flow
        return t(`${f.from_name} → ${f.to_name}`, `${int(f.journeys)} journeys/day with a transfer`)
      }
      case 'rings': {
        const i = o as Interchange
        return t(i.name, `${int(i.transfers)} transfers/day · worst median wait ${i.worst_median_wait_min} min`)
      }
    }
    return null
  }

  const loading = hexQ.isFetching || stopsQ.isFetching || transfersQ.isFetching || lineQs.some((q) => q.isFetching)

  return (
    <div className="map-wrap" ref={wrapRef}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: v }) => setViewState(v as MapViewState)}
        controller={{ dragRotate: false }}
        layers={layers}
        getTooltip={getTooltip}
        onClick={onClick}
        getCursor={({ isHovering, isDragging }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab')}
      >
        <Map mapStyle={BASEMAP} />
      </DeckGL>
      {(mode === 'demand' || mode === 'anomalies') && <OperatorCard />}
      <Legend />
      <div className="map-tools">
        {loading && <span className="float-card map-status">Loading…</span>}
        <button type="button" className="float-card map-btn" onClick={() => useApp.getState().flyTo(HOME.lon, HOME.lat, HOME.zoom)}>
          Whole network
        </button>
      </div>
    </div>
  )
}
