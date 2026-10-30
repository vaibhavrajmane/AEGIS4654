import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CameraViewMode,
  ControlMode,
  Detection,
  MonitoringCapability,
  QualityPreset,
  SeaState,
  Telemetry,
  Vessel,
  WorldEntity,
} from '../types';
import { MPA_ZONE, seabedHeightAt } from '../data/worldSeed';
import { ManualInputState } from '../sim/physics';

// Pre-allocated math helpers at module scope to guarantee Zero GC in render loop
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();

interface OceanViewport3DProps {
  telemetry: Telemetry;
  entities: WorldEntity[];
  vessels: Vessel[];
  detections: Detection[];
  cameraMode: CameraViewMode;
  onSelectCameraMode: (mode: CameraViewMode) => void;
  controlMode: ControlMode;
  onSelectControlMode: (mode: ControlMode) => void;
  showYoloOverlays: boolean;
  onToggleYoloOverlays: () => void;
  lightsOn: boolean;
  onToggleLights: () => void;
  sonarActive: boolean;
  onToggleSonar: () => void;
  onEmergencySurface: () => void;
  seaState: SeaState;
  timeOfDay: number; // 0..24
  quality: QualityPreset;
  commsOutage: boolean;
  manualInputRef: React.MutableRefObject<ManualInputState>;
  onSelectEntity?: (entityId: string) => void;
  activeCapability: MonitoringCapability;
}

export const OceanViewport3D: React.FC<OceanViewport3DProps> = ({
  telemetry,
  entities,
  vessels,
  detections,
  cameraMode,
  onSelectCameraMode,
  controlMode,
  onSelectControlMode,
  showYoloOverlays,
  onToggleYoloOverlays,
  lightsOn,
  onToggleLights,
  sonarActive,
  onToggleSonar,
  onEmergencySurface,
  seaState,
  timeOfDay,
  quality,
  commsOutage,
  manualInputRef,
  onSelectEntity,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [orbitYawOffset, setOrbitYawOffset] = useState(0.5);
  const [orbitPitchOffset, setOrbitPitchOffset] = useState(0.35);

  // Store latest props in ref so WebGL loop reads live state without tearing down scene
  const livePropsRef = useRef({
    telemetry,
    entities,
    vessels,
    cameraMode,
    lightsOn,
    sonarActive,
    seaState,
    timeOfDay,
    quality,
    commsOutage,
    orbitYawOffset,
    orbitPitchOffset,
  });

  useEffect(() => {
    livePropsRef.current = {
      telemetry,
      entities,
      vessels,
      cameraMode,
      lightsOn,
      sonarActive,
      seaState,
      timeOfDay,
      quality,
      commsOutage,
      orbitYawOffset,
      orbitPitchOffset,
    };
  }, [
    telemetry,
    entities,
    vessels,
    cameraMode,
    lightsOn,
    sonarActive,
    seaState,
    timeOfDay,
    quality,
    commsOutage,
    orbitYawOffset,
    orbitPitchOffset,
  ]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Detect software WebGL (SwiftShader/llvmpipe) per threejs skill
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      setWebglError('WebGL context unavailable on this device. Switch to 2D Mode.');
      return;
    }

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 540;
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene, Fog & Studio Environment Map
    const scene = new THREE.Scene();
    const deepWaterColor = new THREE.Color(0x051b34);
    scene.background = deepWaterColor;
    scene.fog = new THREE.FogExp2(0x051b34, 0.014);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 260);
    camera.position.set(10, -10, 4);

    // 3. Studio Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x041022, 1.15);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.65);
    sunLight.position.set(35, 70, 25);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      const d = 65;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.camera.near = 5;
      sunLight.shadow.camera.far = 140;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight);

    // 4. Seabed Bathymetry Terrain Mesh (with vertex coloring by depth)
    const terrainGeo = new THREE.PlaneGeometry(150, 150, 56, 56);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const tmpColor = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = seabedHeightAt(vx, vz);
      posAttr.setY(i, vy);

      // Color gradient: warm coral sand on ridges (-22m) to deep abyssal slate (-45m)
      const t = Math.max(0, Math.min(1, (vy + 46) / 24));
      tmpColor.setHSL(0.54 - t * 0.12, 0.38, 0.14 + t * 0.22);
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.08,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = !isSoftwareGl;
    scene.add(terrainMesh);

    // 5. Sea Surface Plane & Sun Rays
    const seaSurfaceGeo = new THREE.PlaneGeometry(160, 160, 28, 28);
    seaSurfaceGeo.rotateX(-Math.PI / 2);
    const seaSurfaceMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      roughness: 0.18,
      metalness: 0.1,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const seaSurfaceMesh = new THREE.Mesh(seaSurfaceGeo, seaSurfaceMat);
    seaSurfaceMesh.position.y = 0;
    scene.add(seaSurfaceMesh);

    // Sun ray shafts
    const sunRaysGroup = new THREE.Group();
    const rayGeo = new THREE.ConeGeometry(4.5, 32, 12, 1, true);
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let i = 0; i < 6; i++) {
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.set((i - 2.5) * 16, -14, (i % 2 === 0 ? -1 : 1) * 12);
      ray.rotation.z = -0.18;
      sunRaysGroup.add(ray);
    }
    scene.add(sunRaysGroup);

    // 6. MPA Geofence Boundary Ring (SDG 14.5)
    const mpaRingGeo = new THREE.RingGeometry(
      MPA_ZONE.radius - 0.5,
      MPA_ZONE.radius,
      64
    );
    mpaRingGeo.rotateX(-Math.PI / 2);
    const mpaRingMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const mpaSurfaceRing = new THREE.Mesh(mpaRingGeo, mpaRingMat);
    mpaSurfaceRing.position.set(MPA_ZONE.center.x, -0.4, MPA_ZONE.center.z);
    scene.add(mpaSurfaceRing);

    const mpaFloorRing = new THREE.Mesh(mpaRingGeo, mpaRingMat);
    mpaFloorRing.position.set(
      MPA_ZONE.center.x,
      seabedHeightAt(MPA_ZONE.center.x, MPA_ZONE.center.z) + 0.5,
      MPA_ZONE.center.z
    );
    scene.add(mpaFloorRing);

    // 7. Composite 10-Part Procedural ROV Model (Yellow & Black with 6 spinning thrusters)
    const rovGroup = new THREE.Group();

    const yellowFoamMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.32,
      metalness: 0.18,
    });
    const darkFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.72,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.2,
      metalness: 0.9,
    });
    const domeGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });

    // Part 1: Syntactic yellow upper buoyancy block
    const topHull = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.68, 2.5), yellowFoamMat);
    topHull.position.y = 0.35;
    rovGroup.add(topHull);

    // Part 2: Black hazard stripes & side bumpers
    const sideBumperL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 2.56), darkFrameMat);
    sideBumperL.position.set(-0.98, 0.35, 0);
    const sideBumperR = sideBumperL.clone();
    sideBumperR.position.x = 0.98;
    rovGroup.add(sideBumperL, sideBumperR);

    // Part 3: Lower open aluminum frame & electronics pod
    const lowerPod = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.0, 16), darkFrameMat);
    lowerPod.rotation.x = Math.PI / 2;
    lowerPod.position.set(0, -0.15, 0);
    rovGroup.add(lowerPod);

    // Part 4: Dual landing skids
    const skidGeo = new THREE.BoxGeometry(0.14, 0.12, 2.6);
    const skidL = new THREE.Mesh(skidGeo, chromeMat);
    skidL.position.set(-0.78, -0.62, 0);
    const skidR = new THREE.Mesh(skidGeo, chromeMat);
    skidR.position.set(0.78, -0.62, 0);
    rovGroup.add(skidL, skidR);

    // Part 5: Forward optical acrylic camera dome (-Z is forward)
    const camDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 20, 20),
      domeGlassMat
    );
    camDome.position.set(0, -0.1, -1.25);
    camDome.renderOrder = 2;
    rovGroup.add(camDome);

    // Part 6: 6 Vectored Thruster shrouds & spinning propellers
    const thrusterPropellers: THREE.Mesh[] = [];
    const shroudGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.36, 14, 1, true);
    const propBladeGeo = new THREE.BoxGeometry(0.38, 0.04, 0.09);
    const propMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.3 });

    const thrusterPositions: [number, number, number, boolean][] = [
      [-1.08, 0.0, -0.85, false],
      [1.08, 0.0, -0.85, false],
      [-1.08, 0.0, 0.85, false],
      [1.08, 0.0, 0.85, false],
      [-0.55, 0.72, 0.0, true],
      [0.55, 0.72, 0.0, true],
    ];

    for (const [tx, ty, tz, isVertical] of thrusterPositions) {
      const tUnit = new THREE.Group();
      tUnit.position.set(tx, ty, tz);
      const shroud = new THREE.Mesh(shroudGeo, darkFrameMat);
      if (!isVertical) shroud.rotation.x = Math.PI / 2;
      tUnit.add(shroud);

      const prop = new THREE.Mesh(propBladeGeo, propMat);
      if (!isVertical) prop.rotation.x = Math.PI / 2;
      tUnit.add(prop);
      thrusterPropellers.push(prop);
      rovGroup.add(tUnit);
    }

    // Part 7: Rotating 450 kHz Multi-Beam Sonar Turret on top deck
    const sonarTurret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.32, 16),
      chromeMat
    );
    sonarTurret.position.set(0, 0.84, -0.45);
    rovGroup.add(sonarTurret);

    // Part 8: Forward Articulated Robotic Manipulator Arm
    const armGroup = new THREE.Group();
    armGroup.position.set(0.45, -0.38, -1.1);
    const armSegment1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.65), chromeMat);
    armSegment1.position.z = -0.3;
    const armClaw = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 16, Math.PI * 1.3), yellowFoamMat);
    armClaw.position.z = -0.68;
    armClaw.rotation.x = Math.PI / 2;
    armGroup.add(armSegment1, armClaw);
    rovGroup.add(armGroup);

    // Part 9: Dual LED Headlights + Volumetric Light Cones
    const lightConeGroup = new THREE.Group();
    const coneGeo = new THREE.ConeGeometry(2.8, 11.5, 16, 1, true);
    coneGeo.translate(0, -5.75, 0);
    coneGeo.rotateX(-Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const leftBeam = new THREE.Mesh(coneGeo, coneMat);
    leftBeam.position.set(-0.65, 0.15, -1.25);
    const rightBeam = new THREE.Mesh(coneGeo, coneMat);
    rightBeam.position.set(0.65, 0.15, -1.25);
    lightConeGroup.add(leftBeam, rightBeam);

    const rovSpotLight = new THREE.SpotLight(0xe0f2fe, 3.2, 42, Math.PI / 4, 0.45, 1.5);
    rovSpotLight.position.set(0, 0.2, -1.2);
    rovSpotLight.target.position.set(0, -1.0, -14);
    rovGroup.add(rovSpotLight);
    rovGroup.add(rovSpotLight.target);
    rovGroup.add(lightConeGroup);

    scene.add(rovGroup);

    // Part 10: Umbilical Tether Line connecting ROV to AEGIS-01 Mothership
    const tetherPoints = Array.from({ length: 16 }, () => new THREE.Vector3());
    const tetherGeo = new THREE.BufferGeometry().setFromPoints(tetherPoints);
    const tetherMat = new THREE.LineBasicMaterial({ color: 0xfacc15 });
    const tetherLine = new THREE.Line(tetherGeo, tetherMat);
    scene.add(tetherLine);

    // 8. Surface Vessels (Composite Procedural Models) & Overhead LEO Satellite
    const vesselMeshes = new Map<string, THREE.Group>();
    for (const v of livePropsRef.current.vessels) {
      const vGroup = new THREE.Group();
      const isSuspicious = v.riskScore > 75;
      const isMothership = v.type === 'mothership';

      const hullColor = isMothership
        ? 0x0284c7
        : isSuspicious
        ? 0x991b1b
        : 0x475569;
      const hullMat = new THREE.MeshStandardMaterial({
        color: hullColor,
        roughness: 0.55,
        metalness: 0.35,
      });
      const cabinMat = new THREE.MeshStandardMaterial({
        color: isMothership ? 0xf8fafc : 0xcbd5e1,
        roughness: 0.4,
        metalness: 0.2,
      });

      const hull = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.8, 9.2), hullMat);
      hull.position.y = -0.2;
      const bow = new THREE.Mesh(new THREE.ConeGeometry(2.7, 3.4, 4), hullMat);
      bow.rotation.x = -Math.PI / 2;
      bow.rotation.z = Math.PI / 4;
      bow.position.set(0, -0.2, -6.2);

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.1, 3.2), cabinMat);
      bridge.position.set(0, 1.6, 1.2);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.8, 8), chromeMat);
      mast.position.set(0, 3.6, 1.2);

      vGroup.add(hull, bow, bridge, mast);
      vGroup.position.set(v.position.x, 0, v.position.z);
      vGroup.rotation.y = (-v.heading * Math.PI) / 180;
      scene.add(vGroup);
      vesselMeshes.set(v.id, vGroup);
    }

    // Orbiting LEO Satellite + Link Line
    const satGroup = new THREE.Group();
    const satBody = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.0, 12), chromeMat);
    satBody.rotation.z = Math.PI / 2;
    const panelGeo = new THREE.BoxGeometry(5.5, 0.08, 1.4);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.8,
      roughness: 0.2,
    });
    const solarPanels = new THREE.Mesh(panelGeo, panelMat);
    satGroup.add(satBody, solarPanels);
    satGroup.position.set(0, 26, -20);
    scene.add(satGroup);

    const satLinkGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 26, -20),
      new THREE.Vector3(0, 0, 0),
    ]);
    const satLinkMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
    });
    const satLinkLine = new THREE.Line(satLinkGeo, satLinkMat);
    scene.add(satLinkLine);

    // 9. Underwater Entities (Ghost Net, Shipwreck, Pipeline, Plastic, Marine Life, Coral Reef)
    const entityMeshes = new Map<string, THREE.Group>();

    for (const ent of livePropsRef.current.entities) {
      const eGroup = new THREE.Group();
      eGroup.position.set(ent.position.x, ent.position.y, ent.position.z);

      if (ent.id === 'ent-ghost-net-01') {
        // Ghost gillnet draped across coral pinnacle + entangled turtle
        const netMat = new THREE.MeshStandardMaterial({
          color: 0xf97316,
          wireframe: true,
          roughness: 0.6,
        });
        const netMesh = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 5.5, 16, 6, true), netMat);
        const floatRing = new THREE.Mesh(
          new THREE.TorusGeometry(3.4, 0.18, 8, 24),
          yellowFoamMat
        );
        floatRing.rotation.x = Math.PI / 2;
        floatRing.position.y = 2.6;
        eGroup.add(netMesh, floatRing);
      } else if (ent.id === 'ent-trawl-scar-01') {
        const scarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 });
        const scar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 16), scarMat);
        const otterDoor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 0.3), chromeMat);
        otterDoor.position.set(0, 0.9, -6);
        eGroup.add(scar, otterDoor);
      } else if (ent.category === 'pollution') {
        // Plastic drums, debris, or oil plume source
        const drumMat = new THREE.MeshStandardMaterial({
          color: ent.id === 'ent-oil-plume' ? 0xa855f7 : 0xf59e0b,
          roughness: 0.4,
          metalness: 0.3,
        });
        for (let k = 0; k < 5; k++) {
          const item = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.45, 1.2, 10),
            drumMat
          );
          item.position.set(
            Math.cos(k * 1.3) * 2.2,
            Math.sin(k) * 0.8,
            Math.sin(k * 1.3) * 2.2
          );
          item.rotation.set(k * 0.4, k * 0.8, 0.3);
          eGroup.add(item);
        }
      } else if (ent.category === 'marine_life') {
        // Sea Turtle, Reef Shark, Dolphin Pod, Eagle Ray, Seahorse
        const bioMat = new THREE.MeshStandardMaterial({
          color:
            ent.id === 'ent-sea-turtle'
              ? 0x10b981
              : ent.id === 'ent-reef-shark'
              ? 0x64748b
              : 0x38bdf8,
          roughness: 0.35,
          metalness: 0.15,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.65, 1.8, 6, 12), bioMat);
        body.rotation.x = Math.PI / 2;
        const fin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.7), bioMat);
        eGroup.add(body, fin);
      } else if (ent.id === 'ent-shipwreck') {
        const rustMat = new THREE.MeshStandardMaterial({
          color: 0x7c2d12,
          roughness: 0.85,
          metalness: 0.45,
        });
        const wreckHull = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.6, 14), rustMat);
        wreckHull.rotation.z = 0.28;
        const smokestack = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 4.2, 12), rustMat);
        smokestack.position.set(0.5, 2.8, -1.5);
        smokestack.rotation.z = 0.28;
        eGroup.add(wreckHull, smokestack);
      } else if (ent.id === 'ent-pipeline-manifold') {
        const pipeMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          roughness: 0.4,
          metalness: 0.7,
        });
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 36, 16), pipeMat);
        pipe.rotation.z = Math.PI / 2;
        const manifold = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.8), darkFrameMat);
        manifold.position.y = 1.1;
        eGroup.add(pipe, manifold);
      } else {
        // Metallic Seabed Anomaly / Coral / Trap lines
        const anomMat = new THREE.MeshStandardMaterial({
          color: 0x06b6d4,
          roughness: 0.25,
          metalness: 0.85,
        });
        const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), anomMat);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.15, 8, 24), yellowFoamMat);
        ring.rotation.x = Math.PI / 2;
        eGroup.add(sphere, ring);
      }

      scene.add(eGroup);
      entityMeshes.set(ent.id, eGroup);
    }

    // 10. InstancedMesh Boids Fish Shoal (75 fish) + Coral Heads (40)
    const fishCount = 75;
    const fishGeo = new THREE.ConeGeometry(0.22, 0.75, 6);
    fishGeo.rotateX(Math.PI / 2);
    const fishMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.3,
      metalness: 0.4,
    });
    const fishInstanced = new THREE.InstancedMesh(fishGeo, fishMat, fishCount);
    fishInstanced.frustumCulled = false;
    scene.add(fishInstanced);

    // Coral Reef Instanced Pillars inside MPA
    const coralCount = 45;
    const coralGeo = new THREE.DodecahedronGeometry(1.35, 1);
    const coralMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.75,
      metalness: 0.05,
    });
    const coralInstanced = new THREE.InstancedMesh(coralGeo, coralMat, coralCount);
    const coralColors = [0xf43f5e, 0xf97316, 0xa855f7, 0x10b981, 0x06b6d4];
    for (let i = 0; i < coralCount; i++) {
      const angle = (i / coralCount) * Math.PI * 2 * 3.7;
      const rad = 4 + (i % 7) * 4.5;
      const cx = MPA_ZONE.center.x + Math.cos(angle) * rad;
      const cz = MPA_ZONE.center.z + Math.sin(angle) * rad;
      const cy = seabedHeightAt(cx, cz) + 0.9;
      _dummyObj.position.set(cx, cy, cz);
      const s = 0.7 + (i % 5) * 0.25;
      _dummyObj.scale.set(s, s * 1.2, s);
      _dummyObj.rotation.set(0, i * 0.8, 0);
      _dummyObj.updateMatrix();
      coralInstanced.setMatrixAt(i, _dummyObj.matrix);
      coralInstanced.setColorAt(i, new THREE.Color(coralColors[i % coralColors.length]));
    }
    coralInstanced.instanceMatrix.needsUpdate = true;
    if (coralInstanced.instanceColor) coralInstanced.instanceColor.needsUpdate = true;
    coralInstanced.computeBoundingSphere();
    scene.add(coralInstanced);

    // Marine Snow & Oil Plume Particles
    const snowCount = 260;
    const snowPositions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPositions[i * 3] = ((i * 37) % 110) - 55;
      snowPositions[i * 3 + 1] = -((i * 19) % 42) - 1;
      snowPositions[i * 3 + 2] = ((i * 53) % 110) - 55;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.28,
      transparent: true,
      opacity: 0.55,
    });
    const snowPoints = new THREE.Points(snowGeo, snowMat);
    scene.add(snowPoints);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 11. Animation Loop with Software-WebGL Pacing (afterDraw)
    const clock = new THREE.Clock();
    let frameId = 0;
    let unmounted = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (unmounted) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (unmounted) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const props = livePropsRef.current;
      const tel = props.telemetry;

      // Update Day/Night lighting
      const dayFactor = Math.max(
        0.15,
        Math.sin(((props.timeOfDay - 5) / 14) * Math.PI)
      );
      sunLight.intensity = 1.8 * dayFactor;
      hemiLight.intensity = 0.45 + 0.75 * dayFactor;
      sunRaysGroup.visible = dayFactor > 0.35;

      // Update ROV transform
      rovGroup.position.set(tel.position.x, tel.position.y, tel.position.z);
      const headingRad = (-tel.heading * Math.PI) / 180;
      rovGroup.rotation.set(
        THREE.MathUtils.degToRad(tel.pitch),
        headingRad,
        THREE.MathUtils.degToRad(tel.roll),
        'YXZ'
      );

      // Spin ROV thruster propellers & sonar turret
      const spinSpeed = 8 + (tel.thrusterPowerPct / 100) * 28;
      for (const prop of thrusterPropellers) {
        prop.rotation.y += dt * spinSpeed;
      }
      sonarTurret.rotation.y += dt * (props.sonarActive ? 4.5 : 0.5);
      lightConeGroup.visible = props.lightsOn;
      rovSpotLight.intensity = props.lightsOn ? 3.2 : 0;

      // Update Umbilical Tether Catenary Curve from Mothership (0,0,0) to ROV
      const motherPos = props.vessels[0]?.position ?? { x: 0, y: 0, z: 0 };
      const tetherPosAttr = tetherGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 16; i++) {
        const u = i / 15;
        const tx = THREE.MathUtils.lerp(motherPos.x, tel.position.x, u);
        const tz = THREE.MathUtils.lerp(motherPos.z, tel.position.z, u);
        const sag = Math.sin(u * Math.PI) * -3.2;
        const ty = THREE.MathUtils.lerp(motherPos.y - 0.5, tel.position.y + 0.5, u) + sag;
        tetherPosAttr.setXYZ(i, tx, ty, tz);
      }
      tetherPosAttr.needsUpdate = true;

      // Orbit LEO Satellite & update Satellite Link Line
      const satX = Math.cos(elapsed * 0.22) * 32;
      const satZ = Math.sin(elapsed * 0.22) * 28 - 10;
      satGroup.position.set(satX, 26, satZ);
      satGroup.lookAt(motherPos.x, 0, motherPos.z);
      const satLinkAttr = satLinkGeo.attributes.position as THREE.BufferAttribute;
      satLinkAttr.setXYZ(0, satX, 26, satZ);
      satLinkAttr.setXYZ(1, motherPos.x, 2.5, motherPos.z);
      satLinkAttr.needsUpdate = true;
      satLinkMat.color.setHex(props.commsOutage ? 0xef4444 : 0x38bdf8);

      // Animate Boids Fish Shoal in a graceful vortex around MPA reef
      for (let i = 0; i < fishCount; i++) {
        const angle = elapsed * 0.55 + i * 0.32;
        const radius = 9 + (i % 6) * 2.8;
        const fx = MPA_ZONE.center.x + Math.cos(angle) * radius;
        const fz = MPA_ZONE.center.z + Math.sin(angle) * radius;
        const fy = -12 - (i % 8) * 1.4 + Math.sin(elapsed * 2 + i) * 0.6;
        _dummyObj.position.set(fx, fy, fz);
        _dummyObj.rotation.set(0, -angle + Math.PI, 0);
        _dummyObj.scale.setScalar(0.85 + (i % 3) * 0.2);
        _dummyObj.updateMatrix();
        fishInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      fishInstanced.instanceMatrix.needsUpdate = true;

      // Camera positioning by CameraViewMode
      const fwdX = Math.sin((tel.heading * Math.PI) / 180);
      const fwdZ = -Math.cos((tel.heading * Math.PI) / 180);

      if (props.cameraMode === CameraViewMode.FIRST_PERSON) {
        camera.position.set(
          tel.position.x + fwdX * 1.4,
          tel.position.y + 0.1,
          tel.position.z + fwdZ * 1.4
        );
        camera.lookAt(
          tel.position.x + fwdX * 18,
          tel.position.y - 0.8,
          tel.position.z + fwdZ * 18
        );
      } else if (props.cameraMode === CameraViewMode.CHASE) {
        _vec3A.set(
          tel.position.x - fwdX * 7.5,
          tel.position.y + 2.8,
          tel.position.z - fwdZ * 7.5
        );
        camera.position.lerp(_vec3A, 1 - Math.exp(-8 * dt));
        _vec3B.set(
          tel.position.x + fwdX * 8,
          tel.position.y - 0.4,
          tel.position.z + fwdZ * 8
        );
        camera.lookAt(_vec3B);
      } else if (props.cameraMode === CameraViewMode.ORBIT) {
        const r = 13.5;
        const yaw = props.orbitYawOffset + elapsed * 0.12;
        const pitch = props.orbitPitchOffset;
        camera.position.set(
          tel.position.x + Math.cos(yaw) * Math.cos(pitch) * r,
          tel.position.y + Math.sin(pitch) * r,
          tel.position.z + Math.sin(yaw) * Math.cos(pitch) * r
        );
        camera.lookAt(tel.position.x, tel.position.y, tel.position.z);
      } else if (
        props.cameraMode === CameraViewMode.TOP_DOWN ||
        props.cameraMode === CameraViewMode.SONAR
      ) {
        camera.position.set(tel.position.x, tel.position.y + 38, tel.position.z + 0.01);
        camera.lookAt(tel.position.x, tel.position.y, tel.position.z);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 540;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Filter detections with visible bounding boxes for YOLOv8 HUD overlay
  const visibleBboxDetections = detections.filter((d) => d.bbox);

  const nudgeManual = (patch: Partial<ManualInputState>) => {
    manualInputRef.current = { ...manualInputRef.current, ...patch };
    setTimeout(() => {
      manualInputRef.current = { forward: 0, strafe: 0, vertical: 0, yaw: 0 };
    }, 320);
  };

  return (
    <div
      className="relative w-full h-full min-h-[380px] bg-[#040f21] overflow-hidden select-none border border-cyan-900/50 rounded-lg"
      data-testid="ocean-viewport-3d"
    >
      {/* Dedicated Empty WebGL Canvas Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#040f21] text-cyan-200 p-6 text-center z-30">
          <p>{webglError}</p>
        </div>
      )}

      {/* Simulated YOLOv8 Optical Detection Bounding Boxes Overlay */}
      {showYoloOverlays &&
        visibleBboxDetections.slice(0, 3).map((det) => {
          if (!det.bbox) return null;
          const isThreat =
            det.category === 'vessel' ||
            det.category === 'illegal_gear' ||
            det.category === 'pollution';
          const borderColor = isThreat
            ? 'border-red-500/90 text-red-200'
            : det.category === 'marine_life'
            ? 'border-emerald-400/90 text-emerald-200'
            : 'border-amber-400/90 text-amber-200';
          const headerBg = isThreat
            ? 'bg-red-950/90'
            : det.category === 'marine_life'
            ? 'bg-emerald-950/90'
            : 'bg-amber-950/90';

          return (
            <button
              key={det.id}
              type="button"
              onClick={() => onSelectEntity?.(det.entityId)}
              style={{
                left: `${det.bbox.x * 100}%`,
                top: `${det.bbox.y * 100}%`,
                width: `${det.bbox.w * 100}%`,
                height: `${det.bbox.h * 100}%`,
              }}
              aria-label={`Inspect ${det.classLabel} (${det.fusedConfidence}%)`}
              className={`absolute z-10 border-2 ${borderColor} rounded-sm text-left transition-transform hover:scale-[1.02] cursor-pointer pointer-events-auto`}
            >
              <div
                className={`${headerBg} px-1.5 py-0.5 text-[11px] font-mono leading-tight whitespace-nowrap truncate`}
              >
                {det.id} · {det.classLabel} · {det.fusedConfidence.toFixed(1)}%
              </div>
              <div className="absolute bottom-0.5 right-1 text-[10px] font-mono bg-[#040d1a]/85 px-1 rounded">
                {det.distanceKmDisplay}
              </div>
            </button>
          );
        })}

      {/* HUD OVERLAY (Pointer-Events None wrapper, no backdrop-filter over WebGL) */}
      <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3">
        {/* Top HUD Strip: Compass, Recording, Telemetry Readout, Safety Banner */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Left: REC + Camera Mode + Coordinates */}
            <div className="flex items-center gap-3 bg-[#051329]/90 border border-cyan-800/60 px-3 py-1.5 rounded text-xs font-mono">
              <span className="text-red-400 font-semibold">REC ● SIM-YOLOv8</span>
              <span className="text-slate-500">·</span>
              <span className="text-cyan-300">
                HDG {String(telemetry.heading).padStart(3, '0')}°
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-amber-300">DEPTH {telemetry.depth.toFixed(1)}m</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 hidden sm:inline">
                GPS {telemetry.gps.lat.toFixed(4)}°N, {telemetry.gps.lon.toFixed(4)}°E
              </span>
            </div>

            {/* Right: Battery, Pressure, MPA Geofence & Comms Status */}
            <div className="flex items-center gap-2.5 bg-[#051329]/90 border border-cyan-800/60 px-3 py-1.5 rounded text-xs font-mono">
              <span
                className={
                  telemetry.inMpaZone ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                }
              >
                {telemetry.inMpaZone ? 'MPA SANCTUARY [INSIDE]' : 'OPEN SECTOR'}
              </span>
              <span className="text-slate-500">·</span>
              <span
                className={
                  telemetry.batteryPct < 25 ? 'text-red-400 font-bold' : 'text-emerald-300'
                }
              >
                BAT {telemetry.batteryPct.toFixed(0)}%
              </span>
              <span className="text-slate-500">·</span>
              <span
                className={
                  telemetry.commsOutage ? 'text-red-400 font-bold' : 'text-cyan-300'
                }
              >
                {telemetry.commsOutage
                  ? 'SAT LINK: OUTAGE (BUFFERING)'
                  : `SAT LINK: ${telemetry.commsLinkQualityPct}%`}
              </span>
            </div>
          </div>

          {/* Safety Backtracking / Proximity Hazard Alert Banner */}
          {(telemetry.nearHazard || telemetry.backtrackingActive) && (
            <div className="bg-red-950/95 border border-red-500 px-3 py-1.5 rounded text-xs font-mono text-red-100 flex items-center justify-between">
              <span>
                {telemetry.backtrackingActive
                  ? 'SAFETY OVERRIDE: Stack/DFS Obstacle Backtracking Active — Reversing along safe breadcrumbs'
                  : telemetry.hazardWarningText}
              </span>
              <span className="text-amber-300 font-semibold">AUTO-SLOW</span>
            </div>
          )}
        </div>

        {/* Center Crosshair & Artificial Horizon Pitch/Roll Ladder */}
        <div className="relative self-center my-auto w-28 h-28 flex items-center justify-center opacity-65">
          <svg viewBox="0 0 100 100" className="w-full h-full stroke-cyan-400 fill-none">
            <circle cx="50" cy="50" r="26" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="18" y1="50" x2="38" y2="50" strokeWidth="1.5" />
            <line x1="62" y1="50" x2="82" y2="50" strokeWidth="1.5" />
            <line x1="50" y1="26" x2="50" y2="38" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="2" className="fill-yellow-400" />
          </svg>
        </div>

        {/* Bottom Collapsible Control Dock (Camera Modes, Flight Modes, Manual Pad & Toggles) */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 bg-[#051329]/95 border border-cyan-800/70 p-2 rounded-lg">
          {/* Camera View Selector */}
          <div className="flex items-center gap-1">
            {(
              [
                [CameraViewMode.CHASE, '3rd-Person Chase'],
                [CameraViewMode.FIRST_PERSON, 'ROV Nose Cam'],
                [CameraViewMode.ORBIT, 'Free Orbit'],
                [CameraViewMode.TOP_DOWN, 'Top-Down'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => onSelectCameraMode(mode)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  cameraMode === mode
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'bg-[#091e3a] text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
            {cameraMode === CameraViewMode.ORBIT && (
              <button
                type="button"
                onClick={() => {
                  setOrbitYawOffset((v) => v + 0.6);
                  setOrbitPitchOffset((p) => (p > 0.6 ? 0.2 : p + 0.15));
                }}
                className="px-2 py-1 text-xs bg-[#091e3a] text-cyan-300 rounded hover:bg-cyan-900/50 whitespace-nowrap shrink-0"
              >
                Rotate Orbit
              </button>
            )}
          </div>

          {/* ROV Control Mode Selector */}
          <div className="flex items-center gap-1">
            {(
              [
                [ControlMode.MANUAL, 'Manual (WASD)'],
                [ControlMode.PATROL, 'Auto Patrol'],
                [ControlMode.SURVEY, 'Lawnmower Survey'],
                [ControlMode.FOLLOW, 'Follow Target'],
                [ControlMode.RTB, 'Return to Base'],
              ] as const
            ).map(([cMode, label]) => (
              <button
                key={cMode}
                type="button"
                onClick={() => onSelectControlMode(cMode)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  controlMode === cMode
                    ? 'bg-yellow-400 text-slate-950 font-semibold'
                    : 'bg-[#091e3a] text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* On-Screen Thruster Nudge Pad + Sensor Toggles */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-[#091e3a] px-1.5 py-0.5 rounded border border-cyan-900/60">
              <button
                type="button"
                aria-label="Thrust Forward"
                onClick={() => nudgeManual({ forward: 1 })}
                className="px-2 py-0.5 text-xs font-mono text-cyan-200 hover:bg-cyan-800/50 rounded"
              >
                W▲
              </button>
              <button
                type="button"
                aria-label="Thrust Reverse"
                onClick={() => nudgeManual({ forward: -1 })}
                className="px-2 py-0.5 text-xs font-mono text-cyan-200 hover:bg-cyan-800/50 rounded"
              >
                S▼
              </button>
              <button
                type="button"
                aria-label="Yaw Left"
                onClick={() => nudgeManual({ yaw: -1 })}
                className="px-2 py-0.5 text-xs font-mono text-cyan-200 hover:bg-cyan-800/50 rounded"
              >
                A◄
              </button>
              <button
                type="button"
                aria-label="Yaw Right"
                onClick={() => nudgeManual({ yaw: 1 })}
                className="px-2 py-0.5 text-xs font-mono text-cyan-200 hover:bg-cyan-800/50 rounded"
              >
                D►
              </button>
              <button
                type="button"
                aria-label="Dive Deeper"
                onClick={() => nudgeManual({ vertical: -1 })}
                className="px-2 py-0.5 text-xs font-mono text-amber-300 hover:bg-cyan-800/50 rounded"
              >
                E-Dive
              </button>
              <button
                type="button"
                aria-label="Ascend Up"
                onClick={() => nudgeManual({ vertical: 1 })}
                className="px-2 py-0.5 text-xs font-mono text-emerald-300 hover:bg-cyan-800/50 rounded"
              >
                Q-Up
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleYoloOverlays}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
                showYoloOverlays
                  ? 'bg-cyan-900/80 text-cyan-200 border border-cyan-500/50'
                  : 'bg-[#091e3a] text-slate-400'
              }`}
            >
              YOLO Boxes: {showYoloOverlays ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={onToggleLights}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
                lightsOn
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
                  : 'bg-[#091e3a] text-slate-400'
              }`}
            >
              Lights: {lightsOn ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={onToggleSonar}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
                sonarActive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                  : 'bg-[#091e3a] text-slate-400'
              }`}
            >
              Sonar: {sonarActive ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={onEmergencySurface}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0"
            >
              Emergency Surface
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
