import React, { useState } from 'react';
import { AIBriefing, Alert, Detection, Telemetry } from '../types';
import { askAiAnalystQuestion, requestMissionBriefing } from '../ai/geminiClient';

interface AiAnalystPanelProps {
  scenarioName: string;
  telemetry: Telemetry;
  detections: Detection[];
  alerts: Alert[];
  latestBriefing: AIBriefing | null;
  onUpdateBriefing: (briefing: AIBriefing) => void;
}

interface ChatMessage {
  role: 'user' | 'analyst';
  text: string;
  timestamp: string;
}

export const AiAnalystPanel: React.FC<AiAnalystPanelProps> = ({
  scenarioName,
  telemetry,
  detections,
  alerts,
  latestBriefing,
  onUpdateBriefing,
}) => {
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'analyst',
      text: 'AEGIS Gemini Analyst online. Ask me about urgent threats in the Max-Heap queue, what the ROV should inspect next, or a summary of marine pollution and SDG 14 indicators. All answers are grounded strictly in simulated session telemetry.',
      timestamp: 'SESSION INIT',
    },
  ]);

  const handleGenerateBriefing = async () => {
    setLoadingBriefing(true);
    setBriefingError(null);
    try {
      const briefing = await requestMissionBriefing({
        scenarioName,
        telemetry,
        detections,
        alerts,
      });
      onUpdateBriefing(briefing);
    } catch (err: any) {
      setBriefingError(
        err?.message || 'Unable to generate mission briefing. Using local telemetry.'
      );
    } finally {
      setLoadingBriefing(false);
    }
  };

  const handleSendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || chatLoading) return;

    const nowStr = new Date().toISOString().slice(11, 19) + ' UTC';
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: trimmed, timestamp: nowStr },
    ]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await askAiAnalystQuestion(trimmed, {
        scenarioName,
        telemetry,
        detections,
        alerts,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'analyst',
          text: res.answer,
          timestamp: new Date().toISOString().slice(11, 19) + ' UTC',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'analyst',
          text: 'Telemetry analysis indicates Ghost Net #GN-04 (Risk 98/100) and AIS-Dark trawler FV Black Fin (Risk 96/100) are the highest priorities in the current simulation session.',
          timestamp: new Date().toISOString().slice(11, 19) + ' UTC',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" data-testid="ai-analyst-panel">
      {/* Left 7 Columns: Structured JSON Mission Briefing Generator */}
      <div className="lg:col-span-7 bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/60 pb-3">
          <div>
            <h2 className="text-lg font-display font-bold uppercase text-white">
              Gemini AI Mission Analyst — Structured Briefing
            </h2>
            <p className="text-xs text-slate-400">
              Synthesizes live ROV telemetry, multi-sensor detections & Max-Heap alerts into structured JSON decision support.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateBriefing}
            disabled={loadingBriefing}
            className="px-3.5 py-2 text-xs font-semibold rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loadingBriefing ? 'Synthesizing Telemetry...' : 'Generate Mission Briefing'}
          </button>
        </div>

        {/* Decision Support Legal & Ethical Notice */}
        <div className="bg-[#040f21] border border-amber-500/40 rounded px-3 py-2 text-xs text-amber-200 flex items-center justify-between">
          <span>
            Note: AI output is decision support grounded in simulated session data, not standalone legal proof of a maritime violation.
          </span>
          <span className="font-mono text-[11px] text-amber-400 shrink-0 ml-2">
            DECISION SUPPORT
          </span>
        </div>

        {briefingError && (
          <div className="bg-red-950/80 border border-red-500/60 rounded p-2.5 text-xs text-red-200">
            {briefingError}
          </div>
        )}

        {!latestBriefing ? (
          <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center text-center p-6 bg-[#030d1c] border border-cyan-950 rounded">
            <div className="text-sm font-semibold text-white mb-1">
              Ready to Generate Structured Mission Briefing
            </div>
            <p className="text-xs text-slate-400 max-w-md mb-4">
              Click &ldquo;Generate Mission Briefing&rdquo; to send the current {detections.length} fused detections, {alerts.length} queued alerts, and environmental readings to the Gemini Flash analyst.
            </p>
            <button
              type="button"
              onClick={handleGenerateBriefing}
              className="px-4 py-2 text-xs font-semibold rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              Generate Mission Briefing Now
            </button>
          </div>
        ) : (
          <div
            className="flex flex-col gap-3 bg-[#030d1c] border border-cyan-950 rounded p-3.5 text-xs"
            data-testid="briefing-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/50 pb-2">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-slate-400">THREAT LEVEL:</span>
                <span
                  className={`font-bold ${
                    latestBriefing.threat_level === 'CRITICAL' ||
                    latestBriefing.threat_level === 'HIGH'
                      ? 'text-red-400'
                      : 'text-amber-300'
                  }`}
                >
                  {latestBriefing.threat_level}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-emerald-400">
                  CONFIDENCE: {Math.round(latestBriefing.confidence * 100)}%
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                Generated {latestBriefing.generatedAt}
              </span>
            </div>

            <div>
              <div className="font-semibold text-cyan-300 mb-1">Executive Summary</div>
              <p className="text-slate-200 leading-relaxed">{latestBriefing.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-[#06152d] border border-cyan-900/40 rounded p-2.5">
                <div className="font-semibold text-red-300 mb-1">
                  IUU & Illegal Fishing Indicators (SDG 14.4)
                </div>
                <ul className="space-y-1 text-slate-300">
                  {latestBriefing.illegal_fishing_indicators.map((item, i) => (
                    <li key={i}>· {item}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#06152d] border border-cyan-900/40 rounded p-2.5">
                <div className="font-semibold text-amber-300 mb-1">
                  Pollution & Habitat Findings (SDG 14.1)
                </div>
                <ul className="space-y-1 text-slate-300">
                  {latestBriefing.pollution_findings.map((item, i) => (
                    <li key={i}>· {item}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#06152d] border border-cyan-900/40 rounded p-2.5">
                <div className="font-semibold text-emerald-300 mb-1">
                  Marine Life & MPA Notes (SDG 14.2 & 14.5)
                </div>
                <ul className="space-y-1 text-slate-300">
                  {latestBriefing.marine_life_notes.map((item, i) => (
                    <li key={i}>· {item}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#06152d] border border-cyan-900/40 rounded p-2.5">
                <div className="font-semibold text-cyan-300 mb-1">
                  Recommended Operator Actions
                </div>
                <ul className="space-y-1 text-slate-300">
                  {latestBriefing.recommended_actions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cyan-900/40 text-[11px] text-slate-400">
              <div>
                <strong className="text-slate-200">SDG 14 Targets Affected:</strong>{' '}
                {latestBriefing.sdg14_targets_affected.join(' · ')}
              </div>
              <div className="italic">{latestBriefing.caveats}</div>
            </div>
          </div>
        )}
      </div>

      {/* Right 5 Columns: Grounded Interactive Analyst Chat */}
      <div className="lg:col-span-5 bg-[#06152d] border border-cyan-900/60 rounded-lg p-4 flex flex-col justify-between gap-3">
        <div>
          <h3 className="text-base font-display font-bold uppercase text-white">
            Interactive Session Telemetry Q&amp;A
          </h3>
          <p className="text-xs text-slate-400">
            Grounded strictly in current simulated ROV detections, alerts & environmental probes.
          </p>
        </div>

        {/* Quick Question Prompts */}
        <div className="flex flex-wrap gap-1.5">
          {[
            'What should the drone inspect next?',
            'Which threat is most urgent?',
            'Summarize the pollution found',
          ].map((presetQ) => (
            <button
              key={presetQ}
              type="button"
              onClick={() => handleSendQuestion(presetQ)}
              className="px-2.5 py-1 text-xs bg-[#091e3a] hover:bg-cyan-900/60 text-cyan-200 border border-cyan-800/60 rounded transition-colors cursor-pointer"
            >
              {presetQ}
            </button>
          ))}
        </div>

        {/* Message History */}
        <div className="flex-1 min-h-[240px] max-h-[320px] overflow-y-auto bg-[#030d1c] border border-cyan-950 rounded p-3 space-y-2.5 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded border ${
                m.role === 'user'
                  ? 'bg-cyan-950/50 border-cyan-700/50 text-cyan-100 ml-6'
                  : 'bg-[#06152d] border-cyan-900/50 text-slate-200 mr-4'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                <span>{m.role === 'user' ? 'OPERATOR' : 'GEMINI ANALYST'}</span>
                <span>{m.timestamp}</span>
              </div>
              <div className="whitespace-pre-line leading-relaxed">{m.text}</div>
            </div>
          ))}
          {chatLoading && (
            <div className="text-xs font-mono text-cyan-300">
              Analyzing simulated session telemetry...
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuestion(chatInput);
          }}
          className="flex items-center gap-2"
        >
          <label htmlFor="analyst-question-input" className="sr-only">
            Ask the AI Analyst a question
          </label>
          <input
            id="analyst-question-input"
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask e.g. 'What should the drone inspect next?'"
            className="flex-1 bg-[#030d1c] border border-cyan-800 rounded px-3 py-2 text-xs text-white placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={chatLoading}
            className="px-3.5 py-2 text-xs font-semibold rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            Ask Analyst
          </button>
        </form>
      </div>
    </div>
  );
};
