# pulso-web

React + Vite frontend for **Pulso** (Hack the City 2026, challenge #1). It reads the `pulso-api` FastAPI backend and draws everything from its responses. No numbers live in the frontend.

## Run it (API first, then the web app)

```bash
# terminal 1: the API
cd ../pulso-api
source .venv/bin/activate            # if you made one
uvicorn app.main:app --reload        # http://localhost:8000

# terminal 2: the web app
cd pulso-web
npm install
npm run dev                          # http://localhost:5173
```

API somewhere else (e.g. Render)? `cp .env.example .env.local` and set `VITE_API_URL`.

`npm run build` → static files in `dist/` (deploy to Netlify, Vercel, Render static site…).

## Libraries

| Need | Library |
|---|---|
| Base map (free, no key) | MapLibre GL v5 via `react-map-gl/maplibre`, CARTO Positron style |
| Data layers | deck.gl 9: `H3HexagonLayer`, `ScatterplotLayer`, `PathLayer`, `TextLayer` |
| Fetching + caching | TanStack Query (keeps the last result on screen while the slider moves; prefetches all 20 hours of the day) |
| Charts | Recharts |
| App state | Zustand |

## Where each API response lands

| Endpoint | Used by | What it drives |
|---|---|---|
| `GET /api/meta` | everywhere | day pills, hours, operator names + colours, segment tabs, line picker, **fixed colour-scale maxima**, mock badge |
| `GET /api/overview` | `OverviewPanel`, `TimeBar` | KPIs, operator share bar, busiest interchanges, alert CTA; `network_hourly` → pulse strip above the slider |
| `GET /api/hex` | `MapView` (Demand/Anomalies → Hexagons) | H3 cells coloured by boardings (Demand) or `ratio` (Anomalies) |
| `GET /api/stops` | `MapView` | proportional circles (Stops layer), grey click targets in other views, nearest stop for hex clicks |
| `GET /api/stops/{id}` | `StopPanel` | now vs expected, day chart, 7×20 week grid (click a cell = jump there), passenger mix, facilities, transfers, grouped operator stop ids |
| `GET /api/lines/{id}/profile` | `LinePanel`, `MapView` (Load) | every line coloured by load factor at the slider hour; chart of load vs places offered; what-if slider; most loaded line-hours |
| `GET /api/transfers` | `TransferPanel`, `MapView` (Transfers) | interchange rings (colour = worst median wait), curved flow lines, pair breakdown, fragile note |
| `GET /api/anomalies` | `AnomalyPanel` | week alert list; clicking one moves the day, hour, map camera and selected stop to it |

Types in `src/api/types.ts` mirror `pulso-api/app/schemas.py` one-to-one. If the backend contract changes, change them there and `npx tsc -b` lists every place that breaks.

## Behaviour worth knowing

- **Fixed colour scales.** Colours are normalised by `meta.scales`, never per hour, so 06:00 really looks quieter than 08:00. When a segment or operator filter is on, the maxima shrink by the filter's share of a reference weekday's peak (`useScales` in `src/api/hooks.ts`). The scale changes with the filter, never with the hour or day.
- **What-if is client-side.** `src/lib/whatif.ts` is exactly the formula in `API_CONTRACT.md`.
- **Clicking a hexagon** opens the nearest stop.
- **"Reviewed" on alerts** is in-memory only (resets on reload).
- The time-slider tour from the mockup is not ported.

## Layout

```
src/
  api/        client.ts (fetch + base URL), types.ts (contract), hooks.ts (one hook per endpoint)
  lib/        scales.ts (palettes/thresholds), format.ts, whatif.ts
  components/ TopBar, Toolbar, MapView, TimeBar, OperatorCard, Legend
  panels/     SidePanel router + Overview, Stop, Line, Anomaly, Transfer panels, charts.tsx
  state.ts    Zustand store: day, hour, filters, view mode, selection, camera requests
```
