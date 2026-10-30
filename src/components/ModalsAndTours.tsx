import React, { useState } from 'react';
import { ScenarioPreset } from '../types';
import { SCENARIO_PRESETS, SDG_FRAMING_TEXT } from '../data/worldSeed';

interface MissionSelectModalProps {
  open: boolean;
  activeScenario: ScenarioPreset;
  onSelectScenario: (scenario: ScenarioPreset) => void;
  onClose: () => void;
}

export const MissionSelectModal: React.FC<MissionSelectModalProps> = ({
  open,
  activeScenario,
  onSelectScenario,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#020813]/90 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-select-title"
    >
      <div className="bg-[#06152d] border border-cyan-500/60 rounded-xl max-w-4xl w-full p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/60 pb-3">
          <div>
            <div className="text-xs font-mono text-cyan-400 uppercase">
              AEGIS OCEAN SENTINEL — MISSION DEPLOYMENT PRESETS
            </div>
            <h2
              id="mission-select-title"
              className="text-2xl font-display font-bold uppercase text-white"
            >
              Select Autonomous ROV Surveillance Scenario
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {SDG_FRAMING_TEXT.tagline} · {SDG_FRAMING_TEXT.impactBanner}
            </p>
          </div>
          <button
            type="button"
            data-start="true"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 cursor-pointer"
          >
            Resume Current Mission
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCENARIO_PRESETS.map((preset) => {
            const isSelected = preset.id === activeScenario.id;
            return (
              <div
                key={preset.id}
                className={`p-3.5 rounded-lg border flex flex-col justify-between gap-3 transition-colors ${
                  isSelected
                    ? 'bg-cyan-950/70 border-yellow-400'
                    : 'bg-[#040f21] border-cyan-900/60 hover:border-cyan-500/60'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-yellow-300 font-bold">
                      SCENARIO {preset.code}
                    </span>
                    <span className="text-cyan-300">
                      SDG {preset.sdgTargets.join(', ')}
                    </span>
                  </div>
                  <h3 className="text-base font-display font-bold text-white uppercase">
                    {preset.name}
                  </h3>
                  <div className="text-xs text-cyan-200 font-medium">
                    {preset.subtitle}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {preset.description}
                  </p>
                  <div className="pt-1">
                    <div className="text-[11px] font-mono text-slate-400 mb-1">
                      Mission Objectives:
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-slate-300">
                      {preset.objectives.map((o) => (
                        <li key={o.id}>· {o.description}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectScenario(preset);
                    onClose();
                  }}
                  className={`w-full py-2 text-xs font-semibold rounded transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-yellow-400 text-slate-950'
                      : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                  }`}
                >
                  {isSelected
                    ? `Active: ${preset.code}. ${preset.name}`
                    : `Deploy Scenario ${preset.code}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface OnboardingTourModalProps {
  open: boolean;
  onClose: () => void;
}

const TOUR_STEPS = [
  {
    step: 1,
    title: 'Welcome to AEGIS Ocean Sentinel (SDG 14: Life Below Water)',
    body: 'AEGIS combines an autonomous 6-thruster Underwater Drone (ROV), an Unmanned Surface Vessel (AEGIS-01 mothership), and LEO satellite telemetry to combat illegal fishing, marine plastic/oil pollution, and habitat loss.',
    highlight: 'Safer Seas | Cleaner Oceans | A Sustainable Future',
  },
  {
    step: 2,
    title: '3D Ocean Twin, Low-Power 2D Mode & 5 Flight Control Modes',
    body: 'Fly the ROV manually using WASD + Q/E keys (or on-screen thruster controls), or engage Autonomous Patrol, Lawnmower Bathymetry Survey, Target Follow, or Return-to-Base. Toggle between 3D WebGL and 2D Side-Profile mode anytime.',
    highlight: 'Controls: WASD / Arrows to Steer · E to Dive · Q to Ascend · H for Help',
  },
  {
    step: 3,
    title: '5 Monitoring Capabilities & Bayesian Multi-Sensor Fusion',
    body: 'Switch across all 5 poster capabilities: (1) Vessel Detection & Tracking, (2) Illegal Fishing Detection, (3) Pollution Monitoring, (4) Marine Life Tracking, and (5) Seabed Mapping & Inspection. Simulated YOLOv8 optical detections fuse with 450 kHz Sonar, GPS, and Fluorometer probes.',
    highlight: 'Poster Readouts: Suspicious Vessel 2.4 km · Plastic Waste 3.8 km · Marine Life 5.1 km · Seabed Anomaly 6.3 km',
  },
  {
    step: 4,
    title: 'Max-Heap Priority Queue Alert Triage & DSA Showcase',
    body: 'Critical alerts (entangled Green Sea Turtle, AIS-dark trawler in MPA, subsea oil leak) are ranked in a Binary Max-Heap Priority Queue. Click "Dispatch Response" to dequeue the highest-risk alert. Visit the DSA & Architecture tabs to inspect the Ring Buffer, DFS Obstacle Stack, and O(1) Vessel Hash Table.',
    highlight: 'Built-in DSA Self-Test Suite verifies all 5 data structures in real time.',
  },
  {
    step: 5,
    title: 'Gemini AI Mission Analyst & Exportable SDG 14 Reports',
    body: 'Open the AI Analyst tab to generate a structured JSON Mission Briefing via Gemini Flash or ask grounded questions about session detections. Open Reports to generate and download a complete GPS-stamped SDG 14 dossier.',
    highlight: 'Simulated data for demonstration. AI output is decision support, not proof of a violation.',
  },
];

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  open,
  onClose,
}) => {
  const [stepIdx, setStepIdx] = useState(0);
  if (!open) return null;

  const current = TOUR_STEPS[stepIdx];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#020813]/85 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
    >
      <div className="bg-[#06152d] border border-cyan-400 rounded-xl max-w-lg w-full p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
          <span>
            ONBOARDING TOUR — STEP {current.step} OF {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            Skip Tour [Esc]
          </button>
        </div>

        <h3
          id="onboarding-tour-title"
          className="text-xl font-display font-bold uppercase text-white"
        >
          {current.title}
        </h3>

        <p className="text-xs text-slate-200 leading-relaxed">{current.body}</p>

        <div className="bg-[#040f21] border border-cyan-800/60 rounded p-2.5 text-xs font-mono text-yellow-300">
          {current.highlight}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-cyan-900/60">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[#091e3a] text-slate-300 disabled:opacity-40"
          >
            Previous
          </button>

          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`w-2 h-2 rounded-full ${
                  idx === stepIdx ? 'bg-cyan-400' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          {stepIdx < TOUR_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIdx((i) => i + 1)}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              Next Step
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-yellow-400 text-slate-950 hover:bg-yellow-300"
            >
              Finish Tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface ControlsCheatSheetModalProps {
  open: boolean;
  onClose: () => void;
}

export const ControlsCheatSheetModal: React.FC<ControlsCheatSheetModalProps> = ({
  open,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#020813]/85 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="controls-sheet-title"
    >
      <div className="bg-[#06152d] border border-cyan-500/70 rounded-xl max-w-lg w-full p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-cyan-900/60 pb-2">
          <h3
            id="controls-sheet-title"
            className="text-lg font-display font-bold uppercase text-white"
          >
            ROV Flight & Command Center Controls Cheat-Sheet (Key: H)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-mono rounded bg-[#091e3a] text-cyan-300 hover:text-white"
          >
            Close [H / Esc]
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
          <div className="bg-[#040f21] border border-cyan-900/50 rounded p-2.5">
            <div className="text-yellow-300 font-bold mb-1">
              ROV Propulsion & Depth
            </div>
            <div className="space-y-1 text-slate-300">
              <div>[W / ↑] Thrust Forward</div>
              <div>[S / ↓] Thrust Reverse</div>
              <div>[A / ←] Yaw Port (Left)</div>
              <div>[D / →] Yaw Starboard (Right)</div>
              <div>[E / Shift] Dive Deeper</div>
              <div>[Q / Space] Ascend Toward Surface</div>
            </div>
          </div>

          <div className="bg-[#040f21] border border-cyan-900/50 rounded p-2.5">
            <div className="text-cyan-300 font-bold mb-1">
              Sensors, Modes & Shortcuts
            </div>
            <div className="space-y-1 text-slate-300">
              <div>[1–5] Switch Autonomous Mode</div>
              <div>[L] Toggle Subsea LED Headlights</div>
              <div>[V] Cycle Camera Viewpoint</div>
              <div>[H] Toggle Controls Cheat-Sheet</div>
              <div>[Click Marker] Lock / Inspect Target</div>
              <div>[Dispatch Button] Dequeue Max-Heap</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Safety Behavior: Approaching Ghost Net #GN-04 or SS Poseidon Wreck automatically engages proximity auto-slow and pops safe breadcrumbs from the LIFO Waypoint Stack.
        </div>
      </div>
    </div>
  );
};
