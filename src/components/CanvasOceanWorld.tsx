import React, { useEffect, useRef } from 'react';
import {
  WORLD_WIDTH,
  SURFACE_Y,
  MAX_WORLD_Y,
  MPA_BOUNDARY_X,
  WorldState,
  ControlInput,
  RovMode,
  RecentDetectionRecord,
  stepWorldSimulation,
  getSeabedY,
  getWaveY,
  worldYToDepthMeters,
  getWaterTemperatureCelsius,
  hash1D,
  fbm1D,
} from '../sim/rovWorld2d';

import {
  ThreatAlert,
  SensorTelemetryPacket,
  VisitedWaypoint,
  DfsSurveyNode,
} from '../sim/dsaStructures';

export interface UiTelemetrySnapshot {
  mode: RovMode;
  lightsOn: boolean;
  overlayOn: boolean;
  depthMeters: number;
  speedKnots: number;
  battery: number;
  tempCelsius: number;
  headingDeg: number;
  rovX: number;
  rovY: number;
  activeDetectionCount: number;
  recentDetections: RecentDetectionRecord[];
  alertHeapArray: ThreatAlert[];
  alertSortedList: ThreatAlert[];
  commsSnapshot: {
    slots: Array<SensorTelemetryPacket | null>;
    head: number;
    tail: number;
    count: number;
    capacity: number;
    overwrittenCount: number;
  };
  commsOffline: boolean;
  lastFlushedCount: number;
  stackItems: VisitedWaypoint[];
  safetyState: WorldState['safetyState'];
  dfsSurvey: {
    enabled: boolean;
    currentNodeIdx: number;
    totalNodes: number;
    currentNode: DfsSurveyNode | null;
    gridCells: DfsSurveyNode[];
  };
  netTackle: WorldState['netTackle'];
}

interface CanvasOceanWorldProps {
  worldRef: React.MutableRefObject<WorldState>;
  inputRef: React.MutableRefObject<ControlInput>;
  onTelemetrySample: (snapshot: UiTelemetrySnapshot) => void;
  droneFeedCanvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}

interface OffscreenLayers {
  parallaxFar: HTMLCanvasElement;
  parallaxMid: HTMLCanvasElement;
  parallaxNear: HTMLCanvasElement;
  seabedForeground: HTMLCanvasElement;
}

/**
 * Pre-renders the 3 parallax reef/rock silhouette layers and the foreground seabed terrain
 * onto offscreen canvases once at startup for crisp 60 FPS scrolling performance.
 */
function buildOffscreenLayers(): OffscreenLayers {
  const createCanvas = (w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };

  // 1. Far parallax layer (scroll factor 0.32)
  const farW = 3000;
  const farH = MAX_WORLD_Y;
  const parallaxFar = createCanvas(farW, farH);
  const farCtx = parallaxFar.getContext('2d');
  if (farCtx) {
    farCtx.fillStyle = 'rgba(7, 29, 54, 0.55)';
    farCtx.beginPath();
    farCtx.moveTo(0, farH);
    for (let x = 0; x <= farW; x += 24) {
      const ridgeY =
        680 +
        Math.sin(x * 0.0035) * 95 +
        Math.cos(x * 0.008) * 55 +
        (fbm1D(x * 0.006, 3) - 0.5) * 140;
      farCtx.lineTo(x, ridgeY);
    }
    farCtx.lineTo(farW, farH);
    farCtx.closePath();
    farCtx.fill();
  }

  // 2. Mid parallax layer (scroll factor 0.52)
  const midW = 4000;
  const midH = MAX_WORLD_Y;
  const parallaxMid = createCanvas(midW, midH);
  const midCtx = parallaxMid.getContext('2d');
  if (midCtx) {
    midCtx.fillStyle = 'rgba(9, 37, 66, 0.68)';
    midCtx.beginPath();
    midCtx.moveTo(0, midH);
    for (let x = 0; x <= midW; x += 20) {
      const archY =
        760 +
        Math.sin(x * 0.0042 + 1.2) * 80 +
        (fbm1D(x * 0.009 + 10, 3) - 0.5) * 155;
      midCtx.lineTo(x, archY);
    }
    midCtx.lineTo(midW, midH);
    midCtx.closePath();
    midCtx.fill();

    // Distant silhouette sea fans & coral spires on mid layer
    midCtx.fillStyle = 'rgba(12, 52, 86, 0.72)';
    for (let i = 0; i < 45; i++) {
      const rx = 80 + i * 86;
      const base =
        760 +
        Math.sin(rx * 0.0042 + 1.2) * 80 +
        (fbm1D(rx * 0.009 + 10, 3) - 0.5) * 155;
      const spireH = 35 + hash1D(i * 19.3) * 65;
      const spireW = 18 + hash1D(i * 7.7) * 28;
      midCtx.beginPath();
      midCtx.moveTo(rx - spireW, base + 20);
      midCtx.quadraticCurveTo(rx, base - spireH, rx + spireW, base + 20);
      midCtx.closePath();
      midCtx.fill();
    }
  }

  // 3. Near parallax layer (scroll factor 0.76)
  const nearW = 5000;
  const nearH = MAX_WORLD_Y;
  const parallaxNear = createCanvas(nearW, nearH);
  const nearCtx = parallaxNear.getContext('2d');
  if (nearCtx) {
    nearCtx.fillStyle = 'rgba(10, 44, 74, 0.78)';
    nearCtx.beginPath();
    nearCtx.moveTo(0, nearH);
    for (let x = 0; x <= nearW; x += 16) {
      const reefY =
        845 +
        Math.cos(x * 0.0038 - 0.6) * 70 +
        (fbm1D(x * 0.011 + 25, 4) - 0.5) * 140;
      nearCtx.lineTo(x, reefY);
    }
    nearCtx.lineTo(nearW, nearH);
    nearCtx.closePath();
    nearCtx.fill();
  }

  // 4. Foreground Seabed Terrain (1:1 world width 6000 x 1380)
  const seabedForeground = createCanvas(WORLD_WIDTH, MAX_WORLD_Y);
  const sbCtx = seabedForeground.getContext('2d');
  if (sbCtx) {
    const sandGrad = sbCtx.createLinearGradient(0, 820, 0, MAX_WORLD_Y);
    sandGrad.addColorStop(0, '#1f4e5f');
    sandGrad.addColorStop(0.28, '#163a4a');
    sandGrad.addColorStop(0.65, '#0f2937');
    sandGrad.addColorStop(1, '#071520');

    sbCtx.fillStyle = sandGrad;
    sbCtx.beginPath();
    sbCtx.moveTo(0, MAX_WORLD_Y);
    for (let x = 0; x <= WORLD_WIDTH; x += 8) {
      sbCtx.lineTo(x, getSeabedY(x));
    }
    sbCtx.lineTo(WORLD_WIDTH, MAX_WORLD_Y);
    sbCtx.closePath();
    sbCtx.fill();

    // Highlighted top sand ridge rim
    sbCtx.strokeStyle = '#38bdf844';
    sbCtx.lineWidth = 3;
    sbCtx.beginPath();
    for (let x = 0; x <= WORLD_WIDTH; x += 8) {
      const y = getSeabedY(x);
      if (x === 0) sbCtx.moveTo(x, y);
      else sbCtx.lineTo(x, y);
    }
    sbCtx.stroke();

    // Sand ripples across the seabed
    sbCtx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    sbCtx.lineWidth = 1.6;
    for (let rx = 40; rx < WORLD_WIDTH - 40; rx += 38) {
      const sy = getSeabedY(rx) + 12 + hash1D(rx) * 28;
      sbCtx.beginPath();
      sbCtx.moveTo(rx - 14, sy);
      sbCtx.quadraticCurveTo(rx, sy - 4, rx + 14, sy);
      sbCtx.stroke();
    }

    // Procedural rocks and boulders along the seabed
    for (let i = 0; i < 85; i++) {
      const rx = 120 + i * 68 + (hash1D(i * 13.7) - 0.5) * 35;
      const ry = getSeabedY(rx) + 4;
      const rw = 16 + hash1D(i * 31.4) * 32;
      const rh = 10 + hash1D(i * 23.1) * 22;
      sbCtx.fillStyle = i % 2 === 0 ? '#112a38' : '#1a3b4c';
      sbCtx.beginPath();
      sbCtx.moveTo(rx - rw, ry + 8);
      sbCtx.lineTo(rx - rw * 0.7, ry - rh * 0.8);
      sbCtx.lineTo(rx + rw * 0.2, ry - rh);
      sbCtx.lineTo(rx + rw * 0.8, ry - rh * 0.5);
      sbCtx.lineTo(rx + rw, ry + 8);
      sbCtx.closePath();
      sbCtx.fill();
    }
  }

  return {
    parallaxFar,
    parallaxMid,
    parallaxNear,
    seabedForeground,
  };
}

/**
 * Fast clipped blit of an offscreen layer onto the viewport so only the visible
 * screen rectangle is copied each frame.
 */
function blitVisibleSlice(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  scrollX: number,
  scrollY: number,
  viewW: number,
  viewH: number
): void {
  const sx = Math.max(0, Math.floor(scrollX));
  const sy = Math.max(0, Math.floor(scrollY));
  const sw = Math.min(source.width - sx, Math.ceil(viewW));
  const sh = Math.min(source.height - sy, Math.ceil(viewH));
  if (sw <= 0 || sh <= 0) return;

  const dx = sx - scrollX;
  const dy = sy - scrollY;
  ctx.drawImage(source, sx, sy, sw, sh, dx, dy, sw, sh);
}

export const CanvasOceanWorld: React.FC<CanvasOceanWorldProps> = ({
  worldRef,
  inputRef,
  onTelemetrySample,
  droneFeedCanvasRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fpsRef = useRef<{ frames: number; lastFpsUpdate: number; currentFps: number }>({
    frames: 0,
    lastFpsUpdate: performance.now(),
    currentFps: 60,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Pre-render static parallax and seabed layers once
    const layers = buildOffscreenLayers();

    let viewportW = container.clientWidth || window.innerWidth || 1280;
    let viewportH = container.clientHeight || window.innerHeight || 720;
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    const updateCanvasSize = () => {
      if (!container || !canvas) return;
      const nextW = Math.max(320, container.clientWidth || window.innerWidth);
      const nextH = Math.max(240, container.clientHeight || window.innerHeight);
      const nextDpr = Math.min(2, window.devicePixelRatio || 1);
      const targetW = Math.floor(nextW * nextDpr);
      const targetH = Math.floor(nextH * nextDpr);
      viewportW = nextW;
      viewportH = nextH;
      dpr = nextDpr;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Keyboard controls: WASD + Arrow keys + Space (lights) + F (detection overlay)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') {
        inputRef.current.up = true;
      } else if (key === 's' || e.key === 'ArrowDown') {
        inputRef.current.down = true;
      } else if (key === 'a' || e.key === 'ArrowLeft') {
        inputRef.current.left = true;
      } else if (key === 'd' || e.key === 'ArrowRight') {
        inputRef.current.right = true;
      } else if (e.code === 'Space') {
        e.preventDefault();
        worldRef.current.rov.lightsOn = !worldRef.current.rov.lightsOn;
      } else if (key === 'f') {
        e.preventDefault();
        worldRef.current.rov.overlayOn = !worldRef.current.rov.overlayOn;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') {
        inputRef.current.up = false;
      } else if (key === 's' || e.key === 'ArrowDown') {
        inputRef.current.down = false;
      } else if (key === 'a' || e.key === 'ArrowLeft') {
        inputRef.current.left = false;
      } else if (key === 'd' || e.key === 'ArrowRight') {
        inputRef.current.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let lastFrameTime = performance.now();
    let lastUiSyncTime = 0;
    let rafId = 0;

    const renderFrame = (nowMs: number) => {
      const rawDt = (nowMs - lastFrameTime) / 1000;
      lastFrameTime = nowMs;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      // FPS calculation
      fpsRef.current.frames += 1;
      if (nowMs - fpsRef.current.lastFpsUpdate >= 500) {
        fpsRef.current.currentFps = Math.round(
          (fpsRef.current.frames * 1000) / (nowMs - fpsRef.current.lastFpsUpdate)
        );
        fpsRef.current.frames = 0;
        fpsRef.current.lastFpsUpdate = nowMs;
      }

      const state = worldRef.current;
      stepWorldSimulation(state, inputRef.current, dt, viewportW, viewportH);

      // Draw entire scene onto canvas
      ctx.save();
      ctx.scale(dpr, dpr);
      drawWorldScene(
        ctx,
        state,
        layers,
        viewportW,
        viewportH,
        fpsRef.current.currentFps,
        dpr,
        droneFeedCanvasRef?.current || null
      );
      ctx.restore();

      // Throttle React UI panel state updates to at most 4 times per second (every 250ms)
      if (nowMs - lastUiSyncTime >= 250) {
        lastUiSyncTime = nowMs;
        const rov = state.rov;
        const speedPx = Math.hypot(rov.vx, rov.vy);
        const speedKnots = Number((speedPx * 0.032).toFixed(1));
        const headingDeg =
          rov.facing === 1
            ? Math.round((90 + (rov.vy / 210) * 35 + 360) % 360)
            : Math.round((270 - (rov.vy / 210) * 35 + 360) % 360);

        const dfsNodes = state.dfsSurvey.nodes;
        const curDfs =
          dfsNodes.length > 0
            ? dfsNodes[state.dfsSurvey.currentNodeIdx % dfsNodes.length]
            : null;

        onTelemetrySample({
          mode: rov.mode,
          lightsOn: rov.lightsOn,
          overlayOn: rov.overlayOn,
          depthMeters: Number(worldYToDepthMeters(rov.y).toFixed(1)),
          speedKnots,
          battery: Number(rov.battery.toFixed(0)),
          tempCelsius: getWaterTemperatureCelsius(rov.y),
          headingDeg,
          rovX: Math.round(rov.x),
          rovY: Math.round(rov.y),
          activeDetectionCount: state.activeDetections.length,
          recentDetections: state.recentDetections.slice(0, 8),
          alertHeapArray: state.alertHeap.toHeapArray(),
          alertSortedList: state.alertHeap.toSortedList(),
          commsSnapshot: state.commsQueue.getSnapshot(),
          commsOffline: state.commsOffline,
          lastFlushedCount: state.lastFlushedCount,
          stackItems: state.positionStack.toTopDownArray(),
          safetyState: { ...state.safetyState },
          dfsSurvey: {
            enabled: state.dfsSurvey.enabled,
            currentNodeIdx: state.dfsSurvey.currentNodeIdx,
            totalNodes: dfsNodes.length,
            currentNode: curDfs,
            gridCells: state.dfsSurvey.gridCells,
          },
          netTackle: {
            ...state.netTackle,
            waypoints: [...state.netTackle.waypoints],
          },
        });
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [worldRef, inputRef, onTelemetrySample, droneFeedCanvasRef]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        aria-label="AEGIS Ocean Sentinel 2D Underwater ROV Simulation Canvas"
      />
    </div>
  );
};

/**
 * Main Canvas 2D procedural rendering pipeline
 */
function drawWorldScene(
  ctx: CanvasRenderingContext2D,
  state: WorldState,
  layers: OffscreenLayers,
  viewW: number,
  viewH: number,
  fps: number,
  dpr = 1,
  droneFeedCanvas: HTMLCanvasElement | null = null
): void {
  const t = state.timeSec;
  const camX = state.camera.x - viewW * 0.5 + state.camera.shakeX;
  const camY = state.camera.y - viewH * 0.5 + state.camera.shakeY;

  // 1. SKY & WATER COLUMN BACKGROUND
  const screenSurfaceY = SURFACE_Y - camY;

  // Sunset sky gradient above surface
  if (screenSurfaceY > -40) {
    const skyBottom = Math.max(0, Math.min(viewH, screenSurfaceY + 20));
    const skyGrad = ctx.createLinearGradient(0, Math.min(0, screenSurfaceY - 200), 0, skyBottom);
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(0.35, '#3b1d5a');
    skyGrad.addColorStop(0.7, '#c2410c');
    skyGrad.addColorStop(1, '#fb923c');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, viewW, skyBottom);

    // Glowing setting sun on the horizon
    const sunScreenX = 320 - camX * 0.12;
    const sunScreenY = screenSurfaceY - 28;
    const sunGrad = ctx.createRadialGradient(
      sunScreenX,
      sunScreenY,
      8,
      sunScreenX,
      sunScreenY,
      110
    );
    sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
    sunGrad.addColorStop(0.35, 'rgba(251, 146, 60, 0.55)');
    sunGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunScreenX, sunScreenY, 110, 0, Math.PI * 2);
    ctx.fill();

    // Procedural sunset clouds
    drawClouds(ctx, camX, screenSurfaceY, viewW);
  }

  // Water column vertical gradient (bright turquoise at surface -> deep navy -> near-black at seabed)
  const waterTop = Math.max(0, screenSurfaceY - 12);
  const waterGrad = ctx.createLinearGradient(0, SURFACE_Y - camY, 0, MAX_WORLD_Y - camY);
  waterGrad.addColorStop(0, '#06b6d4'); // Bright surface turquoise
  waterGrad.addColorStop(0.16, '#0284c7'); // Upper photic cyan-blue
  waterGrad.addColorStop(0.42, '#0c4a6e'); // Mid-water twilight blue
  waterGrad.addColorStop(0.74, '#082f49'); // Deep navy
  waterGrad.addColorStop(1, '#020b14'); // Near-black abyssal seabed
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, waterTop, viewW, viewH - waterTop);

  // 2. ANIMATED GOD RAYS (Light shafts fading with depth)
  drawGodRays(ctx, camX, camY, viewW, viewH, t);

  // 3. PARALLAX REEF/ROCK SILHOUETTE LAYERS (Clipped blit from offscreen canvases)
  blitVisibleSlice(ctx, layers.parallaxFar, camX * 0.32, camY, viewW, viewH);
  blitVisibleSlice(ctx, layers.parallaxMid, camX * 0.52, camY, viewW, viewH);
  blitVisibleSlice(ctx, layers.parallaxNear, camX * 0.76, camY, viewW, viewH);

  // Pre-rendered foreground seabed terrain (clipped slice)
  blitVisibleSlice(ctx, layers.seabedForeground, camX, camY, viewW, viewH);

  // 4. WORLD SPACE ENTITIES (Translated by camera)
  ctx.save();
  ctx.translate(-camX, -camY);

  // Orbiting satellite in sky + pulsing dashed comms link to AEGIS ship
  if (screenSurfaceY > -60) {
    drawSatelliteAndLink(ctx, state);
    drawAegisSurfaceVessel(ctx, state);
  }

  // Illegal poaching ships on surface + attached long drift/gillnets trapping rare marine species
  drawPoachingShipsAndAttachedLongNets(ctx, state, camX, viewW);

  // Dolphin arcing near the surface
  drawDolphin(ctx, state.dolphin, t);

  // Long bottom-trawl scar lines on seabed
  drawTrawlScars(ctx, state);

  // Marine Protected Area (MPA) dashed cyan boundary line + sign
  drawMpaBoundaryAndSign(ctx, state, camY, viewH);

  // Seabed pipeline/cable & rising dark translucent oil-leak plume
  drawPipelineAndOilPlume(ctx, state);

  // Shipwreck (tilted hull with ribs and hull breach hole)
  drawShipwreck(ctx, state.shipwreck);

  // Glowing unknown metallic seabed anomaly
  drawSeabedAnomaly(ctx, state.seabedAnomaly);

  // Swaying kelp & coral clusters (including bleached white coral patch)
  drawKelpAndCorals(ctx, state, camX, viewW, t);

  // Seahorses bobbing near the coral
  for (const sh of state.seahorses) {
    if (sh.x >= camX - 60 && sh.x <= camX + viewW + 60) {
      drawSeahorse(ctx, sh);
    }
  }

  // Ghost net draped over rocks + entangled sea turtle
  drawGhostNetAndEntangledTurtle(ctx, state);

  // Plastic bottles, plastic bags & microplastic specks
  drawPlastics(ctx, state, camX, viewW, t);

  // 165 Boid fish in schools with animated tails
  drawBoidSchools(ctx, state.boids, camX, viewW);

  // Free-gliding Sea Turtle with flapping flippers
  drawSeaTurtle(
    ctx,
    state.seaTurtle.x,
    state.seaTurtle.y,
    state.seaTurtle.vx >= 0 ? 1 : -1,
    state.seaTurtle.flipperPhase,
    false
  );

  // Patrolling Reef Shark with swaying tail
  drawShark(ctx, state.shark);

  // Marine snow particles drifting
  drawMarineSnow(ctx, state.marineSnow, camX, camY, viewW, viewH);

  // Sagging catenary tether curving down from AEGIS Surface Vessel to the ROV
  drawCatenaryTether(ctx, state);

  // Thruster bubbles rising from ROV
  drawBubbles(ctx, state.bubbles);

  // ROV Front Light Cone (soft translucent illumination beam)
  if (state.rov.lightsOn) {
    drawRovSpotlightCone(ctx, state.rov);
  }

  // Yellow-and-black ROV (body, dome camera, 4 spinning thrusters, sonar emitter, small robotic arm)
  drawRovDrone(ctx, state.rov, t);

  // Layered animated sine waves + sun glints at the sea surface
  if (screenSurfaceY > -40 && screenSurfaceY < viewH + 40) {
    drawSeaSurfaceWaves(ctx, camX, viewW, t);
  }

  ctx.restore();

  // 5. DEPTH FOG & DARKNESS OVERLAY (Increases with depth; ROV light cone illuminates surroundings)
  drawDepthDarknessOverlay(ctx, state, camX, camY, viewW, viewH);

  // 6. SIMULATED YOLOv8 OBJECT DETECTION OVERLAY (Animated bounding boxes + class labels + confidence %)
  if (state.rov.overlayOn) {
    ctx.save();
    ctx.translate(-camX, -camY);
    drawYoloDetections(ctx, state);
    drawSafetyStackAndDfsOverlay(ctx, state);
    ctx.restore();
  }

  // 6b. SECOND CANVAS: ZOOMED DRONE CAMERA LIVE FEED (with HUD & detection boxes)
  if (droneFeedCanvas) {
    drawDroneCameraFeedCanvas(ctx.canvas, droneFeedCanvas, state, camX, camY, dpr);
  }

  // 7. TACTICAL HUD OVERLAY (Depth gauge, compass, battery, speed, temp, comms, crosshair, sonar sweep, minimap, FPS)
  drawHudOverlays(ctx, state, viewW, viewH, fps);
}

function drawClouds(
  ctx: CanvasRenderingContext2D,
  camX: number,
  screenSurfaceY: number,
  viewW: number
): void {
  ctx.fillStyle = 'rgba(251, 146, 60, 0.22)';
  const cloudSeeds = [140, 520, 960, 1420, 1890];
  for (let i = 0; i < cloudSeeds.length; i++) {
    const cx =
      (((cloudSeeds[i] - camX * 0.18) % (viewW + 300)) + (viewW + 300)) % (viewW + 300) - 150;
    const cy = screenSurfaceY - 115 + (i % 3) * 20;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.arc(cx + 22, cy - 6, 32, 0, Math.PI * 2);
    ctx.arc(cx + 48, cy + 2, 24, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGodRays(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
  t: number
): void {
  const surfaceScreenY = SURFACE_Y - camY;
  if (surfaceScreenY > viewH) return;

  ctx.save();
  for (let i = 0; i < 11; i++) {
    const worldX = (i * 540 + Math.sin(t * 0.4 + i) * 60) % WORLD_WIDTH;
    const sx = worldX - camX;
    if (sx < -260 || sx > viewW + 260) continue;

    const topW = 28 + (i % 4) * 14;
    const botW = topW * 3.4;
    const rayLen = 520 + (i % 3) * 110;
    const slant = 95 + Math.sin(t * 0.3 + i) * 18;

    const grad = ctx.createLinearGradient(sx, surfaceScreenY, sx + slant, surfaceScreenY + rayLen);
    grad.addColorStop(0, 'rgba(165, 243, 252, 0.18)');
    grad.addColorStop(0.45, 'rgba(56, 189, 248, 0.07)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx - topW * 0.5, surfaceScreenY);
    ctx.lineTo(sx + topW * 0.5, surfaceScreenY);
    ctx.lineTo(sx + slant + botW * 0.5, surfaceScreenY + rayLen);
    ctx.lineTo(sx + slant - botW * 0.5, surfaceScreenY + rayLen);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSatelliteAndLink(ctx: CanvasRenderingContext2D, state: WorldState): void {
  const sat = state.satellite;
  const ship = state.aegisShip;

  // Pulsing dashed communication link line from satellite to AEGIS ship mast
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([7, 7]);
  ctx.lineDashOffset = -state.timeSec * 36;
  ctx.beginPath();
  ctx.moveTo(sat.x, sat.y + 8);
  ctx.lineTo(ship.x + 8, ship.y - 54);
  ctx.stroke();

  // Travelling data packet pulse along link
  const pulseT = (state.timeSec * 0.75) % 1;
  const px = sat.x + (ship.x + 8 - sat.x) * pulseT;
  const py = sat.y + 8 + (ship.y - 54 - (sat.y + 8)) * pulseT;
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(px, py, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Satellite body & solar panels
  ctx.save();
  ctx.translate(sat.x, sat.y);
  ctx.rotate(0.15);

  // Solar wings
  ctx.fillStyle = '#1d4ed8';
  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth = 1;
  ctx.fillRect(-36, -5, 22, 10);
  ctx.strokeRect(-36, -5, 22, 10);
  ctx.fillRect(14, -5, 22, 10);
  ctx.strokeRect(14, -5, 22, 10);

  // Bus chassis
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-10, -7, 20, 14);

  // Dish antenna
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 10, 6, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  // Label
  ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillText('SAT-AEGIS-04', -32, -12);
  ctx.restore();
}

function drawAegisSurfaceVessel(ctx: CanvasRenderingContext2D, state: WorldState): void {
  const ship = state.aegisShip;
  const bobY = Math.sin(ship.bobPhase) * 2.5;
  const pitch = Math.cos(ship.bobPhase * 0.8) * 0.025;

  ctx.save();
  ctx.translate(ship.x, ship.y + bobY);
  ctx.rotate(pitch);

  // Lower hull (deep blue)
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.moveTo(-95, -4);
  ctx.lineTo(105, -4);
  ctx.lineTo(86, 16);
  ctx.lineTo(-82, 16);
  ctx.closePath();
  ctx.fill();

  // Upper hull (clean white & cyan stripe)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(-98, -22);
  ctx.lineTo(112, -22);
  ctx.lineTo(102, -4);
  ctx.lineTo(-92, -4);
  ctx.closePath();
  ctx.fill();

  // Cyan AEGIS livery stripe
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(-75, -14, 155, 4);

  // Superstructure / Bridge
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(-42, -22);
  ctx.lineTo(38, -22);
  ctx.lineTo(28, -44);
  ctx.lineTo(-34, -44);
  ctx.closePath();
  ctx.fill();

  // Bridge windows
  ctx.fillStyle = '#0ea5e9';
  for (let wx = -26; wx <= 16; wx += 14) {
    ctx.fillRect(wx, -39, 10, 7);
  }

  // Communications Mast
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(8, -44);
  ctx.lineTo(8, -66);
  ctx.moveTo(-2, -55);
  ctx.lineTo(18, -55);
  ctx.stroke();

  // Spinning Radar Bar
  const radarW = Math.cos(ship.radarAngle) * 14;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(8 - radarW, -66);
  ctx.lineTo(8 + radarW, -66);
  ctx.stroke();

  // Hull label
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 9px ui-monospace, monospace';
  ctx.fillText('AEGIS-01', -24, -7);

  ctx.restore();
}

function drawPoachingShipsAndAttachedLongNets(
  ctx: CanvasRenderingContext2D,
  state: WorldState,
  camX: number,
  viewW: number
): void {
  for (const ship of state.poachingShips) {
    if (ship.x < camX - 240 || ship.x > camX + viewW + 240) continue;

    const bobY = Math.sin(ship.bobPhase) * 2.8;
    const pitch = Math.sin(ship.bobPhase * 0.7) * 0.028;
    const sternWinchX = ship.x - 58;
    const sternWinchY = ship.y + bobY - 38;
    const bowBoomX = ship.x + 56;
    const bowBoomY = ship.y + bobY - 12;

    const netLeftTop = ship.x - ship.netWidth * 0.5;
    const netRightTop = ship.x + ship.netWidth * 0.5;
    // Headline sits at y ~ 234 so there is a clear Over-Net Surface Corridor at y = 206 above the net cork floats
    const headlineY = ship.netTopY + 46;
    const netHeight = ship.netBottomY - headlineY;

    ctx.save();

    // 1. STEEL WARP CABLES FROM SHIP STERN GANTRY & BOOM DOWN TO SUBMERGED LONG NET
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.78)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(sternWinchX, sternWinchY);
    ctx.lineTo(netLeftTop, headlineY);
    ctx.moveTo(sternWinchX + 10, sternWinchY + 14);
    ctx.lineTo(ship.x, headlineY);
    ctx.moveTo(bowBoomX, bowBoomY);
    ctx.lineTo(netRightTop, headlineY);
    ctx.stroke();

    // 2. LONG SUBMERGED DRIFT / GILL NET CURTAIN (Billowing with ocean current)
    const verticalSteps = 14;
    const stepH = netHeight / verticalSteps;

    // Subtle translucent net silhouette & hazard tint
    ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
    ctx.beginPath();
    for (let r = 0; r <= verticalSteps; r++) {
      const ry = headlineY + r * stepH;
      const sway = Math.sin(ship.swayPhase + r * 0.42) * (6 + r * 1.15);
      const lx = netLeftTop + sway;
      if (r === 0) ctx.moveTo(lx, ry);
      else ctx.lineTo(lx, ry);
    }
    for (let r = verticalSteps; r >= 0; r--) {
      const ry = headlineY + r * stepH;
      const sway = Math.sin(ship.swayPhase + r * 0.42) * (6 + r * 1.15);
      const rx = netRightTop + sway - r * 0.8;
      ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.fill();

    // Vertical & diagonal diamond monofilament mesh lines
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.52)';
    ctx.lineWidth = 1.15;
    const cols = 8;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      ctx.beginPath();
      for (let r = 0; r <= verticalSteps; r++) {
        const ry = headlineY + r * stepH;
        const sway = Math.sin(ship.swayPhase + r * 0.42) * (6 + r * 1.15);
        const spanW = ship.netWidth - r * 0.8;
        const px = netLeftTop + sway + u * spanW;
        if (r === 0) ctx.moveTo(px, ry);
        else ctx.lineTo(px, ry);
      }
      ctx.stroke();
    }

    // Horizontal mesh ribs & diagonal cross-webbing
    for (let r = 0; r <= verticalSteps; r++) {
      const ry = headlineY + r * stepH;
      const sway = Math.sin(ship.swayPhase + r * 0.42) * (6 + r * 1.15);
      const spanW = ship.netWidth - r * 0.8;
      const lx = netLeftTop + sway;
      const rx = lx + spanW;

      ctx.strokeStyle =
        r === 0 || r === verticalSteps
          ? 'rgba(248, 113, 113, 0.85)'
          : 'rgba(148, 163, 184, 0.42)';
      ctx.lineWidth = r === 0 || r === verticalSteps ? 2.2 : 1.0;
      ctx.beginPath();
      ctx.moveTo(lx, ry);
      ctx.lineTo(rx, ry);
      ctx.stroke();

      // Float buoys along top headline (r === 0) and lead sinker weights at bottom (r === verticalSteps)
      if (r === 0) {
        for (let b = 0; b <= 5; b++) {
          const bx = lx + (b / 5) * spanW;
          ctx.fillStyle = b % 2 === 0 ? '#f97316' : '#facc15';
          ctx.beginPath();
          ctx.ellipse(bx, ry, 5.5, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (r === verticalSteps) {
        for (let w = 0; w <= 6; w++) {
          const wx = lx + (w / 6) * spanW;
          ctx.fillStyle = '#475569';
          ctx.fillRect(wx - 2.5, ry - 1, 5, 6);
        }
      }
    }

    // 3. TRAPPED RARE FISH & SEA TURTLES INSIDE THE LONG NET
    for (const tc of ship.trappedCreatures) {
      const rNorm = Math.max(0, Math.min(1, (tc.depthY - headlineY) / netHeight));
      const rIdx = rNorm * verticalSteps;
      const netSwayX = Math.sin(ship.swayPhase + rIdx * 0.42) * (6 + rIdx * 1.15);
      const cx = ship.x + tc.offsetX + netSwayX;
      const cy = tc.depthY + Math.sin(tc.strugglePhase * 0.7) * 2.5;
      const thrashRot = Math.sin(tc.strugglePhase) * 0.14;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(thrashRot);

      if (tc.kind === 'rare-turtle') {
        // Rare Green / Hawksbill Sea Turtle with golden carapace markings
        drawSeaTurtle(ctx, 0, 0, 1, tc.strugglePhase * 1.6, true);
        ctx.strokeStyle = tc.accentColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, -2, 18, 9, 0, Math.PI, 0);
        ctx.stroke();
      } else if (tc.kind === 'bluefin-tuna') {
        // Rare Endangered Golden Bluefin Tuna
        const tailWag = Math.sin(tc.strugglePhase * 1.8) * 6;
        ctx.fillStyle = tc.primaryColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Metallic gold lateral stripe & finlets
        ctx.strokeStyle = tc.accentColor;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-22, -2);
        ctx.lineTo(22, -2);
        ctx.stroke();

        // Lunate tail fin
        ctx.fillStyle = tc.accentColor;
        ctx.beginPath();
        ctx.moveTo(-28, 0);
        ctx.lineTo(-42, -13 + tailWag);
        ctx.lineTo(-35, tailWag * 0.4);
        ctx.lineTo(-42, 13 + tailWag);
        ctx.closePath();
        ctx.fill();

        // Dorsal & ventral fins
        ctx.beginPath();
        ctx.moveTo(-4, -11);
        ctx.lineTo(6, -21);
        ctx.lineTo(12, -10);
        ctx.closePath();
        ctx.fill();

        // Eye
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(21, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(21.5, -3, 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (tc.kind === 'manta-ray') {
        // Rare Reef Manta Ray with wide diamond pectoral wings & cephalic fins
        const wingFlap = Math.sin(tc.strugglePhase * 1.3) * 7;
        ctx.fillStyle = tc.primaryColor;
        ctx.strokeStyle = tc.accentColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(28, 0);
        ctx.quadraticCurveTo(4, -26 + wingFlap, -16, -22 + wingFlap);
        ctx.quadraticCurveTo(-12, -4, -28, 0);
        ctx.quadraticCurveTo(-12, 4, -16, 22 - wingFlap);
        ctx.quadraticCurveTo(4, 26 - wingFlap, 28, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cephalic lobes & long whip tail
        ctx.beginPath();
        ctx.moveTo(26, -5);
        ctx.lineTo(36, -8);
        ctx.moveTo(26, 5);
        ctx.lineTo(36, 8);
        ctx.moveTo(-26, 0);
        ctx.lineTo(-52, 4 + wingFlap * 0.5);
        ctx.stroke();
      } else if (tc.kind === 'hammerhead') {
        // Rare Scalloped Hammerhead Shark
        const tailWag = Math.sin(tc.strugglePhase * 1.6) * 7;
        ctx.fillStyle = tc.primaryColor;
        ctx.beginPath();
        ctx.moveTo(-36, 0);
        ctx.quadraticCurveTo(0, -16, 40, -2);
        ctx.quadraticCurveTo(10, 12, -36, 0);
        ctx.closePath();
        ctx.fill();

        // Tall sickle dorsal fin
        ctx.beginPath();
        ctx.moveTo(-4, -9);
        ctx.lineTo(4, -28);
        ctx.lineTo(12, -8);
        ctx.closePath();
        ctx.fill();

        // Tail fluke
        ctx.beginPath();
        ctx.moveTo(-34, 0);
        ctx.lineTo(-52, -16 + tailWag);
        ctx.lineTo(-43, tailWag * 0.3);
        ctx.lineTo(-48, 12 + tailWag);
        ctx.closePath();
        ctx.fill();

        // Hammerhead cephalofoil T-bar & eyes
        ctx.fillStyle = tc.accentColor;
        ctx.fillRect(34, -11, 7, 22);
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(38, -10, 2, 0, Math.PI * 2);
        ctx.arc(38, 10, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Rare Bioluminescent Regal Angelfish
        ctx.fillStyle = tc.primaryColor;
        ctx.strokeStyle = tc.accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Glowing gold vertical stripes
        for (let sx = -10; sx <= 10; sx += 7) {
          ctx.beginPath();
          ctx.moveTo(sx, -12);
          ctx.lineTo(sx - 2, 12);
          ctx.stroke();
        }
      }

      // Entangling net cords wrapped directly over the trapped rare creature
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.78)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-26, -12);
      ctx.lineTo(24, 12);
      ctx.moveTo(-24, 12);
      ctx.lineTo(26, -12);
      ctx.moveTo(-8, -16);
      ctx.lineTo(8, 16);
      ctx.stroke();

      ctx.restore();
    }

    // 4. SURFACE POACHING TRAWLER HULL, WHEELHOUSE, STERN A-FRAME GANTRY & WINCH
    ctx.save();
    ctx.translate(ship.x, ship.y + bobY);
    ctx.rotate(pitch);

    // Industrial trawler hull
    ctx.fillStyle = ship.hullColor;
    ctx.beginPath();
    ctx.moveTo(-94, -19);
    ctx.lineTo(98, -21);
    ctx.lineTo(82, 15);
    ctx.lineTo(-80, 15);
    ctx.closePath();
    ctx.fill();

    // Hazard waterline trim stripe
    ctx.fillStyle = ship.trimColor;
    ctx.fillRect(-82, 3, 164, 4);

    // Wheelhouse & superstructure
    ctx.fillStyle = '#334155';
    ctx.fillRect(-26, -39, 58, 20);
    ctx.fillStyle = '#fde047';
    for (let wx = -18; wx <= 18; wx += 12) {
      ctx.fillRect(wx, -34, 7, 5);
    }

    // Heavy Stern A-Frame Net Gantry & Winch Drum
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-78, -19);
    ctx.lineTo(-58, -44);
    ctx.lineTo(-38, -19);
    ctx.stroke();

    // Net Winch Drum at stern
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(-55, -23, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Forward outrigger boom
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(28, -28);
    ctx.lineTo(56, -12);
    ctx.stroke();

    // Mast + flashing crimson beacon
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2, -39);
    ctx.lineTo(2, -58);
    ctx.stroke();

    const beaconGlow = 0.45 + 0.55 * Math.abs(Math.sin(ship.beaconPhase));
    ctx.fillStyle = `rgba(239, 68, 68, ${beaconGlow})`;
    ctx.beginPath();
    ctx.arc(2, -60, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(239, 68, 68, ${beaconGlow * 0.32})`;
    ctx.beginPath();
    ctx.arc(2, -60, 15, 0, Math.PI * 2);
    ctx.fill();

    // Ship Callsign & Towed Drift-Net Banner
    ctx.fillStyle = 'rgba(69, 10, 10, 0.88)';
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 1.2;
    ctx.fillRect(-86, -82, 178, 17);
    ctx.strokeRect(-86, -82, 178, 17);
    ctx.fillStyle = '#fecaca';
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.fillText(`⚠ ${ship.vesselName} [LONG NET]`, -80, -70);

    ctx.restore();
    ctx.restore();
  }
}

function drawSeaSurfaceWaves(
  ctx: CanvasRenderingContext2D,
  camX: number,
  viewW: number,
  t: number
): void {
  const startX = Math.max(0, Math.floor(camX - 40));
  const endX = Math.min(WORLD_WIDTH, Math.ceil(camX + viewW + 40));

  // Back wave layer
  ctx.strokeStyle = 'rgba(165, 243, 252, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += 12) {
    const wy = getWaveY(x, t * 0.85 + 1.3) - 3;
    if (x === startX) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.stroke();

  // Front wave crest + sun glints
  ctx.strokeStyle = 'rgba(254, 249, 195, 0.82)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += 10) {
    const wy = getWaveY(x, t);
    if (x === startX) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.stroke();

  // Sparkling sun glints on wave crests
  ctx.fillStyle = 'rgba(254, 240, 138, 0.88)';
  for (let x = startX; x <= endX; x += 44) {
    const glint = Math.sin(x * 0.09 + t * 4.5);
    if (glint > 0.55) {
      const wy = getWaveY(x, t);
      ctx.fillRect(x - 4, wy - 1.5, 8, 3);
    }
  }
}

function drawTrawlScars(ctx: CanvasRenderingContext2D, state: WorldState): void {
  ctx.save();
  for (const scar of state.trawlScars) {
    for (let offset = 6; offset <= 18; offset += 6) {
      ctx.strokeStyle = offset === 12 ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.55)';
      ctx.lineWidth = offset === 12 ? 4 : 2.5;
      ctx.beginPath();
      for (let x = scar.startX; x <= scar.endX; x += 14) {
        const y = getSeabedY(x) + offset;
        if (x === scar.startX) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMpaBoundaryAndSign(
  ctx: CanvasRenderingContext2D,
  state: WorldState,
  camY: number,
  viewH: number
): void {
  const bx = MPA_BOUNDARY_X;
  const seabedY = getSeabedY(bx);

  ctx.save();
  // Vertical dashed cyan boundary line from surface to seabed
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.moveTo(bx, SURFACE_Y);
  ctx.lineTo(bx, seabedY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Floating vertical zone label that stays visible in viewport
  const labelY = Math.max(SURFACE_Y + 60, Math.min(seabedY - 120, camY + viewH * 0.28));
  ctx.fillStyle = 'rgba(8, 51, 68, 0.88)';
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 1.5;
  ctx.fillRect(bx + 10, labelY - 16, 178, 24);
  ctx.strokeRect(bx + 10, labelY - 16, 178, 24);
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.fillText('MPA BOUNDARY ZONE →', bx + 18, labelY);

  // Physical seabed signpost: "MPA: no fishing"
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bx + 42, seabedY + 6);
  ctx.lineTo(bx + 42, seabedY - 58);
  ctx.stroke();

  // Sign board
  ctx.fillStyle = '#083344';
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.fillRect(bx - 12, seabedY - 86, 114, 30);
  ctx.strokeRect(bx - 12, seabedY - 86, 114, 30);

  ctx.fillStyle = '#ecfeff';
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.fillText('MPA: no fishing', bx - 4, seabedY - 67);
  ctx.restore();
}

function drawPipelineAndOilPlume(ctx: CanvasRenderingContext2D, state: WorldState): void {
  const { startX, endX } = state.pipeline;

  ctx.save();
  // Segmented industrial pipeline resting on seabed
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = startX; x <= endX; x += 20) {
    const py = getSeabedY(x) - 5;
    if (x === startX) ctx.moveTo(x, py);
    else ctx.lineTo(x, py);
  }
  ctx.stroke();

  // Pipeline highlight & flange joints
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += 20) {
    const py = getSeabedY(x) - 9;
    if (x === startX) ctx.moveTo(x, py);
    else ctx.lineTo(x, py);
  }
  ctx.stroke();

  ctx.fillStyle = '#334155';
  for (let x = startX + 40; x < endX; x += 65) {
    const py = getSeabedY(x) - 5;
    ctx.fillRect(x - 3, py - 9, 6, 18);
  }

  // Rising Oil-Leak Plume (dark translucent cloud)
  for (const drop of state.oilDroplets) {
    const grad = ctx.createRadialGradient(
      drop.x,
      drop.y,
      drop.radius * 0.15,
      drop.x,
      drop.y,
      drop.radius
    );
    grad.addColorStop(0, `rgba(15, 23, 42, ${drop.alpha})`);
    grad.addColorStop(0.55, `rgba(30, 41, 59, ${drop.alpha * 0.7})`);
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawShipwreck(
  ctx: CanvasRenderingContext2D,
  wreck: { x: number; y: number; width: number; height: number }
): void {
  ctx.save();
  ctx.translate(wreck.x, wreck.y);
  ctx.rotate(-0.14);

  // Sunken wooden/iron hull silhouette
  ctx.fillStyle = '#292524';
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-125, -18);
  ctx.lineTo(130, -24);
  ctx.lineTo(105, 42);
  ctx.lineTo(-108, 42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Exposed structural ribs
  ctx.strokeStyle = '#78716c';
  ctx.lineWidth = 4;
  for (let rx = -90; rx <= 85; rx += 25) {
    ctx.beginPath();
    ctx.moveTo(rx, 36);
    ctx.quadraticCurveTo(rx - 6, 4, rx + 2, -26);
    ctx.stroke();
  }

  // Broken mast & wheelhouse frame
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-18, -20);
  ctx.lineTo(-8, -88);
  ctx.moveTo(-36, -58);
  ctx.lineTo(24, -46);
  ctx.stroke();

  // Dark breach hole in the hull side
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#44403c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, -2);
  ctx.lineTo(44, -8);
  ctx.lineTo(54, 14);
  ctx.lineTo(32, 28);
  ctx.lineTo(6, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawSeabedAnomaly(
  ctx: CanvasRenderingContext2D,
  anomaly: { x: number; y: number; pulsePhase: number }
): void {
  const pulse = 0.6 + 0.4 * Math.sin(anomaly.pulsePhase);
  ctx.save();
  ctx.translate(anomaly.x, anomaly.y);

  // Outer cyan/emerald bioluminescent/electromagnetic aura
  const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, 58);
  aura.addColorStop(0, `rgba(56, 189, 248, ${0.65 * pulse})`);
  aura.addColorStop(0.5, `rgba(16, 185, 129, ${0.32 * pulse})`);
  aura.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, Math.PI * 2);
  ctx.fill();

  // Metallic polyhedral canister/dome
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-34, 14);
  ctx.lineTo(-22, -14);
  ctx.lineTo(22, -14);
  ctx.lineTo(34, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glowing core seams
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(0, 0, 7 + pulse * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawKelpAndCorals(
  ctx: CanvasRenderingContext2D,
  state: WorldState,
  camX: number,
  viewW: number,
  t: number
): void {
  // Swaying sine-driven kelp stalks
  for (const k of state.kelp) {
    if (k.x < camX - 80 || k.x > camX + viewW + 80) continue;
    ctx.save();
    ctx.strokeStyle = k.color;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(k.x, k.baseY + 4);

    const segH = k.height / k.segments;
    for (let s = 1; s <= k.segments; s++) {
      const sway = Math.sin(t * 1.9 + k.phaseOffset + s * 0.55) * (s * 3.4);
      const sx = k.x + sway;
      const sy = k.baseY - s * segH;
      ctx.lineTo(sx, sy);

      // Kelp blades/leaves
      ctx.fillStyle = k.color;
      ctx.beginPath();
      ctx.ellipse(
        sx + (s % 2 === 0 ? 7 : -7),
        sy + 4,
        7,
        3,
        s % 2 === 0 ? 0.4 : -0.4,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Multi-colored & bleached coral clusters
  for (const c of state.corals) {
    if (c.x < camX - 90 || c.x > camX + viewW + 90) continue;
    const sway = Math.sin(t * 1.6 + c.x * 0.05) * 2.2;
    ctx.save();
    ctx.translate(c.x, c.y + 2);
    ctx.scale(c.scale, c.scale);

    if (c.type === 'branch' || c.type === 'bleached') {
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      const branches = [-22, -10, 0, 11, 22];
      for (let i = 0; i < branches.length; i++) {
        const bx = branches[i];
        const bh = 22 + (i % 2) * 10;
        ctx.beginPath();
        ctx.moveTo(bx * 0.3, 0);
        ctx.quadraticCurveTo(bx * 0.7, -bh * 0.5, bx + sway, -bh);
        ctx.stroke();

        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx * 0.65, -bh * 0.5);
        ctx.lineTo(bx + (i % 2 === 0 ? 8 : -8) + sway, -bh * 0.85);
        ctx.stroke();
      }
    } else if (c.type === 'brain') {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(0, -4, 18, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.secondaryColor;
      ctx.lineWidth = 1.8;
      for (let r = 6; r <= 14; r += 4) {
        ctx.beginPath();
        ctx.arc(0, -4, r, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    } else if (c.type === 'fan') {
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2;
      for (let a = -0.9; a <= 0.9; a += 0.22) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.sin(a) * 26 + sway, -Math.cos(a) * 28);
        ctx.stroke();
      }
    } else if (c.type === 'tube') {
      ctx.fillStyle = c.color;
      const tubes = [-12, -4, 4, 12];
      for (let i = 0; i < tubes.length; i++) {
        const tx = tubes[i];
        const th = 18 + (i % 2) * 8;
        ctx.fillRect(tx - 3, -th, 6, th);
        ctx.fillStyle = c.secondaryColor;
        ctx.beginPath();
        ctx.ellipse(tx, -th, 3.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c.color;
      }
    }
    ctx.restore();
  }
}

function drawSeahorse(
  ctx: CanvasRenderingContext2D,
  sh: { x: number; y: number; color: string; phase: number }
): void {
  ctx.save();
  ctx.translate(sh.x, sh.y);

  ctx.fillStyle = 'rgba(254, 240, 138, 0.7)';
  ctx.beginPath();
  ctx.ellipse(-5, 0, 4, 6, Math.sin(sh.phase * 4) * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = sh.color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6, -11);
  ctx.lineTo(1, -12);
  ctx.bezierCurveTo(-5, -8, 5, -1, 2, 6);
  ctx.bezierCurveTo(-1, 13, -7, 14, -5, 9);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(1.5, -11, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawGhostNetAndEntangledTurtle(ctx: CanvasRenderingContext2D, state: WorldState): void {
  const net = state.ghostNet;
  const et = state.entangledTurtle;

  const wobble = Math.sin(et.strugglePhase) * 0.08;
  ctx.save();
  ctx.translate(et.x, et.y);
  ctx.rotate(wobble);
  drawSeaTurtle(ctx, 0, 0, 1, et.strugglePhase * 1.4, true);
  ctx.restore();

  ctx.save();
  const left = net.x - net.width * 0.5;
  const top = net.y - net.height * 0.5;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
  ctx.lineWidth = 1.4;

  for (let gx = left; gx <= left + net.width; gx += 12) {
    const sag = Math.sin((gx - left) * 0.05 + state.timeSec) * 5;
    ctx.beginPath();
    ctx.moveTo(gx, top + sag);
    ctx.lineTo(gx - 18, top + net.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(gx, top + sag);
    ctx.lineTo(gx + 18, top + net.height);
    ctx.stroke();
  }

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(left, top + 6);
  ctx.quadraticCurveTo(net.x, top - 8, left + net.width, top + 10);
  ctx.stroke();

  for (let bx = left + 10; bx <= left + net.width - 10; bx += 28) {
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.ellipse(bx, top + 2, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlastics(
  ctx: CanvasRenderingContext2D,
  state: WorldState,
  camX: number,
  viewW: number,
  t: number
): void {
  for (const mp of state.microplastics) {
    if (mp.x < camX - 20 || mp.x > camX + viewW + 20) continue;
    ctx.fillStyle = mp.color;
    const dy = Math.sin(t * 1.8 + mp.phase) * 4;
    ctx.fillRect(mp.x, mp.y + dy, mp.size, mp.size);
  }

  for (const p of state.plastics) {
    if (p.x < camX - 60 || p.x > camX + viewW + 60) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    if (p.kind === 'bottle') {
      ctx.fillStyle = 'rgba(125, 211, 252, 0.55)';
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-12, -6, 20, 12, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillRect(8, -3.5, 5, 7);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(12, -4, 3.5, 8);
      ctx.fillStyle = 'rgba(248, 250, 252, 0.75)';
      ctx.fillRect(-5, -5.5, 7, 11);
    } else {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.42)';
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.7)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-12, -8);
      ctx.quadraticCurveTo(0, -14, 12, -6);
      ctx.quadraticCurveTo(16, 4, 8, 12);
      ctx.quadraticCurveTo(-4, 8, -14, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-8, -10, 4, Math.PI, 0);
      ctx.arc(6, -10, 4, Math.PI, 0);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawBoidSchools(
  ctx: CanvasRenderingContext2D,
  boids: WorldState['boids'],
  camX: number,
  viewW: number
): void {
  for (let i = 0; i < boids.length; i++) {
    const b = boids[i];
    if (b.x < camX - 40 || b.x > camX + viewW + 40) continue;

    const angle = Math.atan2(b.vy, b.vx);
    const wag = Math.sin(b.tailPhase) * 3.2;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);

    ctx.fillStyle = b.colorFin;
    ctx.beginPath();
    ctx.moveTo(-b.size * 0.8, 0);
    ctx.lineTo(-b.size * 1.75, -b.size * 0.65 + wag);
    ctx.lineTo(-b.size * 1.4, wag * 0.4);
    ctx.lineTo(-b.size * 1.75, b.size * 0.65 + wag);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = b.colorBody;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.size, b.size * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(b.size * 0.5, -b.size * 0.12, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawSeaTurtle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: 1 | -1,
  flipperPhase: number,
  isEntangled: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  const strokeAngle = Math.sin(flipperPhase) * 0.45;

  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.ellipse(-24, 9, 9, 4, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.ellipse(26, -2, 9, 6.5, -0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#052e16';
  ctx.beginPath();
  ctx.arc(30, -4, 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isEntangled ? '#854d0e' : '#3f6212';
  ctx.strokeStyle = '#a3e635';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 14, 0, Math.PI, 0);
  ctx.bezierCurveTo(22, 8, -22, 8, -24, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(217, 249, 157, 0.45)';
  ctx.beginPath();
  ctx.moveTo(-12, -12);
  ctx.lineTo(-10, 3);
  ctx.moveTo(0, -14);
  ctx.lineTo(0, 4);
  ctx.moveTo(12, -12);
  ctx.lineTo(10, 3);
  ctx.stroke();

  ctx.save();
  ctx.translate(10, 4);
  ctx.rotate(strokeAngle);
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.ellipse(4, 12, 6, 16, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawShark(ctx: CanvasRenderingContext2D, shark: WorldState['shark']): void {
  const dir = shark.vx >= 0 ? 1 : -1;
  const tailSway = Math.sin(shark.tailPhase) * 9;

  ctx.save();
  ctx.translate(shark.x, shark.y);
  ctx.scale(dir, 1);

  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(-44, 0);
  ctx.lineTo(-68, -22 + tailSway);
  ctx.lineTo(-56, tailSway * 0.4);
  ctx.lineTo(-64, 18 + tailSway);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(-8, -12);
  ctx.quadraticCurveTo(2, -34, 12, -32);
  ctx.quadraticCurveTo(6, -18, 14, -10);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(8, 8);
  ctx.lineTo(-6, 26);
  ctx.lineTo(18, 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(-48, 0);
  ctx.quadraticCurveTo(0, -22, 56, -2);
  ctx.quadraticCurveTo(20, 6, -48, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(-46, 0);
  ctx.quadraticCurveTo(12, 18, 56, -2);
  ctx.quadraticCurveTo(18, 4, -46, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  for (let gx = 18; gx <= 26; gx += 4) {
    ctx.beginPath();
    ctx.moveTo(gx, -4);
    ctx.lineTo(gx - 1, 5);
    ctx.stroke();
  }

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(42, -4, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawDolphin(
  ctx: CanvasRenderingContext2D,
  dolphin: WorldState['dolphin'],
  t: number
): void {
  const dir = dolphin.vx >= 0 ? 1 : -1;
  const pitch = -Math.cos(dolphin.arcPhase) * 0.42 * dir;
  const flukeAngle = Math.sin(t * 7) * 5;

  ctx.save();
  ctx.translate(dolphin.x, dolphin.y);
  ctx.rotate(pitch);
  ctx.scale(dir, 1);

  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.moveTo(-6, -10);
  ctx.quadraticCurveTo(-14, -26, -2, -24);
  ctx.lineTo(8, -10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(-42, 0);
  ctx.quadraticCurveTo(-4, -18, 34, -4);
  ctx.lineTo(46, -1);
  ctx.lineTo(34, 4);
  ctx.quadraticCurveTo(-4, 14, -42, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.moveTo(-36, 1);
  ctx.quadraticCurveTo(0, 12, 34, 3);
  ctx.quadraticCurveTo(0, 4, -36, 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.moveTo(-40, 0);
  ctx.lineTo(-54, -9 + flukeAngle);
  ctx.lineTo(-48, flukeAngle * 0.5);
  ctx.lineTo(-54, 9 + flukeAngle);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(28, -2, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawMarineSnow(
  ctx: CanvasRenderingContext2D,
  snow: WorldState['marineSnow'],
  camX: number,
  camY: number,
  viewW: number,
  viewH: number
): void {
  ctx.fillStyle = 'rgba(224, 242, 254, 0.42)';
  for (let i = 0; i < snow.length; i++) {
    const s = snow[i];
    if (s.x < camX || s.x > camX + viewW || s.y < camY || s.y > camY + viewH) continue;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCatenaryTether(ctx: CanvasRenderingContext2D, state: WorldState): void {
  const shipX = state.aegisShip.x;
  const shipY = state.aegisShip.y + 10;
  const rovX = state.rov.x - state.rov.facing * 20;
  const rovY = state.rov.y - 8;

  const midX = (shipX + rovX) * 0.5 - (rovX - shipX) * 0.14;
  const sagExtra = Math.min(180, Math.hypot(rovX - shipX, rovY - shipY) * 0.22);
  const midY = Math.max(shipY, rovY) + sagExtra * 0.45;

  ctx.save();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(shipX, shipY);
  ctx.quadraticCurveTo(midX, midY, rovX, rovY);
  ctx.stroke();

  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(shipX, shipY);
  ctx.quadraticCurveTo(midX, midY, rovX, rovY);
  ctx.stroke();
  ctx.restore();
}

function drawBubbles(ctx: CanvasRenderingContext2D, bubbles: WorldState['bubbles']): void {
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    ctx.strokeStyle = `rgba(186, 230, 253, ${b.alpha})`;
    ctx.fillStyle = `rgba(224, 242, 254, ${b.alpha * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawRovSpotlightCone(ctx: CanvasRenderingContext2D, rov: WorldState['rov']): void {
  ctx.save();
  ctx.translate(rov.x, rov.y);
  ctx.rotate(rov.tilt);
  ctx.scale(rov.facing, 1);

  const coneLen = 460;
  const coneHalfH = 195;

  const grad = ctx.createLinearGradient(24, 2, coneLen, 0);
  grad.addColorStop(0, 'rgba(254, 249, 195, 0.42)');
  grad.addColorStop(0.45, 'rgba(103, 232, 249, 0.18)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(22, -4);
  ctx.lineTo(coneLen, -coneHalfH);
  ctx.quadraticCurveTo(coneLen + 35, 0, coneLen, coneHalfH);
  ctx.lineTo(22, 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawRovDrone(ctx: CanvasRenderingContext2D, rov: WorldState['rov'], t: number): void {
  ctx.save();
  ctx.translate(rov.x, rov.y);
  ctx.rotate(rov.tilt);
  ctx.scale(rov.facing, 1);

  const clawWave = Math.sin(t * 2.5) * 0.12;
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(10, 12);
  ctx.lineTo(22, 19);
  ctx.lineTo(32, 16 + clawWave * 10);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, 16 + clawWave * 10);
  ctx.lineTo(38, 13 + clawWave * 10);
  ctx.moveTo(32, 16 + clawWave * 10);
  ctx.lineTo(38, 20 + clawWave * 10);
  ctx.stroke();

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-24, 15);
  ctx.lineTo(20, 15);
  ctx.moveTo(-16, 9);
  ctx.lineTo(-16, 15);
  ctx.moveTo(12, 9);
  ctx.lineTo(12, 15);
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-24, -4, 46, 14, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-26, -15, 50, 14, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(-16, -15);
  ctx.lineTo(-10, -15);
  ctx.lineTo(-14, -1);
  ctx.lineTo(-20, -1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 7px ui-monospace, monospace';
  ctx.fillText('AUV-09', -6, -6);

  ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(22, -4, 9.5, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(25, -4, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rov.lightsOn ? '#fef08a' : '#475569';
  ctx.beginPath();
  ctx.arc(23, 5, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(-4, -20, 10, 5);
  const sonarPulse = (t * 1.4) % 1;
  ctx.strokeStyle = `rgba(34, 211, 238, ${(1 - sonarPulse) * 0.6})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(1, -20, 6 + sonarPulse * 26, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  const thrusterCoords = [
    { x: -27, y: -6 },
    { x: -27, y: 4 },
    { x: -12, y: -15 },
    { x: 10, y: -15 },
  ];

  for (let i = 0; i < thrusterCoords.length; i++) {
    const tc = thrusterCoords[i];
    const bladeSpan = Math.sin(rov.thrusterPhase + i * 1.2) * 5.5;
    ctx.fillStyle = '#334155';
    ctx.fillRect(tc.x - 3, tc.y - 3, 6, 6);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tc.x, tc.y - bladeSpan);
    ctx.lineTo(tc.x, tc.y + bladeSpan);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Renders depth-based darkness that leaves the ROV and its forward light cone illuminated
 * using a single radial gradient (no destination-out canvas erasure).
 */
function drawDepthDarknessOverlay(
  ctx: CanvasRenderingContext2D,
  state: WorldState,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number
): void {
  const depthMeters = worldYToDepthMeters(state.rov.y);
  const darknessAlpha = Math.max(0, Math.min(0.82, (depthMeters - 22) / 160));
  if (darknessAlpha <= 0.02) return;

  const rovScreenX = state.rov.x - camX;
  const rovScreenY = state.rov.y - camY;
  const lightCenterX = rovScreenX + (state.rov.lightsOn ? state.rov.facing * 155 : 0);
  const lightCenterY = rovScreenY + (state.rov.lightsOn ? Math.sin(state.rov.tilt) * 60 : 0);
  const innerRadius = state.rov.lightsOn ? 115 : 55;
  const outerRadius = state.rov.lightsOn ? 460 : 210;

  ctx.save();
  const maskGrad = ctx.createRadialGradient(
    lightCenterX,
    lightCenterY,
    innerRadius,
    lightCenterX,
    lightCenterY,
    outerRadius
  );
  maskGrad.addColorStop(0, 'rgba(2, 8, 20, 0)');
  maskGrad.addColorStop(0.55, `rgba(2, 8, 20, ${darknessAlpha * 0.45})`);
  maskGrad.addColorStop(1, `rgba(2, 8, 20, ${darknessAlpha})`);

  ctx.fillStyle = maskGrad;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.restore();
}

function drawYoloDetections(ctx: CanvasRenderingContext2D, state: WorldState): void {
  for (const det of state.activeDetections) {
    let strokeColor = '#facc15';
    let bgColor = 'rgba(234, 179, 8, 0.88)';
    if (det.category === 'threat') {
      strokeColor = '#f97316';
      bgColor = 'rgba(239, 68, 68, 0.9)';
    } else if (det.category === 'life') {
      strokeColor = '#22c55e';
      bgColor = 'rgba(22, 163, 74, 0.9)';
    }

    const age = state.timeSec - det.firstSeenSec;
    const pulseScale =
      age < 0.35 ? 1 + (0.35 - age) * 0.45 : 1 + Math.sin(state.timeSec * 6) * 0.025;
    const w = det.width * pulseScale;
    const h = det.height * pulseScale;
    const left = det.x - w * 0.5;
    const top = det.y - h * 0.5;

    ctx.save();
    ctx.fillStyle =
      det.category === 'threat'
        ? 'rgba(239, 68, 68, 0.09)'
        : det.category === 'life'
          ? 'rgba(34, 197, 94, 0.08)'
          : 'rgba(250, 204, 21, 0.09)';
    ctx.fillRect(left, top, w, h);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(left, top, w, h);
    ctx.setLineDash([]);

    const corner = Math.min(12, w * 0.25, h * 0.25);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(left, top + corner);
    ctx.lineTo(left, top);
    ctx.lineTo(left + corner, top);
    ctx.moveTo(left + w - corner, top);
    ctx.lineTo(left + w, top);
    ctx.lineTo(left + w, top + corner);
    ctx.moveTo(left, top + h - corner);
    ctx.lineTo(left, top + h);
    ctx.lineTo(left + corner, top + h);
    ctx.moveTo(left + w - corner, top + h);
    ctx.lineTo(left + w, top + h);
    ctx.lineTo(left + w, top + h - corner);
    ctx.stroke();

    const labelText = `${det.label} ${det.confidence}%`;
    ctx.font = 'bold 11px ui-monospace, monospace';
    const textW = ctx.measureText(labelText).width;
    const pillW = textW + 10;
    const pillH = 17;

    ctx.fillStyle = bgColor;
    ctx.fillRect(left, top - pillH - 2, pillW, pillH);
    ctx.fillStyle = '#020617';
    ctx.fillText(labelText, left + 5, top - 6);

    ctx.restore();
  }
}

function drawHudOverlays(
  ctx: CanvasRenderingContext2D,
  state: WorldState,
  viewW: number,
  viewH: number,
  fps: number
): void {
  const rov = state.rov;
  const depthM = worldYToDepthMeters(rov.y);
  const tempC = getWaterTemperatureCelsius(rov.y);
  const speedKts = (Math.hypot(rov.vx, rov.vy) * 0.032).toFixed(1);
  const rightPanelSafeW = viewW > 768 ? 284 : 0;
  const hudCenterX = (viewW - rightPanelSafeW) * 0.5;

  ctx.save();

  // 1. TOP TELEMETRY RIBBON
  const topBarY = 54;
  ctx.fillStyle = 'rgba(4, 15, 30, 0.82)';
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(14, topBarY, Math.max(300, viewW - rightPanelSafeW - 28), 38, 6);
  ctx.fill();
  ctx.stroke();

  const recBlink = Math.sin(state.timeSec * 5) > -0.2;
  ctx.fillStyle = recBlink ? '#ef4444' : '#7f1d1d';
  ctx.beginPath();
  ctx.arc(30, topBarY + 19, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.fillText('REC', 41, topBarY + 23);

  ctx.fillStyle = '#67e8f9';
  ctx.fillText(`DEPTH: ${depthM.toFixed(1)}m`, 84, topBarY + 23);
  ctx.fillText(`SPD: ${speedKts} kts`, 188, topBarY + 23);
  ctx.fillText(`TEMP: ${tempC.toFixed(1)}°C`, 284, topBarY + 23);

  if (viewW > 640) {
    const heading =
      rov.facing === 1
        ? Math.round((90 + (rov.vy / 210) * 35 + 360) % 360)
        : Math.round((270 - (rov.vy / 210) * 35 + 360) % 360);
    const dirLabel = rov.facing === 1 ? 'E' : 'W';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`HDG ${String(heading).padStart(3, '0')}° ${dirLabel}`, 390, topBarY + 23);
  }

  if (viewW > 760) {
    const batX = 505;
    const batColor = rov.battery < 20 ? '#ef4444' : rov.battery < 45 ? '#facc15' : '#22c55e';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`BAT ${Math.round(rov.battery)}%`, batX, topBarY + 23);
    ctx.strokeStyle = '#64748b';
    ctx.strokeRect(batX + 58, topBarY + 12, 46, 13);
    ctx.fillStyle = batColor;
    ctx.fillRect(batX + 60, topBarY + 14, Math.max(2, (42 * rov.battery) / 100), 9);
  }

  const rightEdge = viewW - rightPanelSafeW - 26;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.fillText(`${fps} FPS`, rightEdge - 48, topBarY + 23);

  if (viewW > 880) {
    const commsX = rightEdge - 135;
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('LINK', commsX, topBarY + 23);
    for (let b = 0; b < 4; b++) {
      const barH = 4 + b * 3;
      ctx.fillStyle = b < 3 || depthM < 180 ? '#22d3ee' : '#334155';
      ctx.fillRect(commsX + 34 + b * 6, topBarY + 25 - barH, 4, barH);
    }
  }

  // 2. LEFT VERTICAL DEPTH GAUGE LADDER
  const gaugeX = 16;
  const gaugeTop = 108;
  const gaugeH = Math.max(160, viewH - 310);
  ctx.fillStyle = 'rgba(4, 15, 30, 0.72)';
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)';
  ctx.beginPath();
  ctx.roundRect(gaugeX, gaugeTop, 46, gaugeH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.font = '9px ui-monospace, monospace';
  ctx.fillStyle = '#94a3b8';
  for (let dm = 0; dm <= 240; dm += 40) {
    const gy = gaugeTop + 14 + (dm / 240) * (gaugeH - 28);
    ctx.fillRect(gaugeX + 32, gy, 8, 1.5);
    ctx.fillText(`${dm}m`, gaugeX + 6, gy + 3);
  }

  const markerRatio = Math.max(0, Math.min(1, depthM / 240));
  const markerY = gaugeTop + 14 + markerRatio * (gaugeH - 28);
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(gaugeX + 44, markerY);
  ctx.lineTo(gaugeX + 34, markerY - 5);
  ctx.lineTo(gaugeX + 34, markerY + 5);
  ctx.closePath();
  ctx.fill();

  // 3. CENTER OPTICAL CROSSHAIR RETICLE
  const crossY = viewH * 0.5;
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(hudCenterX, crossY, 22, 0, Math.PI * 2);
  ctx.moveTo(hudCenterX - 32, crossY);
  ctx.lineTo(hudCenterX - 12, crossY);
  ctx.moveTo(hudCenterX + 12, crossY);
  ctx.lineTo(hudCenterX + 32, crossY);
  ctx.moveTo(hudCenterX, crossY - 32);
  ctx.lineTo(hudCenterX, crossY - 12);
  ctx.moveTo(hudCenterX, crossY + 12);
  ctx.lineTo(hudCenterX, crossY + 32);
  ctx.stroke();

  // 4. BOTTOM-LEFT CIRCULAR SONAR SWEEP
  const sonarR = 64;
  const sonarCx = 16 + sonarR + 6;
  const sonarCy = viewH - sonarR - 22;

  ctx.fillStyle = 'rgba(3, 14, 28, 0.88)';
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(sonarCx, sonarCy, sonarR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(sonarCx, sonarCy, sonarR * 0.66, 0, Math.PI * 2);
  ctx.arc(sonarCx, sonarCy, sonarR * 0.33, 0, Math.PI * 2);
  ctx.moveTo(sonarCx - sonarR, sonarCy);
  ctx.lineTo(sonarCx + sonarR, sonarCy);
  ctx.moveTo(sonarCx, sonarCy - sonarR);
  ctx.lineTo(sonarCx, sonarCy + sonarR);
  ctx.stroke();

  const sweepAngle = rov.sonarAngle;
  ctx.fillStyle = 'rgba(34, 211, 238, 0.18)';
  ctx.beginPath();
  ctx.moveTo(sonarCx, sonarCy);
  ctx.arc(sonarCx, sonarCy, sonarR - 2, sweepAngle - 0.45, sweepAngle);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sonarCx, sonarCy);
  ctx.lineTo(
    sonarCx + Math.cos(sweepAngle) * (sonarR - 2),
    sonarCy + Math.sin(sweepAngle) * (sonarR - 2)
  );
  ctx.stroke();

  for (const echo of state.sonarEchoes) {
    const ex = sonarCx + echo.dx * (sonarR - 6);
    const ey = sonarCy + echo.dy * (sonarR - 6);
    const color =
      echo.category === 'threat'
        ? `rgba(249, 115, 22, ${echo.alpha})`
        : echo.category === 'life'
          ? `rgba(34, 197, 94, ${echo.alpha})`
          : `rgba(250, 204, 21, ${echo.alpha})`;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ex, ey, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.fillText('ACTIVE SONAR (110m)', sonarCx - 54, sonarCy - sonarR - 8);

  // 5. BOTTOM-RIGHT WORLD MINIMAP
  const mapW = 248;
  const mapH = 82;
  const mapX = viewW - rightPanelSafeW - mapW - 16;
  const mapY = viewH - mapH - 22;

  if (mapX > sonarCx + sonarR + 20) {
    ctx.fillStyle = 'rgba(3, 14, 28, 0.88)';
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(mapX, mapY, mapW, mapH, 6);
    ctx.fill();
    ctx.stroke();

    const surfMapY = mapY + (SURFACE_Y / MAX_WORLD_Y) * mapH;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mapX + 2, surfMapY);
    ctx.lineTo(mapX + mapW - 2, surfMapY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(22, 58, 74, 0.85)';
    ctx.beginPath();
    ctx.moveTo(mapX + 2, mapY + mapH - 2);
    for (let wx = 0; wx <= WORLD_WIDTH; wx += 150) {
      const mx = mapX + (wx / WORLD_WIDTH) * mapW;
      const my = mapY + (getSeabedY(wx) / MAX_WORLD_Y) * mapH;
      ctx.lineTo(mx, my);
    }
    ctx.lineTo(mapX + mapW - 2, mapY + mapH - 2);
    ctx.closePath();
    ctx.fill();

    const mpaMapX = mapX + (MPA_BOUNDARY_X / WORLD_WIDTH) * mapW;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(mpaMapX, surfMapY);
    ctx.lineTo(mpaMapX, mapY + mapH - 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const aegisMapX = mapX + (state.aegisShip.x / WORLD_WIDTH) * mapW;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(aegisMapX - 4, surfMapY - 3, 8, 4);

    // Draw all Poaching Ships & their attached long submerged nets on the minimap
    for (const ps of state.poachingShips) {
      const psMapX = mapX + (ps.x / WORLD_WIDTH) * mapW;
      const netBottomMapY = mapY + (ps.netBottomY / MAX_WORLD_Y) * mapH;
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(psMapX, surfMapY);
      ctx.lineTo(psMapX, netBottomMapY);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(psMapX - 4, surfMapY - 3, 8, 4);
    }

    for (const det of state.recentDetections) {
      const dx = mapX + (det.worldX / WORLD_WIDTH) * mapW;
      const dy = mapY + (det.worldY / MAX_WORLD_Y) * mapH;
      ctx.fillStyle =
        det.category === 'threat'
          ? '#f97316'
          : det.category === 'life'
            ? '#22c55e'
            : '#facc15';
      ctx.beginPath();
      ctx.arc(dx, dy, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    const camRectX = mapX + ((state.camera.x - viewW * 0.5) / WORLD_WIDTH) * mapW;
    const camRectY = mapY + ((state.camera.y - viewH * 0.5) / MAX_WORLD_Y) * mapH;
    const camRectW = (viewW / WORLD_WIDTH) * mapW;
    const camRectH = (viewH / MAX_WORLD_Y) * mapH;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.max(mapX + 2, camRectX),
      Math.max(mapY + 2, camRectY),
      Math.min(mapW - 4, camRectW),
      Math.min(mapH - 4, camRectH)
    );

    const rovMapX = mapX + (rov.x / WORLD_WIDTH) * mapW;
    const rovMapY = mapY + (rov.y / MAX_WORLD_Y) * mapH;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(rovMapX, rovMapY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.fillText('WORLD SECTOR MINIMAP (6.0 KM)', mapX + 4, mapY - 6);
  }

  // Show prominent top-center Collision Evasion Warning banner when near Poaching Nets, Ghost Net, or Shipwreck
  if (state.safetyState.isWarning || state.safetyState.isBacktracking) {
    const bannerW = 472;
    const bannerH = 44;
    const bx = hudCenterX - bannerW * 0.5;
    const by = 104;
    ctx.fillStyle = 'rgba(127, 29, 29, 0.92)';
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bannerW, bannerH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(`⚠ COLLISION EVASION: ${state.safetyState.hazardName.toUpperCase()}`, bx + 14, by + 19);
    ctx.fillStyle = '#fecaca';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(
      `Hydrodynamic brake active — Auto-retracing safe tether waypoints (Step #${state.safetyState.poppedCount})`,
      bx + 14,
      by + 35
    );
  } else if (state.netTackle.active) {
    // Show active Net Tackling Maneuver banner (Under-Net Dive or Over-Net Crest)
    const bannerW = 468;
    const bannerH = 44;
    const bx = hudCenterX - bannerW * 0.5;
    const by = 104;
    const isOver = state.netTackle.activePass === 'OVER_NET';
    ctx.fillStyle = isOver ? 'rgba(6, 78, 59, 0.92)' : 'rgba(8, 51, 68, 0.92)';
    ctx.strokeStyle = isOver ? '#34d399' : '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bannerW, bannerH, 6);
    ctx.fill();
    ctx.stroke();

    const curWp =
      state.netTackle.waypoints[
        Math.min(state.netTackle.waypointIdx, state.netTackle.waypoints.length - 1)
      ];
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(
      `◆ NET TACKLE (${isOver ? 'OVER-NET CREST' : 'UNDER-NET DIVE'}): ${state.netTackle.targetNetName}`,
      bx + 14,
      by + 19
    );
    ctx.fillStyle = '#a7f3d0';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(
      `Phase: ${curWp ? curWp.label : state.netTackle.phase} • Target Depth: ${worldYToDepthMeters(
        isOver ? state.netTackle.overCorridorY : state.netTackle.underCorridorY
      ).toFixed(1)}m`,
      bx + 14,
      by + 35
    );
  }

  ctx.restore();
}

/**
 * Draws the tether-safe breadcrumb retrace trail behind the ROV and systematic sector sweep waypoints when in Auto Survey
 */
function drawSafetyStackAndDfsOverlay(ctx: CanvasRenderingContext2D, state: WorldState): void {
  const stackPts = state.positionStack.toTopDownArray();
  if (stackPts.length > 0) {
    ctx.save();
    ctx.strokeStyle = state.safetyState.isBacktracking
      ? 'rgba(248, 113, 113, 0.85)'
      : 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = state.safetyState.isBacktracking ? 2.5 : 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(state.rov.x, state.rov.y);
    for (let i = 0; i < Math.min(8, stackPts.length); i++) {
      ctx.lineTo(stackPts[i].x, stackPts[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < Math.min(6, stackPts.length); i++) {
      const pt = stackPts[i];
      ctx.fillStyle = i === 0 ? '#facc15' : 'rgba(56, 189, 248, 0.65)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, i === 0 ? 4 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Draw hazard proximity rings around Ghost Net and Shipwreck
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(state.ghostNet.x, state.ghostNet.y, 125, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(state.shipwreck.x, state.shipwreck.y, 140, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // If in Auto Survey with Systematic Sector Sweep active, draw the sector sweep waypoints in world space
  if (state.rov.mode === 'Auto Survey' && state.dfsSurvey.enabled) {
    ctx.save();
    const nodes = state.dfsSurvey.nodes;
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      if (i === 0) ctx.moveTo(nodes[i].worldX, nodes[i].worldY);
      else ctx.lineTo(nodes[i].worldX, nodes[i].worldY);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const isCurrent = i === state.dfsSurvey.currentNodeIdx % nodes.length;
      ctx.fillStyle = isCurrent ? '#facc15' : 'rgba(192, 132, 252, 0.8)';
      ctx.beginPath();
      ctx.arc(n.worldX, n.worldY, isCurrent ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9d5ff';
      ctx.font = 'bold 9px ui-monospace, monospace';
      ctx.fillText(`SEC#${n.order}`, n.worldX + 8, n.worldY + 3);
    }
    ctx.restore();
  }

  // Draw Over-Net and Under-Net Clearance Corridors for Poaching Ship Nets + Active Net Tackling Trajectory
  ctx.save();
  for (const ps of state.poachingShips) {
    const halfSpan = ps.netWidth * 0.5 + 80;
    const overY = SURFACE_Y + 26;
    const underY = Math.min(getSeabedY(ps.x) - 55, ps.netBottomY + 62);
    const isTargetShip = state.netTackle.active && state.netTackle.targetNetId === ps.id;

    // 1. Over-Net Surface Clearance Corridor guide line (above cork float headline)
    ctx.strokeStyle =
      isTargetShip && state.netTackle.activePass === 'OVER_NET'
        ? '#34d399'
        : 'rgba(52, 211, 153, 0.36)';
    ctx.lineWidth = isTargetShip && state.netTackle.activePass === 'OVER_NET' ? 2.6 : 1.3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(ps.x - halfSpan, overY + 18);
    ctx.quadraticCurveTo(ps.x, overY - 8, ps.x + halfSpan, overY + 18);
    ctx.stroke();

    // 2. Under-Net Deep Dive Clearance Corridor guide line (below lead weights)
    ctx.strokeStyle =
      isTargetShip && state.netTackle.activePass === 'UNDER_NET'
        ? '#22d3ee'
        : 'rgba(34, 211, 238, 0.38)';
    ctx.lineWidth = isTargetShip && state.netTackle.activePass === 'UNDER_NET' ? 2.6 : 1.3;
    ctx.beginPath();
    ctx.moveTo(ps.x - halfSpan, underY - 24);
    ctx.quadraticCurveTo(ps.x, underY + 14, ps.x + halfSpan, underY - 24);
    ctx.stroke();
    ctx.setLineDash([]);

    // Corridor labels on each net
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(110, 231, 183, 0.85)';
    ctx.fillText('▲ OVER-NET PASS (6.5m)', ps.x - 58, overY - 4);
    ctx.fillStyle = 'rgba(103, 232, 249, 0.85)';
    ctx.fillText(
      `▼ UNDER-NET DIVE (${worldYToDepthMeters(underY).toFixed(0)}m)`,
      ps.x - 62,
      underY + 18
    );
  }

  // Highlight active 3-waypoint Net Tackling path from ROV through the selected clearance corridor
  if (state.netTackle.active && state.netTackle.waypoints.length > 0) {
    const wps = state.netTackle.waypoints;
    const isOver = state.netTackle.activePass === 'OVER_NET';
    ctx.strokeStyle = isOver ? '#10b981' : '#06b6d4';
    ctx.lineWidth = 2.8;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(state.rov.x, state.rov.y);
    for (let i = state.netTackle.waypointIdx; i < wps.length; i++) {
      ctx.lineTo(wps[i].x, wps[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < wps.length; i++) {
      const wp = wps[i];
      const isCurrent = i === state.netTackle.waypointIdx;
      const isDone = i < state.netTackle.waypointIdx;
      ctx.fillStyle = isDone ? '#22c55e' : isCurrent ? '#facc15' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, isCurrent ? 6.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();

      if (isCurrent) {
        ctx.fillStyle = 'rgba(2, 10, 24, 0.86)';
        ctx.fillRect(wp.x - 58, wp.y - 24, 134, 15);
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.fillText(wp.label, wp.x - 54, wp.y - 13);
      }
    }
  }
  ctx.restore();
}

/**
 * 6. Renders the second canvas: a zoomed 2.2x optical view from the ROV dome camera
 * with tactical HUD and YOLO detection boxes.
 */
function drawDroneCameraFeedCanvas(
  mainCanvas: HTMLCanvasElement,
  feedCanvas: HTMLCanvasElement,
  state: WorldState,
  camX: number,
  camY: number,
  dpr: number
): void {
  const fCtx = feedCanvas.getContext('2d');
  if (!fCtx) return;

  const fw = feedCanvas.width;
  const fh = feedCanvas.height;
  if (fw <= 0 || fh <= 0) return;

  // Center the zoomed optical feed slightly ahead of the ROV nose (in the spotlight cone)
  const rovScreenX = state.rov.x - camX + state.rov.facing * 68;
  const rovScreenY = state.rov.y - camY + Math.sin(state.rov.tilt) * 24;

  const zoom = 2.15;
  const srcW = (fw / zoom) * dpr;
  const srcH = (fh / zoom) * dpr;
  const srcX = Math.max(0, Math.min(mainCanvas.width - srcW, rovScreenX * dpr - srcW * 0.5));
  const srcY = Math.max(0, Math.min(mainCanvas.height - srcH, rovScreenY * dpr - srcH * 0.5));

  fCtx.save();
  fCtx.fillStyle = '#020b14';
  fCtx.fillRect(0, 0, fw, fh);

  if (srcW > 0 && srcH > 0 && mainCanvas.width > 0 && mainCanvas.height > 0) {
    fCtx.drawImage(mainCanvas, srcX, srcY, srcW, srcH, 0, 0, fw, fh);
  }

  // 1. Subsea ROV Optical Sensor Color Tinting (cyan-emerald low-light shift + dome lens vignette)
  fCtx.save();
  fCtx.globalCompositeOperation = 'source-over';
  const opticTintGrad = fCtx.createLinearGradient(0, 0, 0, fh);
  opticTintGrad.addColorStop(0, 'rgba(6, 182, 212, 0.14)');
  opticTintGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.11)');
  opticTintGrad.addColorStop(1, 'rgba(8, 145, 178, 0.18)');
  fCtx.fillStyle = opticTintGrad;
  fCtx.fillRect(0, 0, fw, fh);

  // Optical dome peripheral vignette
  const domeVignette = fCtx.createRadialGradient(
    fw * 0.5,
    fh * 0.5,
    Math.min(fw, fh) * 0.28,
    fw * 0.5,
    fh * 0.5,
    Math.max(fw, fh) * 0.68
  );
  domeVignette.addColorStop(0, 'rgba(16, 185, 129, 0)');
  domeVignette.addColorStop(0.65, 'rgba(4, 47, 46, 0.16)');
  domeVignette.addColorStop(1, 'rgba(2, 10, 22, 0.52)');
  fCtx.fillStyle = domeVignette;
  fCtx.fillRect(0, 0, fw, fh);

  // 2. Interlaced Horizontal Scanline Effect + Rolling Optical Sensor Refresh Sweep
  fCtx.fillStyle = 'rgba(2, 10, 20, 0.34)';
  for (let sy = 0; sy < fh; sy += 3) {
    fCtx.fillRect(0, sy, fw, 1);
  }
  fCtx.fillStyle = 'rgba(34, 211, 238, 0.05)';
  for (let sy = 1; sy < fh; sy += 3) {
    fCtx.fillRect(0, sy, fw, 1);
  }

  // Animated rolling scanline bar
  const sweepY = ((state.timeSec * 36) % (fh + 28)) - 14;
  const sweepGrad = fCtx.createLinearGradient(0, sweepY - 10, 0, sweepY + 10);
  sweepGrad.addColorStop(0, 'rgba(34, 211, 238, 0)');
  sweepGrad.addColorStop(0.5, 'rgba(52, 211, 153, 0.14)');
  sweepGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
  fCtx.fillStyle = sweepGrad;
  fCtx.fillRect(0, sweepY - 10, fw, 20);
  fCtx.restore();

  fCtx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
  fCtx.lineWidth = 1;
  // Optical corner brackets
  const b = 12;
  fCtx.beginPath();
  fCtx.moveTo(4, 4 + b);
  fCtx.lineTo(4, 4);
  fCtx.lineTo(4 + b, 4);
  fCtx.moveTo(fw - 4 - b, 4);
  fCtx.lineTo(fw - 4, 4);
  fCtx.lineTo(fw - 4, 4 + b);
  fCtx.moveTo(4, fh - 4 - b);
  fCtx.lineTo(4, fh - 4);
  fCtx.lineTo(4 + b, fh - 4);
  fCtx.moveTo(fw - 4 - b, fh - 4);
  fCtx.lineTo(fw - 4, fh - 4);
  fCtx.lineTo(fw - 4, fh - 4 - b);
  fCtx.stroke();

  // Center camera reticle + pitch horizon bar
  const cx = fw * 0.5;
  const cy = fh * 0.5;
  fCtx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
  fCtx.beginPath();
  fCtx.arc(cx, cy, 11, 0, Math.PI * 2);
  fCtx.moveTo(cx - 18, cy);
  fCtx.lineTo(cx - 6, cy);
  fCtx.moveTo(cx + 6, cy);
  fCtx.lineTo(cx + 18, cy);
  fCtx.stroke();

  // Camera HUD Telemetry Header & Footer inside the second canvas
  fCtx.fillStyle = 'rgba(2, 10, 22, 0.76)';
  fCtx.fillRect(0, 0, fw, 16);
  fCtx.fillRect(0, fh - 16, fw, 16);

  fCtx.font = 'bold 9px ui-monospace, monospace';
  fCtx.fillStyle = '#22d3ee';
  fCtx.fillText('CAM-01 DOME [2.2x ZOOM]', 6, 11);

  const lockCount = state.activeDetections.length;
  fCtx.fillStyle = lockCount > 0 ? '#4ade80' : '#94a3b8';
  fCtx.fillText(`LOCKS: ${lockCount}`, fw - 56, 11);

  const depthM = worldYToDepthMeters(state.rov.y).toFixed(1);
  fCtx.fillStyle = '#fde047';
  fCtx.fillText(`D:${depthM}m`, 6, fh - 5);
  fCtx.fillStyle = '#cbd5e1';
  fCtx.fillText(
    state.rov.lightsOn ? 'LUMEN: HIGH' : 'LUMEN: OFF',
    fw - 72,
    fh - 5
  );

  fCtx.restore();
}

