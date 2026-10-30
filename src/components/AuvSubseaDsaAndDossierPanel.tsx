import React from 'react';
import {
  BreadcrumbNode,
  HydrophoneRingPacket,
  LiveOscillatedVessel,
  SubseaEvidenceRecord,
  SubseaVisionMode,
} from '../data/aegisFleet20';

interface AuvSubseaDsaAndDossierPanelProps {
  vessel: LiveOscillatedVessel;
  visionMode: SubseaVisionMode;
  breadcrumbs: BreadcrumbNode[];
  isBacktracking: boolean;
  onTriggerBacktrack: () => void;
  onPushManualBreadcrumb: () => void;
  ringSnapshot: {
    slots: (HydrophoneRingPacket | null)[];
    head: number;
    tail: number;
    count: number;
    capacity: number;
    overwrittenCount: number;
    utilizationPct: number;
  };
  signalBlackout: boolean;
  onToggleSignalBlackout: () => void;
  onEnqueueHydrophonePacket: () => void;
  flushedToArgusCount: number;
  evidenceLog: SubseaEvidenceRecord[];
  onCaptureEvidence: (anomalyId?: string) => void;
  onExportDossierJson: () => void;
}

export const AuvSubseaDsaAndDossierPanel: React.FC<
  AuvSubseaDsaAndDossierPanelProps
> = ({
  vessel,
  visionMode,
  breadcrumbs,
  isBacktracking,
  onTriggerBacktrack,
  onPushManualBreadcrumb,
  ringSnapshot,
  signalBlackout,
  onToggleSignalBlackout,
  onEnqueueHydrophonePacket,
  flushedToArgusCount,
  evidenceLog,
  onCaptureEvidence,
  onExportDossierJson,
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* 1. LIFO BREADCRUMB STACK BACKTRACKING MODULE */}
      <section className="bg-[#051329] border border-cyan-900/70 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-display font-bold uppercase text-white">
              1. Stack (LIFO) Breadcrumb Backtracking
            </h3>
            <p className="text-[11px] font-mono text-cyan-300">
              O(1) Push/Pop · 100% Recovery Rate · Trigger &lt; -95 dBm
            </p>
          </div>
          <span
            className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
              isBacktracking
                ? 'bg-amber-400 text-slate-950'
                : 'bg-[#081d38] text-emerald-300'
            }`}
          >
            {isBacktracking ? 'POPPING LIFO' : `STACK DEPTH: ${breadcrumbs.length}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onTriggerBacktrack}
            className="flex-1 py-1.5 px-2.5 rounded bg-amber-400 text-slate-950 hover:bg-amber-300 font-mono text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            {isBacktracking
              ? `Popping Nodes (${breadcrumbs.length} left)...`
              : 'Trigger LIFO Stack Backtrack'}
          </button>
          <button
            type="button"
            onClick={onPushManualBreadcrumb}
            className="py-1.5 px-2.5 rounded bg-[#081d38] border border-cyan-700 text-cyan-200 hover:bg-cyan-900/60 font-mono text-xs cursor-pointer whitespace-nowrap"
          >
            + Push Node
          </button>
        </div>

        {/* Visual Stack Frames (Top of Stack first = LIFO) */}
        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
          {breadcrumbs
            .slice()
            .reverse()
            .slice(0, 6)
            .map((node, i) => (
              <div
                key={node.id}
                className={`px-2 py-1 rounded border font-mono text-[11px] flex items-center justify-between ${
                  i === 0
                    ? 'bg-amber-950/50 border-amber-500/70 text-amber-200'
                    : 'bg-[#030d1d] border-cyan-950 text-slate-300'
                }`}
              >
                <span>
                  {i === 0 ? '[TOP] ' : `[#${node.index}] `}({node.x}m, {node.y}m,{' '}
                  {node.depth}m, {node.heading}°)
                </span>
                <span className="text-slate-400">
                  {node.signalDbm} dBm · {node.timestamp}
                </span>
              </div>
            ))}
        </div>
      </section>

      {/* 2. 16-SLOT CIRCULAR QUEUE (RING BUFFER) OFFLINE HYDROPHONE TELEMETRY */}
      <section className="bg-[#051329] border border-cyan-900/70 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-display font-bold uppercase text-white">
              2. Circular Queue (16-Slot Ring Buffer)
            </h3>
            <p className="text-[11px] font-mono text-cyan-300">
              O(1) Enqueue/Dequeue · Downlink: USCG CUTTER ARGUS
            </p>
          </div>
          <span className="font-mono text-[11px] text-amber-300">
            {ringSnapshot.count}/16 Slots ({ringSnapshot.utilizationPct}%)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSignalBlackout}
            className={`flex-1 py-1.5 px-2.5 rounded font-mono text-xs font-bold cursor-pointer whitespace-nowrap ${
              signalBlackout
                ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                : 'bg-red-500/20 border border-red-400 text-red-200 hover:bg-red-500 hover:text-white'
            }`}
          >
            {signalBlackout
              ? 'Surface & Flush Buffer (USCG ARGUS)'
              : 'Simulate Signal Blackout'}
          </button>
          <button
            type="button"
            onClick={onEnqueueHydrophonePacket}
            className="py-1.5 px-2.5 rounded bg-[#081d38] border border-cyan-700 text-cyan-200 hover:bg-cyan-900/60 font-mono text-xs cursor-pointer whitespace-nowrap"
          >
            + Record Packet
          </button>
        </div>

        {/* 16-Slot Visual Ring Buffer Grid */}
        <div className="grid grid-cols-8 gap-1">
          {ringSnapshot.slots.map((pkt, idx) => {
            const isHead = idx === ringSnapshot.head && ringSnapshot.count > 0;
            const isTail = idx === ringSnapshot.tail;
            return (
              <div
                key={idx}
                title={
                  pkt
                    ? `Slot ${idx}: #${pkt.seq} | ${pkt.cavitationHz}Hz | ${pkt.sonarPingDb}dB | Draft ${pkt.hullDraftDelta} | ${pkt.encryptedHash}`
                    : `Slot ${idx}: Empty`
                }
                className={`p-1 rounded border text-center font-mono text-[10px] ${
                  pkt
                    ? isHead
                      ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                      : 'bg-cyan-950/70 border-cyan-500/70 text-cyan-200'
                    : isTail
                    ? 'bg-[#030d1d] border-yellow-400/70 text-yellow-300'
                    : 'bg-[#030d1d] border-cyan-950 text-slate-500'
                }`}
              >
                <div className="font-bold">S{idx.toString().padStart(2, '0')}</div>
                <div className="truncate">{pkt ? `#${pkt.seq}` : '—'}</div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>
            HEAD: S{ringSnapshot.head.toString().padStart(2, '0')} · TAIL: S
            {ringSnapshot.tail.toString().padStart(2, '0')}
          </span>
          <span className="text-emerald-300">
            Flushed to ARGUS: {flushedToArgusCount} pkts
          </span>
        </div>
      </section>

      {/* 3. SUBSEA EVIDENCE CAPTURE & CRYPTOGRAPHIC DOSSIER LOGGER */}
      <section className="bg-[#051329] border border-cyan-900/70 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-display font-bold uppercase text-white">
              3. Subsea Evidence & Boarding Dossier
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Court-Admissible SHA-256 Telemetry & Hull Infraction Logger
            </p>
          </div>
          <button
            type="button"
            onClick={onExportDossierJson}
            className="px-2.5 py-1 rounded bg-[#081d38] border border-cyan-600 text-cyan-200 hover:bg-cyan-800 font-mono text-[11px] cursor-pointer whitespace-nowrap"
          >
            Export Dossier JSON
          </button>
        </div>

        {/* Vessel Subsea Anomalies Quick-Lock List */}
        <div className="space-y-1.5">
          {vessel.subseaAnomalies.map((anom) => (
            <div
              key={anom.id}
              className="bg-[#030d1d] border border-cyan-900/60 rounded p-2 text-xs flex items-start justify-between gap-2"
            >
              <div>
                <div className="font-mono font-bold text-amber-300">
                  {anom.title}
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  {anom.description}
                </div>
                <div className="text-[10px] font-mono text-cyan-400 mt-0.5">
                  Depth: {anom.depthRange} · {anom.sdgTarget}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCaptureEvidence(anom.id)}
                className="px-2.5 py-1 rounded bg-emerald-400 text-slate-950 hover:bg-emerald-300 font-mono text-[11px] font-bold shrink-0 cursor-pointer whitespace-nowrap"
              >
                Lock & Capture
              </button>
            </div>
          ))}
        </div>

        {/* Captured Cryptographic Dossier Frames */}
        <div className="border-t border-cyan-900/60 pt-2 space-y-1.5 max-h-44 overflow-y-auto">
          <div className="text-[11px] font-mono text-slate-400 uppercase">
            Logged Evidence Frames ({evidenceLog.length})
          </div>
          {evidenceLog.map((ev) => (
            <div
              key={ev.id}
              className="bg-[#020916] border border-cyan-950 rounded p-2 font-mono text-[11px] space-y-0.5"
            >
              <div className="flex items-center justify-between text-cyan-300 font-bold">
                <span>
                  {ev.vesselId} ({ev.codename}) · {ev.visionMode}
                </span>
                <span className="text-slate-400">{ev.timestamp}</span>
              </div>
              <div className="text-white">{ev.anomalyTitle}</div>
              <div className="text-slate-400">
                Draft: {ev.measuredDraftMeters}m (
                {ev.draftDeltaMeters > 0
                  ? `+${ev.draftDeltaMeters}m Over`
                  : 'Nominal'}
                ) · AUV Depth: {ev.auvDepthMeters}m
              </div>
              <div className="text-[10px] text-emerald-400 truncate">
                SHA-256: {ev.cryptoHash}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
