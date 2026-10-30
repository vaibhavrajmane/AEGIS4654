import React, { useMemo, useState } from 'react';
import {
  Alert,
  Detection,
  SimulatedNotification,
  Vector3D,
  Vessel,
} from '../types';
import {
  BufferedPacket,
  DsaSelfTestResult,
  VesselHashTable,
  computeDfsEscapePath,
  mergeSortDetections,
  quickSortNumbers,
  runDsaSelfTestSuite,
} from '../lib/dsa';

interface DsaShowcasePanelProps {
  alertsHeapArray: Alert[];
  onDispatchTopAlert: () => void;
  onInjectTestAlert: () => void;
  ringBufferState: {
    slots: (BufferedPacket<any> | null)[];
    head: number;
    tail: number;
    count: number;
    capacity: number;
    overwrittenCount: number;
    utilizationPct: number;
  };
  commsOutage: boolean;
  onToggleCommsOutage: () => void;
  waypointStackItems: Vector3D[];
  vessels: Vessel[];
  detections: Detection[];
  notifications: SimulatedNotification[];
}

export const DsaShowcasePanel: React.FC<DsaShowcasePanelProps> = ({
  alertsHeapArray,
  onDispatchTopAlert,
  onInjectTestAlert,
  ringBufferState,
  commsOutage,
  onToggleCommsOutage,
  waypointStackItems,
  vessels,
  detections,
  notifications,
}) => {
  const [selfTests, setSelfTests] = useState<DsaSelfTestResult[]>(() =>
    runDsaSelfTestSuite()
  );
  const [mmsiQuery, setMmsiQuery] = useState('538009112');
  const [sortCriteria, setSortCriteria] = useState<'confidence' | 'distance'>('confidence');

  // Build live Hash Table from vessels
  const vesselHashTable = useMemo(() => {
    const ht = new VesselHashTable<Vessel>(8);
    for (const v of vessels) {
      ht.set(v.mmsi, v);
    }
    return ht;
  }, [vessels]);

  const queriedVessel = vesselHashTable.get(mmsiQuery.trim());
  const hashBuckets = vesselHashTable.getBucketsSnapshot();

  // Compute live Recursive DFS Escape Path on a 6x6 sonar occupancy grid
  const dfsDemo = useMemo(() => {
    const grid = [
      [0, 0, 1, 0, 0, 0],
      [0, 1, 1, 0, 1, 0],
      [0, 0, 0, 0, 1, 0],
      [1, 1, 0, 1, 1, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0, 0],
    ];
    const res = computeDfsEscapePath(grid, { r: 0, c: 0 }, { r: 5, c: 5 });
    return { grid, ...res };
  }, []);

  // Merge Sort & Quick Sort demo stats
  const mergeSortStats = useMemo(
    () => mergeSortDetections(detections, sortCriteria),
    [detections, sortCriteria]
  );
  const quickSortStats = useMemo(
    () => quickSortNumbers(vessels.map((v) => v.riskScore)),
    [vessels]
  );

  return (
    <div className="flex flex-col gap-4" data-testid="dsa-showcase-panel">
      {/* Header & Self-Test Verification Banner */}
      <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-display font-bold uppercase text-white">
              Data Structures & Algorithms (DSA) Telemetry Engine + Self-Test Suite
            </h2>
            <p className="text-xs text-slate-300">
              Real-time visualization of the 5 core data structures powering alert triage, outage resilience, obstacle backtracking, and vessel indexing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelfTests(runDsaSelfTestSuite())}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0"
          >
            Re-Run DSA Self-Tests ({selfTests.filter((t) => t.passed).length}/{selfTests.length} PASS)
          </button>
        </div>

        {/* Built-in Automated Self-Test Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-cyan-900/60 text-slate-400 font-mono">
                <th className="py-1.5 pr-3">Status</th>
                <th className="py-1.5 px-3">Data Structure / Algorithm</th>
                <th className="py-1.5 px-3">AEGIS Subsystem Role</th>
                <th className="py-1.5 px-3">Time Complexity</th>
                <th className="py-1.5 pl-3">Live Verification Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-950/60">
              {selfTests.map((t) => (
                <tr key={t.id} className="hover:bg-cyan-950/30">
                  <td className="py-2 pr-3 font-mono font-bold">
                    <span className={t.passed ? 'text-emerald-400' : 'text-red-400'}>
                      {t.passed ? '[PASS]' : '[FAIL]'}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold text-white">
                    {t.structureName}
                  </td>
                  <td className="py-2 px-3 text-slate-300">{t.applicationRole}</td>
                  <td className="py-2 px-3 font-mono text-cyan-300">{t.complexity}</td>
                  <td className="py-2 pl-3 font-mono text-slate-300">
                    {t.assertionSummary} ({t.durationMs}ms)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-Column Interactive DSA Visualizers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Binary Max-Heap Priority Queue Visualizer */}
        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-display font-bold uppercase text-white">
                1. Binary Max-Heap Priority Queue (Alert Triage)
              </h3>
              <p className="text-xs text-slate-400">
                Root node [0] always holds highest riskScore alert in O(1) time.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onDispatchTopAlert}
                disabled={alertsHeapArray.length === 0}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                Dispatch Max Root
              </button>
              <button
                type="button"
                onClick={onInjectTestAlert}
                className="px-2.5 py-1 text-xs font-medium rounded bg-[#091e3a] text-cyan-300 hover:bg-cyan-900/50 whitespace-nowrap shrink-0"
              >
                + Enqueue Alert
              </button>
            </div>
          </div>

          {/* Visual Binary Tree SVG of top 7 heap nodes */}
          <div className="bg-[#030d1c] border border-cyan-950 rounded p-2">
            <svg viewBox="0 0 420 150" className="w-full h-[140px]">
              {/* Edges */}
              {[
                [0, 1, 210, 26, 110, 76],
                [0, 2, 210, 26, 310, 76],
                [1, 3, 110, 76, 60, 126],
                [1, 4, 110, 76, 160, 126],
                [2, 5, 310, 76, 260, 126],
                [2, 6, 310, 76, 360, 126],
              ].map(([pIdx, cIdx, x1, y1, x2, y2]) =>
                alertsHeapArray[cIdx] ? (
                  <line
                    key={`${pIdx}-${cIdx}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#0e7490"
                    strokeWidth="1.5"
                  />
                ) : null
              )}

              {/* Nodes */}
              {[
                [0, 210, 26],
                [1, 110, 76],
                [2, 310, 76],
                [3, 60, 126],
                [4, 160, 126],
                [5, 260, 126],
                [6, 360, 126],
              ].map(([idx, cx, cy]) => {
                const node = alertsHeapArray[idx];
                if (!node) return null;
                const isRoot = idx === 0;
                return (
                  <g key={node.id}>
                    <rect
                      x={cx - 42}
                      y={cy - 15}
                      width="84"
                      height="30"
                      rx="4"
                      fill={isRoot ? '#7f1d1d' : '#082f49'}
                      stroke={isRoot ? '#ef4444' : '#06b6d4'}
                      strokeWidth={isRoot ? '2' : '1'}
                    />
                    <text
                      x={cx}
                      y={cy - 2}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                    >
                      [{idx}] Score: {node.riskScore}
                    </text>
                    <text
                      x={cx}
                      y={cy + 10}
                      textAnchor="middle"
                      fill="#bae6fd"
                      fontSize="8"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {node.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {notifications.length > 0 && (
            <div className="text-xs font-mono bg-[#040f21] border border-cyan-900/50 rounded p-2 text-slate-300">
              <div className="text-cyan-300 font-semibold mb-1">
                Simulated Multi-Channel Dispatch Log (Latest):
              </div>
              {notifications.slice(0, 2).map((n) => (
                <div key={n.id} className="truncate">
                  [{n.channel}] → {n.recipient}: {n.subject} ({n.timestamp})
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Circular Queue (Ring Buffer) Outage Visualizer */}
        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-display font-bold uppercase text-white">
                2. Circular Queue Ring Buffer (Comms Outage Resilience)
              </h3>
              <p className="text-xs text-slate-400">
                Buffers ROV sensor frames when satellite link drops; flushes FIFO on reconnect.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleCommsOutage}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                commsOutage
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-amber-500 text-slate-950'
              }`}
            >
              {commsOutage ? 'Restore Comms & Flush Queue' : 'Simulate Comms Outage'}
            </button>
          </div>

          <div className="grid grid-cols-6 gap-1.5 bg-[#030d1c] border border-cyan-950 rounded p-3">
            {ringBufferState.slots.map((slot, idx) => {
              const isHead = idx === ringBufferState.head;
              const isTail = idx === ringBufferState.tail;
              return (
                <div
                  key={idx}
                  className={`p-2 rounded border text-center font-mono text-[11px] ${
                    slot
                      ? 'bg-amber-950/60 border-amber-500/70 text-amber-200'
                      : 'bg-[#06152d] border-cyan-900/40 text-slate-500'
                  }`}
                >
                  <div className="text-[9px] text-slate-400">
                    Slot [{idx}] {isHead ? 'H' : ''} {isTail ? 'T' : ''}
                  </div>
                  <div className="font-semibold truncate mt-0.5">
                    {slot ? `#${slot.seq}` : 'EMPTY'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-300 bg-[#040f21] p-2 rounded border border-cyan-900/40">
            <span>HEAD: [{ringBufferState.head}]</span>
            <span>TAIL: [{ringBufferState.tail}]</span>
            <span>
              BUFFERED: {ringBufferState.count}/{ringBufferState.capacity} (
              {ringBufferState.utilizationPct}%)
            </span>
            <span>OVERWRITTEN: {ringBufferState.overwrittenCount}</span>
          </div>
        </div>

        {/* 3. Waypoint Stack & Recursive DFS Backtracking */}
        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col gap-3">
          <div>
            <h3 className="text-base font-display font-bold uppercase text-white">
              3. LIFO Waypoint Stack & Recursive DFS Obstacle Backtracking
            </h3>
            <p className="text-xs text-slate-400">
              Pushes safe 3D breadcrumbs; when ROV nears Ghost Net #GN-04 or Wreck, pops stack & computes DFS escape path.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* LIFO Stack Frames */}
            <div className="bg-[#030d1c] border border-cyan-950 rounded p-2.5 font-mono text-xs">
              <div className="text-cyan-300 font-semibold mb-1.5">
                LIFO Breadcrumb Stack ({waypointStackItems.length} frames):
              </div>
              <div className="space-y-1 max-h-[115px] overflow-y-auto">
                {waypointStackItems
                  .slice(-5)
                  .reverse()
                  .map((pt, i) => (
                    <div
                      key={i}
                      className={`px-2 py-1 rounded flex justify-between ${
                        i === 0
                          ? 'bg-cyan-900/60 text-white border border-cyan-500/50'
                          : 'bg-[#06152d] text-slate-400'
                      }`}
                    >
                      <span>{i === 0 ? 'TOP →' : `[-${i}]`}</span>
                      <span>
                        ({pt.x}, {pt.y}m, {pt.z})
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Recursive DFS Sonar Grid Visualization */}
            <div className="bg-[#030d1c] border border-cyan-950 rounded p-2.5 flex flex-col justify-between">
              <div className="text-xs font-mono text-emerald-300 mb-1">
                Recursive DFS Escape Path ({dfsDemo.path.length} steps, {dfsDemo.nodesVisited} visited):
              </div>
              <div className="grid grid-cols-6 gap-1">
                {dfsDemo.grid.map((row, rIdx) =>
                  row.map((cell, cIdx) => {
                    const onPath = dfsDemo.path.some(
                      (p) => p.r === rIdx && p.c === cIdx
                    );
                    return (
                      <div
                        key={`${rIdx}-${cIdx}`}
                        className={`h-4 rounded-xs text-[9px] font-mono flex items-center justify-center ${
                          cell === 1
                            ? 'bg-red-900/80 text-red-200'
                            : onPath
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-[#071c38] text-slate-600'
                        }`}
                      >
                        {cell === 1 ? 'NET' : onPath ? '●' : ''}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4. FNV-1a Hash Table + Merge/Quick Sort */}
        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-display font-bold uppercase text-white">
                4. O(1) Vessel Hash Table & 5. Merge/Quick Sort
              </h3>
              <p className="text-xs text-slate-400">
                FNV-1a hash maps MMSI transponders into 8 chained buckets; Merge/Quick sort ranks tracks.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <label htmlFor="mmsi-lookup" className="text-xs font-mono text-slate-300">
                MMSI:
              </label>
              <input
                id="mmsi-lookup"
                type="text"
                value={mmsiQuery}
                onChange={(e) => setMmsiQuery(e.target.value)}
                placeholder="538009112"
                className="w-28 bg-[#030d1c] border border-cyan-800 rounded px-2 py-1 text-xs font-mono text-white"
              />
            </div>
          </div>

          {/* Instant O(1) Lookup Result */}
          <div className="bg-[#030d1c] border border-cyan-950 rounded p-2 text-xs font-mono">
            {queriedVessel ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-emerald-300">
                <span>
                  O(1) HIT → {queriedVessel.name} [{queriedVessel.flag}]
                </span>
                <span className="text-amber-300">
                  Bucket [
                  {VesselHashTable.fnv1aHash(mmsiQuery.trim()) % 8}] · Risk:{' '}
                  {queriedVessel.riskScore}/100
                </span>
              </div>
            ) : (
              <div className="text-slate-400">
                O(1) MISS → Try MMSI 538009112 (FV Black Fin) or 244810221 (AEGIS-01)
              </div>
            )}
          </div>

          {/* Hash Buckets + Sort Summary */}
          <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
            {hashBuckets.map((bucket, bIdx) => (
              <div
                key={bIdx}
                className="bg-[#040f21] border border-cyan-900/40 rounded p-1.5 truncate"
              >
                <span className="text-cyan-400">B[{bIdx}]:</span>{' '}
                {bucket.length > 0
                  ? bucket.map((e) => e.key.slice(-4)).join(',')
                  : '∅'}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono bg-[#040f21] p-2 rounded border border-cyan-900/40">
            <span>
              MergeSort ({detections.length} detections):{' '}
              <strong className="text-cyan-300">{mergeSortStats.comparisons} cmp</strong>
            </span>
            <span>
              QuickSort ({vessels.length} vessels):{' '}
              <strong className="text-amber-300">
                [{quickSortStats.sorted.join(', ')}]
              </strong>
            </span>
            <button
              type="button"
              onClick={() =>
                setSortCriteria((c) => (c === 'confidence' ? 'distance' : 'confidence'))
              }
              className="text-cyan-400 hover:underline"
            >
              Toggle Key ({sortCriteria})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
