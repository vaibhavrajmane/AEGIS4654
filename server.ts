import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function hasValidApiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() !== '' && key !== 'MY_GEMINI_API_KEY');
}

function getGenAIClient(): GoogleGenAI | null {
  if (!hasValidApiKey()) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildDeterministicBriefing(payload: any) {
  const detections = Array.isArray(payload?.detections) ? payload.detections : [];
  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
  const telemetry = payload?.telemetry || {};
  const missionTitle = payload?.missionTitle || 'Illegal Trawler Patrol';

  const topAlert = alerts[0];
  const criticalCount = alerts.filter(
    (a: any) => String(a.severity).toUpperCase() === 'CRITICAL' || a.riskScore >= 88
  ).length;
  const detectedLabels = detections.map((d: any) => `${d.label} (${d.confidence}%)`).join(', ');

  return {
    summary: `Mission "${missionTitle}" active at depth ${telemetry.depthMeters ?? 52.0}m (Sector X:${telemetry.rovX ?? 920}m, Water Temp ${telemetry.tempCelsius ?? 15.8}°C, Area Surveyed ${telemetry.areaSurveyedPct ?? 18}%). Optical & sonar sensors have logged ${detections.length} unique detections (${detectedLabels || 'scanning water column'}) and triaged ${alerts.length} priority alerts (${criticalCount} critical).`,
    threat_level: criticalCount >= 2 ? 'CRITICAL' : criticalCount === 1 ? 'HIGH' : 'MODERATE',
    key_findings: [
      topAlert
        ? `Apex Triage Alert: ${topAlert.title} (Risk Score ${topAlert.riskScore}/100, Severity ${topAlert.severity}) at X:${topAlert.worldX}m, Depth ${topAlert.depthMeters}m.`
        : 'All high-priority alerts in the Threat Triage Matrix have been dispatched.',
      detections.length > 0
        ? `Session Optical & Sonar Detections (${detections.length}): ${detectedLabels}.`
        : 'ROV sensors actively sweeping water column for poaching drift-nets, trapped rare wildlife, and plastic debris.',
      `ROV AUV-09 telemetry: Depth ${telemetry.depthMeters ?? 52}m, Temp ${telemetry.tempCelsius ?? 15.8}°C, Battery ${telemetry.battery ?? 96}%, Pollution Index ${telemetry.pollutionIndex ?? 64}/100, Biodiversity Count ${telemetry.biodiversityCount ?? 174}.`,
    ],
    recommended_actions: [
      topAlert
        ? `1. Dispatch immediate interception response to top priority alert: ${topAlert.title} (Risk ${topAlert.riskScore}/100) at X:${topAlert.worldX}m.`
        : '1. Continue autonomous sector patrol along the MPA boundary.',
      '2. Deploy net-cutter & wildlife rescue team to Poaching Ship Drift-Nets (X:1740m, X:3360m, X:4650m) to free trapped rare sea turtles, bluefin tuna, and manta rays.',
      '3. Contain pipeline hydrocarbon oil plume at X:2350m and enforce MPA sanctuary perimeter at X:3200m.',
    ],
    sdg14_targets_affected: [
      '14.1 Reduce marine pollution (plastic bottles, bags & pipeline oil plume)',
      '14.2 Protect and restore marine ecosystems (coral reef, kelp & trapped rare species)',
      '14.4 End IUU and destructive fishing (poaching drift-netters & ghost gear)',
      '14.5 Conserve coastal and marine areas (MPA boundary zone enforcement)',
      '14.a Increase marine scientific knowledge and technology (autonomous ROV & sonar recon)',
    ],
    confidence: 0.94,
    caveats:
      'AI output is decision support, not proof of a violation. All data is simulated.',
    generatedAt: new Date().toISOString().slice(11, 19) + ' UTC',
    source: 'deterministic-fallback',
  };
}

function buildDeterministicChatReply(question: string, context: any): string {
  const q = (question || '').toLowerCase();
  const alerts = Array.isArray(context?.alerts) ? context.alerts : [];
  const detections = Array.isArray(context?.detections) ? context.detections : [];
  const telemetry = context?.telemetry || {};
  const topAlert = alerts[0];
  const detNames = detections.map((d: any) => `${d.label} (${d.confidence}%)`).join(', ') || 'none yet';

  if (q.includes('urgent') || q.includes('threat') || q.includes('risk') || q.includes('priority')) {
    if (topAlert) {
      return `Grounded in your current simulated session, the highest-risk alert in the Threat Triage Matrix is **${topAlert.title}** with **Risk Score ${topAlert.riskScore}/100** (${topAlert.severity}) at X:${topAlert.worldX}m, Depth ${topAlert.depthMeters}m. Total active alerts: ${alerts.length}. *(AI output is decision support, not proof of a violation. All data is simulated.)*`;
    }
    return `All triaged alerts have been dispatched. Active session detections: ${detNames}. *(AI output is decision support, not proof of a violation. All data is simulated.)*`;
  }

  if (q.includes('pollution') || q.includes('plastic') || q.includes('oil')) {
    const pollutionDets = detections
      .filter((d: any) => d.category === 'pollution' || d.label.includes('Oil') || d.label.includes('Plastic'))
      .map((d: any) => `${d.label} (${d.confidence}% at ${d.distanceMeters}m)`);
    return `Session Pollution Telemetry (Pollution Index: **${telemetry.pollutionIndex ?? 64}/100**, SDG 14.1): Logged ${pollutionDets.length > 0 ? pollutionDets.join(', ') : 'plastic bottles, translucent bags, and pipeline oil plume in sector'}. ROV is currently at ${telemetry.depthMeters ?? 52}m depth (${telemetry.tempCelsius ?? 15.8}°C). *(AI output is decision support, not proof of a violation. All data is simulated.)*`;
  }

  if (q.includes('sdg') || q.includes('target')) {
    return `Based on the simulated session (${detections.length} detections, ${alerts.length} alerts), the affected UN SDG 14 targets are **14.1** (plastic & oil plume pollution), **14.2** (coral reef & entangled turtle protection), **14.4** (IUU suspicious vessel & ghost net), **14.5** (MPA boundary patrol at X:3200m), and **14.a** (ROV autonomous recon). *(AI output is decision support, not proof of a violation. All data is simulated.)*`;
  }

  return `Session Grounded Summary (Depth ${telemetry.depthMeters ?? 52}m, Battery ${telemetry.battery ?? 96}%, Area Surveyed ${telemetry.areaSurveyedPct ?? 18}%):
• **Detections (${detections.length})**: ${detNames}
• **Top Priority Alert**: ${topAlert ? `${topAlert.title} (Risk ${topAlert.riskScore}/100)` : 'None queued'}
• **Biodiversity Count**: ${telemetry.biodiversityCount ?? 174} organisms tracked.
*(AI output is decision support, not proof of a violation. All data is simulated.)*`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/ai/briefing', async (req, res) => {
    const payload = req.body || {};
    const ai = getGenAIClient();

    if (!ai) {
      return res.json(buildDeterministicBriefing(payload));
    }

    try {
      const prompt = `You are the AEGIS Ocean Sentinel Marine Conservation & Maritime Security AI Analyst.
Analyze the following SIMULATED session telemetry, multi-sensor detections, and priority-queue alerts.
Ground all findings strictly in the provided simulated session data. Remember: AI output is decision support, not legal proof of a violation.

Session Data:
${JSON.stringify(payload, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              threat_level: {
                type: Type.STRING,
                description: 'One of LOW, MODERATE, HIGH, CRITICAL',
              },
              key_findings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              illegal_fishing_indicators: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              pollution_findings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              marine_life_notes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommended_actions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              sdg14_targets_affected: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              confidence: { type: Type.NUMBER },
              caveats: { type: Type.STRING },
            },
            required: [
              'summary',
              'threat_level',
              'key_findings',
              'illegal_fishing_indicators',
              'pollution_findings',
              'marine_life_notes',
              'recommended_actions',
              'sdg14_targets_affected',
              'confidence',
              'caveats',
            ],
          },
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        return res.json(buildDeterministicBriefing(payload));
      }
      const parsed = JSON.parse(rawText);
      return res.json({
        ...parsed,
        generatedAt: new Date().toISOString().slice(11, 19) + ' UTC',
        source: 'gemini-live',
      });
    } catch (err) {
      // Graceful fallback to deterministic grounded briefing so UI never crashes
      return res.json(buildDeterministicBriefing(payload));
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    const { question, sessionContext } = req.body || {};
    const ai = getGenAIClient();

    if (!ai) {
      return res.json({
        answer: buildDeterministicChatReply(question, sessionContext),
        source: 'deterministic-fallback',
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: `User question: ${question}\n\nSimulated Session Data:\n${JSON.stringify(sessionContext, null, 2)}`,
        config: {
          systemInstruction:
            'You are the AEGIS Ocean Sentinel AI Analyst. Answer concisely (3-5 bullet points or 1 short paragraph) grounded ONLY in the provided simulated session data. State clearly when something is uncertain, and remind the operator that AI output is decision support, not proof of a violation.',
        },
      });

      const text = response.text?.trim() || buildDeterministicChatReply(question, sessionContext);
      return res.json({
        answer: text,
        source: 'gemini-live',
      });
    } catch (err) {
      return res.json({
        answer: buildDeterministicChatReply(question, sessionContext),
        source: 'deterministic-fallback',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AEGIS Ocean Sentinel server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
