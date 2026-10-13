import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  RotateCcw, 
  Eye, 
  Maximize2, 
  MoveVertical, 
  Sliders, 
  Box, 
  Layers, 
  Compass, 
  ArrowRight, 
  Info,
  CheckCircle2,
  Sparkles,
  MapPin,
  Crosshair,
  Tag,
  ChevronRight,
  X,
  Activity,
  Check,
  MousePointerClick,
  RotateCw
} from 'lucide-react';

export default function Damper3DViewer({ 
  productCategory = 'damper', // 'damper' | 'valve'
  // Damper Parameters
  width = 3000, 
  height = 3000, 
  depth = 450,
  damperType = 'rack-pinion',
  damperTypeName = 'Rack & Pinion Sliding-Flap Damper',
  actuatorType = 'electric',
  bladeAction = 'single-sliding',
  sealingEfficiency = '99.5%',
  designTemp = 'ambient',
  designPressure = '±500 mmWg',
  flangeType = 'Both Ends Flanged (IS 2062)',
  numberOfBlades = 12,
  opposedBlades = true,
  // Detailed Multi-Blade Geometry Parameters
  bladeType = 'Flat single-skin sheet blade',
  bladeOrientation = 'Horizontal',
  bladeChord = 165,
  bladeLength = 2900,
  bladeDepth = 25,
  bladeThick = 1.6,
  bladePitch = 150,
  sections = 1,
  sideClearance = 5,
  endClearance = 5,
  shaftDiameter = 16,
  foldAngle = 45,
  flangeLeft = 20,
  flangeRight = 20,
  edgeReturn = 8,
  webWidth = 100,
  numBends = 4,
  frontSkinThick = 1.6,
  rearSkinThick = 1.6,
  overallBladeDepth = 30,
  internalStiffenerCount = 2,
  aerofoilMaxThick = 25,
  aerofoilCamber = 0,
  customProfileShape = 'Z-profile',
  // Rack & Pinion / Disc Blade & Gate geometry
  gateThickness = 6.0,
  gateStiffenerCount = 4,
  gateStiffenerType = 'Channel ISMC 75',
  gateRackCount = 2,
  discThickness = 10.0,
  discShaftDiameter = 45.0,
  // Valve Parameters
  valveType = 'butterfly_valve',
  valveTypeName = 'High-Performance Butterfly Valve',
  valveSizeDn = 300,
  valveSizeInch = '12"',
  valvePressureRating = 'PN 16',
  valveEndConnection = 'Wafer',
  valveBodyMoc = 'WCB (Cast Carbon Steel ASTM A216)',
  valveTrimMoc = 'CF8M (Cast Stainless Steel SS316)',
  valveSeatMoc = 'PTFE / RTFE',
  valveActuator = 'Electric Quarter-Turn Actuator',
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const damperGroupRef = useRef(null);
  const movingPartsRef = useRef([]);
  const pinionShaftRef = useRef(null);

  // References for Part Identification & 3D Hotspot Projection
  const anchorsRef = useRef({});          // maps partKey -> { pos: Vector3, obj?: Object3D, offset?: Vector3 }
  const badgeRefs = useRef({});            // maps partKey -> HTML element
  const materialsMapRef = useRef(new Map()); // maps partKey -> Material
  const partMeshesRef = useRef({});        // maps partKey -> Mesh[]
  const prevPropsRef = useRef(null);
  const modifiedPartsRef = useRef({});

  // UI Interactive States
  const [flapOpen, setFlapOpen] = useState(30); // % open
  const [wireframe, setWireframe] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [bladeOnlyMode, setBladeOnlyMode] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [labelFilter, setLabelFilter] = useState('all'); // 'all' | 'modified'
  const [selectedPartKey, setSelectedPartKey] = useState(null);
  const [highlightedPartKey, setHighlightedPartKey] = useState(null);
  const [modifiedParts, setModifiedParts] = useState({});
  const [lastChangeNotice, setLastChangeNotice] = useState(null);

  const isValve = productCategory === 'valve';
  const normAction = (bladeAction || '').toLowerCase();
  const isDisc = normAction.includes('disc') || (damperTypeName && damperTypeName.toLowerCase().includes('butterfly'));
  const isMultiBlade = damperType === 'multi_blade' || damperType === 'louver' || damperType === 'multi-blade' || normAction.includes('parallel') || normAction.includes('opposed');
  const isEstimatedProfile = bladeType.toLowerCase().includes('aerofoil') || bladeType.toLowerCase().includes('custom');
  const isRackPinion = !isMultiBlade && !isDisc && !isValve;
  const vType = (valveType || '').toLowerCase();

  // Sync ref for animation loop
  useEffect(() => {
    modifiedPartsRef.current = modifiedParts;
  }, [modifiedParts]);

  // ═════════════════════════════════════════════════════════════════
  // 1. SPECIFICATION DICTIONARIES FOR PARTS IN MODEL
  // ═════════════════════════════════════════════════════════════════
  const activePartsList = useMemo(() => {
    if (isValve) {
      return [
        {
          key: 'valve_body',
          name: 'Valve Body / Shell',
          category: 'Pressure Retaining',
          spec: `DN${valveSizeDn} (${valveSizeInch}) • ${valvePressureRating} • ${valveBodyMoc.split(' ')[0]}`,
          desc: `Pressure-retaining valve body designed to withstand line pressure with ${valveEndConnection} mounting.`,
          color: '#3b82f6',
        },
        {
          key: 'valve_trim',
          name: vType.includes('knife') ? 'Knife Gate Blade' : vType.includes('ball') ? 'Solid Ball Sphere' : 'Offset Disc Blade',
          category: 'Closure Trim',
          spec: `Trim MOC: ${valveTrimMoc.split(' ')[0]} • Precision Ground`,
          desc: 'Primary flow modulating / isolation element providing bidirectional or unidirectional tight shut-off.',
          color: '#f89030',
        },
        {
          key: 'valve_seat',
          name: 'Sealing Seat Ring',
          category: 'Sealing Member',
          spec: `Seat: ${valveSeatMoc}`,
          desc: 'Precision sealing seat ring engineered for bubble-tight closure and wear resistance.',
          color: '#06b6d4',
        },
        {
          key: 'valve_stem',
          name: 'Drive Stem / Shaft',
          category: 'Mechanical Drive',
          spec: `Drive Stem Spindle (${valveTrimMoc.split(' ')[0]})`,
          desc: 'Torque transmission spindle connected to the actuator with high-integrity gland packing.',
          color: '#64748b',
        },
        {
          key: 'valve_yoke',
          name: 'Mounting Yoke / Pad',
          category: 'Actuator Interface',
          spec: 'ISO 5211 Standardized Pad',
          desc: 'Heavy-duty mounting bracket and gland housing for seamless direct-mount actuation.',
          color: '#475569',
        },
        {
          key: 'valve_actuator',
          name: 'Actuator / Operator',
          category: 'Actuation',
          spec: `${valveActuator}`,
          desc: 'Direct-mounted actuator driving quarter-turn or linear travel with positioning feedback.',
          color: '#005daa',
        },
        {
          key: 'valve_flange',
          name: 'Flange Lugs & Holes',
          category: 'Pipe Connection',
          spec: `${valveEndConnection} • ${valvePressureRating} Rating`,
          desc: 'Standardized bolt circle and alignment lugs for pipeline flange clamping.',
          color: '#0f172a',
        },
      ];
    } else {
      // Dampers
      const list = [
        {
          key: 'frame',
          name: 'Casing / Frame',
          category: 'Structural',
          spec: `${width} × ${height} × ${depth} mm Duct Casing`,
          desc: 'Heavy-gauge formed steel channel casing engineered to resist ductwork pressures and thermal loads.',
          color: '#475569',
        },
        {
          key: 'flanges',
          name: 'Peripheral Flanges',
          category: 'Connection',
          spec: `${flangeType}`,
          desc: 'Peripheral matching flanges for direct bolting to plant ducting.',
          color: '#64748b',
        },
        {
          key: 'blades',
          name: isMultiBlade ? 'Louver Blades Assembly' : isDisc ? 'Butterfly Disc Blade' : 'Sliding Gate Blade',
          category: 'Flow Regulating',
          spec: isMultiBlade 
            ? `${numberOfBlades} Blades • Chord ${bladeChord}mm • ${bladeThick}mm Thk • ${opposedBlades ? 'Opposed' : 'Parallel'}`
            : isDisc
            ? `Circular Disc • ${discThickness}mm Plate`
            : `${gateThickness}mm Plate • ${gateStiffenerCount} Stiffeners (${gateStiffenerType})`,
          desc: 'Primary flow modulating / isolation barrier designed for minimum deflection and high aerodynamic stability.',
          color: '#f89030',
        },
        {
          key: 'shaft',
          name: isMultiBlade ? 'Through-Shafts & Bearings' : isDisc ? 'Central Spindle' : 'Drive Pinion Shaft',
          category: 'Transmission',
          spec: isMultiBlade 
            ? `Ø${shaftDiameter}mm Shafts with Bushed Bearings` 
            : isDisc 
            ? `Ø${discShaftDiameter}mm Spindle Shaft`
            : 'Pinion Shaft with Hardened Gears',
          desc: 'Precision machined drive shafting transmitting actuator torque across the blade span.',
          color: '#334155',
        },
        {
          key: 'linkage',
          name: isMultiBlade ? 'Interconnecting Linkage' : 'Dual Rack Mechanism',
          category: 'Synchronization',
          spec: isMultiBlade 
            ? `${opposedBlades ? 'Opposed' : 'Parallel'} Action Tie-Bar` 
            : `${gateRackCount} Machine-Cut Precision Racks`,
          desc: 'External mechanical drive synchronization guaranteeing uniform blade travel without binding.',
          color: '#0f172a',
        },
        {
          key: 'actuator',
          name: 'Actuator Drive Unit',
          category: 'Actuation',
          spec: `${actuatorType.toUpperCase()} Actuator Drive`,
          desc: 'Heavy-duty industrial drive mechanism providing precise modulating or isolation torque.',
          color: '#005daa',
        },
        {
          key: 'seals',
          name: 'Gas-Tight Seals',
          category: 'Sealing Strip',
          spec: `${sealingEfficiency} Sealing Efficiency`,
          desc: 'Perimeter landing and blade edge sealing strips preventing flue gas leakage.',
          color: '#dc2626',
        },
      ];
      return bladeOnlyMode ? list.filter(p => p.key === 'blades' || p.key === 'shaft') : list;
    }
  }, [
    isValve, width, height, depth, flangeType, isMultiBlade, isDisc, numberOfBlades,
    bladeChord, bladeThick, opposedBlades, discThickness, gateThickness, gateStiffenerCount,
    gateStiffenerType, shaftDiameter, discShaftDiameter, gateRackCount, actuatorType,
    sealingEfficiency, valveSizeDn, valveSizeInch, valvePressureRating, valveBodyMoc,
    valveEndConnection, vType, valveTrimMoc, valveSeatMoc, valveActuator, bladeOnlyMode
  ]);

  // ═════════════════════════════════════════════════════════════════
  // 2. PARAMETER CHANGE DETECTION (TRACKS WHAT CHANGED & WHERE)
  // ═════════════════════════════════════════════════════════════════
  useEffect(() => {
    const propPartMap = {
      // Damper Props
      width: { partKey: 'frame', label: 'Duct Width', format: v => `${v} mm` },
      height: { partKey: 'frame', label: 'Duct Height', format: v => `${v} mm` },
      depth: { partKey: 'frame', label: 'Casing Depth', format: v => `${v} mm` },
      flangeType: { partKey: 'flanges', label: 'Flange Type', format: v => String(v) },
      damperType: { partKey: 'frame', label: 'Damper Type', format: v => String(v) },
      numberOfBlades: { partKey: 'blades', label: 'Blade Count', format: v => `${v} blades` },
      bladeThick: { partKey: 'blades', label: 'Blade Thickness', format: v => `${v} mm` },
      bladeChord: { partKey: 'blades', label: 'Blade Chord', format: v => `${v} mm` },
      bladeType: { partKey: 'blades', label: 'Blade Profile', format: v => String(v) },
      bladeOrientation: { partKey: 'blades', label: 'Orientation', format: v => String(v) },
      bladePitch: { partKey: 'blades', label: 'Blade Pitch', format: v => `${v} mm` },
      opposedBlades: { partKey: 'blades', label: 'Blade Action', format: v => v ? 'Opposed' : 'Parallel' },
      bladeLength: { partKey: 'blades', label: 'Blade Span', format: v => `${v} mm` },
      bladeAction: { partKey: 'blades', label: 'Blade Action', format: v => String(v) },
      shaftDiameter: { partKey: 'shaft', label: 'Shaft Diameter', format: v => `Ø${v} mm` },
      actuatorType: { partKey: 'actuator', label: 'Actuator', format: v => String(v).toUpperCase() },
      sealingEfficiency: { partKey: 'seals', label: 'Seal Rating', format: v => String(v) },
      gateThickness: { partKey: 'blades', label: 'Gate Thickness', format: v => `${v} mm` },
      gateStiffenerCount: { partKey: 'blades', label: 'Gate Stiffeners', format: v => `${v} channels` },
      gateRackCount: { partKey: 'linkage', label: 'Gear Racks', format: v => `${v} racks` },
      discThickness: { partKey: 'blades', label: 'Disc Thickness', format: v => `${v} mm` },
      discShaftDiameter: { partKey: 'shaft', label: 'Disc Spindle', format: v => `Ø${v} mm` },

      // Valve Props
      valveSizeDn: { partKey: 'valve_body', label: 'Valve Size', format: v => `DN${v}` },
      valvePressureRating: { partKey: 'valve_body', label: 'Pressure Rating', format: v => String(v) },
      valveEndConnection: { partKey: 'valve_flange', label: 'Connection', format: v => String(v) },
      valveBodyMoc: { partKey: 'valve_body', label: 'Body MOC', format: v => String(v).split(' ')[0] },
      valveTrimMoc: { partKey: 'valve_trim', label: 'Trim MOC', format: v => String(v).split(' ')[0] },
      valveSeatMoc: { partKey: 'valve_seat', label: 'Seat Material', format: v => String(v) },
      valveActuator: { partKey: 'valve_actuator', label: 'Valve Actuator', format: v => String(v).split(' ')[0] },
      valveType: { partKey: 'valve_body', label: 'Valve Type', format: v => String(v) },
    };

    const currentSnapshot = {
      productCategory, width, height, depth, damperType, damperTypeName,
      actuatorType, bladeAction, sealingEfficiency, designTemp, designPressure,
      flangeType, numberOfBlades, opposedBlades, bladeType, bladeOrientation,
      bladeChord, bladeLength, bladeDepth, bladeThick, bladePitch, sections,
      shaftDiameter, gateThickness, gateStiffenerCount, gateStiffenerType,
      gateRackCount, discThickness, discShaftDiameter, valveType, valveTypeName,
      valveSizeDn, valvePressureRating, valveEndConnection, valveBodyMoc,
      valveTrimMoc, valveSeatMoc, valveActuator
    };

    if (prevPropsRef.current) {
      const prev = prevPropsRef.current;
      let detectedNotice = null;

      for (const [propName, meta] of Object.entries(propPartMap)) {
        if (prev[propName] !== undefined && currentSnapshot[propName] !== undefined && prev[propName] !== currentSnapshot[propName]) {
          const isDamperProp = !propName.startsWith('valve');
          if ((isValve && isDamperProp) || (!isValve && !isDamperProp)) {
            continue;
          }

          const fromVal = meta.format(prev[propName]);
          const toVal = meta.format(currentSnapshot[propName]);
          const partItem = activePartsList.find(p => p.key === meta.partKey);

          detectedNotice = {
            partKey: meta.partKey,
            partName: partItem ? partItem.name : meta.partKey,
            label: meta.label,
            from: fromVal,
            to: toVal,
            timestamp: Date.now()
          };
          break;
        }
      }

      if (detectedNotice) {
        setHighlightedPartKey(detectedNotice.partKey);
        setLastChangeNotice(detectedNotice);
        setModifiedParts(prevMod => ({
          ...prevMod,
          [detectedNotice.partKey]: detectedNotice
        }));

        // Keep highlight active for 7 seconds
        const timer = setTimeout(() => {
          setHighlightedPartKey(null);
        }, 7000);
        return () => clearTimeout(timer);
      }
    }

    prevPropsRef.current = currentSnapshot;
  }, [
    productCategory, width, height, depth, damperType, damperTypeName,
    actuatorType, bladeAction, sealingEfficiency, designTemp, designPressure,
    flangeType, numberOfBlades, opposedBlades, bladeType, bladeOrientation,
    bladeChord, bladeLength, bladeDepth, bladeThick, bladePitch, sections,
    shaftDiameter, gateThickness, gateStiffenerCount, gateStiffenerType,
    gateRackCount, discThickness, discShaftDiameter, valveType, valveTypeName,
    valveSizeDn, valvePressureRating, valveEndConnection, valveBodyMoc,
    valveTrimMoc, valveSeatMoc, valveActuator, activePartsList, isValve
  ]);

  // ═════════════════════════════════════════════════════════════════
  // 3. THREE.JS INITIALIZATION & 60FPS ANCHOR PROJECTION LOOP
  // ═════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xf1f5f9); // Clean engineering CAD slate-grey

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(4.8, 3.2, 5.8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.4, 0);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.25);
    dirLight1.position.set(6, 10, 8);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.65);
    dirLight2.position.set(-6, -4, -6);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x005daa, 0.5, 10);
    pointLight.position.set(0, 3, 3);
    scene.add(pointLight);

    // Ground Grid
    const grid = new THREE.GridHelper(10, 20, 0x94a3b8, 0xcfd8dc);
    grid.position.y = -0.01;
    scene.add(grid);

    // Animation & Projection Loop
    let animationId;
    const tempVec = new THREE.Vector3();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();

      // Project 3D Component Anchors to 2D HTML Callout Badges
      if (container && cameraRef.current) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const cam = cameraRef.current;

        Object.keys(anchorsRef.current).forEach((key) => {
          const anchorData = anchorsRef.current[key];
          const badgeEl = badgeRefs.current[key];
          if (!badgeEl || !anchorData) return;

          // Determine current world 3D position (supports moving parts)
          if (anchorData.obj) {
            anchorData.obj.getWorldPosition(tempVec);
            if (anchorData.offset) tempVec.add(anchorData.offset);
          } else if (anchorData.pos) {
            tempVec.copy(anchorData.pos);
          }

          tempVec.project(cam);

          const isFront = tempVec.z < 1.0;
          const screenX = (tempVec.x * 0.5 + 0.5) * w;
          const screenY = -(tempVec.y * 0.5 - 0.5) * h;

          // Keep in visible viewport bounds
          if (isFront && screenX >= 10 && screenX <= w - 10 && screenY >= 10 && screenY <= h - 10) {
            badgeEl.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
            badgeEl.style.opacity = '1';
            badgeEl.style.visibility = 'visible';
          } else {
            badgeEl.style.opacity = '0';
            badgeEl.style.visibility = 'hidden';
          }
        });

        // Pulsing Emissive Glow on Active / Modified 3D Meshes
        const activeHighlightKey = selectedPartKey || highlightedPartKey;
        const now = Date.now();
        const pulse = 0.35 + 0.35 * Math.sin(now * 0.007);

        materialsMapRef.current.forEach((mat, key) => {
          if (key === activeHighlightKey) {
            const isMod = modifiedPartsRef.current && modifiedPartsRef.current[key];
            mat.emissive.setHex(isMod ? 0xf89030 : 0x005daa); // Orange for modified, Blue for selected
            mat.emissiveIntensity = pulse;
          } else {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // 3D Canvas Click Handler via Raycaster
    const handleCanvasClick = (e) => {
      if (!container || !cameraRef.current || !damperGroupRef.current) return;
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const intersects = raycaster.intersectObjects(damperGroupRef.current.children, true);
      if (intersects.length > 0) {
        for (const hit of intersects) {
          let cur = hit.object;
          while (cur && cur !== damperGroupRef.current) {
            if (cur.userData && cur.userData.partKey) {
              setSelectedPartKey(cur.userData.partKey);
              return;
            }
            cur = cur.parent;
          }
        }
      }
    };
    const domEl = renderer.domElement;
    domEl.addEventListener('click', handleCanvasClick);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      domEl.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      controls.dispose();
    };
  }, [selectedPartKey, highlightedPartKey]);

  // Helper to create specific cross-section blade geometries
  const createBladeGeometry = (spanM, chordM, thickM, profType) => {
    const pType = profType.toLowerCase();

    if (pType.includes('aerofoil')) {
      const shape = new THREE.Shape();
      const c = chordM;
      const maxT = Math.max(0.015, (bladeDepth || 25) / 1000);
      const pts = 24;
      shape.moveTo(0, 0);
      for (let i = 0; i <= pts; i++) {
        const x = (i / pts) * c;
        const yt = 5 * maxT * (
          0.2969 * Math.sqrt(Math.max(0, x / c)) -
          0.1260 * (x / c) -
          0.3516 * Math.pow(x / c, 2) +
          0.2843 * Math.pow(x / c, 3) -
          0.1015 * Math.pow(x / c, 4)
        );
        shape.lineTo(x - c / 2, yt);
      }
      for (let i = pts; i >= 0; i--) {
        const x = (i / pts) * c;
        const yt = 5 * maxT * (
          0.2969 * Math.sqrt(Math.max(0, x / c)) -
          0.1260 * (x / c) -
          0.3516 * Math.pow(x / c, 2) +
          0.2843 * Math.pow(x / c, 3) -
          0.1015 * Math.pow(x / c, 4)
        );
        shape.lineTo(x - c / 2, -yt);
      }
      shape.closePath();

      const extrudeSettings = { steps: 1, depth: spanM, bevelEnabled: false };
      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.rotateY(Math.PI / 2);
      geo.translate(-spanM / 2, 0, 0);
      return geo;

    } else if (pType.includes('folded')) {
      const shape = new THREE.Shape();
      const wM = (webWidth || 100) / 1000;
      const flM = (flangeLeft || 20) / 1000;
      const frM = (flangeRight || 20) / 1000;
      const rad = ((foldAngle || 45) * Math.PI) / 180;
      const t = Math.max(0.002, thickM);

      const dLeft = flM * Math.sin(rad);
      const lLeft = flM * Math.cos(rad);
      const dRight = frM * Math.sin(rad);
      const lRight = frM * Math.cos(rad);

      shape.moveTo(-wM / 2 - lLeft, dLeft);
      shape.lineTo(-wM / 2, 0);
      shape.lineTo(wM / 2, 0);
      shape.lineTo(wM / 2 + lRight, -dRight);
      shape.lineTo(wM / 2 + lRight, -dRight - t);
      shape.lineTo(wM / 2, -t);
      shape.lineTo(-wM / 2, -t);
      shape.lineTo(-wM / 2 - lLeft, dLeft - t);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: spanM, bevelEnabled: false });
      geo.rotateY(Math.PI / 2);
      geo.translate(-spanM / 2, 0, 0);
      return geo;

    } else if (pType.includes('custom')) {
      const shape = new THREE.Shape();
      const c = chordM;
      const d = Math.max(0.015, (bladeDepth || 25) / 1000);
      const t = Math.max(0.002, thickM);

      shape.moveTo(-c / 2, d / 2);
      shape.lineTo(-c / 4, d / 2);
      shape.lineTo(c / 4, -d / 2);
      shape.lineTo(c / 2, -d / 2);
      shape.lineTo(c / 2, -d / 2 + t);
      shape.lineTo(c / 4 + t, -d / 2 + t);
      shape.lineTo(-c / 4 + t, d / 2 - t);
      shape.lineTo(-c / 2, d / 2 - t);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: spanM, bevelEnabled: false });
      geo.rotateY(Math.PI / 2);
      geo.translate(-spanM / 2, 0, 0);
      return geo;

    } else {
      // Standard Flat single-skin plate
      const geo = new THREE.BoxGeometry(spanM, chordM, Math.max(0.003, thickM));
      return geo;
    }
  };

  // Helper to build actuator model
  const buildActuatorMesh = (type, posX, posY, posZ, actMat, mechanicalMat) => {
    const actGroup = new THREE.Group();
    actGroup.position.set(posX, posY, posZ);

    const normType = (type || '').toLowerCase();

    if (normType.includes('pneumatic') || normType.includes('cylinder')) {
      // Cylindrical Pneumatic Double Acting Actuator
      const cylBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.42, 24),
        actMat
      );
      cylBody.rotation.z = Math.PI / 2;
      actGroup.add(cylBody);

      const endCap1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.05, 24),
        mechanicalMat
      );
      endCap1.rotation.z = Math.PI / 2;
      endCap1.position.x = -0.21;
      actGroup.add(endCap1);

      const endCap2 = endCap1.clone();
      endCap2.position.x = 0.21;
      actGroup.add(endCap2);

      // Yellow limit switch box on top
      const lsBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.08, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.3, roughness: 0.4 })
      );
      lsBox.position.set(0, 0.16, 0);
      actGroup.add(lsBox);

      // Visual Beacon Position Indicator
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.04, 16),
        new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.2, roughness: 0.3 })
      );
      beacon.position.set(0, 0.22, 0);
      actGroup.add(beacon);

    } else if (normType.includes('manual') || normType.includes('gearbox') || normType.includes('handwheel')) {
      // Manual Worm Gearbox with Handwheel
      const gearBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.18, 0.22),
        actMat
      );
      actGroup.add(gearBox);

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.22, 16),
        mechanicalMat
      );
      shaft.rotation.z = Math.PI / 2;
      shaft.position.x = 0.16;
      actGroup.add(shaft);

      // Red Handwheel
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.018, 16, 32),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.3 })
      );
      torus.rotation.y = Math.PI / 2;
      torus.position.x = 0.26;
      actGroup.add(torus);

      const spoke1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.34, 0.015),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.3 })
      );
      spoke1.position.x = 0.26;
      actGroup.add(spoke1);

    } else {
      // Electric Multi-Turn / Quarter-Turn Actuator (Rotork/Auma Style)
      const motorHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.32, 0.26),
        actMat
      );
      actGroup.add(motorHousing);

      // Terminal / Display Compartment
      const displayPanel = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.12, 0.04),
        mechanicalMat
      );
      displayPanel.position.set(0, 0.05, 0.14);
      actGroup.add(displayPanel);

      const lcdScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.09, 0.06),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      lcdScreen.position.set(0, 0.05, 0.161);
      actGroup.add(lcdScreen);

      // Manual declutchable handwheel on side
      const handwheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.014, 16, 24),
        mechanicalMat
      );
      handwheel.rotation.y = Math.PI / 2;
      handwheel.position.x = 0.17;
      actGroup.add(handwheel);
    }

    return actGroup;
  };

  // ═════════════════════════════════════════════════════════════════
  // 4. BUILD 3D CAD MODEL (DAMPER & VALVE) WITH PART TAGGING
  // ═════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    if (damperGroupRef.current) {
      scene.remove(damperGroupRef.current);
      damperGroupRef.current.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }

    movingPartsRef.current = [];
    pinionShaftRef.current = null;
    anchorsRef.current = {};
    partMeshesRef.current = {};
    materialsMapRef.current.clear();

    const damperGroup = new THREE.Group();
    damperGroupRef.current = damperGroup;

    // Helper to register parts for Raycasting, Emissive Highlighting, and 3D Anchor Callouts
    const tagPart = (obj, partKey, partName) => {
      if (!obj) return;
      obj.userData = { ...(obj.userData || {}), partKey, partName };
      if (!partMeshesRef.current[partKey]) {
        partMeshesRef.current[partKey] = [];
      }
      obj.traverse((child) => {
        if (child.isMesh) {
          child.userData = { ...(child.userData || {}), partKey, partName };
          partMeshesRef.current[partKey].push(child);
        }
      });
    };

    // Dedicated CAD Materials for Each Component Category
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x475569, metalness: 0.85, roughness: 0.25, wireframe: wireframe
    });
    const flangeMat = new THREE.MeshStandardMaterial({
      color: 0x334155, metalness: 0.85, roughness: 0.25, wireframe: wireframe
    });
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xf89030, metalness: 0.65, roughness: 0.3, wireframe: wireframe
    });
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8, metalness: 0.95, roughness: 0.15, wireframe: wireframe
    });
    const linkageMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, metalness: 0.9, roughness: 0.2, wireframe: wireframe
    });
    const actuatorMat = new THREE.MeshStandardMaterial({
      color: 0x005daa, metalness: 0.75, roughness: 0.3, wireframe: wireframe
    });
    const sealMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, metalness: 0.2, roughness: 0.7, wireframe: wireframe
    });

    const bodyValveMat = new THREE.MeshStandardMaterial({
      color: valveBodyMoc.includes('CF8M') ? 0x94a3b8 : (valveBodyMoc.includes('GGG40') ? 0x334155 : 0x1e3a5f),
      metalness: 0.85, roughness: 0.25, wireframe: wireframe
    });
    const trimValveMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, metalness: 0.95, roughness: 0.15, wireframe: wireframe
    });
    const seatValveMat = new THREE.MeshStandardMaterial({
      color: valveSeatMoc.includes('Metal') ? 0xd97706 : (valveSeatMoc.includes('EPDM') ? 0x0f172a : 0x38bdf8),
      metalness: 0.5, roughness: 0.4, wireframe: wireframe
    });
    const stemValveMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc, metalness: 0.9, roughness: 0.2, wireframe: wireframe
    });
    const yokeValveMat = new THREE.MeshStandardMaterial({
      color: 0x475569, metalness: 0.8, roughness: 0.3, wireframe: wireframe
    });

    // Register materials in map for emissive pulsing
    if (isValve) {
      materialsMapRef.current.set('valve_body', bodyValveMat);
      materialsMapRef.current.set('valve_trim', trimValveMat);
      materialsMapRef.current.set('valve_seat', seatValveMat);
      materialsMapRef.current.set('valve_stem', stemValveMat);
      materialsMapRef.current.set('valve_yoke', yokeValveMat);
      materialsMapRef.current.set('valve_actuator', actuatorMat);
      materialsMapRef.current.set('valve_flange', flangeMat);
    } else {
      materialsMapRef.current.set('frame', frameMat);
      materialsMapRef.current.set('flanges', flangeMat);
      materialsMapRef.current.set('blades', bladeMat);
      materialsMapRef.current.set('shaft', shaftMat);
      materialsMapRef.current.set('linkage', linkageMat);
      materialsMapRef.current.set('actuator', actuatorMat);
      materialsMapRef.current.set('seals', sealMat);
    }

    // ═════════════════════════════════════════════════════════════════
    // BRANCH A: INDUSTRIAL VALVE 3D CAD MODEL
    // ═════════════════════════════════════════════════════════════════
    if (isValve) {
      const dn = Math.max(50, valveSizeDn || 300);
      const dnM = dn / 1000.0;
      const radiusM = dnM / 2;
      const f2fM = Math.max(0.05, (dn * 0.28) / 1000);
      const flangeOuterRadiusM = radiusM * 1.5;
      const vGroup = new THREE.Group();

      if (vType.includes('knife') || vType.includes('gate')) {
        // ─────────────────────────────────────────────────────────────
        // 1. KNIFE GATE VALVE (Linear Rising Beveled Blade)
        // ─────────────────────────────────────────────────────────────
        const chestWidth = radiusM * 2.6;
        const chestHeight = radiusM * 2.8;
        const chestDepth = f2fM;

        // Cast Chest Body
        const chestBody = new THREE.Mesh(
          new THREE.BoxGeometry(chestWidth, chestHeight, chestDepth),
          bodyValveMat
        );
        chestBody.position.set(0, chestHeight / 2, 0);
        vGroup.add(chestBody);
        tagPart(chestBody, 'valve_body', 'Valve Body / Shell');

        const boreRim = new THREE.Mesh(
          new THREE.CylinderGeometry(radiusM * 1.15, radiusM * 1.15, chestDepth * 1.05, 32),
          bodyValveMat
        );
        boreRim.rotation.x = Math.PI / 2;
        boreRim.position.set(0, radiusM * 1.15, 0);
        vGroup.add(boreRim);
        tagPart(boreRim, 'valve_body', 'Valve Body / Shell');

        anchorsRef.current['valve_body'] = {
          pos: new THREE.Vector3(-chestWidth * 0.52, chestHeight * 0.55, chestDepth / 2)
        };

        // Inner Seat Ring
        const seatRing = new THREE.Mesh(
          new THREE.TorusGeometry(radiusM, 0.02, 16, 32),
          seatValveMat
        );
        seatRing.position.set(0, radiusM * 1.15, 0);
        vGroup.add(seatRing);
        tagPart(seatRing, 'valve_seat', 'Sealing Seat Ring');
        anchorsRef.current['valve_seat'] = {
          pos: new THREE.Vector3(radiusM * 0.75, radiusM * 1.15 + radiusM * 0.7, chestDepth / 2)
        };

        // Stainless Steel Knife Gate Blade (Moving Part)
        const bladeHeight = radiusM * 2.5;
        const bladeWidth = radiusM * 2.1;
        const bladeThickM = Math.max(0.008, dnM * 0.02);

        const bladeGroup = new THREE.Group();
        const bladeMesh = new THREE.Mesh(
          new THREE.BoxGeometry(bladeWidth, bladeHeight, bladeThickM),
          trimValveMat
        );
        bladeMesh.position.set(0, bladeHeight / 2, 0);
        bladeMesh.castShadow = true;
        bladeGroup.add(bladeMesh);

        // Beveled Knife Bottom Edge
        const bevelMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.002, bladeThickM, bladeWidth, 4),
          trimValveMat
        );
        bevelMesh.rotation.z = Math.PI / 2;
        bevelMesh.position.set(0, 0, 0);
        bladeGroup.add(bevelMesh);

        bladeGroup.position.set(0, 0.02, 0);
        vGroup.add(bladeGroup);
        tagPart(bladeGroup, 'valve_trim', 'Knife Gate Blade');

        anchorsRef.current['valve_trim'] = {
          obj: bladeGroup,
          offset: new THREE.Vector3(0, bladeHeight * 0.45, bladeThickM / 2 + 0.02)
        };

        // Yoke Gland Box & Top Plate
        const glandBox = new THREE.Mesh(
          new THREE.BoxGeometry(chestWidth * 0.9, 0.08, chestDepth * 1.2),
          yokeValveMat
        );
        glandBox.position.set(0, chestHeight + 0.04, 0);
        vGroup.add(glandBox);
        tagPart(glandBox, 'valve_yoke', 'Mounting Yoke / Pad');

        [-chestWidth * 0.35, chestWidth * 0.35].forEach((rx) => {
          const yokeRod = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, radiusM * 2.2, 16),
            stemValveMat
          );
          yokeRod.position.set(rx, chestHeight + radiusM * 1.1, 0);
          vGroup.add(yokeRod);
          tagPart(yokeRod, 'valve_stem', 'Drive Stem / Shaft');
        });

        anchorsRef.current['valve_stem'] = {
          pos: new THREE.Vector3(-chestWidth * 0.35, chestHeight + radiusM * 1.1, 0)
        };

        const topPlate = new THREE.Mesh(
          new THREE.BoxGeometry(chestWidth * 0.8, 0.04, 0.22),
          yokeValveMat
        );
        topPlate.position.set(0, chestHeight + radiusM * 2.2, 0);
        vGroup.add(topPlate);
        tagPart(topPlate, 'valve_yoke', 'Mounting Yoke / Pad');

        anchorsRef.current['valve_yoke'] = {
          pos: new THREE.Vector3(chestWidth * 0.45, chestHeight + 0.04, chestDepth / 2)
        };

        // Actuator
        const actMesh = buildActuatorMesh(valveActuator, 0, chestHeight + radiusM * 2.45, 0, actuatorMat, linkageMat);
        vGroup.add(actMesh);
        tagPart(actMesh, 'valve_actuator', 'Actuator / Operator');
        anchorsRef.current['valve_actuator'] = {
          pos: new THREE.Vector3(0, chestHeight + radiusM * 2.55, 0.15)
        };

        movingPartsRef.current.push({
          type: 'knife-gate',
          object: bladeGroup,
          totalTravel: radiusM * 2.1,
        });

      } else {
        // ─────────────────────────────────────────────────────────────
        // 2. BUTTERFLY VALVE / BALL VALVE (Quarter-Turn Rotary)
        // ─────────────────────────────────────────────────────────────
        // Cylindrical Body
        const bodyCyl = new THREE.Mesh(
          new THREE.CylinderGeometry(flangeOuterRadiusM, flangeOuterRadiusM, f2fM, 36),
          bodyValveMat
        );
        bodyCyl.rotation.x = Math.PI / 2;
        bodyCyl.position.set(0, flangeOuterRadiusM, 0);
        bodyCyl.castShadow = true;
        vGroup.add(bodyCyl);
        tagPart(bodyCyl, 'valve_body', 'Valve Body / Shell');

        const innerBoreRing = new THREE.Mesh(
          new THREE.CylinderGeometry(radiusM, radiusM, f2fM + 0.005, 36),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 })
        );
        innerBoreRing.rotation.x = Math.PI / 2;
        innerBoreRing.position.set(0, flangeOuterRadiusM, 0);
        vGroup.add(innerBoreRing);

        anchorsRef.current['valve_body'] = {
          pos: new THREE.Vector3(-flangeOuterRadiusM * 0.85, flangeOuterRadiusM * 1.35, f2fM / 2)
        };

        // Flange Bolt Lugs
        const numLugs = dn >= 350 ? 16 : 8;
        for (let i = 0; i < numLugs; i++) {
          const angle = (i / numLugs) * Math.PI * 2;
          const lx = Math.cos(angle) * (flangeOuterRadiusM * 0.88);
          const ly = flangeOuterRadiusM + Math.sin(angle) * (flangeOuterRadiusM * 0.88);

          const holeLiner = new THREE.Mesh(
            new THREE.CylinderGeometry(0.016, 0.016, f2fM + 0.01, 12),
            flangeMat
          );
          holeLiner.rotation.x = Math.PI / 2;
          holeLiner.position.set(lx, ly, 0);
          vGroup.add(holeLiner);
          tagPart(holeLiner, 'valve_flange', 'Flange Lugs & Holes');
        }

        anchorsRef.current['valve_flange'] = {
          pos: new THREE.Vector3(flangeOuterRadiusM * 0.88, flangeOuterRadiusM * 0.88, f2fM / 2)
        };

        // Resilient/Metal Seat Ring
        const seatRing = new THREE.Mesh(
          new THREE.TorusGeometry(radiusM * 0.98, 0.018, 16, 36),
          seatValveMat
        );
        seatRing.position.set(0, flangeOuterRadiusM, 0);
        vGroup.add(seatRing);
        tagPart(seatRing, 'valve_seat', 'Sealing Seat Ring');
        anchorsRef.current['valve_seat'] = {
          pos: new THREE.Vector3(radiusM * 0.72, flangeOuterRadiusM + radiusM * 0.72, 0.02)
        };

        // Rotating Disc / Ball Trim (Moving Part)
        const discGroup = new THREE.Group();
        discGroup.position.set(0, flangeOuterRadiusM, 0);

        if (vType.includes('ball')) {
          const ballSphere = new THREE.Mesh(
            new THREE.SphereGeometry(radiusM * 0.96, 32, 24),
            trimValveMat
          );
          ballSphere.castShadow = true;
          discGroup.add(ballSphere);

          const ballBore = new THREE.Mesh(
            new THREE.CylinderGeometry(radiusM * 0.7, radiusM * 0.7, radiusM * 2.1, 24),
            linkageMat
          );
          ballBore.rotation.x = Math.PI / 2;
          discGroup.add(ballBore);
        } else {
          // Triple Offset Butterfly Disc Blade
          const discPlate = new THREE.Mesh(
            new THREE.CylinderGeometry(radiusM * 0.95, radiusM * 0.95, Math.max(0.015, dnM * 0.06), 36),
            trimValveMat
          );
          discPlate.rotation.x = Math.PI / 2;
          discPlate.castShadow = true;
          discGroup.add(discPlate);

          const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(radiusM * 0.22, radiusM * 0.22, radiusM * 1.8, 24),
            trimValveMat
          );
          discGroup.add(hub);
        }

        vGroup.add(discGroup);
        tagPart(discGroup, 'valve_trim', 'Offset Disc Blade');
        anchorsRef.current['valve_trim'] = {
          obj: discGroup,
          offset: new THREE.Vector3(0, 0, 0.02)
        };

        // Drive Stem Shaft
        const stemHeight = flangeOuterRadiusM * 0.9;
        const stemMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, stemHeight + 0.1, 20),
          stemValveMat
        );
        stemMesh.position.set(0, flangeOuterRadiusM + radiusM + stemHeight / 2, 0);
        vGroup.add(stemMesh);
        tagPart(stemMesh, 'valve_stem', 'Drive Stem / Shaft');
        anchorsRef.current['valve_stem'] = {
          pos: new THREE.Vector3(0.04, flangeOuterRadiusM + radiusM + stemHeight * 0.45, 0)
        };

        // Neck & ISO 5211 Pad
        const neck = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.1, stemHeight, 20),
          bodyValveMat
        );
        neck.position.set(0, flangeOuterRadiusM + radiusM + stemHeight / 2 - 0.02, 0);
        vGroup.add(neck);

        const isoPad = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.03, 0.24),
          yokeValveMat
        );
        isoPad.position.set(0, flangeOuterRadiusM + radiusM + stemHeight, 0);
        vGroup.add(isoPad);
        tagPart(isoPad, 'valve_yoke', 'Mounting Yoke / Pad');
        anchorsRef.current['valve_yoke'] = {
          pos: new THREE.Vector3(-0.14, flangeOuterRadiusM + radiusM + stemHeight, 0)
        };

        // Actuator
        const actMesh = buildActuatorMesh(
          valveActuator,
          0,
          flangeOuterRadiusM + radiusM + stemHeight + 0.2,
          0,
          actuatorMat,
          linkageMat
        );
        vGroup.add(actMesh);
        tagPart(actMesh, 'valve_actuator', 'Actuator / Operator');
        anchorsRef.current['valve_actuator'] = {
          pos: new THREE.Vector3(0, flangeOuterRadiusM + radiusM + stemHeight + 0.35, 0.15)
        };

        movingPartsRef.current.push({
          type: 'rotating-disc',
          object: discGroup,
        });
      }

      damperGroup.add(vGroup);
      scene.add(damperGroup);

      if (controlsRef.current && cameraRef.current) {
        controlsRef.current.target.set(0, flangeOuterRadiusM, 0);
        cameraRef.current.position.set(flangeOuterRadiusM * 2.2, flangeOuterRadiusM * 2.0, flangeOuterRadiusM * 2.8);
        controlsRef.current.update();
      }
      return;
    }

    // ═════════════════════════════════════════════════════════════════
    // BRANCH B: INDUSTRIAL DAMPER 3D CAD MODEL
    // ═════════════════════════════════════════════════════════════════
    const w = (width || 3000) / 1000;
    const h = (height || 3000) / 1000;
    const d = (depth || 450) / 1000;
    const wallThick = 0.05;
    const flangeWidth = 0.12;
    const flangeThick = 0.025;

    // 1. Frame Assembly
    if (!bladeOnlyMode) {
      const topFrame = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * wallThick, wallThick, d), frameMat);
      topFrame.position.set(0, h + wallThick / 2, 0);
      topFrame.castShadow = true;
      damperGroup.add(topFrame);
      tagPart(topFrame, 'frame', 'Casing / Frame');

      const botFrame = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * wallThick, wallThick, d), frameMat);
      botFrame.position.set(0, -wallThick / 2, 0);
      botFrame.castShadow = true;
      damperGroup.add(botFrame);
      tagPart(botFrame, 'frame', 'Casing / Frame');

      const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(wallThick, h, d), frameMat);
      leftFrame.position.set(-w / 2 - wallThick / 2, h / 2, 0);
      leftFrame.castShadow = true;
      damperGroup.add(leftFrame);
      tagPart(leftFrame, 'frame', 'Casing / Frame');

      const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(wallThick, h, d), frameMat);
      rightFrame.position.set(w / 2 + wallThick / 2, h / 2, 0);
      rightFrame.castShadow = true;
      damperGroup.add(rightFrame);
      tagPart(rightFrame, 'frame', 'Casing / Frame');

      anchorsRef.current['frame'] = {
        pos: new THREE.Vector3(-w / 2 - wallThick, h * 0.85, d / 2)
      };

      // Peripheral Flanges
      [-d / 2, d / 2].forEach((zPos) => {
        const topFlange = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * flangeWidth, flangeWidth, flangeThick), flangeMat);
        topFlange.position.set(0, h + flangeWidth / 2, zPos);
        damperGroup.add(topFlange);
        tagPart(topFlange, 'flanges', 'Peripheral Flanges');

        const botFlange = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * flangeWidth, flangeWidth, flangeThick), flangeMat);
        botFlange.position.set(0, -flangeWidth / 2, zPos);
        damperGroup.add(botFlange);
        tagPart(botFlange, 'flanges', 'Peripheral Flanges');

        const leftFlange = new THREE.Mesh(new THREE.BoxGeometry(flangeWidth, h + 2 * flangeWidth, flangeThick), flangeMat);
        leftFlange.position.set(-w / 2 - flangeWidth / 2, h / 2, zPos);
        damperGroup.add(leftFlange);
        tagPart(leftFlange, 'flanges', 'Peripheral Flanges');

        const rightFlange = new THREE.Mesh(new THREE.BoxGeometry(flangeWidth, h + 2 * flangeWidth, flangeThick), flangeMat);
        rightFlange.position.set(w / 2 + flangeWidth / 2, h / 2, zPos);
        damperGroup.add(rightFlange);
        tagPart(rightFlange, 'flanges', 'Peripheral Flanges');
      });

      anchorsRef.current['flanges'] = {
        pos: new THREE.Vector3(w / 3, h + flangeWidth * 0.8, d / 2 + 0.02)
      };

      // Air/Gas Sealing Strip Perimeter
      const sealMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.015, 0.02), sealMat);
      sealMesh.position.set(0, h - 0.01, 0);
      damperGroup.add(sealMesh);
      tagPart(sealMesh, 'seals', 'Gas-Tight Seals');
      anchorsRef.current['seals'] = {
        pos: new THREE.Vector3(0, h - 0.01, 0.03)
      };
    }

    // 2. Central Disc (Butterfly Damper)
    if (isDisc) {
      const discGroup = new THREE.Group();
      discGroup.position.set(0, h / 2, 0);

      const discRad = Math.min(w, h) / 2 * 0.96;
      const dThkM = Math.max(0.008, (discThickness || 10.0) / 1000);
      const sDiaM = Math.max(0.025, (discShaftDiameter || 45.0) / 1000);

      const discMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(discRad, discRad, dThkM, 36),
        bladeMat
      );
      discMesh.rotation.x = Math.PI / 2;
      discMesh.castShadow = true;
      discGroup.add(discMesh);
      tagPart(discMesh, 'blades', 'Butterfly Disc Blade');

      const spindle = new THREE.Mesh(
        new THREE.CylinderGeometry(sDiaM / 2, sDiaM / 2, w + 0.35, 24),
        shaftMat
      );
      spindle.rotation.z = Math.PI / 2;
      discGroup.add(spindle);
      tagPart(spindle, 'shaft', 'Central Spindle');

      damperGroup.add(discGroup);
      movingPartsRef.current.push({ type: 'rotating-disc', object: discGroup });

      anchorsRef.current['blades'] = {
        obj: discGroup,
        offset: new THREE.Vector3(0, 0, 0.03)
      };
      anchorsRef.current['shaft'] = {
        pos: new THREE.Vector3(w / 2 - 0.08, h / 2, 0)
      };

      if (!bladeOnlyMode) {
        const actGroup = buildActuatorMesh(actuatorType, w / 2 + 0.28, h / 2, 0, actuatorMat, linkageMat);
        damperGroup.add(actGroup);
        tagPart(actGroup, 'actuator', 'Actuator Drive Unit');
        anchorsRef.current['actuator'] = {
          pos: new THREE.Vector3(w / 2 + 0.38, h / 2, 0.15)
        };
      }

    } else if (isMultiBlade) {
      // 3. Multi-Blade Louvered Damper
      const isVertical = bladeOrientation === 'Vertical';
      const nSec = Math.max(1, sections || 1);
      const numBlades = Math.max(2, numberOfBlades || 12);

      const singleSpanM = bladeLength ? (bladeLength / 1000) : (w / nSec - 0.02);
      const chordM = (bladeChord || 165) / 1000;
      const thickM = (bladeThick || 1.6) / 1000;
      const depthM = (overallBladeDepth || bladeDepth || 30) / 1000;
      const shaftDiaM = (shaftDiameter || 16) / 1000;

      const isDoubleSkin = bladeType.toLowerCase().includes('double-skin');
      const stackAxisTotal = isVertical ? w : h;
      const bladeMeshes = [];

      const renderSections = bladeOnlyMode ? 1 : nSec;
      const renderBladeCount = bladeOnlyMode ? 1 : numBlades;

      for (let s = 0; s < renderSections; s++) {
        const secCenterX = bladeOnlyMode ? 0 : (-w / 2 + ((s + 0.5) * w) / nSec);

        for (let i = 0; i < renderBladeCount; i++) {
          const bladePosAlongStack = bladeOnlyMode ? 0 : ((stackAxisTotal / numBlades) * (i + 0.5));
          const bladePivot = new THREE.Group();

          if (bladeOnlyMode) {
            bladePivot.position.set(0, 0, 0);
          } else if (!isVertical) {
            bladePivot.position.set(secCenterX, bladePosAlongStack, 0);
          } else {
            bladePivot.position.set(bladePosAlongStack - w / 2, h / 2, 0);
          }

          if (isDoubleSkin) {
            const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(singleSpanM, chordM, frontSkinThick / 1000), bladeMat);
            frontPlate.position.set(0, 0, -depthM / 2);
            frontPlate.castShadow = true;
            bladePivot.add(frontPlate);

            const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(singleSpanM, chordM, rearSkinThick / 1000), bladeMat);
            rearPlate.position.set(0, 0, depthM / 2);
            rearPlate.castShadow = true;
            bladePivot.add(rearPlate);

            const topCap = new THREE.Mesh(new THREE.BoxGeometry(singleSpanM, 0.004, depthM), linkageMat);
            topCap.position.set(0, chordM / 2, 0);
            bladePivot.add(topCap);

            const botCap = new THREE.Mesh(new THREE.BoxGeometry(singleSpanM, 0.004, depthM), linkageMat);
            botCap.position.set(0, -chordM / 2, 0);
            bladePivot.add(botCap);

            const nStiff = Math.max(1, internalStiffenerCount);
            for (let stIdx = 0; stIdx < nStiff; stIdx++) {
              const stY = -chordM / 3 + (stIdx * (chordM * 2 / 3)) / Math.max(1, nStiff - 1);
              const stiffBar = new THREE.Mesh(new THREE.BoxGeometry(singleSpanM, 0.004, depthM * 0.8), linkageMat);
              stiffBar.position.set(0, stY, 0);
              bladePivot.add(stiffBar);
            }
          } else {
            const bladeGeo = createBladeGeometry(singleSpanM, chordM, thickM, bladeType);
            const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
            bladeMesh.castShadow = true;
            bladePivot.add(bladeMesh);
          }

          tagPart(bladePivot, 'blades', 'Louver Blades Assembly');

          // Through-Shaft
          const shaftLen = singleSpanM + 0.15;
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftDiaM / 2, shaftDiaM / 2, shaftLen, 16), shaftMat);
          if (!isVertical) shaft.rotation.z = Math.PI / 2;
          bladePivot.add(shaft);
          tagPart(shaft, 'shaft', 'Through-Shafts & Bearings');

          // Frame bearings
          [-singleSpanM / 2, singleSpanM / 2].forEach((endX) => {
            const bush = new THREE.Mesh(new THREE.CylinderGeometry(shaftDiaM * 0.9, shaftDiaM * 0.9, 0.025, 16), linkageMat);
            bush.rotation.z = Math.PI / 2;
            bush.position.set(endX, 0, 0);
            bladePivot.add(bush);
            tagPart(bush, 'shaft', 'Through-Shafts & Bearings');
          });

          // Crank Levers on drive side
          if (!bladeOnlyMode && s === nSec - 1) {
            const isOpp = normAction.includes('opposed') || opposedBlades;
            const leverDir = (isOpp && i % 2 === 1) ? -1 : 1;
            const lever = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, 0.012), linkageMat);
            lever.position.set(singleSpanM / 2 + 0.05, leverDir * 0.045, 0);
            bladePivot.add(lever);
            tagPart(lever, 'linkage', 'Interconnecting Linkage');
          }

          damperGroup.add(bladePivot);
          bladeMeshes.push(bladePivot);
        }
      }

      // External Interconnecting Linkage & Actuator
      if (!bladeOnlyMode) {
        const isOpp = normAction.includes('opposed') || opposedBlades;
        const linkBar = new THREE.Mesh(new THREE.BoxGeometry(0.012, h * 0.9, 0.015), linkageMat);
        linkBar.position.set(w / 2 + 0.08, h / 2, 0);
        damperGroup.add(linkBar);
        tagPart(linkBar, 'linkage', 'Interconnecting Linkage');

        if (isOpp) {
          const linkBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, h * 0.9, 0.015), linkageMat);
          linkBar2.position.set(w / 2 + 0.08, h / 2, 0.035);
          damperGroup.add(linkBar2);
          tagPart(linkBar2, 'linkage', 'Interconnecting Linkage');
        }

        const actGroup = buildActuatorMesh(actuatorType, w / 2 + 0.34, h / 2, 0, actuatorMat, linkageMat);
        damperGroup.add(actGroup);
        tagPart(actGroup, 'actuator', 'Actuator Drive Unit');
        anchorsRef.current['actuator'] = {
          pos: new THREE.Vector3(w / 2 + 0.44, h / 2, 0.15)
        };
      }

      anchorsRef.current['blades'] = {
        pos: new THREE.Vector3(0, h / 2, 0.04)
      };
      anchorsRef.current['shaft'] = {
        pos: new THREE.Vector3(w / 2 - 0.04, h / 2, 0)
      };
      anchorsRef.current['linkage'] = {
        pos: new THREE.Vector3(w / 2 + 0.08, h * 0.65, 0)
      };

      movingPartsRef.current.push({ 
        type: 'rotating-blades', 
        objects: bladeMeshes, 
        opposed: normAction.includes('opposed') || opposedBlades,
        isVertical: isVertical
      });

    } else {
      // 4. Rack & Pinion Sliding-Gate Damper Flap
      const gThkM = Math.max(0.006, (gateThickness || 6.0) / 1000);
      const flapGroup = new THREE.Group();

      const bladePlate = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h * 1.05, gThkM), bladeMat);
      bladePlate.position.set(0, h / 2, 0);
      bladePlate.castShadow = true;
      flapGroup.add(bladePlate);

      // Flap stiffener channels across face
      const nStiffeners = Math.max(1, gateStiffenerCount || Math.floor(h / 0.6));
      for (let i = 1; i <= nStiffeners; i++) {
        const stY = (h / (nStiffeners + 1)) * i;
        const st = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.045, 0.038), frameMat);
        st.position.set(0, stY, gThkM / 2 + 0.019);
        flapGroup.add(st);
      }

      // Vertical precision gear racks
      const nRacks = Math.max(2, gateRackCount || 2);
      for (let i = 0; i < nRacks; i++) {
        const rackX = -w / 2 + ((i + 1) * w) / (nRacks + 1);
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.92, 0.03), linkageMat);
        rack.position.set(rackX, h / 2, gThkM / 2 + 0.02);
        flapGroup.add(rack);
      }

      damperGroup.add(flapGroup);
      tagPart(flapGroup, 'blades', 'Sliding Gate Blade');
      anchorsRef.current['blades'] = {
        obj: flapGroup,
        offset: new THREE.Vector3(0, h / 2, gThkM / 2 + 0.03)
      };
      anchorsRef.current['linkage'] = {
        pos: new THREE.Vector3(w / 4, h * 0.6, gThkM / 2 + 0.05)
      };

      movingPartsRef.current.push({ type: 'sliding-gate', object: flapGroup, totalTravel: h * 0.95 });

      // Drive Pinion Shaft
      const pinionShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, w + 0.45, 24),
        shaftMat
      );
      pinionShaft.rotation.z = Math.PI / 2;
      pinionShaft.position.set(0, h + 0.08, gThkM / 2 + 0.04);
      damperGroup.add(pinionShaft);
      pinionShaftRef.current = pinionShaft;
      tagPart(pinionShaft, 'shaft', 'Drive Pinion Shaft');

      anchorsRef.current['shaft'] = {
        pos: new THREE.Vector3(0, h + 0.08, gThkM / 2 + 0.08)
      };

      if (!bladeOnlyMode) {
        const actGroup = buildActuatorMesh(actuatorType, w / 2 + wallThick + 0.35, h + 0.16, gThkM / 2 + 0.04, actuatorMat, linkageMat);
        damperGroup.add(actGroup);
        tagPart(actGroup, 'actuator', 'Actuator Drive Unit');
        anchorsRef.current['actuator'] = {
          pos: new THREE.Vector3(w / 2 + wallThick + 0.45, h + 0.16, gThkM / 2 + 0.15)
        };
      }
    }

    scene.add(damperGroup);

    if (controlsRef.current) {
      if (bladeOnlyMode) {
        controlsRef.current.target.set(0, 0, 0);
        if (cameraRef.current) cameraRef.current.position.set(0.6, 0.5, 0.8);
      } else {
        controlsRef.current.target.set(0, h / 2, 0);
      }
      controlsRef.current.update();
    }
  }, [
    productCategory, width, height, depth, damperType, damperTypeName, wireframe, numberOfBlades, opposedBlades,
    bladeAction, actuatorType, sealingEfficiency, designTemp, designPressure, flangeType,
    bladeType, bladeOrientation, bladeChord, bladeLength, bladeDepth, bladeThick,
    bladePitch, sections, sideClearance, endClearance, shaftDiameter, foldAngle, flangeLeft,
    flangeRight, edgeReturn, webWidth, numBends, frontSkinThick, rearSkinThick,
    overallBladeDepth, internalStiffenerCount, aerofoilMaxThick, aerofoilCamber, customProfileShape, bladeOnlyMode,
    gateThickness, gateStiffenerCount, gateStiffenerType, gateRackCount, discThickness, discShaftDiameter,
    valveType, valveTypeName, valveSizeDn, valvePressureRating, valveEndConnection, valveBodyMoc, valveTrimMoc, valveSeatMoc, valveActuator
  ]);

  // Synchronize rotation & travel with flapOpen slider (0% to 100%)
  useEffect(() => {
    if (!movingPartsRef.current || movingPartsRef.current.length === 0) return;

    movingPartsRef.current.forEach((part) => {
      if (part.type === 'sliding-gate' && part.object) {
        const travel = (flapOpen / 100) * part.totalTravel;
        part.object.position.y = travel;
      } else if (part.type === 'knife-gate' && part.object) {
        const travel = (flapOpen / 100) * part.totalTravel;
        part.object.position.y = travel;
      } else if (part.type === 'rotating-blades' && part.objects) {
        const rad = (flapOpen / 100) * (Math.PI / 2);
        part.objects.forEach((bladeObj, idx) => {
          const dir = (part.opposed && idx % 2 === 1) ? -1 : 1;
          if (part.isVertical) bladeObj.rotation.y = dir * rad;
          else bladeObj.rotation.x = dir * rad;
        });
      } else if (part.type === 'rotating-disc' && part.object) {
        const rad = (flapOpen / 100) * (Math.PI / 2);
        part.object.rotation.y = rad;
      }
    });

    if (pinionShaftRef.current) {
      pinionShaftRef.current.rotation.x = (flapOpen / 100) * Math.PI * 4;
    }
  }, [flapOpen]);

  // Camera Presets
  const setCameraView = (view) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const h = isValve ? ((valveSizeDn || 300) / 1000) * 1.5 : (height || 3000) / 1000;
    const maxDim = isValve ? ((valveSizeDn || 300) / 1000) * 2 : Math.max(width, height, depth) / 1000;
    const dist = maxDim * 1.8;

    if (view === 'front') {
      cameraRef.current.position.set(0, h / 2, dist);
      controlsRef.current.target.set(0, h / 2, 0);
    } else if (view === 'side') {
      cameraRef.current.position.set(dist, h / 2, 0);
      controlsRef.current.target.set(0, h / 2, 0);
    } else if (view === 'top') {
      cameraRef.current.position.set(0, h + dist * 0.9, 0.01);
      controlsRef.current.target.set(0, h / 2, 0);
    } else {
      cameraRef.current.position.set(dist * 0.7, h / 2 + dist * 0.5, dist * 0.8);
      controlsRef.current.target.set(0, h / 2, 0);
    }
    controlsRef.current.update();
  };

  // Center / Focus Camera directly onto a selected part
  const handleFocusPart = (partKey) => {
    setSelectedPartKey(partKey);
    const anchorData = anchorsRef.current[partKey];
    if (anchorData && controlsRef.current && cameraRef.current) {
      const targetPos = new THREE.Vector3();
      if (anchorData.obj) {
        anchorData.obj.getWorldPosition(targetPos);
      } else if (anchorData.pos) {
        targetPos.copy(anchorData.pos);
      }
      controlsRef.current.target.copy(targetPos);
      controlsRef.current.update();
    }
  };

  const selectedPart = activePartsList.find(p => p.key === selectedPartKey);
  const selectedMod = selectedPartKey ? modifiedParts[selectedPartKey] : null;

  return (
    <div className="relative w-full h-[540px] sm:h-[590px] bg-slate-900/5 rounded-2xl overflow-hidden border border-slate-300 shadow-lg flex flex-col font-sans select-none">
      
      {/* 3D WebGL Canvas Viewport */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" 
      />

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 5. INTERACTIVE 3D COMPONENT CALLOUT OVERLAY BADGES            */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {showLabels && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {activePartsList.map((part) => {
            const isSelected = selectedPartKey === part.key;
            const isHighlighted = highlightedPartKey === part.key;
            const mod = modifiedParts[part.key];
            const isModified = Boolean(mod && (Date.now() - mod.timestamp < 35000));

            // Filter mode support
            if (labelFilter === 'modified' && !isModified && !isSelected) return null;

            return (
              <div
                key={part.key}
                ref={(el) => (badgeRefs.current[part.key] = el)}
                className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-opacity duration-150 will-change-transform flex items-center group cursor-pointer"
                style={{ opacity: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFocusPart(part.key);
                }}
              >
                {/* 3D Pin Target Point */}
                <div className="relative flex items-center justify-center">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-all ${
                    isModified 
                      ? 'bg-[#f89030] scale-125 ring-4 ring-[#f89030]/40 animate-pulse' 
                      : isSelected 
                      ? 'bg-[#005daa] scale-125 ring-4 ring-[#005daa]/40' 
                      : 'bg-slate-700 hover:bg-[#005daa] hover:scale-110'
                  }`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                  {isModified && (
                    <div className="absolute w-6 h-6 rounded-full bg-[#f89030] opacity-40 animate-ping pointer-events-none" />
                  )}
                </div>

                {/* Annotation Card */}
                <div 
                  className={`ml-1.5 px-2.5 py-1.5 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-200 select-none max-w-[210px] sm:max-w-[240px] text-left ${
                    isSelected 
                      ? 'bg-[#005daa] text-white border-blue-400 ring-2 ring-blue-300 scale-105 z-30' 
                      : isModified
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white border-amber-300 ring-2 ring-amber-300/60 shadow-amber-500/30 scale-105 z-30'
                      : 'bg-white/95 text-slate-800 border-slate-200/95 hover:bg-white hover:border-slate-300 hover:shadow-xl'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider font-mono">
                      {part.name}
                    </span>
                    {isModified && (
                      <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded-full bg-white text-amber-800 animate-pulse uppercase tracking-tight">
                        ✨ UPDATED
                      </span>
                    )}
                  </div>
                  
                  <div className={`text-[10px] font-medium leading-tight truncate mt-0.5 ${isSelected || isModified ? 'text-white/95' : 'text-slate-600'}`}>
                    {part.spec}
                  </div>

                  {isModified && mod && (
                    <div className="text-[9px] font-mono font-bold text-amber-100 mt-1 bg-black/25 rounded px-1.5 py-0.5 truncate flex items-center gap-1">
                      <span>✦ {mod.label}:</span>
                      <span className="text-white underline">{mod.to}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 6. REAL-TIME CHANGE HUD TOAST BANNER (TOP-CENTER)            */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {lastChangeNotice && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white px-4 py-2 rounded-2xl shadow-xl border border-amber-300/40 flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300 max-w-[92%] sm:max-w-md">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-100 animate-pulse" />
          </div>
          <div className="text-xs flex-1 truncate">
            <div className="font-extrabold tracking-tight flex items-center gap-1">
              <span>Change Applied in 3D:</span>
              <span className="underline decoration-amber-200">{lastChangeNotice.partName}</span>
            </div>
            <div className="font-mono text-[11px] text-amber-100 truncate mt-0.5">
              {lastChangeNotice.label}: <span className="line-through opacity-70">{lastChangeNotice.from}</span> → <span className="font-bold text-white bg-white/20 px-1 rounded">{lastChangeNotice.to}</span>
            </div>
          </div>
          <button
            onClick={() => handleFocusPart(lastChangeNotice.partKey)}
            className="px-2.5 py-1 rounded-lg bg-white text-amber-800 text-[11px] font-bold hover:bg-amber-50 transition-colors shadow-sm shrink-0"
          >
            Locate
          </button>
          <button
            onClick={() => setLastChangeNotice(null)}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 7. CAD SPECIFICATION BADGE (TOP-LEFT)                         */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl px-3.5 py-2.5 shadow-sm pointer-events-none flex flex-col gap-1 max-w-xs sm:max-w-sm z-10">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isValve ? 'bg-[#f89030]' : 'bg-[#005daa]'} animate-pulse`} />
          <span className={`font-extrabold text-xs ${isValve ? 'text-[#f89030]' : 'text-[#005daa]'} font-mono tracking-tight uppercase truncate`}>
            {isValve ? (valveTypeName || 'Industrial Valve') : damperTypeName}
          </span>
          {isEstimatedProfile && !isValve && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
              CAD Approx
            </span>
          )}
        </div>

        {isValve ? (
          <div className="space-y-0.5">
            <div className="text-[13px] font-bold text-slate-900 font-mono">
              DN{valveSizeDn || 300} ({valveSizeInch || '12"'}) • {valvePressureRating}
            </div>
            <div className="text-[10px] text-slate-600 flex flex-wrap gap-1 font-medium">
              <span>{valveEndConnection}</span> • 
              <span>Body: {valveBodyMoc.split(' ')[0]}</span> • 
              <span>Trim: {valveTrimMoc.split(' ')[0]}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Drive: <span className="font-semibold text-slate-800">{valveActuator.split(' ')[0]}</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-[12px] font-bold text-slate-800 font-mono">
              {width} × {height} × {depth} <span className="text-[10px] text-slate-500 font-normal">mm duct</span>
            </div>
            {isMultiBlade ? (
              <div className="text-[10px] text-slate-600 flex flex-col gap-0.5 mt-0.5 font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#f89030] font-bold">{bladeType}</span>
                  <span>•</span>
                  <span>{bladeOrientation}</span>
                  <span>•</span>
                  <span>{opposedBlades ? 'Opposed' : 'Parallel'}</span>
                </div>
                <div className="text-slate-500 font-mono">
                  Chord: <span className="text-slate-800 font-bold">{bladeChord}</span> mm • 
                  Thk: <span className="text-slate-800 font-bold">{bladeThick}</span> mm • 
                  Count: <span className="text-slate-800 font-bold">{numberOfBlades}</span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-600 flex flex-col gap-0.5 mt-0.5 font-medium">
                <div>Gate: <span className="font-bold text-slate-800">{gateThickness}mm Plate</span> with {gateRackCount} Racks</div>
                <div>Drive: <span className="font-bold text-[#005daa]">{actuatorType}</span></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 8. MODEL PARTS & COMPONENT SELECTOR BAR (TOP-RIGHT)          */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="absolute top-3 right-3 z-10 flex flex-wrap items-center gap-1.5 max-w-[50%] justify-end">
        {activePartsList.map((part) => {
          const isSelected = selectedPartKey === part.key;
          const isMod = modifiedParts[part.key] && (Date.now() - modifiedParts[part.key].timestamp < 35000);

          return (
            <button
              key={part.key}
              type="button"
              onClick={() => handleFocusPart(part.key)}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all flex items-center gap-1 shadow-sm ${
                isSelected
                  ? 'bg-[#005daa] text-white border-[#005daa] ring-2 ring-blue-300'
                  : isMod
                  ? 'bg-amber-500 text-white border-amber-400 animate-pulse'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              {isMod ? (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              )}
              <span className="truncate max-w-[70px] sm:max-w-[90px]">{part.name.split(' ')[0]}</span>
              {isMod && <span className="text-[8px] bg-black/20 rounded px-1">Mod</span>}
            </button>
          );
        })}
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 9. SELECTED COMPONENT INSPECTION CARD (SLIDE-IN MODAL)        */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {selectedPart && (
        <div className="absolute bottom-16 right-3 z-20 bg-white/95 backdrop-blur-md border border-slate-300 rounded-2xl p-3.5 shadow-xl max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#005daa]" />
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase font-mono tracking-wide">
                  {selectedPart.name}
                </h4>
                <span className="text-[10px] font-semibold text-[#005daa] uppercase tracking-wider">
                  {selectedPart.category}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedPartKey(null)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded-md hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
            {selectedPart.desc}
          </p>

          <div className="mt-2.5 p-2 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
              Current Specifications Applied:
            </div>
            <div className="text-[11px] font-mono font-bold text-slate-900">
              {selectedPart.spec}
            </div>
            {selectedMod && (
              <div className="text-[10px] font-mono text-amber-700 font-bold bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Recently Modified: {selectedMod.label} → {selectedMod.to}</span>
              </div>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Click part or pin to inspect</span>
            <button
              onClick={() => handleFocusPart(selectedPart.key)}
              className="text-[#005daa] font-bold hover:underline flex items-center gap-0.5"
            >
              <Crosshair className="w-3 h-3" /> Focus in 3D
            </button>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 10. FLOATING BOTTOM TOOLBAR (CONTROLS & PRESETS)              */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl px-4 py-2.5 shadow-sm flex flex-wrap items-center justify-between gap-3 z-10">
        
        {/* Flap Opening Slider */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <span className="text-xs font-bold text-slate-700 font-mono flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-[#005daa]" />
            <span>{isValve ? 'Valve Opening:' : 'Opening:'}</span>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={flapOpen}
            onChange={(e) => setFlapOpen(Number(e.target.value))}
            className="w-24 sm:w-32 accent-[#f89030] cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-[#005daa] min-w-[34px]">
            {flapOpen}%
          </span>
        </div>

        {/* Camera Views, Labels Toggle & Wireframe */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Labels Toggle */}
          <button
            type="button"
            onClick={() => setShowLabels(!showLabels)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1 ${
              showLabels
                ? 'bg-[#005daa] text-white border-[#005daa] shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="Toggle 3D Part Callout Labels"
          >
            <Tag className="w-3 h-3" />
            <span>{showLabels ? 'Labels: ON' : 'Labels: OFF'}</span>
          </button>

          {showLabels && (
            <button
              type="button"
              onClick={() => setLabelFilter(labelFilter === 'all' ? 'modified' : 'all')}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                labelFilter === 'modified'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
              title="Show only modified parts or all parts"
            >
              {labelFilter === 'modified' ? 'Modified Only' : 'Show All'}
            </button>
          )}

          {/* Camera Views */}
          {['iso', 'front', 'side', 'top'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCameraView(v)}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors uppercase"
            >
              {v}
            </button>
          ))}

          {/* Wireframe Mode */}
          <button
            type="button"
            onClick={() => setWireframe(!wireframe)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
              wireframe 
                ? 'bg-[#005daa] text-white border-[#005daa]' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Wireframe
          </button>

          {/* Blade Only Mode for Multi-Blade Damper */}
          {!isValve && isMultiBlade && (
            <button
              type="button"
              onClick={() => setBladeOnlyMode(!bladeOnlyMode)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                bladeOnlyMode
                  ? 'bg-[#f89030] text-white border-[#f89030] shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {bladeOnlyMode ? 'Show Damper' : 'Blade Only'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
