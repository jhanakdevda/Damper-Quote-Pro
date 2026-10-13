import React, { useState } from 'react';
import { 
  Calculator, 
  HelpCircle, 
  Sliders, 
  Check, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  Percent,
  Plus,
  Minus,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Wand2
} from 'lucide-react';
import { DEFAULT_FORMULAS, evaluateFormula, validateFormulaSyntax } from '../utils/formulaEvaluator';

export default function FormulaInspector({
  formulas = DEFAULT_FORMULAS,
  onUpdateFormula,
  onResetFormulas,
  densityMultiplier = 7.85e-6,
  setDensityMultiplier,
  cuttingTolerancePct = 0,
  setCuttingTolerancePct,
  labourDivisor = 1000,
  setLabourDivisor,
  finishingRatePerKg = 20,
  setFinishingRatePerKg,
  fabricationRatePerKg = 96,
  setFabricationRatePerKg,
  activeRates = {},
  isMultiBlade = false,
  isValveMode = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('damper'); // 'damper' | 'blade' | 'valve' | 'simulator'
  const [editingKey, setEditingKey] = useState(null);

  // Interactive Live Calculator Sandbox
  const [simType, setSimType] = useState('plate'); // 'plate' | 'round'
  const [simL, setSimL] = useState(4550);
  const [simW, setSimW] = useState(2470);
  const [simT, setSimT] = useState(12);
  const [simDia, setSimDia] = useState(90);
  const [simRoundL, setSimRoundL] = useState(3700);
  const [simQty, setSimQty] = useState(1);
  const [simRate, setSimRate] = useState(250);
  const [simLcRate, setSimLcRate] = useState(15);
  const [simMc, setSimMc] = useState(0);
  const [simTolerance, setSimTolerance] = useState(0); // +/- % error allowance

  // Computed simulation values using dynamic editable formulas
  const effectiveDensity = Number(densityMultiplier) || 7.85e-6;
  const effectiveDivisor = Number(labourDivisor) || 1000;
  
  const simContext = {
    L: simL,
    W: simW,
    T: simT,
    d: simDia,
    length: simRoundL,
    density: effectiveDensity,
    qty: simQty,
    rate: simRate,
    material_rate: simRate,
    labour_rate: simLcRate,
    labour_divisor: effectiveDivisor,
    mc: simMc,
    per_piece_machining: simMc,
    rolling: 0,
    rolling_cost: 0,
    total_weight: 0,
    finishing_rate: Number(finishingRatePerKg) || 20,
    fabrication_rate: Number(fabricationRatePerKg) || 96,
    markup_pct: 10,
    racks: 80000,
    pinions: 80000,
    bearings: 26000,
    hardware: 50000,
    gland_packing: 4800,
    automation: 350000,
  };

  const rawWeight = simType === 'plate'
    ? evaluateFormula(formulas.plateWeight || DEFAULT_FORMULAS.plateWeight, simContext, simL * simW * simT * effectiveDensity * simQty)
    : evaluateFormula(formulas.roundWeight || DEFAULT_FORMULAS.roundWeight, simContext, 0.785 * Math.pow(simDia, 2) * simRoundL * effectiveDensity * simQty);

  const simWeightWithTol = rawWeight * (1 + (simTolerance / 100));
  simContext.weight = simWeightWithTol;
  simContext.total_weight = simWeightWithTol;

  const simRmCost = evaluateFormula(formulas.rawMaterial || DEFAULT_FORMULAS.rawMaterial, simContext, simWeightWithTol * simRate);
  simContext.raw_material = simRmCost;

  const simLcCost = simType === 'plate'
    ? evaluateFormula(formulas.machiningLabour || DEFAULT_FORMULAS.machiningLabour, simContext, ((simL + simW) * 2 * simT * simLcRate / effectiveDivisor) * simQty)
    : simMc * simQty;
  simContext.machining = simLcCost;

  const simLineTotal = simRmCost + simLcCost;

  // Preset formulas handler
  const handleApplyPreset = (presetName) => {
    if (!onUpdateFormula) return;
    if (presetName === 'default') {
      onResetFormulas?.();
      setCuttingTolerancePct?.(0);
      setLabourDivisor?.(1000);
      setFabricationRatePerKg?.(96);
      setFinishingRatePerKg?.(20);
    } else if (presetName === 'kerf_allowance') {
      onUpdateFormula('plateWeight', 'L * W * T * density * qty * 1.03');
      onUpdateFormula('roundWeight', '0.785 * d * d * length * density * qty * 1.02');
      setCuttingTolerancePct?.(3);
    } else if (presetName === 'heavy_duty') {
      onUpdateFormula('plateWeight', 'L * W * T * density * qty * 1.05');
      onUpdateFormula('machiningLabour', '((L + W) * 2 * T * labour_rate / 850 + mc + rolling) * qty');
      setLabourDivisor?.(850);
      setFabricationRatePerKg?.(110);
    } else if (presetName === 'fast_track') {
      onUpdateFormula('machiningLabour', '((L + W) * 2 * T * labour_rate / 1200 + mc + rolling) * qty');
      setLabourDivisor?.(1200);
    }
  };

  // Quick formula modifier helpers
  const handleAppendToFormula = (formulaKey, token) => {
    if (!onUpdateFormula) return;
    const current = (formulas[formulaKey] || DEFAULT_FORMULAS[formulaKey] || '').trim();
    if (!current) {
      onUpdateFormula(formulaKey, token);
      return;
    }
    if (/^[\*\+\-\/]/.test(token)) {
      onUpdateFormula(formulaKey, `${current} ${token}`);
    } else {
      onUpdateFormula(formulaKey, `${current} * ${token}`);
    }
  };

  const handleApplyPctAllowance = (formulaKey, pct) => {
    if (!onUpdateFormula) return;
    const current = (formulas[formulaKey] || DEFAULT_FORMULAS[formulaKey] || '').trim();
    const factor = (1 + pct / 100).toFixed(2);
    onUpdateFormula(formulaKey, `(${current}) * ${factor}`);
  };

  const handleApplyFixedAllowance = (formulaKey, amount) => {
    if (!onUpdateFormula) return;
    const current = (formulas[formulaKey] || DEFAULT_FORMULAS[formulaKey] || '').trim();
    const sign = amount >= 0 ? `+ ${amount}` : `- ${Math.abs(amount)}`;
    onUpdateFormula(formulaKey, `(${current}) ${sign}`);
  };

  // Helper component to render an editable formula field
  const renderFormulaCard = (number, title, formulaKey, defaultFormula, sampleContext, explanation, variables) => {
    const currentFormula = formulas[formulaKey] || defaultFormula;
    const isCustom = currentFormula !== defaultFormula;
    const syntax = validateFormulaSyntax(currentFormula, sampleContext);
    const sampleVal = evaluateFormula(currentFormula, sampleContext, 0);
    const defaultVal = evaluateFormula(defaultFormula, sampleContext, 0);
    const pctDiff = defaultVal !== 0 ? ((sampleVal - defaultVal) / defaultVal) * 100 : 0;
    const varTokens = (variables || '').split(',').map(v => v.trim()).filter(Boolean);

    return (
      <div className={`bg-white p-4 rounded-xl border transition-all shadow-sm relative overflow-hidden flex flex-col justify-between ${
        isCustom ? 'border-amber-300 ring-2 ring-amber-200/70 bg-amber-50/15' : 'border-slate-200 hover:border-slate-300'
      }`}>
        <div>
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#3D6353] text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0">
                {number}
              </div>
              <h4 className="font-bold text-xs uppercase text-slate-800 tracking-wide">
                {title}
              </h4>
            </div>

            <div className="flex items-center gap-1.5">
              {isCustom ? (
                <span className="text-[9px] bg-[#FEF7EB] text-[#8E6119] font-bold px-2 py-0.5 rounded-full uppercase border border-[#F8E3C0] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8E6119] animate-pulse"></span>
                  Edited
                </span>
              ) : (
                <span className="text-[9px] bg-[#EEF5F1] text-[#2C5040] font-medium px-2 py-0.5 rounded-full border border-[#D0E2D7]">
                  Certified
                </span>
              )}
              {isCustom && onUpdateFormula && (
                <button
                  type="button"
                  onClick={() => onUpdateFormula(formulaKey, defaultFormula)}
                  title="Reset to factory certified standard"
                  className="text-[10px] text-slate-500 hover:text-red-600 p-1 rounded hover:bg-slate-100 flex items-center gap-0.5 font-medium transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Formula Input / Display */}
          <div className="space-y-1.5 mt-2">
            <div className="relative">
              <input
                type="text"
                value={currentFormula}
                onChange={(e) => onUpdateFormula && onUpdateFormula(formulaKey, e.target.value)}
                className={`w-full font-mono text-xs font-bold px-2.5 py-2 rounded-lg border focus:outline-none transition-all pr-8 ${
                  syntax.valid 
                    ? (isCustom 
                        ? 'bg-[#FEF7EB] text-[#8E6119] border-[#F8E3C0] focus:border-[#C46346] focus:bg-white' 
                        : 'bg-[#FAF7F2] text-[#2C5040] border-[#E0D9CC] focus:border-[#3D6353] focus:bg-white')
                    : 'bg-red-50 text-red-900 border-red-300 focus:border-red-500'
                }`}
                placeholder="Enter algebraic formula expression..."
              />
              <div className="absolute right-2.5 top-2.5 text-[10px]">
                {syntax.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" title="Valid formula expression" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500" title={syntax.error} />
                )}
              </div>
            </div>

            {/* Syntax Error Message */}
            {!syntax.valid && (
              <div className="text-[10px] text-red-600 font-medium bg-red-50 px-2 py-1 rounded border border-red-200">
                ⚠ {syntax.error}
              </div>
            )}

            {/* Quick Math Modifiers (Tolerances & Error Allowance +/-) */}
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <span className="text-[9px] text-slate-400 font-semibold uppercase">Add Error / Term:</span>
              <button
                type="button"
                onClick={() => handleApplyPctAllowance(formulaKey, 2)}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                title="Add +2% tolerance/error factor"
              >
                +2%
              </button>
              <button
                type="button"
                onClick={() => handleApplyPctAllowance(formulaKey, 5)}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                title="Add +5% tolerance/error factor"
              >
                +5%
              </button>
              <button
                type="button"
                onClick={() => handleApplyPctAllowance(formulaKey, -2)}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
                title="Subtract -2% tolerance/error factor"
              >
                -2%
              </button>
              <button
                type="button"
                onClick={() => handleApplyFixedAllowance(formulaKey, 100)}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                title="Add +100 fixed allowance"
              >
                +100
              </button>
              <button
                type="button"
                onClick={() => handleApplyFixedAllowance(formulaKey, -100)}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                title="Subtract -100 fixed allowance"
              >
                -100
              </button>
            </div>

            {/* Quick Variable Insert Chips */}
            {varTokens.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[9px] text-slate-400 font-semibold uppercase">Insert Var:</span>
                {varTokens.map((vt) => (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => handleAppendToFormula(formulaKey, vt)}
                    className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 hover:text-blue-800 text-slate-700 border border-slate-200 transition-colors"
                    title={`Insert ${vt} into formula`}
                  >
                    +{vt}
                  </button>
                ))}
              </div>
            )}

            {/* Live sample result preview & delta vs baseline */}
            <div className="flex items-center justify-between text-[11px] pt-1 px-1 bg-slate-100/70 rounded p-1 font-mono">
              <span className="text-slate-600">
                Live Result: <strong className="text-slate-900 font-bold font-sans">{Number(sampleVal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
              </span>
              {isCustom && pctDiff !== 0 && (
                <span className={`text-[10px] font-bold font-sans px-1.5 py-0.5 rounded ${
                  pctDiff > 0 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {pctDiff > 0 ? `+${pctDiff.toFixed(1)}%` : `${pctDiff.toFixed(1)}%`} vs Baseline
                </span>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
            {explanation}
          </p>
        </div>
      </div>
    );
  };

  const customFormulasCount = Object.keys(DEFAULT_FORMULAS).filter(
    k => formulas[k] && formulas[k] !== DEFAULT_FORMULAS[k]
  ).length;

  return (
    <div className="bg-white border border-[#E8E3D8] rounded-2xl shadow-[0_2px_12px_-2px_rgba(40,30,20,0.04)] overflow-hidden mb-6 transition-all">
      {/* Banner / Header in Pastel Earth Sage */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gradient-to-r from-[#2F4D40] via-[#3D6353] to-[#487361] text-white p-4 cursor-pointer flex flex-wrap items-center justify-between gap-3 hover:brightness-105 transition-all select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-sm border border-white/20">
            <Calculator className="w-5 h-5 text-[#F5D8A0]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide uppercase">
                Engineering Cost Formula Guide & Dynamic Formula Editor
              </span>
              {customFormulasCount > 0 ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#FEF7EB] text-[#8E6119] border border-[#F8E3C0] flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8E6119] animate-pulse"></span>
                  {customFormulasCount} Custom Formula{customFormulasCount > 1 ? 's' : ''} Active
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#EEF5F1] text-[#2C5040] border border-[#D0E2D7]">
                  Live Editable Formulas
                </span>
              )}
            </div>
            <p className="text-xs text-[#E1EBE5] font-normal mt-0.5">
              Formulas are live and editable inline • Change expressions, add allowances, edit constants & test with instant calculation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/10 text-xs">
            <span className="text-[#D3E3DA] font-medium">Density:</span>
            <span className="font-mono font-bold text-[#F5D8A0]">{effectiveDensity.toExponential(2)}</span>
            <span className="text-white/40 font-mono">|</span>
            <span className="text-[#D3E3DA] font-medium">Divisor:</span>
            <span className="font-mono font-bold text-[#A8E2C5]">{effectiveDivisor}</span>
          </div>
          <button 
            type="button"
            className="flex items-center gap-1 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
          >
            <span>{isOpen ? 'Collapse Formulas' : 'Edit Live Formulas'}</span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-5 bg-[#FAF8F4]/80 border-t border-[#E8E3D8] space-y-6">
          {/* Navigation Tabs & Formula Presets Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#EAE4D9] pb-3">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'damper', label: '1. Standard Damper Formulas (Editable)', icon: Layers },
                { id: 'blade', label: '2. Multi-Blade Louver Formulas (Editable)', icon: Sliders },
                { id: 'valve', label: '3. Valve Component Rules', icon: ShieldCheck },
                { id: 'simulator', label: '4. Interactive Formula Sandbox', icon: Calculator },
                { id: 'cheatsheet', label: '5. Variable & Math Cheatsheet', icon: Code2 },
              ].map((t) => {
                const Icon = t.icon;
                const isSel = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isSel 
                        ? 'bg-[#3D6353] text-white shadow-sm ring-1 ring-[#3D6353]/30' 
                        : 'bg-white text-[#4A5450] hover:bg-[#F3EFE6] border border-[#E8E3D8]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Formula Presets & Reset */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[#5C6460] font-semibold uppercase tracking-wider flex items-center gap-1">
                <Wand2 className="w-3.5 h-3.5 text-[#3D6353]" />
                Presets:
              </span>
              <button
                type="button"
                onClick={() => handleApplyPreset('default')}
                className="px-2.5 py-1 bg-white hover:bg-[#F5F2EC] text-[#3E4642] border border-[#E8E3D8] rounded-lg text-xs font-medium transition-colors"
              >
                Standard PVDQ_26046
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('kerf_allowance')}
                className="px-2.5 py-1 bg-[#FEF7EB] hover:bg-[#FCEFD6] text-[#8E6119] border border-[#F8E3C0] rounded-lg text-xs font-bold transition-colors"
              >
                +3% Kerf Allowance
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('heavy_duty')}
                className="px-2.5 py-1 bg-[#EEF5F1] hover:bg-[#DFEDE4] text-[#2C5040] border border-[#D0E2D7] rounded-lg text-xs font-bold transition-colors"
              >
                Heavy-Duty (+5%)
              </button>
              {customFormulasCount > 0 && onResetFormulas && (
                <button
                  type="button"
                  onClick={() => onResetFormulas()}
                  className="px-2.5 py-1 bg-[#FDF1EB] hover:bg-[#FBE4D8] text-[#A2472D] border border-[#F7D5C8] rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                  title="Reset all formulas to standard PVDQ_26046 certified baseline"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset All ({customFormulasCount})
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: EDITABLE STANDARD DAMPER FORMULAS */}
          {activeTab === 'damper' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[#4A5450] bg-[#EEF5F1] p-3 rounded-xl border border-[#D0E2D7]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Edit3 className="w-4 h-4 text-[#3D6353]" />
                  Click inside any formula field below to edit its mathematical expression. Changes immediately update live calculations and exports.
                </span>
                <span className="font-mono text-[11px] text-[#2C5040] font-bold">
                  Variables: L, W, T, d, length, density, qty, rate, labour_rate, labour_divisor
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Plate Weight */}
                {renderFormulaCard(
                  1,
                  'Plate Weight (kg)',
                  'plateWeight',
                  DEFAULT_FORMULAS.plateWeight,
                  { L: 4550, W: 2470, T: 12, density: effectiveDensity, qty: 1 },
                  `Calculates flat rectangular sheet plate weight. Modify to add cutting allowance (e.g. * 1.03) or custom kerf margins.`,
                  'L, W, T, density, qty'
                )}

                {/* 2. Round Part Weight */}
                {renderFormulaCard(
                  2,
                  'Round Part Weight (kg)',
                  'roundWeight',
                  DEFAULT_FORMULAS.roundWeight,
                  { d: 90, length: 3700, density: effectiveDensity, qty: 1 },
                  `Circular solid shaft & pin volume formula. Modify multiplier 0.785 or length extra allowance for machining ends.`,
                  'd, length, density, qty'
                )}

                {/* 3. Raw Material Cost */}
                {renderFormulaCard(
                  3,
                  'Raw Material Cost (₹)',
                  'rawMaterial',
                  DEFAULT_FORMULAS.rawMaterial,
                  { weight: 1058.67, rate: 250 },
                  `Multiplies line weight by material rate (₹/kg). Modify to include scrap deduction or material handling factor.`,
                  'weight, rate'
                )}

                {/* 4. Machining & Labour Cost */}
                {renderFormulaCard(
                  4,
                  'Machining & Labour (₹)',
                  'machiningLabour',
                  DEFAULT_FORMULAS.machiningLabour,
                  { L: 4550, W: 2470, T: 12, labour_rate: 15, labour_divisor: effectiveDivisor, mc: 0, rolling: 0, qty: 1 },
                  `Cutting labour scaled by perimeter & thickness divided by ${effectiveDivisor}, plus per-piece machining & rolling.`,
                  'L, W, T, labour_rate, divisor, mc'
                )}
              </div>

              {/* Certified Worked Reference Example */}
              <div className="bg-gradient-to-r from-[#EEF5F1] to-[#FEF7EB] border border-[#D0E2D7] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#3D6353] uppercase tracking-wide">
                      Certified Worked Example: Part #29 Flap Plate (Page 5 / 8)
                    </span>
                    <span className="text-[10px] bg-white border border-[#D0E2D7] px-2 py-0.5 rounded-full font-mono text-slate-700 font-bold">
                      4550 × 2470 × 12 mm • SS 304L
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-800 pt-1">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">Live Evaluated Weight:</span>
                      <span className="font-mono font-bold text-blue-900">
                        {evaluateFormula(formulas.plateWeight || DEFAULT_FORMULAS.plateWeight, { L: 4550, W: 2470, T: 12, density: effectiveDensity, qty: 1 }, 1058.67).toFixed(1)} kg
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">Formula: {formulas.plateWeight || DEFAULT_FORMULAS.plateWeight}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">Live Raw Material Cost:</span>
                      <span className="font-mono font-bold text-emerald-800">
                        ₹ {Math.round(evaluateFormula(formulas.rawMaterial || DEFAULT_FORMULAS.rawMaterial, { weight: 1058.67, rate: 250 }, 264667)).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">Formula: {formulas.rawMaterial || DEFAULT_FORMULAS.rawMaterial}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">Live Labour & Machining:</span>
                      <span className="font-mono font-bold text-amber-800">
                        ₹ {Math.round(evaluateFormula(formulas.machiningLabour || DEFAULT_FORMULAS.machiningLabour, { L: 4550, W: 2470, T: 12, labour_rate: 15, labour_divisor: effectiveDivisor, mc: 0, rolling: 0, qty: 1 }, 2527)).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">Formula: {formulas.machiningLabour || DEFAULT_FORMULAS.machiningLabour}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Line Cost:</div>
                  <div className="text-xl font-black font-mono text-[#3D6353]">
                    ₹ {Math.round(
                      evaluateFormula(formulas.rawMaterial || DEFAULT_FORMULAS.rawMaterial, { weight: 1058.67, rate: 250 }, 264667) + 
                      evaluateFormula(formulas.machiningLabour || DEFAULT_FORMULAS.machiningLabour, { L: 4550, W: 2470, T: 12, labour_rate: 15, labour_divisor: effectiveDivisor, mc: 0, rolling: 0, qty: 1 }, 2527)
                    ).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium">Computed using Active Formula</span>
                </div>
              </div>

              {/* Page 6 Assembly & Quoted Price Editable Formulas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
                {renderFormulaCard(
                  5,
                  'Bought-Out Items (₹)',
                  'boughtOut',
                  DEFAULT_FORMULAS.boughtOut,
                  { racks: 80000, pinions: 80000, bearings: 26000, hardware: 50000, gland_packing: 4800, finishing_rate: finishingRatePerKg, total_weight: 4923 },
                  `Total bought-out components plus paint finishing rate (₹${finishingRatePerKg}/kg * total steel weight).`,
                  'racks, pinions, bearings, finishing'
                )}

                {renderFormulaCard(
                  6,
                  'Fabrication Cost (₹)',
                  'fabrication',
                  DEFAULT_FORMULAS.fabrication,
                  { total_weight: 4923, fabrication_rate: fabricationRatePerKg },
                  `Fabrication shop floor rate (₹${fabricationRatePerKg}/kg * total steel weight).`,
                  'total_weight, fabrication_rate'
                )}

                {renderFormulaCard(
                  7,
                  'Total Damper Cost (₹)',
                  'totalCost',
                  DEFAULT_FORMULAS.totalCost,
                  { raw_material: 585362, machining: 102313, bought_out: 339278, automation: 350000, fabrication: 472699 },
                  `Sum of direct manufacturing costs: Raw material + Machining + Bought-out + Automation + Fabrication.`,
                  'raw_material, machining, automation...'
                )}

                {renderFormulaCard(
                  8,
                  'Quoted Price (₹)',
                  'quotedPrice',
                  DEFAULT_FORMULAS.quotedPrice,
                  { total_cost: 1849653, markup_pct: 10 },
                  `Total Cost multiplied by markup factor (1 + markup_pct / 100). Margin = (Price - Cost) / Price.`,
                  'total_cost, markup_pct'
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EDITABLE MULTI-BLADE LOUVER SCHEDULE FORMULAS */}
          {activeTab === 'blade' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[#4A5450] bg-[#EEF5F1] p-3 rounded-xl border border-[#D0E2D7]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Sliders className="w-4 h-4 text-[#3D6353]" />
                  Multi-Blade Louver Damper Kinematic & Geometric Formulas (Editable).
                </span>
                <span className="font-mono text-[11px] text-[#2C5040] font-bold">
                  Variables: width, height, pitch, sections, clearance, count, overlap_pct, chord, span, thickness, density
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderFormulaCard(
                  'B1',
                  'Blade Count (N)',
                  'bladeCount',
                  DEFAULT_FORMULAS.bladeCount,
                  { height: 3000, pitch: 250 },
                  `Calculates number of aerodynamic blades from duct height and center pitch.`,
                  'height, pitch'
                )}

                {renderFormulaCard(
                  'B2',
                  'Blade Span / Length (mm)',
                  'bladeSpan',
                  DEFAULT_FORMULAS.bladeSpan,
                  { width: 3000, sections: 1, clearance: 15 },
                  `Horizontal blade span deducting side clearances and frame sections.`,
                  'width, sections, clearance'
                )}

                {renderFormulaCard(
                  'B3',
                  'Blade Chord Width (mm)',
                  'bladeChord',
                  DEFAULT_FORMULAS.bladeChord,
                  { height: 3000, count: 12, overlap_pct: 10 },
                  `Profile chord width factoring in overlap percentage for tight blade closure.`,
                  'height, count, overlap_pct'
                )}

                {renderFormulaCard(
                  'B4',
                  'Single Blade Weight (kg)',
                  'bladeWeight',
                  DEFAULT_FORMULAS.bladeWeight,
                  { chord: 275, span: 2970, thickness: 3, density: effectiveDensity },
                  `Weight of single louver blade skin. Doubled for double-skin box profiles.`,
                  'chord, span, thickness, density'
                )}

                {renderFormulaCard(
                  'B5',
                  'Tie-Rod Linkage Length (mm)',
                  'tieRod',
                  DEFAULT_FORMULAS.tieRod,
                  { height: 3000, sections: 1 },
                  `Total length of external synchronizing tie rod connecting crank levers.`,
                  'height, sections'
                )}

                {renderFormulaCard(
                  'B6',
                  'Blade Edge Seals (m)',
                  'edgeSeals',
                  DEFAULT_FORMULAS.edgeSeals,
                  { span: 2970, count: 12, height: 3000 },
                  `Total perimeter meters of silicone, EPDM, or stainless spring edge seals.`,
                  'span, count, height'
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VALVE COMPONENT RULES */}
          {activeTab === 'valve' && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-sm text-[#005daa] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Industrial Valve Sizing & Dimensional Standards
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-800">Triple-Offset Butterfly</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    • Standard: API 609 / EN 593<br />
                    • Disc & Body: Cast WCB / CF8M<br />
                    • Seal: Laminated graphite / SS 316<br />
                    • Weight: Scaled with DN^2.1 × Class factor
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-800">Knife Gate Valve</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    • Standard: MSS SP-81<br />
                    • Blade: SS 304L/316 chamfered knife<br />
                    • Body: Compact wafer or lugged<br />
                    • Weight: Scaled with DN × Stroke height
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-800">Ball Valve (Full Bore)</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    • Standard: API 6D / ASME B16.34<br />
                    • Ball: Solid stainless ball with trunnion<br />
                    • Seat: RPTFE, PEEK or metal stellite<br />
                    • Weight: Proportional to sphere volume
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-800">Globe Control Valve</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    • Standard: ISA 75.01<br />
                    • Plug: Parabolic linear/equal % plug<br />
                    • Cage: Multi-hole noise reduction cage<br />
                    • Weight: Heavy globe chamber casing
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INTERACTIVE FORMULA SANDBOX */}
          {activeTab === 'simulator' && (
            <div className="bg-white p-5 rounded-xl border border-[#E8E3D8] space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-[#3D6353] flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Interactive Component Formula Sandbox (Driven by Your Active Formulas)
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <button 
                    type="button" 
                    onClick={() => { setSimType('plate'); setSimL(4550); setSimW(2470); setSimT(12); setSimRate(250); setSimLcRate(15); }}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${simType === 'plate' ? 'bg-[#3D6353] text-white shadow-sm' : 'bg-[#FAF7F2] text-[#4A5450] hover:bg-[#F2ECE1]'}`}
                  >
                    Rectangular Plate (Flap)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setSimType('round'); setSimDia(90); setSimRoundL(3700); setSimRate(120); setSimLcRate(0); setSimMc(6000); }}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${simType === 'round' ? 'bg-[#3D6353] text-white shadow-sm' : 'bg-[#FAF7F2] text-[#4A5450] hover:bg-[#F2ECE1]'}`}
                  >
                    Round Shaft (Main Drive)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                {simType === 'plate' ? (
                  <>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Length L (mm)</label>
                      <input 
                        type="number" 
                        value={simL} 
                        onChange={(e) => setSimL(Number(e.target.value) || 0)} 
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Width W (mm)</label>
                      <input 
                        type="number" 
                        value={simW} 
                        onChange={(e) => setSimW(Number(e.target.value) || 0)} 
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Thickness T (mm)</label>
                      <input 
                        type="number" 
                        value={simT} 
                        onChange={(e) => setSimT(Number(e.target.value) || 0)} 
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono font-bold"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Diameter Ø (mm)</label>
                      <input 
                        type="number" 
                        value={simDia} 
                        onChange={(e) => setSimDia(Number(e.target.value) || 0)} 
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Length (mm)</label>
                      <input 
                        type="number" 
                        value={simRoundL} 
                        onChange={(e) => setSimRoundL(Number(e.target.value) || 0)} 
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono font-bold"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Quantity (Qty)</label>
                  <input 
                    type="number" 
                    value={simQty} 
                    onChange={(e) => setSimQty(Math.max(1, Number(e.target.value) || 1))} 
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Mat Rate (₹/kg)</label>
                  <input 
                    type="number" 
                    value={simRate} 
                    onChange={(e) => setSimRate(Number(e.target.value) || 0)} 
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Tolerance / Error (±%)</label>
                  <input 
                    type="number" 
                    step="0.5"
                    value={simTolerance} 
                    onChange={(e) => setSimTolerance(Number(e.target.value) || 0)} 
                    className="w-full px-2.5 py-1.5 rounded border border-amber-300 bg-amber-50 font-mono font-bold text-amber-900"
                  />
                </div>
              </div>

              {/* Simulation Result Callout */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 font-mono">
                <div>
                  <span className="text-slate-400 text-xs block">Live Formula Weight:</span>
                  <span className="text-xl font-bold text-amber-400">
                    {simWeightWithTol.toFixed(2)} kg
                  </span>
                  <span className="text-[10px] text-slate-400 block font-sans">
                    Computed via: <span className="font-mono text-amber-300">{simType === 'plate' ? (formulas.plateWeight || DEFAULT_FORMULAS.plateWeight) : (formulas.roundWeight || DEFAULT_FORMULAS.roundWeight)}</span>
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-xs block">RM Cost:</span>
                  <span className="text-lg font-bold text-emerald-400">
                    ₹ {Math.round(simRmCost).toLocaleString('en-IN')}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-xs block">Labour & Machining:</span>
                  <span className="text-lg font-bold text-blue-400">
                    ₹ {Math.round(simLcCost).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="text-right border-l border-slate-700 pl-4">
                  <span className="text-slate-400 text-xs block">Line Total:</span>
                  <span className="text-2xl font-black text-white">
                    ₹ {Math.round(simLineTotal).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: VARIABLE & MATH CHEATSHEET */}
          {activeTab === 'cheatsheet' && (
            <div className="bg-white p-5 rounded-xl border border-[#E8E3D8] space-y-5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-[#3D6353] flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  Engineering Formula Variables, Math Functions & Error Calibration Guide
                </h4>
                <span className="text-xs text-[#5C6460] font-mono">
                  Supported Syntax: Standard JavaScript Math & Algebraic Expressions
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* 1. Dimensional & Physical Variables */}
                <div className="bg-[#FAF7F2] p-3.5 rounded-lg border border-[#E8E3D8] space-y-2">
                  <div className="font-bold text-slate-900 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#3D6353]"></span>
                    Dimensions & Physical Variables
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-slate-700">
                    <div><code className="text-[#3D6353] font-bold">L</code> : Length of plate/part (mm)</div>
                    <div><code className="text-[#3D6353] font-bold">W</code> : Width of plate/part (mm)</div>
                    <div><code className="text-[#3D6353] font-bold">T</code> : Thickness of plate (mm)</div>
                    <div><code className="text-[#3D6353] font-bold">d</code> : Diameter of circular shaft (mm)</div>
                    <div><code className="text-[#3D6353] font-bold">length</code> : Length of round bar (mm)</div>
                    <div><code className="text-[#3D6353] font-bold">density</code> : Material density (default 7.85e-6 kg/mm³)</div>
                    <div><code className="text-[#3D6353] font-bold">qty</code> : Part quantity in BOM</div>
                    <div><code className="text-[#3D6353] font-bold">weight</code> : Line weight (kg)</div>
                    <div><code className="text-[#3D6353] font-bold">total_weight</code> : Total steel weight (kg)</div>
                  </div>
                </div>

                {/* 2. Commercial & Labour Rates */}
                <div className="bg-[#FAF7F2] p-3.5 rounded-lg border border-[#E8E3D8] space-y-2">
                  <div className="font-bold text-slate-900 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    Commercial & Labour Rates
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-slate-700">
                    <div><code className="text-emerald-700 font-bold">rate / material_rate</code> : Raw material ₹/kg</div>
                    <div><code className="text-emerald-700 font-bold">labour_rate</code> : Cutting labour rate factor</div>
                    <div><code className="text-emerald-700 font-bold">labour_divisor</code> : Standard 1000 perimeter divider</div>
                    <div><code className="text-emerald-700 font-bold">mc</code> : Per-piece machining cost (₹)</div>
                    <div><code className="text-emerald-700 font-bold">rolling</code> : Shell rolling cost (₹)</div>
                    <div><code className="text-emerald-700 font-bold">finishing_rate</code> : Painting rate (default ₹20/kg)</div>
                    <div><code className="text-emerald-700 font-bold">fabrication_rate</code> : Shop floor fabrication (₹96/kg)</div>
                    <div><code className="text-emerald-700 font-bold">markup_pct</code> : Quoting margin % (e.g. 10)</div>
                  </div>
                </div>

                {/* 3. Mathematical Functions & Operators */}
                <div className="bg-[#FAF7F2] p-3.5 rounded-lg border border-[#E8E3D8] space-y-2">
                  <div className="font-bold text-slate-900 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                    Math Operators & Built-in Functions
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-slate-700">
                    <div><code className="text-amber-800 font-bold">+ - * /</code> : Basic algebraic operators</div>
                    <div><code className="text-amber-800 font-bold">^ or **</code> : Exponentiation (e.g. <code className="text-slate-600">d^2</code>)</div>
                    <div><code className="text-amber-800 font-bold">ceil(x)</code> : Rounds up to nearest integer</div>
                    <div><code className="text-amber-800 font-bold">floor(x)</code> : Rounds down to nearest integer</div>
                    <div><code className="text-amber-800 font-bold">round(x)</code> : Standard rounding</div>
                    <div><code className="text-amber-800 font-bold">sqrt(x)</code> : Square root</div>
                    <div><code className="text-amber-800 font-bold">max(a, b)</code> : Maximum of values</div>
                    <div><code className="text-amber-800 font-bold">min(a, b)</code> : Minimum of values</div>
                  </div>
                </div>
              </div>

              {/* Practical Formula Editing Examples */}
              <div className="bg-[#EEF5F1] p-4 rounded-xl border border-[#D0E2D7] text-xs space-y-2">
                <div className="font-bold text-[#3D6353] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Common Practical Formula Modifications (Copy or Adapt as Needed):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700 font-mono text-[11px]">
                  <div className="bg-white p-2.5 rounded-lg border border-[#D0E2D7]">
                    <span className="font-bold text-slate-900 block font-sans">Add +3% Kerf & Cutting Scrap Allowance:</span>
                    <code className="text-[#3D6353] font-bold block mt-1">L * W * T * density * qty * 1.03</code>
                    <span className="text-[10px] text-slate-500 font-sans block mt-0.5">Increases plate weight by 3% to cover laser/plasma cutting kerf loss.</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#D0E2D7]">
                    <span className="font-bold text-slate-900 block font-sans">Minus 2% Negative Weight Tolerance:</span>
                    <code className="text-[#3D6353] font-bold block mt-1">L * W * T * density * qty * 0.98</code>
                    <span className="text-[10px] text-slate-500 font-sans block mt-0.5">Accounts for mill thickness rolling tolerances.</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#D0E2D7]">
                    <span className="font-bold text-slate-900 block font-sans">High-Speed CNC Labour Rate (Divisor 1200):</span>
                    <code className="text-[#3D6353] font-bold block mt-1">((L + W) * 2 * T * labour_rate / 1200 + mc + rolling) * qty</code>
                    <span className="text-[10px] text-slate-500 font-sans block mt-0.5">Reduces machining labour cost by ~17% for high-speed automated cutting.</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#D0E2D7]">
                    <span className="font-bold text-slate-900 block font-sans">Quoted Price with 5% Dealer Discount:</span>
                    <code className="text-[#3D6353] font-bold block mt-1">total_cost * (1 + markup_pct / 100) * 0.95</code>
                    <span className="text-[10px] text-slate-500 font-sans block mt-0.5">Directly factors partner or volume discount into final price calculation.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EDITABLE GLOBAL FORMULA CONSTANTS BAR */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-bold">
              <Sliders className="w-4 h-4 text-[#f89030]" />
              <span>Global Master Calibration Constants:</span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Steel Density:</span>
                <input
                  type="number"
                  step="0.00000001"
                  value={densityMultiplier}
                  onChange={(e) => setDensityMultiplier?.(parseFloat(e.target.value) || 7.85e-6)}
                  className="w-24 px-2 py-1 rounded border border-slate-300 font-mono font-bold text-right"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">LC Divisor:</span>
                <input
                  type="number"
                  value={labourDivisor}
                  onChange={(e) => setLabourDivisor?.(parseFloat(e.target.value) || 1000)}
                  className="w-16 px-2 py-1 rounded border border-slate-300 font-mono font-bold text-right"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Finishing Rate:</span>
                <input
                  type="number"
                  value={finishingRatePerKg}
                  onChange={(e) => setFinishingRatePerKg?.(parseFloat(e.target.value) || 20)}
                  className="w-14 px-2 py-1 rounded border border-slate-300 font-mono font-bold text-right"
                />
                <span className="text-slate-500">₹/kg</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Fab Rate:</span>
                <input
                  type="number"
                  value={fabricationRatePerKg}
                  onChange={(e) => setFabricationRatePerKg?.(parseFloat(e.target.value) || 96)}
                  className="w-14 px-2 py-1 rounded border border-slate-300 font-mono font-bold text-right"
                />
                <span className="text-slate-500">₹/kg</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
