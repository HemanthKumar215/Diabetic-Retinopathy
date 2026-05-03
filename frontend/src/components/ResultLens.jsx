import React, { useEffect, useState, useRef } from 'react';
import { Activity, ShieldAlert, CheckCircle, AlertTriangle, SlidersHorizontal, LayoutTemplate } from 'lucide-react';

const SEVERITY = {
  0: { label: "No DR (Healthy)", color: "text-neon-cyan", bg: "bg-cyan-900/30", border: "border-cyan-500", icon: CheckCircle },
  1: { label: "Mild NPDR", color: "text-yellow-400", bg: "bg-yellow-900/30", border: "border-yellow-500", icon: Activity },
  2: { label: "Moderate NPDR", color: "text-orange-400", bg: "bg-orange-900/40", border: "border-orange-500", icon: AlertTriangle },
  3: { label: "Severe NPDR", color: "text-red-500", bg: "bg-red-900/30", border: "border-red-500", icon: ShieldAlert },
  4: { label: "Proliferative DR", color: "text-neon-red", bg: "bg-red-900/60", border: "border-red-600", icon: ShieldAlert }
};

const MOCK_FEATURES = {
  0: { micro: "None", hem: "None", exu: "None", rec: ["Routine check-up in 12 months", "No immediate risk detected"] },
  1: { micro: "Few / Isolated", hem: "None", exu: "None", rec: ["Routine check-up in 6 months", "Monitor blood sugar levels"] },
  2: { micro: "Moderate", hem: "Mild", exu: "Low", rec: ["Ophthalmologist review in 3 months", "Strict glycemic control"] },
  3: { micro: "High", hem: "Moderate to High", exu: "Moderate", rec: ["Urgent specialist referral required", "High risk of vision loss"] },
  4: { micro: "Extensive", hem: "Severe", exu: "High", rec: ["IMMEDIATE SPECIALIST INTERVENTION", "Proliferative neovascularization"] }
};

export default function ResultLens({ appState, result, onReset }) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.85);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [invertHeatmap, setInvertHeatmap] = useState(false);

  const lensRef = useRef(null);

  useEffect(() => {
    if (appState === 'RESULT') {
        const pTimeout = setTimeout(() => setProgressValue(result?.confidence || 0), 400); 
        return () => clearTimeout(pTimeout);
    } else {
      setProgressValue(0);
      setIsCompareMode(false);
      setHeatmapOpacity(0.85);
      setShowHeatmap(true);
      setInvertHeatmap(false);
    }
  }, [appState, result]);

  const handleMouseMove = (e) => {
    // Disabled parallax per user request
    return;
  };

  const handleMouseLeave = () => setParallax({ x: 0, y: 0 });

  if (appState !== 'RESULT' || !result) return null;

  const config = SEVERITY[result.class_id] || SEVERITY[0];
  const features = MOCK_FEATURES[result.class_id] || MOCK_FEATURES[0];
  const Icon = config.icon;
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressValue / 100) * circumference;

  const renderLens = (showHeatmapLayer, disableSlider) => (
    <div 
        className="w-full aspect-square relative bg-black border border-slate-700/50 rounded-2xl overflow-hidden"
    >
        {/* Original Base Image */}
        <img 
          src={result.original_image_url} 
          className="absolute inset-0 w-full h-full object-contain" 
          alt="Original" 
        />
        
        {/* Heatmap Layer */}
        {showHeatmapLayer && (
            <img 
              src={result.heatmap_image_url} 
              className="absolute inset-0 w-full h-full object-contain transition-all duration-300"
              style={{ 
                opacity: showHeatmap ? (disableSlider ? 1 : heatmapOpacity) : 0,
                filter: invertHeatmap ? 'invert(1) hue-rotate(180deg)' : 'none',
                mixBlendMode: invertHeatmap ? 'screen' : 'normal'
              }}
              alt="Heatmap" 
            />
        )}
    </div>
  );

  return (
    <div className="w-full h-full flex justify-center absolute inset-0 z-10 overflow-y-auto overflow-x-hidden pt-4 pb-16">
      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-[85rem] px-6 min-h-max">
          
          {/* Main Visualizer Area */}
          <div className="flex-[5] flex flex-col items-center justify-center min-w-[50%] animate-fade-in pt-4">
            
            <div className={`w-full max-w-[800px] flex gap-6 ${isCompareMode ? 'flex-row' : 'flex-col items-center'}`}>
              
              {isCompareMode ? (
                <>
                  <div className="flex-1 flex flex-col items-center gap-3">
                    {renderLens(false, true)}
                    <span className="text-slate-400 text-[10px] sm:text-xs font-mono tracking-[0.2em] uppercase">Original Scan</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-3">
                    {renderLens(true, false)}
                    <span className="text-cyan-400 text-[10px] sm:text-xs font-mono tracking-[0.2em] uppercase drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">Attention Map</span>
                  </div>
                </>
              ) : (
                <div className="w-full max-w-[500px] mx-auto">
                   {renderLens(true, false)}
                </div>
              )}
            </div>

            {/* Heatmap & Settings Controls */}
            <div className="mt-8 flex flex-col items-center w-full max-w-md gap-4 bg-dark-800/80 p-5 rounded-2xl border border-slate-700/50 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <div className="flex w-full justify-between items-center px-2">
                <span className="text-xs text-slate-400 font-mono flex items-center gap-2 tracking-wider">
                  <SlidersHorizontal size={14} /> Heatmap Intensity
                </span>
                <span className="text-xs text-cyan-400 font-mono font-bold">{(heatmapOpacity * 100).toFixed(0)}%</span>
              </div>
              
              <input 
                type="range" 
                min="0" max="1" step="0.01" 
                value={heatmapOpacity} 
                onChange={(e) => {setHeatmapOpacity(Number(e.target.value)); setShowHeatmap(true);}}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
                disabled={!showHeatmap}
              />
              
              <div className="flex gap-3 w-full mt-2">
                <button 
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`flex-1 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest border transition-all ${
                    showHeatmap ? 'bg-cyan-900/40 border-cyan-500/50 text-cyan-300 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]' : 'bg-dark-900 border-slate-700 text-slate-500'
                  }`}
                >
                  {showHeatmap ? 'Heatmap ON' : 'Heatmap OFF'}
                </button>
                <button 
                  onClick={() => { setIsCompareMode(!isCompareMode); setParallax({x:0,y:0}); }}
                  className={`flex-1 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest border transition-all flex justify-center items-center gap-2 ${
                    isCompareMode ? 'bg-blue-900/40 border-blue-500/50 text-blue-300 shadow-[inset_0_0_10px_rgba(59,130,246,0.2)]' : 'bg-dark-900 border-slate-700 text-slate-500'
                  }`}
                >
                  <LayoutTemplate size={14} /> Compare
                </button>
                <button 
                  onClick={() => setInvertHeatmap(!invertHeatmap)}
                  className={`flex-[0.8] py-2.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest border transition-all ${
                    invertHeatmap ? 'bg-purple-900/40 border-purple-500/50 text-purple-300 shadow-[inset_0_0_10px_rgba(168,85,247,0.2)]' : 'bg-dark-900 border-slate-700 text-slate-500'
                  }`}
                  disabled={!showHeatmap}
                >
                  Invert
                </button>
              </div>

              {/* Semantic Disclaimer */}
              <div className="w-full mt-1 p-2.5 rounded-lg bg-emerald-900/10 border border-emerald-500/20 flex items-start gap-2.5">
                 <AlertTriangle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                 <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                   <span className="text-emerald-500 font-bold uppercase tracking-wider">Clinical Note:</span> Attention map shows model focus regions, not exact pathology location. For advanced DR, high pathology regions may appear in non-hot zones. Use <span className="text-purple-400 border border-purple-800 bg-purple-900/30 px-1 rounded">INVERT</span> to check alternative color mappings.
                 </p>
              </div>
            </div>

          </div>

          {/* Right Data Panel - slides in from right */}
          <div className="flex-[3] shrink-0 flex flex-col justify-center animate-slide-in-right pt-4 lg:pt-0">
            <div className={`p-8 rounded-[2rem] backdrop-blur-xl border border-slate-700/60 bg-dark-800/90 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col h-full md:h-auto`}>
               {/* Edge highlight line */}
               <div className={`absolute top-0 left-0 w-1.5 h-full ${config.bg} ${config.border} border-l-4 shadow-[0_0_20px_currentColor]`}></div>
               
               <p className="text-slate-400 font-mono text-xs tracking-[0.2em] uppercase mb-4">Final Diagnosis</p>
               
               <div className="flex flex-col gap-2 mb-6">
                 <div className="flex items-center gap-4">
                   <div className={`p-3 rounded-full bg-dark-900 border border-slate-700 ${config.color} shadow-[0_0_20px_currentColor]`}>
                     <Icon size={32} />
                   </div>
                   <h2 className={`text-3xl font-extrabold tracking-tight ${config.color} leading-none drop-shadow-[0_0_8px_currentColor]`}>
                     {config.label}
                   </h2>
                 </div>
               </div>





               {/* Recommendation Mock */}
               <div className="flex-1 mb-6">
                 <p className="text-slate-400 font-mono text-[10px] sm:text-xs tracking-[0.2em] uppercase mb-4 border-b border-slate-700/50 pb-2">Recommendation</p>
                 <ul className="list-disc list-outside ml-4 space-y-2">
                   {features.rec.map((r, i) => (
                     <li key={i} className="text-slate-300 text-sm leading-relaxed tracking-wide">{r}</li>
                   ))}
                 </ul>
               </div>

               <button 
                  onClick={onReset} 
                  className="w-full py-4 sm:py-5 uppercase tracking-widest text-sm font-bold text-black bg-neon-cyan hover:bg-cyan-300 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)] hover:shadow-[0_0_40px_0px_rgba(6,182,212,0.8)] hover:-translate-y-1"
               >
                  Initiate New Scan
               </button>
            </div>
          </div>
      </div>
    </div>
  );
}
