import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CanvasOceanWorld, UiTelemetrySnapshot } from './components/CanvasOceanWorld';
import {
  AnalyticsTabPanel,
  AiAnalystTabPanel,
  MissionReportModal,
  GeminiBriefingData,
  ChatMessage,
} from './components/AnalyticsAndAiModals';
import {
  ControlInput,
  NetTackleStrategy,
  RovMode,
  WorldState,
  createInitialWorldState,
  engageNetTackleOnShip,
  worldYToDepthMeters,
} from './sim/rovWorld2d';
import {
  MissionPreset,
  MissionId,
  createMissionPresets,
  CORE_VESSEL_REGISTRY,
  vesselRegistryEngine,
  VesselBenchmarkResult,
} from './sim/dsaStructures';
import {
  computeAnalyticsSnapshot,
  generateMissionReportData,
} from './sim/analyticsAndReport';

const MODES: RovMode[] = ['Manual', 'Auto Patrol', 'Auto Survey', 'Return to Base'];

type SidebarTab =
  | 'alerts'
  | 'analytics'
  | 'ai'
  | 'comms'
  | 'safety'
  | 'vessel'
  | 'detections';

const INITIAL_BRIEFING: GeminiBriefingData = {
  summary:
    'Mission "Illegal Trawler Patrol" active at 52.0m depth. Optical & sonar sensors are tracking 3 poaching trawlers towing deep submerged drift-nets with trapped rare sea turtles, golden bluefin tuna, reef manta rays, and hammerhead sharks, alongside a subsea pipeline oil plume.',
  threat_level: 'CRITICAL',
  key_findings: [
    'Apex Triage Alert: Attached Long Drift-Net on FV HAI LONG 88 (Risk Score 97/100, CRITICAL) trapping rare sea turtles & golden bluefin tuna at X:1740m.',
    'MPA Sanctuary Trespass: FV BLACK MARLIN (X:3360m) and FV KRAKEN-04 (X:4650m) towing deep gillnets trapping hawksbill turtles, manta rays, and hammerhead sharks.',
    'Subsea Pipeline Oil Plume (Risk 91/100) at X:2350m and Ghost Net with Entangled Sea Turtle (Risk 89/100) at X:1480m.',
  ],
  recommended_actions: [
    '1. Dispatch immediate interception response to the top-ranked threat in the Automated Threat Triage Matrix.',
    '2. Deploy acoustic net-cutter & wildlife rescue team to Poaching Ship Nets (X:1740m, X:3360m, X:4650m) to free trapped rare turtles and fish.',
    '3. Contain pipeline hydrocarbon leak at X:2350m and enforce MPA boundary perimeter at X:3200m.',
  ],
  sdg14_targets_affected: [
    '14.1 Reduce marine pollution',
    '14.2 Protect & restore marine ecosystems',
    '14.4 End IUU & destructive fishing',
    '14.5 Conserve coastal & marine areas',
    '14.a Increase marine scientific knowledge',
  ],
  confidence: 0.94,
  caveats: 'AI output is decision support, not proof of a violation. All data is simulated.',
  generatedAt: 'LIVE',
};

export default function App() {
  const worldRef = useRef<WorldState>(createInitialWorldState());
  const inputRef = useRef<ControlInput>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const droneFeedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mission Presets & Active Mission State
  const [missions, setMissions] = useState<MissionPreset[]>(() => createMissionPresets());
  const [activeMissionId, setActiveMissionId] = useState<MissionId>('illegal-trawler-patrol');
  const [showMissionSelectModal, setShowMissionSelectModal] = useState<boolean>(false);
  const [showMissionResultsModal, setShowMissionResultsModal] = useState<boolean>(false);
  const [showMissionReportModal, setShowMissionReportModal] = useState<boolean>(false);
  const [dispatchedCount, setDispatchedCount] = useState<number>(0);
  const [lastDispatchedAlertTitle, setLastDispatchedAlertTitle] = useState<string>('');

  // Sidebar Tab State
  const [activeTab, setActiveTab] = useState<SidebarTab>('alerts');

  // Vessel Registry Lookup & Benchmark State
  const [vesselQuery, setVesselQuery] = useState<string>('V-001');
  const [vesselBench, setVesselBench] = useState<VesselBenchmarkResult>(() =>
    vesselRegistryEngine.runBenchmark('V-001', 12000)
  );

  // Gemini AI Analyst State
  const [briefing, setBriefing] = useState<GeminiBriefingData>(INITIAL_BRIEFING);
  const [loadingBriefing, setLoadingBriefing] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'AEGIS Gemini Flash Analyst ready. Ask about any simulated session detection, priority alert, or SDG 14 target.',
    },
  ]);
  const [loadingChat, setLoadingChat] = useState<boolean>(false);

  // React state updated at most 4 times per second (every 250ms) from the canvas loop
  const [uiState, setUiState] = useState<UiTelemetrySnapshot>(() => {
    const w = worldRef.current;
    return {
      mode: w.rov.mode,
      lightsOn: w.rov.lightsOn,
      overlayOn: w.rov.overlayOn,
      depthMeters: Number(worldYToDepthMeters(w.rov.y).toFixed(1)),
      speedKnots: 2.5,
      battery: 98,
      tempCelsius: 15.8,
      headingDeg: 90,
      rovX: Math.round(w.rov.x),
      rovY: Math.round(w.rov.y),
      activeDetectionCount: w.activeDetections.length,
      recentDetections: w.recentDetections.slice(0, 8),
      alertHeapArray: w.alertHeap.toHeapArray(),
      alertSortedList: w.alertHeap.toSortedList(),
      commsSnapshot: w.commsQueue.getSnapshot(),
      commsOffline: w.commsOffline,
      lastFlushedCount: w.lastFlushedCount,
      stackItems: w.positionStack.toTopDownArray(),
      safetyState: { ...w.safetyState },
      dfsSurvey: {
        enabled: w.dfsSurvey.enabled,
        currentNodeIdx: w.dfsSurvey.currentNodeIdx,
        totalNodes: w.dfsSurvey.nodes.length,
        currentNode: w.dfsSurvey.nodes[0] || null,
        gridCells: w.dfsSurvey.gridCells,
      },
      netTackle: {
        ...w.netTackle,
        waypoints: [...w.netTackle.waypoints],
      },
    };
  });

  const handleTelemetrySample = useCallback((snapshot: UiTelemetrySnapshot) => {
    setUiState(snapshot);
  }, []);

  // Automatically evaluate active mission objectives whenever telemetry updates
  useEffect(() => {
    const detectedLabels = new Set(uiState.recentDetections.map((d) => d.label));
    setMissions((prevMissions) =>
      prevMissions.map((m) => {
        if (m.id !== activeMissionId) return m;
        let changed = false;
        const nextObjectives = m.objectives.map((obj) => {
          if (obj.completed) return obj;
          let met = false;
          if (obj.targetLabels && obj.targetLabels.some((lbl) => detectedLabels.has(lbl))) {
            met = true;
          }
          if (obj.minWorldX !== undefined && uiState.rovX >= obj.minWorldX) {
            met = true;
          }
          if (obj.minDepthMeters !== undefined && uiState.depthMeters >= obj.minDepthMeters) {
            met = true;
          }
          if (obj.requireDispatch && dispatchedCount > 0) {
            met = true;
          }
          if (met) {
            changed = true;
            return { ...obj, completed: true };
          }
          return obj;
        });
        return changed ? { ...m, objectives: nextObjectives } : m;
      })
    );
  }, [uiState.recentDetections, uiState.rovX, uiState.depthMeters, dispatchedCount, activeMissionId]);

  const activeMission =
    missions.find((m) => m.id === activeMissionId) || missions[0];
  const completedCount = activeMission.objectives.filter((o) => o.completed).length;
  const missionProgressPct = Math.round(
    (completedCount / Math.max(1, activeMission.objectives.length)) * 100
  );

  // Compute live Analytics Snapshot & Full Mission Report
  const analyticsSnapshot = useMemo(
    () =>
      computeAnalyticsSnapshot(
        uiState.recentDetections,
        uiState.alertSortedList,
        uiState.stackItems,
        uiState.rovX,
        uiState.rovY,
        dispatchedCount
      ),
    [
      uiState.recentDetections,
      uiState.alertSortedList,
      uiState.stackItems,
      uiState.rovX,
      uiState.rovY,
      dispatchedCount,
    ]
  );

  const missionReportData = useMemo(
    () =>
      generateMissionReportData({
        activeMission,
        missionProgressPct,
        depthMeters: uiState.depthMeters,
        tempCelsius: uiState.tempCelsius,
        battery: uiState.battery,
        analytics: analyticsSnapshot,
        recentDetections: uiState.recentDetections,
        alerts: uiState.alertSortedList,
        dispatchedCount,
        poppedStackCount: uiState.safetyState.poppedCount,
      }),
    [
      activeMission,
      missionProgressPct,
      uiState.depthMeters,
      uiState.tempCelsius,
      uiState.battery,
      analyticsSnapshot,
      uiState.recentDetections,
      uiState.alertSortedList,
      dispatchedCount,
      uiState.safetyState.poppedCount,
    ]
  );

  // Gemini AI Analyst Briefing & Chat handlers
  const handleRefreshBriefing = useCallback(async () => {
    setLoadingBriefing(true);
    try {
      const response = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionTitle: activeMission.title,
          detections: uiState.recentDetections,
          alerts: uiState.alertSortedList,
          telemetry: {
            depthMeters: uiState.depthMeters,
            tempCelsius: uiState.tempCelsius,
            battery: uiState.battery,
            rovX: uiState.rovX,
            rovY: uiState.rovY,
            pollutionIndex: analyticsSnapshot.pollutionIndex,
            biodiversityCount: analyticsSnapshot.biodiversityCount,
            areaSurveyedPct: analyticsSnapshot.areaSurveyedPct,
          },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setBriefing(data);
      }
    } catch (err) {
      console.error('AI Briefing request failed:', err);
    } finally {
      setLoadingBriefing(false);
    }
  }, [
    activeMission.title,
    uiState.recentDetections,
    uiState.alertSortedList,
    uiState.depthMeters,
    uiState.tempCelsius,
    uiState.battery,
    uiState.rovX,
    uiState.rovY,
    analyticsSnapshot,
  ]);

  const handleSendChatQuestion = useCallback(
    async (question: string) => {
      setChatMessages((prev) => [...prev, { role: 'user', text: question }]);
      setLoadingChat(true);
      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            sessionContext: {
              missionTitle: activeMission.title,
              detections: uiState.recentDetections,
              alerts: uiState.alertSortedList,
              telemetry: {
                depthMeters: uiState.depthMeters,
                tempCelsius: uiState.tempCelsius,
                battery: uiState.battery,
                rovX: uiState.rovX,
                pollutionIndex: analyticsSnapshot.pollutionIndex,
                biodiversityCount: analyticsSnapshot.biodiversityCount,
                areaSurveyedPct: analyticsSnapshot.areaSurveyedPct,
              },
            },
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', text: data.answer || 'No response received.' },
          ]);
        }
      } catch (err) {
        console.error('AI Chat request failed:', err);
      } finally {
        setLoadingChat(false);
      }
    },
    [
      activeMission.title,
      uiState.recentDetections,
      uiState.alertSortedList,
      uiState.depthMeters,
      uiState.tempCelsius,
      uiState.battery,
      uiState.rovX,
      analyticsSnapshot,
    ]
  );

  // Handlers
  const handleSelectMissionPreset = (preset: MissionPreset) => {
    setActiveMissionId(preset.id);
    const w = worldRef.current;
    w.rov.x = preset.startX;
    w.rov.y = preset.startY;
    w.rov.vx = 65;
    w.rov.vy = 10;
    w.rov.mode = preset.recommendedMode;
    setShowMissionSelectModal(false);
    setShowMissionResultsModal(false);
  };

  const handleCompleteNextObjectiveDemo = () => {
    setMissions((prev) =>
      prev.map((m) => {
        if (m.id !== activeMissionId) return m;
        const firstIncompleteIdx = m.objectives.findIndex((o) => !o.completed);
        if (firstIncompleteIdx === -1) {
          setShowMissionResultsModal(true);
          return m;
        }
        const updated = m.objectives.map((o, idx) =>
          idx === firstIncompleteIdx ? { ...o, completed: true } : o
        );
        const allDone = updated.every((o) => o.completed);
        if (allDone) {
          setShowMissionResultsModal(true);
        }
        return { ...m, objectives: updated };
      })
    );
  };

  const handleSelectMode = (mode: RovMode) => {
    worldRef.current.rov.mode = mode;
    setUiState((prev) => ({ ...prev, mode }));
  };

  const handleToggleLights = () => {
    const next = !worldRef.current.rov.lightsOn;
    worldRef.current.rov.lightsOn = next;
    setUiState((prev) => ({ ...prev, lightsOn: next }));
  };

  const handleToggleOverlay = () => {
    const next = !worldRef.current.rov.overlayOn;
    worldRef.current.rov.overlayOn = next;
    setUiState((prev) => ({ ...prev, overlayOn: next }));
  };

  // Priority Queue: Dispatch highest-risk alert (extractMax from Binary Max-Heap)
  const handleDispatchTopAlert = () => {
    const w = worldRef.current;
    const dequeued = w.alertHeap.extractMax();
    if (dequeued) {
      setDispatchedCount((c) => c + 1);
      setLastDispatchedAlertTitle(`${dequeued.title} (Risk ${dequeued.riskScore})`);
      setUiState((prev) => ({
        ...prev,
        alertHeapArray: w.alertHeap.toHeapArray(),
        alertSortedList: w.alertHeap.toSortedList(),
      }));
    }
  };

  const handleInjectSimulatedAlert = () => {
    const w = worldRef.current;
    const idSuffix = Math.floor(Math.random() * 900 + 100);
    const samples = [
      { title: 'Unlicensed Trawl Net', risk: 95, cat: 'threat' as const },
      { title: 'Toxic Bilge Plume', risk: 90, cat: 'threat' as const },
      { title: 'Drifting Ghost Longline', risk: 87, cat: 'threat' as const },
      { title: 'Dense Microplastic Slick', risk: 77, cat: 'pollution' as const },
    ];
    const pick = samples[idSuffix % samples.length];
    w.alertHeap.insert({
      id: `sim-alert-${idSuffix}`,
      targetId: `sim-target-${idSuffix}`,
      title: `${pick.title} #${idSuffix}`,
      category: pick.cat,
      riskScore: pick.risk,
      severity: pick.risk >= 88 ? 'CRITICAL' : 'HIGH',
      depthMeters: Number(worldYToDepthMeters(w.rov.y).toFixed(1)),
      worldX: Math.round(w.rov.x),
      worldY: Math.round(w.rov.y),
      timestampStr: 'LIVE',
    });
    setUiState((prev) => ({
      ...prev,
      alertHeapArray: w.alertHeap.toHeapArray(),
      alertSortedList: w.alertHeap.toSortedList(),
    }));
  };

  // Comms Outage Circular Queue Toggle & Reconnect Flush
  const handleToggleCommsOutage = () => {
    const w = worldRef.current;
    if (!w.commsOffline) {
      w.commsOffline = true;
      w.commsQueue.enqueue({
        seq: w.packetSeq++,
        timestampStr: 'NOW',
        depthMeters: Number(worldYToDepthMeters(w.rov.y).toFixed(1)),
        tempCelsius: 14.2,
        rovX: Math.round(w.rov.x),
        rovY: Math.round(w.rov.y),
        detectionsCount: w.activeDetections.length,
      });
    } else {
      w.commsOffline = false;
      const flushed = w.commsQueue.flushAll();
      w.lastFlushedCount = flushed.length;
    }
    setUiState((prev) => ({
      ...prev,
      commsOffline: w.commsOffline,
      commsSnapshot: w.commsQueue.getSnapshot(),
      lastFlushedCount: w.lastFlushedCount,
    }));
  };

  const handleEnqueueManualPacket = () => {
    const w = worldRef.current;
    w.commsOffline = true;
    w.commsQueue.enqueue({
      seq: w.packetSeq++,
      timestampStr: 'BUF',
      depthMeters: Number(worldYToDepthMeters(w.rov.y).toFixed(1)),
      tempCelsius: 13.8,
      rovX: Math.round(w.rov.x),
      rovY: Math.round(w.rov.y),
      detectionsCount: w.activeDetections.length,
    });
    setUiState((prev) => ({
      ...prev,
      commsOffline: true,
      commsSnapshot: w.commsQueue.getSnapshot(),
    }));
  };

  // Collision Evasion Waypoint Retrace Trigger & Sector Grid Sweep
  const handleTriggerHazardBacktrackDemo = (hazard: 'poacher' | 'net' | 'wreck') => {
    const w = worldRef.current;
    const ship0 = w.poachingShips[0];
    const targetX =
      hazard === 'poacher' && ship0
        ? ship0.x
        : hazard === 'net'
          ? w.ghostNet.x
          : w.shipwreck.x;
    const targetY =
      hazard === 'poacher' && ship0
        ? 440
        : hazard === 'net'
          ? w.ghostNet.y
          : w.shipwreck.y;
    w.positionStack.push({
      x: targetX - 240,
      y: targetY - 90,
      depthMeters: Number(worldYToDepthMeters(targetY - 90).toFixed(1)),
      timestampSec: w.timeSec,
    });
    w.positionStack.push({
      x: targetX - 155,
      y: targetY - 55,
      depthMeters: Number(worldYToDepthMeters(targetY - 55).toFixed(1)),
      timestampSec: w.timeSec + 0.1,
    });
    w.safetyState.backtrackTimer = 0;
    w.rov.x = hazard === 'poacher' ? targetX - 25 : targetX - 65;
    w.rov.y = targetY - 10;
    w.rov.vx = 110;
    w.rov.vy = 20;
  };

  // Pilot ROV directly to a Poaching Ship's Attached Long Drift-Net to inspect trapped rare species
  const handleInspectPoachingShipNet = (shipIdx: number, forcedStrategy?: NetTackleStrategy) => {
    const w = worldRef.current;
    const ship = w.poachingShips[shipIdx];
    if (!ship) return;
    w.safetyState.backtrackTimer = 0;
    w.safetyState.isWarning = false;
    w.safetyState.isBacktracking = false;
    w.rov.x = ship.x - 135;
    w.rov.y = forcedStrategy === 'OVER_NET' ? 285 : (ship.netTopY + ship.netBottomY) * 0.52;
    w.rov.vx = 48;
    w.rov.vy = 0;
    w.rov.facing = 1;
    w.rov.lightsOn = true;
    const nextMode: RovMode =
      w.rov.mode === 'Auto Survey' ? 'Auto Survey' : 'Auto Patrol';
    w.rov.mode = nextMode;
    engageNetTackleOnShip(w, shipIdx, forcedStrategy, 1);
    w.camera.x = ship.x - 20;
    w.camera.y = w.rov.y - 30;
    setUiState((prev) => ({
      ...prev,
      mode: nextMode,
      lightsOn: true,
      rovX: Math.round(w.rov.x),
      rovY: Math.round(w.rov.y),
      netTackle: {
        ...w.netTackle,
        waypoints: [...w.netTackle.waypoints],
      },
    }));
  };

  const handleSelectNetTackleStrategy = (strategy: NetTackleStrategy) => {
    const w = worldRef.current;
    w.netTackle.strategy = strategy;
    if (w.netTackle.active) {
      const shipIdx = Math.max(
        0,
        w.poachingShips.findIndex((s) => s.id === w.netTackle.targetNetId)
      );
      engageNetTackleOnShip(w, shipIdx, strategy);
    }
    setUiState((prev) => ({
      ...prev,
      netTackle: {
        ...w.netTackle,
        waypoints: [...w.netTackle.waypoints],
      },
    }));
  };

  const handleStartRecursiveDfsSurvey = () => {
    const w = worldRef.current;
    w.dfsSurvey.enabled = true;
    w.dfsSurvey.currentNodeIdx = 0;
    w.rov.mode = 'Auto Survey';
    setUiState((prev) => ({
      ...prev,
      mode: 'Auto Survey',
      dfsSurvey: {
        ...prev.dfsSurvey,
        enabled: true,
        currentNodeIdx: 0,
      },
    }));
  };

  // Vessel Intelligence Registry Lookup & Latency Verification
  const handleRunVesselLookup = (query: string) => {
    setVesselQuery(query);
    const res = vesselRegistryEngine.runBenchmark(query, 12000);
    setVesselBench(res);
  };

  const setTouchDirection = (dir: keyof ControlInput, active: boolean) => {
    inputRef.current[dir] = active;
    if (active && worldRef.current.rov.battery >= 15) {
      worldRef.current.rov.mode = 'Manual';
    }
  };

  return (
    <ErrorBoundary>
      <div className="relative w-screen h-screen overflow-hidden bg-[#020b14] text-slate-100 font-sans select-none">
        {/* Main Full-Screen 2D Side-View Underwater World Canvas */}
        <CanvasOceanWorld
          worldRef={worldRef}
          inputRef={inputRef}
          onTelemetrySample={handleTelemetrySample}
          droneFeedCanvasRef={droneFeedCanvasRef}
        />

        {/* Top Header Bar */}
        <header className="pointer-events-auto absolute top-0 left-0 right-0 h-11 bg-[#031022]/95 border-b border-cyan-500/35 px-3 flex items-center justify-between z-20">
          <div className="flex items-center gap-2.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_#facc15]" />
            <h1 className="text-xs sm:text-sm font-bold tracking-wider text-cyan-300 uppercase font-mono">
              AEGIS OCEAN SENTINEL <span className="text-slate-400 font-normal">|</span>{' '}
              <span className="text-yellow-300 hidden md:inline">Safer Seas • Cleaner Oceans</span>
            </h1>
          </div>

          {/* Quick Top Action Buttons */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setShowMissionSelectModal(true)}
              className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/50 font-semibold cursor-pointer"
            >
              Missions ({completedCount}/{activeMission.objectives.length})
            </button>

            <button
              type="button"
              onClick={() => setShowMissionResultsModal(true)}
              className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/50 font-semibold cursor-pointer"
            >
              SDG 14 Impact
            </button>

            <button
              type="button"
              onClick={() => setShowMissionReportModal(true)}
              className="px-2.5 py-1 rounded bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold cursor-pointer"
            >
              Generate mission report
            </button>

            <button
              type="button"
              onClick={handleToggleCommsOutage}
              className={`px-2 py-1 rounded font-semibold border cursor-pointer ${
                uiState.commsOffline
                  ? 'bg-red-600/35 text-red-200 border-red-400 animate-pulse'
                  : 'bg-slate-800/90 text-cyan-300 border-cyan-500/40 hover:bg-slate-700'
              }`}
            >
              {uiState.commsOffline
                ? `OFFLINE (${uiState.commsSnapshot.count}/${uiState.commsSnapshot.capacity})`
                : 'Comms: ONLINE'}
            </button>
          </div>
        </header>

        {/* Active Mission Overlay Card (Top-Left below telemetry ribbon) */}
        <div className="pointer-events-auto absolute top-25 left-20 w-84 bg-[#031022]/90 border border-cyan-500/40 rounded-md p-2.5 z-10 font-mono text-[11px] shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-cyan-400 block">
                ACTIVE MISSION PRESET
              </span>
              <span className="font-bold text-yellow-300 text-xs">{activeMission.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowMissionSelectModal(true)}
                className="px-1.5 py-0.5 rounded bg-[#082240] hover:bg-cyan-900 text-cyan-200 border border-cyan-500/40 text-[10px] cursor-pointer"
              >
                Switch
              </button>
              <button
                type="button"
                onClick={handleCompleteNextObjectiveDemo}
                title="Complete next mission objective / View Impact Report"
                className="px-1.5 py-0.5 rounded bg-yellow-400/20 hover:bg-yellow-400/35 text-yellow-300 border border-yellow-400/50 text-[10px] cursor-pointer"
              >
                {missionProgressPct === 100 ? 'Results ★' : 'Step ✓'}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-slate-900 rounded overflow-hidden border border-cyan-500/30 mb-1.5">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${missionProgressPct}%` }}
            />
          </div>

          {/* Objectives Checklist */}
          <div className="space-y-1 mb-2">
            {activeMission.objectives.map((obj) => (
              <div
                key={obj.id}
                className={`flex items-start gap-1.5 text-[10px] leading-tight ${
                  obj.completed ? 'text-emerald-300 line-through opacity-85' : 'text-slate-200'
                }`}
              >
                <span className="font-bold">{obj.completed ? '☑' : '☐'}</span>
                <span>{obj.description}</span>
              </div>
            ))}
          </div>

          {/* Quick-Jump Bar to Inspect Poaching Ships with Attached Long Nets & Trapped Rare Species */}
          <div className="pt-1.5 border-t border-cyan-500/30">
            <span className="text-[9px] uppercase tracking-wider text-red-300 font-bold block mb-1">
              INTERCEPT POACHING SHIPS & ATTACHED LONG NETS:
            </span>
            <div className="grid grid-cols-3 gap-1 mb-1">
              <button
                type="button"
                onClick={() => handleInspectPoachingShipNet(0)}
                className="px-1.5 py-1 rounded bg-red-950/75 hover:bg-red-900 text-red-200 border border-red-400/50 text-[9px] font-bold cursor-pointer truncate"
                title="FV HAI LONG 88 (X:1740m) — Trapped Rare Sea Turtle & Golden Bluefin Tuna"
              >
                Ship #1 Net
              </button>
              <button
                type="button"
                onClick={() => handleInspectPoachingShipNet(1)}
                className="px-1.5 py-1 rounded bg-orange-950/75 hover:bg-orange-900 text-orange-200 border border-orange-400/50 text-[9px] font-bold cursor-pointer truncate"
                title="FV BLACK MARLIN (X:3360m MPA) — Trapped Hawksbill Turtle & Reef Manta Ray"
              >
                Ship #2 MPA Net
              </button>
              <button
                type="button"
                onClick={() => handleInspectPoachingShipNet(2)}
                className="px-1.5 py-1 rounded bg-rose-950/75 hover:bg-rose-900 text-rose-200 border border-rose-400/50 text-[9px] font-bold cursor-pointer truncate"
                title="FV KRAKEN-04 (X:4650m) — Trapped Hammerhead Shark & Rare Turtle"
              >
                Ship #3 Deep Net
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => handleInspectPoachingShipNet(0, 'UNDER_NET')}
                className="px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 border border-cyan-400/50 text-[9px] font-bold cursor-pointer truncate"
                title="Auto Patrol / Auto Survey: Dive beneath the attached net lead sinkers"
              >
                ▼ Tackle Under Net
              </button>
              <button
                type="button"
                onClick={() => handleInspectPoachingShipNet(0, 'OVER_NET')}
                className="px-1.5 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-400/50 text-[9px] font-bold cursor-pointer truncate"
                title="Auto Patrol / Auto Survey: Skim above the attached net cork headline"
              >
                ▲ Tackle Above Net
              </button>
            </div>
          </div>
        </div>

        {/* Right Tactical Sidebar: Live Feed Canvas + Mode Buttons + 7 Operational Modules */}
        <aside className="pointer-events-auto absolute top-11 right-0 bottom-6 w-80 bg-[#031022]/94 border-l border-cyan-500/35 p-2.5 flex flex-col justify-between z-20 overflow-y-auto">
          <div className="space-y-2">
            {/* LIVE FEED PANEL: Second Canvas showing zoomed view of drone camera with HUD & detection boxes */}
            <div className="bg-[#05162c] border border-cyan-500/40 rounded p-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span className="text-cyan-300 font-bold uppercase tracking-wider">
                  Live Drone Camera Feed
                </span>
                <span className="text-emerald-400 font-semibold">● 60 FPS OPTIC</span>
              </div>
              <canvas
                ref={droneFeedCanvasRef}
                width={284}
                height={110}
                className="w-full h-[110px] rounded border border-cyan-400/50 bg-[#020b14] block contrast-110 saturate-115 shadow-[0_0_12px_rgba(6,182,212,0.18)]"
                aria-label="Zoomed ROV Camera Live Feed Canvas"
              />
            </div>

            {/* ROV Navigation Modes & Light/Overlay Toggles */}
            <div>
              <div className="grid grid-cols-4 gap-1">
                {MODES.map((m) => {
                  const active = uiState.mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectMode(m)}
                      className={`px-1 py-1 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer border truncate ${
                        active
                          ? 'bg-yellow-400 text-slate-950 border-yellow-300'
                          : 'bg-[#071c36] text-cyan-100 border-cyan-500/30 hover:bg-[#0b284a]'
                      }`}
                    >
                      {m.replace('Return to Base', 'RTB')}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <button
                  type="button"
                  onClick={handleToggleLights}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-semibold border cursor-pointer ${
                    uiState.lightsOn
                      ? 'bg-cyan-500/20 text-yellow-300 border-yellow-400/50'
                      : 'bg-[#071c36] text-slate-400 border-slate-700'
                  }`}
                >
                  Lights: {uiState.lightsOn ? 'ON' : 'OFF'} [Space]
                </button>
                <button
                  type="button"
                  onClick={handleToggleOverlay}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-semibold border cursor-pointer ${
                    uiState.overlayOn
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                      : 'bg-[#071c36] text-slate-400 border-slate-700'
                  }`}
                >
                  Optical HUD: {uiState.overlayOn ? 'ON' : 'OFF'} [F]
                </button>
              </div>

              {/* Autonomous Net Tackling Strategy Selector (Active in Auto Patrol & Auto Survey) */}
              <div className="mt-1.5 bg-[#05162c] border border-cyan-500/30 rounded p-1.5 font-mono">
                <div className="flex items-center justify-between text-[9px] mb-1">
                  <span className="text-cyan-300 font-bold uppercase tracking-wider">
                    Net Tackle Strategy (Patrol/Survey)
                  </span>
                  <span className="text-emerald-300 font-bold">
                    {uiState.netTackle.active
                      ? uiState.netTackle.activePass === 'OVER_NET'
                        ? '▲ PASSING ABOVE'
                        : '▼ DIVING BELOW'
                      : `Cleared: ${uiState.netTackle.clearedCount}`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'UNDER_NET', label: '▼ Under-Net' },
                      { id: 'OVER_NET', label: '▲ Over-Net' },
                      { id: 'ADAPTIVE', label: '◆ Adaptive' },
                    ] as const
                  ).map((item) => {
                    const active = uiState.netTackle.strategy === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectNetTackleStrategy(item.id)}
                        className={`py-1 px-1 rounded text-[9px] font-bold border cursor-pointer transition-colors ${
                          active
                            ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                            : 'bg-[#071c36] text-cyan-200 border-cyan-500/30 hover:bg-[#0b284a]'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Operational Module Selector Tabs */}
            <div className="grid grid-cols-7 gap-0.5 pt-1 border-t border-cyan-500/25 font-mono text-[9px]">
              {(
                [
                  { id: 'alerts', label: 'Triage' },
                  { id: 'analytics', label: 'Charts' },
                  { id: 'ai', label: 'AI' },
                  { id: 'comms', label: 'Uplink' },
                  { id: 'safety', label: 'Evasion' },
                  { id: 'vessel', label: 'Registry' },
                  { id: 'detections', label: 'Optics' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-1 rounded font-bold border cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                      : 'bg-[#061830] text-cyan-200 border-cyan-500/30 hover:bg-[#0a2342]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB: ANALYTICS (Recharts) */}
            {activeTab === 'analytics' && (
              <AnalyticsTabPanel
                analytics={analyticsSnapshot}
                onOpenReport={() => setShowMissionReportModal(true)}
              />
            )}

            {/* TAB: GEMINI AI ANALYST */}
            {activeTab === 'ai' && (
              <AiAnalystTabPanel
                briefing={briefing}
                loadingBriefing={loadingBriefing}
                onRefreshBriefing={handleRefreshBriefing}
                chatMessages={chatMessages}
                loadingChat={loadingChat}
                onSendChat={handleSendChatQuestion}
              />
            )}

            {/* TAB: THREAT TRIAGE & RAPID RESPONSE DISPATCH */}
            {activeTab === 'alerts' && (
              <div className="bg-[#05162c] border border-cyan-500/30 rounded p-2 font-mono text-[11px] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-300 font-bold text-[10px] uppercase">
                    Threat Triage & Dispatch ({uiState.alertHeapArray.length})
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={handleInjectSimulatedAlert}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-cyan-500/40 text-[9px] cursor-pointer"
                    >
                      +Signal
                    </button>
                    <button
                      type="button"
                      onClick={handleDispatchTopAlert}
                      disabled={uiState.alertHeapArray.length === 0}
                      className="px-2 py-0.5 rounded bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-bold text-[10px] cursor-pointer"
                    >
                      Dispatch response
                    </button>
                  </div>
                </div>

                {lastDispatchedAlertTitle && (
                  <div className="text-[10px] bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-2 py-1 rounded">
                    ✓ Dispatched: {lastDispatchedAlertTitle}
                  </div>
                )}

                {/* Criticality Triage Hierarchy Visualization (SVG) */}
                <div className="bg-[#020b16] border border-cyan-500/20 rounded p-1.5">
                  <div className="text-[9px] text-slate-400 mb-1 flex justify-between">
                    <span>CRITICALITY TRIAGE HIERARCHY (APEX = TOP RISK)</span>
                    <span className="text-cyan-300">AUTO-RANKED</span>
                  </div>
                  <HeapTreeSvg nodes={uiState.alertHeapArray.slice(0, 7)} />
                </div>

                {/* Live Triage Feed (Highest Risk First) */}
                <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                  {uiState.alertSortedList.length === 0 ? (
                    <div className="text-center text-slate-400 py-2 text-[10px]">
                      All active maritime threats dispatched.
                    </div>
                  ) : (
                    uiState.alertSortedList.map((alert, idx) => (
                      <div
                        key={alert.id}
                        className={`p-1.5 rounded border flex items-center justify-between text-[10px] ${
                          idx === 0
                            ? 'bg-red-950/55 border-red-400/70 text-red-200'
                            : 'bg-[#071c36] border-cyan-500/25 text-slate-200'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="font-bold text-yellow-300 mr-1">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold">{alert.title}</span>
                          <span className="block text-[9px] text-slate-400">
                            Depth {alert.depthMeters}m • X:{alert.worldX}m
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-black/50 font-bold text-orange-300 border border-orange-400/40 shrink-0">
                          Risk {alert.riskScore}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: SATELLITE BLACKOUT TELEMETRY VAULT (STORE-AND-FORWARD UPLINK) */}
            {activeTab === 'comms' && (
              <div className="bg-[#05162c] border border-cyan-500/30 rounded p-2 font-mono text-[11px] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-300 font-bold text-[10px] uppercase">
                    Blackout Telemetry Vault
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      uiState.commsOffline
                        ? 'bg-red-500/30 text-red-300 border border-red-400/50'
                        : 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                    }`}
                  >
                    {uiState.commsOffline ? 'BLACKOUT (RECORDING)' : 'SAT LINK LIVE'}
                  </span>
                </div>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleToggleCommsOutage}
                    className={`flex-1 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                      uiState.commsOffline
                        ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                        : 'bg-red-500/80 hover:bg-red-500 text-white border-red-400'
                    }`}
                  >
                    {uiState.commsOffline ? 'Reconnect & Burst-Sync' : 'Simulate Comms Outage'}
                  </button>
                  <button
                    type="button"
                    onClick={handleEnqueueManualPacket}
                    className="px-2 py-1 rounded text-[10px] bg-[#082240] hover:bg-cyan-900 text-cyan-200 border border-cyan-500/40 cursor-pointer"
                  >
                    +Log Frame
                  </button>
                </div>

                {/* 12-Slot Telemetry Recorder Dial */}
                <div className="bg-[#020b16] border border-cyan-500/20 rounded p-2 flex flex-col items-center">
                  <CircularQueueRingSvg snapshot={uiState.commsSnapshot} />
                  <div className="w-full flex justify-between text-[10px] text-slate-300 mt-1">
                    <span className="text-cyan-300">Oldest: #{uiState.commsSnapshot.head}</span>
                    <span className="text-yellow-300">Next Write: #{uiState.commsSnapshot.tail}</span>
                    <span>
                      Stored: {uiState.commsSnapshot.count}/{uiState.commsSnapshot.capacity}
                    </span>
                  </div>
                </div>

                {uiState.lastFlushedCount > 0 && !uiState.commsOffline && (
                  <div className="text-[10px] bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-2 py-1 rounded">
                    ✓ Link restored: Burst-synced {uiState.lastFlushedCount} recorded telemetry frames to
                    SAT-AEGIS-04.
                  </div>
                )}
              </div>
            )}

            {/* TAB: AUTONOMOUS COLLISION EVASION & SECTOR GRID SWEEP */}
            {activeTab === 'safety' && (
              <div className="bg-[#05162c] border border-cyan-500/30 rounded p-2 font-mono text-[11px] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-300 font-bold text-[10px] uppercase">
                    Tether-Safe Waypoint Retrace ({uiState.stackItems.length})
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      uiState.safetyState.isWarning
                        ? 'bg-red-500 text-white'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {uiState.safetyState.isWarning ? 'EVADING HAZARD' : 'SAFE CORRIDOR'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => handleTriggerHazardBacktrackDemo('poacher')}
                    className="py-1 px-1 rounded bg-red-500/25 hover:bg-red-500/40 text-red-200 border border-red-400/50 text-[9px] font-semibold cursor-pointer"
                  >
                    Ship Net Evasion
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerHazardBacktrackDemo('net')}
                    className="py-1 px-1 rounded bg-orange-500/25 hover:bg-orange-500/40 text-orange-200 border border-orange-400/50 text-[9px] font-semibold cursor-pointer"
                  >
                    Ghost Net Brake
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerHazardBacktrackDemo('wreck')}
                    className="py-1 px-1 rounded bg-yellow-500/25 hover:bg-yellow-500/40 text-yellow-200 border border-yellow-400/50 text-[9px] font-semibold cursor-pointer"
                  >
                    Wreck Evasion
                  </button>
                </div>

                {/* Net Tackling Clearance Demo (Auto Patrol & Auto Survey) */}
                <div className="bg-[#020b16] border border-emerald-500/30 rounded p-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-emerald-300 font-bold uppercase">
                      Autonomous Net Clearance Pass
                    </span>
                    <span className="text-yellow-300 font-semibold">
                      {uiState.netTackle.phase}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => handleInspectPoachingShipNet(0, 'UNDER_NET')}
                      className="py-1 px-1.5 rounded bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-200 border border-cyan-400/50 text-[9px] font-bold cursor-pointer"
                    >
                      ▼ Dive Under Ship Net
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInspectPoachingShipNet(0, 'OVER_NET')}
                      className="py-1 px-1.5 rounded bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/50 text-[9px] font-bold cursor-pointer"
                    >
                      ▲ Skim Above Ship Net
                    </button>
                  </div>
                </div>

                {/* Safe Tether Waypoint Breadcrumb Log */}
                <div className="bg-[#020b16] border border-cyan-500/20 rounded p-1.5 max-h-28 overflow-y-auto space-y-1">
                  {uiState.stackItems.slice(0, 5).map((pt, idx) => (
                    <div
                      key={`${pt.x}-${pt.y}-${idx}`}
                      className={`px-1.5 py-0.5 rounded text-[10px] flex justify-between ${
                        idx === 0
                          ? 'bg-yellow-400/20 border border-yellow-400/60 text-yellow-200 font-bold'
                          : 'bg-[#071c36] text-slate-300'
                      }`}
                    >
                      <span>{idx === 0 ? 'LATEST →' : `WP-#${idx}`}</span>
                      <span>
                        X:{pt.x}m • Y:{pt.y} ({pt.depthMeters}m)
                      </span>
                    </div>
                  ))}
                </div>

                {/* Autonomous Sector Grid Sweep */}
                <div className="pt-1.5 border-t border-cyan-500/25">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-purple-300 uppercase">
                      Autonomous Sector Grid Sweep
                    </span>
                    <button
                      type="button"
                      onClick={handleStartRecursiveDfsSurvey}
                      className="px-2 py-0.5 rounded bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-[10px] cursor-pointer"
                    >
                      Run Sector Sweep
                    </button>
                  </div>
                  <div className="grid grid-cols-6 gap-1 bg-[#020b16] p-1.5 rounded border border-purple-500/30">
                    {uiState.dfsSurvey.gridCells.map((cell) => {
                      const isCurrent =
                        uiState.mode === 'Auto Survey' &&
                        uiState.dfsSurvey.currentNode?.col === cell.col &&
                        uiState.dfsSurvey.currentNode?.row === cell.row;
                      return (
                        <div
                          key={`${cell.col}-${cell.row}`}
                          className={`h-6 rounded flex items-center justify-center text-[9px] font-bold border ${
                            cell.isHazard
                              ? 'bg-red-950/80 border-red-500/60 text-red-300'
                              : isCurrent
                                ? 'bg-yellow-400 text-slate-950 border-yellow-200'
                                : 'bg-purple-950/50 border-purple-500/40 text-purple-200'
                          }`}
                        >
                          {cell.isHazard ? 'HAZ' : `#${cell.order}`}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: GLOBAL IUU VESSEL INTELLIGENCE & AIS REGISTRY */}
            {activeTab === 'vessel' && (
              <div className="bg-[#05162c] border border-cyan-500/30 rounded p-2 font-mono text-[11px] space-y-2">
                <div className="text-cyan-300 font-bold text-[10px] uppercase">
                  Global Vessel Intelligence (2,500 Hulls)
                </div>

                <div className="flex gap-1">
                  <select
                    aria-label="Select Vessel ID"
                    value={vesselQuery}
                    onChange={(e) => handleRunVesselLookup(e.target.value)}
                    className="flex-1 bg-[#020b16] border border-cyan-500/40 rounded px-1.5 py-1 text-[10px] text-cyan-100"
                  >
                    {CORE_VESSEL_REGISTRY.map((v) => (
                      <option key={v.vesselId} value={v.vesselId}>
                        {v.vesselId} — {v.name.slice(0, 18)} ({v.status})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRunVesselLookup(vesselQuery)}
                    className="px-2 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-[10px] cursor-pointer"
                  >
                    Verify Hull
                  </button>
                </div>

                {vesselBench.foundEntry ? (
                  <div className="p-2 rounded bg-[#020b16] border border-cyan-500/30 space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-yellow-300">
                        {vesselBench.foundEntry.vesselId} ({vesselBench.foundEntry.flag})
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                          vesselBench.foundEntry.status === 'BLACKLISTED'
                            ? 'bg-red-500/30 text-red-300 border border-red-400/60'
                            : vesselBench.foundEntry.status === 'SUSPICIOUS'
                              ? 'bg-orange-500/30 text-orange-300 border border-orange-400/60'
                              : 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50'
                        }`}
                      >
                        {vesselBench.foundEntry.status}
                      </span>
                    </div>
                    <div className="text-slate-200 font-semibold">
                      {vesselBench.foundEntry.name}
                    </div>
                    <div className="text-slate-400 text-[9px]">
                      MMSI: {vesselBench.foundEntry.mmsi} • {vesselBench.foundEntry.notes}
                    </div>
                  </div>
                ) : (
                  <div className="text-red-300 text-[10px]">Vessel ID not found.</div>
                )}

                {/* Registry Query Latency Comparison */}
                <div className="bg-[#020b16] border border-cyan-500/20 rounded p-1.5 space-y-1 text-[10px]">
                  <div className="text-[9px] text-slate-400 uppercase">
                    Registry Query Latency ({vesselBench.iterations.toLocaleString()} Checks)
                  </div>
                  <div className="flex justify-between text-emerald-300 font-bold">
                    <span>Direct Callsign Index</span>
                    <span>Instant • {vesselBench.hashMapMs} ms</span>
                  </div>
                  <div className="flex justify-between text-cyan-300">
                    <span>Ordered IMO Catalog</span>
                    <span>Indexed • {vesselBench.binarySearchMs} ms</span>
                  </div>
                  <div className="flex justify-between text-orange-300">
                    <span>Full Regional Ledger</span>
                    <span>Sequential • {vesselBench.linearScanMs} ms</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: RECENT OPTICAL & SONAR DETECTIONS */}
            {activeTab === 'detections' && (
              <div className="bg-[#05162c] border border-cyan-500/30 rounded p-2 font-mono text-[11px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-300 font-bold text-[10px] uppercase">
                    Optical & Sonar Detections
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {uiState.recentDetections.length} unique
                  </span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                  {uiState.recentDetections.map((det) => (
                    <div
                      key={det.id}
                      className="p-1.5 rounded border border-cyan-500/30 bg-[#071c36] text-[10px] flex justify-between"
                    >
                      <div>
                        <span className="font-bold text-yellow-300 block">{det.label}</span>
                        <span className="text-slate-400">Dist: {det.distanceMeters}m</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-cyan-200 block">{det.confidence}%</span>
                        <span className="text-slate-400">T+{det.timestampStr}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Compact On-Screen Touch / Thruster D-Pad */}
          <div className="pt-1.5 border-t border-cyan-500/25 mt-1">
            <div className="grid grid-cols-4 gap-1 font-mono text-xs">
              <button
                type="button"
                aria-label="Thrust Left"
                onMouseDown={() => setTouchDirection('left', true)}
                onMouseUp={() => setTouchDirection('left', false)}
                onMouseLeave={() => setTouchDirection('left', false)}
                className="py-1 rounded bg-[#071c36] hover:bg-cyan-900 active:bg-yellow-400 active:text-slate-950 border border-cyan-500/40 font-bold cursor-pointer"
              >
                ◀
              </button>
              <button
                type="button"
                aria-label="Thrust Up"
                onMouseDown={() => setTouchDirection('up', true)}
                onMouseUp={() => setTouchDirection('up', false)}
                onMouseLeave={() => setTouchDirection('up', false)}
                className="py-1 rounded bg-[#071c36] hover:bg-cyan-900 active:bg-yellow-400 active:text-slate-950 border border-cyan-500/40 font-bold cursor-pointer"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="Thrust Down"
                onMouseDown={() => setTouchDirection('down', true)}
                onMouseUp={() => setTouchDirection('down', false)}
                onMouseLeave={() => setTouchDirection('down', false)}
                className="py-1 rounded bg-[#071c36] hover:bg-cyan-900 active:bg-yellow-400 active:text-slate-950 border border-cyan-500/40 font-bold cursor-pointer"
              >
                ▼
              </button>
              <button
                type="button"
                aria-label="Thrust Right"
                onMouseDown={() => setTouchDirection('right', true)}
                onMouseUp={() => setTouchDirection('right', false)}
                onMouseLeave={() => setTouchDirection('right', false)}
                className="py-1 rounded bg-[#071c36] hover:bg-cyan-900 active:bg-yellow-400 active:text-slate-950 border border-cyan-500/40 font-bold cursor-pointer"
              >
                ▶
              </button>
            </div>
          </div>
        </aside>

        {/* 4. PERSISTENT FOOTER */}
        <footer className="pointer-events-auto absolute bottom-0 left-0 right-0 h-6 bg-[#020a16]/95 border-t border-cyan-500/30 px-4 flex items-center justify-between text-[10px] font-mono text-slate-300 z-20">
          <span>Simulated data for demonstration. No real vessels or wildlife are tracked.</span>
          <span className="text-yellow-300/90 hidden sm:inline">
            AI output is decision support, not proof of a violation. All data is simulated.
          </span>
        </footer>

        {/* MISSION SELECT MODAL (4 Presets) */}
        {showMissionSelectModal && (
          <div className="pointer-events-auto fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 font-mono">
            <div className="max-w-3xl w-full bg-[#041326] border-2 border-cyan-400/60 rounded-lg p-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-cyan-500/30 mb-4">
                <div>
                  <span className="text-[10px] text-cyan-400 uppercase tracking-widest block">
                    AEGIS SUBSEA DEPLOYMENT BRIEFING
                  </span>
                  <h2 className="text-lg font-bold text-yellow-300">
                    SELECT MISSION PRESET (UN SDG 14: LIFE BELOW WATER)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMissionSelectModal(false)}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs cursor-pointer"
                >
                  Close [ESC]
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {missions.map((preset) => {
                  const isSelected = preset.id === activeMissionId;
                  const done = preset.objectives.filter((o) => o.completed).length;
                  return (
                    <div
                      key={preset.id}
                      className={`p-3.5 rounded-lg border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#092748] border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]'
                          : 'bg-[#061a33] border-cyan-500/35 hover:border-cyan-400'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-cyan-200">{preset.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                            {done}/{preset.objectives.length} Done
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mb-2">{preset.subtitle}</p>
                        <div className="text-[10px] text-yellow-300 font-semibold mb-2">
                          {preset.sdgTarget}
                        </div>
                        <ul className="space-y-1 text-[10px] text-slate-200 mb-3">
                          {preset.objectives.map((o) => (
                            <li key={o.id}>
                              {o.completed ? '☑' : '☐'} {o.description}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectMissionPreset(preset)}
                          className="flex-1 py-1.5 rounded bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          Deploy Mission
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMissionId(preset.id);
                            setShowMissionSelectModal(false);
                            setShowMissionResultsModal(true);
                          }}
                          className="px-2.5 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/50 text-xs cursor-pointer"
                        >
                          Impact
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* MISSION RESULTS & SDG 14 IMPACT SCREEN */}
        {showMissionResultsModal && (
          <div className="pointer-events-auto fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 font-mono">
            <div className="max-w-2xl w-full bg-[#041326] border-2 border-emerald-400/70 rounded-lg p-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-500/30 mb-3">
                <div>
                  <span className="text-[10px] text-emerald-400 uppercase tracking-widest block">
                    MISSION DEBRIEF & CONSERVATION ASSESSMENT
                  </span>
                  <h2 className="text-lg font-bold text-yellow-300">
                    {activeMission.title} — Impact Report
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMissionResultsModal(false)}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs cursor-pointer"
                >
                  Resume Patrol
                </button>
              </div>

              <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-400/50 text-center text-xs font-bold text-emerald-200 mb-4">
                Protects Marine Life | Reduces Pollution | Enhances Maritime Security | Supports
                Sustainable Oceans (SDG 14)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs">
                <div className="p-3 rounded bg-[#071f3b] border border-emerald-500/40">
                  <div className="text-emerald-300 font-bold mb-1">1. Protects Marine Life</div>
                  <p className="text-slate-200 text-[11px]">
                    {activeMission.impactMetrics.marineLifeProtected}
                  </p>
                </div>
                <div className="p-3 rounded bg-[#071f3b] border border-cyan-500/40">
                  <div className="text-cyan-300 font-bold mb-1">2. Reduces Pollution</div>
                  <p className="text-slate-200 text-[11px]">
                    {activeMission.impactMetrics.pollutionReduced}
                  </p>
                </div>
                <div className="p-3 rounded bg-[#071f3b] border border-orange-500/40">
                  <div className="text-orange-300 font-bold mb-1">
                    3. Enhances Maritime Security
                  </div>
                  <p className="text-slate-200 text-[11px]">
                    {activeMission.impactMetrics.maritimeSecurityEnhanced}
                  </p>
                </div>
                <div className="p-3 rounded bg-[#071f3b] border border-yellow-500/40">
                  <div className="text-yellow-300 font-bold mb-1">
                    4. Supports Sustainable Oceans (SDG 14)
                  </div>
                  <p className="text-slate-200 text-[11px]">
                    {activeMission.impactMetrics.sustainableOceansSdg14}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-cyan-500/30">
                <span className="text-xs text-slate-300">
                  Objectives Completed:{' '}
                  <strong className="text-emerald-300">
                    {completedCount}/{activeMission.objectives.length}
                  </strong>{' '}
                  ({missionProgressPct}%)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMissionResultsModal(false);
                      setShowMissionSelectModal(true);
                    }}
                    className="px-3 py-1.5 rounded bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-200 border border-cyan-400/50 text-xs font-bold cursor-pointer"
                  >
                    Select Next Mission
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMissionResultsModal(false)}
                    className="px-4 py-1.5 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Continue Simulation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. ON-SCREEN MISSION REPORT MODAL (Summary, Timeline, Detections, SDG 14 Targets 14.1, 14.2, 14.4, 14.5, 14.a + Print/Download JSON) */}
        {showMissionReportModal && (
          <MissionReportModal
            report={missionReportData}
            briefing={briefing}
            onClose={() => setShowMissionReportModal(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

/**
 * Renders a compact SVG Binary Max-Heap Tree for up to 7 heap elements (3 levels)
 */
const HeapTreeSvg: React.FC<{ nodes: UiTelemetrySnapshot['alertHeapArray'] }> = ({ nodes }) => {
  const coords = [
    { x: 115, y: 16 },
    { x: 58, y: 46 },
    { x: 172, y: 46 },
    { x: 30, y: 76 },
    { x: 86, y: 76 },
    { x: 144, y: 76 },
    { x: 200, y: 76 },
  ];

  return (
    <svg viewBox="0 0 230 92" className="w-full h-[80px] block">
      {nodes.map((_, idx) => {
        if (idx === 0 || idx >= coords.length) return null;
        const parentIdx = Math.floor((idx - 1) / 2);
        const p = coords[parentIdx];
        const c = coords[idx];
        return (
          <line
            key={`edge-${idx}`}
            x1={p.x}
            y1={p.y}
            x2={c.x}
            y2={c.y}
            stroke="#22d3ee"
            strokeOpacity={0.45}
            strokeWidth={1.5}
          />
        );
      })}
      {nodes.map((node, idx) => {
        if (idx >= coords.length) return null;
        const { x, y } = coords[idx];
        const isRoot = idx === 0;
        return (
          <g key={node.id}>
            <circle
              cx={x}
              cy={y}
              r={12}
              fill={isRoot ? '#ef4444' : '#0f2942'}
              stroke={isRoot ? '#fde047' : '#38bdf8'}
              strokeWidth={1.8}
            />
            <text
              x={x}
              y={y + 3.5}
              textAnchor="middle"
              fill={isRoot ? '#ffffff' : '#bae6fd'}
              fontSize="9"
              fontWeight="bold"
            >
              {node.riskScore}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/**
 * Renders the 12-slot Circular Queue Ring Buffer with HEAD and TAIL pointers
 */
const CircularQueueRingSvg: React.FC<{ snapshot: UiTelemetrySnapshot['commsSnapshot'] }> = ({
  snapshot,
}) => {
  const cx = 75;
  const cy = 56;
  const r = 38;

  return (
    <svg viewBox="0 0 150 112" className="w-[150px] h-[108px] block">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e3a5f" strokeWidth={10} />
      {snapshot.slots.map((slot, idx) => {
        const angle = (idx / snapshot.capacity) * Math.PI * 2 - Math.PI * 0.5;
        const sx = cx + Math.cos(angle) * r;
        const sy = cy + Math.sin(angle) * r;
        const isHead = idx === snapshot.head;
        const isTail = idx === snapshot.tail;
        const isFilled = slot !== null;

        return (
          <g key={idx}>
            <circle
              cx={sx}
              cy={sy}
              r={7.5}
              fill={isFilled ? '#0284c7' : '#09192f'}
              stroke={isHead ? '#22d3ee' : isTail ? '#facc15' : '#334155'}
              strokeWidth={isHead || isTail ? 2.2 : 1.2}
            />
            <text
              x={sx}
              y={sy + 3}
              textAnchor="middle"
              fill={isFilled ? '#ffffff' : '#64748b'}
              fontSize="7"
              fontWeight="bold"
            >
              {slot ? slot.seq : idx}
            </text>
          </g>
        );
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fill="#67e8f9" fontSize="8" fontWeight="bold">
        VAULT[12]
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill="#facc15" fontSize="7">
        OLD:{snapshot.head} NEW:{snapshot.tail}
      </text>
    </svg>
  );
};
