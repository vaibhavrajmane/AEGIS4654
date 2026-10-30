import { AIBriefing, Alert, Detection, Telemetry } from '../types';

export async function requestMissionBriefing(params: {
  scenarioName: string;
  telemetry: Telemetry;
  detections: Detection[];
  alerts: Alert[];
}): Promise<AIBriefing> {
  const response = await fetch('/api/ai/briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenarioName: params.scenarioName,
      telemetry: {
        depth: params.telemetry.depth,
        batteryPct: params.telemetry.batteryPct,
        waterTempC: params.telemetry.waterTempC,
        turbidityNtu: params.telemetry.turbidityNtu,
        phLevel: params.telemetry.phLevel,
        inMpaZone: params.telemetry.inMpaZone,
        gps: params.telemetry.gps,
        pollutionIndex: params.telemetry.pollutionIndex,
        biodiversityIndex: params.telemetry.biodiversityIndex,
      },
      detections: params.detections.slice(0, 10).map((d) => ({
        id: d.id,
        classLabel: d.classLabel,
        category: d.category,
        fusedConfidence: d.fusedConfidence,
        distanceKmDisplay: d.distanceKmDisplay,
        confirmedSensors: d.confirmedSensors,
        sdgTargets: d.sdgTargets,
        evidenceNote: d.evidenceNote,
      })),
      alerts: params.alerts.slice(0, 6).map((a) => ({
        id: a.id,
        title: a.title,
        severity: a.severity,
        riskScore: a.riskScore,
        sdgTarget: a.sdgTarget,
        recommendedAction: a.recommendedAction,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Briefing request failed (${response.status})`);
  }
  return response.json();
}

export async function askAiAnalystQuestion(
  question: string,
  sessionContext: {
    scenarioName: string;
    telemetry: Telemetry;
    detections: Detection[];
    alerts: Alert[];
  }
): Promise<{ answer: string; source: string }> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      sessionContext: {
        scenarioName: sessionContext.scenarioName,
        telemetry: {
          depth: sessionContext.telemetry.depth,
          batteryPct: sessionContext.telemetry.batteryPct,
          turbidityNtu: sessionContext.telemetry.turbidityNtu,
          waterTempC: sessionContext.telemetry.waterTempC,
          inMpaZone: sessionContext.telemetry.inMpaZone,
          gps: sessionContext.telemetry.gps,
        },
        detections: sessionContext.detections.slice(0, 8).map((d) => ({
          classLabel: d.classLabel,
          distanceKmDisplay: d.distanceKmDisplay,
          fusedConfidence: d.fusedConfidence,
          cleanupPriority: d.cleanupPriority,
          evidenceNote: d.evidenceNote,
        })),
        alerts: sessionContext.alerts.slice(0, 5).map((a) => ({
          title: a.title,
          riskScore: a.riskScore,
          severity: a.severity,
          recommendedAction: a.recommendedAction,
        })),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Analyst chat failed (${response.status})`);
  }
  return response.json();
}
