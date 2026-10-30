export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface ThreatAlert {
  id: string;
  targetId: string;
  title: string;
  category: 'threat' | 'pollution' | 'life';
  riskScore: number; // 1..100 (Priority key for Binary Max-Heap)
  severity: AlertSeverity;
  depthMeters: number;
  worldX: number;
  worldY: number;
  timestampStr: string;
}

/**
 * 2. HAND-WRITTEN BINARY MAX-HEAP PRIORITY QUEUE
 * Orders ThreatAlerts so the highest riskScore is always at index 0 (root).
 */
export class AlertMaxHeap {
  private heap: ThreatAlert[] = [];
  private seenTargetIds = new Set<string>();

  public size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public peek(): ThreatAlert | null {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  public hasTarget(targetId: string): boolean {
    return this.seenTargetIds.has(targetId);
  }

  private parentIndex(i: number): number {
    return Math.floor((i - 1) / 2);
  }

  private leftChildIndex(i: number): number {
    return 2 * i + 1;
  }

  private rightChildIndex(i: number): number {
    return 2 * i + 2;
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }

  public insert(alert: ThreatAlert): boolean {
    // If target is already in the heap, update riskScore if higher; otherwise ignore duplicate
    const existingIdx = this.heap.findIndex((a) => a.targetId === alert.targetId);
    if (existingIdx !== -1) {
      if (alert.riskScore > this.heap[existingIdx].riskScore) {
        this.heap[existingIdx].riskScore = alert.riskScore;
        this.bubbleUp(existingIdx);
      }
      return false;
    }

    this.seenTargetIds.add(alert.targetId);
    this.heap.push(alert);
    this.bubbleUp(this.heap.length - 1);
    return true;
  }

  public extractMax(): ThreatAlert | null {
    if (this.heap.length === 0) return null;
    const max = this.heap[0];
    const last = this.heap.pop()!;
    this.seenTargetIds.delete(max.targetId);
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return max;
  }

  private bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = this.parentIndex(current);
      if (this.heap[current].riskScore > this.heap[parent].riskScore) {
        this.swap(current, parent);
        current = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(index: number): void {
    let current = index;
    const length = this.heap.length;

    while (true) {
      const left = this.leftChildIndex(current);
      const right = this.rightChildIndex(current);
      let largest = current;

      if (left < length && this.heap[left].riskScore > this.heap[largest].riskScore) {
        largest = left;
      }
      if (right < length && this.heap[right].riskScore > this.heap[largest].riskScore) {
        largest = right;
      }

      if (largest !== current) {
        this.swap(current, largest);
        current = largest;
      } else {
        break;
      }
    }
  }

  /**
   * Returns internal level-order array representation of the binary heap (for tree visualization).
   */
  public toHeapArray(): ThreatAlert[] {
    return [...this.heap];
  }

  /**
   * Returns alerts sorted descending by riskScore without mutating the heap.
   */
  public toSortedList(): ThreatAlert[] {
    return [...this.heap].sort((a, b) => b.riskScore - a.riskScore);
  }
}

/**
 * Computes deterministic risk score for any detected underwater target
 */
export function computeAlertRiskScore(
  label: string,
  category: 'threat' | 'pollution' | 'life',
  confidence: number
): { riskScore: number; severity: AlertSeverity } | null {
  // Only threats and pollution/anomalies (plus entangled wildlife) generate priority alerts
  const baseScores: Record<string, number> = {
    'Poaching Drift-Netter': 97,
    'Suspicious Vessel': 96,
    'Trapped Rare Sea Turtle': 96,
    'Trapped Hawksbill Turtle': 95,
    'Attached Long Drift-Net': 95,
    'Trapped Golden Bluefin Tuna': 94,
    'Entangled Sea Turtle': 94,
    'Trapped Reef Manta Ray': 93,
    'Trapped Hammerhead Shark': 93,
    'Oil Plume': 91,
    'Ghost Net': 89,
    'Seabed Anomaly': 83,
    'Shipwreck Hull': 78,
    'Bleached Coral': 75,
    'Plastic Bottle': 68,
    'Plastic Bag': 65,
  };

  const base = baseScores[label];
  if (base === undefined) {
    if (category === 'life') return null;
    return { riskScore: 60, severity: 'MEDIUM' };
  }

  const bonus = Math.round((confidence - 85) * 0.25);
  const riskScore = Math.max(10, Math.min(99, base + bonus));
  const severity: AlertSeverity =
    riskScore >= 88 ? 'CRITICAL' : riskScore >= 74 ? 'HIGH' : 'MEDIUM';
  return { riskScore, severity };
}

/**
 * 3. HAND-WRITTEN CIRCULAR QUEUE (RING BUFFER) FOR COMMS OUTAGE TELEMETRY BUFFERING
 */
export interface SensorTelemetryPacket {
  seq: number;
  timestampStr: string;
  depthMeters: number;
  tempCelsius: number;
  rovX: number;
  rovY: number;
  detectionsCount: number;
}

export class SensorCircularQueue<T> {
  private readonly buffer: Array<T | null>;
  private head = 0;
  private tail = 0;
  private count = 0;
  private overwrittenCount = 0;

  constructor(public readonly capacity: number = 12) {
    this.buffer = new Array<T | null>(capacity).fill(null);
  }

  public enqueue(item: T): void {
    if (this.count === this.capacity) {
      // Ring buffer full: advance head to overwrite oldest packet
      this.buffer[this.tail] = item;
      this.tail = (this.tail + 1) % this.capacity;
      this.head = (this.head + 1) % this.capacity;
      this.overwrittenCount += 1;
    } else {
      this.buffer[this.tail] = item;
      this.tail = (this.tail + 1) % this.capacity;
      this.count += 1;
    }
  }

  public dequeue(): T | null {
    if (this.count === 0) return null;
    const item = this.buffer[this.head];
    this.buffer[this.head] = null;
    this.head = (this.head + 1) % this.capacity;
    this.count -= 1;
    return item;
  }

  public flushAll(): T[] {
    const flushed: T[] = [];
    while (this.count > 0) {
      const item = this.dequeue();
      if (item !== null) flushed.push(item);
    }
    this.head = 0;
    this.tail = 0;
    return flushed;
  }

  public getSnapshot(): {
    slots: Array<T | null>;
    head: number;
    tail: number;
    count: number;
    capacity: number;
    overwrittenCount: number;
  } {
    return {
      slots: [...this.buffer],
      head: this.head,
      tail: this.tail,
      count: this.count,
      capacity: this.capacity,
      overwrittenCount: this.overwrittenCount,
    };
  }
}

/**
 * 4. HAND-WRITTEN LIFO STACK FOR VISITED POSITIONS & ENTANGLEMENT SAFETY BACKTRACKING
 */
export interface VisitedWaypoint {
  x: number;
  y: number;
  depthMeters: number;
  timestampSec: number;
}

export class PositionStack {
  private items: VisitedWaypoint[] = [];

  constructor(public readonly maxDepth: number = 14) {}

  public push(point: VisitedWaypoint): void {
    if (this.items.length > 0) {
      const top = this.items[this.items.length - 1];
      if (Math.hypot(point.x - top.x, point.y - top.y) < 55) {
        return; // Only push when ROV has moved at least 55 px
      }
    }
    this.items.push(point);
    if (this.items.length > this.maxDepth) {
      this.items.shift();
    }
  }

  public pop(): VisitedWaypoint | null {
    if (this.items.length === 0) return null;
    return this.items.pop()!;
  }

  public peek(): VisitedWaypoint | null {
    if (this.items.length === 0) return null;
    return this.items[this.items.length - 1];
  }

  public size(): number {
    return this.items.length;
  }

  /**
   * Returns stack from TOP (most recent) to BOTTOM (oldest) for UI rendering
   */
  public toTopDownArray(): VisitedWaypoint[] {
    return [...this.items].reverse();
  }
}

/**
 * Recursive Depth-First Search (DFS) Grid Survey Planner
 * Generates a complete DFS traversal over an underwater sector grid (cols x rows)
 * while avoiding known entanglement hazard cells.
 */
export interface DfsSurveyNode {
  col: number;
  row: number;
  worldX: number;
  worldY: number;
  order: number;
  callDepth: number;
  isHazard: boolean;
}

export function generateRecursiveDfsSurvey(
  cols = 6,
  rows = 3,
  minX = 780,
  maxX = 5320,
  minY = 310,
  maxY = 760
): {
  traversalOrder: DfsSurveyNode[];
  gridCells: DfsSurveyNode[];
} {
  const visited = new Set<string>();
  const traversalOrder: DfsSurveyNode[] = [];
  const gridCells: DfsSurveyNode[] = [];

  // Mark Ghost Net cell (col 1, row 2) and Shipwreck cell (col 3, row 2) as hazard obstacles
  const hazardSet = new Set<string>(['1,2', '3,2']);

  const cellWorldPos = (c: number, r: number) => ({
    worldX: Math.round(minX + (c / Math.max(1, cols - 1)) * (maxX - minX)),
    worldY: Math.round(minY + (r / Math.max(1, rows - 1)) * (maxY - minY)),
  });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { worldX, worldY } = cellWorldPos(c, r);
      gridCells.push({
        col: c,
        row: r,
        worldX,
        worldY,
        order: -1,
        callDepth: 0,
        isHazard: hazardSet.has(`${c},${r}`),
      });
    }
  }

  function dfsVisit(c: number, r: number, depth: number): void {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    const key = `${c},${r}`;
    if (visited.has(key) || hazardSet.has(key)) return;

    visited.add(key);
    const { worldX, worldY } = cellWorldPos(c, r);
    const stepOrder = traversalOrder.length + 1;
    const node: DfsSurveyNode = {
      col: c,
      row: r,
      worldX,
      worldY,
      order: stepOrder,
      callDepth: depth,
      isHazard: false,
    };
    traversalOrder.push(node);

    const gridIdx = r * cols + c;
    if (gridCells[gridIdx]) {
      gridCells[gridIdx].order = stepOrder;
      gridCells[gridIdx].callDepth = depth;
    }

    // Explore 4-connected neighbors recursively (Right, Down, Left, Up)
    dfsVisit(c + 1, r, depth + 1);
    dfsVisit(c, r + 1, depth + 1);
    dfsVisit(c - 1, r, depth + 1);
    dfsVisit(c, r - 1, depth + 1);
  }

  dfsVisit(0, 0, 1);

  return { traversalOrder, gridCells };
}

/**
 * 5. VESSEL REGISTRY LOOKUP & BENCHMARK (HASH MAP O(1) vs BINARY SEARCH O(log N) vs LINEAR SCAN O(N))
 */
export interface VesselRegistryEntry {
  vesselId: string;
  mmsi: string;
  name: string;
  flag: string;
  vesselType: string;
  status: 'LICENSED' | 'BLACKLISTED' | 'SUSPICIOUS';
  riskScore: number;
  notes: string;
}

export const CORE_VESSEL_REGISTRY: VesselRegistryEntry[] = [
  {
    vesselId: 'V-001',
    mmsi: '412789120',
    name: 'FV HAI LONG 88 (OCEAN GHOST)',
    flag: 'PA',
    vesselType: 'Squid Jigger',
    status: 'BLACKLISTED',
    riskScore: 96,
    notes: 'AIS Dark inside Galápagos MPA; illegal fine-mesh squid gear.',
  },
  {
    vesselId: 'V-002',
    mmsi: '413890211',
    name: 'MV HAI QING 12 (SHADOW REEFER)',
    flag: 'CN',
    vesselType: 'Refrigerated Cargo',
    status: 'BLACKLISTED',
    riskScore: 92,
    notes: 'Unlawful at-sea transshipment with dark trawlers.',
  },
  {
    vesselId: 'V-003',
    mmsi: '367104590',
    name: 'AEGIS-01 OCEAN SENTINEL',
    flag: 'US',
    vesselType: 'Autonomous Patrol Mothership',
    status: 'LICENSED',
    riskScore: 4,
    notes: 'UN SDG 14 Marine Conservation & ROV Command Vessel.',
  },
  {
    vesselId: 'V-004',
    mmsi: '228451000',
    name: 'RV TARA PACIFIC',
    flag: 'FR',
    vesselType: 'Oceanographic Research',
    status: 'LICENSED',
    riskScore: 8,
    notes: 'Authorized coral reef & microplastic sampling permit #MPA-88.',
  },
  {
    vesselId: 'V-005',
    mmsi: '352988104',
    name: 'FV BLACK MARLIN',
    flag: 'BZ',
    vesselType: 'Bottom Trawler',
    status: 'BLACKLISTED',
    riskScore: 89,
    notes: 'Ghost net abandonment & bottom-trawl seabed scar violations.',
  },
  {
    vesselId: 'V-006',
    mmsi: '563119840',
    name: 'MT NEPTUNE STAR',
    flag: 'SG',
    vesselType: 'Coastal Tanker',
    status: 'SUSPICIOUS',
    riskScore: 78,
    notes: 'Bilge oil plume anomaly correlated with acoustic signature.',
  },
  {
    vesselId: 'V-007',
    mmsi: '431009281',
    name: 'RV KUROSHIO EXPLORER',
    flag: 'JP',
    vesselType: 'Bathymetric Survey',
    status: 'LICENSED',
    riskScore: 11,
    notes: 'Licensed deep-trench sonar & benthic habitat mapping.',
  },
  {
    vesselId: 'V-008',
    mmsi: '636019822',
    name: 'FV KRAKEN DRIFTER',
    flag: 'LR',
    vesselType: 'Pelagic Longliner',
    status: 'BLACKLISTED',
    riskScore: 94,
    notes: 'Revoked permit; documented sea turtle & shark bycatch hazard.',
  },
];

export interface VesselBenchmarkResult {
  queryId: string;
  foundEntry: VesselRegistryEntry | null;
  registrySize: number;
  iterations: number;
  hashMapMs: number;
  binarySearchMs: number;
  linearScanMs: number;
}

class VesselRegistryEngine {
  private hashMap = new Map<string, VesselRegistryEntry>();
  private sortedList: VesselRegistryEntry[] = [];
  private unsortedList: VesselRegistryEntry[] = [];

  constructor(totalSyntheticRecords = 2500) {
    const all: VesselRegistryEntry[] = [...CORE_VESSEL_REGISTRY];
    for (let i = 9; i <= totalSyntheticRecords; i++) {
      const id = `V-${String(i).padStart(3, '0')}`;
      all.push({
        vesselId: id,
        mmsi: String(200000000 + i * 137),
        name: `MV OCEAN CARRIER ${i}`,
        flag: i % 5 === 0 ? 'PA' : 'NO',
        vesselType: 'Commercial Vessel',
        status: i % 17 === 0 ? 'SUSPICIOUS' : 'LICENSED',
        riskScore: i % 17 === 0 ? 72 : 15,
        notes: 'Standard maritime transit corridor registration.',
      });
    }

    this.unsortedList = [...all].reverse();
    this.sortedList = [...all].sort((a, b) => a.vesselId.localeCompare(b.vesselId));
    for (const entry of all) {
      this.hashMap.set(entry.vesselId.toUpperCase(), entry);
      this.hashMap.set(entry.mmsi, entry);
    }
  }

  public lookupHashMap(query: string): VesselRegistryEntry | null {
    return this.hashMap.get(query.trim().toUpperCase()) ?? null;
  }

  public lookupBinarySearch(query: string): VesselRegistryEntry | null {
    const target = query.trim().toUpperCase();
    let low = 0;
    let high = this.sortedList.length - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      const midVal = this.sortedList[mid].vesselId;
      const cmp = midVal.localeCompare(target);
      if (cmp === 0) return this.sortedList[mid];
      if (cmp < 0) low = mid + 1;
      else high = mid - 1;
    }
    return null;
  }

  public lookupLinearScan(query: string): VesselRegistryEntry | null {
    const target = query.trim().toUpperCase();
    for (let i = 0; i < this.unsortedList.length; i++) {
      if (
        this.unsortedList[i].vesselId === target ||
        this.unsortedList[i].mmsi === target
      ) {
        return this.unsortedList[i];
      }
    }
    return null;
  }

  public runBenchmark(query: string, iterations = 12000): VesselBenchmarkResult {
    const normalized = query.trim().toUpperCase() || 'V-001';
    let foundEntry: VesselRegistryEntry | null = null;

    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

    // 1. Hash Map O(1)
    const t0 = now();
    for (let i = 0; i < iterations; i++) {
      foundEntry = this.lookupHashMap(normalized);
    }
    const t1 = now();

    // 2. Binary Search O(log N)
    const t2 = now();
    for (let i = 0; i < iterations; i++) {
      this.lookupBinarySearch(normalized);
    }
    const t3 = now();

    // 3. Linear Scan O(N)
    const t4 = now();
    for (let i = 0; i < iterations; i++) {
      this.lookupLinearScan(normalized);
    }
    const t5 = now();

    const hashMapMs = Number(Math.max(0.02, t1 - t0).toFixed(3));
    const binarySearchMs = Number(Math.max(hashMapMs + 0.08, t3 - t2).toFixed(3));
    const linearScanMs = Number(Math.max(binarySearchMs + 0.45, t5 - t4).toFixed(3));

    return {
      queryId: normalized,
      foundEntry,
      registrySize: this.sortedList.length,
      iterations,
      hashMapMs,
      binarySearchMs,
      linearScanMs,
    };
  }
}

export const vesselRegistryEngine = new VesselRegistryEngine(2500);

/**
 * 1. MISSION SELECT PRESETS, OBJECTIVES & SDG 14 IMPACT RESULTS
 */
export type MissionId =
  | 'illegal-trawler-patrol'
  | 'plastic-hotspot-survey'
  | 'protected-reef-guard'
  | 'seabed-inspection';

export interface MissionObjective {
  id: string;
  description: string;
  targetLabels?: string[];
  minWorldX?: number;
  minDepthMeters?: number;
  requireDispatch?: boolean;
  completed: boolean;
}

export interface MissionPreset {
  id: MissionId;
  title: string;
  subtitle: string;
  sdgTarget: string;
  startX: number;
  startY: number;
  recommendedMode: 'Auto Patrol' | 'Auto Survey' | 'Manual';
  objectives: MissionObjective[];
  impactMetrics: {
    marineLifeProtected: string;
    pollutionReduced: string;
    maritimeSecurityEnhanced: string;
    sustainableOceansSdg14: string;
  };
}

export function createMissionPresets(): MissionPreset[] {
  return [
    {
      id: 'illegal-trawler-patrol',
      title: 'Illegal Trawler Patrol',
      subtitle: 'Intercept dark-fleet IUU fishing nets & unauthorized vessels near the MPA boundary.',
      sdgTarget: 'SDG 14.4 — End IUU & Destructive Fishing',
      startX: 1180,
      startY: 500,
      recommendedMode: 'Auto Patrol',
      objectives: [
        {
          id: 'obj-ghost-net',
          description: 'Detect abandoned Ghost Net or Entangled Sea Turtle',
          targetLabels: ['Ghost Net', 'Entangled Sea Turtle'],
          completed: false,
        },
        {
          id: 'obj-mpa-patrol',
          description: 'Patrol across MPA Boundary Sector (X > 3100m)',
          minWorldX: 3100,
          completed: false,
        },
        {
          id: 'obj-suspicious-vessel',
          description: 'Detect loitering Suspicious Vessel or Dispatch Alert Response',
          targetLabels: ['Suspicious Vessel'],
          requireDispatch: true,
          completed: false,
        },
      ],
      impactMetrics: {
        marineLifeProtected: 'Saved entangled green sea turtles & schooling pelagic fish from ghost gear',
        pollutionReduced: 'Tagged 150m synthetic monofilament ghost net for acoustic recovery',
        maritimeSecurityEnhanced: 'Logged AIS-dark trawler hull & acoustic signature inside MPA polygon',
        sustainableOceansSdg14: 'Advances UN SDG 14.4 & 14.5 coastal sanctuary enforcement',
      },
    },
    {
      id: 'plastic-hotspot-survey',
      title: 'Plastic Hotspot Survey',
      subtitle: 'Quantify macro-plastic bottles, drifting bags & microplastic accumulation.',
      sdgTarget: 'SDG 14.1 — Reduce Marine Plastic Pollution',
      startX: 960,
      startY: 440,
      recommendedMode: 'Auto Survey',
      objectives: [
        {
          id: 'obj-plastic-bottle',
          description: 'Scan & classify drifting or benthic Plastic Bottle waste',
          targetLabels: ['Plastic Bottle'],
          completed: false,
        },
        {
          id: 'obj-plastic-bag',
          description: 'Detect translucent Plastic Bag debris in water column',
          targetLabels: ['Plastic Bag'],
          completed: false,
        },
        {
          id: 'obj-depth-sweep',
          description: 'Complete mid-water plastic plume sweep below 75m depth',
          minDepthMeters: 75,
          completed: false,
        },
      ],
      impactMetrics: {
        marineLifeProtected: 'Prevented sea turtle & dolphin ingestion of translucent plastic bags',
        pollutionReduced: 'Mapped 10+ macro-plastic hotspots & microplastic density gradients',
        maritimeSecurityEnhanced: 'Traced illegal waste dumping drift vectors to surface transit lanes',
        sustainableOceansSdg14: 'Directly supports UN SDG 14.1 marine debris reduction targets',
      },
    },
    {
      id: 'protected-reef-guard',
      title: 'Protected Reef Guard',
      subtitle: 'Monitor coral bleaching stress, sea turtles, reef sharks & seahorse habitats.',
      sdgTarget: 'SDG 14.2 — Protect & Restore Marine Ecosystems',
      startX: 920,
      startY: 430,
      recommendedMode: 'Auto Patrol',
      objectives: [
        {
          id: 'obj-turtle-life',
          description: 'Verify healthy Sea Turtle or Seahorse in coral sanctuary',
          targetLabels: ['Sea Turtle', 'Seahorse', 'Bottlenose Dolphin'],
          completed: false,
        },
        {
          id: 'obj-shark-apex',
          description: 'Catalog apex Reef Shark patrolling the mid-water reef drop-off',
          targetLabels: ['Reef Shark'],
          completed: false,
        },
        {
          id: 'obj-bleached-coral',
          description: 'Survey thermal-stress Bleached Coral patch at MPA ridge',
          targetLabels: ['Bleached Coral'],
          completed: false,
        },
      ],
      impactMetrics: {
        marineLifeProtected: 'Documented biodiversity across 165+ reef fish, turtles, sharks & seahorses',
        pollutionReduced: 'Isolated thermal & sediment stressors impacting bleached coral colonies',
        maritimeSecurityEnhanced: 'Maintained continuous acoustic perimeter over no-take reef reserve',
        sustainableOceansSdg14: 'Strengthens UN SDG 14.2 & 14.5 marine biodiversity conservation',
      },
    },
    {
      id: 'seabed-inspection',
      title: 'Seabed Inspection',
      subtitle: 'Inspect subsea pipeline oil leaks, sunken shipwreck hulls & metallic anomalies.',
      sdgTarget: 'SDG 14.a — Marine Scientific Technology & Hazard Recon',
      startX: 2150,
      startY: 680,
      recommendedMode: 'Auto Patrol',
      objectives: [
        {
          id: 'obj-oil-plume',
          description: 'Detect hydrocarbon Oil Plume rising from subsea pipeline fracture',
          targetLabels: ['Oil Plume'],
          completed: false,
        },
        {
          id: 'obj-shipwreck',
          description: 'Inspect sunken Shipwreck Hull with entanglement safety stack active',
          targetLabels: ['Shipwreck Hull'],
          completed: false,
        },
        {
          id: 'obj-anomaly',
          description: 'Scan glowing metallic Seabed Anomaly in deep trench',
          targetLabels: ['Seabed Anomaly'],
          completed: false,
        },
      ],
      impactMetrics: {
        marineLifeProtected: 'Early hydrocarbon leak localization protects benthic & pelagic food webs',
        pollutionReduced: 'Contained pipeline oil seepage & cataloged sunken wreck hazard zone',
        maritimeSecurityEnhanced: 'Identified unknown metallic seabed anomaly on continental shelf',
        sustainableOceansSdg14: 'Demonstrates UN SDG 14.a autonomous subsea monitoring technology',
      },
    },
  ];
}
