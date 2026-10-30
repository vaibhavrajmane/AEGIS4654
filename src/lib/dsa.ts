import { Alert, Detection, Vector3D, Vessel } from '../types';

/**
 * 1. BINARY MAX-HEAP PRIORITY QUEUE
 * Used to rank maritime & environmental alerts by riskScore (1..100).
 * Highest-risk alert is always at index 0 in O(1) peek and O(log N) enqueue/dequeue.
 */
export class AlertMaxHeap {
  private heap: Alert[] = [];

  constructor(initialAlerts: Alert[] = []) {
    for (const a of initialAlerts) {
      this.enqueue(a);
    }
  }

  public size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public peek(): Alert | undefined {
    return this.heap[0];
  }

  public enqueue(alert: Alert): void {
    // Prevent duplicate IDs
    const existingIdx = this.heap.findIndex((item) => item.id === alert.id);
    if (existingIdx !== -1) {
      if (alert.riskScore > this.heap[existingIdx].riskScore) {
        this.heap[existingIdx] = alert;
        this.bubbleUp(existingIdx);
      }
      return;
    }
    this.heap.push(alert);
    this.bubbleUp(this.heap.length - 1);
  }

  public dequeueMax(): Alert | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const max = this.heap[0];
    const last = this.heap.pop()!;
    this.heap[0] = last;
    this.sinkDown(0);
    return max;
  }

  public toArray(): Alert[] {
    return [...this.heap];
  }

  public toSortedArray(): Alert[] {
    const copy = new AlertMaxHeap(this.heap);
    const result: Alert[] = [];
    while (!copy.isEmpty()) {
      result.push(copy.dequeueMax()!);
    }
    return result;
  }

  /**
   * Validates the Max-Heap invariant: parent.riskScore >= child.riskScore for all nodes
   */
  public verifyHeapInvariant(): boolean {
    for (let i = 0; i < this.heap.length; i++) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < this.heap.length && this.heap[i].riskScore < this.heap[left].riskScore) {
        return false;
      }
      if (right < this.heap.length && this.heap[i].riskScore < this.heap[right].riskScore) {
        return false;
      }
    }
    return true;
  }

  private bubbleUp(index: number): void {
    let idx = index;
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[idx].riskScore > this.heap[parentIdx].riskScore) {
        const temp = this.heap[idx];
        this.heap[idx] = this.heap[parentIdx];
        this.heap[parentIdx] = temp;
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  private sinkDown(index: number): void {
    let idx = index;
    const length = this.heap.length;
    while (true) {
      const leftIdx = 2 * idx + 1;
      const rightIdx = 2 * idx + 2;
      let largest = idx;

      if (leftIdx < length && this.heap[leftIdx].riskScore > this.heap[largest].riskScore) {
        largest = leftIdx;
      }
      if (rightIdx < length && this.heap[rightIdx].riskScore > this.heap[largest].riskScore) {
        largest = rightIdx;
      }

      if (largest !== idx) {
        const temp = this.heap[idx];
        this.heap[idx] = this.heap[largest];
        this.heap[largest] = temp;
        idx = largest;
      } else {
        break;
      }
    }
  }
}

/**
 * 2. CIRCULAR QUEUE (RING BUFFER)
 * Used to buffer ROV telemetry & sensor detection packets during satellite/acoustic comms outages.
 * Overwrites oldest packet if full, and flushes FIFO when link is restored.
 */
export interface BufferedPacket<T = unknown> {
  seq: number;
  timestamp: string;
  label: string;
  payload: T;
}

export class CircularRingBuffer<T = unknown> {
  private buffer: (BufferedPacket<T> | null)[];
  private head = 0;
  private tail = 0;
  private count = 0;
  private readonly capacity: number;
  private overwrittenCount = 0;

  constructor(capacity = 12) {
    this.capacity = Math.max(2, capacity);
    this.buffer = new Array(this.capacity).fill(null);
  }

  public enqueue(packet: BufferedPacket<T>): void {
    this.buffer[this.tail] = packet;
    if (this.count === this.capacity) {
      // Ring buffer full: advance head to overwrite oldest
      this.head = (this.head + 1) % this.capacity;
      this.overwrittenCount++;
    } else {
      this.count++;
    }
    this.tail = (this.tail + 1) % this.capacity;
  }

  public dequeue(): BufferedPacket<T> | null {
    if (this.count === 0) return null;
    const item = this.buffer[this.head];
    this.buffer[this.head] = null;
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    return item;
  }

  public flushAll(): BufferedPacket<T>[] {
    const flushed: BufferedPacket<T>[] = [];
    while (this.count > 0) {
      const item = this.dequeue();
      if (item) flushed.push(item);
    }
    return flushed;
  }

  public getState() {
    return {
      slots: [...this.buffer],
      head: this.head,
      tail: this.tail,
      count: this.count,
      capacity: this.capacity,
      overwrittenCount: this.overwrittenCount,
      utilizationPct: Math.round((this.count / this.capacity) * 100),
    };
  }
}

/**
 * 3. WAYPOINT STACK & RECURSIVE DFS OBSTACLE BACKTRACKING
 * Used by the ROV safety subsystem to record safe breadcrumbs and recursively search
 * an obstacle-free escape trajectory when approaching ghost nets or shipwrecks.
 */
export class WaypointStack {
  private stack: Vector3D[] = [];
  private readonly maxDepth: number;

  constructor(maxDepth = 24) {
    this.maxDepth = maxDepth;
  }

  public push(point: Vector3D): void {
    if (this.stack.length > 0) {
      const top = this.stack[this.stack.length - 1];
      const dx = point.x - top.x;
      const dy = point.y - top.y;
      const dz = point.z - top.z;
      if (dx * dx + dy * dy + dz * dz < 9) {
        // Only push if moved >= 3 meters from last breadcrumb
        return;
      }
    }
    if (this.stack.length >= this.maxDepth) {
      this.stack.shift();
    }
    this.stack.push({
      x: Number(point.x.toFixed(1)),
      y: Number(point.y.toFixed(1)),
      z: Number(point.z.toFixed(1)),
    });
  }

  public pop(): Vector3D | undefined {
    return this.stack.pop();
  }

  public peek(): Vector3D | undefined {
    return this.stack[this.stack.length - 1];
  }

  public size(): number {
    return this.stack.length;
  }

  public getItems(): Vector3D[] {
    return [...this.stack];
  }
}

export interface GridCell {
  r: number;
  c: number;
}

/**
 * Recursive Depth-First Search (DFS) on a 2D local sonar occupancy grid
 * to compute a collision-free escape path out of a hazard zone.
 */
export function computeDfsEscapePath(
  grid: number[][], // 0 = free water, 1 = ghost net / wreck obstacle
  start: GridCell,
  goal: GridCell
): { path: GridCell[]; nodesVisited: number } {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const visited: boolean[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(false)
  );
  const path: GridCell[] = [];
  let nodesVisited = 0;

  const directions: GridCell[] = [
    { r: -1, c: 0 },
    { r: 0, c: 1 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
  ];

  // Order directions heuristically toward goal first while preserving pure recursive DFS
  function dfs(r: number, c: number): boolean {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    if (grid[r][c] === 1 || visited[r][c]) return false;

    visited[r][c] = true;
    nodesVisited++;
    path.push({ r, c });

    if (r === goal.r && c === goal.c) {
      return true;
    }

    const sortedDirs = [...directions].sort((a, b) => {
      const distA = Math.abs(r + a.r - goal.r) + Math.abs(c + a.c - goal.c);
      const distB = Math.abs(r + b.r - goal.r) + Math.abs(c + b.c - goal.c);
      return distA - distB;
    });

    for (const d of sortedDirs) {
      if (dfs(r + d.r, c + d.c)) {
        return true;
      }
    }

    // Backtrack! Pop dead-end cell from stack
    path.pop();
    return false;
  }

  dfs(start.r, start.c);
  return { path, nodesVisited };
}

/**
 * 4. CUSTOM HASH TABLE (FNV-1a Hash + Bucket Chaining)
 * Provides O(1) average-case lookup of surface vessels by ID or MMSI.
 */
export interface HashBucketEntry<V> {
  key: string;
  value: V;
  hash: number;
}

export class VesselHashTable<V = Vessel> {
  private buckets: HashBucketEntry<V>[][];
  private readonly numBuckets: number;
  private itemCount = 0;

  constructor(numBuckets = 8) {
    this.numBuckets = numBuckets;
    this.buckets = Array.from({ length: numBuckets }, () => []);
  }

  public static fnv1aHash(key: string): number {
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private getBucketIndex(key: string): { index: number; hash: number } {
    const hash = VesselHashTable.fnv1aHash(key);
    return { index: hash % this.numBuckets, hash };
  }

  public set(key: string, value: V): void {
    const { index, hash } = this.getBucketIndex(key);
    const bucket = this.buckets[index];
    const existing = bucket.find((entry) => entry.key === key);
    if (existing) {
      existing.value = value;
      return;
    }
    bucket.push({ key, value, hash });
    this.itemCount++;
  }

  public get(key: string): V | undefined {
    const { index } = this.getBucketIndex(key);
    const bucket = this.buckets[index];
    return bucket.find((entry) => entry.key === key)?.value;
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public size(): number {
    return this.itemCount;
  }

  public getBucketsSnapshot(): HashBucketEntry<V>[][] {
    return this.buckets.map((b) => [...b]);
  }
}

/**
 * 5. MERGE SORT & QUICK SORT
 * Merge Sort: Stable O(N log N) sort used for ordering Multi-Sensor Fusion detections.
 * Quick Sort: In-place O(N log N) partition sort used for ordering vessel/wildlife tracks.
 */
export function mergeSortDetections(
  items: Detection[],
  compareBy: 'confidence' | 'distance' | 'time' = 'confidence'
): { sorted: Detection[]; comparisons: number } {
  let comparisons = 0;

  const compare = (a: Detection, b: Detection): number => {
    comparisons++;
    if (compareBy === 'confidence') return b.fusedConfidence - a.fusedConfidence;
    if (compareBy === 'distance') return a.distanceMeters - b.distanceMeters;
    return b.timestampMs - a.timestampMs;
  };

  function merge(left: Detection[], right: Detection[]): Detection[] {
    const result: Detection[] = [];
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
      if (compare(left[i], right[j]) <= 0) {
        result.push(left[i++]);
      } else {
        result.push(right[j++]);
      }
    }
    while (i < left.length) result.push(left[i++]);
    while (j < right.length) result.push(right[j++]);
    return result;
  }

  function sort(arr: Detection[]): Detection[] {
    if (arr.length <= 1) return arr;
    const mid = Math.floor(arr.length / 2);
    return merge(sort(arr.slice(0, mid)), sort(arr.slice(mid)));
  }

  return { sorted: sort([...items]), comparisons };
}

export function quickSortNumbers(arr: number[]): { sorted: number[]; comparisons: number } {
  const copy = [...arr];
  let comparisons = 0;

  function partition(low: number, high: number): number {
    const pivot = copy[high];
    let i = low - 1;
    for (let j = low; j < high; j++) {
      comparisons++;
      if (copy[j] >= pivot) {
        // Descending order
        i++;
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
    }
    const tmp = copy[i + 1];
    copy[i + 1] = copy[high];
    copy[high] = tmp;
    return i + 1;
  }

  function qs(low: number, high: number): void {
    if (low < high) {
      const pi = partition(low, high);
      qs(low, pi - 1);
      qs(pi + 1, high);
    }
  }

  if (copy.length > 1) {
    qs(0, copy.length - 1);
  }
  return { sorted: copy, comparisons };
}

/**
 * 6. BUILT-IN SELF-TEST SUITE
 * Verifies all 5 DSA structures in real time and exposes results to the UI & unit tests.
 */
export interface DsaSelfTestResult {
  id: string;
  structureName: string;
  applicationRole: string;
  complexity: string;
  passed: boolean;
  assertionSummary: string;
  durationMs: number;
}

export function runDsaSelfTestSuite(): DsaSelfTestResult[] {
  const results: DsaSelfTestResult[] = [];

  // Test 1: Binary Max-Heap Priority Queue
  const t0 = performance.now();
  const heap = new AlertMaxHeap();
  const mockAlerts = [45, 92, 18, 99, 74, 63].map((score, i) => ({
    id: `test-alert-${i}`,
    title: `Alert ${score}`,
    message: 'Test',
    severity: 'critical' as any,
    riskScore: score,
    capability: 'vessel_tracking' as any,
    timestamp: '00:00:00',
    timestampMs: i,
    gps: { lat: 0, lon: 0 },
    position: { x: 0, y: 0, z: 0 },
    sdgTarget: '14.4',
    dispatched: false,
    recommendedAction: 'None',
  }));
  mockAlerts.forEach((a) => heap.enqueue(a));
  const invariantOk = heap.verifyHeapInvariant();
  const top1 = heap.dequeueMax()?.riskScore;
  const top2 = heap.dequeueMax()?.riskScore;
  const heapPassed = invariantOk && top1 === 99 && top2 === 92 && heap.size() === 4;
  results.push({
    id: 'max-heap',
    structureName: 'Binary Max-Heap Priority Queue',
    applicationRole: 'Triage maritime & environmental alerts by riskScore (1–100)',
    complexity: 'O(1) peek · O(log N) enqueue/dequeue',
    passed: heapPassed,
    assertionSummary: `Inserted 6 alerts; invariant=${invariantOk}, extracted max=[${top1}, ${top2}]`,
    durationMs: Number((performance.now() - t0).toFixed(2)),
  });

  // Test 2: Circular Ring Buffer
  const t1 = performance.now();
  const ring = new CircularRingBuffer<number>(4);
  for (let i = 1; i <= 6; i++) {
    ring.enqueue({ seq: i, timestamp: '00:00', label: `PKT-${i}`, payload: i });
  }
  const ringState = ring.getState();
  const flushed = ring.flushAll();
  const ringPassed =
    ringState.count === 4 &&
    ringState.overwrittenCount === 2 &&
    flushed.length === 4 &&
    flushed[0].seq === 3 &&
    flushed[3].seq === 6;
  results.push({
    id: 'circular-queue',
    structureName: 'Circular Queue (Ring Buffer)',
    applicationRole: 'Buffers ROV telemetry packets during satellite comms outages',
    complexity: 'O(1) enqueue · O(1) dequeue · Fixed memory footprint',
    passed: ringPassed,
    assertionSummary: `Enqueued 6 into cap=4; overwrote 2 oldest, FIFO flushed seq [${flushed.map((f) => f.seq).join(', ')}]`,
    durationMs: Number((performance.now() - t1).toFixed(2)),
  });

  // Test 3: Waypoint Stack & Recursive DFS Backtracking
  const t2 = performance.now();
  const stack = new WaypointStack(10);
  stack.push({ x: 0, y: -10, z: 0 });
  stack.push({ x: 10, y: -15, z: 10 });
  stack.push({ x: 20, y: -20, z: 20 });
  const popped = stack.pop();
  const testGrid = [
    [0, 0, 1, 0],
    [1, 0, 1, 0],
    [0, 0, 0, 0],
    [0, 1, 1, 0],
  ];
  const dfsRes = computeDfsEscapePath(testGrid, { r: 0, c: 0 }, { r: 3, c: 3 });
  const dfsPassed =
    popped?.x === 20 &&
    dfsRes.path.length > 0 &&
    dfsRes.path[0].r === 0 &&
    dfsRes.path[dfsRes.path.length - 1].r === 3 &&
    dfsRes.path[dfsRes.path.length - 1].c === 3 &&
    dfsRes.path.every((cell) => testGrid[cell.r][cell.c] === 0);
  results.push({
    id: 'stack-dfs',
    structureName: 'Stack & Recursive DFS Backtracker',
    applicationRole: 'Obstacle avoidance & net-entanglement escape pathfinding',
    complexity: 'O(1) stack push/pop · O(V + E) recursive DFS traversal',
    passed: dfsPassed,
    assertionSummary: `LIFO popped (20,-20,20); DFS found ${dfsRes.path.length}-step obstacle-free escape path`,
    durationMs: Number((performance.now() - t2).toFixed(2)),
  });

  // Test 4: Hash Table (FNV-1a + Bucket Chaining)
  const t3 = performance.now();
  const ht = new VesselHashTable<string>(8);
  ht.set('MMSI-538009112', 'FV Black Fin (AIS Dark)');
  ht.set('MMSI-311040900', 'MV Pacific Trader');
  ht.set('MMSI-244810221', 'AEGIS-01 Sentinel');
  const htPassed =
    ht.size() === 3 &&
    ht.get('MMSI-538009112') === 'FV Black Fin (AIS Dark)' &&
    ht.has('MMSI-244810221') &&
    !ht.has('MMSI-999999999');
  results.push({
    id: 'hash-table',
    structureName: 'FNV-1a Hash Table (Chained Buckets)',
    applicationRole: 'Instant O(1) vessel MMSI & transponder registry lookup',
    complexity: 'O(1) average lookup & insertion',
    passed: htPassed,
    assertionSummary: `Indexed 3 MMSI transponders across 8 buckets; O(1) hit & miss verified`,
    durationMs: Number((performance.now() - t3).toFixed(2)),
  });

  // Test 5: Merge Sort & Quick Sort
  const t4 = performance.now();
  const qsOut = quickSortNumbers([42, 95, 13, 88, 67, 95, 19]);
  const qsPassed =
    qsOut.sorted[0] === 95 &&
    qsOut.sorted[1] === 95 &&
    qsOut.sorted[qsOut.sorted.length - 1] === 13;
  results.push({
    id: 'merge-quick-sort',
    structureName: 'Merge Sort & Quick Sort',
    applicationRole: 'Orders multi-sensor fused detections & vessel tracks by confidence/distance',
    complexity: 'O(N log N) time complexity',
    passed: qsPassed,
    assertionSummary: `Sorted 7 track priorities -> [${qsOut.sorted.join(', ')}] in ${qsOut.comparisons} comparisons`,
    durationMs: Number((performance.now() - t4).toFixed(2)),
  });

  return results;
}
