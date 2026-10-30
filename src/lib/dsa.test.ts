import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AlertMaxHeap,
  CircularRingBuffer,
  WaypointStack,
  VesselHashTable,
  computeDfsEscapePath,
  mergeSortDetections,
  quickSortNumbers,
  runDsaSelfTestSuite,
} from './dsa';
import { createInitialAlerts } from '../data/worldSeed';

test('AlertMaxHeap maintains max-heap invariant and extracts highest riskScore first', () => {
  const alerts = createInitialAlerts();
  const heap = new AlertMaxHeap(alerts);

  assert.equal(heap.verifyHeapInvariant(), true);
  assert.equal(heap.size(), alerts.length);

  const first = heap.dequeueMax();
  const second = heap.dequeueMax();
  assert.ok(first && second);
  assert.ok(first.riskScore >= second.riskScore);
  assert.equal(first.riskScore, 98);
  assert.equal(heap.verifyHeapInvariant(), true);
});

test('CircularRingBuffer buffers telemetry packets and overwrites oldest when full', () => {
  const ring = new CircularRingBuffer<string>(3);
  ring.enqueue({ seq: 1, timestamp: 't1', label: 'P1', payload: 'data1' });
  ring.enqueue({ seq: 2, timestamp: 't2', label: 'P2', payload: 'data2' });
  ring.enqueue({ seq: 3, timestamp: 't3', label: 'P3', payload: 'data3' });
  ring.enqueue({ seq: 4, timestamp: 't4', label: 'P4', payload: 'data4' });

  const state = ring.getState();
  assert.equal(state.count, 3);
  assert.equal(state.overwrittenCount, 1);

  const flushed = ring.flushAll();
  assert.equal(flushed.length, 3);
  assert.deepEqual(
    flushed.map((f) => f.seq),
    [2, 3, 4]
  );
  assert.equal(ring.getState().count, 0);
});

test('WaypointStack and Recursive DFS compute valid obstacle-free escape route', () => {
  const stack = new WaypointStack(8);
  stack.push({ x: 0, y: -10, z: 0 });
  stack.push({ x: 1, y: -10, z: 1 }); // Too close (<3m), should be ignored
  stack.push({ x: 6, y: -12, z: 6 });
  assert.equal(stack.size(), 2);

  const grid = [
    [0, 1, 0, 0],
    [0, 1, 0, 1],
    [0, 0, 0, 0],
    [1, 1, 0, 0],
  ];
  const { path } = computeDfsEscapePath(grid, { r: 0, c: 0 }, { r: 3, c: 3 });
  assert.ok(path.length > 0);
  assert.deepEqual(path[0], { r: 0, c: 0 });
  assert.deepEqual(path[path.length - 1], { r: 3, c: 3 });
  for (const cell of path) {
    assert.equal(grid[cell.r][cell.c], 0);
  }
});

test('VesselHashTable indexes and retrieves vessels in O(1) using FNV-1a hash', () => {
  const table = new VesselHashTable<string>(8);
  table.set('538009112', 'FV Black Fin');
  table.set('244810221', 'AEGIS-01 Sentinel');

  assert.equal(table.size(), 2);
  assert.equal(table.get('538009112'), 'FV Black Fin');
  assert.equal(table.has('244810221'), true);
  assert.equal(table.has('000000000'), false);
});

test('mergeSortDetections and quickSortNumbers sort accurately', () => {
  const qs = quickSortNumbers([10, 99, 45, 72, 12]);
  assert.deepEqual(qs.sorted, [99, 72, 45, 12, 10]);

  const suite = runDsaSelfTestSuite();
  assert.equal(suite.length, 5);
  for (const check of suite) {
    assert.equal(check.passed, true, `Failed self-test: ${check.structureName}`);
  }
});
