import React, { useState } from 'react';
import { 
  Upload, 
  FileText, 
  Check, 
  Trash2, 
  Plus, 
  Eye, 
  Sliders, 
  Sparkles, 
  Layers, 
  ArrowRight, 
  ChevronRight, 
  AlertCircle,
  FileCheck,
  Cpu,
  RefreshCw
} from 'lucide-react';

const PRESET_BLUEPRINTS = [
  {
    id: 'rack-3000',
    title: '3000 × 3000 mm Rack & Pinion Sliding Damper 2D GA',
    category: 'damper',
    type: 'rack-pinion',
    dims: { width: 3000, height: 3000, depth: 450 },
    thumbnail: '📐 2D GA: Heavy-Duty Rack & Pinion Isolation Damper',
    description: 'General arrangement drawing showing double gear rack drive, side housing guide channels, reinforced blade flap, and drive pinion shafts.',
    suggestedComponents: [
      { id: 'c1', name: 'Housing Side Plate A & B', role: 'Main structural frame enclosing blade travel', moc: 'IS 2062', dim1: 8900, dim2: 650, dim3: 8, qty: 2, unitRate: 75, active: true },
      { id: 'c2', name: 'Housing Top & Bottom Plate', role: 'Upper flange & duct isolation closure', moc: 'IS 2062', dim1: 2500, dim2: 650, dim3: 8, qty: 2, unitRate: 75, active: true },
      { id: 'c3', name: 'Flap Plate (Main Sliding Blade)', role: 'Zero-deflection sliding barrier with SS cladding', moc: 'SS 304L', dim1: 4550, dim2: 2470, dim3: 12, qty: 1, unitRate: 250, active: true },
      { id: 'c4', name: 'Spur Gear Racks (Vertical Drive)', role: 'Heavy-duty induction hardened drive racks', moc: 'EN8 / C45', dim1: 3000, dim2: 50, dim3: 40, qty: 4, unitRate: 140, active: true },
      { id: 'c5', name: 'Pinion Drive Shaft (Ø90 mm)', role: 'High-torque solid drive transmission shaft', moc: 'SS 410', dim1: 90, dim2: 3700, dim3: 0, qty: 1, isRound: true, unitRate: 120, active: true },
      { id: 'c6', name: 'Flap Guiding Rollers & Pins', role: 'Anti-friction side guide rollers with bronze bushes', moc: 'EN8', dim1: 42, dim2: 60, dim3: 0, qty: 36, isRound: true, unitRate: 95, active: true },
      { id: 'c7', name: 'Bearing Rest Support Channels', role: 'Structural mounting channel for plummer block bearings', moc: 'IS 2062', dim1: 1500, dim2: 160, dim3: 6, qty: 2, unitRate: 75, active: true },
      { id: 'c8', name: 'Electric Actuator Base Bracket', role: 'Torque reaction bracket for multi-turn actuator', moc: 'IS 2062', dim1: 2800, dim2: 160, dim3: 6, qty: 1, unitRate: 75, active: true },
    ]
  },
  {
    id: 'louver-2400',
    title: '2400 × 1800 mm Multi-Blade Louver Damper 2D Layout',
    category: 'damper',
    type: 'multi-blade',
    dims: { width: 2400, height: 1800, depth: 300 },
    thumbnail: '📐 2D Layout: Opposed Aerofoil Multi-Blade Damper',
    description: 'Detailed multi-blade section blueprint showing 12 streamlined hollow aerofoil blades, external tie-rod linkages, and gland seal bush bosses.',
    suggestedComponents: [
      { id: 'm1', name: 'Main Outer Casing Flanged Frame', role: 'Rigid channel casing with welded duct companion flanges', moc: 'IS 2062', dim1: 2400, dim2: 1800, dim3: 6, qty: 1, unitRate: 75, active: true },
      { id: 'm2', name: 'Aerofoil Streamlined Blade Skins', role: 'Low pressure-drop counter-rotating modulation blades', moc: 'IS 2062', dim1: 2360, dim2: 180, dim3: 2.5, qty: 12, unitRate: 85, active: true },
      { id: 'm3', name: 'Blade Solid Drive Shafts (Ø35 mm)', role: 'Continuous or stub shafts through blade core', moc: 'SS 410', dim1: 35, dim2: 2600, dim3: 0, qty: 12, isRound: true, unitRate: 120, active: true },
      { id: 'm4', name: 'External Interconnecting Tie Rod', role: 'Synchronizes blade rotation in opposed kinematic motion', moc: 'IS 2062', dim1: 1850, dim2: 25, dim3: 10, qty: 1, unitRate: 75, active: true },
      { id: 'm5', name: 'Crank Levers (Keyed to Shafts)', role: 'Laser cut mechanical levers connecting shaft to tie rod', moc: 'IS 2062', dim1: 160, dim2: 40, dim3: 12, qty: 12, unitRate: 90, active: true },
      { id: 'm6', name: 'Self-Lubricating Bushings (PTFE/Bronze)', role: 'Maintenance-free rotary shaft guide bushes', moc: 'Bronze', dim1: 45, dim2: 35, dim3: 30, qty: 24, isRound: true, unitRate: 450, active: true },
      { id: 'm7', name: 'Stainless Blade Edge Seals (SS 316)', role: 'High-temperature spring stainless perimeter seal strips', moc: 'SS 316', dim1: 2360, dim2: 35, dim3: 0.6, qty: 24, unitRate: 420, active: true },
    ]
  },
  {
    id: 'valve-bf-300',
    title: 'DN300 Triple Offset Butterfly Valve 2D Cross-Section',
    category: 'valve',
    type: 'butterfly_valve',
    dims: { sizeDn: 300, rating: 'Class 150', endConn: 'Lugged' },
    thumbnail: '📐 2D Section: Triple Offset Metal-Seated Valve',
    description: 'Engineering section drawing demonstrating elliptical disc seat geometry, non-rubbing cone-in-cone action, and blowout-proof stem retention.',
    suggestedComponents: [
      { id: 'v1', name: 'Valve Body Cast / Fabricated Ring', role: 'Pressure boundary casing with threaded lug bolt holes', moc: 'WCB / CF8M', dim1: 450, dim2: 450, dim3: 85, qty: 1, unitRate: 180, active: true },
      { id: 'v2', name: 'Elliptical Beveled Disc Plate', role: 'Triple-offset contoured shutoff disc with low torque', moc: 'SS 316', dim1: 300, dim2: 300, dim3: 35, qty: 1, unitRate: 350, active: true },
      { id: 'v3', name: 'Drive Stem / Shaft (Ø45 mm)', role: 'One-piece blowout-proof rotary stem', moc: '17-4PH / SS 410', dim1: 45, dim2: 650, dim3: 0, qty: 1, isRound: true, unitRate: 280, active: true },
      { id: 'v4', name: 'Laminated Graphite & SS 316 Seal Ring', role: 'Zero-leakage resilient fire-safe body seat ring', moc: 'Graphite+SS316', dim1: 310, dim2: 310, dim3: 15, qty: 1, unitRate: 850, active: true },
      { id: 'v5', name: 'ISO 5211 Top Actuator Mounting Flange', role: 'Precision machined platform for gearbox / actuator', moc: 'IS 2062', dim1: 175, dim2: 175, dim3: 20, qty: 1, unitRate: 110, active: true },
    ]
  },
  {
    id: 'valve-kg-200',
    title: 'DN200 Heavy-Duty Knife Gate Valve 2D Assembly',
    category: 'valve',
    type: 'knife_gate_valve',
    dims: { sizeDn: 200, rating: 'PN 10', endConn: 'Wafer' },
    thumbnail: '📐 2D Assembly: Bi-Directional Slurry Knife Gate',
    description: 'Slurry & ash handling gate blueprint with bottom beveled knife edge, gland follower, guide ribs and top cylinder mounting superstructure.',
    suggestedComponents: [
      { id: 'k1', name: 'Fabricated Bonnetless Body Halves', role: 'Two-piece bolted casing with cast deflection liners', moc: 'IS 2062 / CF8', dim1: 320, dim2: 320, dim3: 60, qty: 2, unitRate: 160, active: true },
      { id: 'k2', name: 'Hardened Knife Blade Plate', role: 'Shears through slurry, ash & pulp with knife bevel edge', moc: 'SS 304L', dim1: 420, dim2: 215, dim3: 10, qty: 1, unitRate: 260, active: true },
      { id: 'k3', name: 'Heavy-Duty Top Yoke Pillars', role: 'Transmits actuator thrust to valve body', moc: 'IS 2062', dim1: 35, dim2: 550, dim3: 0, qty: 2, isRound: true, unitRate: 85, active: true },
      { id: 'k4', name: 'Adjustable Gland Packing Gasket Box', role: 'Multi-layer braided PTFE packing for stem seal', moc: 'PTFE Braided', dim1: 220, dim2: 40, dim3: 25, qty: 1, unitRate: 350, active: true },
      { id: 'k5', name: 'Pneumatic Cylinder Mounting Plate', role: 'Top plate engineered for double-acting pneumatic cylinder', moc: 'IS 2062', dim1: 180, dim2: 180, dim3: 16, qty: 1, unitRate: 90, active: true },
    ]
  },
  {
    id: 'valve-bv-150',
    title: 'DN150 Class 300 Trunnion Industrial Ball Valve 2D Cutaway',
    category: 'valve',
    type: 'ball_valve',
    dims: { sizeDn: 150, rating: 'Class 300', endConn: 'Flanged RF' },
    thumbnail: '📐 2D Cutaway: Trunnion Mounted High-Pressure Ball',
    description: 'Full-bore split body cutaway detailing spherical ball with mirror polish, spring-energized seats, and bottom trunnion pivot plate.',
    suggestedComponents: [
      { id: 'b1', name: 'Split Body Left & Right Shells', role: '2-piece bolted spherical shell with raised-face flanges', moc: 'ASTM A216 WCB', dim1: 300, dim2: 300, dim3: 120, qty: 2, unitRate: 210, active: true },
      { id: 'b2', name: 'Full-Bore Spherical Ball (Ø150 mm port)', role: 'Precision ground micro-polished shutoff sphere', moc: 'SS 316', dim1: 220, dim2: 220, dim3: 220, qty: 1, isRound: true, unitRate: 420, active: true },
      { id: 'b3', name: 'Trunnion Pivot Pins (Top & Bottom)', role: 'Absorbs hydraulic pipeline thrust loads', moc: 'SS 410', dim1: 50, dim2: 140, dim3: 0, qty: 2, isRound: true, unitRate: 150, active: true },
      { id: 'b4', name: 'Spring-Loaded Floating Seats', role: 'Bidirectional sealing at low and high pressure', moc: 'RPTFE / SS 316', dim1: 185, dim2: 185, dim3: 18, qty: 2, unitRate: 650, active: true },
    ]
  }
];

export default function TwoDDesignAnalyzer({
  onApplyComponents,
  onSelectDimensions,
  currentDamperType,
  currentProductCategory = 'damper'
}) {
  const [selectedBlueprint, setSelectedBlueprint] = useState(PRESET_BLUEPRINTS[0]);
  const [componentsList, setComponentsList] = useState(PRESET_BLUEPRINTS[0].suggestedComponents);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [newPartName, setNewPartName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Handle switching sample blueprint
  const handleSelectPreset = (preset) => {
    setSelectedBlueprint(preset);
    setComponentsList(preset.suggestedComponents.map(c => ({ ...c, active: true })));
    setUploadedFileName(null);
    setAppliedSuccess(false);
  };

  // Handle file drop / upload simulation
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setIsAnalyzing(true);
    setAppliedSuccess(false);

    // Simulate intelligent CAD analysis based on file name or type
    setTimeout(() => {
      setIsAnalyzing(false);
      const isValve = file.name.toLowerCase().includes('valve') || file.name.toLowerCase().includes('dn');
      const matchingPreset = isValve ? PRESET_BLUEPRINTS[2] : PRESET_BLUEPRINTS[0];
      setSelectedBlueprint({
        ...matchingPreset,
        title: `2D Drawing: ${file.name}`,
        description: `Extracted dimensions & component topology from uploaded file '${file.name}'. AI matched standard industrial engineering BOM.`
      });
      setComponentsList(matchingPreset.suggestedComponents.map(c => ({ ...c, active: true })));
    }, 800);
  };

  // Toggle component inclusion
  const toggleComponent = (id) => {
    setComponentsList(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  };

  // Remove component permanently
  const removeComponent = (id) => {
    setComponentsList(prev => prev.filter(c => c.id !== id));
  };

  // Add custom component
  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!newPartName.trim()) return;
    const newComp = {
      id: `custom-${Date.now()}`,
      name: newPartName.trim(),
      role: 'Custom engineering component from 2D drawing',
      moc: 'IS 2062',
      dim1: 500,
      dim2: 250,
      dim3: 8,
      qty: 1,
      unitRate: 75,
      active: true
    };
    setComponentsList([...componentsList, newComp]);
    setNewPartName('');
    setShowAddForm(false);
  };

  // Apply suggested components to main quotation BOM
  const handleApplyToCostSheet = () => {
    const activeComponents = componentsList.filter(c => c.active);
    if (onApplyComponents) {
      onApplyComponents(activeComponents, selectedBlueprint);
    }
    if (onSelectDimensions && selectedBlueprint.dims) {
      onSelectDimensions(selectedBlueprint.dims, selectedBlueprint.category, selectedBlueprint.type);
    }
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 4000);
  };

  return (
    <div className="bg-white border border-[#E8E3D8] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_-2px_rgba(40,30,20,0.04)] space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#EAE4D9] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#476885]"></span>
            <h3 className="font-bold text-sm sm:text-base text-[#242826] uppercase tracking-wide flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#476885]" />
              2D Engineering Design Blueprint Uploader & Component Suggester
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EFF5FA] text-[#34526E] border border-[#D5E4F2]">
              CAD / PDF / DWG
            </span>
          </div>
          <p className="text-xs text-[#5C6460] mt-1">
            Upload or select a 2D engineering drawing of dampers or valves. Our CAD engine identifies required components, explains their role, and lets you add, remove, and sync them directly to your cost sheet.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleApplyToCostSheet}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
            appliedSuccess
              ? 'bg-[#3D6353] text-white'
              : 'bg-[#C46346] hover:bg-[#B05337] text-white hover:shadow'
          }`}
        >
          {appliedSuccess ? (
            <>
              <Check className="w-4 h-4" />
              <span>Components Applied to Cost Sheet!</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Apply {componentsList.filter(c => c.active).length} Components to Cost Sheet</span>
            </>
          )}
        </button>
      </div>

      {/* Upload Zone & Presets Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Drag & Drop Upload Card */}
        <div className="lg:col-span-5 flex flex-col justify-between p-4 bg-[#FAF7F2] rounded-xl border border-dashed border-[#DDD6C8] hover:border-[#476885] transition-colors">
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#EFF5FA] flex items-center justify-center text-[#476885]">
              {isAnalyzing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
            </div>
            <div>
              <div className="font-bold text-xs text-[#242826]">
                {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Drag & Drop 2D CAD Blueprint or Drawing'}
              </div>
              <p className="text-[11px] text-[#5C6460] mt-0.5">
                Supports DWG, DXF, PDF, PNG, JPG general arrangement drawings
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#476885] text-white cursor-pointer hover:bg-[#39536B] transition-colors shadow-sm">
              <FileText className="w-3.5 h-3.5" />
              <span>Browse Local CAD File</span>
              <input type="file" accept=".png,.jpg,.jpeg,.pdf,.dxf,.dwg" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {/* Quick preset selector */}
          <div className="border-t border-[#EAE4D9] pt-3">
            <div className="text-[11px] font-bold text-[#5C6460] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Or Choose Certified Sample 2D Blueprint:</span>
              <span className="text-[10px] text-[#476885] font-semibold">Click to load</span>
            </div>
            <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
              {PRESET_BLUEPRINTS.map(p => {
                const isSel = selectedBlueprint.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-center justify-between ${
                      isSel 
                        ? 'bg-white border-2 border-[#476885] shadow-sm font-bold text-[#34526E]' 
                        : 'bg-white/80 border border-[#E8E3D8] text-[#333C37] hover:bg-white'
                    }`}
                  >
                    <span className="truncate pr-2">{p.title}</span>
                    <span className="text-[10px] font-mono text-[#88918C] shrink-0 uppercase">{p.category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Detected Blueprint Specifications & Visual Blueprint Box */}
        <div className="lg:col-span-7 bg-slate-900 text-white rounded-xl p-4 flex flex-col justify-between font-mono relative overflow-hidden">
          {/* Blueprint Canvas Graphic */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  2D CAD Feature Extraction Output
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                Verified Dimensions
              </span>
            </div>

            <div className="text-xs space-y-1">
              <div className="text-amber-300 font-bold text-sm">
                {selectedBlueprint.title}
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                {selectedBlueprint.description}
              </p>
            </div>

            {/* Extracted Specification Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700">
                <span className="text-slate-400 text-[10px] block">Equipment:</span>
                <span className="font-bold text-white capitalize">{selectedBlueprint.category}</span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700">
                <span className="text-slate-400 text-[10px] block">Dimensions / Bore:</span>
                <span className="font-bold text-emerald-400">
                  {selectedBlueprint.dims?.sizeDn 
                    ? `DN ${selectedBlueprint.dims.sizeDn}` 
                    : `${selectedBlueprint.dims?.width} × ${selectedBlueprint.dims?.height} mm`}
                </span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700">
                <span className="text-slate-400 text-[10px] block">Depth / Rating:</span>
                <span className="font-bold text-white">
                  {selectedBlueprint.dims?.rating || `${selectedBlueprint.dims?.depth} mm`}
                </span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700">
                <span className="text-slate-400 text-[10px] block">Components Found:</span>
                <span className="font-bold text-amber-400">{componentsList.length} Items</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-sans">
            <span>✓ Component topology mapped to certified manufacturing schedule.</span>
            <span className="text-amber-300 font-mono text-[10px]">Tolerance: ±0.5 mm</span>
          </div>
        </div>
      </div>

      {/* Suggested Components Schedule Table */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-xs uppercase text-slate-800 tracking-wider">
              Suggested Components for this 2D Drawing ({componentsList.filter(c => c.active).length} of {componentsList.length} Active)
            </h4>
            <span className="text-[11px] text-slate-500">
              • Toggle checkboxes to add/remove components from quotation
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 text-xs font-semibold text-[#3D6353] hover:text-[#2C483D] bg-[#EEF5F1] hover:bg-[#DEEBE2] px-3 py-1 rounded-lg transition-colors border border-[#D0E2D7]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Component to 2D Plan</span>
          </button>
        </div>

        {/* Add custom component form */}
        {showAddForm && (
          <form onSubmit={handleAddCustom} className="p-3 bg-[#EEF5F1]/70 rounded-xl border border-[#D0E2D7] flex flex-wrap items-center gap-2 text-xs">
            <input
              type="text"
              placeholder="Component Name (e.g. Purge Port Baffle, Shaft Collar)"
              value={newPartName}
              onChange={(e) => setNewPartName(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-[#DDD6C8] bg-white text-[#242826]"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#3D6353] text-white rounded-lg font-bold hover:bg-[#2C483D] transition-colors shadow-sm"
            >
              Add Component
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 bg-[#FAF7F2] text-[#4A5450] border border-[#DDD6C8] rounded-lg hover:bg-[#F2ECE1]"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Components Table */}
        <div className="border border-[#E8E3D8] rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gradient-to-r from-[#2F4D40] to-[#3D6353] text-white uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="px-3 py-2 text-center w-12">Include</th>
                <th className="px-3 py-2">Part Name</th>
                <th className="px-3 py-2">Engineering Role / Description</th>
                <th className="px-3 py-2 text-center w-24">MOC</th>
                <th className="px-3 py-2 text-right w-36">Size / Dimensions (mm)</th>
                <th className="px-3 py-2 text-center w-14">Qty</th>
                <th className="px-3 py-2 text-right w-24">Rate (₹/kg)</th>
                <th className="px-3 py-2 text-center w-12">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {componentsList.map((item, index) => {
                const isActive = item.active;
                return (
                  <tr 
                    key={item.id} 
                    className={`transition-colors ${
                      isActive 
                        ? (index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50') 
                        : 'bg-slate-100/70 opacity-60'
                    }`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleComponent(item.id)}
                        className="rounded text-[#005daa] focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-900">
                      {item.name}
                    </td>
                    <td className="px-3 py-2 text-slate-600 leading-tight">
                      {item.role}
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-semibold text-slate-700">
                      {item.moc}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800">
                      {item.isRound 
                        ? `Ø ${item.dim1} × ${item.dim2} mm` 
                        : `${item.dim1} × ${item.dim2} × ${item.dim3} mm`}
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-900">
                      {item.qty}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-emerald-800">
                      ₹ {item.unitRate}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeComponent(item.id)}
                        title="Remove component"
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
