import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  AnalyticsSnapshot,
  FullMissionReport,
} from '../sim/analyticsAndReport';

export interface GeminiBriefingData {
  summary: string;
  threat_level: string;
  key_findings: string[];
  recommended_actions: string[];
  sdg14_targets_affected: string[];
  confidence: number;
  caveats: string;
  generatedAt?: string;
  source?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * 1. ANALYTICS TAB PANEL (Recharts: Detections over time, Detections by class,
 * Pollution index, Biodiversity count, Area surveyed %)
 */
export const AnalyticsTabPanel: React.FC<{
  analytics: AnalyticsSnapshot;
  onOpenReport: () => void;
}> = ({ analytics, onOpenReport }) => {
  return (
    <div className="bg-[#05162c] border border-cyan-500/30 rounded p-2 font-mono text-[10px] space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-cyan-300 font-bold uppercase">
          Real-Time Marine Analytics
        </span>
        <button
          type="button"
          onClick={onOpenReport}
          className="px-2 py-0.5 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-[9px] cursor-pointer"
        >
          Generate mission report
        </button>
      </div>

      {/* 3 Core KPI Cards: Pollution Index, Biodiversity Count, Area Surveyed % */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="bg-[#020b16] border border-orange-500/35 rounded p-1.5">
          <span className="text-[7px] text-slate-400 block uppercase">Pollution Index</span>
          <span className="text-xs font-bold text-orange-300">
            {analytics.pollutionIndex}/100
          </span>
        </div>
        <div className="bg-[#020b16] border border-emerald-500/35 rounded p-1.5">
          <span className="text-[7px] text-slate-400 block uppercase">Biodiversity Count</span>
          <span className="text-xs font-bold text-emerald-300">
            {analytics.biodiversityCount}
          </span>
        </div>
        <div className="bg-[#020b16] border border-cyan-500/35 rounded p-1.5">
          <span className="text-[7px] text-slate-400 block uppercase">Area Surveyed %</span>
          <span className="text-xs font-bold text-cyan-300">
            {analytics.areaSurveyedPct}%
          </span>
        </div>
      </div>

      {/* Recharts 1: Detections Over Time (AreaChart) */}
      <div className="bg-[#020b16] border border-cyan-500/20 rounded p-1.5">
        <div className="text-[9px] text-slate-300 font-semibold mb-1">
          Detections Over Time (Cumulative)
        </div>
        <div className="w-full overflow-hidden flex justify-center">
          <AreaChart
            width={266}
            height={88}
            data={analytics.detectionsOverTime}
            margin={{ top: 4, right: 6, left: -24, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#0f2942" />
            <XAxis
              dataKey="timeLabel"
              tick={{ fill: '#94a3b8', fontSize: 8 }}
              stroke="#1e3a5f"
            />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 8 }} stroke="#1e3a5f" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#031022',
                borderColor: '#22d3ee',
                fontSize: '10px',
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#22d3ee"
              fill="#0284c7"
              fillOpacity={0.45}
              name="Total"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="threats"
              stroke="#f97316"
              fill="#ea580c"
              fillOpacity={0.35}
              name="Threats"
              isAnimationActive={false}
            />
          </AreaChart>
        </div>
      </div>

      {/* Recharts 2: Detections By Class (BarChart) */}
      <div className="bg-[#020b16] border border-cyan-500/20 rounded p-1.5">
        <div className="text-[9px] text-slate-300 font-semibold mb-1">
          Detections By Class (YOLOv8)
        </div>
        <div className="w-full overflow-hidden flex justify-center">
          <BarChart
            width={266}
            height={94}
            data={analytics.detectionsByClass}
            margin={{ top: 4, right: 6, left: -24, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#0f2942" />
            <XAxis
              dataKey="shortName"
              tick={{ fill: '#94a3b8', fontSize: 8 }}
              stroke="#1e3a5f"
              interval={0}
            />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 8 }} stroke="#1e3a5f" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#031022',
                borderColor: '#facc15',
                fontSize: '10px',
              }}
            />
            <Bar
              dataKey="count"
              fill="#facc15"
              radius={[2, 2, 0, 0]}
              name="Count"
              isAnimationActive={false}
            />
          </BarChart>
        </div>
      </div>
    </div>
  );
};

/**
 * 3. GEMINI "AI ANALYST" TAB PANEL
 * Structured JSON briefing card + Session-Grounded Chat Box + Mandatory Disclaimer
 */
export const AiAnalystTabPanel: React.FC<{
  briefing: GeminiBriefingData;
  loadingBriefing: boolean;
  onRefreshBriefing: () => void;
  chatMessages: ChatMessage[];
  loadingChat: boolean;
  onSendChat: (question: string) => void;
}> = ({
  briefing,
  loadingBriefing,
  onRefreshBriefing,
  chatMessages,
  loadingChat,
  onSendChat,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendChat(inputText.trim());
    setInputText('');
  };

  return (
    <div className="bg-[#05162c] border border-cyan-500/30 rounded p-2 font-mono text-[10px] space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-cyan-300 font-bold uppercase block">
            Gemini Flash AI Analyst
          </span>
          <span className="text-[9px] text-slate-400">
            Conf: {Math.round((briefing.confidence || 0.94) * 100)}% •{' '}
            {briefing.generatedAt || 'LIVE'}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefreshBriefing}
          disabled={loadingBriefing}
          className="px-2 py-1 rounded bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-bold text-[9px] cursor-pointer"
        >
          {loadingBriefing ? 'Analyzing...' : 'Refresh Briefing'}
        </button>
      </div>

      {/* Structured JSON Briefing Card */}
      <div className="bg-[#020b16] border border-cyan-500/25 rounded p-2 space-y-1.5 max-h-44 overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-400 uppercase">THREAT LEVEL</span>
          <span
            className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
              briefing.threat_level === 'CRITICAL'
                ? 'bg-red-500/30 text-red-300 border border-red-400/60'
                : 'bg-orange-500/30 text-orange-300 border border-orange-400/60'
            }`}
          >
            {briefing.threat_level}
          </span>
        </div>

        <p className="text-slate-200 leading-snug text-[10px]">{briefing.summary}</p>

        <div>
          <div className="text-yellow-300 font-bold text-[9px] uppercase mb-0.5">
            Key Findings
          </div>
          <ul className="space-y-0.5 text-slate-300 text-[9px] list-disc pl-3.5">
            {briefing.key_findings.slice(0, 3).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-emerald-300 font-bold text-[9px] uppercase mb-0.5">
            Recommended Actions
          </div>
          <ul className="space-y-0.5 text-slate-300 text-[9px] list-disc pl-3.5">
            {briefing.recommended_actions.slice(0, 3).map((act, i) => (
              <li key={i}>{act}</li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-cyan-300 font-bold text-[9px] uppercase mb-0.5">
            SDG 14 Targets Affected
          </div>
          <div className="flex flex-wrap gap-1">
            {briefing.sdg14_targets_affected.map((t, i) => (
              <span
                key={i}
                className="px-1 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-[8px]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Small Grounded Chat Box */}
      <div className="bg-[#020b16] border border-cyan-500/25 rounded p-1.5 space-y-1.5">
        <div className="text-[9px] text-cyan-300 font-bold uppercase">
          Session-Grounded Analyst Chat
        </div>

        <div className="flex flex-wrap gap-1">
          {[
            'Highest risk threat?',
            'Pollution findings?',
            'Affected SDG 14 targets?',
          ].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onSendChat(q)}
              className="px-1.5 py-0.5 rounded bg-[#082240] hover:bg-cyan-900 text-cyan-200 border border-cyan-500/35 text-[8px] cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="max-h-24 overflow-y-auto space-y-1 pr-0.5 text-[9px]">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-1 rounded ${
                msg.role === 'user'
                  ? 'bg-cyan-950/60 text-cyan-200 text-right'
                  : 'bg-slate-900 text-slate-200 border border-cyan-500/20'
              }`}
            >
              <span className="font-bold mr-1">
                {msg.role === 'user' ? 'OP:' : 'AI:'}
              </span>
              <span>{msg.text}</span>
            </div>
          ))}
          {loadingChat && (
            <div className="text-cyan-300 italic text-[9px]">
              Querying Gemini Flash with simulated session telemetry...
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about session detections..."
            className="flex-1 bg-[#041326] border border-cyan-500/40 rounded px-1.5 py-1 text-[9px] text-slate-100 placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={loadingChat}
            className="px-2 py-1 rounded bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold text-[9px] cursor-pointer"
          >
            Ask
          </button>
        </form>
      </div>

      {/* Required Decision-Support Note */}
      <div className="p-1.5 rounded bg-yellow-950/50 border border-yellow-500/40 text-yellow-200 text-[9px] leading-tight text-center font-semibold">
        AI output is decision support, not proof of a violation. All data is simulated.
      </div>
    </div>
  );
};

/**
 * 2. ON-SCREEN MISSION REPORT MODAL (Summary, Timeline, Detections, SDG 14 Targets 14.1, 14.2, 14.4, 14.5, 14.a)
 * with Print and Download JSON buttons.
 */
export const MissionReportModal: React.FC<{
  report: FullMissionReport;
  briefing: GeminiBriefingData;
  onClose: () => void;
}> = ({ report, briefing, onClose }) => {
  const handleDownloadJson = () => {
    const payload = {
      ...report,
      aiAnalystBriefing: briefing,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.reportId.toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="pointer-events-auto fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 font-mono overflow-y-auto">
      <div className="max-w-4xl w-full bg-[#041326] border-2 border-cyan-400/70 rounded-lg p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-cyan-500/35">
          <div>
            <span className="text-[10px] text-cyan-400 uppercase tracking-widest block">
              OFFICIAL AEGIS SUBSEA RECONNAISSANCE REPORT • {report.reportId}
            </span>
            <h2 className="text-lg font-bold text-yellow-300">
              {report.missionTitle} — Mission & UN SDG 14 Report
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintReport}
              className="px-3 py-1.5 rounded bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-200 border border-cyan-400/60 text-xs font-bold cursor-pointer"
            >
              Print Report
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="px-3 py-1.5 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Download JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* 1. Executive Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-[#071c36] border border-cyan-500/30">
            <span className="text-[9px] text-slate-400 block">PROGRESS</span>
            <span className="font-bold text-emerald-300">{report.missionProgressPct}%</span>
          </div>
          <div className="p-2 rounded bg-[#071c36] border border-cyan-500/30">
            <span className="text-[9px] text-slate-400 block">AREA SURVEYED</span>
            <span className="font-bold text-cyan-300">{report.summary.areaSurveyedPct}%</span>
          </div>
          <div className="p-2 rounded bg-[#071c36] border border-cyan-500/30">
            <span className="text-[9px] text-slate-400 block">POLLUTION IDX</span>
            <span className="font-bold text-orange-300">{report.summary.pollutionIndex}/100</span>
          </div>
          <div className="p-2 rounded bg-[#071c36] border border-cyan-500/30">
            <span className="text-[9px] text-slate-400 block">BIODIVERSITY</span>
            <span className="font-bold text-emerald-300">{report.summary.biodiversityCount}</span>
          </div>
          <div className="p-2 rounded bg-[#071c36] border border-cyan-500/30">
            <span className="text-[9px] text-slate-400 block">DETECTIONS</span>
            <span className="font-bold text-yellow-300">
              {report.summary.totalUniqueDetections}
            </span>
          </div>
          <div className="p-2 rounded bg-[#071c36] border border-cyan-500/30">
            <span className="text-[9px] text-slate-400 block">ROV DEPTH/TEMP</span>
            <span className="font-bold text-cyan-200">
              {report.summary.rovDepthMeters}m / {report.summary.waterTempCelsius}°C
            </span>
          </div>
        </div>

        {/* 2. UN SDG 14 Targets Assessment (14.1, 14.2, 14.4, 14.5, 14.a) */}
        <div>
          <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2">
            UN SDG 14 (Life Below Water) Target Alignment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {report.sdg14Targets.map((t) => (
              <div
                key={t.code}
                className="p-2.5 rounded bg-[#061830] border border-cyan-500/35 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-yellow-300">
                    Target {t.code}: {t.title}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-200 border border-cyan-500/40">
                    {t.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-200">{t.findings}</p>
                <div className="text-[10px] text-emerald-300 font-semibold">{t.metrics}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Mission Timeline & Logged Detections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-[#061830] border border-cyan-500/30 rounded p-3">
            <h3 className="text-xs font-bold text-cyan-300 uppercase mb-2">
              Mission Timeline
            </h3>
            <div className="space-y-1.5 max-h-44 overflow-y-auto text-[11px]">
              {report.timeline.map((ev, idx) => (
                <div key={idx} className="border-l-2 border-cyan-400 pl-2 py-0.5">
                  <span className="text-yellow-300 font-bold mr-1.5">[{ev.time}]</span>
                  <span className="text-cyan-300 font-semibold mr-1">{ev.type}:</span>
                  <span className="text-slate-200">{ev.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#061830] border border-cyan-500/30 rounded p-3">
            <h3 className="text-xs font-bold text-cyan-300 uppercase mb-2">
              Logged YOLOv8 Detections ({report.detections.length})
            </h3>
            <div className="space-y-1 max-h-44 overflow-y-auto text-[11px]">
              {report.detections.map((d) => (
                <div
                  key={d.id}
                  className="p-1.5 rounded bg-[#020b16] border border-cyan-500/20 flex justify-between"
                >
                  <div>
                    <span className="font-bold text-yellow-300">{d.label}</span>
                    <span className="text-slate-400 block text-[10px]">
                      Sector X:{Math.round(d.worldX)}m • Dist:{d.distanceMeters}m
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-300">{d.confidence}%</span>
                    <span className="text-slate-400 block text-[10px]">T+{d.timestampStr}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="p-2 rounded bg-yellow-950/50 border border-yellow-500/40 text-center text-[11px] text-yellow-200 font-semibold">
          {report.disclaimer}
        </div>
      </div>
    </div>
  );
};
