# Damper Quote Pro

Industrial estimation & quotation web application designed for valve and damper manufacturing (Pune, India). Specialized for **Rack-and-Pinion Sliding-Flap Dampers with Electric Actuators** (reference size 3000 × 3000 × 450 mm).

---

## 1. Quick Start

### Option A: Local Development
```bash
# Terminal 1 - Backend (FastAPI + SQLite)
cd damper-quote-pro/backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend (React + Vite + Tailwind CSS)
cd damper-quote-pro/frontend
npm run dev
```
- Web Application: `http://localhost:5173`
- Swagger API Docs: `http://localhost:8000/docs`

### Option B: Docker (One Command)
```bash
cd damper-quote-pro
docker-compose up --build
```
- Web Application: `http://localhost:5173`

---

## 2. Seed Credentials & User Roles

All seeded accounts have the initial password `DamperQuote2026!`. First-time login automatically enforces a password change gate.

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@damperquote.com` | `DamperQuote2026!` | Global rates, company settings, user management, all quotes |
| **Manager** | `manager@damperquote.com` | `DamperQuote2026!` | Global rates, What-If simulator, rate import/export, company settings |
| **Estimation Engineer** | `engineer@damperquote.com` | `DamperQuote2026!` | Live costing, 3D CAD, BOM, per-quote rate overrides |
| **Sales** | `sales@damperquote.com` | `DamperQuote2026!` | Customer RFQs, quote pipeline, PDF/Excel commercial sheets |

*(One-click quick persona buttons are provided on the login page for instant demo switching)*

---

## 3. Demo Walkthrough Script (5-Minute Tour)

1. **Sign In**: Select the **Engineer** persona on the login screen.
2. **Configure Damper**:
   - Navigate to **New Quote**.
   - Enter Customer: `Tata Steel Limited` and Dimensions: `3000 × 3000 × 450 mm`, Qty: `2`, Markup: `15%`.
   - Observe live debounced calculation of all 45 BOM parts and commercial breakdown.
3. **Interactive 3D CAD**: Click **Interactive 3D CAD Preview** tab and drag the **Flap Position slider** from 0% (closed) to 100% (open) to watch the sliding blade travel and drive pinions rotate.
4. **Per-Quote Rate Override**:
   - Click **Configure Per-Quote Rate Overrides**.
   - Change `IS 2062` rate from `72` to `80`.
   - Notice the amber **Custom Rates Applied** badge appears; global master rates remain completely untouched.
5. **Save & Export**:
   - Click **Save Quote (v1)**.
   - Click **Download PDF**: review official quotation with Pune company letterhead, technical parameters, GST 18%, and terms.
   - Click **Download Excel**: open in Microsoft Excel to verify native live formulas (`=G6*I6`, `=SUM(...)`) recalculate dynamically when rate cells are modified.
6. **Admin Controls & What-If**:
   - Switch user to **Admin** or **Manager**.
   - Open **Rates & What-If**: test the sensitivity slider (e.g. Steel +5%) to see net commercial profit impact on the reference damper.
   - Open **Company Settings**: edit factory address, GSTIN, quote validity, or warranty clauses that feed the PDF.

---

## 4. Database Demo Data & Backup

### Demo Data & DB Reset Commands
```bash
cd damper-quote-pro/backend

# Populate 5 realistic Indian industrial customers and 8 quotes with diverse sizes
python -m app.demo_data --load

# Reset database to clean factory default state
python -m app.demo_data --reset
```

### Automated Daily SQLite Backup
Run online backup script (uses SQLite online backup API to prevent locks):
```bash
cd damper-quote-pro/backend
python -m app.backup
```
- **Linux / macOS Cron Job** (run daily at 2:00 AM):
  ```crontab
  0 2 * * * cd /path/to/damper-quote-pro/backend && /usr/bin/python3 -m app.backup >> /var/log/damper_backup.log 2>&1
  ```
- **Windows Task Scheduler**:
  Create a daily scheduled task running `powershell.exe -Command "cd 'C:\...\damper-quote-pro\backend'; python -m app.backup"`. Backups are stored in `backend/backups/` with automated 30-day retention rotation.

---

## 5. Assumptions for the Company to Confirm

1. **Geometry Scaling**: Sizes other than 3000 × 3000 × 450 mm scale racks as $2 \times \lceil W/1500 \rceil$, free pinions as $\text{round}(14 \times nR / 4)$, and packing as $\text{round}(24 \times (W+H)/6000)$. Non-standard sizes are flagged as *"Estimated - to be verified by engineering"*.
2. **Commercial Defaults**: GST is set at 18%, price basis Ex-works Pune, with standard 30% advance / 70% proforma payment terms.

---

## 6. Part D: Multi-Blade (Louvered) Damper Engine

The CPQ platform supports two distinct industrial damper product families:
1. **Rack-and-Pinion Sliding-Flap Damper**: CTO 45-part certified schedule with 4 reference sizes (3000×3000×450, 2000×2000×400, 4500×3500×500, 6000×6000×800) passing regression within ₹ 1.
2. **Multi-Blade (Louvered) Damper (Part D)**: Parametric multi-blade geometry engine for modulating and gas isolation service.

### Key Capabilities
- **Frame Configuration**: Width, height, depth along airflow, frame thickness (mm), construction (Channel Box / Angle Frame), flanges (Angle / Flat Bar / None), sections (auto-suggested when blade length exceeds maximum allowable span for thickness), orientation (horizontal / vertical), mounting, and surface finish.
- **Blade Configuration & Modes**: Single Skin (flat), Double Skin, and Aerofoil blade profiles; opposed or parallel action. Supports **AUTO Mode** (target pitch or count derives the other and chord with overlap) and **MANUAL Mode** (user fixes count and chord).
- **Shaft, Linkage & Actuation**: Shaft diameter selection against span rules, bearings (bush, ball, sealed), side-mounted crank & tie rod linkage, actuator selection (electric quarter-turn, pneumatic double-acting, pneumatic spring-return, manual quadrant) with accessories (limit switches, solenoids, positioners).
- **Live Engineering Results & Blade Schedule**: Live calculation of blade count, pitch, chord, span, free area %, open/closed angle (0° to 90°), single blade weight, total damper weight, hardware counts, and a full blade schedule table.
- **Rule Validation & Section Splitting**: Maximum blade length vs thickness rules (auto-splits with prompt when exceeded), pitch $\le$ chord overlap check (minimum 2 blades), minimum shaft diameter vs span check, and engineering warnings (velocity limits, temperature thresholds, action suitability). Errors block quotation saving.
- **Costing Conventions**: Strictly adheres to Indian manufacturing formulas: plates $(L+W) \times 2 \times T \times \text{labour\_rate} / 1000$, plate weight $L \times W \times T \times 7.85\times 10^{-6} \times \text{qty}$, bought-outs, automation, markup, and margin.
- **Placeholder Data & Admin Checklist**: All multi-blade parameters are seeded as placeholder defaults. Quotes and exports display *"Placeholder multi-blade data: not company-verified"* until an Admin verifies the dataset. An interactive 10-point checklist in the Admin Panel guides company data collection.

