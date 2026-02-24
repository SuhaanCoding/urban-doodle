# Urban Doodle

Draw a polygon on a satellite map, get AI-powered buildability analysis in seconds.

A working prototype of an "AI Data Layers" feature four feasibility layers that answer the question real estate developers actually care about: **"What can I build here?"**

---

![Draw a polygon](frontend/public/Selection.png)

![Analysis layers and building popup](frontend/public/Screenshot%202026-02-23%20213143.png)

![Detailed results — costs, buildable area, development value](frontend/public/Screenshot%202026-02-23%20213118.png)

## Features

- **Draw a polygon** on satellite imagery to define your site
- **4 analysis layers** rendered as interactive vector overlays:
  - Critical Root Zones (tree protection)
  - Impervious Cover Budget
  - Demolition / Existing Structures
  - Land Use (OSM)
- **ML segmentation** via SegFormer (ADE20K) fused with OpenStreetMap data
- **Hover tooltips** — address, road type, tree species appear instantly on mouseover
- **Click detail popups** — full breakdown with cost estimates, material, hazmat flags
- **Impervious cover budget** with color coded progress bar (green/yellow/red)
- **Per-building demolition estimates** factoring material, floors, and pre 1978 hazmat risk
- **Buildable area & development value** calculations
- **Settings panel** — adjust cost rates, impervious cap, surface type inclusions
- **Layer toggles** — show/hide layers instantly without re-analysis

## Tech Stack

| Frontend              | Backend          |
| --------------------- | ---------------- |
| React 19 + TypeScript | FastAPI + Python |
| Vite                  | NumPy + OpenCV   |
| Mapbox GL JS          | Shapely + Pillow |
| Turf.js               | httpx            |

**APIs:** Mapbox (satellite tiles), HuggingFace Inference API (SegFormer), Overpass (OpenStreetMap)

## Architecture

```
User draws polygon
        │
        ▼
   POST /analyze
        │
        ├── Fetch Mapbox satellite tiles
        ├── Run SegFormer segmentation (HuggingFace API)
        ├── Fetch OSM buildings, roads, trees (Overpass API)
        │
        ▼
   Merge masks + OSM features
   Clip to user polygon
   Compute costs & statistics
        │
        ▼
   GeoJSON features + metadata
        │
        ▼
   Frontend renders layers on map
   Sidebar shows stats & cost breakdowns
```

## The 4 Layers

| Layer               | Color   | Source                            | What It Detects                                     |
| ------------------- | ------- | --------------------------------- | --------------------------------------------------- |
| Critical Root Zones | Red     | SegFormer + OSM trees             | Tree canopy with protected root buffers             |
| Impervious Cover    | Grey    | OSM buildings + roads + SegFormer | Hard surfaces counting toward coverage cap          |
| Demolition          | Orange  | OSM buildings                     | Existing structures with itemized demo costs        |
| Land Use (OSM)      | Various | OSM                               | Zoning categories (commercial, residential, retail) |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Mapbox access token](https://account.mapbox.com/access-tokens/)
- [HuggingFace access token](https://huggingface.co/settings/tokens)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
MAPBOX_ACCESS_TOKEN=your_mapbox_token
HF_ACCESS_TOKEN=your_huggingface_token
```

Run:

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_API_URL=http://localhost:8000
```

Run:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), draw a polygon, and click **Analyze Zone**.

## Project Structure

```
urban-doodle/
├── backend/
│   ├── main.py                  # FastAPI app, /analyze endpoint
│   ├── models.py                # Pydantic response models
│   ├── requirements.txt
│   └── services/
│       ├── tile_fetcher.py      # Mapbox tile grid & fetching
│       ├── segmentation.py      # SegFormer inference via HuggingFace
│       ├── geo_converter.py     # Mask → GeoJSON, CRZ buffers, clipping
│       └── osm_fetcher.py       # OSM buildings, roads, trees via Overpass
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── types/               # TypeScript interfaces
│       ├── hooks/
│       │   └── useAnalysis.ts   # Analysis state, settings, API calls
│       └── components/
│           ├── Map.tsx           # Mapbox map, layers, hover/click popups
│           ├── AnalysisPanel.tsx # Tabbed sidebar (Results / Settings)
│           ├── SettingsPanel.tsx # Cost, threshold & surface config
│           ├── StatsCard.tsx     # Budget bars, cost breakdowns
│           └── LayerToggles.tsx  # Per-layer visibility switches
└── docs/                        # Screenshots
```

---

Built by Suhaan
