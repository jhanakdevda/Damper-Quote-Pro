import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  Save, 
  RotateCcw, 
  FileSpreadsheet, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sliders,
  Eye,
  Info,
  Layers,
  Clock,
  ArrowRight
  ,Plus,
  Trash2
} from 'lucide-react';
import Damper3DViewer from '../components/Damper3DViewer';
import FormulaInspector from '../components/FormulaInspector';
import TwoDDesignAnalyzer from '../components/TwoDDesignAnalyzer';
import initialCertifiedCostSheet from '../data/certified45Parts.json';
import { DEFAULT_FORMULAS, evaluateFormula } from '../utils/formulaEvaluator';
import { quotesApi, ratesApi } from '../services/api';
import apiClient from '../services/api';
import { formatINR, formatNumber, formatWeight } from '../utils/formatters';

// 5 Industrial Damper Types for Valve & Damper Manufacturing
const DAMPER_TYPES = [
  {
    id: 'rack-pinion',
    name: 'Rack & Pinion Sliding-Flap Damper',
    shortName: 'Rack & Pinion',
    badge: 'Flagship CTO • Full 45-Part BOM',
    description: 'Heavy-duty sliding blade driven by gear rack and pinions. Designed for large flue gas ducts, boiler isolation, and zero blade deflection.',
    typeFactor: 1.0,
    typicalApp: 'Thermal Power, Blast Furnaces, Heavy Industrial Ducts',
    stdActuator: 'Electric Multi-Turn Actuator with Bevel Gearbox',
  },
  {
    id: 'multi-blade',
    name: 'Multi-Blade (Louvered) Damper',
    shortName: 'Multi-Blade Louver',
    badge: 'Part D • Louvered Blades & Full Config',
    description: 'Heavy-duty multi-blade parallel or opposed aerodynamic design with interconnected external linkage rods, full frame/blade parametrization, and live blade schedule.',
    typeFactor: 1.0,
    typicalApp: 'ID/FD Fans, Air Preheaters, Boiler Flue Gas Regulation',
    stdActuator: 'Rotary Quarter-Turn Actuator with Linkage Bar',
  },
  {
    id: 'louver',
    name: 'Multi-Blade (Louvered) Damper (Alt)',
    shortName: 'Multi-Louver',
    badge: 'Aerofoil Blades • Flow Modulation',
    description: 'Multi-blade aerodynamic design with interconnected external linkage rods.',
    typeFactor: 1.0,
    typicalApp: 'ID/FD Fans, Air Preheaters, Boiler Flue Gas Regulation',
    stdActuator: 'Rotary Quarter-Turn Actuator with Linkage Bar',
  },
  {
    id: 'guillotine',
    name: 'Guillotine / Slide Gate Damper',
    badge: '100% Man-Safe • Bonnet Enclosure',
    description: 'Knife-edge solid gate plate entering an enclosed upper bonnet chamber. Provides 100% human-safe positive isolation for scrubber maintenance.',
    typeFactor: 1.15,
    typicalApp: 'Scrubber Isolation, Baghouse Filters, HRSG Ducts',
    stdActuator: 'Electric Lead Screw Drive or Twin Pneumatic Cylinders',
  },
  {
    id: 'butterfly',
    name: 'Circular / Wafer Butterfly Damper',
    shortName: 'Butterfly Damper',
    badge: 'Compact Face-to-Face • Low Headroom',
    description: 'Centrally pivoted disc blade providing high-temperature gas throttling in circular or square ducts with minimal structural footprint.',
    typeFactor: 0.75,
    typicalApp: 'Incinerator Exhaust, Cement Kilns, High-Temp Duct Lines',
    stdActuator: 'Direct-Coupled Rotary Actuator with Manual Handwheel',
  },
  {
    id: 'tandem',
    name: 'Tandem Bi-Plane Damper with Seal Air',
    shortName: 'Tandem Bi-Plane',
    badge: 'Pressurized Cavity • Zero Gas Leakage',
    description: 'Dual blade arrangement with an integrated seal air chamber fed by dedicated blower fans, preventing any hazardous flue gas ingress.',
    typeFactor: 1.35,
    typicalApp: 'Petrochemical, Toxic Gas Lines, Acid Gas Isolation',
    stdActuator: 'Dual Actuators with Interlocked Seal Air Fan System',
  },
];

// 4 Industrial Valve Types for Valve & Damper Manufacturing
const VALVE_TYPES = [
  {
    id: 'butterfly_valve',
    name: 'High-Performance / Triple Offset Butterfly Valve',
    shortName: 'Butterfly Valve',
    badge: 'API 609 / EN 593 • Fire-Safe API 607',
    description: 'Triple-offset rotary disc valve for zero-leakage throttling and tight isolation in flue gas, water, and industrial pipelines.',
    typeFactor: 1.0,
    typicalApp: 'Flue Gas Desulfurization, Cooling Water, Power Plants, Chemical Lines',
    stdActuator: 'Electric Quarter-Turn or Pneumatic Scotch Yoke',
  },
  {
    id: 'knife_gate_valve',
    name: 'Heavy-Duty Knife Gate Valve (Slurry & Ash)',
    shortName: 'Knife Gate Valve',
    badge: 'MSS SP-81 • Bi-directional / Uni-directional',
    description: 'Stainless steel beveled knife blade shears through heavy slurries, ash, fly-ash, and pulp with compact bonnetless body.',
    typeFactor: 1.15,
    typicalApp: 'Ash Handling, Mining Slurry, Paper Pulp, Wastewater Lines',
    stdActuator: 'Pneumatic Cylinder with Solenoid or Bevel Gear Handwheel',
  },
  {
    id: 'ball_valve',
    name: 'Industrial Trunnion / Floating Ball Valve',
    shortName: 'Ball Valve',
    badge: 'API 6D • Full Bore High-Pressure',
    description: 'Heavy-duty 2-piece / 3-piece bolted spherical body with low pressure drop and bubble-tight shutoff.',
    typeFactor: 1.25,
    typicalApp: 'Petroleum, Natural Gas, High-Pressure Steam Lines',
    stdActuator: 'Pneumatic Rack & Pinion or Electric Rotary Actuator',
  },
  {
    id: 'globe_valve',
    name: 'High-Pressure Cage Guided Globe Control Valve',
    shortName: 'Globe Control Valve',
    badge: 'ISA 75.01 • Linear Throttling',
    description: 'Precision linear control valve with parabolic contoured plug and hardened cage, built for tight pressure regulation.',
    typeFactor: 1.40,
    typicalApp: 'Boiler Feedwater, Steam Pressure Reduction, Chemical Dosing',
    stdActuator: 'Multi-Spring Diaphragm Actuator with Smart Positioner',
  },
];

const STANDARD_VALVE_DNS = [
  { dn: 50, inch: '2"' },
  { dn: 80, inch: '3"' },
  { dn: 100, inch: '4"' },
  { dn: 150, inch: '6"' },
  { dn: 200, inch: '8"' },
  { dn: 250, inch: '10"' },
  { dn: 300, inch: '12"' },
  { dn: 350, inch: '14"' },
  { dn: 400, inch: '16"' },
  { dn: 500, inch: '20"' },
  { dn: 600, inch: '24"' },
  { dn: 800, inch: '32"' },
  { dn: 1000, inch: '40"' },
  { dn: 1200, inch: '48"' },
];

export default function NewQuote({ setView, setSelectedQuoteId, user }) {
  // Product Category Switcher (Top Corner)
  const [productCategory, setProductCategory] = useState('damper'); // 'damper' | 'valve'

  // RFQ Inputs
  const [customerName, setCustomerName] = useState('Tata Steel Limited');
  const [projectRef, setProjectRef] = useState('PVDQ-26046 / Blast Furnace Gas Isolation');
  const [width, setWidth] = useState(3000);
  const [height, setHeight] = useState(3000);
  const [depth, setDepth] = useState(450);
  const [sizeLimits, setSizeLimits] = useState({ width_min_mm: 1000, width_max_mm: 6000, height_min_mm: 1000, height_max_mm: 6000, depth_min_mm: 300, depth_max_mm: 800 });
  const [dimensionUnit, setDimensionUnit] = useState('mm');
  const [numberOfBlades, setNumberOfBlades] = useState(12);
  const [opposedBlades, setOpposedBlades] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [markupMultiplier, setMarkupMultiplier] = useState(1.10); // 1.1 = 10% markup

  // Damper Type & Customization States
  const [selectedDamperTypeId, setSelectedDamperTypeId] = useState('rack-pinion');
  const [actuatorType, setActuatorType] = useState('electric'); // 'electric' | 'pneumatic' | 'manual' | 'hydraulic'
  const [bladeAction, setBladeAction] = useState('single-sliding');
  const [sealingEfficiency, setSealingEfficiency] = useState('99.5%');
  const [designTemp, setDesignTemp] = useState('ambient');
  const [designPressure, setDesignPressure] = useState('±500 mmWg');
  const [flangeType, setFlangeType] = useState('Both Ends Flanged (IS 2062)');
  const [show3DViewer, setShow3DViewer] = useState(true);

  // Valve Specific Configuration States
  const [selectedValveTypeId, setSelectedValveTypeId] = useState('butterfly_valve');
  const [valveSizeDn, setValveSizeDn] = useState(300);
  const [valvePressureRating, setValvePressureRating] = useState('PN 16');
  const [valveEndConnection, setValveEndConnection] = useState('Wafer');
  const [valveBodyMoc, setValveBodyMoc] = useState('WCB (Cast Carbon Steel ASTM A216)');
  const [valveTrimMoc, setValveTrimMoc] = useState('CF8M (Cast Stainless Steel SS316)');
  const [valveSeatMoc, setValveSeatMoc] = useState('PTFE / RTFE');
  const [valveActuator, setValveActuator] = useState('Electric Quarter-Turn Actuator');
  const [withLimitSwitch, setWithLimitSwitch] = useState(true);
  const [withSolenoidValve, setWithSolenoidValve] = useState(true);
  const [withPositioner, setWithPositioner] = useState(false);
  const [withAirFilterRegulator, setWithAirFilterRegulator] = useState(true);

  // Gate & Disc Blade Geometry States (for Rack & Pinion / Disc / Other damper types)
  const [gateThickness, setGateThickness] = useState(6.0); // mm
  const [gateStiffenerCount, setGateStiffenerCount] = useState(4);
  const [gateStiffenerType, setGateStiffenerType] = useState('Channel ISMC 75');
  const [gateRackCount, setGateRackCount] = useState(2);
  const [gateMaterial, setGateMaterial] = useState('IS 2062');
  const [gateClearance, setGateClearance] = useState(15.0);
  const [discThickness, setDiscThickness] = useState(10.0);
  const [discShaftDiameter, setDiscShaftDiameter] = useState(45.0);
  const [discMaterial, setDiscMaterial] = useState('IS 2062');
  const [discHubType, setDiscHubType] = useState('Double Hub Sleeve');

  // Multi-Blade Louver Specific Configuration States (Part D)
  const isMultiBlade = selectedDamperTypeId === 'multi-blade' || selectedDamperTypeId === 'louver';
  const [frameThickness, setFrameThickness] = useState(3.0);
  const [frameConstruction, setFrameConstruction] = useState('Channel Box'); // 'Channel Box' | 'Angle Frame'
  const [mbFlangeType, setMbFlangeType] = useState('Angle'); // 'Angle' | 'Flat Bar' | 'None'
  const [flangeWidth, setFlangeWidth] = useState(40.0);
  const [flangeThick, setFlangeThick] = useState(5.0);
  const [sections, setSections] = useState(1);
  const [bladeOrientation, setBladeOrientation] = useState('Horizontal'); // 'Horizontal' | 'Vertical'
  const [mounting, setMounting] = useState('In-duct'); // 'In-duct' | 'Wall'
  const [mbMaterial, setMbMaterial] = useState('IS 2062'); // 'IS 2062' | 'Galvanized' | 'SS 304' | 'SS 316'
  const [surfaceFinish, setSurfaceFinish] = useState('Painted'); // 'Painted' | 'Galvanized' | 'None'

  // Blade Geometry & Construction States
  const [bladeType, setBladeType] = useState('Flat single-skin sheet blade');
  const [bladeMode, setBladeMode] = useState('AUTO'); // 'AUTO' | 'CUSTOM'
  const [mbBladeAction, setMbBladeAction] = useState('Opposed'); // 'Opposed' | 'Parallel'
  const [targetPitch, setTargetPitch] = useState(150);
  const [targetCount, setTargetCount] = useState(12);
  const [manualBladeCount, setManualBladeCount] = useState(12);
  const [manualChord, setManualChord] = useState(165);
  const [bladeSpan, setBladeSpan] = useState(2900);
  const [bladeLength, setBladeLength] = useState(2900);
  const [bladeWidth, setBladeWidth] = useState(165);
  const [bladeHeight, setBladeHeight] = useState(165);
  const [bladeChord, setBladeChord] = useState(165);
  const [bladeDepth, setBladeDepth] = useState(25);
  const [bladeThick, setBladeThick] = useState(1.6);
  const [overlapPct, setOverlapPct] = useState(10.0);
  const [sideClearance, setSideClearance] = useState(5.0);
  const [endClearance, setEndClearance] = useState(5.0);
  const [openAngle, setOpenAngle] = useState(90.0);
  const [closedAngle, setClosedAngle] = useState(0.0);

  // Folded blade parameters
  const [webWidth, setWebWidth] = useState(100.0);
  const [flangeLeft, setFlangeLeft] = useState(20.0);
  const [flangeRight, setFlangeRight] = useState(20.0);
  const [edgeReturn, setEdgeReturn] = useState(8.0);
  const [foldAngle, setFoldAngle] = useState(45.0);
  const [foldDepth, setFoldDepth] = useState(14.0);
  const [numBends, setNumBends] = useState(4);

  // Double-skin blade parameters
  const [frontSkinThick, setFrontSkinThick] = useState(1.6);
  const [rearSkinThick, setRearSkinThick] = useState(1.6);
  const [overallBladeDepth, setOverallBladeDepth] = useState(30.0);
  const [edgeFlangeWidth, setEdgeFlangeWidth] = useState(15.0);
  const [internalStiffenerCount, setInternalStiffenerCount] = useState(2);
  const [internalStiffenerThick, setInternalStiffenerThick] = useState(2.0);
  const [internalStiffenerWidth, setInternalStiffenerWidth] = useState(25.0);

  // Aerofoil parameters
  const [maxProfileThick, setMaxProfileThick] = useState(25.0);
  const [leadingEdgeRadius, setLeadingEdgeRadius] = useState(6.0);
  const [trailingEdgeThick, setTrailingEdgeThick] = useState(2.0);
  const [camberPct, setCamberPct] = useState(0.0);
  const [profileDefinition, setProfileDefinition] = useState('NACA 0015 (Symmetric Aerofoil)');

  // Custom cross-section parameters
  const [customProfileShape, setCustomProfileShape] = useState('Z-profile');
  const [webDimension, setWebDimension] = useState(100.0);
  const [flangeDimension, setFlangeDimension] = useState(25.0);
  const [lipDimension, setLipDimension] = useState(10.0);
  const [profileDepth, setProfileDepth] = useState(25.0);

  const [edgeSeal, setEdgeSeal] = useState('Rubber'); // 'None' | 'Rubber' | 'Metal' | 'Ceramic Fibre'
  const [sideSeal, setSideSeal] = useState('Stainless Steel'); // 'None' | 'Stainless Steel' | 'Flexible'

  const [shaftDiameter, setShaftDiameter] = useState(16.0);
  const [shaftType, setShaftType] = useState('Round'); // 'Round' | 'Square' | 'Hollow'
  const [shaftMaterial, setShaftMaterial] = useState('EN8'); // 'EN8' | 'SS 304' | 'SS 316'
  const [bearingType, setBearingType] = useState('Bush'); // 'Bush' | 'Ball' | 'Sealed'
  const [linkageType, setLinkageType] = useState('Side-mounted crank & tie rod');

  const [mbActuatorType, setMbActuatorType] = useState('Electric Actuator');
  const [hasLimitSwitch, setHasLimitSwitch] = useState(false);
  const [hasSolenoid, setHasSolenoid] = useState(false);
  const [hasPositioner, setHasPositioner] = useState(false);

  const [tempC, setTempC] = useState(60.0);
  const [pressurePa, setPressurePa] = useState(1000.0);
  const [velocityMps, setVelocityMps] = useState(8.0);
  const [leakageClass, setLeakageClass] = useState('Class II');

  // Database base parts & rates (Pre-loaded with Certified 45-Part Schedule so table is never blank)
  const [rawParts, setRawParts] = useState(initialCertifiedCostSheet?.lines || []);
  const [calcResult, setCalcResult] = useState(initialCertifiedCostSheet || null);
  const [manualBomEdits, setManualBomEdits] = useState({});
  const [bomAdditions, setBomAdditions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // Formula & Error / Tolerance Calibration States (Matching Reference Pages 5 & 6)
  const [densityMultiplier, setDensityMultiplier] = useState(7.85e-6);
  const [cuttingTolerancePct, setCuttingTolerancePct] = useState(0); // +/- % cutting & scrap error allowance
  const [labourDivisor, setLabourDivisor] = useState(1000); // divider in labour formula: (L+W)*2*T*LC/1000
  const [finishingRatePerKg, setFinishingRatePerKg] = useState(20.0);
  const [fabricationRatePerKg, setFabricationRatePerKg] = useState(96.0);
  const [lineErrorOverrides, setLineErrorOverrides] = useState({}); // sr_no -> +/- error in Rs

  // Editable rates state
  // Default values match PVDQ_26046_COST_SHEET.xlsx
  const defaultRates = {
    material_rates: {
      'IS 2062': 72.0,
      'SS 304L': 250.0,
      'SS 410': 120.0,
      'EN8': 95.0,
    },
    labour_rates: {
      'IS 2062': 10.0,
      'SS 304L': 15.0,
      'SS 410': 1.0,
      'EN8': 1.0,
    },
    bought_out_prices: {
      rack_base: 20000.0,
      drive_pinion: 5000.0,
      free_pinion: 5000.0,
      bearing: 13000.0,
      hardware: 50000.0,
      gland_packing_unit: 200.0,
      finishing_rate_per_kg: 20.0,
    },
    automation_prices: {
      actuator: 200000.0,
      gearbox: 100000.0,
      misc: 50000.0,
      manual_override: 0.0,
    },
    fabrication_rate_per_kg: 96.0,
    finishing_rate_per_kg: 20.0,
    markup_pct: 10.0,
  };

  const [activeRates, setActiveRates] = useState(defaultRates);
  // Per-line specific custom rate overrides (by sr_no)
  const [lineRateOverrides, setLineRateOverrides] = useState({});
  const [lineMcOverrides, setLineMcOverrides] = useState({});
  const [lineLcRateOverrides, setLineLcRateOverrides] = useState({});
  const [customFormulas, setCustomFormulas] = useState(DEFAULT_FORMULAS);

  const handleUpdateFormula = (key, val) => {
    setCustomFormulas(prev => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleResetFormulas = () => {
    setCustomFormulas(DEFAULT_FORMULAS);
  };

  // Fetch initial calculation
  useEffect(() => {
    fetchInitialCalculation();
    apiClient.get('/admin/size-limits').then((res) => setSizeLimits(res.data)).catch((err) => console.error('Size limits load error:', err));
  }, []);

  const fetchInitialCalculation = async () => {
    try {
      setLoading(true);
      const res = await quotesApi.calculate({
        damper_type: 'rack_and_pinion',
        width_mm: 3000,
        height_mm: 3000,
        depth_mm: 450,
        quantity: 1,
        markup_pct: 10.0,
      });
      if (res && res.lines && res.lines.length > 0) {
        setCalcResult(res);
        setRawParts(res.lines);
      }
    } catch (err) {
      console.warn('Initial calculation offline fallback: using certified 45 parts schedule', err);
    } finally {
      setLoading(false);
    }
  };

  // Build complete multi-blade configuration
  const buildMultiBladeConfig = () => {
    if (!isMultiBlade) return undefined;
    return {
      width_mm: Number(width),
      height_mm: Number(height),
      depth_mm: Number(depth),
      frame_thickness_mm: Number(frameThickness),
      frame_construction: frameConstruction,
      flange_type: mbFlangeType,
      flange_width_mm: Number(flangeWidth),
      flange_thickness_mm: Number(flangeThick),
      sections: Number(sections),
      blade_orientation: bladeOrientation,
      mounting: mounting,
      material: mbMaterial,
      surface_finish: surfaceFinish,

      // Blade Geometry & Construction
      blade_type: bladeType,
      blade_action: mbBladeAction,
      blade_mode: bladeMode,
      open_angle_deg: Number(openAngle),
      closed_angle_deg: Number(closedAngle),

      // Dimensions
      blade_span_mm: bladeMode === 'CUSTOM' ? Number(bladeSpan) : undefined,
      blade_length_mm: bladeMode === 'CUSTOM' ? Number(bladeSpan) : undefined,
      blade_chord_mm: bladeMode === 'CUSTOM' ? Number(bladeChord || manualChord) : undefined,
      blade_depth_mm: bladeMode === 'CUSTOM' ? Number(bladeDepth) : undefined,
      blade_thickness_mm: Number(bladeThick),
      blade_count: bladeMode === 'CUSTOM' ? Number(manualBladeCount) : undefined,
      target_pitch_mm: bladeMode === 'AUTO' && targetPitch ? Number(targetPitch) : undefined,
      target_blade_count: bladeMode === 'AUTO' && targetCount ? Number(targetCount) : undefined,
      overlap_pct: Number(overlapPct),
      side_clearance_mm: Number(sideClearance),
      end_clearance_mm: Number(endClearance),

      // Folded
      web_width_mm: Number(webWidth),
      flange_left_mm: Number(flangeLeft),
      flange_right_mm: Number(flangeRight),
      edge_return_mm: Number(edgeReturn),
      fold_angle_deg: Number(foldAngle),
      fold_depth_mm: Number(foldDepth),
      num_bends: Number(numBends),

      // Double skin
      front_skin_thick_mm: Number(frontSkinThick),
      rear_skin_thick_mm: Number(rearSkinThick),
      overall_blade_depth_mm: Number(overallBladeDepth),
      internal_cavity_depth_mm: Math.max(0, Number(overallBladeDepth) - Number(frontSkinThick) - Number(rearSkinThick)),
      edge_flange_width_mm: Number(edgeFlangeWidth),
      internal_stiffener_count: Number(internalStiffenerCount),
      internal_stiffener_thick_mm: Number(internalStiffenerThick),
      internal_stiffener_width_mm: Number(internalStiffenerWidth),

      // Aerofoil
      max_profile_thickness_mm: Number(maxProfileThick),
      leading_edge_radius_mm: Number(leadingEdgeRadius),
      trailing_edge_thickness_mm: Number(trailingEdgeThick),
      camber_pct: Number(camberPct),
      profile_definition: profileDefinition,

      // Custom
      custom_profile_shape: customProfileShape,
      web_dimension_mm: Number(webDimension),
      flange_dimension_mm: Number(flangeDimension),
      lip_dimension_mm: Number(lipDimension),
      profile_depth_mm: Number(profileDepth),

      // Shaft, seals, actuation
      edge_seal: edgeSeal,
      side_seal: sideSeal,
      shaft_diameter_mm: Number(shaftDiameter),
      shaft_type: shaftType,
      shaft_material: shaftMaterial,
      bearing_type: bearingType,
      linkage_type: linkageType,
      actuator_type: mbActuatorType,
      has_limit_switch: Boolean(hasLimitSwitch),
      has_solenoid: Boolean(hasSolenoid),
      has_positioner: Boolean(hasPositioner),
      temperature_c: Number(tempC),
      max_pressure_pa: Number(pressurePa),
      max_velocity_mps: Number(velocityMps),
      leakage_class: leakageClass,
    };
  };

  // Perform Live Calculation whenever dimensions, quantity, markup, rates, or valve parameters change
  useEffect(() => {
    if (productCategory === 'damper') {
      if (width < sizeLimits.width_min_mm || width > sizeLimits.width_max_mm || height < sizeLimits.height_min_mm || height > sizeLimits.height_max_mm || depth < sizeLimits.depth_min_mm || depth > sizeLimits.depth_max_mm || quantity < 1) {
        return;
      }
    } else {
      if (!valveSizeDn || valveSizeDn < 50 || quantity < 1) {
        return;
      }
    }

    const timer = setTimeout(() => {
      recalculateSheet();
    }, 200);

    return () => clearTimeout(timer);
  }, [
    productCategory, selectedValveTypeId, valveSizeDn, valvePressureRating, valveEndConnection,
    valveBodyMoc, valveTrimMoc, valveSeatMoc, valveActuator, withLimitSwitch, withSolenoidValve, withPositioner, withAirFilterRegulator,
    width, height, depth, quantity, markupMultiplier, selectedDamperTypeId,
    activeRates, lineRateOverrides, lineMcOverrides, lineLcRateOverrides, manualBomEdits, bomAdditions, sizeLimits,
    frameThickness, frameConstruction, mbFlangeType, flangeWidth, flangeThick, sections,
    bladeOrientation, mounting, mbMaterial, surfaceFinish, bladeType, mbBladeAction,
    bladeMode, targetPitch, targetCount, manualBladeCount, manualChord, bladeSpan, bladeChord, bladeDepth,
    overlapPct, bladeThick, sideClearance, endClearance, openAngle, closedAngle,
    webWidth, flangeLeft, flangeRight, edgeReturn, foldAngle, foldDepth, numBends,
    frontSkinThick, rearSkinThick, overallBladeDepth, edgeFlangeWidth, internalStiffenerCount, internalStiffenerThick, internalStiffenerWidth,
    maxProfileThick, leadingEdgeRadius, trailingEdgeThick, camberPct, profileDefinition,
    customProfileShape, webDimension, flangeDimension, lipDimension, profileDepth,
    edgeSeal, sideSeal, shaftDiameter, shaftType, shaftMaterial, bearingType, linkageType,
    mbActuatorType, hasLimitSwitch, hasSolenoid, hasPositioner, tempC, pressurePa, velocityMps, leakageClass,
    actuatorType, bladeAction, sealingEfficiency, designTemp, designPressure, flangeType,
    gateThickness, gateStiffenerCount, gateStiffenerType, gateRackCount, gateMaterial, discThickness, discShaftDiameter
  ]);

  const currentBomEdits = () => {
    const edits = Object.entries(manualBomEdits).map(([line_index, edit]) => ({ line_index: Number(line_index), ...edit }));
    (calcResult?.lines || []).forEach((line, index) => {
      const lineIndex = line.source_line_index ?? index;
      const rateEdit = {};
      if (lineRateOverrides[line.sr_no] !== undefined) rateEdit.material_rate = lineRateOverrides[line.sr_no];
      if (lineMcOverrides[line.sr_no] !== undefined) rateEdit.per_piece_machining = lineMcOverrides[line.sr_no];
      if (lineLcRateOverrides[line.sr_no] !== undefined) rateEdit.plate_labour_rate = lineLcRateOverrides[line.sr_no];
      if (Object.keys(rateEdit).length) {
        const existingIndex = edits.findIndex((entry) => entry.line_index === lineIndex);
        if (existingIndex >= 0) edits[existingIndex] = { ...edits[existingIndex], ...rateEdit };
        else edits.push({ line_index: lineIndex, ...rateEdit });
      }
    });
    return edits;
  };

  const updateBomField = (lineIndex, field, value) => setManualBomEdits((current) => {
    const nextLine = {
      ...current[lineIndex],
      [field]: value,
      edit_note: current[lineIndex]?.edit_note || 'Manual BOM edit',
    };
    if (field !== 'line_total' && field !== 'is_delete' && field !== 'edit_note' && field !== 'moc') {
      delete nextLine.line_total;
    }
    return { ...current, [lineIndex]: nextLine };
  });

  const readNumber = (raw, fallback = 0) => {
    if (raw === '' || raw === null || raw === undefined) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const addCustomBomLine = () => setBomAdditions((current) => [...current, {
    part_name: `Custom line ${current.length + 1}`, dim_1: 100, dim_2: 50, dim_3: 5,
    qty: 1, moc: 'IS 2062', material_rate: activeRates.material_rates['IS 2062'],
    plate_labour_rate: activeRates.labour_rates['IS 2062'], per_piece_machining: 0, rolling_cost: 0,
  }]);

  const recalculateSheet = async () => {
    try {
      const markupPct = (markupMultiplier - 1.0) * 100.0;
      const isValveMode = productCategory === 'valve';

      const valveConfig = isValveMode ? {
        valve_type: selectedValveTypeId,
        size_dn: Number(valveSizeDn),
        pressure_rating: valvePressureRating,
        end_connection: valveEndConnection,
        body_moc: valveBodyMoc,
        trim_moc: valveTrimMoc,
        seat_moc: valveSeatMoc,
        actuation_type: valveActuator,
        with_limit_switch: withLimitSwitch,
        with_solenoid_valve: withSolenoidValve,
        with_positioner: withPositioner,
        with_air_filter_regulator: withAirFilterRegulator,
      } : null;

      const payload = {
        product_category: isValveMode ? 'valve' : 'damper',
        damper_type: isValveMode ? selectedValveTypeId : (isMultiBlade ? 'multi_blade' : 'rack_and_pinion'),
        valve_config: valveConfig,
        multi_blade_config: isValveMode ? null : buildMultiBladeConfig(),
        width_mm: isValveMode ? Number(valveSizeDn) : Number(width),
        height_mm: isValveMode ? Number(valveSizeDn) : Number(height),
        depth_mm: isValveMode ? 200 : Number(depth),
        quantity: Number(quantity),
        markup_pct: Math.max(0, markupPct),
        rate_overrides: {
          material_rates: activeRates.material_rates,
          labour_rates: activeRates.labour_rates,
          bought_out_prices: activeRates.bought_out_prices,
          automation_prices: activeRates.automation_prices,
          fabrication_rate_per_kg: activeRates.fabrication_rate_per_kg,
          finishing_rate_per_kg: activeRates.finishing_rate_per_kg,
          default_markup_pct: Math.max(0, markupPct),
        },
        bom_edits: currentBomEdits(),
        bom_additions: bomAdditions,
      };
      const res = await quotesApi.calculate(payload);
      setCalcResult(res);
    } catch (err) {
      console.error('Calculation error:', err);
    }
  };

  const handleResetRates = () => {
    setActiveRates(defaultRates);
    setLineRateOverrides({});
    setLineMcOverrides({});
    setLineLcRateOverrides({});
    setLineErrorOverrides({});
    setCuttingTolerancePct(0);
    setDensityMultiplier(7.85e-6);
    setLabourDivisor(1000);
    setFabricationRatePerKg(96.0);
    setFinishingRatePerKg(20.0);
    setManualBomEdits({});
    setBomAdditions([]);
    setWidth(3000);
    setHeight(3000);
    setDepth(450);
    setQuantity(1);
    setMarkupMultiplier(1.10);
    setSections(1);
  };

  // Apply suggested components from 2D Engineering Blueprint
  const handleApply2DComponents = (selectedComps, blueprint) => {
    const additions = (selectedComps || []).map(c => ({
      part_name: c.name,
      dim_1: c.dim1 || 100,
      dim_2: c.dim2 || 50,
      dim_3: c.dim3 || 6,
      qty: c.qty || 1,
      moc: c.moc || 'IS 2062',
      material_rate: c.unitRate || activeRates.material_rates[c.moc] || 75,
      plate_labour_rate: activeRates.labour_rates[c.moc] || 10,
      per_piece_machining: c.isRound ? 150 : 0,
      rolling_cost: 0,
      is_round: !!c.isRound,
      edit_note: `2D Blueprint: ${c.role || 'Suggested Part'}`,
    }));
    setBomAdditions(prev => [...prev, ...additions]);

    if (blueprint?.dims) {
      if (blueprint.dims.width) setWidth(Number(blueprint.dims.width));
      if (blueprint.dims.height) setHeight(Number(blueprint.dims.height));
      if (blueprint.dims.depth) setDepth(Number(blueprint.dims.depth));
      if (blueprint.dims.sizeDn) {
        setProductCategory('valve');
        setValveSizeDn(Number(blueprint.dims.sizeDn));
      }
    }
  };

  const handleSelectDimensions = (dims, cat, type) => {
    if (cat === 'valve') {
      setProductCategory('valve');
      if (type) setSelectedValveTypeId(type);
      if (dims?.sizeDn) setValveSizeDn(Number(dims.sizeDn));
    } else {
      setProductCategory('damper');
      if (type) setSelectedDamperTypeId(type);
      if (dims?.width) setWidth(Number(dims.width));
      if (dims?.height) setHeight(Number(dims.height));
      if (dims?.depth) setDepth(Number(dims.depth));
    }
  };

  // Download Live Excel Spreadsheet with Full 45-Part Schedule and Dynamic Formulas
  const handleDownloadExcel = () => {
    const liveLines = (displayLines || []).map((l, idx) => ({
      sr_no: l.sr_no || (idx + 1),
      part_name: l.part_name,
      is_round: !!l.is_round,
      dim_1: l.dim1 ?? l.dim_1 ?? 0,
      dim_2: l.dim2 ?? l.dim_2 ?? 0,
      dim_3: l.dim3 ?? l.dim_3 ?? 0,
      qty: l.quantity ?? l.qty ?? 1,
      weight: l.total_weight,
      moc: l.moc,
      material_rate: l.active_mat_rate ?? l.material_rate ?? 75,
      rm_cost: l.active_rm_cost ?? l.rm_cost ?? 0,
      plate_labour_rate: l.active_lc_rate ?? l.plate_labour_rate ?? 10,
      plate_labour_cost: l.active_lc_cost ?? l.plate_labour_cost ?? 0,
      per_piece_machining: l.active_mc ?? l.per_piece_machining ?? 0,
      rolling_cost: l.rolling_cost || 0,
      mfg_cost_total: l.active_total_mc ?? l.mfg_cost_total ?? 0,
      line_total: l.active_line_total ?? l.line_total ?? 0,
      is_manually_edited: l.is_manually_edited,
      edit_note: l.edit_note,
    }));

    const liveData = {
      id: calcResult?.id,
      quote_number: quoteNumber || (calcResult?.quote_number || 'DRAFT-45PARTS'),
      customer_name: customerName || 'Valued Customer',
      damper_type: isValveMode ? selectedValveTypeId : (isMultiBlade ? 'multi_blade' : 'rack_and_pinion'),
      width_mm: Number(width),
      height_mm: Number(height),
      depth_mm: Number(depth),
      quantity: Number(quantity),
      markup_pct: (markupMultiplier - 1.0) * 100.0,
      total_weight_kg: totalWeight,
      raw_material_cost: totalRmCost,
      mfg_cost: totalMcCost,
      lines: liveLines,
      rates_snapshot: {
        ...activeRates,
        fabrication_rate_per_kg: fabricationRatePerKg,
        finishing_rate_per_kg: finishingRatePerKg,
      },
      bought_out_breakdown: calcResult?.bought_out_breakdown || {},
      automation_breakdown: calcResult?.automation_breakdown || {},
      basic_cost: damperBasicCost,
      automation_cost: damperAutomationCost,
      fabrication_cost: fabricationCost,
      total_cost: totalDamperCost,
      quoted_price: unitQuotedPrice,
    };

    if (calcResult?.id) {
      quotesApi.downloadExcel(calcResult.id);
    } else {
      quotesApi.downloadExcel(liveData);
    }
  };

  // Download Live Quotation PDF
  const handleDownloadPdf = () => {
    const liveLines = (displayLines || []).map((l, idx) => ({
      sr_no: l.sr_no || (idx + 1),
      part_name: l.part_name,
      is_round: !!l.is_round,
      dim_1: l.dim1 ?? l.dim_1 ?? 0,
      dim_2: l.dim2 ?? l.dim_2 ?? 0,
      dim_3: l.dim3 ?? l.dim_3 ?? 0,
      qty: l.quantity ?? l.qty ?? 1,
      weight: l.total_weight,
      moc: l.moc,
      material_rate: l.active_mat_rate ?? l.material_rate ?? 75,
      rm_cost: l.active_rm_cost ?? l.rm_cost ?? 0,
      plate_labour_rate: l.active_lc_rate ?? l.plate_labour_rate ?? 10,
      plate_labour_cost: l.active_lc_cost ?? l.plate_labour_cost ?? 0,
      per_piece_machining: l.active_mc ?? l.per_piece_machining ?? 0,
      rolling_cost: l.rolling_cost || 0,
      mfg_cost_total: l.active_total_mc ?? l.mfg_cost_total ?? 0,
      line_total: l.active_line_total ?? l.line_total ?? 0,
      is_manually_edited: l.is_manually_edited,
      edit_note: l.edit_note,
    }));

    const liveData = {
      id: calcResult?.id,
      quote_number: quoteNumber || (calcResult?.quote_number || 'DRAFT-45PARTS'),
      customer_name: customerName || 'Valued Customer',
      damper_type: isValveMode ? selectedValveTypeId : (isMultiBlade ? 'multi_blade' : 'rack_and_pinion'),
      width_mm: Number(width),
      height_mm: Number(height),
      depth_mm: Number(depth),
      quantity: Number(quantity),
      markup_pct: (markupMultiplier - 1.0) * 100.0,
      total_weight_kg: totalWeight,
      raw_material_cost: totalRmCost,
      mfg_cost: totalMcCost,
      lines: liveLines,
      rates_snapshot: {
        ...activeRates,
        fabrication_rate_per_kg: fabricationRatePerKg,
        finishing_rate_per_kg: finishingRatePerKg,
      },
      bought_out_breakdown: calcResult?.bought_out_breakdown || {},
      automation_breakdown: calcResult?.automation_breakdown || {},
      basic_cost: damperBasicCost,
      automation_cost: damperAutomationCost,
      fabrication_cost: fabricationCost,
      total_cost: totalDamperCost,
      quoted_price: unitQuotedPrice,
    };

    if (calcResult?.id) {
      quotesApi.downloadPdf(calcResult.id);
    } else {
      quotesApi.downloadPdf(liveData);
    }
  };

  const handleSaveQuote = async () => {
    if (!customerName.trim()) {
      alert('Please enter a Customer Name.');
      return;
    }
    if (isMultiBlade && calcResult?.validation_errors?.length > 0) {
      alert(`Cannot save quote: Please resolve validation errors:\n${calcResult.validation_errors.map(e => '• ' + e.message).join('\n')}`);
      return;
    }
    try {
      setSaving(true);
      const markupPct = (markupMultiplier - 1.0) * 100.0;
      const mbConfig = buildMultiBladeConfig();

      const valveConfig = isValveMode ? {
        valve_type: selectedValveTypeId,
        size_dn: Number(valveSizeDn),
        pressure_rating: valvePressureRating,
        end_connection: valveEndConnection,
        body_moc: valveBodyMoc,
        trim_moc: valveTrimMoc,
        seat_moc: valveSeatMoc,
        actuation_type: valveActuator,
        with_limit_switch: withLimitSwitch,
        with_solenoid_valve: withSolenoidValve,
        with_positioner: withPositioner,
        with_air_filter_regulator: withAirFilterRegulator,
      } : null;

      const payload = {
        customer_name: customerName,
        customer_company: customerName,
        project_name: projectRef,
        product_category: isValveMode ? 'valve' : 'damper',
        damper_type: isValveMode ? selectedValveTypeId : (isMultiBlade ? 'multi_blade' : 'rack_and_pinion'),
        valve_type: isValveMode ? selectedValveTypeId : null,
        valve_config: valveConfig,
        multi_blade_config: isValveMode ? null : mbConfig,
        width_mm: isValveMode ? Number(valveSizeDn) : Number(width),
        height_mm: isValveMode ? Number(valveSizeDn) : Number(height),
        depth_mm: isValveMode ? 200 : Number(depth),
        quantity: Number(quantity),
        markup_pct: Math.max(0, markupPct),
        rate_overrides: {
          material_rates: activeRates.material_rates,
          labour_rates: activeRates.labour_rates,
          bought_out_prices: activeRates.bought_out_prices,
          automation_prices: activeRates.automation_prices,
          fabrication_rate_per_kg: activeRates.fabrication_rate_per_kg,
          finishing_rate_per_kg: activeRates.finishing_rate_per_kg,
        },
        bom_edits: currentBomEdits(),
        bom_additions: bomAdditions,
      };
      const res = await quotesApi.saveQuote(payload);
      setSaveSuccess(res);
      alert(`Quote saved successfully as ${res.quote_number}!`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save quote.');
    } finally {
      setSaving(false);
    }
  };

  // Helper for material rate changes
  const updateMatRate = (moc, val) => {
    const num = parseFloat(val) || 0;
    setActiveRates(prev => ({
      ...prev,
      material_rates: {
        ...prev.material_rates,
        [moc]: num,
      }
    }));
  };

  const updateBoughtOutRate = (key, val) => {
    const num = parseFloat(val) || 0;
    setActiveRates(prev => ({
      ...prev,
      bought_out_prices: {
        ...prev.bought_out_prices,
        [key]: num,
      }
    }));
  };

  const updateAutomationRate = (key, val) => {
    const num = parseFloat(val) || 0;
    setActiveRates(prev => ({
      ...prev,
      automation_prices: {
        ...prev.automation_prices,
        [key]: num,
      }
    }));
  };

  // Check if non-reference dimensions
  const isBaseSize = width === 3000 && height === 3000 && depth === 450;

  // Current Product Definitions
  const isValveMode = productCategory === 'valve';
  const currentValveType = VALVE_TYPES.find(v => v.id === selectedValveTypeId) || VALVE_TYPES[0];
  const currentDamperType = DAMPER_TYPES.find(d => d.id === selectedDamperTypeId) || DAMPER_TYPES[0];
  const typeMultiplier = currentDamperType.typeFactor || 1.0;

  // Compute calculated line values using local edits and formula calibration so inline cells stay customizable
  const displayLines = useMemo(() => {
    if (!calcResult?.lines) return [];
    const effectiveDensity = (Number(densityMultiplier) || 7.85e-6) * (1 + (Number(cuttingTolerancePct) / 100));
    const effectiveDivisor = Number(labourDivisor) || 1000.0;

    return calcResult.lines.map((line, index) => {
      const lineIndex = line.source_line_index ?? index;
      const edit = manualBomEdits[lineIndex] || {};
      const dim1 = Number(edit.dim_1 ?? line.dim_1 ?? line.dim1 ?? 0);
      const dim2 = Number(edit.dim_2 ?? line.dim_2 ?? line.dim2 ?? 0);
      const dim3 = Number(edit.dim_3 ?? line.dim_3 ?? line.dim3 ?? 0);
      const qty = Math.max(1, Number(edit.qty ?? line.qty ?? line.quantity ?? 1) || 1);
      const moc = edit.moc ?? line.moc ?? '';
      const isRound = !!line.is_round;
      const origQty = Number(line.qty ?? line.quantity ?? 1) || 1;
      const origWeight = Number(line.weight ?? line.total_weight ?? 0);
      const origRm = Number(line.rm_cost || 0);
      const origMfg = Number(line.mfg_cost_total ?? line.mfg_cost ?? 0);
      const origTotal = Number(line.line_total ?? line.total_cost ?? (origRm + origMfg));

      const customMatRate = Number(
        edit.material_rate ?? lineRateOverrides[line.sr_no] ?? line.material_rate ?? 0
      );
      const customLcRate = Number(
        edit.plate_labour_rate ?? lineLcRateOverrides[line.sr_no] ?? line.plate_labour_rate ?? (isRound ? 0 : 10)
      );
      const customMc = Number(
        edit.per_piece_machining ?? lineMcOverrides[line.sr_no] ?? line.per_piece_machining ?? 0
      );
      const errorAdj = Number(
        edit.error_allowance ?? lineErrorOverrides[line.sr_no] ?? 0
      );
      const rollingCost = Number(line.rolling_cost ?? 0);
      const hasPlate = dim1 > 0 && dim2 > 0 && (isRound || dim3 > 0);
      const rateOverridden = edit.material_rate !== undefined || lineRateOverrides[line.sr_no] !== undefined;
      const mcOverridden = edit.per_piece_machining !== undefined || lineMcOverrides[line.sr_no] !== undefined;

      const lineContext = {
        L: dim1,
        W: dim2,
        T: dim3,
        d: dim1,
        length: dim2,
        density: effectiveDensity,
        qty,
        rate: customMatRate,
        material_rate: customMatRate,
        labour_rate: customLcRate,
        labour_divisor: effectiveDivisor,
        mc: customMc,
        rolling: rollingCost,
        weight: 0,
      };

      let weight = origWeight;
      if (hasPlate) {
        weight = isRound
          ? evaluateFormula(customFormulas.roundWeight || DEFAULT_FORMULAS.roundWeight, lineContext, 0.785 * dim1 * dim1 * dim2 * effectiveDensity * qty)
          : evaluateFormula(customFormulas.plateWeight || DEFAULT_FORMULAS.plateWeight, lineContext, dim1 * dim2 * dim3 * effectiveDensity * qty);
      } else if (origQty > 0 && qty !== origQty) {
        weight = (origWeight / origQty) * qty * (1 + (Number(cuttingTolerancePct) / 100));
      }

      lineContext.weight = weight;
      lineContext.total_weight = weight;

      let rm_cost;
      let lc_cost = 0;
      let total_mc;
      if (hasPlate) {
        rm_cost = evaluateFormula(customFormulas.rawMaterial || DEFAULT_FORMULAS.rawMaterial, lineContext, weight * customMatRate);
        lc_cost = isRound ? 0 : ((dim1 + dim2) * 2 * dim3 * customLcRate / effectiveDivisor);
        lineContext.labour_cost = lc_cost;
        total_mc = isRound
          ? (customMc + rollingCost) * qty
          : evaluateFormula(
              customFormulas.machiningLabour || DEFAULT_FORMULAS.machiningLabour,
              lineContext,
              (lc_cost + rollingCost + customMc) * qty
            );
      } else {
        rm_cost = rateOverridden 
          ? evaluateFormula(customFormulas.rawMaterial || DEFAULT_FORMULAS.rawMaterial, lineContext, weight * customMatRate)
          : origRm;
        total_mc = mcOverridden ? customMc * qty : origMfg;
      }

      let line_total = (hasPlate ? (rm_cost + total_mc) : (origTotal - origRm - origMfg + rm_cost + total_mc)) + errorAdj;
      if (edit.line_total !== undefined && edit.line_total !== null && edit.line_total !== '') {
        line_total = Number(edit.line_total) || 0;
      }

      return {
        ...line,
        source_line_index: lineIndex,
        dim1,
        dim2,
        dim3,
        quantity: qty,
        moc,
        total_weight: weight,
        is_round: isRound,
        active_mat_rate: customMatRate,
        active_lc_rate: customLcRate,
        active_mc: hasPlate ? customMc : (mcOverridden ? customMc : (line.mfg_cost ?? customMc)),
        active_rm_cost: rm_cost,
        active_lc_cost: lc_cost,
        active_total_mc: total_mc,
        active_error_adj: errorAdj,
        active_line_total: line_total,
        is_manually_edited: line.is_manually_edited || Object.keys(edit).length > 0 || errorAdj !== 0,
      };
    });
  }, [calcResult, manualBomEdits, lineRateOverrides, lineLcRateOverrides, lineMcOverrides, lineErrorOverrides, densityMultiplier, cuttingTolerancePct, labourDivisor, customFormulas]);

  const isCustomFormulasActive = useMemo(() => {
    return Object.keys(DEFAULT_FORMULAS).some(k => customFormulas[k] && customFormulas[k] !== DEFAULT_FORMULAS[k]);
  }, [customFormulas]);

  // Totals computed from the visible (possibly customized) cost sheet
  const hasSheetEdits = Object.keys(manualBomEdits).length > 0
    || Object.keys(lineRateOverrides).length > 0
    || Object.keys(lineMcOverrides).length > 0
    || Object.keys(lineLcRateOverrides).length > 0
    || Object.keys(lineErrorOverrides).length > 0
    || bomAdditions.length > 0
    || cuttingTolerancePct !== 0
    || densityMultiplier !== 7.85e-6
    || labourDivisor !== 1000
    || isCustomFormulasActive;

  const sheetWeight = displayLines.reduce((acc, l) => acc + (Number(l.total_weight) || 0), 0);
  const sheetRmCost = displayLines.reduce((acc, l) => acc + (Number(l.active_rm_cost) || 0), 0);
  const sheetMcCost = displayLines.reduce((acc, l) => acc + (Number(l.active_total_mc) || 0), 0);
  const sheetLineTotal = displayLines.reduce((acc, l) => acc + (Number(l.active_line_total) || 0), 0);
  const engineLineTotal = (calcResult?.lines || []).reduce((acc, line) => (
    acc + Number(line.line_total ?? line.total_cost ?? ((line.rm_cost || 0) + (line.mfg_cost_total ?? line.mfg_cost ?? 0)))
  ), 0);
  const fabricatedDelta = hasSheetEdits ? (sheetLineTotal - engineLineTotal) : 0;

  const totalWeight = hasSheetEdits || (!isValveMode && !isMultiBlade)
    ? sheetWeight
    : (calcResult?.total_weight_kg ?? sheetWeight);

  const totalRmCost = hasSheetEdits || (!isValveMode && !isMultiBlade)
    ? sheetRmCost
    : (calcResult?.raw_material_cost ?? sheetRmCost);

  const totalMcCost = hasSheetEdits || (!isValveMode && !isMultiBlade)
    ? sheetMcCost
    : (calcResult?.mfg_cost ?? sheetMcCost);

  // Bought out quantities & costs with standard scaling (Rack & Pinion)
  const nR = 2 * Math.ceil(width / 1500.0);
  const rackQty = Math.floor(4 * nR / 4.0 + 0.5);
  const rackRate = activeRates.bought_out_prices?.rack_base ?? 20000;
  const rackCost = rackQty * rackRate * (height / 3000.0);

  const drivePinionQty = 2;
  const drivePinionRate = activeRates.bought_out_prices?.drive_pinion ?? 5000;
  const drivePinionCost = drivePinionQty * drivePinionRate;

  const freePinionQty = Math.floor(14 * nR / 4.0 + 0.5);
  const freePinionRate = activeRates.bought_out_prices?.free_pinion ?? 5000;
  const freePinionCost = freePinionQty * freePinionRate;

  const bearingQty = 2;
  const bearingRate = activeRates.bought_out_prices?.bearing ?? 13000;
  const bearingCost = bearingQty * bearingRate;

  const hardwareCost = activeRates.bought_out_prices?.hardware ?? 50000;
  const finishingRate = activeRates.finishing_rate_per_kg ?? 20;
  const finishingCost = totalWeight * finishingRate;

  const p_factor = (width + height) / 6000.0;
  const glandQty = Math.floor(24 * p_factor + 0.5);
  const glandRate = activeRates.bought_out_prices?.gland_packing_unit ?? 200;
  const glandCost = glandQty * glandRate;

  const boughtOutContext = {
    racks: rackCost,
    pinions: drivePinionCost + freePinionCost,
    bearings: bearingCost,
    hardware: hardwareCost,
    gland_packing: glandCost,
    finishing_rate: finishingRate,
    total_weight: totalWeight,
  };
  const boughtOutCostCalculated = evaluateFormula(
    customFormulas.boughtOut || DEFAULT_FORMULAS.boughtOut,
    boughtOutContext,
    rackCost + drivePinionCost + freePinionCost + bearingCost + hardwareCost + finishingCost + glandCost
  );

  // Damper Basic Cost
  const damperBasicCost = (isValveMode && calcResult?.basic_cost !== undefined && !hasSheetEdits)
    ? calcResult.basic_cost
    : ((isMultiBlade && calcResult?.basic_cost !== undefined && !hasSheetEdits)
      ? calcResult.basic_cost
      : (sheetLineTotal + boughtOutCostCalculated));

  // Automation costs
  const actuatorCost = activeRates.automation_prices?.actuator ?? 200000;
  const gearboxCost = activeRates.automation_prices?.gearbox ?? 100000;
  const miscCost = activeRates.automation_prices?.misc ?? 50000;
  const damperAutomationCost = (isValveMode && calcResult?.automation_cost !== undefined)
    ? calcResult.automation_cost
    : ((isMultiBlade && calcResult?.automation_cost !== undefined)
      ? calcResult.automation_cost
      : (actuatorCost + gearboxCost + miscCost));

  // Fabrication & Testing cost
  const fabRate = activeRates.fabrication_rate_per_kg ?? 96;
  const fabContext = {
    total_weight: totalWeight,
    fabrication_rate: fabRate,
  };
  const fabricationCostCalculated = evaluateFormula(
    customFormulas.fabrication || DEFAULT_FORMULAS.fabrication,
    fabContext,
    totalWeight * fabRate
  );

  const fabricationCost = (isValveMode && calcResult?.testing_cost !== undefined && !hasSheetEdits)
    ? (calcResult.testing_cost + (calcResult.finishing_cost || 0))
    : ((isMultiBlade && calcResult?.fabrication_cost !== undefined && !hasSheetEdits)
      ? calcResult.fabrication_cost
      : fabricationCostCalculated);

  // Total Cost & Final Quoted Price
  const totalCostContext = {
    raw_material: totalRmCost,
    machining: totalMcCost,
    bought_out: boughtOutCostCalculated,
    automation: damperAutomationCost,
    fabrication: fabricationCost,
    total_weight: totalWeight,
  };

  const totalDamperCostCalculated = evaluateFormula(
    customFormulas.totalCost || DEFAULT_FORMULAS.totalCost,
    totalCostContext,
    (damperBasicCost + damperAutomationCost + fabricationCost) * typeMultiplier
  );

  const totalDamperCost = (isValveMode || isMultiBlade) && calcResult?.total_cost !== undefined && !hasSheetEdits
    ? calcResult.total_cost + fabricatedDelta
    : totalDamperCostCalculated;

  const priceContext = {
    total_cost: totalDamperCost,
    markup_pct: (markupMultiplier - 1.0) * 100.0,
  };

  const unitQuotedPrice = (isValveMode || isMultiBlade) && calcResult?.quoted_price !== undefined && !hasSheetEdits
    ? calcResult.quoted_price
    : evaluateFormula(
        customFormulas.quotedPrice || DEFAULT_FORMULAS.quotedPrice,
        priceContext,
        totalDamperCost * markupMultiplier
      );

  const batchQuotedPrice = (isValveMode || isMultiBlade) && calcResult?.batch_totals?.quoted_price !== undefined && !hasSheetEdits
    ? calcResult.batch_totals.quoted_price
    : (unitQuotedPrice * quantity);

  return (
    <div className="min-h-screen bg-[#F9F7F2] text-[#242826] font-sans antialiased pb-16">
      {/* 1. Designer Pastel Hero Banner Section */}
      <section className="bg-gradient-to-b from-[#FFFDF9] via-[#F4EFE6]/70 to-[#F9F7F2] border-b border-[#E8E3D8] pt-8 pb-7 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1440px] mx-auto space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-3xl space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#EEF5F1] text-[#2C483D] border border-[#D5E5DC]">
                <span className="w-2 h-2 rounded-full bg-[#C46346]"></span>
                <span>
                  {productCategory === 'valve'
                    ? 'Industrial Valve CPQ Suite • Multi-Standard Valve Configurator'
                    : 'Industrial Damper CPQ Suite • Multi-Type Damper Configurator'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#242826] tracking-tight leading-tight">
                {productCategory === 'valve' ? (
                  <>
                    Valve Quote Pro: Sizing to Production BOM{' '}
                    <span className="relative inline-block text-[#C46346]">
                      —Made Effortless
                      <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#3D6353] rounded-full"></span>
                    </span>
                  </>
                ) : (
                  <>
                    Damper Quote Pro: From RFQ to Production BOM{' '}
                    <span className="relative inline-block text-[#3D6353]">
                      —Made Effortless
                      <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#C46346] rounded-full"></span>
                    </span>
                  </>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-[#5C6460] leading-relaxed">
                {productCategory === 'valve'
                  ? 'Configure industrial butterfly valves, knife gate valves, ball valves, and globe valves with real-time 3D CAD modeling, ASME/EN pressure ratings, materials, and live automated costing.'
                  : 'Configure industrial dampers with real-time 3D CAD modeling, multi-type selection, engineering customization, and automated cost estimation with live editable rates.'}
              </p>
            </div>

            {/* Top Corner Product Category Switcher & Header Quick Actions */}
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
              {/* Prominent Top Corner Switcher */}
              <div className="flex items-center p-1.5 bg-[#252B28] rounded-2xl shadow-lg border border-[#3B433F]">
                <button
                  type="button"
                  onClick={() => setProductCategory('damper')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                    productCategory === 'damper'
                      ? 'bg-[#3D6353] text-white shadow-md ring-2 ring-[#3D6353]/40'
                      : 'text-slate-300 hover:text-white hover:bg-[#343C38]'
                  }`}
                >
                  <span className="text-base">🏭</span>
                  <span>Industrial Dampers</span>
                  {productCategory === 'damper' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setProductCategory('valve')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                    productCategory === 'valve'
                      ? 'bg-[#C46346] text-white shadow-md ring-2 ring-[#C46346]/40'
                      : 'text-slate-300 hover:text-white hover:bg-[#343C38]'
                  }`}
                >
                  <span className="text-base">⚙️</span>
                  <span>Industrial Valves</span>
                  {productCategory === 'valve' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
                  )}
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => setShow3DViewer(!show3DViewer)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all shadow-sm ${
                    show3DViewer 
                      ? 'bg-[#3D6353] text-white border-[#3D6353]' 
                      : 'bg-[#FFFDFB] hover:bg-[#F4EFE6] text-[#3E4541] border-[#DDD6C8]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{show3DViewer ? '3D Active' : 'Show 3D'}</span>
                </button>

                <button
                  onClick={handleResetRates}
                  title="Reset all rates to company standard baseline"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-[#DDD6C8] bg-[#FFFDFB] hover:bg-[#F4EFE6] text-[#3E4541] transition-all shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#C46346]" />
                  <span>Reset</span>
                </button>

                <button
                  onClick={handleDownloadExcel}
                  title="Download Live Excel Spreadsheet with Editable Formulas"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-[#2F5241] hover:bg-[#254234] text-white shadow-sm transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download Live Excel</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  title="Download Official Technical Quotation PDF"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-[#3D6353] hover:bg-[#2F4D40] text-white shadow-sm transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF Sheet</span>
                </button>

                <button
                  onClick={handleSaveQuote}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#C46346] hover:bg-[#B05337] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all group disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Quote'}</span>
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:translate-x-0.5 transition-transform">
                    →
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 4 Pastel Metric Counter Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-2">
            <div className="bg-[#FFFDFB] border border-[#E8E3D8] rounded-xl p-3.5 shadow-sm hover:shadow transition-shadow flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-[#6E7772] uppercase tracking-wider">
                  Costing Accuracy
                </div>
                <div className="text-2xl font-black text-[#3D6353] font-mono mt-0.5">
                  100%
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#EEF5F1] flex items-center justify-center text-[#3D6353]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#FFFDFB] border border-[#E8E3D8] rounded-xl p-3.5 shadow-sm hover:shadow transition-shadow flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-[#6E7772] uppercase tracking-wider">
                  Configured BOM
                </div>
                <div className="text-2xl font-black text-[#3D6353] font-mono mt-0.5">
                  45 <span className="text-xs font-normal text-[#6E7772]">Parts</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#EEF5F1] flex items-center justify-center text-[#3D6353]">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#FFFDFB] border border-[#E8E3D8] rounded-xl p-3.5 shadow-sm hover:shadow transition-shadow flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-[#6E7772] uppercase tracking-wider">
                  Quote Turnaround
                </div>
                <div className="text-2xl font-black text-[#C46346] font-mono mt-0.5">
                  &lt; 2 <span className="text-xs font-normal text-[#6E7772]">Min</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#FDF1EB] flex items-center justify-center text-[#C46346]">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#FFFDFB] border border-[#E8E3D8] rounded-xl p-3.5 shadow-sm hover:shadow transition-shadow flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-[#6E7772] uppercase tracking-wider">
                  Unit Baseline Price
                </div>
                <div className="text-2xl font-black text-[#2F5241] font-mono mt-0.5">
                  ₹ 20.24 L
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#EEF5F1] flex items-center justify-center text-[#2F5241]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Workspace */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {isValveMode ? (
          <>
            {/* 1. Valve Nominal Bore & Pressure Rating Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f89030]"></span>
                  <h2 className="font-bold text-sm sm:text-base text-[#212529] uppercase tracking-wide">
                    1. Valve Nominal Bore (DN) & Pressure Rating
                  </h2>
                  <span className="text-xs text-[#005daa] font-mono font-semibold">
                    • Configured: DN {valveSizeDn} ({STANDARD_VALVE_DNS.find(v => v.dn === Number(valveSizeDn))?.inch || `${Math.round(valveSizeDn/25.4)}"`}) • {valvePressureRating} • {valveEndConnection}
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    Industrial Standard Size
                  </span>
                </div>

                {/* Quick DN Presets */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[#64748b] font-medium mr-1">Standard DN:</span>
                  {[50, 80, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1200].map((dnVal) => {
                    const dnObj = STANDARD_VALVE_DNS.find(v => v.dn === dnVal);
                    const isSelected = Number(valveSizeDn) === dnVal;
                    return (
                      <button
                        key={dnVal}
                        type="button"
                        onClick={() => setValveSizeDn(dnVal)}
                        className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                          isSelected
                            ? 'bg-[#f89030] text-white font-semibold shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        DN{dnVal} ({dnObj?.inch || `${Math.round(dnVal/25.4)}"`})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sliders and Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
                {/* Nominal Bore Slider */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#64748b] text-xs font-semibold">Nominal Bore (DN mm)</span>
                    <span className="text-[#f89030] text-xs font-bold font-mono">
                      DN {valveSizeDn} ({STANDARD_VALVE_DNS.find(v => v.dn === Number(valveSizeDn))?.inch || `${Math.round(valveSizeDn/25.4)}"`})
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="2000"
                    step="10"
                    value={valveSizeDn}
                    className="cfg-slider"
                    style={{ '--pct': `${((valveSizeDn - 50) / (2000 - 50)) * 100}%` }}
                    onChange={(e) => setValveSizeDn(Number(e.target.value))}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                    <span>DN 50 (2")</span>
                    <span>DN 2000 (80")</span>
                  </div>
                  <input
                    aria-label="Typed DN"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-sm"
                    type="number"
                    min="50"
                    max="2000"
                    value={valveSizeDn}
                    onChange={(e) => setValveSizeDn(Number(e.target.value))}
                  />
                </div>

                {/* Pressure Rating Buttons */}
                <div>
                  <label className="block text-[#64748b] text-xs font-semibold mb-2">Pressure Class / Rating</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['PN 10', 'PN 16', 'PN 25', 'PN 40', 'Class 150', 'Class 300', 'Class 600'].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setValvePressureRating(rating)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          valvePressureRating === rating
                            ? 'bg-[#005daa] text-white border-[#005daa] shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                </div>

                {/* End Connection Selector */}
                <div>
                  <label className="block text-[#64748b] text-xs font-semibold mb-2">End Connection Style</label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'Wafer', label: 'Wafer Type (Between Flanges)' },
                      { id: 'Lugged', label: 'Lugged Type (Drilled & Tapped)' },
                      { id: 'Double Flanged', label: 'Double Flanged RF (ASME B16.5)' },
                      { id: 'Butt-Weld', label: 'Butt-Weld (B16.25)' },
                    ].map((conn) => (
                      <button
                        key={conn.id}
                        type="button"
                        onClick={() => setValveEndConnection(conn.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          valveEndConnection === conn.id
                            ? 'bg-[#eff8fe] text-[#005daa] border-[#005daa] shadow-sm ring-1 ring-[#005daa]/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {conn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Order Quantity & Reference */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[#64748b] text-xs font-semibold mb-1">Order Quantity (Units)</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-9 h-9 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-center py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-9 h-9 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#64748b] text-xs font-semibold mb-1">Target Commercial Margin</label>
                    <div className="flex items-center gap-2">
                      {[1.05, 1.10, 1.15, 1.20].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMarkupMultiplier(m)}
                          className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-all ${
                            markupMultiplier === m
                              ? 'bg-[#f89030] text-white border-[#f89030]'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {((m - 1) * 100).toFixed(0)}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Select Valve Model Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#005daa]"></span>
                  <h2 className="font-bold text-sm sm:text-base text-[#212529] uppercase tracking-wide">
                    2. Select Industrial Valve Model & Product Family
                  </h2>
                </div>
                <span className="text-xs text-[#005daa] font-semibold bg-[#eff8fe] px-3 py-1 rounded-full border border-blue-200">
                  Active: {currentValveType.name}
                </span>
              </div>

              {/* Valve Types Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {VALVE_TYPES.map((type) => {
                  const isSelected = selectedValveTypeId === type.id;
                  return (
                    <div
                      key={type.id}
                      onClick={() => setSelectedValveTypeId(type.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between text-left ${
                        isSelected
                          ? 'bg-[#eff8fe] border-[#005daa] ring-2 ring-[#005daa]/20 shadow-md'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-[#212529]">
                            {type.shortName}
                          </span>
                          {isSelected ? (
                            <span className="w-3 h-3 rounded-full bg-[#005daa] ring-2 ring-blue-200"></span>
                          ) : (
                            <span className="w-3 h-3 rounded-full border border-slate-300"></span>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-[#f89030]">
                          {type.badge}
                        </div>
                        <p className="text-xs text-[#64748b] leading-relaxed">
                          {type.description}
                        </p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-col gap-1 text-[10px] text-slate-500 font-mono">
                        <div className="flex justify-between">
                          <span>App: {type.typicalApp.split(',')[0]}</span>
                          <span className="text-[#005daa] font-bold">{type.stdActuator.split(' ')[0]}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Valve Materials, Trim & Actuation Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f89030]"></span>
                  <h2 className="font-bold text-sm sm:text-base text-[#212529] uppercase tracking-wide">
                    3. Metallurgy, Trim, Seats & Actuation Package
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-mono font-bold rounded-lg border border-emerald-200">
                    Est. Wt: {calcResult?.total_weight_kg || '180'} kg
                  </span>
                  <span className="px-2.5 py-1 bg-blue-50 text-[#005daa] font-mono font-bold rounded-lg border border-blue-200">
                    Torque: {calcResult?.operating_torque_nm || '320'} Nm
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* Body MOC */}
                <div>
                  <label className="block text-[#64748b] font-semibold mb-1">Body Material (Shell MOC)</label>
                  <select
                    value={valveBodyMoc}
                    onChange={(e) => setValveBodyMoc(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:border-[#005daa] focus:outline-none"
                  >
                    <option value="WCB (Cast Carbon Steel ASTM A216)">WCB (Cast Carbon Steel ASTM A216)</option>
                    <option value="CF8M (Cast Stainless Steel SS316)">CF8M (Cast Stainless Steel SS316)</option>
                    <option value="CF8 (Cast Stainless Steel SS304)">CF8 (Cast Stainless Steel SS304)</option>
                    <option value="Ductile Iron (GGG40 / EN-GJS-400)">Ductile Iron (GGG40 / EN-GJS-400)</option>
                    <option value="Super Duplex Stainless Steel (2507)">Super Duplex Stainless Steel (2507)</option>
                  </select>
                </div>

                {/* Trim / Disc MOC */}
                <div>
                  <label className="block text-[#64748b] font-semibold mb-1">Trim / Disc / Blade MOC</label>
                  <select
                    value={valveTrimMoc}
                    onChange={(e) => setValveTrimMoc(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:border-[#005daa] focus:outline-none"
                  >
                    <option value="CF8M (Cast Stainless Steel SS316)">CF8M / SS316 Stainless Steel</option>
                    <option value="CF8 (Cast Stainless Steel SS304)">CF8 / SS304 Stainless Steel</option>
                    <option value="Duplex Stainless Steel (2205)">Duplex Stainless Steel (2205)</option>
                    <option value="Stellite Hard-Faced SS316">Stellite Hard-Faced SS316</option>
                    <option value="Hard Chrome Plated Carbon Steel">Hard Chrome Plated Carbon Steel</option>
                  </select>
                </div>

                {/* Seat MOC */}
                <div>
                  <label className="block text-[#64748b] font-semibold mb-1">Seat & Sealing Ring MOC</label>
                  <select
                    value={valveSeatMoc}
                    onChange={(e) => setValveSeatMoc(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:border-[#005daa] focus:outline-none"
                  >
                    <option value="PTFE / RTFE">PTFE / R-PTFE (Soft Resilient Seat)</option>
                    <option value="Metal-to-Metal (Hard Faced)">Metal-to-Metal (Stellite / Hardened)</option>
                    <option value="EPDM Resilient Liner">EPDM Resilient Liner</option>
                    <option value="Viton / FKM High-Temp">Viton / FKM High-Temp</option>
                  </select>
                </div>

                {/* Actuator Type */}
                <div>
                  <label className="block text-[#64748b] font-semibold mb-1">Actuation System</label>
                  <select
                    value={valveActuator}
                    onChange={(e) => setValveActuator(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:border-[#005daa] focus:outline-none"
                  >
                    <option value="Manual Handwheel / Worm Gearbox">Manual Handwheel / Worm Gearbox</option>
                    <option value="Pneumatic Double Acting + Limit Switch">Pneumatic Double Acting + Limit Switch</option>
                    <option value="Pneumatic Spring Return (Fail Safe)">Pneumatic Spring Return (Fail Safe)</option>
                    <option value="Electric Intelligent (Rotork / Auma / Bernard 415V)">Electric Intelligent (Rotork / Auma 415V)</option>
                  </select>
                </div>
              </div>

              {/* Automation Accessories Checkboxes */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
                <span className="font-semibold text-slate-700">Automation Package:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={withLimitSwitch}
                    onChange={(e) => setWithLimitSwitch(e.target.checked)}
                    className="w-4 h-4 rounded text-[#005daa] focus:ring-0"
                  />
                  <span className="text-slate-600 font-medium">Limit Switch Box (Open/Close Dome)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={withSolenoidValve}
                    onChange={(e) => setWithSolenoidValve(e.target.checked)}
                    className="w-4 h-4 rounded text-[#005daa] focus:ring-0"
                  />
                  <span className="text-slate-600 font-medium">Solenoid Valve (NAMUR 24VDC/230VAC)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={withPositioner}
                    onChange={(e) => setWithPositioner(e.target.checked)}
                    className="w-4 h-4 rounded text-[#005daa] focus:ring-0"
                  />
                  <span className="text-slate-600 font-medium">Smart Positioner (4-20mA HART)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={withAirFilterRegulator}
                    onChange={(e) => setWithAirFilterRegulator(e.target.checked)}
                    className="w-4 h-4 rounded text-[#005daa] focus:ring-0"
                  />
                  <span className="text-slate-600 font-medium">Air Filter Regulator with Gauge</span>
                </label>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 2. Sizing Parameters Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#005daa]"></span>
              <h2 className="font-bold text-sm sm:text-base text-[#212529] uppercase tracking-wide">
                1. Duct Sizing & RFQ Parameters
              </h2>
              <span className="text-xs text-[#005daa] font-mono font-semibold">
                • Configured: {width} × {height} × {depth} mm
              </span>
              <span className={`text-xs font-bold ${calcResult?.accuracy?.accuracy_label === 'Verified size' ? 'text-emerald-700' : 'text-amber-700'}`} role="status">
                {calcResult?.accuracy?.accuracy_label || 'Checking size accuracy…'}
              </span>
            </div>

            {/* Quick Sizing Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[#64748b] font-medium mr-1">Presets:</span>
              <button
                onClick={() => { setWidth(3000); setHeight(3000); setDepth(450); }}
                className={`px-3 py-1 rounded-full font-medium transition-colors ${
                  width === 3000 && height === 3000 && depth === 450
                    ? 'bg-[#005daa] text-white font-semibold shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                3000 × 3000 × 450 (Standard)
              </button>
              <button
                onClick={() => { setWidth(2000); setHeight(2000); setDepth(400); }}
                className={`px-3 py-1 rounded-full font-medium transition-colors ${
                  width === 2000 && height === 2000 && depth === 400
                    ? 'bg-[#005daa] text-white font-semibold shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                2000 × 2000 × 400
              </button>
              <button
                onClick={() => { setWidth(4500); setHeight(3500); setDepth(500); }}
                className={`px-3 py-1 rounded-full font-medium transition-colors ${
                  width === 4500 && height === 3500 && depth === 500
                    ? 'bg-[#005daa] text-white font-semibold shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                4500 × 3500 × 500
              </button>
              <button
                onClick={() => { setWidth(6000); setHeight(6000); setDepth(800); }}
                className={`px-3 py-1 rounded-full font-medium transition-colors ${
                  width === 6000 && height === 6000 && depth === 800
                    ? 'bg-[#005daa] text-white font-semibold shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                6000 × 6000 × 800
              </button>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 text-xs">
            <div className="col-span-2">
              <label className="block text-[#64748b] font-semibold mb-1">Customer / RFQ Reference</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Pune Thermal Plant / Tata Projects"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50/50 font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] transition-all"
              />
            </div>

            {/* ── Configuration Panel (light theme matching page) ── */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-6">
              <style>{`
                .cfg-slider {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 100%;
                  height: 5px;
                  border-radius: 3px;
                  outline: none;
                  cursor: pointer;
                  background: linear-gradient(
                    to right,
                    #C46346 0%,
                    #C46346 var(--pct, 50%),
                    #E8E3D8 var(--pct, 50%),
                    #E8E3D8 100%
                  );
                }
                .cfg-slider::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: #C46346;
                  border: 2.5px solid #fff;
                  box-shadow: 0 2px 8px rgba(196,99,70,0.35), 0 0 0 1px #C46346;
                  transition: transform 0.15s;
                }
                .cfg-slider::-webkit-slider-thumb:hover { transform: scale(1.18); }
                .cfg-slider::-moz-range-thumb {
                  width: 18px; height: 18px;
                  border-radius: 50%;
                  background: #C46346;
                  border: 2.5px solid #fff;
                  box-shadow: 0 2px 8px rgba(196,99,70,0.35);
                }
              `}</style>

              <div className="bg-[#FFFDFB] border border-[#E8E3D8] rounded-2xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 mb-4 border-b border-[#EAE5DB] pb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C46346]"></span>
                  <span className="font-bold text-sm text-[#242826] uppercase tracking-wide">Configuration</span>
                  <div className="ml-auto inline-flex rounded border border-[#DDD6C8] p-0.5" aria-label="Dimension input units">
                    {['mm', 'm'].map((unit) => <button key={unit} type="button" aria-pressed={dimensionUnit === unit} onClick={() => setDimensionUnit(unit)} className={`min-w-10 px-2 py-1 text-xs font-bold ${dimensionUnit === unit ? 'bg-[#3D6353] text-white' : 'text-[#5C6460] hover:bg-[#F4EFE6]'}`}>{unit}</button>)}
                  </div>
                  <span className="ml-auto text-xs font-mono text-[#2F4D40] font-semibold bg-[#EEF5F1] px-2.5 py-0.5 rounded-full border border-[#D5E5DC]">
                    {width} × {height} × {depth} mm
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5">

                  {/* Width Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[#64748b] text-xs font-semibold">Width (W mm)</span>
                      <span className="text-[#f89030] text-xs font-bold font-mono">{width} mm</span>
                    </div>
                    <input
                      type="range" min={sizeLimits.width_min_mm} max={sizeLimits.width_max_mm} step="1"
                      value={width}
                      className="cfg-slider"
                      style={{ '--pct': `${((width - sizeLimits.width_min_mm) / (sizeLimits.width_max_mm - sizeLimits.width_min_mm)) * 100}%` }}
                      onChange={(e) => setWidth(Number(e.target.value))}
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>{sizeLimits.width_min_mm} mm</span><span>{sizeLimits.width_max_mm} mm</span>
                    </div>
                    <input aria-label="Typed width" className="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm" type="number" min={sizeLimits.width_min_mm / (dimensionUnit === 'm' ? 1000 : 1)} max={sizeLimits.width_max_mm / (dimensionUnit === 'm' ? 1000 : 1)} step={dimensionUnit === 'm' ? 0.001 : 1} value={dimensionUnit === 'm' ? (width / 1000).toFixed(3) : width} onChange={(e) => setWidth(Number(e.target.value) * (dimensionUnit === 'm' ? 1000 : 1))} />
                  </div>

                  {/* Height Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[#64748b] text-xs font-semibold">Height (H mm)</span>
                      <span className="text-[#f89030] text-xs font-bold font-mono">{height} mm</span>
                    </div>
                    <input
                      type="range" min={sizeLimits.height_min_mm} max={sizeLimits.height_max_mm} step="1"
                      value={height}
                      className="cfg-slider"
                      style={{ '--pct': `${((height - sizeLimits.height_min_mm) / (sizeLimits.height_max_mm - sizeLimits.height_min_mm)) * 100}%` }}
                      onChange={(e) => setHeight(Number(e.target.value))}
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>{sizeLimits.height_min_mm} mm</span><span>{sizeLimits.height_max_mm} mm</span>
                    </div>
                    <input aria-label="Typed height" className="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm" type="number" min={sizeLimits.height_min_mm / (dimensionUnit === 'm' ? 1000 : 1)} max={sizeLimits.height_max_mm / (dimensionUnit === 'm' ? 1000 : 1)} step={dimensionUnit === 'm' ? 0.001 : 1} value={dimensionUnit === 'm' ? (height / 1000).toFixed(3) : height} onChange={(e) => setHeight(Number(e.target.value) * (dimensionUnit === 'm' ? 1000 : 1))} />
                  </div>

                  {/* Depth Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[#64748b] text-xs font-semibold">Depth (D mm)</span>
                      <span className="text-[#f89030] text-xs font-bold font-mono">{depth} mm</span>
                    </div>
                    <input
                      type="range" min={sizeLimits.depth_min_mm} max={sizeLimits.depth_max_mm} step="1"
                      value={depth}
                      className="cfg-slider"
                      style={{ '--pct': `${((depth - sizeLimits.depth_min_mm) / (sizeLimits.depth_max_mm - sizeLimits.depth_min_mm)) * 100}%` }}
                      onChange={(e) => setDepth(Number(e.target.value))}
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>{sizeLimits.depth_min_mm} mm</span><span>{sizeLimits.depth_max_mm} mm</span>
                    </div>
                    <input aria-label="Typed depth" className="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm" type="number" min={sizeLimits.depth_min_mm / (dimensionUnit === 'm' ? 1000 : 1)} max={sizeLimits.depth_max_mm / (dimensionUnit === 'm' ? 1000 : 1)} step={dimensionUnit === 'm' ? 0.001 : 1} value={dimensionUnit === 'm' ? (depth / 1000).toFixed(3) : depth} onChange={(e) => setDepth(Number(e.target.value) * (dimensionUnit === 'm' ? 1000 : 1))} />
                  </div>

                  {/* Number of Blades Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[#64748b] text-xs font-semibold">Number of blades</span>
                      <span className="text-[#f89030] text-xs font-bold font-mono">{numberOfBlades}</span>
                    </div>
                    <input
                      type="range" min="2" max="24" step="2"
                      value={numberOfBlades}
                      className="cfg-slider"
                      style={{ '--pct': `${((numberOfBlades - 2) / (24 - 2)) * 100}%` }}
                      onChange={(e) => setNumberOfBlades(Number(e.target.value))}
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>2</span><span>24</span>
                    </div>
                  </div>

                </div>

                {/* Bottom row: Quantity + Opposed Blades */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-6">
                  {/* Quantity */}
                  <div className="flex items-center gap-3">
                    <span className="text-[#64748b] text-xs font-semibold">Quantity</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-base leading-none flex items-center justify-center hover:bg-[#f89030] hover:text-white transition-colors font-bold border border-slate-200"
                      >−</button>
                      <span className="text-[#212529] font-bold text-sm font-mono w-8 text-center">{quantity}</span>
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-base leading-none flex items-center justify-center hover:bg-[#f89030] hover:text-white transition-colors font-bold border border-slate-200"
                      >+</button>
                    </div>
                  </div>

                  {/* Opposed blades toggle */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={opposedBlades}
                        onChange={(e) => setOpposedBlades(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                        opposedBlades
                          ? 'bg-[#f89030] border-[#f89030] shadow-sm shadow-orange-200'
                          : 'bg-white border-slate-300 hover:border-[#f89030]'
                      }`}>
                        {opposedBlades && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-[#64748b] text-xs font-semibold">Opposed blades</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Damper Types Selector & Engineering Customization */}
        <div className="bg-[#FFFDFB] border border-[#E8E3D8] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EAE5DB] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C46346]"></span>
              <h2 className="font-bold text-sm sm:text-base text-[#242826] uppercase tracking-wide">
                2. Select Damper Model & Engineering Customization
              </h2>
            </div>
            <span className="text-xs text-[#2F4D40] font-semibold bg-[#EEF5F1] px-3 py-1 rounded-full border border-[#D5E5DC]">
              Active: {currentDamperType.name}
            </span>
          </div>

          {/* Damper Type Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {DAMPER_TYPES.map((type) => {
              const isSelected = selectedDamperTypeId === type.id;
              return (
                <div
                  key={type.id}
                  onClick={() => setSelectedDamperTypeId(type.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between text-left ${
                    isSelected
                      ? 'bg-[#EEF5F1] border-[#3D6353] ring-2 ring-[#3D6353]/20 shadow-sm'
                      : 'bg-white border-[#E8E3D8] hover:border-[#DDD6C8] hover:bg-[#FAF7F2]'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-[#242826] line-clamp-1">
                        {type.shortName}
                      </span>
                      {isSelected ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#3D6353]"></span>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full border border-[#DDD6C8]"></span>
                      )}
                    </div>
                    <div className="text-[10px] font-semibold text-[#C46346]">
                      {type.badge}
                    </div>
                    <p className="text-[11px] text-[#5C6460] leading-snug line-clamp-2">
                      {type.description}
                    </p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-[#EAE5DB] flex items-center justify-between text-[10px] text-[#5C6460] font-mono">
                    <span>Factor: {type.typeFactor.toFixed(2)}×</span>
                    {type.id === 'rack-pinion' && (
                      <span className="text-[#2F4D40] font-bold">45-Part BOM</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Placeholder Banner for Multi-Blade Damper */}
          {isMultiBlade && (
            <div className="mt-4 bg-amber-500/10 border-2 border-amber-500/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shadow shrink-0">
                  !
                </div>
                <div>
                  <h4 className="font-extrabold text-xs sm:text-sm text-amber-950">
                    Placeholder multi-blade data: not company-verified
                  </h4>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Standard engineering assumptions active (Frame 3mm, Blades 1.6mm, Shaft 16mm, Depth 180mm). Not yet company-verified.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {calcResult?.is_data_verified ? (
                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Company Verified
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Preliminary Dataset
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Validation Errors Blocking Quoting */}
          {isMultiBlade && calcResult?.validation_errors?.length > 0 && (
            <div className="mt-3 bg-red-50 border-2 border-red-500 rounded-2xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Validation Errors (Quotation Blocked)</span>
                </span>
                {calcResult.derived_results?.suggested_sections && calcResult.derived_results.suggested_sections > sections && (
                  <button
                    onClick={() => setSections(calcResult.derived_results.suggested_sections)}
                    className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1 rounded-lg transition-colors shadow-sm"
                  >
                    Auto-split into {calcResult.derived_results.suggested_sections} Sections
                  </button>
                )}
              </div>
              <ul className="text-xs text-red-800 space-y-1 list-disc list-inside font-medium">
                {calcResult.validation_errors.map((err, idx) => (
                  <li key={idx}><strong>{err.field}:</strong> {err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation Warnings */}
          {isMultiBlade && calcResult?.validation_warnings?.length > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-300 rounded-2xl p-3.5 space-y-1 shadow-sm">
              <span className="font-bold text-xs uppercase text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Engineering Warnings</span>
              </span>
              <ul className="text-xs text-amber-900 space-y-0.5 list-disc list-inside font-medium">
                {calcResult.validation_warnings.map((warn, idx) => (
                  <li key={idx}><strong>{warn.field}:</strong> {warn.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Grouped Configuration Sections for Multi-Blade Damper */}
          {isMultiBlade ? (
            <div className="mt-5 space-y-5">
              {/* Group A: Frame Parameters */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#005daa]" />
                    <span>Group A: Frame & Casing Parameters</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Airflow Depth: {depth} mm
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Frame Sheet Thickness (mm)</label>
                    <input
                      type="number" step="0.5" min="1" max="12"
                      value={frameThickness}
                      onChange={(e) => setFrameThickness(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Frame Construction</label>
                    <select
                      value={frameConstruction}
                      onChange={(e) => setFrameConstruction(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Channel Box">Channel Box Casing</option>
                      <option value="Angle Frame">Angle Iron Frame</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Flange Type</label>
                    <select
                      value={mbFlangeType}
                      onChange={(e) => setMbFlangeType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Angle">Angle Flange</option>
                      <option value="Flat Bar">Flat Bar Flange</option>
                      <option value="None">None (Slip-on / Plain)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Flange Width × Thick (mm)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="20" max="150"
                        value={flangeWidth}
                        onChange={(e) => setFlangeWidth(Number(e.target.value))}
                        className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        placeholder="Width"
                      />
                      <span className="text-slate-400">×</span>
                      <input
                        type="number" min="3" max="25"
                        value={flangeThick}
                        onChange={(e) => setFlangeThick(Number(e.target.value))}
                        className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        placeholder="Thick"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Sections (Mullions)
                      {calcResult?.derived_results?.suggested_sections > 1 && (
                        <span className="text-amber-600 ml-1 font-bold">
                          (Req: {calcResult.derived_results.suggested_sections})
                        </span>
                      )}
                    </label>
                    <input
                      type="number" min="1" max="10"
                      value={sections}
                      onChange={(e) => setSections(Math.max(1, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Blade Orientation</label>
                    <select
                      value={bladeOrientation}
                      onChange={(e) => setBladeOrientation(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Horizontal">Horizontal Blades</option>
                      <option value="Vertical">Vertical Blades</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Mounting</label>
                    <select
                      value={mounting}
                      onChange={(e) => setMounting(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="In-duct">In-duct (Flanged ends)</option>
                      <option value="Wall">Wall Mounted</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Frame Material</label>
                    <select
                      value={mbMaterial}
                      onChange={(e) => setMbMaterial(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="IS 2062">Carbon Steel IS 2062</option>
                      <option value="Galvanized">Galvanized Steel</option>
                      <option value="SS 304">Stainless Steel SS 304</option>
                      <option value="SS 316">Stainless Steel SS 316</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Surface Finish</label>
                    <select
                      value={surfaceFinish}
                      onChange={(e) => setSurfaceFinish(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Painted">Epoxy Painted (Standard)</option>
                      <option value="Galvanized">Hot-Dip Galvanized</option>
                      <option value="None">None (Mill Finish)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Group B: Dedicated Blade Geometry & Construction Design */}
              <div className="p-5 rounded-2xl border-2 border-blue-200/80 bg-white shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#005daa]" />
                      <h3 className="font-bold text-sm text-slate-900 tracking-wide">
                        Group B: Blade Geometry & Construction Design
                      </h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-[#005daa]">
                        Parametric Engine
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure blade profiles, developed geometry, clearances, skins, and actuation kinematics independently of the damper frame.
                    </p>
                  </div>

                  {/* AUTO vs CUSTOM Mode Toggle */}
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <span className="text-slate-600 font-semibold text-xs px-2">Design Mode:</span>
                    <button
                      type="button"
                      onClick={() => setBladeMode('AUTO')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        bladeMode === 'AUTO'
                          ? 'bg-[#005daa] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 bg-transparent'
                      }`}
                    >
                      AUTO (Frame-Derived)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBladeMode('CUSTOM')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        bladeMode === 'CUSTOM'
                          ? 'bg-[#005daa] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 bg-transparent'
                      }`}
                    >
                      CUSTOM (Direct Dimensions)
                    </button>
                  </div>
                </div>

                {/* Mode Explanation Notice */}
                <div className="text-xs px-3.5 py-2 rounded-xl border flex items-center justify-between bg-blue-50/60 border-blue-200 text-blue-900">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Active Mode:</span>
                    <span>
                      {bladeMode === 'AUTO'
                        ? 'AUTO Mode — System derives blade span, chord, pitch, and blade count from duct opening, target pitch/count, and edge clearances.'
                        : 'CUSTOM Mode — User explicitly defines blade length, chord, depth, and count. System validates them against frame clearances.'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-white border border-blue-300">
                    Tolerance: ±1.0 mm
                  </span>
                </div>

                {/* 1. Blade Construction Profile Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    1. Blade Construction & Cross-Section Profile
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {[
                      { id: 'Flat single-skin sheet blade', label: 'Flat Single-Skin', desc: 'Single flat sheet with edge clearances' },
                      { id: 'Folded single-skin blade', label: 'Folded Single-Skin', desc: 'V-groove / roll-formed stiffened flanges' },
                      { id: 'Double-skin hollow blade', label: 'Double-Skin Box', desc: 'Twin skins with internal hollow cavity' },
                      { id: 'Aerofoil blade', label: 'Aerofoil Profile', desc: 'NACA low-loss streamlined profile' },
                      { id: 'Custom cross-section blade', label: 'Custom Channel', desc: 'Validated Z/C/Hat/Double-V profile' },
                    ].map((p) => {
                      const isSelected = bladeType === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setBladeType(p.id)}
                          className={`p-3 text-left rounded-xl border transition-all ${
                            isSelected
                              ? 'border-[#005daa] bg-blue-50/80 shadow-sm ring-1 ring-[#005daa]'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                            <span>{p.label}</span>
                            {isSelected && <span className="w-2 h-2 rounded-full bg-[#005daa]" />}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 leading-snug">{p.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Primary Dimensions Grid with Provenance Badges */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      2. Primary Blade Dimensions (mm)
                    </label>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="flex items-center gap-1 text-blue-700">
                        <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> User Entered
                      </span>
                      <span className="flex items-center gap-1 text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> Auto Calculated
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                    {/* Blade Length / Span */}
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700">Blade Span (mm)</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          bladeMode === 'CUSTOM' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {bladeMode === 'CUSTOM' ? 'User' : 'Auto'}
                        </span>
                      </div>
                      {bladeMode === 'CUSTOM' ? (
                        <input
                          type="number" min="100" max="8000"
                          value={bladeSpan}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setBladeSpan(val);
                            setBladeLength(val);
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 bg-white"
                        />
                      ) : (
                        <div className="px-2 py-1 font-mono font-bold text-emerald-900 bg-emerald-50 rounded-lg border border-emerald-200">
                          {calcResult?.derived_results?.blade_length || (width - 2 * sideClearance)} mm
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1">Span across opening</div>
                    </div>

                    {/* Blade Chord / Width */}
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700">Blade Chord (mm)</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          bladeMode === 'CUSTOM' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {bladeMode === 'CUSTOM' ? 'User' : 'Auto'}
                        </span>
                      </div>
                      {bladeMode === 'CUSTOM' ? (
                        <input
                          type="number" min="50" max="600"
                          value={bladeChord || manualChord}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setBladeChord(val);
                            setManualChord(val);
                            setBladeWidth(val);
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 bg-white"
                        />
                      ) : (
                        <div className="px-2 py-1 font-mono font-bold text-emerald-900 bg-emerald-50 rounded-lg border border-emerald-200">
                          {calcResult?.derived_results?.blade_chord || manualChord} mm
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1">Cross-section chord width</div>
                    </div>

                    {/* Blade Breadth / Depth */}
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700">Blade Depth (mm)</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          bladeMode === 'CUSTOM' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {bladeMode === 'CUSTOM' ? 'User' : 'Auto'}
                        </span>
                      </div>
                      {bladeMode === 'CUSTOM' ? (
                        <input
                          type="number" min="5" max="250"
                          value={bladeDepth}
                          onChange={(e) => setBladeDepth(Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 bg-white"
                        />
                      ) : (
                        <div className="px-2 py-1 font-mono font-bold text-emerald-900 bg-emerald-50 rounded-lg border border-emerald-200">
                          {calcResult?.derived_results?.blade_depth || bladeDepth} mm
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1">Profile breadth/depth</div>
                    </div>

                    {/* Blade Count */}
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700">Blade Count</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          bladeMode === 'CUSTOM' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {bladeMode === 'CUSTOM' ? 'User' : 'Auto'}
                        </span>
                      </div>
                      {bladeMode === 'CUSTOM' ? (
                        <input
                          type="number" min="2" max="40"
                          value={manualBladeCount}
                          onChange={(e) => setManualBladeCount(Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 bg-white"
                        />
                      ) : (
                        <div className="px-2 py-1 font-mono font-bold text-emerald-900 bg-emerald-50 rounded-lg border border-emerald-200">
                          {calcResult?.derived_results?.blade_count || targetCount} blades
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1">
                        {bladeMode === 'AUTO' ? `Target count: ${targetCount}` : 'Fixed count'}
                      </div>
                    </div>

                    {/* Blade Pitch / Spacing */}
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700">Blade Pitch (mm)</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800">
                          Auto
                        </span>
                      </div>
                      <div className="px-2 py-1 font-mono font-bold text-emerald-900 bg-emerald-50 rounded-lg border border-emerald-200">
                        {calcResult?.derived_results?.pitch || targetPitch} mm
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Center-to-center spacing</div>
                    </div>

                    {/* Sheet Thickness / Gauge */}
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700">Thickness (mm)</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-blue-100 text-blue-800">
                          User
                        </span>
                      </div>
                      <input
                        type="number" step="0.2" min="0.8" max="8.0"
                        value={bladeThick}
                        onChange={(e) => setBladeThick(Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 bg-white"
                      />
                      <div className="text-[10px] text-slate-500 mt-1">Sheet thickness (0.8–8mm)</div>
                    </div>
                  </div>

                  {/* Secondary Kinematics & Clearances Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs pt-1">
                    {/* Overlap % */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-600">Overlap %</span>
                        <span className="text-[9px] px-1 bg-blue-50 text-blue-700 rounded font-bold">User</span>
                      </div>
                      <input
                        type="number" min="0" max="30" step="1"
                        value={overlapPct}
                        onChange={(e) => setOverlapPct(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                      />
                    </div>

                    {/* Side Clearance */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-600">Side Clearance (mm)</span>
                        <span className="text-[9px] px-1 bg-blue-50 text-blue-700 rounded font-bold">User</span>
                      </div>
                      <input
                        type="number" min="2" max="25" step="0.5"
                        value={sideClearance}
                        onChange={(e) => setSideClearance(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                      />
                    </div>

                    {/* End / Tip Clearance */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-600">End Clearance (mm)</span>
                        <span className="text-[9px] px-1 bg-blue-50 text-blue-700 rounded font-bold">User</span>
                      </div>
                      <input
                        type="number" min="2" max="25" step="0.5"
                        value={endClearance}
                        onChange={(e) => setEndClearance(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                      />
                    </div>

                    {/* Blade Action */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-600">Blade Action</span>
                        <span className="text-[9px] px-1 bg-blue-50 text-blue-700 rounded font-bold">User</span>
                      </div>
                      <select
                        value={mbBladeAction}
                        onChange={(e) => setMbBladeAction(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                      >
                        <option value="Opposed">Opposed (Linear Modulating)</option>
                        <option value="Parallel">Parallel (2-Position Open/Close)</option>
                      </select>
                    </div>

                    {/* Open / Closed Angles */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-600">Open Angle (°)</span>
                        <span className="text-[9px] px-1 bg-blue-50 text-blue-700 rounded font-bold">User</span>
                      </div>
                      <input
                        type="number" min="45" max="90" step="5"
                        value={openAngle}
                        onChange={(e) => setOpenAngle(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-600">Closed Angle (°)</span>
                        <span className="text-[9px] px-1 bg-blue-50 text-blue-700 rounded font-bold">User</span>
                      </div>
                      <input
                        type="number" min="0" max="15" step="1"
                        value={closedAngle}
                        onChange={(e) => setClosedAngle(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Construction-Specific Parameters Sub-Form */}
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                    <h4 className="font-bold text-xs text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      <span>3. Construction Detail: {bladeType}</span>
                    </h4>
                    <span className="text-[11px] font-mono text-indigo-800 font-semibold">
                      Developed Sheet Width: {calcResult?.derived_results?.developed_sheet_width || '-'} mm
                    </span>
                  </div>

                  {/* A. Folded Single-Skin Blade Sub-Form */}
                  {bladeType === 'Folded single-skin blade' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Web Width (mm)</label>
                        <input
                          type="number" min="20" max="400"
                          value={webWidth}
                          onChange={(e) => setWebWidth(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Flange Left (mm)</label>
                        <input
                          type="number" min="5" max="100"
                          value={flangeLeft}
                          onChange={(e) => setFlangeLeft(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Flange Right (mm)</label>
                        <input
                          type="number" min="5" max="100"
                          value={flangeRight}
                          onChange={(e) => setFlangeRight(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Edge Return (mm)</label>
                        <input
                          type="number" min="0" max="50"
                          value={edgeReturn}
                          onChange={(e) => setEdgeReturn(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Fold Angle (°)</label>
                        <input
                          type="number" min="15" max="90"
                          value={foldAngle}
                          onChange={(e) => setFoldAngle(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Fold Depth (mm)</label>
                        <input
                          type="number" min="2" max="60"
                          value={foldDepth}
                          onChange={(e) => setFoldDepth(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Number of Bends</label>
                        <input
                          type="number" min="1" max="8"
                          value={numBends}
                          onChange={(e) => setNumBends(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {/* B. Double-Skin Hollow Blade Sub-Form */}
                  {bladeType === 'Double-skin hollow blade' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Front Skin Thk (mm)</label>
                        <input
                          type="number" step="0.2" min="0.8" max="6.0"
                          value={frontSkinThick}
                          onChange={(e) => setFrontSkinThick(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Rear Skin Thk (mm)</label>
                        <input
                          type="number" step="0.2" min="0.8" max="6.0"
                          value={rearSkinThick}
                          onChange={(e) => setRearSkinThick(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Blade Depth (mm)</label>
                        <input
                          type="number" min="15" max="150"
                          value={overallBladeDepth}
                          onChange={(e) => setOverallBladeDepth(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Cavity Depth (mm)</label>
                        <div className="px-2 py-1.5 bg-slate-100 rounded-lg font-mono font-bold text-slate-700">
                          {Math.max(0, overallBladeDepth - frontSkinThick - rearSkinThick).toFixed(1)} mm
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Stiffener Count</label>
                        <input
                          type="number" min="0" max="10"
                          value={internalStiffenerCount}
                          onChange={(e) => setInternalStiffenerCount(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Stiffener Thk (mm)</label>
                        <input
                          type="number" step="0.5" min="1.0" max="6.0"
                          value={internalStiffenerThick}
                          onChange={(e) => setInternalStiffenerThick(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Edge Flange (mm)</label>
                        <input
                          type="number" min="5" max="50"
                          value={edgeFlangeWidth}
                          onChange={(e) => setEdgeFlangeWidth(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {/* C. Aerofoil Blade Sub-Form */}
                  {bladeType === 'Aerofoil blade' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Profile Definition</label>
                        <select
                          value={profileDefinition}
                          onChange={(e) => setProfileDefinition(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                        >
                          <option value="NACA 0015 (Symmetric Aerofoil)">NACA 0015 (Symmetric Aerofoil)</option>
                          <option value="NACA 0012 (Thin Streamline)">NACA 0012 (Thin Streamline)</option>
                          <option value="Cambered 4-Digit Aerofoil">Cambered 4-Digit Aerofoil</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Max Profile Thk (mm)</label>
                        <input
                          type="number" min="10" max="60"
                          value={maxProfileThick}
                          onChange={(e) => setMaxProfileThick(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Leading Edge Rad (mm)</label>
                        <input
                          type="number" min="2" max="25"
                          value={leadingEdgeRadius}
                          onChange={(e) => setLeadingEdgeRadius(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Trailing Edge Thk (mm)</label>
                        <input
                          type="number" min="1" max="15"
                          value={trailingEdgeThick}
                          onChange={(e) => setTrailingEdgeThick(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Camber % of Chord</label>
                        <input
                          type="number" min="0" max="10" step="0.5"
                          value={camberPct}
                          onChange={(e) => setCamberPct(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {/* D. Custom Cross-Section Sub-Form */}
                  {bladeType === 'Custom cross-section blade' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Supported Profile Shape</label>
                        <select
                          value={customProfileShape}
                          onChange={(e) => setCustomProfileShape(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                        >
                          <option value="Z-profile">Z-profile (Offset Flanges)</option>
                          <option value="C-channel">C-channel (Parallel Flanges)</option>
                          <option value="Hat-channel">Hat-channel (Top Hat Section)</option>
                          <option value="Double-V">Double-V (Dual Rib Stiffened)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Web Dimension (mm)</label>
                        <input
                          type="number" min="20" max="350"
                          value={webDimension}
                          onChange={(e) => setWebDimension(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Flange Dimension (mm)</label>
                        <input
                          type="number" min="10" max="100"
                          value={flangeDimension}
                          onChange={(e) => setFlangeDimension(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Lip / Return (mm)</label>
                        <input
                          type="number" min="0" max="40"
                          value={lipDimension}
                          onChange={(e) => setLipDimension(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Profile Depth (mm)</label>
                        <input
                          type="number" min="5" max="80"
                          value={profileDepth}
                          onChange={(e) => setProfileDepth(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {/* E. Flat Single-Skin Informational Notice */}
                  {bladeType === 'Flat single-skin sheet blade' && (
                    <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-indigo-100 flex items-center justify-between">
                      <span>
                        Flat single-skin blade uses flat sheet geometry: Span {bladeSpan} mm × Chord {manualChord} mm × Thickness {bladeThick} mm.
                      </span>
                      <span className="font-mono font-bold text-indigo-700">Developed Width = Chord ({manualChord} mm)</span>
                    </div>
                  )}
                </div>

                {/* 4. Seals & Edge Sealing Configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Blade Edge Tip Seals</label>
                    <select
                      value={edgeSeal}
                      onChange={(e) => setEdgeSeal(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Rubber">Rubber EPDM / Neoprene (≤80°C)</option>
                      <option value="Metal">Stainless Steel Metal Edge (≤350°C)</option>
                      <option value="Ceramic Fibre">Ceramic Fibre (≤800°C)</option>
                      <option value="None">None (Metal-to-Metal clearance)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Side Jamb Seals</label>
                    <select
                      value={sideSeal}
                      onChange={(e) => setSideSeal(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Stainless Steel">SS 304 Spring Seals</option>
                      <option value="Flexible">Flexible Fabric</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                </div>

                {/* 5. Realtime Engineering Calculations & Blade Schedule */}
                <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                    <div className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Live Blade Engineering Calculations & Weight Verification</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Material Density: {mbMaterial === 'SS 304' || mbMaterial === 'SS 316' ? '7,930' : '7,850'} kg/m³
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-500 text-[11px]">Developed Sheet Width</div>
                      <div className="font-mono font-bold text-sm text-[#005daa]">
                        {calcResult?.derived_results?.developed_sheet_width || '-'} mm
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-500 text-[11px]">Single Blade Weight</div>
                      <div className="font-mono font-bold text-sm text-slate-900">
                        {calcResult?.derived_results?.blade_weight_each_kg ? `${calcResult.derived_results.blade_weight_each_kg} kg` : '-'}
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-500 text-[11px]">Total Blade Assembly Weight</div>
                      <div className="font-mono font-bold text-sm text-emerald-700">
                        {calcResult?.derived_results?.total_blade_weight_kg ? `${calcResult.derived_results.total_blade_weight_kg} kg` : '-'}
                      </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-slate-500 text-[11px]">Geometric Pitch vs Overlap</div>
                      <div className="font-mono font-bold text-sm text-slate-900">
                        {calcResult?.derived_results?.pitch ? `${calcResult.derived_results.pitch} mm / ${calcResult?.derived_results?.overlap_pct || overlapPct}%` : 'Valid'}
                      </div>
                    </div>
                  </div>

                  {/* Blade Schedule Table Preview */}
                  {calcResult?.derived_results?.blade_schedule && calcResult.derived_results.blade_schedule.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                        Blade Schedule Table (Export Specification)
                      </div>
                      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                        <table className="w-full text-[11px] text-left border-collapse">
                          <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="p-1.5 text-center">Item</th>
                              <th className="p-1.5">Blade Group</th>
                              <th className="p-1.5">Profile</th>
                              <th className="p-1.5 text-center">Qty</th>
                              <th className="p-1.5 text-right">Length</th>
                              <th className="p-1.5 text-right">Chord</th>
                              <th className="p-1.5 text-right">Depth</th>
                              <th className="p-1.5 text-right">Thk</th>
                              <th className="p-1.5 text-right">Dev. Width</th>
                              <th className="p-1.5 text-right">Unit Wt</th>
                              <th className="p-1.5 text-right">Total Wt</th>
                              <th className="p-1.5 text-center">Material</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                            {calcResult.derived_results.blade_schedule.map((row, idx) => (
                              <tr key={idx} className="hover:bg-blue-50/50">
                                <td className="p-1.5 text-center text-slate-500">{row.item}</td>
                                <td className="p-1.5 font-sans font-medium text-slate-900">{row.blade_group}</td>
                                <td className="p-1.5 font-sans text-slate-700">{row.profile_type}</td>
                                <td className="p-1.5 text-center font-bold text-blue-900">{row.qty}</td>
                                <td className="p-1.5 text-right">{row.length_mm} mm</td>
                                <td className="p-1.5 text-right">{row.chord_mm} mm</td>
                                <td className="p-1.5 text-right">{row.depth_mm} mm</td>
                                <td className="p-1.5 text-right">{row.thickness_mm} mm</td>
                                <td className="p-1.5 text-right">{row.developed_width_mm} mm</td>
                                <td className="p-1.5 text-right">{row.weight_each_kg} kg</td>
                                <td className="p-1.5 text-right font-bold text-emerald-800">{row.total_weight_kg} kg</td>
                                <td className="p-1.5 text-center font-sans">{row.material}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Group C: Shaft & Linkage */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    <span>Group C: Shaft, Bearings & Interconnecting Linkage</span>
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Shaft Diameter (mm)</label>
                    <input
                      type="number" min="10" max="60"
                      value={shaftDiameter}
                      onChange={(e) => setShaftDiameter(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Shaft Type</label>
                    <select
                      value={shaftType}
                      onChange={(e) => setShaftType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Round">Solid Round Bar</option>
                      <option value="Square">Square Bar</option>
                      <option value="Hollow">Hollow Heavy Tube</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Shaft Material</label>
                    <select
                      value={shaftMaterial}
                      onChange={(e) => setShaftMaterial(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="EN8">Carbon Steel EN8</option>
                      <option value="SS 304">Stainless Steel SS 304</option>
                      <option value="SS 316">Stainless Steel SS 316</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Bearings / Bushes</label>
                    <select
                      value={bearingType}
                      onChange={(e) => setBearingType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Bush">Bronze / Sintered Bush</option>
                      <option value="Ball">Precision Ball Bearing</option>
                      <option value="Sealed">High-Temp Sealed Bearing</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Drive Linkage</label>
                    <select
                      value={linkageType}
                      onChange={(e) => setLinkageType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Side-mounted crank & tie rod">Side-Mounted Crank & Tie Rod</option>
                      <option value="None">None (Direct Individual Drive)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Group D & E: Actuation, Accessories & Operating Conditions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Actuation */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-200 pb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>Group D: Actuation & Automation Accessories</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Actuator Drive</label>
                      <select
                        value={mbActuatorType}
                        onChange={(e) => setMbActuatorType(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                      >
                        <option value="Electric Actuator">Electric Quarter-Turn (AUMA/Rotork)</option>
                        <option value="Pneumatic Double-Acting">Pneumatic Double-Acting</option>
                        <option value="Pneumatic Spring-Return">Pneumatic Spring-Return (Fail-Safe)</option>
                        <option value="Manual Quadrant">Manual Hand Lever & Quadrant</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-2">Automation Accessories</label>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={hasLimitSwitch}
                            onChange={(e) => setHasLimitSwitch(e.target.checked)}
                            className="rounded border-slate-300 text-[#005daa]"
                          />
                          <span>Limit Switch (Open / Close feedback)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={hasSolenoid}
                            onChange={(e) => setHasSolenoid(e.target.checked)}
                            className="rounded border-slate-300 text-[#005daa]"
                          />
                          <span>Solenoid Valve (24V DC / 230V AC)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={hasPositioner}
                            onChange={(e) => setHasPositioner(e.target.checked)}
                            className="rounded border-slate-300 text-[#005daa]"
                          />
                          <span>Smart Electro-Pneumatic Positioner</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operating Conditions */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-200 pb-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-600" />
                    <span>Group E: Gas Flow Operating Conditions</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Temperature (°C)</label>
                      <input
                        type="number" min="-20" max="900"
                        value={tempC}
                        onChange={(e) => setTempC(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Max Pressure (Pa)</label>
                      <input
                        type="number" min="0" max="50000" step="100"
                        value={pressurePa}
                        onChange={(e) => setPressurePa(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Velocity (m/s)</label>
                      <input
                        type="number" min="1" max="40" step="0.5"
                        value={velocityMps}
                        onChange={(e) => setVelocityMps(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Leakage Class</label>
                      <select
                        value={leakageClass}
                        onChange={(e) => setLeakageClass(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                      >
                        <option value="Class I">Class I (Standard HVAC)</option>
                        <option value="Class II">Class II (Industrial Process)</option>
                        <option value="Class III">Class III (Tight Shutoff)</option>
                        <option value="Class IV">Class IV (Gas Isolation)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE DERIVED ENGINEERING RESULTS PANEL */}
              {calcResult?.derived_results && (
                <div className="bg-[#eff8fe] border border-blue-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                    <span className="font-extrabold text-xs text-[#005daa] uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#005daa]" />
                      <span>Live Parametric Derived Results (Multi-Blade Louver)</span>
                    </span>
                    <span className="text-[11px] font-mono font-bold text-blue-900">
                      Sections: {calcResult.derived_results.sections} • Total Blades: {calcResult.geometry?.total_blades_all_sections}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Blades / Sec</span>
                      <span className="text-base font-black font-mono text-[#005daa]">
                        {calcResult.derived_results.blade_count}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Pitch</span>
                      <span className="text-base font-black font-mono text-slate-900">
                        {calcResult.derived_results.blade_pitch_mm} <span className="text-[10px] font-normal text-slate-500">mm</span>
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Chord</span>
                      <span className="text-base font-black font-mono text-slate-900">
                        {calcResult.derived_results.blade_chord_mm} <span className="text-[10px] font-normal text-slate-500">mm</span>
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Blade Span</span>
                      <span className="text-base font-black font-mono text-slate-900">
                        {calcResult.derived_results.blade_length_mm} <span className="text-[10px] font-normal text-slate-500">mm</span>
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Free Area</span>
                      <span className="text-base font-black font-mono text-emerald-700">
                        {calcResult.derived_results.free_area_pct}%
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Single Blade Wt</span>
                      <span className="text-base font-black font-mono text-slate-900">
                        {calcResult.derived_results.blade_weight_kg} <span className="text-[10px] font-normal text-slate-500">kg</span>
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Damper Steel Wt</span>
                      <span className="text-base font-black font-mono text-[#005daa]">
                        {calcResult.derived_results.damper_weight_kg} <span className="text-[10px] font-normal text-slate-500">kg</span>
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Bushes & Cranks</span>
                      <span className="text-base font-black font-mono text-[#f89030]">
                        {calcResult.derived_results.num_bushes} / {calcResult.derived_results.num_cranks}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* BLADE SCHEDULE TABLE */}
              {calcResult?.geometry && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                    <span>Blade Schedule Specification Table</span>
                    <span className="font-mono text-slate-300 font-normal text-[11px]">
                      Action: {mbBladeAction} • Profile: {bladeType}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-center w-12">Section</th>
                          <th className="px-3 py-2 text-center">Blades / Sec</th>
                          <th className="px-3 py-2 text-right">Chord (mm)</th>
                          <th className="px-3 py-2 text-right">Blade Span (mm)</th>
                          <th className="px-3 py-2 text-right">Thickness (mm)</th>
                          <th className="px-3 py-2 text-right">Pitch (mm)</th>
                          <th className="px-3 py-2 text-right">Developed Width (mm)</th>
                          <th className="px-3 py-2 text-right">Single Blade Wt (kg)</th>
                          <th className="px-3 py-2 text-right">Total Blades Wt (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 font-mono">
                        {Array.from({ length: sections }).map((_, secIdx) => (
                          <tr key={secIdx} className="hover:bg-blue-50/40">
                            <td className="px-3 py-2 text-center font-bold text-[#005daa]">#{secIdx + 1}</td>
                            <td className="px-3 py-2 text-center font-bold">{calcResult.derived_results?.blade_count}</td>
                            <td className="px-3 py-2 text-right">{calcResult.derived_results?.blade_chord_mm}</td>
                            <td className="px-3 py-2 text-right">{calcResult.derived_results?.blade_length_mm}</td>
                            <td className="px-3 py-2 text-right">{calcResult.derived_results?.blade_thickness_mm}</td>
                            <td className="px-3 py-2 text-right">{calcResult.derived_results?.blade_pitch_mm}</td>
                            <td className="px-3 py-2 text-right">{(calcResult.derived_results?.blade_chord_mm * 1.5).toFixed(1)}</td>
                            <td className="px-3 py-2 text-right">{calcResult.derived_results?.blade_weight_kg}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900">
                              {((calcResult.derived_results?.blade_weight_kg || 0) * (calcResult.derived_results?.blade_count || 0)).toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Technical Customization Fields for Rack & Pinion / Other types */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div>
                <label className="block text-[#64748b] font-semibold mb-1">Actuation System</label>
                <select
                  value={actuatorType}
                  onChange={(e) => setActuatorType(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-[#005daa] focus:outline-none"
                >
                  <option value="electric">Electric (AUMA / Rotork)</option>
                  <option value="pneumatic">Pneumatic Cylinder (Festo)</option>
                  <option value="manual">Manual Handwheel & Lock</option>
                  <option value="hydraulic">Electro-Hydraulic Power</option>
                </select>
              </div>

              <div>
                <label className="block text-[#64748b] font-semibold mb-1">Blade / Gate Action</label>
                <select
                  value={bladeAction}
                  onChange={(e) => setBladeAction(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-[#005daa] focus:outline-none"
                >
                  <option value="single-sliding">Single Sliding Flap</option>
                  <option value="parallel">Parallel Blades (Low DP)</option>
                  <option value="opposed">Opposed Blades (Linear Control)</option>
                  <option value="disc">Central Disc (Butterfly)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#64748b] font-semibold mb-1">Sealing Class</label>
                <select
                  value={sealingEfficiency}
                  onChange={(e) => setSealingEfficiency(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-[#005daa] focus:outline-none"
                >
                  <option value="99.5%">99.5% Machined Metal Seat</option>
                  <option value="99.9%">99.9% Tadpole Bulb Seal</option>
                  <option value="100%">100% Pressurized Seal Air</option>
                </select>
              </div>

              <div>
                <label className="block text-[#64748b] font-semibold mb-1">Operating Temp</label>
                <select
                  value={designTemp}
                  onChange={(e) => setDesignTemp(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-[#005daa] focus:outline-none"
                >
                  <option value="ambient">Ambient to 150°C</option>
                  <option value="elevated">Elevated (Up to 350°C)</option>
                  <option value="high">High Temp (Up to 550°C)</option>
                  <option value="refractory">Refractory Lined (&gt;800°C)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#64748b] font-semibold mb-1">Design Pressure</label>
                <select
                  value={designPressure}
                  onChange={(e) => setDesignPressure(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-[#005daa] focus:outline-none"
                >
                  <option value="±500 mmWg">±500 mmWg (Standard Duct)</option>
                  <option value="±1500 mmWg">±1500 mmWg (Medium Draft)</option>
                  <option value="±3000 mmWg">±3000 mmWg (High Pressure)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#64748b] font-semibold mb-1">Duct Flange Style</label>
                <select
                  value={flangeType}
                  onChange={(e) => setFlangeType(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-slate-50/50 font-medium text-slate-800 focus:bg-white focus:border-[#005daa] focus:outline-none"
                >
                  <option value="Both Ends Flanged (IS 2062)">Both Ends Flanged (IS 2062)</option>
                  <option value="Wafer / Sandwich Type">Wafer / Sandwich Type</option>
                  <option value="Butt-Weld Duct Ends">Butt-Weld Duct Ends</option>
                </select>
              </div>
            </div>

            {/* Dedicated Blade / Gate Construction & Sizing Geometry Card */}
            <div className="mt-4 pt-4 border-t border-slate-200 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90 space-y-3">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-2.5 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f89030]" />
                  <h3 className="font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                    Blade / Gate Construction & Sizing Geometry
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-[#b45309]">
                    {bladeAction === 'disc' ? 'Butterfly Central Disc' : (bladeAction === 'parallel' || bladeAction === 'opposed' ? 'Louvered Multi-Blade' : 'Sliding Gate Flap')}
                  </span>
                </div>
                <div className="text-[11px] font-mono font-semibold text-[#005daa] bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                  {bladeAction === 'disc'
                    ? `Disc: ${width - 30} × ${height - 30} mm • Shaft Ø: ${discShaftDiameter} mm • Thk: ${discThickness} mm`
                    : (bladeAction === 'parallel' || bladeAction === 'opposed'
                      ? `Louver Blades: ${numberOfBlades} Blades • Action: ${bladeAction.toUpperCase()}`
                      : `Gate Flap: ${width - 30} × ${height + 50} mm • Thk: ${gateThickness} mm • Racks: ${gateRackCount}`)}
                </div>
              </div>

              {/* Dynamic Sub-form based on bladeAction */}
              {bladeAction === 'disc' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Disc Thickness (mm)</label>
                    <input
                      type="number" min="4" max="40" step="1"
                      value={discThickness}
                      onChange={(e) => setDiscThickness(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">Plate gauge (4–40mm)</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Central Shaft Ø (mm)</label>
                    <input
                      type="number" min="20" max="120" step="5"
                      value={discShaftDiameter}
                      onChange={(e) => setDiscShaftDiameter(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">Heavy through-spindle</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Hub Clamp Type</label>
                    <select
                      value={discHubType}
                      onChange={(e) => setDiscHubType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Double Hub Sleeve">Double Hub Sleeve</option>
                      <option value="Single Welded Boss">Single Welded Boss</option>
                      <option value="Integral Keyed Hub">Integral Keyed Hub</option>
                    </select>
                    <div className="text-[10px] text-slate-500 mt-1">Shaft-to-disc hub</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Disc Material</label>
                    <select
                      value={discMaterial}
                      onChange={(e) => setDiscMaterial(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="IS 2062">Carbon Steel IS 2062</option>
                      <option value="SS 304L">Stainless SS 304L</option>
                      <option value="SS 316">Stainless SS 316</option>
                      <option value="SS 410">Stainless SS 410</option>
                    </select>
                    <div className="text-[10px] text-slate-500 mt-1">Disc plate MOC</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Sealing Edge Strip</label>
                    <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800">
                      {sealingEfficiency === '100%' ? 'Seal Air Plenum (0% Leak)' : (sealingEfficiency === '99.9%' ? 'Tadpole Bulb Seal' : 'Machined Metal Seat')}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Perimeter seat face</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Estimated Disc Weight</label>
                    <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-emerald-800">
                      {((Math.max(100, width - 30) * Math.max(100, height - 30) * discThickness * 7850) / 1e9 + 15).toFixed(1)} kg
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Theoretical disc + hubs</div>
                  </div>
                </div>
              ) : (bladeAction === 'parallel' || bladeAction === 'opposed') ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Louver Blade Count</label>
                    <input
                      type="number" min="2" max="30" step="1"
                      value={numberOfBlades}
                      onChange={(e) => setNumberOfBlades(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">Number of louvers</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Blade Thickness (mm)</label>
                    <input
                      type="number" min="1.0" max="6.0" step="0.2"
                      value={bladeThick}
                      onChange={(e) => setBladeThick(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">Sheet thickness (mm)</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Blade Profile</label>
                    <select
                      value={bladeType}
                      onChange={(e) => setBladeType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Flat single-skin sheet blade">Flat Single-Skin</option>
                      <option value="Folded single-skin blade">Folded Stiffened Flange</option>
                      <option value="Double-skin hollow blade">Double-Skin Box</option>
                      <option value="Aerofoil blade">Aerofoil Streamline</option>
                    </select>
                    <div className="text-[10px] text-slate-500 mt-1">Profile cross-section</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Derived Blade Pitch</label>
                    <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-slate-800">
                      {Math.round(height / Math.max(1, numberOfBlades))} mm
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Center-to-center pitch</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Linkage Kinematics</label>
                    <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800">
                      {bladeAction === 'opposed' ? 'Opposed (Counter-Rotating)' : 'Parallel (Uni-Directional)'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Side tie rod linkage</div>
                  </div>
                </div>
              ) : (
                /* Single Sliding Gate Flap */
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Gate Plate Thk (mm)</label>
                    <input
                      type="number" min="3" max="25" step="0.5"
                      value={gateThickness}
                      onChange={(e) => setGateThickness(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">Main gate plate (3–25mm)</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Stiffener Ribs Count</label>
                    <input
                      type="number" min="1" max="10" step="1"
                      value={gateStiffenerCount}
                      onChange={(e) => setGateStiffenerCount(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-800"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">Horizontal face ribs</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Stiffener Profile</label>
                    <select
                      value={gateStiffenerType}
                      onChange={(e) => setGateStiffenerType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="Channel ISMC 75">Channel ISMC 75</option>
                      <option value="Channel ISMC 100">Channel ISMC 100</option>
                      <option value="Angle ISA 50x50">Angle ISA 50×50×6</option>
                      <option value="Flat Bar 65x10">Flat Bar 65×10</option>
                    </select>
                    <div className="text-[10px] text-slate-500 mt-1">Structural reinforcement</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Vertical Drive Racks</label>
                    <select
                      value={gateRackCount}
                      onChange={(e) => setGateRackCount(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value={2}>2 Precision Racks</option>
                      <option value={4}>4 Heavy Duty Racks</option>
                      <option value={6}>6 Extra-Wide Racks</option>
                    </select>
                    <div className="text-[10px] text-slate-500 mt-1">Spur rack & pinion drive</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Gate Material</label>
                    <select
                      value={gateMaterial}
                      onChange={(e) => setGateMaterial(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                    >
                      <option value="IS 2062">Carbon Steel IS 2062</option>
                      <option value="SS 304L">Stainless SS 304L</option>
                      <option value="SS 316">Stainless SS 316</option>
                      <option value="SS 410">Stainless SS 410</option>
                      <option value="Hardox 400">Hardox 400 Wear Plate</option>
                    </select>
                    <div className="text-[10px] text-slate-500 mt-1">Gate plate MOC</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Estimated Gate Weight</label>
                    <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-emerald-800">
                      {((Math.max(100, width - 30) * Math.max(100, height + 50) * gateThickness * 7850) / 1e9 + gateStiffenerCount * 12).toFixed(1)} kg
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Plate + stiffeners + racks</div>
                  </div>
                </div>
              )}
            </div>
          </>
          )}
        </div>
          </>
        )}

        {/* 4. Parametric 3D CAD Model Designer */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#005daa]"></span>
              <div>
                <h2 className="font-bold text-sm sm:text-base text-[#212529] uppercase tracking-wide">
                  {isValveMode ? '4. Parametric 3D CAD Valve Model Designer' : '4. Parametric 3D CAD Damper Model Designer'}
                </h2>
                <p className="text-xs text-[#64748b]">
                  {isValveMode
                    ? `Model generated for: DN${valveSizeDn} (${STANDARD_VALVE_DNS.find(v => v.dn === Number(valveSizeDn))?.inch || '12"'}) • ${valvePressureRating} • ${currentValveType.name}`
                    : `Model generated to specified dimensions: ${width} × ${height} × ${depth} mm • ${currentDamperType.name}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-[#eff8fe] text-[#005daa] rounded-lg border border-blue-200">
                {isValveMode ? `Drive: ${valveActuator.split(' ')[0].toUpperCase()}` : `Drive: ${(isMultiBlade ? mbActuatorType : actuatorType).toUpperCase()}`}
              </span>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-amber-50 text-[#f89030] rounded-lg border border-amber-200">
                {isValveMode ? `Rating: ${valvePressureRating}` : `Seal: ${sealingEfficiency}`}
              </span>
              <button
                onClick={() => setShow3DViewer(!show3DViewer)}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                {show3DViewer ? 'Collapse View' : 'Expand 3D CAD'}
              </button>
            </div>
          </div>

          {show3DViewer ? (
            <div className="space-y-2">
              <Damper3DViewer 
                productCategory={productCategory}
                valveType={selectedValveTypeId}
                valveTypeName={currentValveType.name}
                valveSizeDn={valveSizeDn}
                valveSizeInch={STANDARD_VALVE_DNS.find(v => v.dn === Number(valveSizeDn))?.inch || `${Math.round(valveSizeDn/25.4)}"`}
                valvePressureRating={valvePressureRating}
                valveEndConnection={valveEndConnection}
                valveBodyMoc={valveBodyMoc}
                valveTrimMoc={valveTrimMoc}
                valveSeatMoc={valveSeatMoc}
                valveActuator={valveActuator}
                width={width}
                height={height}
                depth={depth}
                damperType={isMultiBlade ? 'multi_blade' : selectedDamperTypeId}
                damperTypeName={currentDamperType.name}
                actuatorType={isMultiBlade ? mbActuatorType : actuatorType}
                bladeAction={isMultiBlade ? mbBladeAction : bladeAction}
                sealingEfficiency={sealingEfficiency}
                designTemp={designTemp}
                designPressure={designPressure}
                flangeType={isMultiBlade ? mbFlangeType : flangeType}
                numberOfBlades={isMultiBlade ? (calcResult?.derived_results?.blade_count || (bladeMode === 'AUTO' ? targetCount : manualBladeCount) || 12) : numberOfBlades}
                opposedBlades={isMultiBlade ? (mbBladeAction === 'Opposed') : (bladeAction === 'opposed')}
                gateThickness={gateThickness}
                gateStiffenerCount={gateStiffenerCount}
                gateStiffenerType={gateStiffenerType}
                gateRackCount={gateRackCount}
                discThickness={discThickness}
                discShaftDiameter={discShaftDiameter}
                bladeType={bladeType}
                bladeChord={calcResult?.derived_results?.blade_chord || (bladeMode === 'AUTO' ? (calcResult?.derived_results?.blade_chord || manualChord) : (bladeChord || manualChord))}
                bladeLength={calcResult?.derived_results?.blade_length || (bladeMode === 'AUTO' ? (width - 2 * sideClearance) : bladeSpan)}
                bladeDepth={calcResult?.derived_results?.blade_depth || bladeDepth}
                bladeThick={bladeThick}
                bladePitch={calcResult?.derived_results?.pitch || (bladeMode === 'AUTO' ? targetPitch : 150)}
                bladeOrientation={bladeOrientation}
                sections={sections}
                sideClearance={sideClearance}
                endClearance={endClearance}
                shaftDiameter={shaftDiameter}
                flangeLeft={flangeLeft}
                flangeRight={flangeRight}
                foldAngle={foldAngle}
                foldDepth={foldDepth}
                edgeReturn={edgeReturn}
                webWidth={webWidth}
                numBends={numBends}
                frontSkinThick={frontSkinThick}
                rearSkinThick={rearSkinThick}
                overallBladeDepth={overallBladeDepth}
                internalStiffenerCount={internalStiffenerCount}
                aerofoilMaxThick={maxProfileThick}
                aerofoilCamber={camberPct}
                customProfileShape={customProfileShape}
              />
              <div className="flex items-center justify-between text-[11px] text-[#64748b] px-1">
                <span>
                  ✓ CAD model updates dynamically in real-time when any dimension, blade parameter, or valve option is adjusted above.
                </span>
                <span className="font-mono">
                  {isValveMode
                    ? `Valve Bore: DN${valveSizeDn} • Rating: ${valvePressureRating} • Connection: ${valveEndConnection}`
                    : `Scale: 1m = 1 unit • Blades: ${numberOfBlades} • Clearance: ${width - 30} × ${height} mm`}
                </span>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setShow3DViewer(true)}
              className="py-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center cursor-pointer hover:bg-blue-50/50 transition-colors"
            >
              <div className="font-semibold text-xs text-[#005daa]">
                Click to open interactive 3D CAD Model ({width} × {height} × {depth} mm)
              </div>
            </div>
          )}
        </div>

        {/* 5. Master Rates Quick-Adjust Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[#eff8fe]/60 p-3 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2 text-[#005daa] font-bold">
              <Sliders className="w-4 h-4 text-[#005daa]" />
              <span>Global Material Baseline (₹/kg):</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">IS 2062:</span>
                <input
                  type="number"
                  value={activeRates.material_rates['IS 2062']}
                  onChange={(e) => updateMatRate('IS 2062', e.target.value)}
                  className="w-14 px-1 py-0.5 text-right font-mono font-bold text-slate-900 bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">SS 304L:</span>
                <input
                  type="number"
                  value={activeRates.material_rates['SS 304L']}
                  onChange={(e) => updateMatRate('SS 304L', e.target.value)}
                  className="w-14 px-1 py-0.5 text-right font-mono font-bold text-slate-900 bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">SS 410:</span>
                <input
                  type="number"
                  value={activeRates.material_rates['SS 410']}
                  onChange={(e) => updateMatRate('SS 410', e.target.value)}
                  className="w-14 px-1 py-0.5 text-right font-mono font-bold text-slate-900 bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">EN8:</span>
                <input
                  type="number"
                  value={activeRates.material_rates['EN8']}
                  onChange={(e) => updateMatRate('EN8', e.target.value)}
                  className="w-14 px-1 py-0.5 text-right font-mono font-bold text-slate-900 bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">Fab Rate:</span>
                <input
                  type="number"
                  value={activeRates.fabrication_rate_per_kg}
                  onChange={(e) => setActiveRates({ ...activeRates, fabrication_rate_per_kg: parseFloat(e.target.value) || 0 })}
                  className="w-14 px-1 py-0.5 text-right font-mono font-bold text-slate-900 bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-[#f89030]">
                <span className="text-[#005daa] font-bold">Markup Factor:</span>
                <input
                  type="number"
                  step="0.01"
                  min="1.0"
                  max="3.0"
                  value={markupMultiplier}
                  onChange={(e) => setMarkupMultiplier(parseFloat(e.target.value) || 1.10)}
                  className="w-16 px-1 py-0.5 text-right font-mono font-bold text-[#f89030] bg-transparent focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>



      {/* 2D Engineering Design Blueprint Uploader & Component Suggester */}
      <TwoDDesignAnalyzer
        onApplyComponents={handleApply2DComponents}
        onSelectDimensions={handleSelectDimensions}
        currentDamperType={currentDamperType}
        currentProductCategory={productCategory}
      />

      {/* Engineering Formula Inspector & Error/Tolerance Allowance Engine */}
      <FormulaInspector
        formulas={customFormulas}
        onUpdateFormula={handleUpdateFormula}
        onResetFormulas={handleResetFormulas}
        densityMultiplier={densityMultiplier}
        setDensityMultiplier={setDensityMultiplier}
        cuttingTolerancePct={cuttingTolerancePct}
        setCuttingTolerancePct={setCuttingTolerancePct}
        labourDivisor={labourDivisor}
        setLabourDivisor={setLabourDivisor}
        finishingRatePerKg={finishingRatePerKg}
        setFinishingRatePerKg={setFinishingRatePerKg}
        fabricationRatePerKg={fabricationRatePerKg}
        setFabricationRatePerKg={setFabricationRatePerKg}
        activeRates={activeRates}
        isMultiBlade={isMultiBlade}
        isValveMode={isValveMode}
      />

      {/* TABLE 1: Complete 45-Part Fabricated Bill of Materials (Exact replicate of PDF pages 1, 3, 5) */}
      <div className="bg-[#FFFDFB] border border-[#E8E3D8] rounded-2xl shadow-sm overflow-hidden space-y-0">
        <div className="bg-gradient-to-r from-[#2F4D40] via-[#3D6353] to-[#487361] text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm uppercase tracking-wide">
            <span>4. Fabricated Parts Cost Sheet ({currentDamperType.id === 'rack-pinion' ? 'All 45 Parts Certified Schedule' : `${currentDamperType.shortName} Proportional Schedule`})</span>
          </div>
          <div className="text-[11px] text-[#D5E5DC] font-mono">
            {displayLines.length} Items Configured • Rates & Formulas Editable Inline
          </div>
          <button type="button" onClick={addCustomBomLine} className="inline-flex items-center gap-1 rounded border border-white/40 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/10 transition-colors"><Plus size={14} /> Add custom line</button>
        </div>

        {/* Live Active Formulas Status Bar */}
        <div className="bg-[#F5F2EB] border-b border-[#E8E3D8] px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-[#242826] flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-[#3D6353]" />
              Active Cost Formulas:
            </span>
            <span className="bg-white px-2 py-0.5 rounded border border-[#E0D9CC] font-mono text-[11px] text-[#242826] shadow-sm" title="Plate Weight Formula">
              Plate Wt: <strong className="text-[#3D6353]">{customFormulas.plateWeight}</strong>
            </span>
            <span className="bg-white px-2 py-0.5 rounded border border-[#E0D9CC] font-mono text-[11px] text-[#242826] shadow-sm" title="Raw Material Cost Formula">
              RM: <strong className="text-[#2F5241]">{customFormulas.rawMaterial}</strong>
            </span>
            <span className="bg-white px-2 py-0.5 rounded border border-[#E0D9CC] font-mono text-[11px] text-[#242826] shadow-sm" title="Machining & Labour Formula">
              Labour/Mfg: <strong className="text-[#8C5D19]">{customFormulas.machiningLabour}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isCustomFormulasActive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FEF7EB] text-[#8C5D19] border border-[#F3DACF] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C46346] animate-pulse"></span>
                Customized Formulas Applied
              </span>
            )}
            {isCustomFormulasActive && (
              <button
                type="button"
                onClick={handleResetFormulas}
                className="text-[11px] text-[#C46346] hover:text-[#9A3B22] font-semibold flex items-center gap-1 bg-[#FDF1EB] hover:bg-[#FBE4D8] px-2 py-0.5 rounded border border-[#F3DACF] transition-colors"
                title="Reset formulas to factory certified standard"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Formulas
              </button>
            )}
          </div>
        </div>

        {calcResult?.validation_warnings?.length > 0 && <div className="space-y-1 border-b border-[#F3DACF] bg-[#FEF7EB] px-4 py-2 text-xs text-[#8C5D19]">
          {calcResult.validation_warnings.map((warning) => <p key={warning.rule_id} className="flex items-center gap-2"><AlertTriangle size={14} />{warning.message}</p>)}
        </div>}

        {bomAdditions.length > 0 && <div className="space-y-2 border-b border-[#E8E3D8] bg-[#FAF7F2] p-3">
          {bomAdditions.map((line, index) => <div key={index} className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-9">
            {[
              ['part_name', 'Part name', 'text'], ['dim_1', 'Dim 1 mm', 'number'], ['dim_2', 'Dim 2 mm', 'number'],
              ['dim_3', 'Thickness mm', 'number'], ['qty', 'Qty', 'number'], ['moc', 'MOC', 'text'],
              ['material_rate', 'Rate/kg', 'number'], ['per_piece_machining', 'Machining', 'number'],
            ].map(([key, label, type]) => <label key={key} className="text-[10px] font-semibold uppercase text-[#5C6460]">{label}<input type={type} className="mt-1 w-full rounded border border-[#DDD6C8] bg-white px-2 py-1.5 text-xs focus:border-[#3D6353] focus:outline-none" value={line[key]} min={type === 'number' ? 0 : undefined} onChange={(event) => setBomAdditions((current) => current.map((item, i) => i === index ? { ...item, [key]: type === 'number' ? Number(event.target.value) : event.target.value } : item))} /></label>)}
            <button type="button" aria-label={`Remove ${line.part_name}`} title="Remove custom line" className="self-end rounded border border-[#DDD6C8] bg-white p-2 text-[#5C6460] hover:bg-[#FDF1EB] hover:text-[#C46346]" onClick={() => setBomAdditions((current) => current.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
          </div>)}
        </div>}

        <div className="overflow-x-auto max-h-[620px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#284136] text-white uppercase text-[10px] font-semibold tracking-wider z-10">
              <tr>
                <th className="px-2.5 py-2 text-center w-10 border border-[#3A5649]">Sr.No</th>
                <th className="px-3 py-2 border border-[#3A5649]">Part Name</th>
                <th className="px-2 py-2 text-center border border-[#3A5649]" colSpan="3">SHEET SIZE / DIM</th>
                <th className="px-2 py-2 text-center w-12 border border-[#3A5649]">Qty</th>
                <th className="px-2.5 py-2 text-right border border-[#3A5649]">Total Wt (kg)</th>
                <th className="px-2.5 py-2 text-center border border-[#3A5649]">MOC</th>
                <th className="px-2.5 py-2 text-right border border-[#3A5649] w-24 bg-[#23382F]">Rate (₹/kg)</th>
                <th className="px-3 py-2 text-right border border-[#3A5649]">RM Cost (₹)</th>
                <th className="px-2.5 py-2 text-right border border-[#3A5649] w-20 bg-[#23382F]">LC Rate</th>
                <th className="px-2.5 py-2 text-right border border-[#3A5649]">LC (₹)</th>
                <th className="px-2 py-2 text-right border border-[#3A5649] w-14">RC (₹)</th>
                <th className="px-2.5 py-2 text-right border border-[#3A5649] w-20 bg-[#23382F]">MC (₹)</th>
                <th className="px-3 py-2 text-right border border-[#3A5649] bg-[#1F332A]">TOTAL MC (₹)</th>
                <th className="px-2.5 py-2 text-right border border-[#3A5649] w-24 bg-[#563428]">± Error (₹)</th>
                <th className="px-3 py-2 text-right border border-[#3A5649] bg-[#1F332A]">Line Total (₹)</th>
                <th className="px-2.5 py-2 text-center border border-[#3A5649]">Remove</th>
              </tr>
              <tr className="bg-[#314E42] text-[9px] text-[#D0E2D8] font-normal">
                <th className="border border-[#3A5649]"></th>
                <th className="border border-[#3A5649]"></th>
                <th className="px-1 py-1 text-center border border-[#3A5649]">L / DIA</th>
                <th className="px-1 py-1 text-center border border-[#3A5649]">W / LENG</th>
                <th className="px-1 py-1 text-center border border-[#3A5649]">T</th>
                <th className="border border-[#3A5649]"></th>
                <th className="border border-[#3A5649]"></th>
                <th className="border border-[#3A5649]"></th>
                <th className="border border-[#3A5649] text-center">Editable</th>
                <th className="border border-[#3A5649]"></th>
                <th className="border border-[#3A5649] text-center">Editable</th>
                <th className="border border-[#3A5649]"></th>
                <th className="border border-[#3A5649]"></th>
                <th className="border border-[#3A5649] text-center">Editable</th>
                <th className="border border-[#3A5649]"></th>
                <th className="border border-[#3A5649] text-center font-bold text-[#FCD9A5]">Editable (±)</th>
                <th className="border border-[#3A5649]"></th>
                <th className="border border-[#3A5649] text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE5DB] text-[#242826] font-sans">
              {displayLines.map((l, index) => {
                const lineIndex = l.source_line_index ?? index;
                const edit = manualBomEdits[lineIndex] || {};
                return (
                <tr 
                  key={`${lineIndex}-${l.sr_no ?? index}`} 
                  className={`hover:bg-[#EEF5F1] transition-colors ${index % 2 === 0 ? 'bg-[#FFFDFB]' : 'bg-[#FAF7F2]'}`}
                >
                  <td className="px-2 py-1.5 text-center font-mono text-[#5C6460] font-medium border-r border-[#EAE5DB]">
                    {l.sr_no}
                  </td>
                  <td className="px-3 py-1.5 font-medium text-slate-900 border-r border-slate-200">
                    {l.part_name} {(l.is_manually_edited || edit.edit_note) && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-800">Edited</span>}
                  </td>
                  {/* Dimensions L, W, T */}
                  <td className="px-1.5 py-1.5 text-right font-mono text-slate-700 border-r border-slate-200">
                    <input aria-label={`${l.part_name} dimension 1`} className="w-20 border border-transparent bg-transparent px-1 text-right hover:border-slate-300 focus:border-blue-500 focus:bg-white" type="number" min="0" value={edit.dim_1 ?? l.dim1} onChange={(e) => updateBomField(lineIndex, 'dim_1', readNumber(e.target.value, 0))} />
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-slate-700 border-r border-slate-200">
                    <input aria-label={`${l.part_name} dimension 2`} className="w-20 border border-transparent bg-transparent px-1 text-right hover:border-slate-300 focus:border-blue-500 focus:bg-white" type="number" min="0" value={edit.dim_2 ?? l.dim2} onChange={(e) => updateBomField(lineIndex, 'dim_2', readNumber(e.target.value, 0))} />
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-slate-700 border-r border-slate-200">
                    {l.is_round ? '-' : <input aria-label={`${l.part_name} thickness`} className="w-14 border border-transparent bg-transparent px-1 text-right hover:border-slate-300 focus:border-blue-500 focus:bg-white" type="number" min="0" value={edit.dim_3 ?? l.dim3} onChange={(e) => updateBomField(lineIndex, 'dim_3', readNumber(e.target.value, 0))} />}
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-900 border-r border-slate-200">
                    <input aria-label={`${l.part_name} quantity`} className="w-12 border border-transparent bg-transparent text-center hover:border-slate-300 focus:border-blue-500 focus:bg-white" type="number" min="1" step="1" value={edit.qty ?? l.quantity} onChange={(e) => updateBomField(lineIndex, 'qty', Math.max(1, readNumber(e.target.value, 1)))} />
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-mono font-medium text-slate-800 border-r border-slate-200">
                    {(Number(l.total_weight) || 0).toFixed(1)}
                  </td>
                  <td className="px-2.5 py-1.5 text-center font-mono text-[11px] text-slate-700 border-r border-slate-200">
                    <input aria-label={`${l.part_name} material`} className="w-20 border border-transparent bg-transparent text-center hover:border-slate-300 focus:border-blue-500 focus:bg-white" value={edit.moc ?? l.moc} onChange={(e) => updateBomField(lineIndex, 'moc', e.target.value)} />
                  </td>

                  {/* EDITABLE RATE (Rs/kg) */}
                  <td className="px-1.5 py-1 text-right border-r border-slate-200 bg-amber-50/30">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      aria-label={`${l.part_name} rate per kg`}
                      value={edit.material_rate ?? l.active_mat_rate}
                      onChange={(e) => {
                        const val = readNumber(e.target.value, 0);
                        updateBomField(lineIndex, 'material_rate', val);
                        setLineRateOverrides((p) => ({ ...p, [l.sr_no]: val }));
                      }}
                      className="w-20 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white text-slate-900 focus:ring-1 focus:ring-blue-600"
                    />
                  </td>

                  {/* RM COST */}
                  <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-900 border-r border-slate-200">
                    {formatNumber(l.active_rm_cost, 0)}
                  </td>

                  {/* EDITABLE LC RATE */}
                  <td className="px-1.5 py-1 text-right border-r border-slate-200">
                    {l.is_round ? (
                      <span className="text-slate-400 font-mono">-</span>
                    ) : (
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        aria-label={`${l.part_name} labour rate`}
                        value={edit.plate_labour_rate ?? l.active_lc_rate}
                        onChange={(e) => {
                          const val = readNumber(e.target.value, 0);
                          updateBomField(lineIndex, 'plate_labour_rate', val);
                          setLineLcRateOverrides((p) => ({ ...p, [l.sr_no]: val }));
                        }}
                        className="w-16 px-1.5 py-0.5 text-right font-mono text-xs border border-slate-300 rounded bg-white text-slate-800 focus:ring-1 focus:ring-blue-600"
                      />
                    )}
                  </td>

                  {/* LC COST */}
                  <td className="px-2.5 py-1.5 text-right font-mono text-slate-700 border-r border-slate-200">
                    {formatNumber(l.active_lc_cost, 0)}
                  </td>

                  {/* ROLLING RC */}
                  <td className="px-2 py-1.5 text-right font-mono text-slate-500 border-r border-slate-200">
                    {l.rolling_cost || 0}
                  </td>

                  {/* EDITABLE MC (Machining Cost per pc) */}
                  <td className="px-1.5 py-1 text-right border-r border-slate-200 bg-amber-50/30">
                    <input
                      type="number"
                      step="10"
                      min="0"
                      aria-label={`${l.part_name} machining cost`}
                      value={edit.per_piece_machining ?? l.active_mc}
                      onChange={(e) => {
                        const val = readNumber(e.target.value, 0);
                        updateBomField(lineIndex, 'per_piece_machining', val);
                        setLineMcOverrides((p) => ({ ...p, [l.sr_no]: val }));
                      }}
                      className="w-16 px-1.5 py-0.5 text-right font-mono text-xs border border-slate-300 rounded bg-white text-slate-900 focus:ring-1 focus:ring-blue-600"
                    />
                  </td>

                  {/* TOTAL MC */}
                  <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-900 border-r border-slate-200 bg-slate-50/60">
                    {formatNumber(l.active_total_mc, 0)}
                  </td>

                  {/* EDITABLE ERROR / TOLERANCE ALLOWANCE (±₹) */}
                  <td className="px-1.5 py-1 text-right border-r border-slate-200 bg-amber-50/50">
                    <input
                      type="number"
                      step="50"
                      aria-label={`${l.part_name} error tolerance allowance`}
                      placeholder="±0"
                      value={edit.error_allowance ?? (lineErrorOverrides[l.sr_no] ?? '')}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        updateBomField(lineIndex, 'error_allowance', val);
                        setLineErrorOverrides((p) => ({ ...p, [l.sr_no]: val }));
                      }}
                      className="w-20 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-amber-300 rounded bg-white text-amber-900 focus:ring-1 focus:ring-amber-500"
                    />
                  </td>

                  {/* LINE TOTAL */}
                  <td className="px-1.5 py-1 text-right font-mono font-bold text-blue-950 bg-amber-50/40">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      aria-label={`${l.part_name} line total`}
                      value={edit.line_total ?? Math.round(Number(l.active_line_total) || 0)}
                      onChange={(e) => updateBomField(lineIndex, 'line_total', readNumber(e.target.value, 0))}
                      className="w-24 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white text-blue-950 focus:ring-1 focus:ring-blue-600"
                    />
                  </td>
                  <td className="px-2 py-1 text-center"><button type="button" title={`Remove ${l.part_name}`} aria-label={`Remove ${l.part_name}`} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={() => updateBomField(lineIndex, 'is_delete', true)}><Trash2 size={14} /></button></td>
                </tr>
              )})}
            </tbody>

            {/* Subtotal Footer Row Matching Excel Sheet */}
            <tfoot className="bg-slate-200 text-slate-900 font-bold border-t-2 border-slate-400 text-xs">
              <tr>
                <td colSpan="6" className="px-4 py-2.5 text-right uppercase tracking-wider text-slate-700">
                  Total Fabricated Damper Weight:
                </td>
                <td className="px-2.5 py-2.5 text-right font-mono text-sm text-blue-900 bg-blue-50/80 border-r border-slate-300">
                  {formatWeight(totalWeight)}
                </td>
                <td className="px-2 py-2.5 text-right uppercase text-slate-700">
                  Total RM:
                </td>
                <td className="border-r border-slate-300"></td>
                <td className="px-3 py-2.5 text-right font-mono text-sm text-blue-900 bg-blue-50/80 border-r border-slate-300">
                  ₹ {formatNumber(totalRmCost, 0)}
                </td>
                <td colSpan="4" className="px-2 py-2.5 text-right uppercase text-slate-700">
                  Total MC Cost:
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-sm text-blue-900 bg-blue-50/80 border-r border-slate-300">
                  ₹ {formatNumber(totalMcCost, 0)}
                </td>
                <td className="px-2 py-2.5 text-center font-mono text-xs text-amber-900 bg-amber-100/60 border-r border-slate-300">
                  {Object.values(lineErrorOverrides).reduce((a, b) => a + (Number(b) || 0), 0) !== 0 
                    ? `± ₹ ${formatNumber(Object.values(lineErrorOverrides).reduce((a, b) => a + (Number(b) || 0), 0), 0)}` 
                    : '-'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-sm text-slate-900 bg-slate-300">
                  ₹ {formatNumber(sheetLineTotal, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* TABLES 2 & 3: Bought-Out Components & Automation Breakdown (Exact replicate of PDF Page 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Bought-Out Components Table */}
        <div className="bg-[#FFFDFB] border border-[#E8E3D8] rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-gradient-to-r from-[#2F4D40] via-[#3D6353] to-[#487361] text-white px-5 py-3 flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm uppercase tracking-wide">
                5. Bought-Out & Finishing Breakdown
              </span>
              <span className="text-[11px] text-[#D5E5DC] font-mono">Rates Editable</span>
            </div>

            <table className="w-full text-xs text-left">
              <thead className="bg-[#F5F2EB] text-[#5C6460] font-semibold uppercase text-[10px] border-b border-[#E8E3D8]">
                <tr>
                  <th className="px-3 py-2 w-12 text-center">Sr.No</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-center w-24">Factor / Qty</th>
                  <th className="px-3 py-2 text-right w-28">Rate (₹)</th>
                  <th className="px-4 py-2 text-right">Cost (₹)</th>
                </tr>
              </thead>
              {isMultiBlade ? (
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr>
                    <td className="px-3 py-2 text-center font-mono text-slate-400">1</td>
                    <td className="px-3 py-2 font-medium">Raw Material Cost</td>
                    <td className="px-3 py-2 text-center font-mono">1</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">-</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(totalRmCost, 0)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-center font-mono text-slate-400">2</td>
                    <td className="px-3 py-2 font-medium">Machining & Labour Cost</td>
                    <td className="px-3 py-2 text-center font-mono">1</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">-</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(totalMcCost, 0)}</td>
                  </tr>
                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">3</td>
                    <td className="px-3 py-2 font-medium">{bearingType} Bearings / Bushes</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-900">{calcResult?.derived_results?.num_bushes || 0}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">₹450/pc</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber((calcResult?.derived_results?.num_bushes || 0) * 450, 0)}</td>
                  </tr>
                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">4</td>
                    <td className="px-3 py-2 font-medium">Crank Levers</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-900">{calcResult?.derived_results?.num_cranks || 0}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">₹650/pc</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber((calcResult?.derived_results?.num_cranks || 0) * 650, 0)}</td>
                  </tr>
                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">5</td>
                    <td className="px-3 py-2 font-medium">Tie Rod ({linkageType})</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-900">{((height / 1000.0) * sections).toFixed(2)} m</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">₹350/m</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber((height / 1000.0) * sections * 350, 0)}</td>
                  </tr>
                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">6</td>
                    <td className="px-3 py-2 font-medium">Blade Edge Seals ({edgeSeal})</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-900">{calcResult?.derived_results?.edge_seal_meters || 0} m</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">Price list</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">
                      {formatNumber((calcResult?.derived_results?.edge_seal_meters || 0) * (edgeSeal === 'Rubber' ? 180 : edgeSeal === 'Metal' ? 420 : 750), 0)}
                    </td>
                  </tr>
                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">7</td>
                    <td className="px-3 py-2 font-medium">Side Jamb Seals ({sideSeal})</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-900">{calcResult?.derived_results?.side_seal_meters || 0} m</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">Price list</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">
                      {formatNumber((calcResult?.derived_results?.side_seal_meters || 0) * (sideSeal === 'Stainless Steel' ? 380 : 220), 0)}
                    </td>
                  </tr>
                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">8</td>
                    <td className="px-3 py-2 font-medium">Hardware & Nameplate</td>
                    <td className="px-3 py-2 text-center font-mono text-slate-400">Lump sum</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">₹15,800</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">₹15,800</td>
                  </tr>
                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">9</td>
                    <td className="px-3 py-2 font-medium">Finishing Cost (₹/kg)</td>
                    <td className="px-3 py-2 text-center font-mono text-slate-500">{(Number(totalWeight) || 0).toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">₹{finishingRate}/kg</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(finishingCost, 0)}</td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr>
                    <td className="px-3 py-2 text-center font-mono text-slate-400">1</td>
                    <td className="px-3 py-2 font-medium">Raw Material Cost</td>
                    <td className="px-3 py-2 text-center font-mono">1</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">-</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(totalRmCost, 0)}</td>
                  </tr>

                  <tr>
                    <td className="px-3 py-2 text-center font-mono text-slate-400">2</td>
                    <td className="px-3 py-2 font-medium">Machining Cost</td>
                    <td className="px-3 py-2 text-center font-mono">1</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">-</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(totalMcCost, 0)}</td>
                  </tr>

                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">3</td>
                    <td className="px-3 py-2 font-medium">Rack (scaled with height)</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-900">{rackQty}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      <input
                        type="number"
                        step="500"
                        value={rackRate}
                        onChange={(e) => updateBoughtOutRate('rack_base', e.target.value)}
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(rackCost, 0)}</td>
                  </tr>

                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">4</td>
                    <td className="px-3 py-2 font-medium">Drive Pinion</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-900">{drivePinionQty}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      <input
                        type="number"
                        step="500"
                        value={drivePinionRate}
                        onChange={(e) => updateBoughtOutRate('drive_pinion', e.target.value)}
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(drivePinionCost, 0)}</td>
                  </tr>

                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">5</td>
                    <td className="px-3 py-2 font-medium">Free Rotated Pinion</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-900">{freePinionQty}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      <input
                        type="number"
                        step="500"
                        value={freePinionRate}
                        onChange={(e) => updateBoughtOutRate('free_pinion', e.target.value)}
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(freePinionCost, 0)}</td>
                  </tr>

                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">6</td>
                    <td className="px-3 py-2 font-medium">Bearing Cost</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-900">{bearingQty}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      <input
                        type="number"
                        step="500"
                        value={bearingRate}
                        onChange={(e) => updateBoughtOutRate('bearing', e.target.value)}
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(bearingCost, 0)}</td>
                  </tr>

                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">7</td>
                    <td className="px-3 py-2 font-medium">Hardware (lump sum)</td>
                    <td className="px-3 py-2 text-center font-mono text-slate-400">-</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      <input
                        type="number"
                        step="1000"
                        value={hardwareCost}
                        onChange={(e) => updateBoughtOutRate('hardware', e.target.value)}
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(hardwareCost, 0)}</td>
                  </tr>

                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">8</td>
                    <td className="px-3 py-2 font-medium">Finishing Cost (₹/kg)</td>
                    <td className="px-3 py-2 text-center font-mono text-slate-500">{(Number(totalWeight) || 0).toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      <input
                        type="number"
                        step="1"
                        value={finishingRate}
                        onChange={(e) => setActiveRates({ ...activeRates, finishing_rate_per_kg: parseFloat(e.target.value) || 0 })}
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(finishingCost, 0)}</td>
                  </tr>

                  <tr className="bg-amber-50/20">
                    <td className="px-3 py-2 text-center font-mono text-slate-400">9</td>
                    <td className="px-3 py-2 font-medium">Gland packing</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-900">{glandQty}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      <input
                        type="number"
                        step="10"
                        value={glandRate}
                        onChange={(e) => updateBoughtOutRate('gland_packing_unit', e.target.value)}
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{formatNumber(glandCost, 0)}</td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>

          {/* Damper Basic Cost Highlight Row */}
          <div className="bg-[#EEF5F1] border-t-2 border-[#3D6353] px-4 py-3 flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wide text-[#2F4D40]">
              Damper Basic Cost
            </span>
            <span className="font-mono font-extrabold text-base text-[#1E3B2E]">
              ₹ {formatNumber(damperBasicCost, 0)}
            </span>
          </div>
        </div>

        {/* Right Card: Automation Breakdown & Commercial Totals */}
        <div className="space-y-6 flex flex-col justify-between">
          {/* Automation Table */}
          <div className="bg-[#FFFDFB] border border-[#E8E3D8] rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <div className="bg-gradient-to-r from-[#2F4D40] via-[#3D6353] to-[#487361] text-white px-5 py-3 flex items-center justify-between">
                <span className="font-bold text-xs sm:text-sm uppercase tracking-wide">
                  6. Damper Automation Cost
                </span>
                <span className="text-[11px] text-[#D5E5DC] font-mono">Rates Editable</span>
              </div>

              <table className="w-full text-xs text-left">
                <thead className="bg-[#F5F2EB] text-[#5C6460] font-semibold uppercase text-[10px] border-b border-[#E8E3D8]">
                  <tr>
                    <th className="px-3 py-2 w-12 text-center">Sr.No</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-center w-24">Make / Spec</th>
                    <th className="px-4 py-2 text-right">Cost (₹)</th>
                  </tr>
                </thead>
                {isMultiBlade ? (
                  <tbody className="divide-y divide-slate-100 text-[#212529]">
                    <tr className="bg-amber-50/20">
                      <td className="px-3 py-2 text-center font-mono text-slate-400">1</td>
                      <td className="px-3 py-2 font-medium">{mbActuatorType}</td>
                      <td className="px-3 py-2 text-center font-mono font-semibold text-slate-700">Quarter-Turn Drive</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold">
                        ₹ {formatNumber(
                          mbActuatorType === 'Electric Actuator' ? 120000 :
                          mbActuatorType === 'Pneumatic Spring-Return' ? 68000 :
                          mbActuatorType === 'Pneumatic Double-Acting' ? 45000 : 8500
                        , 0)}
                      </td>
                    </tr>
                    {hasLimitSwitch && (
                      <tr>
                        <td className="px-3 py-2 text-center font-mono text-slate-400">2</td>
                        <td className="px-3 py-2 font-medium">Limit Switch (Open/Close)</td>
                        <td className="px-3 py-2 text-center font-mono text-slate-600">Accessory</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">₹ 14,000</td>
                      </tr>
                    )}
                    {hasSolenoid && (
                      <tr>
                        <td className="px-3 py-2 text-center font-mono text-slate-400">3</td>
                        <td className="px-3 py-2 font-medium">Solenoid Valve</td>
                        <td className="px-3 py-2 text-center font-mono text-slate-600">Accessory</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">₹ 18,000</td>
                      </tr>
                    )}
                    {hasPositioner && (
                      <tr>
                        <td className="px-3 py-2 text-center font-mono text-slate-400">4</td>
                        <td className="px-3 py-2 font-medium">Electro-Pneumatic Positioner</td>
                        <td className="px-3 py-2 text-center font-mono text-slate-600">Smart Positioner</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">₹ 42,000</td>
                      </tr>
                    )}
                  </tbody>
                ) : (
                  <tbody className="divide-y divide-slate-100 text-[#212529]">
                    <tr className="bg-amber-50/20">
                      <td className="px-3 py-2 text-center font-mono text-slate-400">1</td>
                      <td className="px-3 py-2 font-medium">Electric Actuator-multi turn</td>
                      <td className="px-3 py-2 text-center font-mono font-semibold text-slate-700">AUMA / Rotork</td>
                      <td className="px-4 py-1.5 text-right font-mono">
                        <input
                          type="number"
                          step="5000"
                          value={actuatorCost}
                          onChange={(e) => updateAutomationRate('actuator', e.target.value)}
                          className="w-28 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white text-slate-900 focus:ring-1 focus:ring-[#005daa]"
                        />
                      </td>
                    </tr>

                    <tr className="bg-amber-50/20">
                      <td className="px-3 py-2 text-center font-mono text-slate-400">2</td>
                      <td className="px-3 py-2 font-medium">Gear Box - multi turn</td>
                      <td className="px-3 py-2 text-center font-mono font-semibold text-slate-700">Bevel Gearbox</td>
                      <td className="px-4 py-1.5 text-right font-mono">
                        <input
                          type="number"
                          step="2000"
                          value={gearboxCost}
                          onChange={(e) => updateAutomationRate('gearbox', e.target.value)}
                          className="w-28 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white text-slate-900 focus:ring-1 focus:ring-[#005daa]"
                        />
                      </td>
                    </tr>

                    <tr className="bg-amber-50/20">
                      <td className="px-3 py-2 text-center font-mono text-slate-400">3</td>
                      <td className="px-3 py-2 font-medium">Miscellaneous & Bracket</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-400">Mounting kit</td>
                      <td className="px-4 py-1.5 text-right font-mono">
                        <input
                          type="number"
                          step="1000"
                          value={miscCost}
                          onChange={(e) => updateAutomationRate('misc', e.target.value)}
                          className="w-28 px-1.5 py-0.5 text-right font-mono text-xs font-bold border border-slate-300 rounded bg-white text-slate-900 focus:ring-1 focus:ring-[#005daa]"
                        />
                      </td>
                    </tr>

                    <tr>
                      <td className="px-3 py-2 text-center font-mono text-slate-400">4</td>
                      <td className="px-3 py-2 font-medium">Manual Override Handwheel</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-400">Included</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-500">0</td>
                    </tr>
                  </tbody>
                )}
              </table>
            </div>

            {/* Automation Cost Highlight Row */}
            <div className="bg-[#EEF5F1] border-t-2 border-[#3D6353] px-4 py-3 flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wide text-[#2F4D40]">
                Damper Automation Cost
              </span>
              <span className="font-mono font-extrabold text-base text-[#1E3B2E]">
                ₹ {formatNumber(damperAutomationCost, 0)}
              </span>
            </div>
          </div>

          {/* Bottom-Line Commercial Summary Card */}
          <div className="bg-[#FFFDFB] border-2 border-[#E8E3D8] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-[#EAE5DB] pb-2.5 flex items-center justify-between">
              <span className="font-bold text-sm text-[#242826] uppercase tracking-wide flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C46346]"></span>
                <span>7. Commercial Summary & Quotation</span>
              </span>
              <span className="text-xs text-[#5C6460] font-mono">
                Qty: {quantity} {quantity > 1 ? 'Units' : 'Unit'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Fabrication line */}
              <div className="flex items-center justify-between text-[#242826]">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">Fabrication Cost</span>
                  <span className="text-[11px] text-[#5C6460]">
                    ({(Number(totalWeight) || 0).toFixed(1)} kg × ₹{fabRate}/kg)
                  </span>
                </div>
                <span className="font-mono font-semibold">₹ {formatNumber(fabricationCost, 0)}</span>
              </div>

              {/* Damper Basic Cost */}
              <div className="flex items-center justify-between text-[#242826]">
                <span className="font-medium">Damper Basic Cost:</span>
                <span className="font-mono font-semibold">₹ {formatNumber(damperBasicCost, 0)}</span>
              </div>

              {/* Automation Cost */}
              <div className="flex items-center justify-between text-[#242826]">
                <span className="font-medium">Automation Cost:</span>
                <span className="font-mono font-semibold">₹ {formatNumber(damperAutomationCost, 0)}</span>
              </div>

              {/* Total Cost */}
              <div className="pt-2 border-t border-[#EAE5DB] flex items-center justify-between text-[#242826] font-bold text-sm">
                <span>Total Net Cost:</span>
                <span className="font-mono text-[#2F4D40]">₹ {formatNumber(totalDamperCost, 0)}</span>
              </div>

              {/* Markup Factor */}
              <div className="flex items-center justify-between text-[#2F4D40] font-semibold">
                <div className="flex items-center gap-1.5">
                  <span>Markup Multiplier:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={markupMultiplier}
                    onChange={(e) => setMarkupMultiplier(parseFloat(e.target.value) || 1.10)}
                    className="w-16 px-1.5 py-0.5 text-right font-mono text-xs border border-[#3D6353] rounded bg-[#EEF5F1] text-[#2F4D40] font-bold"
                  />
                </div>
                <span className="font-mono text-[#C46346]">
                  +₹ {formatNumber(unitQuotedPrice - totalDamperCost, 0)}
                </span>
              </div>
            </div>

            {/* Quoted Price Large Badge - Pastel Sage Gradient */}
            <div className="bg-gradient-to-r from-[#2F4D40] via-[#3D6353] to-[#487361] text-white p-4 rounded-xl flex items-center justify-between shadow-md">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#D5E5DC]">
                  Unit Quoted Price
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono mt-0.5 text-white">
                  {formatINR(unitQuotedPrice)}
                </div>
              </div>
              {quantity > 1 && (
                <div className="text-right pl-4 border-l border-white/20">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#D5E5DC]">
                    Batch Total ({quantity} Units)
                  </div>
                  <div className="text-lg sm:text-xl font-black font-mono mt-0.5 text-[#FCD9A5]">
                    {formatINR(batchQuotedPrice)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

function int(val) {
  return Math.round(Number(val) || 0);
}
