import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AlertMaxHeap,
  SensorCircularQueue,
  PositionStack,
  generateRecursiveDfsSurvey,
  vesselRegistryEngine,
  createMissionPresets,
} from './dsaStructures.ts';

test('Binary Max-Heap Priority Queue orders alerts by highest riskScore and maintains heap invariant', () => {
  const heap = new AlertMaxHeap();

  heap.insert({
    id: 'a1',
    targetId: 'plastic-bottle-1',
    title: 'Plastic Bottle',
    category: 'pollution',
    riskScore: 68,
    severity: 'MEDIUM',
    depthMeters: 42,
    worldX: 1090,
    worldY: 490,
    timestampStr: '00:05',
  });
  heap.insert({
    id: 'a2',
    targetId: 'suspicious-vessel-1',
    title: 'Suspicious Vessel',
    category: 'threat',
    riskScore: 96,
    severity: 'CRITICAL',
    depthMeters: 2,
    worldX: 4650,
    worldY: 180,
    timestampStr: '00:08',
  });
  heap.insert({
    id: 'a3',
    targetId: 'ghost-net-1',
    title: 'Ghost Net',
    category: 'threat',
    riskScore: 89,
    severity: 'CRITICAL',
    depthMeters: 110,
    worldX: 1480,
    worldY: 750,
    timestampStr: '00:10',
  });
  heap.insert({
    id: 'a4',
    targetId: 'oil-plume-1',
    title: 'Oil Plume',
    category: 'threat',
    riskScore: 91,
    severity: 'CRITICAL',
    depthMeters: 165,
    worldX: 2350,
    worldY: 980,
    timestampStr: '00:12',
  });

  // Duplicate targetId should not create a second node
  const dupInserted = heap.insert({
    id: 'a5',
    targetId: 'ghost-net-1',
    title: 'Ghost Net',
    category: 'threat',
    riskScore: 89,
    severity: 'CRITICAL',
    depthMeters: 110,
    worldX: 1480,
    worldY: 750,
    timestampStr: '00:14',
  });
  assert.equal(dupInserted, false);
  assert.equal(heap.size(), 4);

  // Verify binary max-heap property: parent >= children
  const arr = heap.toHeapArray();
  for (let i = 0; i < arr.length; i++) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left < arr.length) {
      assert.ok(arr[i].riskScore >= arr[left].riskScore, 'Parent must be >= left child');
    }
    if (right < arr.length) {
      assert.ok(arr[i].riskScore >= arr[right].riskScore, 'Parent must be >= right child');
    }
  }

  // Extract in descending risk order
  assert.equal(heap.extractMax()?.riskScore, 96);
  assert.equal(heap.extractMax()?.riskScore, 91);
  assert.equal(heap.extractMax()?.riskScore, 89);
  assert.equal(heap.extractMax()?.riskScore, 68);
  assert.equal(heap.extractMax(), null);
});

test('Circular Queue buffers offline sensor packets with head/tail wrap-around and flushes on reconnect', () => {
  const ring = new SensorCircularQueue<{ seq: number }>(4);

  ring.enqueue({ seq: 1 });
  ring.enqueue({ seq: 2 });
  ring.enqueue({ seq: 3 });
  ring.enqueue({ seq: 4 });
  // Next enqueue overwrites oldest (seq 1) and advances head to 1
  ring.enqueue({ seq: 5 });

  const snap = ring.getSnapshot();
  assert.equal(snap.count, 4);
  assert.equal(snap.head, 1);
  assert.equal(snap.tail, 1);
  assert.equal(snap.overwrittenCount, 1);

  const flushed = ring.flushAll();
  assert.deepEqual(
    flushed.map((p) => p.seq),
    [2, 3, 4, 5]
  );
  assert.equal(ring.getSnapshot().count, 0);
});

test('PositionStack pushes spaced waypoints and pops in LIFO order for hazard backtracking', () => {
  const stack = new PositionStack(10);
  stack.push({ x: 900, y: 400, depthMeters: 44, timestampSec: 1 });
  // Too close (< 55px) -> ignored
  stack.push({ x: 920, y: 410, depthMeters: 46, timestampSec: 2 });
  assert.equal(stack.size(), 1);

  // Far enough -> pushed
  stack.push({ x: 1000, y: 450, depthMeters: 54, timestampSec: 3 });
  stack.push({ x: 1100, y: 520, depthMeters: 68, timestampSec: 4 });
  assert.equal(stack.size(), 3);

  const popped = stack.pop();
  assert.equal(popped?.x, 1100);
  assert.equal(stack.peek()?.x, 1000);
});

test('Recursive DFS Survey generates valid connected traversal while avoiding hazard cells', () => {
  const { traversalOrder, gridCells } = generateRecursiveDfsSurvey(6, 3);
  assert.equal(gridCells.length, 18);
  // 2 hazard cells ('1,2' and '3,2') must be skipped
  assert.equal(traversalOrder.length, 16);
  for (const node of traversalOrder) {
    assert.equal(node.isHazard, false);
    assert.ok(node.callDepth >= 1);
  }
});

test('Vessel Registry HashMap, Binary Search, and Linear Scan agree and produce benchmark metrics', () => {
  const v1Hash = vesselRegistryEngine.lookupHashMap('V-001');
  const v1Bin = vesselRegistryEngine.lookupBinarySearch('V-001');
  const v1Lin = vesselRegistryEngine.lookupLinearScan('V-001');

  assert.ok(v1Hash);
  assert.equal(v1Hash.status, 'BLACKLISTED');
  assert.equal(v1Bin?.vesselId, 'V-001');
  assert.equal(v1Lin?.vesselId, 'V-001');

  const bench = vesselRegistryEngine.runBenchmark('V-005', 1000);
  assert.equal(bench.foundEntry?.status, 'BLACKLISTED');
  assert.ok(bench.hashMapMs > 0);
  assert.ok(bench.binarySearchMs > 0);
  assert.ok(bench.linearScanMs > 0);
});

test('Mission Presets include all 4 required missions with objectives', async () => {
  const presets = createMissionPresets();
  assert.equal(presets.length, 4);
  const titles = presets.map((p) => p.title);
  assert.deepEqual(titles, [
    'Illegal Trawler Patrol',
    'Plastic Hotspot Survey',
    'Protected Reef Guard',
    'Seabed Inspection',
  ]);

  const { computeAnalyticsSnapshot, generateMissionReportData } = await import(
    './analyticsAndReport.ts'
  );
  const analytics = computeAnalyticsSnapshot([], [], [], 920, 440, 1);
  assert.ok(analytics.pollutionIndex >= 12 && analytics.pollutionIndex <= 98);
  assert.ok(analytics.biodiversityCount >= 175);
  assert.ok(analytics.areaSurveyedPct >= 14);
  assert.ok(analytics.detectionsByClass.length >= 6);
  assert.equal(analytics.detectionsOverTime.length, 5);

  const report = generateMissionReportData({
    activeMission: presets[0],
    missionProgressPct: 67,
    depthMeters: 52.0,
    tempCelsius: 15.8,
    battery: 94,
    analytics,
    recentDetections: [],
    alerts: [],
    dispatchedCount: 1,
    poppedStackCount: 2,
  });

  assert.deepEqual(
    report.sdg14Targets.map((t) => t.code),
    ['14.1', '14.2', '14.4', '14.5', '14.a']
  );
});

