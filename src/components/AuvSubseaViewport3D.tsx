import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BreadcrumbNode,
  LiveOscillatedVessel,
  SubseaVisionMode,
} from '../data/aegisFleet20';

interface AuvSubseaViewport3DProps {
  vessel: LiveOscillatedVessel;
  visionMode: SubseaVisionMode;
  onSelectVisionMode: (mode: SubseaVisionMode) => void;
  auvPos: { x: number; y: number; z: number; heading: number; depth: number };
  onMoveAuv: (dx: number, dy: number, dz: number, dHeading: number) => void;
  breadcrumbs: BreadcrumbNode[];
  isBacktracking: boolean;
  onTriggerBacktrack: () => void;
  onCaptureEvidence: (anomalyId?: string) => void;
  onTriggerSonarPing: () => void;
  sonarPingCount: number;
  signalBlackout: boolean;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();

export const AuvSubseaViewport3D: React.FC<AuvSubseaViewport3DProps> = ({
  vessel,
  visionMode,
  onSelectVisionMode,
  auvPos,
  onMoveAuv,
  breadcrumbs,
  isBacktracking,
  onTriggerBacktrack,
  onCaptureEvidence,
  onTriggerSonarPing,
  sonarPingCount,
  signalBlackout,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [cameraAngle, setCameraAngle] = useState<'CHASE' | 'HULL_INSPECT' | 'KEEL_UP' | 'ORBIT'>('CHASE');

  const latestPropsRef = useRef({
    vessel,
    visionMode,
    auvPos,
    breadcrumbs,
    isBacktracking,
    sonarPingCount,
    signalBlackout,
    cameraAngle,
  });

  useEffect(() => {
    latestPropsRef.current = {
      vessel,
      visionMode,
      auvPos,
      breadcrumbs,
      isBacktracking,
      sonarPingCount,
      signalBlackout,
      cameraAngle,
    };
  }, [
    vessel,
    visionMode,
    auvPos,
    breadcrumbs,
    isBacktracking,
    sonarPingCount,
    signalBlackout,
    cameraAngle,
  ]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(container.clientWidth, 640);
    const height = Math.max(container.clientHeight, 420);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x031124);
    scene.fog = new THREE.FogExp2(0x031124, 0.014);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.2, 260);
    camera.position.set(-18, -10, 22);
    camera.lookAt(0, -6, 0);

    // 3-Point Underwater Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x020814, 1.15);
    scene.add(hemiLight);

    const sunKeyLight = new THREE.DirectionalLight(0xe0f2fe, 1.5);
    sunKeyLight.position.set(25, 45, 20);
    scene.add(sunKeyLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 0.85);
    rimLight.position.set(-30, -25, -20);
    scene.add(rimLight);

    // Water Surface Plane (Y = 0)
    const surfaceGeo = new THREE.PlaneGeometry(240, 240, 24, 24);
    surfaceGeo.rotateX(-Math.PI / 2);
    const surfaceMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.32,
      wireframe: false,
      side: THREE.DoubleSide,
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfaceMesh.position.y = 0;
    scene.add(surfaceMesh);

    // Seabed / Seamount Bathymetry Floor (Y = -28)
    const seabedGeo = new THREE.PlaneGeometry(240, 240, 32, 32);
    seabedGeo.rotateX(-Math.PI / 2);
    const sbPos = seabedGeo.attributes.position;
    for (let i = 0; i < sbPos.count; i++) {
      const x = sbPos.getX(i);
      const z = sbPos.getZ(i);
      const bump =
        Math.sin(x * 0.08) * Math.cos(z * 0.08) * 2.2 +
        Math.sin(x * 0.22 + z * 0.15) * 0.6;
      sbPos.setY(i, bump);
    }
    seabedGeo.computeVertexNormals();
    const seabedMat = new THREE.MeshStandardMaterial({
      color: 0x0b2239,
      roughness: 0.9,
      metalness: 0.1,
    });
    const seabedMesh = new THREE.Mesh(seabedGeo, seabedMat);
    seabedMesh.position.y = -26;
    scene.add(seabedMesh);

    // ================= TARGET VESSEL SUBMERGED HULL GROUP =================
    const shipGroup = new THREE.Group();
    scene.add(shipGroup);

    // 1. Primary Submerged Hull Body
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      roughness: 0.65,
      metalness: 0.35,
    });
    const hullGeo = new THREE.BoxGeometry(28, 6, 7.2);
    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.position.set(0, -3, 0);
    shipGroup.add(hullMesh);

    // 2. Bulbous Bow & Tapered Stern
    const bowGeo = new THREE.ConeGeometry(3.6, 7, 16);
    bowGeo.rotateZ(-Math.PI / 2);
    const bowMesh = new THREE.Mesh(bowGeo, hullMat);
    bowMesh.position.set(17.5, -3.2, 0);
    shipGroup.add(bowMesh);

    const bulbGeo = new THREE.SphereGeometry(1.7, 16, 12);
    bulbGeo.scale(1.8, 0.85, 0.9);
    const bulbMesh = new THREE.Mesh(bulbGeo, hullMat);
    bulbMesh.position.set(19.2, -5.0, 0);
    shipGroup.add(bulbMesh);

    // 3. Upper Freeboard & Bridge Deck (above waterline)
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.45,
    });
    const deckMesh = new THREE.Mesh(
      new THREE.BoxGeometry(26, 2.6, 6.8),
      deckMat
    );
    deckMesh.position.set(-1, 1.3, 0);
    shipGroup.add(deckMesh);

    // 4. Rudder & Spinning Twin Bronze Propellers
    const rudderMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.6,
      metalness: 0.5,
    });
    const rudderMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 3.6, 0.35),
      rudderMat
    );
    rudderMesh.position.set(-15.2, -4.2, 0);
    shipGroup.add(rudderMesh);

    const propMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.85,
      emissive: 0x78350f,
      emissiveIntensity: 0.25,
    });
    const propGroup = new THREE.Group();
    propGroup.position.set(-14.2, -4.4, 0);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 1.2, 12),
      propMat
    );
    hub.rotation.z = Math.PI / 2;
    propGroup.add(hub);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 1.9, 0.55),
        propMat
      );
      blade.rotation.x = (b * Math.PI) / 2;
      propGroup.add(blade);
    }
    shipGroup.add(propGroup);

    // 5. Laser Draft & Plimsoll Profiler Grid Overlay on Hull
    const laserGridGroup = new THREE.Group();
    const laserMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.9,
    });
    for (let d = 1; d <= 12; d++) {
      const pts = [
        new THREE.Vector3(-14, -d * 0.7, 3.75),
        new THREE.Vector3(14, -d * 0.7, 3.75),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(lineGeo, laserMat);
      laserGridGroup.add(line);
    }
    // Red overloaded Plimsoll anomaly band
    const plimsollBandMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const plimsollBand = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 0.9),
      plimsollBandMat
    );
    plimsollBand.position.set(0, -4.8, 3.72);
    laserGridGroup.add(plimsollBand);
    shipGroup.add(laserGridGroup);

    // ================= VESSEL-SPECIFIC ANOMALY RIGS =================
    // A. Squid Jigging / Fine-Mesh Net Curtain (V-001, V-004, V-005)
    const netRigGroup = new THREE.Group();
    const netMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const netCurtain = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 16, 18, 14),
      netMat
    );
    netCurtain.position.set(-4, -14, 0);
    netRigGroup.add(netCurtain);

    // Otter boards / trawl doors (V-004, V-005)
    const otterMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.4,
      metalness: 0.7,
    });
    const otterLeft = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 1.8, 0.3),
      otterMat
    );
    otterLeft.position.set(-12, -16, 3.5);
    const otterRight = otterLeft.clone();
    otterRight.position.set(-12, -16, -3.5);
    netRigGroup.add(otterLeft, otterRight);
    scene.add(netRigGroup);

    // B. Rafted Second Hull & Fenders + Bilge Plume (V-002)
    const raftedGroup = new THREE.Group();
    const catcherHull = new THREE.Mesh(
      new THREE.BoxGeometry(18, 4.2, 4.6),
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.7,
        metalness: 0.3,
      })
    );
    catcherHull.position.set(0, -2.2, -6.8);
    raftedGroup.add(catcherHull);

    const plumeMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.42,
      wireframe: false,
    });
    const bilgePlume = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 11, 14),
      plumeMat
    );
    bilgePlume.position.set(-2, -10.5, -3.2);
    bilgePlume.rotation.z = 0.25;
    raftedGroup.add(bilgePlume);
    scene.add(raftedGroup);

    // C. 80-Mile Pelagic Longline Curtain & J-Hooks (V-003, V-007)
    const longlineGroup = new THREE.Group();
    const hookMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
    });
    for (let h = -14; h <= 14; h += 2.8) {
      const dropLine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 13, 6),
        hookMat
      );
      dropLine.position.set(h, -12, -2.5);
      longlineGroup.add(dropLine);

      const hookTorus = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.09, 8, 12, Math.PI * 1.3),
        hookMat
      );
      hookTorus.position.set(h, -18.5, -2.5);
      longlineGroup.add(hookTorus);
    }
    scene.add(longlineGroup);

    // D. Nocturnal 800kW Halogen Light Cone / Multibeam Swath Cone (V-006, V-016)
    const lightConeGroup = new THREE.Group();
    const lightConeMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const lightConeMesh = new THREE.Mesh(
      new THREE.ConeGeometry(11, 22, 24, 1, true),
      lightConeMat
    );
    lightConeMesh.position.set(0, -14, 0);
    lightConeGroup.add(lightConeMesh);
    scene.add(lightConeGroup);

    // E. Subsea Fiber-Optic Cable & Friendly Maintenance ROV (V-018)
    const cableGroup = new THREE.Group();
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-40, -24.5, -8),
      new THREE.Vector3(-10, -24.2, -2),
      new THREE.Vector3(15, -24.0, 4),
      new THREE.Vector3(45, -24.6, 8),
    ]);
    const cableMesh = new THREE.Mesh(
      new THREE.TubeGeometry(cableCurve, 32, 0.35, 8, false),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x0891b2,
        emissiveIntensity: 0.5,
      })
    );
    cableGroup.add(cableMesh);
    scene.add(cableGroup);

    // ================= MARINE MEGAFAUNA (SHARKS / TURTLES / WHALES) =================
    const megafaunaGroup = new THREE.Group();
    const sharkMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0x0f172a,
    });
    for (let s = 0; s < 3; s++) {
      const shark = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 3.4, 12),
        sharkMat
      );
      body.rotation.z = -Math.PI / 2;
      const cephalofoil = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.18, 1.5),
        sharkMat
      );
      cephalofoil.position.set(1.6, 0, 0);
      const dorsal = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 0.95, 6),
        sharkMat
      );
      dorsal.position.set(-0.2, 0.65, 0);
      shark.add(body, cephalofoil, dorsal);
      shark.position.set(-6 + s * 6, -11 - s * 2, 5 - s * 3);
      megafaunaGroup.add(shark);
    }
    scene.add(megafaunaGroup);

    // ================= AUV-09 POSEIDON-EYE INTERCEPTOR DRONE (10-PART COMPOSITE GROUP) =================
    const auvGroup = new THREE.Group();
    // 1. Torpedo Fuselage Hull (Yellow-and-Black Tactical Interceptor)
    const auvYellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.28,
      metalness: 0.35,
    });
    const auvDarkMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.65,
      metalness: 0.6,
    });
    const auvGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.78,
    });

    const mainHull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 2.8, 16),
      auvYellowMat
    );
    mainHull.rotation.z = Math.PI / 2;
    auvGroup.add(mainHull);

    // 2. Optical Forward Dome
    const noseDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.64, 16, 12),
      auvGlassMat
    );
    noseDome.position.set(1.4, 0, 0);
    auvGroup.add(noseDome);

    // 3. Tail Cone & Shrouded Propulsor
    const tailCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, 1.1, 16),
      auvDarkMat
    );
    tailCone.rotation.z = Math.PI / 2;
    tailCone.position.set(-1.95, 0, 0);
    auvGroup.add(tailCone);

    const shroud = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.08, 10, 18),
      auvDarkMat
    );
    shroud.rotation.y = Math.PI / 2;
    shroud.position.set(-2.45, 0, 0);
    auvGroup.add(shroud);

    // 4. Spinning AUV Rotor Blades
    const auvRotor = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.82, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.8, roughness: 0.2 })
    );
    auvRotor.position.set(-2.45, 0, 0);
    auvGroup.add(auvRotor);

    // 5. Hydrophone Array Fin & Dorsal Multibeam Sonar Pod
    const dorsalFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.75, 0.14),
      auvDarkMat
    );
    dorsalFin.position.set(-0.4, 0.82, 0);
    auvGroup.add(dorsalFin);

    const hydrophoneBoom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8),
      auvYellowMat
    );
    hydrophoneBoom.rotation.z = Math.PI / 2;
    hydrophoneBoom.position.set(1.6, 0.48, 0);
    auvGroup.add(hydrophoneBoom);

    // 6. Dual LED Floodlight Cones attached to AUV-09
    const beamConeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const leftBeam = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 9.5, 16, 1, true),
      beamConeMat
    );
    leftBeam.rotation.z = Math.PI / 2;
    leftBeam.position.set(6.0, 0, 0.45);
    const rightBeam = leftBeam.clone();
    rightBeam.position.set(6.0, 0, -0.45);
    auvGroup.add(leftBeam, rightBeam);

    scene.add(auvGroup);

    // ================= LIFO BREADCRUMB STACK 3D TRAIL & NODES =================
    const breadcrumbLineMat = new THREE.LineBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.9,
    });
    const breadcrumbLineGeo = new THREE.BufferGeometry();
    const maxBreadcrumbPts = 40;
    const breadcrumbPositions = new Float32Array(maxBreadcrumbPts * 3);
    breadcrumbLineGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(breadcrumbPositions, 3)
    );
    const breadcrumbLine = new THREE.Line(breadcrumbLineGeo, breadcrumbLineMat);
    scene.add(breadcrumbLine);

    // Active Sonar Ping Expanding Wave Ring
    const pingRingGeo = new THREE.RingGeometry(0.8, 1.25, 32);
    pingRingGeo.rotateX(-Math.PI / 2);
    const pingRingMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    const pingRingMesh = new THREE.Mesh(pingRingGeo, pingRingMat);
    scene.add(pingRingMesh);

    let lastPingCount = latestPropsRef.current.sonarPingCount;
    let pingWaveProgress = 0;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const {
        vessel: curVessel,
        visionMode: curVision,
        auvPos: curAuv,
        breadcrumbs: curBreadcrumbs,
        sonarPingCount: curPingCount,
        cameraAngle: curCamAngle,
      } = latestPropsRef.current;

      // 1. Scale Hull & Draft to Selected Vessel
      const lengthScale = THREE.MathUtils.clamp(curVessel.lengthMeters / 95, 0.65, 1.9);
      const draftScale = THREE.MathUtils.clamp(curVessel.liveDraftMeters / 5.5, 0.7, 1.85);
      shipGroup.scale.set(lengthScale, draftScale, Math.max(0.8, lengthScale * 0.85));

      // Rotate ship propeller proportional to liveSogKts
      propGroup.rotation.x += dt * (1.2 + curVessel.liveSogKts * 0.9);

      // Toggle vessel-specific underwater anomaly rigs
      netRigGroup.visible =
        curVessel.id === 'V-001' ||
        curVessel.id === 'V-004' ||
        curVessel.id === 'V-005';
      raftedGroup.visible = curVessel.id === 'V-002';
      longlineGroup.visible =
        curVessel.id === 'V-003' || curVessel.id === 'V-007';
      lightConeGroup.visible =
        curVessel.id === 'V-006' || curVessel.id === 'V-016';
      cableGroup.visible = curVessel.id === 'V-018';
      laserGridGroup.visible = curVision === 'LASER_DRAFT';

      // 2. Apply Vision Mode Material & Atmosphere Styling
      if (curVision === 'THERMAL') {
        scene.background = new THREE.Color(0x09021c);
        (scene.fog as THREE.FogExp2).color.setHex(0x09021c);
        hullMat.color.setHex(0xd97706);
        hullMat.emissive.setHex(0x9a3412);
        hullMat.emissiveIntensity = 0.6;
        hullMat.wireframe = false;
        seabedMat.color.setHex(0x1e1b4b);
        seabedMat.wireframe = false;
        sharkMat.color.setHex(0xf43f5e);
        sharkMat.emissive.setHex(0xe11d48);
        beamConeMat.color.setHex(0xf97316);
      } else if (curVision === 'SONAR') {
        scene.background = new THREE.Color(0x01141c);
        (scene.fog as THREE.FogExp2).color.setHex(0x01141c);
        hullMat.color.setHex(0x22d3ee);
        hullMat.emissive.setHex(0x0891b2);
        hullMat.emissiveIntensity = 0.45;
        hullMat.wireframe = true;
        seabedMat.color.setHex(0x06b6d4);
        seabedMat.wireframe = true;
        sharkMat.color.setHex(0x34d399);
        sharkMat.emissive.setHex(0x059669);
        beamConeMat.color.setHex(0x22d3ee);
      } else if (curVision === 'LASER_DRAFT') {
        scene.background = new THREE.Color(0x021712);
        (scene.fog as THREE.FogExp2).color.setHex(0x021712);
        hullMat.color.setHex(0x065f46);
        hullMat.emissive.setHex(0x047857);
        hullMat.emissiveIntensity = 0.35;
        hullMat.wireframe = false;
        seabedMat.color.setHex(0x064e3b);
        seabedMat.wireframe = false;
        sharkMat.color.setHex(0x10b981);
        sharkMat.emissive.setHex(0x047857);
        beamConeMat.color.setHex(0x10b981);
      } else {
        // Standard Optical
        scene.background = new THREE.Color(0x031124);
        (scene.fog as THREE.FogExp2).color.setHex(0x031124);
        hullMat.color.setHex(curVessel.hullColorHex);
        hullMat.emissive.setHex(0x000000);
        hullMat.emissiveIntensity = 0;
        hullMat.wireframe = false;
        seabedMat.color.setHex(0x0b2239);
        seabedMat.wireframe = false;
        sharkMat.color.setHex(0x64748b);
        sharkMat.emissive.setHex(0x0f172a);
        beamConeMat.color.setHex(0x38bdf8);
      }

      // 3. Animate Megafauna swimming around hull
      megafaunaGroup.children.forEach((shark, idx) => {
        const angle = elapsed * 0.45 + idx * 2.1;
        shark.position.x = Math.cos(angle) * (10 + idx * 3);
        shark.position.z = Math.sin(angle) * (7 + idx * 2);
        shark.rotation.y = -angle + Math.PI / 2;
      });

      // 4. Update AUV-09 Position & Orientation with Smooth Damping
      const targetY = -THREE.MathUtils.clamp(curAuv.depth * 0.25, 2.5, 23.5);
      auvGroup.position.x = THREE.MathUtils.damp(
        auvGroup.position.x,
        curAuv.x,
        6,
        dt
      );
      auvGroup.position.y = THREE.MathUtils.damp(
        auvGroup.position.y,
        targetY,
        6,
        dt
      );
      auvGroup.position.z = THREE.MathUtils.damp(
        auvGroup.position.z,
        curAuv.z,
        6,
        dt
      );
      const targetYaw = THREE.MathUtils.degToRad(-curAuv.heading + 90);
      auvGroup.rotation.y = THREE.MathUtils.damp(
        auvGroup.rotation.y,
        targetYaw,
        6,
        dt
      );
      auvRotor.rotation.x += dt * 18;

      // 5. Update LIFO Breadcrumb Stack 3D Polyline (Pre-allocated buffer)
      if (curBreadcrumbs.length > 0) {
        const posAttr = breadcrumbLineGeo.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        const count = Math.min(curBreadcrumbs.length, maxBreadcrumbPts - 1);
        for (let i = 0; i < count; i++) {
          const b = curBreadcrumbs[i];
          posAttr.setXYZ(
            i,
            b.x,
            -THREE.MathUtils.clamp(b.depth * 0.25, 2.5, 23.5),
            b.y
          );
        }
        posAttr.setXYZ(
          count,
          auvGroup.position.x,
          auvGroup.position.y,
          auvGroup.position.z
        );
        posAttr.needsUpdate = true;
        breadcrumbLineGeo.setDrawRange(0, count + 1);
      }

      // 6. Active Sonar Ping Ring Wave
      if (curPingCount !== lastPingCount) {
        lastPingCount = curPingCount;
        pingWaveProgress = 0.01;
        pingRingMesh.position.copy(auvGroup.position);
      }
      if (pingWaveProgress > 0) {
        pingWaveProgress += dt * 1.4;
        const s = 1 + pingWaveProgress * 18;
        pingRingMesh.scale.set(s, 1, s);
        pingRingMat.opacity = Math.max(0, 1 - pingWaveProgress);
        if (pingWaveProgress >= 1) pingWaveProgress = 0;
      }

      // 7. Camera Choreography
      if (curCamAngle === 'HULL_INSPECT') {
        _vec3A.set(0, -curVessel.liveDraftMeters * 0.85 - 2, 18);
        _vec3B.set(0, -curVessel.liveDraftMeters * 0.6, 0);
      } else if (curCamAngle === 'KEEL_UP') {
        _vec3A.set(auvGroup.position.x - 4, auvGroup.position.y - 6, auvGroup.position.z + 8);
        _vec3B.set(0, -3, 0);
      } else if (curCamAngle === 'ORBIT') {
        const orb = elapsed * 0.25;
        _vec3A.set(Math.cos(orb) * 28, -11, Math.sin(orb) * 24);
        _vec3B.set(0, -6, 0);
      } else {
        // CHASE Cam behind AUV-09 looking toward vessel hull
        _vec3A.set(
          auvGroup.position.x - 11,
          auvGroup.position.y + 3.2,
          auvGroup.position.z + 11
        );
        _vec3B.set(0, -5.5, 0);
      }
      camera.position.lerp(_vec3A, 1 - Math.exp(-5 * dt));
      camera.lookAt(_vec3B);

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 320);
      const h = Math.max(container.clientHeight, 340);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.dispose();
    };
  }, []);

  const visionModes: { id: SubseaVisionMode; label: string; short: string }[] = [
    { id: 'OPTICAL', label: '1. Subsea Optical LED', short: 'Optical' },
    { id: 'THERMAL', label: '2. FLIR Thermal Hull/Discharge', short: 'FLIR Thermal' },
    { id: 'SONAR', label: '3. Multibeam Sonar Wireframe', short: 'Sonar 3D' },
    { id: 'LASER_DRAFT', label: '4. Laser Draft & Plimsoll Profiler', short: 'Laser Draft' },
  ];

  return (
    <div className="relative w-full h-[460px] lg:h-[520px] rounded-lg overflow-hidden border border-cyan-800/80 bg-[#020c1b] select-none">
      {/* Dedicated WebGL Mount Container */}
      <div
        ref={canvasMountRef}
        data-testid="auv-subsea-canvas"
        className="w-full h-full cursor-crosshair"
      />

      {/* TOP TELEMETRY & VISION MODE HEADER STRIP (Non-overlapping) */}
      <div className="absolute top-2 left-2 right-2 bg-[#041126]/95 border border-cyan-700/70 rounded-md px-2.5 py-1.5 flex flex-col gap-1.5 z-10 pointer-events-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-yellow-300">AUV-09</span>
            <span className="text-slate-400">·</span>
            <span className="text-cyan-300 font-semibold truncate">
              {vessel.id} "{vessel.codename}" ({vessel.vesselName})
            </span>
          </div>
          <span className="text-[11px] text-amber-300 shrink-0">
            Hull {vessel.lengthMeters}m · Draft {vessel.liveDraftMeters}m (
            {vessel.draftDeltaMeters > 0
              ? `+${vessel.draftDeltaMeters}m OVER`
              : 'Nominal'}
            )
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            {visionModes.map((vm) => (
              <button
                key={vm.id}
                type="button"
                onClick={() => onSelectVisionMode(vm.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  visionMode === vm.id
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-[#081d38] text-slate-200 hover:bg-cyan-900/60'
                }`}
              >
                {vm.short}
              </button>
            ))}
          </div>

          <span className="text-[10px] font-mono text-emerald-300 truncate max-w-[230px]">
            {vessel.liveCavitationHz}Hz · {vessel.liveSonarPingDb}dB ·{' '}
            {vessel.dsaAlgorithm.split('—')[0]}
          </span>
        </div>
      </div>

      {/* COLLAPSIBLE BOTTOM CONTROL DOCK (Zero Viewport Occlusion) */}
      <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-auto">
        <div className="flex justify-center mb-1">
          <button
            type="button"
            onClick={() => setDockCollapsed((c) => !c)}
            className="px-3 py-0.5 rounded-t bg-[#041126]/95 border border-b-0 border-cyan-700/70 text-[11px] font-mono text-cyan-300 hover:text-white cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? '▴ Show AUV-09 Flight & Recon Dock' : '▾ Hide HUD Controls'}
          </button>
        </div>

        {!dockCollapsed && (
          <div className="bg-[#041126]/95 border border-cyan-700/80 rounded-lg p-2 flex flex-col gap-1.5 text-xs">
            {/* Row 1: On-Screen AUV Thruster & Depth Pad + Camera Presets */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  aria-label="Thrust Forward"
                  onClick={() => onMoveAuv(2.5, 0, 0, 0)}
                  className="px-2 py-0.5 rounded bg-[#092244] hover:bg-cyan-800 text-cyan-200 font-mono text-[11px] cursor-pointer whitespace-nowrap"
                >
                  Fwd [W]
                </button>
                <button
                  type="button"
                  aria-label="Thrust Reverse"
                  onClick={() => onMoveAuv(-2.5, 0, 0, 0)}
                  className="px-2 py-0.5 rounded bg-[#092244] hover:bg-cyan-800 text-cyan-200 font-mono text-[11px] cursor-pointer whitespace-nowrap"
                >
                  Rev [S]
                </button>
                <button
                  type="button"
                  aria-label="Yaw Port"
                  onClick={() => onMoveAuv(0, 0, -2.0, -15)}
                  className="px-2 py-0.5 rounded bg-[#092244] hover:bg-cyan-800 text-cyan-200 font-mono text-[11px] cursor-pointer whitespace-nowrap"
                >
                  Port [A]
                </button>
                <button
                  type="button"
                  aria-label="Yaw Starboard"
                  onClick={() => onMoveAuv(0, 0, 2.0, 15)}
                  className="px-2 py-0.5 rounded bg-[#092244] hover:bg-cyan-800 text-cyan-200 font-mono text-[11px] cursor-pointer whitespace-nowrap"
                >
                  Stbd [D]
                </button>
                <button
                  type="button"
                  aria-label="Dive Deeper"
                  onClick={() => onMoveAuv(0, 8, 0, 0)}
                  className="px-2 py-0.5 rounded bg-[#092244] hover:bg-cyan-800 text-amber-200 font-mono text-[11px] cursor-pointer whitespace-nowrap"
                >
                  Dive [E]
                </button>
                <button
                  type="button"
                  aria-label="Ascend Depth"
                  onClick={() => onMoveAuv(0, -8, 0, 0)}
                  className="px-2 py-0.5 rounded bg-[#092244] hover:bg-cyan-800 text-emerald-200 font-mono text-[11px] cursor-pointer whitespace-nowrap"
                >
                  Ascend [Q]
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    ['CHASE', 'Chase'],
                    ['HULL_INSPECT', 'Plimsoll'],
                    ['KEEL_UP', 'Keel Up'],
                    ['ORBIT', 'Orbit'],
                  ] as const
                ).map(([camId, camLabel]) => (
                  <button
                    key={camId}
                    type="button"
                    onClick={() => setCameraAngle(camId)}
                    className={`px-2 py-0.5 rounded font-mono text-[11px] cursor-pointer whitespace-nowrap ${
                      cameraAngle === camId
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-[#092244] text-slate-300 hover:text-white'
                    }`}
                  >
                    {camLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Tactical Subsea Actions: Sonar Ping, LIFO Backtrack, Capture Evidence */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-cyan-900/50 pt-1.5">
              <span className="text-[11px] font-mono text-slate-300 truncate max-w-[210px]">
                Target: {vessel.underwaterReconTarget}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={onTriggerSonarPing}
                  className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-200 hover:bg-cyan-500 hover:text-slate-950 font-mono text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  Sonar Ping [Space]
                </button>
                <button
                  type="button"
                  onClick={onTriggerBacktrack}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                    isBacktracking
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-amber-500/20 border border-amber-400 text-amber-200 hover:bg-amber-400 hover:text-slate-950'
                  }`}
                >
                  {isBacktracking
                    ? `Backtracking (${breadcrumbs.length})`
                    : 'LIFO Backtrack [B]'}
                </button>
                <button
                  type="button"
                  onClick={() => onCaptureEvidence()}
                  className="px-2 py-0.5 rounded bg-emerald-400 text-slate-950 hover:bg-emerald-300 font-mono text-[11px] font-bold cursor-pointer whitespace-nowrap"
                >
                  Capture Evidence [C]
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
