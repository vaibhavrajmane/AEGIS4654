import React, { useState } from 'react';
import {
  Detection,
  MonitoringCapability,
  Telemetry,
  Vessel,
  WorldEntity,
} from '../types';
import { MPA_ZONE, formatTacticalDistanceKm, worldToGps } from '../data/worldSeed';

interface MaritimeMapViewProps {
  telemetry: Telemetry;
  vessels: Vessel[];
  entities: WorldEntity[];
  detections: Detection[];
  activeCapability: MonitoringCapability;
  onSelectEntity: (entityId: string) => void;
  selectedEntityId: string | null;
  compact?: boolean;
}

export const MaritimeMapView: React.FC<MaritimeMapViewProps> = ({
  telemetry,
  vessels,
  entities,
  activeCapability,
  onSelectEntity,
  selectedEntityId,
  compact = false,
}) => {
  const [showPollutionHeat, setShowPollutionHeat] = useState(
    activeCapability === MonitoringCapability.POLLUTION
  );
  const [showBathymetryContours, setShowBathymetryContours] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Map coordinate transform: world (-65..65) -> SVG (0..500)
  const toSvgX = (wx: number) => ((wx + 68) / 136) * 500;
  const toSvgY = (wz: number) => ((wz + 68) / 136) * 340;

  const mpaCx = toSvgX(MPA_ZONE.center.x);
  const mpaCy = toSvgY(MPA_ZONE.center.z);
  const mpaRx = (MPA_ZONE.radius / 136) * 500;
  const mpaRy = (MPA_ZONE.radius / 136) * 340;

  const rovSvgX = toSvgX(telemetry.position.x);
  const rovSvgY = toSvgY(telemetry.position.z);

  const selectedEntity =
    entities.find((e) => e.id === selectedEntityId) ?? entities[0];

  const filteredEntities = entities.filter((e) => {
    if (filterCategory === 'all') return true;
    if (filterCategory === 'red')
      return e.category === 'vessel' || e.category === 'illegal_gear';
    if (filterCategory === 'yellow')
      return e.category === 'pollution' || e.category === 'seabed_anomaly';
    if (filterCategory === 'green') return e.category === 'marine_life';
    return true;
  });

  return (
    <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-3 flex flex-col gap-2.5 h-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-display font-bold tracking-wide text-white uppercase">
            Tactical Maritime & MPA Geospatial Chart
          </h3>
          <p className="text-xs text-slate-400">
            Red = Suspicious Vessel / Illegal Gear · Yellow = Pollution / Anomaly · Green = Marine Life
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['all', 'All Markers'],
              ['red', 'Threats & IUU (Red)'],
              ['yellow', 'Pollution & Seabed (Yellow)'],
              ['green', 'Marine Life (Green)'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterCategory(key)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                filterCategory === key
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'bg-[#091e3a] text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowPollutionHeat((v) => !v)}
            className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
              showPollutionHeat
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                : 'bg-[#091e3a] text-slate-400'
            }`}
          >
            Heat Layer
          </button>
          <button
            type="button"
            onClick={() => setShowBathymetryContours((v) => !v)}
            className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
              showBathymetryContours
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                : 'bg-[#091e3a] text-slate-400'
            }`}
          >
            Bathymetry
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[230px] bg-[#030d1c] border border-cyan-950 rounded overflow-hidden">
        <svg
          viewBox="0 0 500 340"
          className="w-full h-full select-none"
          role="img"
          aria-label="Interactive Maritime Surveillance Map"
        >
          <defs>
            <radialGradient id="pollutionHeatGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.55" />
              <stop offset="60%" stopColor="#ef4444" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mpaGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.04" />
            </radialGradient>
          </defs>

          {/* Grid Lines */}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <React.Fragment key={i}>
              <line
                x1={i * 50}
                y1={0}
                x2={i * 50}
                y2={340}
                stroke="#082f49"
                strokeWidth="0.7"
              />
              <line
                x1={0}
                y1={i * 34}
                x2={500}
                y2={i * 34}
                stroke="#082f49"
                strokeWidth="0.7"
              />
            </React.Fragment>
          ))}

          {/* Bathymetry Depth Contours */}
          {showBathymetryContours && (
            <g stroke="#0e7490" strokeOpacity="0.35" fill="none" strokeDasharray="3 3">
              <ellipse cx={mpaCx} cy={mpaCy} rx={mpaRx * 0.65} ry={mpaRy * 0.65} />
              <ellipse cx={mpaCx} cy={mpaCy} rx={mpaRx * 0.35} ry={mpaRy * 0.35} />
              <ellipse cx={toSvgX(-32)} cy={toSvgY(24)} rx={65} ry={45} />
            </g>
          )}

          {/* MPA Geofence Boundary Zone (SDG 14.5) */}
          <ellipse
            cx={mpaCx}
            cy={mpaCy}
            rx={mpaRx}
            ry={mpaRy}
            fill="url(#mpaGrad)"
            stroke="#06b6d4"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          <text
            x={mpaCx - 72}
            y={mpaCy - mpaRy + 14}
            fill="#22d3ee"
            fontSize="9"
            fontFamily="JetBrains Mono, monospace"
          >
            PALAWAN MPA SANCTUARY (SDG 14.5)
          </text>

          {/* Pollution Heatmap Overlay */}
          {showPollutionHeat && (
            <g>
              <circle
                cx={toSvgX(-18)}
                cy={toSvgY(16)}
                r={52}
                fill="url(#pollutionHeatGrad)"
              />
              <circle
                cx={toSvgX(-28)}
                cy={toSvgY(-12)}
                r={60}
                fill="url(#pollutionHeatGrad)"
              />
            </g>
          )}

          {/* Vessel Trails & Surface Vessels */}
          {vessels.map((v) => {
            const vx = toSvgX(v.position.x);
            const vz = toSvgY(v.position.z);
            const isThreat = v.riskScore > 75;
            const color =
              v.type === 'mothership'
                ? '#38bdf8'
                : isThreat
                ? '#ef4444'
                : '#94a3b8';

            const trailPoints = v.trail
              .map((pt) => `${toSvgX(pt.x)},${toSvgY(pt.z)}`)
              .join(' ');

            return (
              <g key={v.id}>
                <polyline
                  points={trailPoints}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.4"
                  strokeDasharray="3 2"
                  opacity="0.7"
                />
                <polygon
                  points={`${vx},${vz - 6} ${vx + 5},${vz + 5} ${vx - 5},${vz + 5}`}
                  fill={color}
                  stroke="#020617"
                  strokeWidth="1"
                />
                <text
                  x={vx + 8}
                  y={vz + 3}
                  fill={color}
                  fontSize="8.5"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {v.name.slice(0, 15)} {!v.aisActive ? '[AIS-DARK]' : ''}
                </text>
              </g>
            );
          })}

          {/* Tether Line from AEGIS-01 Mothership to ROV */}
          <line
            x1={toSvgX(vessels[0]?.position.x ?? 0)}
            y1={toSvgY(vessels[0]?.position.z ?? 0)}
            x2={rovSvgX}
            y2={rovSvgY}
            stroke="#facc15"
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />

          {/* Underwater Entities Colored Markers */}
          {filteredEntities.map((ent, idx) => {
            const ex = toSvgX(ent.position.x);
            const ey = toSvgY(ent.position.z);
            const isSelected = ent.id === selectedEntity?.id;
            const showLabel =
              !compact &&
              (isSelected ||
                ent.id === 'ent-ghost-net-01' ||
                ent.id === 'ent-plastic-gyre' ||
                ent.id === 'ent-seabed-anomaly' ||
                ent.id === 'ent-oil-plume');

            // Poster color coding: Red = suspicious vessel/illegal gear, Yellow = pollution/anomaly, Green = marine life
            const markerColor =
              ent.category === 'vessel' || ent.category === 'illegal_gear'
                ? '#ef4444'
                : ent.category === 'marine_life'
                ? '#10b981'
                : '#facc15';

            return (
              <g
                key={ent.id}
                onClick={() => onSelectEntity(ent.id)}
                className="cursor-pointer"
              >
                {isSelected && (
                  <circle
                    cx={ex}
                    cy={ey}
                    r={11}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
                <circle
                  cx={ex}
                  cy={ey}
                  r={5.5}
                  fill={markerColor}
                  stroke="#020617"
                  strokeWidth="1.2"
                />
                {showLabel && (
                  <text
                    x={ex + 8}
                    y={ey + (idx % 2 === 0 ? -6 : 11)}
                    fill={isSelected ? '#ffffff' : '#cbd5e1'}
                    fontSize="8.5"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {ent.classLabel.slice(0, 22)}
                  </text>
                )}
              </g>
            );
          })}

          {/* ROV Live Position & Heading Cone */}
          <g transform={`translate(${rovSvgX}, ${rovSvgY}) rotate(${telemetry.heading})`}>
            <polygon
              points="0,0 -16,-32 16,-32"
              fill="rgba(250, 204, 21, 0.22)"
            />
            <circle cx="0" cy="0" r="6" fill="#facc15" stroke="#020617" strokeWidth="1.5" />
            <line x1="0" y1="0" x2="0" y2="-11" stroke="#fef08a" strokeWidth="2" />
          </g>
        </svg>
      </div>

      {/* Selected Contact Evidence Bar */}
      {selectedEntity && (
        <div className="bg-[#040f21] border border-cyan-900/60 rounded p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{selectedEntity.name}</span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-cyan-300">
                {formatTacticalDistanceKm(
                  Math.hypot(
                    selectedEntity.position.x - telemetry.position.x,
                    selectedEntity.position.y - telemetry.position.y,
                    selectedEntity.position.z - telemetry.position.z
                  )
                )}
              </span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-amber-300">
                SDG {selectedEntity.sdgTargets.join(', ')}
              </span>
            </div>
            <p className="text-slate-400 mt-0.5">{selectedEntity.metadata}</p>
          </div>
          <div className="font-mono text-right text-slate-300">
            <div>
              GPS {worldToGps(selectedEntity.position).lat}°N,{' '}
              {worldToGps(selectedEntity.position).lon}°E
            </div>
            <div className="text-emerald-400">
              Risk Score: {selectedEntity.riskScore}/100
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
