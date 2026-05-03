import React from 'react';
import { ShieldAlert, Activity, CheckCircle, AlertTriangle } from 'lucide-react';

const SEVERITY_CONFIG = {
  0: { label: "No DR (Healthy)", color: "text-emerald-400", bg: "bg-emerald-900/30", border: "border-emerald-500/50", bar: "bg-emerald-400", icon: CheckCircle },
  1: { label: "Mild NPDR", color: "text-yellow-400", bg: "bg-yellow-900/30", border: "border-yellow-500/50", bar: "bg-yellow-400", icon: Activity },
  2: { label: "Moderate NPDR", color: "text-orange-400", bg: "bg-orange-900/30", border: "border-orange-500/50", bar: "bg-orange-400", icon: AlertTriangle },
  3: { label: "Severe NPDR", color: "text-red-500", bg: "bg-red-900/30", border: "border-red-500/50", bar: "bg-red-500", icon: ShieldAlert },
  4: { label: "Proliferative DR", color: "text-red-600", bg: "bg-red-900/50", border: "border-red-600/50", bar: "bg-red-600", icon: ShieldAlert }
};

export default function DiagnosticResults({ result, isProcessing }) {
  if (isProcessing) {
    return (
      <div className="w-full max-w-5xl mx-auto mt-8 p-12 rounded-2xl bg-slate-800/50 border border-slate-700 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-6"></div>
        <h3 className="text-xl font-semibold text-white mb-2">Analyzing Scan</h3>
        <p className="text-slate-400 text-center max-w-sm">
          Running Vision Transformer inference and generating Grad-CAM interpretability heatmaps...
        </p>
      </div>
    );
  }

  if (!result) return null;

  const config = SEVERITY_CONFIG[result.class_id] || SEVERITY_CONFIG[0];
  const Icon = config.icon;

  return (
    <div className="w-full max-w-5xl mx-auto mt-8 animate-fade-in">
      <div className={`p-6 rounded-2xl border ${config.border} ${config.bg} mb-8 flex flex-col md:flex-row items-center justify-between gap-6`}>
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-full bg-slate-900 ${config.color}`}>
            <Icon size={32} />
          </div>
          <div>
            <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-1">AI Diagnosis</p>
            <h2 className={`text-3xl font-bold ${config.color}`}>{config.label}</h2>
          </div>
        </div>
        
        <div className="w-full md:w-1/3 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium text-slate-300">Confidence Score</span>
            <span className={`text-lg font-bold ${config.color}`}>{result.confidence}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3">
            <div className={`h-3 rounded-full ${config.bar} transition-all duration-1000 ease-out`} style={{ width: `${result.confidence}%` }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 flex flex-col shadow-xl">
          <div className="p-4 border-b border-slate-700 bg-slate-800/80 backdrop-blur">
            <h3 className="font-semibold text-white">Original Fundus Scan</h3>
            <p className="text-sm text-slate-400">Preprocessed (Cropped & CLAHE contrast applied)</p>
          </div>
          <div className="p-6 flex-1 flex items-center justify-center bg-slate-900/50">
            <img src={result.original_image_url} alt="Original Preprocessed" className="rounded-lg shadow-2xl max-h-[400px] object-contain border border-slate-700/50" />
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 flex flex-col shadow-xl">
          <div className="p-4 border-b border-slate-700 bg-slate-800/80 backdrop-blur">
            <h3 className="font-semibold text-white">Grad-CAM Explanation</h3>
            <p className="text-sm text-slate-400">Heatmap highlights pathological regions (microaneurysms, hemorrhages)</p>
          </div>
          <div className="p-6 flex-1 flex items-center justify-center bg-slate-900/50">
            <img src={result.heatmap_image_url} alt="Grad-CAM Heatmap" className="rounded-lg shadow-2xl max-h-[400px] object-contain border border-slate-700/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
