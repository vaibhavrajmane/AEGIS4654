import React, { useEffect, useRef, useState } from 'react';
import { Detection, Telemetry, WorldEntity } from '../types';
import { mergeSortDetections } from '../lib/dsa';

interface SonarAndFusionPanelProps {
  telemetry: Telemetry;
  entities: WorldEntity[];
  detections: Detection[];
  onSelectEntity: (entityId: string) => void;
}

export const SonarAndFusionPanel: React.FC<SonarAndFusionPanelProps> = ({
  telemetry,
  entities,
  detections,
  onSelectEntity,
}) => {
  const sonarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sweepAngleRef = useRef(0);
  const [sortBy, setSortBy] = useState<'confidence' | 'distance' | 'time'>('confidence');

  // Sort detections using our deterministic Merge Sort from /lib/dsa.ts
  const { sorted: sortedDetections, comparisons } = mergeSortDetections(
    detections,
    sortBy
  );

  useEffect(() => {
    const canvas = sonarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const drawSonar = () => {
      const w = canvas.width;
      const h = canvas.height;
      const ppiRadius = Math.min(w * 0.26, h * 0.44);
      const cx = w * 0.28;
      const cy = h * 0.5;

      ctx.fillStyle = '#020b16';
      ctx.fillRect(0, 0, w, h);

      // 1. Left Side: Rotating Radar-Style Acoustic PPI Sonar Sweep
      ctx.strokeStyle = '#065f46';
      ctx.lineWidth = 1;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (ppiRadius * r) / 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - ppiRadius, cy);
      ctx.lineTo(cx + ppiRadius, cy);
      ctx.moveTo(cx, cy - ppiRadius);
      ctx.lineTo(cx, cy + ppiRadius);
      ctx.stroke();

      // Rotating sweep wedge
      sweepAngleRef.current = (sweepAngleRef.current + 0.045) % (Math.PI * 2);
      const angle = sweepAngleRef.current;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, ppiRadius, angle - 0.45, angle);
      ctx.closePath();
      ctx.fill();

      // Plot acoustic blips relative to ROV
      for (const ent of entities) {
        const dx = ent.position.x - telemetry.position.x;
        const dz = ent.position.z - telemetry.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 65) continue;
        const bx = cx + (dx / 65) * ppiRadius;
        const by = cy + (dz / 65) * ppiRadius;

        ctx.fillStyle =
          ent.category === 'vessel' || ent.category === 'illegal_gear'
            ? '#ef4444'
            : ent.category === 'pollution'
            ? '#f59e0b'
            : '#10b981';
        ctx.beginPath();
        ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#34d399';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('450 kHz PPI SONAR SWEEP', 12, 16);

      // 2. Right Side: Side-Scan Bathymetric Waterfall Echoes
      const wfX = w * 0.56;
      const wfW = w * 0.41;
      const wfY = 24;
      const wfH = h - 34;

      ctx.strokeStyle = '#0e7490';
      ctx.strokeRect(wfX, wfY, wfW, wfH);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('SIDE-SCAN WATERFALL ECHO', wfX + 6, 16);

      for (let row = 0; row < 18; row++) {
        const ry = wfY + (row / 18) * wfH;
        const rh = wfH / 18 - 1;
        const intensity =
          0.25 +
          0.35 *
            Math.abs(
              Math.sin(row * 0.5 + sweepAngleRef.current * 2 + telemetry.position.x * 0.1)
            );
        ctx.fillStyle = `rgba(6, 182, 212, ${intensity.toFixed(2)})`;
        ctx.fillRect(wfX + 2, ry, wfW - 4, rh);

        // Highlight strong acoustic return in center nadir channel
        const echoX =
          wfX +
          wfW * 0.5 +
          Math.sin(row * 0.4 + sweepAngleRef.current) * (wfW * 0.28);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(echoX - 4, ry, 8, rh);
      }

      animId = window.setTimeout(drawSonar, 90);
    };

    drawSonar();
    return () => clearTimeout(animId);
  }, [telemetry.position.x, telemetry.position.z, entities]);

  return (
    <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-display font-bold uppercase text-white">
            Active Sonar & Bayesian Multi-Sensor Fusion
          </h3>
          <p className="text-xs text-slate-400">
            Fuses Optical Camera (YOLOv8 Sim) + 450 kHz Sonar + USBL GPS + CTD/Fluorometer Probes
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-400 font-mono mr-1">
            MergeSort ({comparisons} cmp):
          </span>
          {(
            [
              ['confidence', 'Fused Confidence'],
              ['distance', 'Distance'],
              ['time', 'Recent'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={`px-2 py-1 rounded font-medium whitespace-nowrap shrink-0 ${
                sortBy === key
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'bg-[#091e3a] text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sonar Radar & Waterfall Canvas */}
      <canvas
        ref={sonarCanvasRef}
        width={520}
        height={155}
        className="w-full h-[155px] rounded border border-cyan-950 bg-[#020b16]"
      />

      {/* Multi-Sensor Fusion Table */}
      <div className="overflow-x-auto max-h-[230px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-cyan-900/60 text-slate-400 font-mono">
              <th className="py-1.5 pr-2">Track / Class</th>
              <th className="py-1.5 px-2">Confirmed Sensors</th>
              <th className="py-1.5 px-2 text-right">Range</th>
              <th className="py-1.5 pl-2 text-right">Fused Conf</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cyan-950/60 font-mono">
            {sortedDetections.slice(0, 8).map((det) => (
              <tr
                key={det.id}
                onClick={() => onSelectEntity(det.entityId)}
                className="hover:bg-cyan-950/40 cursor-pointer transition-colors"
              >
                <td className="py-1.5 pr-2 font-sans">
                  <div className="font-medium text-slate-100">{det.classLabel}</div>
                  <div className="text-[11px] text-slate-400">
                    {det.id} · SDG {det.sdgTargets.join(', ')}
                  </div>
                </td>
                <td className="py-1.5 px-2">
                  <span className="text-cyan-300">
                    {det.confirmedSensors.join(' + ')}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-right text-slate-200 tabular-nums">
                  {det.distanceKmDisplay}
                </td>
                <td className="py-1.5 pl-2 text-right font-semibold text-emerald-400 tabular-nums">
                  {det.fusedConfidence.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
