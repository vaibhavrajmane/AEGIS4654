import React, { useEffect, useRef } from 'react';
import {
  ControlMode,
  Detection,
  SeaState,
  Telemetry,
  Vessel,
  WorldEntity,
} from '../types';
import { seabedHeightAt } from '../data/worldSeed';
import { ManualInputState } from '../sim/physics';

interface OceanViewport2DProps {
  telemetry: Telemetry;
  entities: WorldEntity[];
  vessels: Vessel[];
  detections: Detection[];
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
  commsOutage: boolean;
  manualInputRef: React.MutableRefObject<ManualInputState>;
}

export const OceanViewport2D: React.FC<OceanViewport2DProps> = ({
  telemetry,
  entities,
  vessels,
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
  commsOutage,
  manualInputRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const surfaceY = height * 0.24;

    // 1. Sky & Orbital Layer
    const skyGrad = ctx.createLinearGradient(0, 0, 0, surfaceY);
    skyGrad.addColorStop(0, '#020813');
    skyGrad.addColorStop(1, '#082545');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, surfaceY);

    // 2. Water Column Gradient (Surface Cyan to Abyssal Navy)
    const waterGrad = ctx.createLinearGradient(0, surfaceY, 0, height);
    waterGrad.addColorStop(0, '#074368');
    waterGrad.addColorStop(0.5, '#042240');
    waterGrad.addColorStop(1, '#020c1b');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, surfaceY, width, height - surfaceY);

    const worldXToScreen = (wx: number) => ((wx + 65) / 130) * (width - 80) + 40;
    const worldYToScreen = (wy: number) => surfaceY + (-wy / 52) * (height - surfaceY - 25);

    // 3. Draw Orbiting Satellite & Dashed Link to AEGIS-01 Mothership
    const satX = width * 0.52;
    const satY = 26;
    const motherX = worldXToScreen(vessels[0]?.position.x ?? 0);

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = commsOutage ? '#ef4444' : '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(satX, satY + 8);
    ctx.lineTo(motherX, surfaceY - 12);
    ctx.stroke();
    ctx.restore();

    // Satellite icon
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(satX - 18, satY - 4, 36, 8);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(satX - 5, satY - 6, 10, 12);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#bae6fd';
    ctx.fillText(
      commsOutage ? 'LEO-SAT [OUTAGE]' : 'LEO-SAT [LINK OK]',
      satX + 24,
      satY + 4
    );

    // 4. Sea Surface Wave Line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const waveAmp = seaState === 'rough' ? 5 : seaState === 'moderate' ? 2.8 : 1.2;
    for (let sx = 0; sx <= width; sx += 8) {
      const sy = surfaceY + Math.sin(sx * 0.05) * waveAmp;
      if (sx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // 5. Seabed Terrain Profile
    ctx.fillStyle = '#0f293a';
    ctx.strokeStyle = '#0e7490';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let sx = 0; sx <= width; sx += 12) {
      const wx = ((sx - 40) / (width - 80)) * 130 - 65;
      const floorDepth = seabedHeightAt(wx, telemetry.position.z);
      const sy = worldYToScreen(floorDepth);
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 6. Surface Vessels
    for (const v of vessels.slice(0, 4)) {
      const vx = worldXToScreen(v.position.x);
      const vy = surfaceY - 6;
      ctx.fillStyle =
        v.type === 'mothership'
          ? '#0284c7'
          : v.riskScore > 75
          ? '#dc2626'
          : '#64748b';
      ctx.beginPath();
      ctx.moveTo(vx - 18, vy);
      ctx.lineTo(vx + 18, vy);
      ctx.lineTo(vx + 13, vy + 10);
      ctx.lineTo(vx - 13, vy + 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(v.name.slice(0, 16), vx - 26, vy - 5);
    }

    // 7. Umbilical Tether from AEGIS-01 to ROV
    const rovX = worldXToScreen(telemetry.position.x);
    const rovY = worldYToScreen(telemetry.position.y);

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(motherX, surfaceY + 4);
    ctx.quadraticCurveTo(
      (motherX + rovX) * 0.5,
      Math.max(surfaceY + 25, rovY + 18),
      rovX,
      rovY
    );
    ctx.stroke();

    // 8. Underwater Entities + YOLOv8 Bounding Boxes
    for (const ent of entities) {
      const ex = worldXToScreen(ent.position.x);
      const ey = worldYToScreen(ent.position.y);
      const color =
        ent.category === 'illegal_gear' || ent.category === 'vessel'
          ? '#ef4444'
          : ent.category === 'pollution'
          ? '#f59e0b'
          : ent.category === 'marine_life'
          ? '#10b981'
          : '#06b6d4';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ex, ey, 5.5, 0, Math.PI * 2);
      ctx.fill();

      if (showYoloOverlays) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(ex - 14, ey - 12, 28, 24);
        ctx.fillStyle = color;
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(ent.classLabel.slice(0, 18), ex - 14, ey - 15);
      }
    }

    // 9. Draw Yellow-and-Black ROV & Light Cone
    if (lightsOn) {
      const dir = telemetry.heading < 180 ? 1 : -1;
      const beamGrad = ctx.createLinearGradient(rovX, rovY, rovX + dir * 75, rovY + 15);
      beamGrad.addColorStop(0, 'rgba(250, 204, 21, 0.35)');
      beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(rovX, rovY);
      ctx.lineTo(rovX + dir * 75, rovY - 18);
      ctx.lineTo(rovX + dir * 75, rovY + 26);
      ctx.closePath();
      ctx.fill();
    }

    if (sonarActive) {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(rovX, rovY, 36, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ROV Body
    ctx.fillStyle = '#facc15';
    ctx.fillRect(rovX - 12, rovY - 7, 24, 10);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(rovX - 10, rovY + 2, 20, 5);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText(`AEGIS ROV (${telemetry.depth.toFixed(1)}m)`, rovX - 36, rovY - 12);
  }, [telemetry, entities, vessels, showYoloOverlays, lightsOn, sonarActive, seaState, commsOutage]);

  const nudgeManual = (patch: Partial<ManualInputState>) => {
    manualInputRef.current = { ...manualInputRef.current, ...patch };
    setTimeout(() => {
      manualInputRef.current = { forward: 0, strafe: 0, vertical: 0, yaw: 0 };
    }, 320);
  };

  return (
    <div
      className="relative w-full h-full min-h-[380px] bg-[#040f21] border border-cyan-900/60 rounded-lg overflow-hidden flex flex-col justify-between"
      data-testid="ocean-viewport-2d"
    >
      <canvas
        ref={canvasRef}
        width={960}
        height={440}
        className="w-full h-full object-cover"
      />

      <div className="p-2 bg-[#051329] border-t border-cyan-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-mono text-cyan-300">
          <span className="font-semibold text-yellow-300">2D SIDE-PROFILE BATHYMETRY VIEW</span>
          <span>·</span>
          <span>DEPTH {telemetry.depth.toFixed(1)}m</span>
          <span>·</span>
          <span>BAT {telemetry.batteryPct.toFixed(0)}%</span>
        </div>

        <div className="flex items-center gap-1">
          {(
            [
              [ControlMode.MANUAL, 'Manual'],
              [ControlMode.PATROL, 'Patrol'],
              [ControlMode.SURVEY, 'Survey'],
              [ControlMode.FOLLOW, 'Follow'],
              [ControlMode.RTB, 'RTB'],
            ] as const
          ).map(([cMode, label]) => (
            <button
              key={cMode}
              type="button"
              onClick={() => onSelectControlMode(cMode)}
              className={`px-2 py-1 rounded font-medium ${
                controlMode === cMode
                  ? 'bg-yellow-400 text-slate-950 font-semibold'
                  : 'bg-[#091e3a] text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => nudgeManual({ forward: 1 })}
            className="px-2 py-1 rounded bg-[#091e3a] text-cyan-200 font-mono"
          >
            Thrust+
          </button>
          <button
            type="button"
            onClick={onToggleYoloOverlays}
            className="px-2 py-1 rounded bg-[#091e3a] text-cyan-200"
          >
            YOLO: {showYoloOverlays ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={onToggleLights}
            className="px-2 py-1 rounded bg-[#091e3a] text-yellow-300"
          >
            Lights: {lightsOn ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={onToggleSonar}
            className="px-2 py-1 rounded bg-[#091e3a] text-emerald-300"
          >
            Sonar: {sonarActive ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={onEmergencySurface}
            className="px-2 py-1 rounded bg-red-600 text-white font-semibold"
          >
            Surface
          </button>
        </div>
      </div>
    </div>
  );
};
