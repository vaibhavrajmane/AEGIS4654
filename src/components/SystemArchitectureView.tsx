import React, { useEffect, useState } from 'react';
import { SystemArchitectureNode, Telemetry } from '../types';
import { SYSTEM_ARCHITECTURE_NODES } from '../data/worldSeed';
import { BufferedPacket } from '../lib/dsa';

interface SystemArchitectureViewProps {
  telemetry: Telemetry;
  commsOutage: boolean;
  onToggleCommsOutage: () => void;
  ringBufferState: {
    slots: (BufferedPacket<any> | null)[];
    head: number;
    tail: number;
    count: number;
    capacity: number;
    overwrittenCount: number;
    utilizationPct: number;
  };
  flushedPacketsCount: number;
}

export const SystemArchitectureView: React.FC<SystemArchitectureViewProps> = ({
  telemetry,
  commsOutage,
  onToggleCommsOutage,
  ringBufferState,
  flushedPacketsCount,
}) => {
  const [selectedNodeId, setSelectedNodeId] =
    useState<SystemArchitectureNode['id']>('rov');
  const [activePipelineStep, setActivePipelineStep] = useState<number>(0);
  const [packetTick, setPacketTick] = useState<number>(0);

  // Animate the 4-step AI Pipeline workflow stepper & packet flow
  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivePipelineStep((prev) => (prev + 1) % 4);
      setPacketTick((t) => t + 1);
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  const nodesWithLiveStatus: SystemArchitectureNode[] = SYSTEM_ARCHITECTURE_NODES.map(
    (node) => {
      if (commsOutage) {
        if (node.id === 'rov' || node.id === 'surface_vessel') {
          return {
            ...node,
            status: 'buffering',
            throughputKbps: 0,
          };
        }
        if (node.id === 'satellite' || node.id === 'ground_station') {
          return {
            ...node,
            status: 'offline',
            throughputKbps: 0,
            latencyMs: 9999,
          };
        }
      }
      return {
        ...node,
        packetsProcessed: node.packetsProcessed + packetTick * 3,
      };
    }
  );

  const selectedNode =
    nodesWithLiveStatus.find((n) => n.id === selectedNodeId) ??
    nodesWithLiveStatus[0];

  const pipelineSteps = [
    {
      step: 1,
      title: '1. Data Collection',
      subtitle: 'Sensors · Cameras · 450 kHz Sonar · USBL GPS',
      throughput: `${(14.2 + (packetTick % 3) * 0.4).toFixed(1)} Mbps`,
      latency: '4 ms',
      detail: `ROV Depth ${telemetry.depth.toFixed(1)}m · Water Temp ${telemetry.waterTempC}°C · Turbidity ${telemetry.turbidityNtu} NTU`,
    },
    {
      step: 2,
      title: '2. Processing',
      subtitle: 'Simulated YOLOv8 Vision · Multi-Sensor Fusion',
      throughput: '60 FPS / 24.5 Mbps',
      latency: '18 ms',
      detail: 'Bayesian Optical + Acoustic + Fluorometer fusion & Hash Table MMSI correlation',
    },
    {
      step: 3,
      title: '3. Decision Making',
      subtitle: 'Threat & Anomaly Identification · Max-Heap Triage',
      throughput: 'O(log N) Triage',
      latency: '6 ms',
      detail: 'Binary Max-Heap ranks IUU fishing, ghost net entanglement & oil leaks by riskScore',
    },
    {
      step: 4,
      title: '4. Action',
      subtitle: 'Early Warning Alerts · Tracking · SDG 14 Reports',
      throughput: commsOutage ? 'BUFFERED (RING QUEUE)' : 'LIVE SAT UPLINK',
      latency: commsOutage ? 'QUEUED' : `${telemetry.satelliteLatencyMs} ms`,
      detail: 'Dispatches Coast Guard / MPA Ranger notifications & Gemini AI Mission Briefings',
    },
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="system-architecture-view">
      {/* Poster 4-Step AI Pipeline Workflow Animated Stepper */}
      <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-lg font-display font-bold uppercase text-white">
              AEGIS 4-Stage Autonomous AI & Sensor Fusion Pipeline
            </h2>
            <p className="text-xs text-slate-400">
              Live animated telemetry workflow from subsea transducer capture to satellite enforcement dispatch
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-300">
            ACTIVE STAGE: 0{activePipelineStep + 1} / 04
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {pipelineSteps.map((item, idx) => {
            const isActive = idx === activePipelineStep;
            return (
              <div
                key={item.step}
                className={`p-3 rounded-lg border transition-colors ${
                  isActive
                    ? 'bg-cyan-950/70 border-cyan-400'
                    : 'bg-[#040f21] border-cyan-900/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span
                    className={
                      isActive ? 'text-cyan-300 font-bold' : 'text-slate-400'
                    }
                  >
                    STAGE 0{item.step}
                  </span>
                  <span className="text-emerald-400">
                    {item.throughput} · {item.latency}
                  </span>
                </div>
                <div className="text-sm font-bold text-white">{item.title}</div>
                <div className="text-xs text-cyan-200/90 mt-0.5">{item.subtitle}</div>
                <p className="text-[11px] text-slate-400 mt-1.5">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive System Architecture Topology + Node Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Columns: Interactive Architecture Diagram & Outage Simulator */}
        <div className="lg:col-span-2 bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-display font-bold uppercase text-white">
                End-to-End Maritime Command & Satellite Architecture
              </h3>
              <p className="text-xs text-slate-400">
                Click any node to inspect its telemetry role. Toggle Comms Outage to test ROV Ring Buffer resilience.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleCommsOutage}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                commsOutage
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  : 'bg-red-600 text-white hover:bg-red-500'
              }`}
            >
              {commsOutage
                ? `Restore Satellite Link (Flush ${ringBufferState.count} Buffered Packets)`
                : 'Simulate Comms Outage'}
            </button>
          </div>

          {/* Interactive SVG Network Topology Diagram */}
          <div className="bg-[#030d1c] border border-cyan-950 rounded p-3">
            <svg
              viewBox="0 0 680 250"
              className="w-full h-[230px] select-none"
              role="img"
              aria-label="AEGIS System Architecture Diagram"
            >
              {/* Link Lines */}
              {[
                // ROV <-> Surface Vessel
                { x1: 85, y1: 190, x2: 85, y2: 70, lx: 42, ly: 132, broken: false, label: 'USBL / Tether' },
                // Surface Vessel <-> Satellite
                { x1: 85, y1: 70, x2: 245, y2: 45, lx: 162, ly: 36, broken: commsOutage, label: 'Ku-Band Uplink' },
                // Satellite <-> Ground Station
                { x1: 245, y1: 45, x2: 405, y2: 70, lx: 328, ly: 36, broken: commsOutage, label: 'Ka-Band Downlink' },
                // Ground Station <-> Cloud Server
                { x1: 405, y1: 70, x2: 405, y2: 190, lx: 355, ly: 132, broken: false, label: 'Fiber Backhaul' },
                // Cloud Server <-> Web Dashboard
                { x1: 405, y1: 190, x2: 580, y2: 115, lx: 488, ly: 138, broken: false, label: 'WSS Stream' },
                // Web Dashboard <-> Alerts Hub
                { x1: 580, y1: 115, x2: 580, y2: 205, lx: 628, ly: 162, broken: false, label: 'Alert Dispatch' },
              ].map((link, idx) => {
                const t = ((packetTick % 4) + 1) / 5;
                const px = link.x1 + (link.x2 - link.x1) * t;
                const py = link.y1 + (link.y2 - link.y1) * t;
                return (
                  <g key={idx}>
                    <line
                      x1={link.x1}
                      y1={link.y1}
                      x2={link.x2}
                      y2={link.y2}
                      stroke={link.broken ? '#ef4444' : '#0891b2'}
                      strokeWidth="2"
                      strokeDasharray={link.broken ? '5 5' : '4 2'}
                    />
                    {!link.broken && (
                      <circle cx={px} cy={py} r="4" fill="#facc15" />
                    )}
                    <text
                      x={link.lx}
                      y={link.ly}
                      textAnchor="middle"
                      fill={link.broken ? '#f87171' : '#94a3b8'}
                      fontSize="8.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {link.broken ? 'LINK DROPPED' : link.label}
                    </text>
                  </g>
                );
              })}

              {/* Clickable Architecture Nodes */}
              {(
                [
                  { id: 'rov', x: 85, y: 190, title: 'Underwater ROV', sub: 'Subsea Edge' },
                  { id: 'surface_vessel', x: 85, y: 70, title: 'Surface Vessel', sub: 'AEGIS-01 USV' },
                  { id: 'satellite', x: 245, y: 45, title: 'LEO Satellite', sub: 'Orbital Relay' },
                  { id: 'ground_station', x: 405, y: 70, title: 'Ground Station', sub: 'Coastal Gateway' },
                  { id: 'cloud_server', x: 405, y: 190, title: 'Cloud AI Server', sub: 'Fusion & Gemini' },
                  { id: 'web_dashboard', x: 580, y: 115, title: 'Web Dashboard', sub: 'Command UI' },
                  { id: 'alerts_hub', x: 580, y: 205, title: 'Alerts & Dispatch', sub: 'Email/SMS/App' },
                ] as const
              ).map((n) => {
                const isSelected = selectedNodeId === n.id;
                const nodeState = nodesWithLiveStatus.find((item) => item.id === n.id);
                const borderCol =
                  nodeState?.status === 'offline'
                    ? '#ef4444'
                    : nodeState?.status === 'buffering'
                    ? '#f59e0b'
                    : isSelected
                    ? '#facc15'
                    : '#06b6d4';

                return (
                  <g
                    key={n.id}
                    onClick={() => setSelectedNodeId(n.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={n.x - 62}
                      y={n.y - 22}
                      width="124"
                      height="44"
                      rx="6"
                      fill={isSelected ? '#0c2d57' : '#061830'}
                      stroke={borderCol}
                      strokeWidth={isSelected ? '2.2' : '1.4'}
                    />
                    <text
                      x={n.x}
                      y={n.y - 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {n.title}
                    </text>
                    <text
                      x={n.x}
                      y={n.y + 11}
                      textAnchor="middle"
                      fill="#7dd3fc"
                      fontSize="8.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {n.sub}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Outage Ring Buffer Status Strip */}
          <div className="bg-[#040f21] border border-cyan-900/50 rounded p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400">COMMS STATE: </span>
              <span
                className={
                  commsOutage
                    ? 'text-amber-300 font-bold'
                    : 'text-emerald-400 font-bold'
                }
              >
                {commsOutage
                  ? `OUTAGE ACTIVE — ROV Circular Queue Buffering (${ringBufferState.count}/${ringBufferState.capacity} slots)`
                  : `NOMINAL LINK — ${flushedPacketsCount} Buffered Packets Flushed to Ground Station`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {nodesWithLiveStatus.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedNodeId(n.id)}
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    selectedNodeId === n.id
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-[#091e3a] text-slate-300'
                  }`}
                >
                  {n.id.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Node Inspector Panel */}
        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-2">
              <div>
                <div className="text-xs font-mono text-cyan-400 uppercase">
                  NODE INSPECTOR
                </div>
                <h3 className="text-lg font-display font-bold text-white">
                  {selectedNode.name}
                </h3>
                <div className="text-xs text-slate-400">{selectedNode.subtitle}</div>
              </div>
              <span
                className={`text-xs font-mono font-bold uppercase ${
                  selectedNode.status === 'nominal'
                    ? 'text-emerald-400'
                    : selectedNode.status === 'buffering'
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                [{selectedNode.status}]
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedNode.roleDescription}
            </p>

            <div className="grid grid-cols-3 gap-2 font-mono text-xs bg-[#040f21] p-2.5 rounded border border-cyan-900/50">
              <div>
                <div className="text-[10px] text-slate-400">THROUGHPUT</div>
                <div className="text-cyan-300 font-semibold">
                  {(selectedNode.throughputKbps / 1000).toFixed(1)} Mbps
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">LATENCY</div>
                <div className="text-amber-300 font-semibold">
                  {selectedNode.latencyMs} ms
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">FRAMES</div>
                <div className="text-emerald-300 font-semibold">
                  {selectedNode.packetsProcessed.toLocaleString()}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-white mb-1.5">
                Technical Specifications:
              </div>
              <ul className="space-y-1 text-xs text-slate-300">
                {selectedNode.specs.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-mono">·</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-cyan-900/50 text-[11px] font-mono text-slate-400">
            Click any node in the architecture diagram to inspect live telemetry metrics.
          </div>
        </div>
      </div>
    </div>
  );
};
