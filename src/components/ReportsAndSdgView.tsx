import React, { useState } from 'react';
import {
  Alert,
  Detection,
  MissionReport,
  ScenarioPreset,
  Telemetry,
  WorldEntity,
} from '../types';
import { SDG_14_TARGETS, SDG_FRAMING_TEXT } from '../data/worldSeed';
import { evaluateScenarioProgress } from '../sim/fusion';

interface ReportsAndSdgViewProps {
  scenario: ScenarioPreset;
  telemetry: Telemetry;
  detections: Detection[];
  entities: WorldEntity[];
  alerts: Alert[];
  alertsTriagedCount: number;
  missionDurationSec: number;
}

export const ReportsAndSdgView: React.FC<ReportsAndSdgViewProps> = ({
  scenario,
  telemetry,
  detections,
  entities,
  alerts,
  alertsTriagedCount,
  missionDurationSec,
}) => {
  const [generatedReport, setGeneratedReport] = useState<MissionReport | null>(null);

  const evalState = evaluateScenarioProgress(
    scenario,
    entities,
    detections,
    telemetry,
    alertsTriagedCount
  );

  const handleGenerateReport = () => {
    const report: MissionReport = {
      reportId: `AEGIS-RPT-${Date.now().toString().slice(-6)}`,
      generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      scenarioName: `${scenario.code}. ${scenario.name}`,
      missionDurationSec,
      summary: `Completed autonomous & operator-guided maritime surveillance under scenario "${scenario.name}". Surveyed ${telemetry.areaSurveyedSqKm.toFixed(2)} km² inside/adjacent to ${
        telemetry.inMpaZone ? 'Palawan MPA Sanctuary' : 'Indo-Pacific Patrol Sector'
      }, logging ${detections.length} multi-sensor fused detections and triaging ${alertsTriagedCount} priority alerts.`,
      telemetrySnapshot: { ...telemetry },
      detections: detections.slice(0, 12),
      alertsTriaged: alertsTriagedCount,
      activeAlertsRemaining: alerts.length,
      sdg14Impact: SDG_14_TARGETS.map((t) => ({
        targetCode: `SDG ${t.code}`,
        title: t.title,
        status: 'ACTIVE MONITORING & EVIDENCE LOGGED',
        evidenceCount: detections.filter((d) => d.sdgTargets.includes(t.code)).length,
      })),
      recommendedActions: [
        'Dispatch rapid disentanglement response to Ghost Gillnet #GN-04 (Green Sea Turtle rescue — SDG 14.2 & 14.4).',
        'Forward GPS-stamped hull & acoustic cavitation dossier on AIS-dark trawler FV Black Fin (MMSI 538009112) to Coast Guard enforcement.',
        'Isolate subsea Pipeline Manifold #PM-01 valve sector B4 and deploy surface containment skimmer to Plastic Hotspot #PL-01 (Cleanup Priority 92/100 — SDG 14.1).',
      ],
      scores: evalState.scores,
    };
    setGeneratedReport(report);
  };

  const handleDownloadJson = () => {
    if (!generatedReport) return;
    const blob = new Blob([JSON.stringify(generatedReport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedReport.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="reports-sdg-view">
      {/* SDG 14 Framing & Problem / Solution Overview Card */}
      <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/60 pb-3">
          <div>
            <div className="text-xs font-mono text-cyan-400 uppercase">
              UNITED NATIONS SUSTAINABLE DEVELOPMENT GOAL 14 — LIFE BELOW WATER
            </div>
            <h2 className="text-xl font-display font-bold uppercase text-white mt-0.5">
              {SDG_FRAMING_TEXT.tagline}
            </h2>
          </div>
          <span className="text-xs font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded">
            {SDG_FRAMING_TEXT.impactBanner}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-[#040f21] border border-red-900/50 rounded p-3">
            <div className="font-semibold text-red-300 uppercase font-mono mb-1">
              Problem Statement
            </div>
            <p className="text-slate-200 leading-relaxed">
              {SDG_FRAMING_TEXT.problemStatement}
            </p>
          </div>
          <div className="bg-[#040f21] border border-cyan-800/50 rounded p-3">
            <div className="font-semibold text-cyan-300 uppercase font-mono mb-1">
              Solution Statement
            </div>
            <p className="text-slate-200 leading-relaxed">
              {SDG_FRAMING_TEXT.solutionStatement}
            </p>
          </div>
        </div>

        {/* 5 SDG 14 Targets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {SDG_14_TARGETS.map((target) => {
            const matchingCount = detections.filter((d) =>
              d.sdgTargets.includes(target.code)
            ).length;
            return (
              <div
                key={target.code}
                className="bg-[#030d1c] border border-cyan-950 rounded p-3 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between font-mono text-xs mb-1">
                    <span className="font-bold text-cyan-300">
                      Target {target.code}
                    </span>
                    <span className="text-emerald-400">{matchingCount} logs</span>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {target.title}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {target.shortDesc}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-amber-300 pt-1.5 border-t border-cyan-950">
                  {target.metricLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mission Report Generator & Export */}
      <div className="bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-display font-bold uppercase text-white">
              Official Mission Evidence & SDG 14 Impact Report
            </h3>
            <p className="text-xs text-slate-400">
              Compiles GPS-tagged multi-sensor detections, scenario scores, and recommended enforcement actions.
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={handleGenerateReport}
              className="px-3.5 py-2 text-xs font-semibold rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
            >
              Generate Mission Report
            </button>
            {generatedReport && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="px-3 py-2 text-xs font-medium rounded bg-[#091e3a] text-cyan-300 border border-cyan-700/60 hover:bg-cyan-900/50 cursor-pointer"
                >
                  Download JSON
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-2 text-xs font-medium rounded bg-[#091e3a] text-slate-200 border border-slate-700 hover:bg-slate-800 cursor-pointer"
                >
                  Print / Save PDF
                </button>
              </>
            )}
          </div>
        </div>

        {!generatedReport ? (
          <div className="bg-[#030d1c] border border-cyan-950 rounded p-6 text-center">
            <p className="text-xs text-slate-300 mb-3">
              Click &ldquo;Generate Mission Report&rdquo; above to compile a timestamped evidence dossier with GPS coordinates, SDG 14 target breakdown, and mission performance scores.
            </p>
            <button
              type="button"
              onClick={handleGenerateReport}
              className="px-4 py-2 text-xs font-semibold rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              Generate Mission Report Now
            </button>
          </div>
        ) : (
          <div
            className="bg-[#030d1c] border border-cyan-900/80 rounded-lg p-4 space-y-4 text-xs"
            data-testid="generated-mission-report"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/60 pb-3">
              <div>
                <div className="font-mono text-cyan-400">
                  REPORT ID: {generatedReport.reportId} · GENERATED:{' '}
                  {generatedReport.generatedAt}
                </div>
                <h4 className="text-lg font-display font-bold text-white mt-0.5">
                  AEGIS OCEAN SENTINEL — MISSION DOSSIER ({generatedReport.scenarioName})
                </h4>
              </div>
              <div className="font-mono text-right">
                <div className="text-sm font-bold text-emerald-400">
                  OVERALL MISSION SCORE: {generatedReport.scores.overallScore} / 100
                </div>
                <div className="text-slate-400">
                  Accuracy {generatedReport.scores.detectionAccuracyPct}% · Coverage{' '}
                  {generatedReport.scores.areaCoveredPct}% · Battery{' '}
                  {generatedReport.scores.batteryEfficiencyPct}%
                </div>
              </div>
            </div>

            <p className="text-slate-200 leading-relaxed">{generatedReport.summary}</p>

            {/* Evidence Detections Table */}
            <div>
              <div className="font-semibold text-white uppercase font-mono mb-1.5">
                GPS-Tagged Multi-Sensor Detections & Evidence Snapshots
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-cyan-900/60 text-slate-400">
                      <th className="py-1.5 pr-2">ID</th>
                      <th className="py-1.5 px-2">Classification</th>
                      <th className="py-1.5 px-2">Sensors</th>
                      <th className="py-1.5 px-2">GPS Coordinates</th>
                      <th className="py-1.5 px-2">Range</th>
                      <th className="py-1.5 px-2">SDG 14</th>
                      <th className="py-1.5 pl-2 text-right">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-950/60">
                    {generatedReport.detections.map((d) => (
                      <tr key={d.id}>
                        <td className="py-1.5 pr-2 text-cyan-300">{d.id}</td>
                        <td className="py-1.5 px-2 font-sans text-white">
                          {d.classLabel}
                        </td>
                        <td className="py-1.5 px-2 text-slate-300">
                          {d.confirmedSensors.join('+')}
                        </td>
                        <td className="py-1.5 px-2 text-slate-300">
                          {d.gps.lat}°N, {d.gps.lon}°E
                        </td>
                        <td className="py-1.5 px-2 text-amber-300">
                          {d.distanceKmDisplay}
                        </td>
                        <td className="py-1.5 px-2 text-emerald-300">
                          {d.sdgTargets.join(', ')}
                        </td>
                        <td className="py-1.5 pl-2 text-right text-white font-semibold">
                          {d.fusedConfidence.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommended Enforcement & Conservation Actions */}
            <div className="bg-[#06152d] border border-cyan-900/50 rounded p-3">
              <div className="font-semibold text-cyan-300 uppercase font-mono mb-1">
                Recommended Enforcement & Conservation Actions
              </div>
              <ul className="space-y-1 text-slate-200">
                {generatedReport.recommendedActions.map((act, i) => (
                  <li key={i}>
                    {i + 1}. {act}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
