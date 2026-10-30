import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AEGIS_20_VESSELS,
  AuvBreadcrumbStack,
  BreadcrumbNode,
  GearTypeFilter,
  HydrophoneCircularQueue16,
  MatrixStatusFilter,
  RiskTierFilter,
  SubseaEvidenceRecord,
  SubseaVisionMode,
  ThreatFocusFilter,
  computeOscillatedFleet,
  filterAegisVessels,
} from '../data/aegisFleet20';
import { AuvSubseaViewport3D } from './AuvSubseaViewport3D';
import { AuvTacticalRadarAndMap } from './AuvTacticalRadarAndMap';
import { AuvSubseaDsaAndDossierPanel } from './AuvSubseaDsaAndDossierPanel';

interface AuvInterceptorCommandViewProps {
  onShowToast: (msg: string) => void;
}

export const AuvInterceptorCommandView: React.FC<
  AuvInterceptorCommandViewProps
> = ({ onShowToast }) => {
  // 1. Live 2.5-Second Telemetry Ticker State
  const [tickerStep, setTickerStep] = useState<number>(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTickerStep((t) => t + 1);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const liveFleet = useMemo(
    () => computeOscillatedFleet(AEGIS_20_VESSELS, tickerStep),
    [tickerStep]
  );

  // 2. Synchronized Multi-Mode Filter State
  const [threatFocus, setThreatFocus] = useState<ThreatFocusFilter>('ALL');
  const [riskTier, setRiskTier] = useState<RiskTierFilter>('ALL_SHIPS');
  const [matrixStatus, setMatrixStatus] = useState<MatrixStatusFilter>('ALL');
  const [flagFilter, setFlagFilter] = useState<string>('ALL');
  const [gearFilter, setGearFilter] = useState<GearTypeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredVessels = useMemo(
    () =>
      filterAegisVessels(liveFleet, {
        threatFocus,
        riskTier,
        matrixStatus,
        flagName: flagFilter,
        gearType: gearFilter,
        searchQuery,
      }),
    [liveFleet, threatFocus, riskTier, matrixStatus, flagFilter, gearFilter, searchQuery]
  );

  // Selected Target Vessel (Default: V-001 "OCEAN GHOST" / FV HAI LONG 88)
  const [selectedVesselId, setSelectedVesselId] = useState<string>('V-001');

  const selectedVessel = useMemo(() => {
    return (
      liveFleet.find((v) => v.id === selectedVesselId) ||
      filteredVessels[0] ||
      liveFleet[0]
    );
  }, [liveFleet, filteredVessels, selectedVesselId]);

  // 3. AUV-09 Vision Mode & Flight Position State
  const [visionMode, setVisionMode] = useState<SubseaVisionMode>('OPTICAL');
  const [auvPos, setAuvPos] = useState({
    x: -6,
    y: 0,
    z: 8,
    heading: 142,
    depth: 48,
  });
  const [sonarPingCount, setSonarPingCount] = useState<number>(0);

  // 4. LIFO Breadcrumb Stack State
  const breadcrumbStackRef = useRef<AuvBreadcrumbStack>(
    new AuvBreadcrumbStack(32)
  );
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbNode[]>(() => {
    const st = breadcrumbStackRef.current;
    if (st.size() === 0) {
      st.push({ x: -16, y: 14, depth: 15, heading: 110, timestamp: '05:08:10', signalDbm: -64 });
      st.push({ x: -12, y: 11, depth: 28, heading: 125, timestamp: '05:08:45', signalDbm: -71 });
      st.push({ x: -8, y: 9, depth: 42, heading: 138, timestamp: '05:09:20', signalDbm: -79 });
      st.push({ x: -6, y: 8, depth: 48, heading: 142, timestamp: '05:10:00', signalDbm: -84 });
    }
    return st.getNodes();
  });
  const [isBacktracking, setIsBacktracking] = useState<boolean>(false);

  // 5. 16-Slot Circular Queue (Ring Buffer) State for Offline Hydrophone Telemetry
  const hydroRingRef = useRef<HydrophoneCircularQueue16>(
    new HydrophoneCircularQueue16()
  );
  const packetSeqRef = useRef<number>(400);
  const [signalBlackout, setSignalBlackout] = useState<boolean>(false);
  const [flushedToArgusCount, setFlushedToArgusCount] = useState<number>(32);
  const [ringSnapshot, setRingSnapshot] = useState(() => {
    const q = hydroRingRef.current;
    if (q.getSnapshot().count === 0) {
      for (let i = 1; i <= 6; i++) {
        packetSeqRef.current += 1;
        q.enqueue({
          seq: packetSeqRef.current,
          vesselId: 'V-001',
          timestamp: `05:09:${(10 + i * 5).toString().padStart(2, '0')}`,
          cavitationHz: 140 + i,
          sonarPingDb: 168,
          hullDraftDelta: '+1.4m',
          encryptedHash: `0x9f4a${(8100 + i * 17).toString(16)}`,
        });
      }
    }
    return q.getSnapshot();
  });

  // 6. Court-Admissible Subsea Evidence Dossier Log
  const [evidenceLog, setEvidenceLog] = useState<SubseaEvidenceRecord[]>([
    {
      id: 'EVID-901',
      vesselId: 'V-001',
      vesselName: 'FV HAI LONG 88',
      codename: 'OCEAN GHOST',
      mmsi: '412789120',
      imo: '9144820',
      timestamp: '05:09:42 UTC',
      visionMode: 'LASER_DRAFT',
      coordinates: '04°18\'22"S 082°44\'09"W',
      auvDepthMeters: 48,
      measuredDraftMeters: 5.2,
      draftDeltaMeters: 1.4,
      anomalyTitle: 'Overloaded Plimsoll Waterline Draft (+1.4m Heavier)',
      findingSummary:
        'Laser profiler verified 5.2m hull draft (+1.4m above ballast manifest) inside Galápagos Sanctuary Polygon #4 while AIS dark.',
      sdgTarget: 'SDG 14.4 & 14.5',
      cryptoHash: 'a8f5c29e14d0987b4c21e0f991a77438d2e1b6c88a904f12e33d81029cb4471a',
      severity: 'CRITICAL',
    },
    {
      id: 'EVID-902',
      vesselId: 'V-002',
      vesselName: 'HAI QING 12',
      codename: 'SHADOW REEFER',
      mmsi: '413890211',
      imo: '9348123',
      timestamp: '05:10:05 UTC',
      visionMode: 'THERMAL',
      coordinates: '02°11\'05"S 085°18\'33"W',
      auvDepthMeters: 35,
      measuredDraftMeters: 6.8,
      draftDeltaMeters: 2.1,
      anomalyTitle: 'Plimsoll Mark Submerged +2.1m (6.8m Deep Draft)',
      findingSummary:
        'Hull-to-hull rubber fenders & +2.1m mid-ocean draft increase recorded during 4h 45m telemetry gap.',
      sdgTarget: 'SDG 14.1 & 14.4',
      cryptoHash: 'c3e91b7402a881d4f6601bc9247710a5e8f992014c72d8104a66e2189b03ef29',
      severity: 'CRITICAL',
    },
  ]);

  // Select & deploy AUV-09 beneath target vessel
  const handleSelectVessel = useCallback(
    (vesselId: string) => {
      setSelectedVesselId(vesselId);
      const target = liveFleet.find((v) => v.id === vesselId);
      if (target) {
        const defaultDepth = Math.round(
          Math.max(18, target.baseDraftMeters * 4.5)
        );
        setAuvPos({
          x: -5,
          y: 0,
          z: 7,
          heading: target.baseHeadingDeg,
          depth: defaultDepth,
        });
        breadcrumbStackRef.current.push({
          x: -5,
          y: 7,
          depth: defaultDepth,
          heading: target.baseHeadingDeg,
          timestamp: new Date().toISOString().slice(11, 19),
          signalDbm: -74,
        });
        setBreadcrumbs(breadcrumbStackRef.current.getNodes());
        onShowToast(
          `Deployed AUV-09 POSEIDON-EYE beneath ${target.id} ("${target.codename}" / ${target.vesselName}) — Draft ${target.liveDraftMeters}m`
        );
      }
    },
    [liveFleet, onShowToast]
  );

  // Move AUV-09 & push node onto LIFO Breadcrumb Stack
  const handleMoveAuv = useCallback(
    (dx: number, dDepth: number, dz: number, dHeading: number) => {
      setAuvPos((prev) => {
        const nextX = Number(Math.max(-24, Math.min(24, prev.x + dx)).toFixed(1));
        const nextZ = Number(Math.max(-20, Math.min(20, prev.z + dz)).toFixed(1));
        const nextDepth = Math.max(4, Math.min(280, Math.round(prev.depth + dDepth)));
        const nextHeading = (prev.heading + dHeading + 360) % 360;
        const signalDbm = Math.round(-60 - nextDepth * 0.28);

        breadcrumbStackRef.current.push({
          x: nextX,
          y: nextZ,
          depth: nextDepth,
          heading: nextHeading,
          timestamp: new Date().toISOString().slice(11, 19),
          signalDbm,
        });
        setBreadcrumbs(breadcrumbStackRef.current.getNodes());

        return {
          x: nextX,
          y: prev.y,
          z: nextZ,
          heading: nextHeading,
          depth: nextDepth,
        };
      });
    },
    []
  );

  // Push manual breadcrumb node
  const handlePushManualBreadcrumb = useCallback(() => {
    const signalDbm = Math.round(-62 - auvPos.depth * 0.25);
    breadcrumbStackRef.current.push({
      x: Number((auvPos.x + (Math.random() * 4 - 2)).toFixed(1)),
      y: Number((auvPos.z + (Math.random() * 4 - 2)).toFixed(1)),
      depth: auvPos.depth + 4,
      heading: auvPos.heading,
      timestamp: new Date().toISOString().slice(11, 19),
      signalDbm,
    });
    setBreadcrumbs(breadcrumbStackRef.current.getNodes());
    onShowToast(
      `Pushed coordinate node onto LIFO Breadcrumb Stack (Depth ${ breadcrumbStackRef.current.size() })`
    );
  }, [auvPos, onShowToast]);

  // Trigger LIFO Stack Backtrack (pops nodes in reverse order)
  const handleTriggerBacktrack = useCallback(() => {
    if (breadcrumbStackRef.current.size() === 0) {
      onShowToast('LIFO Breadcrumb Stack is already at launch origin (100% Recovered).');
      return;
    }
    setIsBacktracking(true);
    onShowToast(
      'LIFO Stack Backtracking Initiated — Popping coordinate nodes in reverse order to pilot AUV-09 safely out of hazard zone.'
    );
  }, [onShowToast]);

  useEffect(() => {
    if (!isBacktracking) return;
    const timer = window.setInterval(() => {
      const popped = breadcrumbStackRef.current.pop();
      setBreadcrumbs(breadcrumbStackRef.current.getNodes());
      if (popped) {
        setAuvPos({
          x: popped.x,
          y: 0,
          z: popped.y,
          heading: popped.heading,
          depth: popped.depth,
        });
      }
      if (breadcrumbStackRef.current.size() <= 1) {
        setIsBacktracking(false);
        onShowToast(
          'LIFO Stack Backtrack Complete — AUV-09 POSEIDON-EYE safely recovered at launch point (100% Recovery Rate).'
        );
      }
    }, 450);
    return () => clearInterval(timer);
  }, [isBacktracking, onShowToast]);

  // Enqueue Hydrophone Packet into 16-Slot Circular Queue Ring Buffer
  const handleEnqueueHydrophonePacket = useCallback(() => {
    packetSeqRef.current += 1;
    const seq = packetSeqRef.current;
    const deltaStr =
      selectedVessel.draftDeltaMeters > 0
        ? `+${selectedVessel.draftDeltaMeters}m`
        : '0.0m';
    hydroRingRef.current.enqueue({
      seq,
      vesselId: selectedVessel.id,
      timestamp: new Date().toISOString().slice(11, 19),
      cavitationHz: selectedVessel.liveCavitationHz,
      sonarPingDb: selectedVessel.liveSonarPingDb,
      hullDraftDelta: deltaStr,
      encryptedHash: `0x${((seq * 2654435761) >>> 0).toString(16)}`,
    });
    setRingSnapshot(hydroRingRef.current.getSnapshot());
  }, [selectedVessel]);

  // Auto-enqueue hydrophone packets during Signal Blackout
  useEffect(() => {
    if (!signalBlackout) return;
    const timer = window.setInterval(() => {
      handleEnqueueHydrophonePacket();
    }, 1800);
    return () => clearInterval(timer);
  }, [signalBlackout, handleEnqueueHydrophonePacket]);

  // Toggle Signal Blackout / Surface & Flush to USCG CUTTER ARGUS
  const handleToggleSignalBlackout = useCallback(() => {
    setSignalBlackout((prev) => {
      const next = !prev;
      if (!next) {
        const flushed = hydroRingRef.current.flushToCutterArgus();
        setRingSnapshot(hydroRingRef.current.getSnapshot());
        setFlushedToArgusCount((c) => c + flushed.length);
        onShowToast(
          `AUV-09 Surfaced & Reconnected to USCG CUTTER ARGUS — Flushed ${flushed.length} hydrophone packets with ZERO data loss.`
        );
      } else {
        handleEnqueueHydrophonePacket();
        onShowToast(
          'Thermocline Signal Blackout Active — Recording acoustic hydrophone packets into 16-Slot Circular Queue Ring Buffer.'
        );
      }
      return next;
    });
  }, [handleEnqueueHydrophonePacket, onShowToast]);

  // Capture Court-Admissible Subsea Evidence Frame
  const handleCaptureEvidence = useCallback(
    (anomalyId?: string) => {
      const anom =
        selectedVessel.subseaAnomalies.find((a) => a.id === anomalyId) ||
        selectedVessel.subseaAnomalies[0];
      const nowStr = new Date().toISOString().slice(11, 19) + ' UTC';
      const hashSeed = `${selectedVessel.id}-${selectedVessel.mmsi}-${Date.now()}`;
      let hashHex = '';
      for (let i = 0; i < 8; i++) {
        const h = Math.imul(hashSeed.charCodeAt(i % hashSeed.length) + i * 31, 2654435761) >>> 0;
        hashHex += h.toString(16).padStart(8, '0');
      }

      const newRecord: SubseaEvidenceRecord = {
        id: `EVID-${Math.floor(100 + Math.random() * 899)}`,
        vesselId: selectedVessel.id,
        vesselName: selectedVessel.vesselName,
        codename: selectedVessel.codename,
        mmsi: selectedVessel.mmsi,
        imo: selectedVessel.imo,
        timestamp: nowStr,
        visionMode,
        coordinates: selectedVessel.liveCoordinates,
        auvDepthMeters: auvPos.depth,
        measuredDraftMeters: selectedVessel.liveDraftMeters,
        draftDeltaMeters: selectedVessel.draftDeltaMeters,
        anomalyTitle: anom ? anom.title : 'Subsea Hull & Gear Inspection Frame',
        findingSummary: anom
          ? anom.description
          : selectedVessel.underwaterReconTarget,
        sdgTarget: anom ? anom.sdgTarget : 'SDG 14.4',
        cryptoHash: hashHex,
        severity: anom ? anom.severity : 'WARNING',
      };

      setEvidenceLog((prev) => [newRecord, ...prev]);
      onShowToast(
        `Captured Court-Admissible Frame [${newRecord.id}] on ${selectedVessel.id} (${visionMode}) — Appended to Boarding Dossier.`
      );
    },
    [selectedVessel, visionMode, auvPos.depth, onShowToast]
  );

  // Export Boarding Dossier JSON
  const handleExportDossierJson = useCallback(() => {
    const payload = {
      system: 'AEGIS Subsea AUV-09 Tactical Interceptor & Hydrophone Recon Simulator',
      downlinkVessel: 'USCG CUTTER ARGUS',
      generatedAt: new Date().toISOString(),
      targetVessel: selectedVessel,
      evidenceRecords: evidenceLog,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AEGIS-AUV09-Dossier-${selectedVessel.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(
      `Exported Cryptographic Boarding Dossier for ${selectedVessel.id} (${evidenceLog.length} evidence frames).`
    );
  }, [selectedVessel, evidenceLog, onShowToast]);

  // Keyboard shortcuts for Space (Sonar Ping), B (LIFO Backtrack), C (Evidence Capture)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setSonarPingCount((c) => c + 1);
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        handleTriggerBacktrack();
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        handleCaptureEvidence();
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        handleMoveAuv(2.0, 0, 0, 0);
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        handleMoveAuv(-2.0, 0, 0, 0);
      } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        handleMoveAuv(0, 0, -1.5, -12);
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        handleMoveAuv(0, 0, 1.5, 12);
      } else if (e.code === 'KeyE') {
        handleMoveAuv(0, 6, 0, 0);
      } else if (e.code === 'KeyQ') {
        handleMoveAuv(0, -6, 0, 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTriggerBacktrack, handleCaptureEvidence, handleMoveAuv]);

  const uniqueFlags = useMemo(() => {
    const s = new Set(AEGIS_20_VESSELS.map((v) => v.flagName));
    return ['ALL', ...Array.from(s)];
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* ================= SYNCHRONIZED AEGIS 20-VESSEL MULTI-MODE FILTER BAR ================= */}
      <section
        aria-label="Synchronized 20-Vessel AEGIS Filter Bar"
        className="bg-[#051329] border border-cyan-900/80 rounded-lg p-3 space-y-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/60 pb-2">
          <div>
            <h2 className="text-base font-display font-bold uppercase text-white tracking-wide">
              AEGIS Subsea AUV-09 ("POSEIDON-EYE") Tactical Interceptor & 20-Vessel Recon Matrix
            </h2>
            <p className="text-xs text-slate-300">
              Synchronized 20-Vessel Surveillance Dataset (<span className="font-mono text-cyan-300">V-001</span> to <span className="font-mono text-cyan-300">V-020</span>) · Downlink: <span className="font-mono text-yellow-300">USCG CUTTER ARGUS</span>
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-cyan-300">
              2.5s Ticker: <strong>T+{tickerStep * 2.5}s</strong> (phase = tick×0.4 + vNum×0.8)
            </span>
            <span className="text-yellow-300 font-bold">
              Showing {filteredVessels.length} / 20 Ships
            </span>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5 text-xs">
          {/* 1. Threat Focus (Synced) */}
          <div className="bg-[#030d1d] border border-cyan-950 rounded p-2">
            <div className="text-[11px] font-mono text-slate-400 mb-1">
              1. THREAT FOCUS (SYNCED)
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['HIGH_RISK', 'HIGH_RISK (5)'],
                  ['SANCTUARY', 'SANCTUARY (2)'],
                  ['SIGNAL_OFF', 'SIGNAL_OFF (2)'],
                  ['ALL', 'ALL (Tier)'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setThreatFocus(id);
                    if (id !== 'ALL') {
                      setMatrixStatus('ALL');
                    }
                  }}
                  className={`px-2 py-1 rounded font-mono text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                    threatFocus === id
                      ? 'bg-red-500 text-white'
                      : 'bg-[#081d38] text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Suspicion Level (riskTier) */}
          <div className="bg-[#030d1d] border border-cyan-950 rounded p-2">
            <div className="text-[11px] font-mono text-slate-400 mb-1">
              2. SUSPICION LEVEL (RISK TIER)
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['HIGH', 'HIGH (>80) [4]'],
                  ['MEDIUM', 'MEDIUM (50-80) [3]'],
                  ['ALL_SHIPS', 'ALL SHIPS [20]'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setThreatFocus('ALL');
                    setMatrixStatus('ALL');
                    setRiskTier(id);
                  }}
                  className={`px-2 py-1 rounded font-mono text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                    threatFocus === 'ALL' && riskTier === id
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-[#081d38] text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Matrix Status Filter */}
          <div className="bg-[#030d1d] border border-cyan-950 rounded p-2">
            <div className="text-[11px] font-mono text-slate-400 mb-1">
              3. MATRIX STATUS FILTER
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['CRITICAL', 'CRITICAL (4)'],
                  ['ALERTIVE', 'ALERTIVE (3)'],
                  ['NORMAL', 'NORMAL (13)'],
                  ['ALL', 'ALL (20)'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setThreatFocus('ALL');
                    setRiskTier('ALL_SHIPS');
                    setMatrixStatus(id);
                  }}
                  className={`px-2 py-1 rounded font-mono text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                    matrixStatus === id
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-[#081d38] text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Country Flag & Gear Type Filter */}
          <div className="bg-[#030d1d] border border-cyan-950 rounded p-2 flex flex-col justify-between gap-1.5">
            <div className="text-[11px] font-mono text-slate-400">
              4. FLAG, GEAR TYPE & MMSI SEARCH
            </div>
            <div className="grid grid-cols-3 gap-1">
              <select
                aria-label="Filter by Country Flag"
                value={flagFilter}
                onChange={(e) => setFlagFilter(e.target.value)}
                className="bg-[#081d38] border border-cyan-800 rounded px-1.5 py-1 text-[11px] font-mono text-slate-200"
              >
                {uniqueFlags.map((fl) => (
                  <option key={fl} value={fl}>
                    {fl === 'ALL' ? 'All Flags (18)' : fl}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Gear Type"
                value={gearFilter}
                onChange={(e) => setGearFilter(e.target.value as GearTypeFilter)}
                className="bg-[#081d38] border border-cyan-800 rounded px-1.5 py-1 text-[11px] font-mono text-slate-200"
              >
                <option value="ALL">All Gear</option>
                <option value="Net Trawlers">Net Trawlers</option>
                <option value="Longline Boats">Longline Boats</option>
                <option value="Freezer Ships">Freezer Ships</option>
                <option value="Commercial/Research">Commercial/Research</option>
              </select>

              <input
                type="text"
                aria-label="Search Vessel MMSI or Name"
                placeholder="MMSI / Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#081d38] border border-cyan-800 rounded px-2 py-1 text-[11px] font-mono text-white placeholder-slate-400"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ================= MAIN 3-COLUMN TACTICAL INTERCEPTOR WORKSPACE ================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* LEFT COLUMN (3 cols): 20-Vessel Deployment Selector & Target Telemetry Card */}
        <div className="xl:col-span-3 flex flex-col gap-3">
          <section className="bg-[#051329] border border-cyan-900/70 rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-bold uppercase text-white">
                Target Vessel Deployment ({filteredVessels.length})
              </h3>
              <span className="text-[11px] font-mono text-cyan-300">
                Click to Deploy AUV-09
              </span>
            </div>

            <div
              className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1"
              data-testid="vessel-selector-list"
            >
              {filteredVessels.map((v) => {
                const isSelected = v.id === selectedVessel.id;
                const statusColor =
                  v.status === 'CRITICAL'
                    ? 'text-red-400'
                    : v.status === 'ALERTIVE'
                    ? 'text-amber-300'
                    : 'text-emerald-400';

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVessel(v.id)}
                    className={`w-full text-left p-2 rounded border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/90 border-cyan-400'
                        : 'bg-[#030d1d] border-cyan-950 hover:border-cyan-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 font-mono text-xs">
                      <span className="font-bold text-white truncate">
                        {v.id} · "{v.codename}"
                      </span>
                      <span className={`font-bold shrink-0 ${statusColor}`}>
                        RISK {v.riskScore} ({v.status})
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mt-0.5">
                      <span className="truncate">{v.vesselName}</span>
                      <span className="text-cyan-300 shrink-0">
                        {v.flagName} ({v.flagCode})
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-0.5">
                      <span>{v.liveCoordinates}</span>
                      <span className="text-yellow-300">
                        {v.liveSogKts} kts · Draft {v.liveDraftMeters}m
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono mt-0.5">
                      <span
                        className={
                          v.signalTurnedOff ? 'text-red-300' : 'text-slate-400'
                        }
                      >
                        AIS: {v.aisStatusText}
                      </span>
                      {v.sanctuaryTrespass && (
                        <span className="text-red-400 font-bold">
                          SANCTUARY BREACH
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Selected Ship Deep-Dive Subsea Profile Card */}
          <section className="bg-[#051329] border border-cyan-900/70 rounded-lg p-3 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-1.5">
              <span className="text-yellow-300 font-bold">
                {selectedVessel.id}: {selectedVessel.vesselName}
              </span>
              <span className="text-cyan-300">
                IMO {selectedVessel.imo} · {selectedVessel.callsign}
              </span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Type / Size:</span>
                <span className="text-white">
                  {selectedVessel.vesselType} ({selectedVessel.lengthMeters}m,{' '}
                  {selectedVessel.grossTonnage} GT)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Live Speed / Hdg:</span>
                <span className="text-cyan-300">
                  {selectedVessel.liveSogKts} kts · {selectedVessel.liveHeadingDisplay}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Plimsoll Draft:</span>
                <span
                  className={
                    selectedVessel.draftDeltaMeters > 0
                      ? 'text-red-400 font-bold'
                      : 'text-emerald-300'
                  }
                >
                  {selectedVessel.draftDisplayNote}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cavitation / Ping:</span>
                <span className="text-amber-300">
                  {selectedVessel.liveCavitationHz} Hz · {selectedVessel.liveSonarPingDb} dB
                </span>
              </div>
            </div>

            <div className="bg-[#030d1d] border border-cyan-950 rounded p-2 text-[11px]">
              <div className="text-cyan-400 font-bold">
                DSA Algorithm ({selectedVessel.dsaComplexity}):
              </div>
              <div className="text-white mt-0.5">{selectedVessel.dsaAlgorithm}</div>
            </div>

            <div className="bg-[#030d1d] border border-cyan-950 rounded p-2 text-[11px]">
              <div className="text-emerald-400 font-bold">
                Marine Wildlife Proximity (SDG 14.2):
              </div>
              {selectedVessel.wildlifeProximity.map((w, i) => (
                <div key={i} className="text-slate-200 mt-0.5">
                  • {w.species} ({w.distanceMeters}m) —{' '}
                  <span className="text-amber-300">{w.status}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* CENTER COLUMN (5 cols): 3D Subsea Viewport + Surface Radar / Voyage SVG / DLL Inspector */}
        <div className="xl:col-span-5 flex flex-col gap-3">
          <AuvSubseaViewport3D
            vessel={selectedVessel}
            visionMode={visionMode}
            onSelectVisionMode={setVisionMode}
            auvPos={auvPos}
            onMoveAuv={handleMoveAuv}
            breadcrumbs={breadcrumbs}
            isBacktracking={isBacktracking}
            onTriggerBacktrack={handleTriggerBacktrack}
            onCaptureEvidence={handleCaptureEvidence}
            onTriggerSonarPing={() => {
              setSonarPingCount((c) => c + 1);
              onShowToast(
                `AUV-09 450 kHz Multibeam Sonar Ping Emitted beneath ${selectedVessel.id} (${selectedVessel.liveSonarPingDb} dB return)`
              );
            }}
            sonarPingCount={sonarPingCount}
            signalBlackout={signalBlackout}
          />

          <AuvTacticalRadarAndMap
            vessels={filteredVessels}
            selectedVessel={selectedVessel}
            onSelectVessel={handleSelectVessel}
          />
        </div>

        {/* RIGHT COLUMN (4 cols): Subsea DSA Modules (LIFO Stack, 16-Slot Ring Buffer) & Cryptographic Dossier */}
        <div className="xl:col-span-4">
          <AuvSubseaDsaAndDossierPanel
            vessel={selectedVessel}
            visionMode={visionMode}
            breadcrumbs={breadcrumbs}
            isBacktracking={isBacktracking}
            onTriggerBacktrack={handleTriggerBacktrack}
            onPushManualBreadcrumb={handlePushManualBreadcrumb}
            ringSnapshot={ringSnapshot}
            signalBlackout={signalBlackout}
            onToggleSignalBlackout={handleToggleSignalBlackout}
            onEnqueueHydrophonePacket={handleEnqueueHydrophonePacket}
            flushedToArgusCount={flushedToArgusCount}
            evidenceLog={evidenceLog}
            onCaptureEvidence={handleCaptureEvidence}
            onExportDossierJson={handleExportDossierJson}
          />
        </div>
      </div>
    </div>
  );
};
