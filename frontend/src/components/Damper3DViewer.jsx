import React, { useEffect, useRef, useState } from 'react';
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
  Info
} from 'lucide-react';

export default function Damper3DViewer({ 
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
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const damperGroupRef = useRef(null);
  const movingPartsRef = useRef([]);
  const pinionShaftRef = useRef(null);

  const [flapOpen, setFlapOpen] = useState(25); // % open
  const [wireframe, setWireframe] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [bladeOnlyMode, setBladeOnlyMode] = useState(false);

  const normAction = (bladeAction || '').toLowerCase();
  const isDisc = normAction.includes('disc') || (damperTypeName && damperTypeName.toLowerCase().includes('butterfly'));
  const isMultiBlade = damperType === 'multi_blade' || damperType === 'louver' || damperType === 'multi-blade' || normAction.includes('parallel') || normAction.includes('opposed');
  const isEstimatedProfile = bladeType.toLowerCase().includes('aerofoil') || bladeType.toLowerCase().includes('custom');

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xf1f5f9); // Clean light engineering CAD slate-grey

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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.15);
    dirLight1.position.set(6, 9, 7);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.6);
    dirLight2.position.set(-6, 4, -4);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xfef08a, 0.3);
    dirLight3.position.set(0, -5, 0);
    scene.add(dirLight3);

    // CAD ground grid
    const grid = new THREE.GridHelper(14, 28, 0x94a3b8, 0xcbd5e1);
    grid.position.y = -0.01;
    scene.add(grid);

    // Animation loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  // Helper to create specific cross-section blade geometries
  const createBladeGeometry = (spanM, chordM, thickM, profType) => {
    const pType = profType.toLowerCase();

    if (pType.includes('aerofoil')) {
      // Extruded NACA 4-digit aerodynamic profile
      const shape = new THREE.Shape();
      const c = chordM;
      const maxT = Math.max(0.015, (bladeDepth || 25) / 1000);
      
      // Aerofoil upper and lower camber envelope
      const pts = 24;
      shape.moveTo(0, 0);
      // Upper skin
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
      // Lower skin
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

      const extrudeSettings = {
        steps: 1,
        depth: spanM,
        bevelEnabled: false,
      };
      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.rotateY(Math.PI / 2);
      geo.translate(-spanM / 2, 0, 0);
      return geo;

    } else if (pType.includes('folded')) {
      // Folded blade with web, flanges, and return lips
      const shape = new THREE.Shape();
      const wM = (webWidth || 100) / 1000;
      const flM = (flangeLeft || 20) / 1000;
      const frM = (flangeRight || 20) / 1000;
      const lipM = (edgeReturn || 8) / 1000;
      const rad = ((foldAngle || 45) * Math.PI) / 180;
      const t = Math.max(0.002, thickM);

      const dLeft = flM * Math.sin(rad);
      const lLeft = flM * Math.cos(rad);
      const dRight = frM * Math.sin(rad);
      const lRight = frM * Math.cos(rad);

      // Path around folded contour
      shape.moveTo(-wM / 2 - lLeft, dLeft);
      shape.lineTo(-wM / 2 - lLeft - lipM * Math.sin(rad), dLeft - lipM * Math.cos(rad));
      shape.lineTo(-wM / 2 - lLeft - lipM * Math.sin(rad) + t, dLeft - lipM * Math.cos(rad) + t);
      shape.lineTo(-wM / 2, 0);
      shape.lineTo(wM / 2, 0);
      shape.lineTo(wM / 2 + lRight, -dRight);
      shape.lineTo(wM / 2 + lRight + lipM * Math.sin(rad), -dRight + lipM * Math.cos(rad));
      shape.lineTo(wM / 2 + lRight + lipM * Math.sin(rad) - t, -dRight + lipM * Math.cos(rad) - t);
      shape.lineTo(wM / 2 - t, -t);
      shape.lineTo(-wM / 2 + t, -t);
      shape.closePath();

      const extrudeSettings = { steps: 1, depth: spanM, bevelEnabled: false };
      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.rotateY(Math.PI / 2);
      geo.translate(-spanM / 2, 0, 0);
      return geo;

    } else if (pType.includes('custom')) {
      // Z-channel or C-channel cross section
      const shape = new THREE.Shape();
      const c = chordM;
      const d = Math.max(0.02, (bladeDepth || 25) / 1000);
      const t = Math.max(0.002, thickM);
      const lip = 0.01;

      shape.moveTo(-c / 2, d / 2 - lip);
      shape.lineTo(-c / 2, d / 2);
      shape.lineTo(-c / 4, d / 2);
      shape.lineTo(c / 4, -d / 2);
      shape.lineTo(c / 2, -d / 2);
      shape.lineTo(c / 2, -d / 2 + lip);
      shape.lineTo(c / 2 - t, -d / 2 + lip);
      shape.lineTo(c / 2 - t, -d / 2 + t);
      shape.lineTo(c / 4 - t, -d / 2 + t);
      shape.lineTo(-c / 4 - t, d / 2 - t);
      shape.lineTo(-c / 2 + t, d / 2 - t);
      shape.lineTo(-c / 2 + t, d / 2 - lip);
      shape.closePath();

      const extrudeSettings = { steps: 1, depth: spanM, bevelEnabled: false };
      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.rotateY(Math.PI / 2);
      geo.translate(-spanM / 2, 0, 0);
      return geo;

    } else {
      // Flat sheet rectangular blade
      return new THREE.BoxGeometry(spanM, chordM, Math.max(0.003, thickM));
    }
  };

  // Rebuild 3D Model when parameters change
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    if (damperGroupRef.current) {
      scene.remove(damperGroupRef.current);
      damperGroupRef.current.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
    }

    const damperGroup = new THREE.Group();
    damperGroupRef.current = damperGroup;
    movingPartsRef.current = [];

    // Scale 1m = 1 unit
    const w = Math.max(0.5, (width || 3000) / 1000);
    const h = Math.max(0.5, (height || 3000) / 1000);
    const d = Math.max(0.18, (depth || 180) / 1000);
    const wallThick = 0.035;
    const flangeOut = 0.08;

    // Materials
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.35,
      wireframe: wireframe,
    });

    const flangeMat = new THREE.MeshStandardMaterial({
      color: 0x005daa,
      metalness: 0.8,
      roughness: 0.3,
      wireframe: wireframe,
    });

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xf89030,
      metalness: 0.75,
      roughness: 0.25,
      wireframe: wireframe,
    });

    const rearSkinMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.75,
      roughness: 0.25,
      wireframe: wireframe,
    });

    const mechanicalMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: wireframe,
    });

    const actuatorMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.6,
      roughness: 0.4,
      wireframe: wireframe,
    });

    const isDoubleSkin = bladeType.toLowerCase().includes('double');
    const isVertical = bladeOrientation.toLowerCase() === 'vertical';

    // ── Build Outer Damper Frame & Flanges (unless bladeOnlyMode) ──
    if (!bladeOnlyMode) {
      const centerY = h / 2;

      // Top & Bottom Frame Channels
      const topChannel = new THREE.Mesh(new THREE.BoxGeometry(w + wallThick * 2, wallThick, d), steelMat);
      topChannel.position.set(0, h + wallThick / 2, 0);
      topChannel.castShadow = true;
      damperGroup.add(topChannel);

      const botChannel = new THREE.Mesh(new THREE.BoxGeometry(w + wallThick * 2, wallThick, d), steelMat);
      botChannel.position.set(0, -wallThick / 2, 0);
      botChannel.castShadow = true;
      damperGroup.add(botChannel);

      // Left & Right Side Frame Plates
      const leftPlate = new THREE.Mesh(new THREE.BoxGeometry(wallThick, h, d), steelMat);
      leftPlate.position.set(-w / 2 - wallThick / 2, centerY, 0);
      leftPlate.castShadow = true;
      damperGroup.add(leftPlate);

      const rightPlate = new THREE.Mesh(new THREE.BoxGeometry(wallThick, h, d), steelMat);
      rightPlate.position.set(w / 2 + wallThick / 2, centerY, 0);
      rightPlate.castShadow = true;
      damperGroup.add(rightPlate);

      // Duct Mounting Flanges (Inlet and Outlet)
      const normFlange = (flangeType || '').toLowerCase();
      const isWafer = normFlange.includes('wafer') || normFlange.includes('sandwich');
      const isButtWeld = normFlange.includes('butt') || normFlange.includes('weld');

      if (isWafer) {
        // Wafer sandwich style: flush body with 4 alignment clamp locator lugs
        const lugSize = 0.045;
        const corners = [
          [-w / 2, -lugSize / 2],
          [w / 2, -lugSize / 2],
          [-w / 2, h + lugSize / 2],
          [w / 2, h + lugSize / 2],
        ];
        corners.forEach(([lx, ly]) => {
          const lug = new THREE.Mesh(new THREE.BoxGeometry(lugSize * 1.6, lugSize, d * 0.9), flangeMat);
          lug.position.set(lx, ly, 0);
          damperGroup.add(lug);
        });
      } else if (isButtWeld) {
        // Butt-weld duct collar extensions (chamfered weld bevel collars)
        const collarExt = 0.06;
        [-d / 2 - collarExt / 2, d / 2 + collarExt / 2].forEach((cz) => {
          const collarTop = new THREE.Mesh(new THREE.BoxGeometry(w, wallThick * 0.8, collarExt), steelMat);
          collarTop.position.set(0, h, cz);
          damperGroup.add(collarTop);
          const collarBot = new THREE.Mesh(new THREE.BoxGeometry(w, wallThick * 0.8, collarExt), steelMat);
          collarBot.position.set(0, 0, cz);
          damperGroup.add(collarBot);
          const collarLeft = new THREE.Mesh(new THREE.BoxGeometry(wallThick * 0.8, h, collarExt), steelMat);
          collarLeft.position.set(-w / 2, centerY, cz);
          damperGroup.add(collarLeft);
          const collarRight = new THREE.Mesh(new THREE.BoxGeometry(wallThick * 0.8, h, collarExt), steelMat);
          collarRight.position.set(w / 2, centerY, cz);
          damperGroup.add(collarRight);
        });
      } else {
        // Standard Angle Flanges on both faces (Inlet and Outlet)
        [-d / 2, d / 2].forEach((zFace) => {
          const fTop = new THREE.Mesh(new THREE.BoxGeometry(w + flangeOut * 2, flangeOut, wallThick), flangeMat);
          fTop.position.set(0, h + flangeOut / 2, zFace);
          damperGroup.add(fTop);

          const fBot = new THREE.Mesh(new THREE.BoxGeometry(w + flangeOut * 2, flangeOut, wallThick), flangeMat);
          fBot.position.set(0, -flangeOut / 2, zFace);
          damperGroup.add(fBot);

          const fLeft = new THREE.Mesh(new THREE.BoxGeometry(flangeOut, h + flangeOut * 2, wallThick), flangeMat);
          fLeft.position.set(-w / 2 - flangeOut / 2, centerY, zFace);
          damperGroup.add(fLeft);

          const fRight = new THREE.Mesh(new THREE.BoxGeometry(flangeOut, h + flangeOut * 2, wallThick), flangeMat);
          fRight.position.set(w / 2 + flangeOut / 2, centerY, zFace);
          damperGroup.add(fRight);
        });
      }

      // Sealing Class Visual Features
      if (sealingEfficiency === '100%') {
        // Pressurized Seal Air Purge Ports & Manifold
        const purgeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.2 });
        const purgeNozzleTop = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.09, 16), purgeMat);
        purgeNozzleTop.position.set(0, h + wallThick + 0.045, 0);
        damperGroup.add(purgeNozzleTop);
        const purgeNozzleBot = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.09, 16), purgeMat);
        purgeNozzleBot.position.set(0, -wallThick - 0.045, 0);
        damperGroup.add(purgeNozzleBot);
      } else if (sealingEfficiency === '99.9%') {
        // Visible Tadpole bulb seal track lining inner perimeter
        const bulbMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.8 });
        const bulbTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.012), bulbMat);
        bulbTop.position.set(0, h - 0.006, 0);
        damperGroup.add(bulbTop);
        const bulbBot = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.012), bulbMat);
        bulbBot.position.set(0, 0.006, 0);
        damperGroup.add(bulbBot);
      }

      // Intermediate section mullion dividers (if sections > 1)
      if (sections > 1 && isMultiBlade) {
        for (let s = 1; s < sections; s++) {
          const mulX = -w / 2 + (s * w) / sections;
          const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.012, h, d), steelMat);
          mullion.position.set(mulX, centerY, 0);
          damperGroup.add(mullion);
        }
      }
    }

    // ── Helper to build dynamic Actuator based on actuatorType ──
    const buildActuatorMesh = (type, x, y, z) => {
      const actGrp = new THREE.Group();
      actGrp.position.set(x, y, z);
      const actNorm = (type || 'electric').toLowerCase();

      if (actNorm.includes('pneumatic')) {
        // Pneumatic cylinder actuator (cylinder barrel, piston rod, solenoid block)
        const cylLen = 0.36;
        const cylRad = 0.07;
        const pneuBarrelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.25 });
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.95, roughness: 0.1 });
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(cylRad, cylRad, cylLen, 24), pneuBarrelMat);
        barrel.rotation.z = Math.PI / 2;
        actGrp.add(barrel);

        [-cylLen / 2, cylLen / 2].forEach((cx) => {
          const cap = new THREE.Mesh(new THREE.BoxGeometry(0.04, cylRad * 2.2, cylRad * 2.2), mechanicalMat);
          cap.position.set(cx, 0, 0);
          actGrp.add(cap);
        });

        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 16), chromeMat);
        rod.rotation.z = Math.PI / 2;
        rod.position.set(cylLen / 2 + 0.09, 0, 0);
        actGrp.add(rod);

        // Solenoid valve control block on side
        const solBox = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.08), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 }));
        solBox.position.set(0, cylRad + 0.045, 0);
        actGrp.add(solBox);

        // Air port fittings
        const airPort = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.035, 8), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9 }));
        airPort.position.set(0, cylRad + 0.095, 0);
        actGrp.add(airPort);

      } else if (actNorm.includes('manual')) {
        // Manual handwheel gearbox with spoked wheel
        const gearBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.2), mechanicalMat);
        actGrp.add(gearBox);

        const wheelMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.7, roughness: 0.3 }); // Red safety handwheel
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 8, 24), wheelMat);
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(0.14, 0, 0);
        actGrp.add(wheel);

        // Spokes
        for (let spk = 0; spk < 4; spk++) {
          const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 8), mechanicalMat);
          spoke.rotation.z = (spk * Math.PI) / 4;
          spoke.position.set(0.14, 0, 0);
          actGrp.add(spoke);
        }

      } else if (actNorm.includes('hydraulic')) {
        // Electro-hydraulic actuator cylinder
        const hydMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 24), hydMat);
        cyl.rotation.z = Math.PI / 2;
        actGrp.add(cyl);

        const manifold = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), mechanicalMat);
        manifold.position.set(0, 0.11, 0);
        actGrp.add(manifold);

      } else {
        // Industrial electric actuator (AUMA / Rotork)
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.34), actuatorMat);
        actGrp.add(body);

        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 16), steelMat);
        motor.rotation.x = Math.PI / 2;
        motor.position.set(0, 0.06, 0.24);
        actGrp.add(motor);

        const display = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.015, 16), new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.2, roughness: 0.1 }));
        display.rotation.y = Math.PI / 2;
        display.position.set(0.135, 0.05, 0);
        actGrp.add(display);

        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24), mechanicalMat);
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(0.16, -0.05, 0);
        actGrp.add(wheel);
      }

      return actGrp;
    };

    // ── Build Configured Blades according to Blade / Gate Action ──
    if (isDisc) {
      // ═════════════════════════════════════════════════════════════
      // 1. Central Disc (Butterfly) Damper Blade
      // ═════════════════════════════════════════════════════════════
      const discGroup = new THREE.Group();
      discGroup.position.set(0, h / 2, 0);

      // Central through-shaft spindle
      const dShaftM = Math.max(0.025, (discShaftDiameter || 45) / 1000);
      const discShaftLen = w + 0.45;
      const discSpindle = new THREE.Mesh(new THREE.CylinderGeometry(dShaftM / 2, dShaftM / 2, discShaftLen, 24), steelMat);
      discSpindle.rotation.z = Math.PI / 2;
      discGroup.add(discSpindle);

      // Central Disc Blade Plate
      const dThkM = Math.max(0.006, (discThickness || 10) / 1000);
      const discBlade = new THREE.Mesh(new THREE.BoxGeometry(w - 0.03, h - 0.03, dThkM), bladeMat);
      discBlade.castShadow = true;
      discGroup.add(discBlade);

      // Central clamping hub sleeves
      const hubW = Math.max(0.12, w * 0.4);
      const hubSleeve = new THREE.Mesh(new THREE.CylinderGeometry(dShaftM * 0.9, dShaftM * 0.9, hubW, 16), mechanicalMat);
      hubSleeve.rotation.z = Math.PI / 2;
      discGroup.add(hubSleeve);

      // Stiffener ribs across disc face
      [-h / 4, h / 4].forEach((ry) => {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.035, 0.025), steelMat);
        rib.position.set(0, ry, dThkM / 2 + 0.012);
        discGroup.add(rib);
      });

      // Perimeter seating seal strip
      const sealBorderMat = new THREE.MeshStandardMaterial({
        color: sealingEfficiency === '100%' ? 0xef4444 : (sealingEfficiency === '99.9%' ? 0xf59e0b : 0x475569),
        metalness: 0.5,
        roughness: 0.3
      });
      const sealTop = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 0.014, dThkM * 1.3), sealBorderMat);
      sealTop.position.set(0, (h - 0.03) / 2, 0);
      discGroup.add(sealTop);
      const sealBot = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 0.014, dThkM * 1.3), sealBorderMat);
      sealBot.position.set(0, -(h - 0.03) / 2, 0);
      discGroup.add(sealBot);

      damperGroup.add(discGroup);
      movingPartsRef.current.push({ type: 'rotating-disc', object: discGroup });

      // Side Actuator Stool & Drive Unit on shaft extension
      if (!bladeOnlyMode) {
        const stool = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), steelMat);
        stool.position.set(w / 2 + 0.15, h / 2, 0);
        damperGroup.add(stool);

        const actX = w / 2 + wallThick + 0.34;
        const actGroup = buildActuatorMesh(actuatorType, actX, h / 2, 0);
        damperGroup.add(actGroup);
      }

    } else if (isMultiBlade) {
      // ═════════════════════════════════════════════════════════════
      // 2. Multi-Blade Louver Damper Blades (Opposed or Parallel)
      // ═════════════════════════════════════════════════════════════
      const numBlades = Math.max(2, Math.min(30, numberOfBlades));
      const nSec = Math.max(1, sections);
      const spanAxisTotal = isVertical ? h : w;
      const stackAxisTotal = isVertical ? w : h;

      const singleSpanM = Math.max(0.1, ((bladeLength || (spanAxisTotal * 1000 / nSec - 10)) / 1000));
      const chordM = Math.max(0.06, (bladeChord || (stackAxisTotal * 1000 / numBlades * 1.1)) / 1000);
      const thickM = Math.max(0.0012, (bladeThick || 1.6) / 1000);
      const depthM = Math.max(0.015, (bladeDepth || 25) / 1000);
      const shaftDiaM = Math.max(0.012, (shaftDiameter || 16) / 1000);

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

            const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(singleSpanM, chordM, rearSkinThick / 1000), rearSkinMat);
            rearPlate.position.set(0, 0, depthM / 2);
            rearPlate.castShadow = true;
            bladePivot.add(rearPlate);

            const topCap = new THREE.Mesh(new THREE.BoxGeometry(singleSpanM, 0.004, depthM), mechanicalMat);
            topCap.position.set(0, chordM / 2, 0);
            bladePivot.add(topCap);

            const botCap = new THREE.Mesh(new THREE.BoxGeometry(singleSpanM, 0.004, depthM), mechanicalMat);
            botCap.position.set(0, -chordM / 2, 0);
            bladePivot.add(botCap);

            const nStiff = Math.max(1, internalStiffenerCount);
            for (let stIdx = 0; stIdx < nStiff; stIdx++) {
              const stY = -chordM / 3 + (stIdx * (chordM * 2 / 3)) / Math.max(1, nStiff - 1);
              const stiffBar = new THREE.Mesh(new THREE.BoxGeometry(singleSpanM, 0.004, depthM * 0.8), mechanicalMat);
              stiffBar.position.set(0, stY, 0);
              bladePivot.add(stiffBar);
            }
          } else {
            const bladeGeo = createBladeGeometry(singleSpanM, chordM, thickM, bladeType);
            const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
            bladeMesh.castShadow = true;
            bladePivot.add(bladeMesh);
          }

          // Through-Shaft
          const shaftLen = singleSpanM + 0.15;
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftDiaM / 2, shaftDiaM / 2, shaftLen, 16), steelMat);
          if (!isVertical) {
            shaft.rotation.z = Math.PI / 2;
          }
          bladePivot.add(shaft);

          // Bearings/Bushes on frame ends
          [-singleSpanM / 2, singleSpanM / 2].forEach((endX) => {
            const bush = new THREE.Mesh(new THREE.CylinderGeometry(shaftDiaM * 0.9, shaftDiaM * 0.9, 0.025, 16), mechanicalMat);
            bush.rotation.z = Math.PI / 2;
            bush.position.set(endX, 0, 0);
            bladePivot.add(bush);
          });

          // Crank Levers on drive side (only in full model)
          if (!bladeOnlyMode && s === nSec - 1) {
            const isOpp = normAction.includes('opposed') || opposedBlades;
            const leverDir = (isOpp && i % 2 === 1) ? -1 : 1;
            const lever = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, 0.012), mechanicalMat);
            lever.position.set(singleSpanM / 2 + 0.05, leverDir * 0.045, 0);
            bladePivot.add(lever);
          }

          damperGroup.add(bladePivot);
          bladeMeshes.push(bladePivot);
        }
      }

      // External Interconnecting Tie-Rod Linkage & Actuator
      if (!bladeOnlyMode) {
        const isOpp = normAction.includes('opposed') || opposedBlades;
        const linkBar = new THREE.Mesh(new THREE.BoxGeometry(0.012, h * 0.9, 0.015), mechanicalMat);
        linkBar.position.set(w / 2 + 0.08, h / 2, 0);
        damperGroup.add(linkBar);

        if (isOpp) {
          const linkBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, h * 0.9, 0.015), mechanicalMat);
          linkBar2.position.set(w / 2 + 0.08, h / 2, 0.035);
          damperGroup.add(linkBar2);
        }

        // Actuator Stool & Drive Unit
        const stool = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.18), steelMat);
        stool.position.set(w / 2 + 0.18, h / 2, 0);
        damperGroup.add(stool);

        const actGroup = buildActuatorMesh(actuatorType, w / 2 + 0.34, h / 2, 0);
        damperGroup.add(actGroup);
      }

      movingPartsRef.current.push({ 
        type: 'rotating-blades', 
        objects: bladeMeshes, 
        opposed: normAction.includes('opposed') || opposedBlades,
        isVertical: isVertical
      });

    } else {
      // ═════════════════════════════════════════════════════════════
      // 3. Rack & Pinion Sliding-Gate Damper Flap
      // ═════════════════════════════════════════════════════════════
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
        const st = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.045, 0.038), steelMat);
        st.position.set(0, stY, gThkM / 2 + 0.019);
        flapGroup.add(st);
      }

      // Vertical precision gear racks
      const nRacks = Math.max(2, gateRackCount || 2);
      for (let i = 0; i < nRacks; i++) {
        const rackX = -w / 2 + ((i + 1) * w) / (nRacks + 1);
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.92, 0.03), mechanicalMat);
        rack.position.set(rackX, h / 2, gThkM / 2 + 0.02);
        flapGroup.add(rack);
      }

      damperGroup.add(flapGroup);
      movingPartsRef.current.push({ type: 'sliding-gate', object: flapGroup, totalTravel: h * 0.95 });

      // Pinion Drive Shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, w + 0.6, 24), steelMat);
      shaft.rotation.z = Math.PI / 2;
      shaft.position.set(0, h + 0.16, gThkM / 2 + 0.04);
      damperGroup.add(shaft);
      pinionShaftRef.current = shaft;

      // Pinion gears meshing with racks
      for (let i = 0; i < nRacks; i++) {
        const rackX = -w / 2 + ((i + 1) * w) / (nRacks + 1);
        const pinion = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16), mechanicalMat);
        pinion.rotation.z = Math.PI / 2;
        pinion.position.set(rackX, h + 0.16, gThkM / 2 + 0.04);
        damperGroup.add(pinion);
      }

      // Dynamic Actuator mounted on top drive shaft extension
      if (!bladeOnlyMode) {
        const actGroup = buildActuatorMesh(actuatorType, w / 2 + wallThick + 0.35, h + 0.16, gThkM / 2 + 0.04);
        damperGroup.add(actGroup);
      }
    }

    scene.add(damperGroup);

    // Target Camera to Damper Center
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
    width, height, depth, damperType, damperTypeName, wireframe, numberOfBlades, opposedBlades,
    bladeAction, actuatorType, sealingEfficiency, designTemp, designPressure, flangeType,
    bladeType, bladeOrientation, bladeChord, bladeLength, bladeDepth, bladeThick,
    bladePitch, sections, sideClearance, endClearance, shaftDiameter, foldAngle, flangeLeft,
    flangeRight, edgeReturn, webWidth, numBends, frontSkinThick, rearSkinThick,
    overallBladeDepth, internalStiffenerCount, aerofoilMaxThick, aerofoilCamber, customProfileShape, bladeOnlyMode,
    gateThickness, gateStiffenerCount, gateStiffenerType, gateRackCount, discThickness, discShaftDiameter
  ]);

  // Synchronize rotation & travel with flapOpen slider (0% to 100%)
  useEffect(() => {
    if (!movingPartsRef.current || movingPartsRef.current.length === 0) return;

    movingPartsRef.current.forEach((part) => {
      if (part.type === 'sliding-gate' && part.object) {
        const travel = (flapOpen / 100) * part.totalTravel;
        part.object.position.y = travel;
      } else if (part.type === 'rotating-blades' && part.objects) {
        // 0% = closed (0 deg), 100% = open (90 deg)
        const rad = (flapOpen / 100) * (Math.PI / 2);
        part.objects.forEach((bladeObj, idx) => {
          const dir = (part.opposed && idx % 2 === 1) ? -1 : 1;
          if (part.isVertical) {
            bladeObj.rotation.y = dir * rad;
          } else {
            bladeObj.rotation.x = dir * rad;
          }
        });
      } else if (part.type === 'rotating-disc' && part.object) {
        // 0% = closed (0 deg), 100% = open (90 deg)
        const rad = (flapOpen / 100) * (Math.PI / 2);
        part.object.rotation.x = rad;
      }
    });

    if (pinionShaftRef.current) {
      pinionShaftRef.current.rotation.x = (flapOpen / 100) * Math.PI * 4;
    }
  }, [flapOpen]);

  // Camera Presets
  const setCameraView = (view) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const h = (height || 3000) / 1000;
    const maxDim = Math.max(width, height, depth) / 1000;
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
      // Isometric view
      cameraRef.current.position.set(dist * 0.7, h / 2 + dist * 0.5, dist * 0.8);
      controlsRef.current.target.set(0, h / 2, 0);
    }
    controlsRef.current.update();
  };

  return (
    <div className="relative w-full h-[500px] sm:h-[540px] bg-slate-100 rounded-2xl overflow-hidden border border-slate-300 shadow-md flex flex-col">
      {/* 3D WebGL Canvas */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" 
      />

      {/* Engineering Specification Overlay */}
      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl px-3.5 py-2.5 shadow-sm pointer-events-none flex flex-col gap-1 max-w-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#005daa] animate-pulse" />
          <span className="font-extrabold text-xs text-[#005daa] font-mono tracking-tight uppercase">
            {damperTypeName}
          </span>
          {isEstimatedProfile && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
              Approx CAD
            </span>
          )}
        </div>
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
              Span: <span className="text-slate-800 font-bold">{bladeLength || Math.round(width / sections - 10)}</span> mm • 
              Chord: <span className="text-slate-800 font-bold">{bladeChord}</span> mm • 
              Thk: <span className="text-slate-800 font-bold">{bladeThick}</span> mm
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-slate-500 flex items-center gap-2">
            <span>R&P Sliding Gate</span>
            <span>•</span>
            <span>Electric Multi-Turn</span>
          </div>
        )}
      </div>

      {/* Top Right Tool Buttons & Camera Presets */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur p-1 rounded-xl border border-slate-300 shadow-sm">
          <button
            onClick={() => setCameraView('iso')}
            title="Isometric 3D View"
            className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition-all"
          >
            ISO
          </button>
          <button
            onClick={() => setCameraView('front')}
            title="Front Elevation View"
            className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition-all"
          >
            FRONT
          </button>
          <button
            onClick={() => setCameraView('side')}
            title="Side Section View (Air Path)"
            className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition-all"
          >
            SIDE
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {isMultiBlade && (
            <button
              onClick={() => setBladeOnlyMode(!bladeOnlyMode)}
              title="Inspect Single Blade Cross-Section Close-Up"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border backdrop-blur transition-all shadow-sm flex items-center gap-1 ${
                bladeOnlyMode
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white/90 text-slate-700 border-slate-300 hover:bg-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>{bladeOnlyMode ? 'Show Damper' : 'Blade Only'}</span>
            </button>
          )}

          <button
            onClick={() => setWireframe(!wireframe)}
            title="Toggle CAD Wireframe Mesh"
            className={`p-2 rounded-xl text-xs font-semibold border backdrop-blur transition-all shadow-sm ${
              wireframe
                ? 'bg-[#005daa] text-white border-[#005daa]'
                : 'bg-white/90 text-slate-700 border-slate-300 hover:bg-white'
            }`}
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCameraView('iso')}
            title="Reset Standard Isometric Camera View"
            className="p-2 rounded-xl text-xs font-semibold bg-white/90 text-slate-700 border border-slate-300 hover:bg-white backdrop-blur transition-all shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Interactive Blade Rotation & Travel Ribbon */}
      <div className="bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <MoveVertical className="w-4 h-4 text-[#005daa]" />
          <span>Blade Rotation / Travel:</span>
          <span className="font-mono font-black text-[#005daa] w-12 text-right">
            {flapOpen}%
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            ({Math.round((flapOpen / 100) * 90)}° {flapOpen === 0 ? 'Closed' : flapOpen === 100 ? 'Fully Open' : 'Modulating'})
          </span>
        </div>

        <div className="flex-1 max-w-xs min-w-[160px]">
          <input
            type="range"
            min="0"
            max="100"
            value={flapOpen}
            onChange={(e) => setFlapOpen(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#005daa] focus:outline-none"
          />
        </div>

        <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
          Left-click: Rotate • Right-click: Pan • Scroll: Zoom
        </div>
      </div>
    </div>
  );
}
