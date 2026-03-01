import React from 'react';
import { TowerData, TimeOption, SeasonOption } from '../types';

interface OverlayProps {
  hoveredId: number | null;
  selectedData: TowerData | null;
  aiAnalysis: string | null;
  isAnalyzing: boolean;
  onClearSelection: () => void;
  timeOption: TimeOption;
  setTimeOption: (t: TimeOption) => void;
  season: SeasonOption;
  setSeason: (s: SeasonOption) => void;
}

export const Overlay: React.FC<OverlayProps> = ({ 
  hoveredId, 
  selectedData, 
  aiAnalysis, 
  isAnalyzing,
  onClearSelection,
  timeOption,
  setTimeOption,
  season,
  setSeason
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between p-6 overflow-hidden">
      {/* UI Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay z-0"></div>

      {/* Header */}
      <header className="flex justify-between items-start pointer-events-auto relative z-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)]">
            AERO GRID
          </h1>
          <p className="text-[10px] text-cyan-200 uppercase tracking-[0.3em] mt-1 opacity-80 font-mono">
            Digital Twin Simulation // v2.0
          </p>
        </div>
        
        <div className="flex flex-col gap-3 items-end">
          <div className="bg-black/60 backdrop-blur-md border border-cyan-500/30 rounded-sm p-3 text-right shadow-[0_0_15px_rgba(0,255,255,0.1)]">
            <div className="text-[9px] uppercase text-cyan-500/70 font-mono tracking-widest mb-1">System Status</div>
            <div className="flex items-center justify-end gap-2 text-cyan-400 text-xs font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500 shadow-[0_0_5px_#00ffff]"></span>
              </span>
              ONLINE & SYNCED
            </div>
          </div>

          {/* Environmental Controls */}
          <div className="bg-black/60 backdrop-blur-md border border-cyan-500/30 rounded-sm p-3 flex gap-4 pointer-events-auto shadow-[0_0_15px_rgba(0,255,255,0.1)]">
             <div className="flex flex-col gap-1">
                <label className="text-[8px] uppercase text-cyan-500/70 font-mono tracking-widest">Time Cycle</label>
                <select 
                  value={timeOption}
                  onChange={(e) => setTimeOption(e.target.value as TimeOption)}
                  className="bg-black/80 border border-cyan-500/50 text-cyan-100 text-[10px] font-mono rounded-sm px-2 py-1 outline-none hover:border-cyan-300 focus:border-cyan-300 transition-colors cursor-pointer"
                >
                  <option value="Auto">Auto Cycle</option>
                  <option value="Dawn">Dawn (06:00)</option>
                  <option value="Noon">Noon (12:00)</option>
                  <option value="Dusk">Dusk (18:00)</option>
                  <option value="Midnight">Midnight (00:00)</option>
                </select>
             </div>
             
             <div className="flex flex-col gap-1">
                <label className="text-[8px] uppercase text-cyan-500/70 font-mono tracking-widest">Season</label>
                <select 
                  value={season}
                  onChange={(e) => setSeason(e.target.value as SeasonOption)}
                  className="bg-black/80 border border-cyan-500/50 text-cyan-100 text-[10px] font-mono rounded-sm px-2 py-1 outline-none hover:border-cyan-300 focus:border-cyan-300 transition-colors cursor-pointer"
                >
                  <option value="Spring">Spring</option>
                  <option value="Summer">Summer</option>
                  <option value="Autumn">Autumn</option>
                  <option value="Winter">Winter</option>
                </select>
             </div>
          </div>
        </div>
      </header>

      {/* Middle Interaction Hint */}
      {hoveredId !== null && !selectedData && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="bg-cyan-950/80 backdrop-blur-sm px-6 py-2 rounded-sm border border-cyan-500/50 text-cyan-300 text-[10px] font-mono tracking-[0.2em] shadow-[0_0_20px_rgba(0,255,255,0.2)]">
            <span className="animate-pulse">TARGET ACQUIRED: TURBINE_{hoveredId.toString().padStart(3, '0')}</span>
          </div>
        </div>
      )}

      {/* Footer / Info Panel */}
      <div className="flex items-end justify-between w-full pointer-events-auto relative z-10">
        
        {/* Controls Hint */}
        <div className="bg-black/60 backdrop-blur-md border border-cyan-500/30 rounded-sm p-4 max-w-xs shadow-[0_0_15px_rgba(0,255,255,0.1)]">
          <div className="flex gap-6 text-[10px] font-mono text-cyan-100/60">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-cyan-400">DRAG</span>
              <span>Orbit</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-cyan-400">SCROLL</span>
              <span>Zoom</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-cyan-400">CLICK</span>
              <span>Inspect</span>
            </div>
          </div>
        </div>

        {/* Selected Data Panel */}
        {selectedData && (
          <div className="bg-slate-950/90 backdrop-blur-xl border border-cyan-500/50 rounded-sm p-6 max-w-md w-full shadow-[0_0_30px_rgba(0,255,255,0.15)] animate-in slide-in-from-bottom-10 fade-in duration-300 relative overflow-hidden">
            {/* Decorative corner accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-400"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-400"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-400"></div>

            <div className="flex justify-between items-start mb-6 border-b border-cyan-500/20 pb-3">
              <div>
                <h2 className="text-2xl font-black text-cyan-300 tracking-tight">TURBINE_{selectedData.id.toString().padStart(3, '0')}</h2>
                <div className="text-[10px] text-cyan-500/80 font-mono tracking-widest mt-1">
                   POS: [{selectedData.position.x.toFixed(2)}, {selectedData.position.z.toFixed(2)}]
                </div>
              </div>
              <button 
                onClick={onClearSelection}
                className="text-cyan-500/50 hover:text-cyan-300 transition-colors text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-black/50 border border-cyan-900/50 rounded-sm p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/20"></div>
                <div className="text-[9px] uppercase text-cyan-500/70 font-mono tracking-widest mb-1 pl-2">Hub Height</div>
                <div className="text-xl font-mono text-cyan-100 pl-2">{selectedData.height.toFixed(1)}<span className="text-xs text-cyan-500/50 ml-1">m</span></div>
                <div className="h-[2px] bg-cyan-950 mt-2 rounded-full overflow-hidden ml-2">
                  <div 
                    className="h-full bg-cyan-400 shadow-[0_0_5px_#00ffff]" 
                    style={{ width: `${Math.min(selectedData.height * 3, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="bg-black/50 border border-cyan-900/50 rounded-sm p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20"></div>
                <div className="text-[9px] uppercase text-cyan-500/70 font-mono tracking-widest mb-1 pl-2">Efficiency</div>
                <div className="text-xl font-mono text-blue-300 pl-2">{selectedData.value}<span className="text-xs text-blue-500/50 ml-1">%</span></div>
                <div className="h-[2px] bg-cyan-950 mt-2 rounded-full overflow-hidden ml-2">
                  <div 
                    className="h-full bg-blue-400 shadow-[0_0_5px_#3b82f6]" 
                    style={{ width: `${Math.min(selectedData.value, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-black/40 rounded-sm p-4 border border-cyan-500/20 min-h-[100px] relative">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[9px] uppercase tracking-[0.2em] text-cyan-400 font-bold font-mono">
                  &gt; AI Diagnostics
                </span>
                {isAnalyzing && (
                  <span className="text-[9px] font-mono animate-pulse text-cyan-300 bg-cyan-900/50 px-2 py-0.5 rounded-sm">PROCESSING...</span>
                )}
              </div>
              
              <div className="text-xs text-cyan-100/80 leading-relaxed font-mono">
                {isAnalyzing ? (
                  <div className="flex flex-col gap-2 opacity-70">
                    <div className="h-2 bg-cyan-900/50 rounded w-3/4 animate-pulse"></div>
                    <div className="h-2 bg-cyan-900/50 rounded w-full animate-pulse"></div>
                    <div className="h-2 bg-cyan-900/50 rounded w-5/6 animate-pulse"></div>
                  </div>
                ) : aiAnalysis ? (
                  <div className="border-l-2 border-cyan-500/30 pl-3 py-1">
                    {aiAnalysis}
                  </div>
                ) : (
                  <span className="opacity-50 flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 bg-cyan-500/50 rounded-full animate-ping"></span>
                    Awaiting telemetry data...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};