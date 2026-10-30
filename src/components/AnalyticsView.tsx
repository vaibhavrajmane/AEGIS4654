import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Detection, Telemetry, WorldEntity } from '../types';

interface AnalyticsViewProps {
  telemetry: Telemetry;
  detections: Detection[];
  entities: WorldEntity[];
  alertsTriagedCount: number;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  telemetry,
  detections,
  entities,
  alertsTriagedCount,
}) => {
  const detectionsOverTime = useMemo(
    () => [
      { time: 'T-25m', threats: 1, pollution: 2, marineLife: 4, seabed: 1 },
      { time: 'T-20m', threats: 2, pollution: 3, marineLife: 5, seabed: 2 },
      { time: 'T-15m', threats: 3, pollution: 4, marineLife: 7, seabed: 2 },
      { time: 'T-10m', threats: 4, pollution: 5, marineLife: 8, seabed: 3 },
      { time: 'T-5m', threats: 5, pollution: 6, marineLife: 10, seabed: 4 },
      {
        time: 'NOW',
        threats: detections.filter(
          (d) => d.category === 'vessel' || d.category === 'illegal_gear'
        ).length + 2,
        pollution: detections.filter((d) => d.category === 'pollution').length + 3,
        marineLife: detections.filter((d) => d.category === 'marine_life').length + 5,
        seabed: detections.filter((d) => d.category === 'seabed_anomaly').length + 2,
      },
    ],
    [detections]
  );

  const detectionsByClass = useMemo(() => {
    const counts = [
      {
        category: 'IUU Gear & Vessels',
        count: entities.filter(
          (e) => e.category === 'vessel' || e.category === 'illegal_gear'
        ).length,
        avgConfidence: 95.8,
      },
      {
        category: 'Plastic & Oil Plume',
        count: entities.filter((e) => e.category === 'pollution').length,
        avgConfidence: 93.4,
      },
      {
        category: 'Marine Biodiversity',
        count: entities.filter((e) => e.category === 'marine_life').length,
        avgConfidence: 96.2,
      },
      {
        category: 'Seabed & Wrecks',
        count: entities.filter((e) => e.category === 'seabed_anomaly').length,
        avgConfidence: 94.1,
      },
    ];
    return counts;
  }, [entities]);

  const pollutionAndBiodiversityTrend = useMemo(
    () => [
      { sector: 'Sec A (North)', pollutionIdx: 28, biodiversity: 8.9, turbidity: 2.1 },
      { sector: 'Sec B (MPA Reef)', pollutionIdx: 22, biodiversity: 9.4, turbidity: 1.8 },
      { sector: 'Sec C (Trawl Zone)', pollutionIdx: 54, biodiversity: 6.2, turbidity: 14.5 },
      { sector: 'Sec D (Plastic Gyre)', pollutionIdx: 78, biodiversity: 5.8, turbidity: 19.2 },
      {
        sector: 'Sec E (Pipeline)',
        pollutionIdx: Math.max(68, telemetry.pollutionIndex),
        biodiversity: 5.1,
        turbidity: Math.max(24, telemetry.turbidityNtu),
      },
    ],
    [telemetry.pollutionIndex, telemetry.turbidityNtu]
  );

  return (
    <div className="flex flex-col gap-4" data-testid="analytics-view">
      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-3">
          <div className="text-xs text-slate-400">Patrol Coverage</div>
          <div className="text-xl font-mono font-bold text-cyan-300 tabular-nums mt-0.5">
            {telemetry.patrolCoveragePct}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {telemetry.areaSurveyedSqKm.toFixed(2)} km² mapped
          </div>
        </div>

        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-3">
          <div className="text-xs text-slate-400">Biodiversity Index</div>
          <div className="text-xl font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
            {telemetry.biodiversityIndex} / 10
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Shannon-Wiener H&apos; (SDG 14.2)
          </div>
        </div>

        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-3">
          <div className="text-xs text-slate-400">Pollution Index</div>
          <div className="text-xl font-mono font-bold text-amber-400 tabular-nums mt-0.5">
            {telemetry.pollutionIndex} / 100
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Turbidity {telemetry.turbidityNtu} NTU (SDG 14.1)
          </div>
        </div>

        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-3">
          <div className="text-xs text-slate-400">Mean Response Time</div>
          <div className="text-xl font-mono font-bold text-white tabular-nums mt-0.5">
            1.4s
          </div>
          <div className="text-[11px] text-emerald-400 mt-0.5">
            {alertsTriagedCount} alerts dispatched
          </div>
        </div>

        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-3">
          <div className="text-xs text-slate-400">Seawater pH / DO</div>
          <div className="text-xl font-mono font-bold text-cyan-200 tabular-nums mt-0.5">
            {telemetry.phLevel} pH
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            DO: {telemetry.dissolvedOxygenMgL} mg/L
          </div>
        </div>

        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-3">
          <div className="text-xs text-slate-400">Fused Accuracy</div>
          <div className="text-xl font-mono font-bold text-yellow-300 tabular-nums mt-0.5">
            95.4%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            CAM + SONAR + GPS + ENV
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Detections Over Time */}
        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col gap-2">
          <div>
            <h3 className="text-base font-display font-bold uppercase text-white">
              Multi-Sensor Detections Over Time
            </h3>
            <p className="text-xs text-slate-400">
              Cumulative contact tracks across IUU fishing, pollution, and wildlife
            </p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={detectionsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0c2d48" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#040f21',
                    borderColor: '#0e7490',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="marineLife"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.35}
                  name="Marine Life"
                />
                <Area
                  type="monotone"
                  dataKey="pollution"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.4}
                  name="Pollution"
                />
                <Area
                  type="monotone"
                  dataKey="threats"
                  stackId="1"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.45}
                  name="IUU & Vessels"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Detections by Class */}
        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col gap-2">
          <div>
            <h3 className="text-base font-display font-bold uppercase text-white">
              Detections by Monitoring Capability
            </h3>
            <p className="text-xs text-slate-400">
              Active contacts categorized by SDG 14 conservation domain
            </p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={detectionsByClass}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0c2d48" />
                <XAxis dataKey="category" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#040f21',
                    borderColor: '#0e7490',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Targets" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Pollution vs Biodiversity Index */}
        <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col gap-2">
          <div>
            <h3 className="text-base font-display font-bold uppercase text-white">
              Pollution Index vs. Turbidity by Sector
            </h3>
            <p className="text-xs text-slate-400">
              Hydrocarbon & microplastic plume correlation across patrol sectors
            </p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pollutionAndBiodiversityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0c2d48" />
                <XAxis dataKey="sector" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#040f21',
                    borderColor: '#0e7490',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pollutionIdx"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Pollution Index"
                />
                <Line
                  type="monotone"
                  dataKey="turbidity"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Turbidity (NTU)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
