import React, { useState } from 'react';
import { LiveOscillatedVessel } from '../data/aegisFleet20';

interface AuvTacticalRadarAndMapProps {
  vessels: LiveOscillatedVessel[];
  selectedVessel: LiveOscillatedVessel;
  onSelectVessel: (vesselId: string) => void;
}

export const AuvTacticalRadarAndMap: React.FC<AuvTacticalRadarAndMapProps> = ({
  vessels,
  selectedVessel,
  onSelectVessel,
}) => {
  const [mapMode, setMapMode] = useState<'VOYAGE_SVG' | 'SURFACE_RADAR' | 'LEAFLET_GRID'>('VOYAGE_SVG');

  return (
    <div className="bg-[#051329] border border-cyan-900/70 rounded-lg p-3 flex flex-col gap-2.5">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-display font-bold uppercase text-white tracking-wide">
            Surface Mini-Radar, Voyage SVG & DLL Trajectory Inspector
          </h3>
          <p className="text-[11px] font-mono text-slate-400">
            Leaflet Pos: [{selectedVessel.leafletPos[0]}, {selectedVessel.leafletPos[1]}] · Radar: X:{selectedVessel.radarPos.xPct}%, Y:{selectedVessel.radarPos.yPct}% · Zone: {selectedVessel.voyageRoute.protectedZone}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {(
            [
              ['VOYAGE_SVG', 'Voyage SVG & Stops'],
              ['SURFACE_RADAR', 'Surface Radar (X/Y%)'],
              ['LEAFLET_GRID', 'Leaflet Geo-Plot'],
            ] as const
          ).map(([mId, mLabel]) => (
            <button
              key={mId}
              type="button"
              onClick={() => setMapMode(mId)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mapMode === mId
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-[#081d38] text-slate-300 hover:text-white'
              }`}
            >
              {mLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive SVG Map / Radar Canvas */}
      <div className="relative w-full h-[220px] bg-[#020b18] border border-cyan-900/60 rounded overflow-hidden">
        {mapMode === 'VOYAGE_SVG' && (
          <svg
            viewBox="0 0 1000 380"
            className="w-full h-full"
            aria-label="Voyage Route SVG Trajectory Map"
          >
            {/* Grid Lines */}
            {[100, 250, 400, 550, 700, 850].map((x) => (
              <line
                key={`vx-${x}`}
                x1={x}
                y1={0}
                x2={x}
                y2={380}
                stroke="#0c2d48"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}
            {[80, 160, 240, 320].map((y) => (
              <line
                key={`vy-${y}`}
                x1={0}
                y1={y}
                x2={1000}
                y2={y}
                stroke="#0c2d48"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}

            {/* Protected Sanctuary Polygon Overlay */}
            <polygon
              points="310,160 660,150 710,310 330,320"
              fill="rgba(239, 68, 68, 0.08)"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text
              x={340}
              y={178}
              fill="#fca5a5"
              fontSize="12"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="bold"
            >
              {selectedVessel.voyageRoute.protectedZone}
            </text>

            {/* Planned Route Line: Origin -> Current -> Destination */}
            <polyline
              points={`${selectedVessel.voyageRoute.originSvg[0]},${selectedVessel.voyageRoute.originSvg[1]} ${selectedVessel.waypoints
                .map((w) => (w.svgPos ? `${w.svgPos[0]},${w.svgPos[1]}` : ''))
                .filter(Boolean)
                .join(' ')} ${selectedVessel.voyageRoute.currentSvg[0]},${selectedVessel.voyageRoute.currentSvg[1]} ${selectedVessel.voyageRoute.destSvg[0]},${selectedVessel.voyageRoute.destSvg[1]}`}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeDasharray="8 4"
            />

            {/* Origin Port Marker */}
            <circle
              cx={selectedVessel.voyageRoute.originSvg[0]}
              cy={selectedVessel.voyageRoute.originSvg[1]}
              r={6}
              fill="#10b981"
            />
            <text
              x={selectedVessel.voyageRoute.originSvg[0] + 10}
              y={selectedVessel.voyageRoute.originSvg[1] + 4}
              fill="#6ee7b7"
              fontSize="12"
              fontFamily="JetBrains Mono, monospace"
            >
              ORIGIN: {selectedVessel.voyageRoute.originPort} ({selectedVessel.voyageRoute.originSvg[0]},{selectedVessel.voyageRoute.originSvg[1]})
            </text>

            {/* Destination Port Marker */}
            <circle
              cx={selectedVessel.voyageRoute.destSvg[0]}
              cy={selectedVessel.voyageRoute.destSvg[1]}
              r={6}
              fill="#a855f7"
            />
            <text
              x={Math.min(selectedVessel.voyageRoute.destSvg[0] - 180, 740)}
              y={Math.max(selectedVessel.voyageRoute.destSvg[1] - 10, 24)}
              fill="#d8b4fe"
              fontSize="12"
              fontFamily="JetBrains Mono, monospace"
            >
              DEST: {selectedVessel.voyageRoute.destPort} ({selectedVessel.voyageRoute.destSvg[0]},{selectedVessel.voyageRoute.destSvg[1]})
            </text>

            {/* Varying Waypoints (STOP #1, STOP #2, STOP #3 / ALERT #1, #2) */}
            {selectedVessel.waypoints.map((wp) => {
              if (!wp.svgPos) return null;
              return (
                <g key={wp.id}>
                  <circle
                    cx={wp.svgPos[0]}
                    cy={wp.svgPos[1]}
                    r={7}
                    fill="#f59e0b"
                    stroke="#020b18"
                    strokeWidth="2"
                  />
                  <text
                    x={wp.svgPos[0] + 10}
                    y={wp.svgPos[1] - 6}
                    fill="#fde047"
                    fontSize="12"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="bold"
                  >
                    {wp.label} ({wp.svgPos[0]},{wp.svgPos[1]})
                  </text>
                </g>
              );
            })}

            {/* Current Vessel SVG Position */}
            <g>
              <circle
                cx={selectedVessel.voyageRoute.currentSvg[0]}
                cy={selectedVessel.voyageRoute.currentSvg[1]}
                r={12}
                fill="rgba(239, 68, 68, 0.28)"
                stroke="#ef4444"
                strokeWidth="2"
              />
              <circle
                cx={selectedVessel.voyageRoute.currentSvg[0]}
                cy={selectedVessel.voyageRoute.currentSvg[1]}
                r={5.5}
                fill="#facc15"
              />
              <text
                x={Math.min(selectedVessel.voyageRoute.currentSvg[0] + 14, 720)}
                y={selectedVessel.voyageRoute.currentSvg[1] + 5}
                fill="#ffffff"
                fontSize="13"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="bold"
              >
                {selectedVessel.id}: {selectedVessel.codename} (SVG {selectedVessel.voyageRoute.currentSvg[0]},{selectedVessel.voyageRoute.currentSvg[1]})
              </text>
            </g>
          </svg>
        )}

        {mapMode === 'SURFACE_RADAR' && (
          <svg
            viewBox="0 0 400 220"
            className="w-full h-full"
            aria-label="Surface Mini-Radar Plot"
          >
            {/* Radar Rings */}
            {[35, 70, 105].map((r) => (
              <circle
                key={r}
                cx={200}
                cy={110}
                r={r}
                fill="none"
                stroke="#0e3a5c"
                strokeWidth="1"
              />
            ))}
            <line x1={0} y1={110} x2={400} y2={110} stroke="#0e3a5c" strokeWidth="1" />
            <line x1={200} y1={0} x2={200} y2={220} stroke="#0e3a5c" strokeWidth="1" />

            {/* Plot all filtered vessels by radarPos (xPct, yPct) */}
            {vessels.map((v) => {
              const cx = (v.radarPos.xPct / 100) * 380 + 10;
              const cy = (v.radarPos.yPct / 100) * 195 + 12;
              const isSel = v.id === selectedVessel.id;
              const fill =
                v.status === 'CRITICAL'
                  ? '#ef4444'
                  : v.status === 'ALERTIVE'
                  ? '#f59e0b'
                  : '#10b981';
              return (
                <g
                  key={v.id}
                  onClick={() => onSelectVessel(v.id)}
                  className="cursor-pointer"
                >
                  {isSel && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={10}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2"
                    />
                  )}
                  <circle cx={cx} cy={cy} r={isSel ? 5.5 : 4} fill={fill} />
                  {(isSel || v.status !== 'NORMAL') && (
                    <text
                      x={cx + 7}
                      y={cy + 3}
                      fill={isSel ? '#ffffff' : '#cbd5e1'}
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {v.id} ({v.radarPos.xPct}%,{v.radarPos.yPct}%)
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {mapMode === 'LEAFLET_GRID' && (
          <svg
            viewBox="0 0 600 220"
            className="w-full h-full"
            aria-label="Leaflet Coordinate Geo-Plot"
          >
            {/* Equator & Prime Meridian Reference */}
            <line x1={0} y1={110} x2={600} y2={110} stroke="#164e63" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={300} y1={0} x2={300} y2={220} stroke="#164e63" strokeWidth="1" strokeDasharray="3 3" />
            {vessels.map((v) => {
              // Map leafletPos [-60..60, -180..180] into [0..600, 0..220]
              const x = ((v.leafletPos[1] + 180) / 360) * 560 + 20;
              const y = ((65 - v.leafletPos[0]) / 130) * 190 + 15;
              const isSel = v.id === selectedVessel.id;
              const color =
                v.status === 'CRITICAL'
                  ? '#ef4444'
                  : v.status === 'ALERTIVE'
                  ? '#f59e0b'
                  : '#22d3ee';
              return (
                <g
                  key={v.id}
                  onClick={() => onSelectVessel(v.id)}
                  className="cursor-pointer"
                >
                  {isSel && (
                    <circle cx={x} cy={y} r={10} fill="none" stroke="#facc15" strokeWidth="2" />
                  )}
                  <circle cx={x} cy={y} r={4.5} fill={color} />
                  {(isSel || v.riskScore >= 65) && (
                    <text
                      x={Math.min(x + 7, 470)}
                      y={y + 3}
                      fill={isSel ? '#fde047' : '#94a3b8'}
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {v.id} [{v.leafletPos[0]}, {v.leafletPos[1]}]
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Waypoints & Doubly Linked List (DLL) Trajectory Nodes Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 text-xs">
        {/* Varying Waypoints List */}
        <div className="bg-[#030e1f] border border-cyan-950 rounded p-2 space-y-1">
          <div className="font-mono text-[11px] font-bold text-amber-300 uppercase">
            Varying Waypoints ({selectedVessel.voyageRoute.originPort} → {selectedVessel.voyageRoute.destPort})
          </div>
          {selectedVessel.waypoints.map((wp) => (
            <div
              key={wp.id}
              className="text-[11px] font-mono text-slate-300 flex flex-col border-b border-cyan-950/60 pb-1 last:border-none"
            >
              <div>
                <span className="text-yellow-300 font-bold">{wp.label}</span> ·{' '}
                <span className="text-cyan-300">{wp.coords}</span>
                {wp.svgPos && (
                  <span className="text-slate-400">
                    {' '}
                    (SVG: {wp.svgPos[0]},{wp.svgPos[1]})
                  </span>
                )}
              </div>
              <div className="text-slate-400">{wp.summary}</div>
            </div>
          ))}
        </div>

        {/* Doubly Linked List (DLL) Trajectory Nodes */}
        <div className="bg-[#030e1f] border border-cyan-950 rounded p-2 space-y-1">
          <div className="font-mono text-[11px] font-bold text-cyan-300 uppercase">
            DLL Trajectory Nodes (Temporal Delta Traversal)
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {selectedVessel.dllTrajectoryNodes.map((node, idx) => (
              <React.Fragment key={node.id}>
                <div className="bg-[#071a33] border border-cyan-800/70 rounded px-2 py-1 font-mono text-[11px]">
                  <div className="text-yellow-300 font-bold">
                    {node.id} ({node.time})
                  </div>
                  <div className="text-slate-200">
                    [{node.coords[0]}, {node.coords[1]}] · {node.speedKts} kts
                  </div>
                  {node.note && (
                    <div className="text-red-300 text-[10px]">{node.note}</div>
                  )}
                </div>
                {idx < selectedVessel.dllTrajectoryNodes.length - 1 && (
                  <span className="font-mono text-cyan-400 font-bold">⇄</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
