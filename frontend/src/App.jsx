import React, { useState } from 'react';
import axios from 'axios';
import { Network } from 'lucide-react';
import EyeScanner from './components/EyeScanner';
import ResultLens from './components/ResultLens';

export default function App() {
  const [appState, setAppState] = useState('UPLOAD'); // 'UPLOAD', 'SCANNING', 'RESULT'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleImageUpload = async (file) => {
    setAppState('SCANNING');
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    const minimumDelay = new Promise(resolve => setTimeout(resolve, 2800)); 
    
    let backendResult = null;
    let hasError = false;

    try {
      const response = await axios.post('http://localhost:8000/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      backendResult = response.data;
    } catch (err) {
      if(err.response) setError(err.response.data?.detail || "Server error");
      else setError("Could not connect to AI Engine. Ensure fastapi is running!");
      hasError = true;
    }

    await minimumDelay;

    if (!hasError && backendResult) {
       setResult(backendResult);
       setAppState('RESULT');
    } else {
       setAppState('UPLOAD'); 
    }
  };

  return (
    <div className={`w-full h-screen overflow-hidden transition-colors duration-1000 ${appState !== 'UPLOAD' ? 'bg-black pointer-events-none' : 'bg-dark-900'} relative`}>
      {/* Background with Particles & Grid */}
      <div className="cyber-bg" />
      <div className="particle-layer" />
      
      {/* Top Navbar */}
      <nav className="absolute top-0 w-full z-[100] px-6 py-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-center gap-3">
          <Network className="text-neon-cyan drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]" size={32} />
          <span className="font-bold text-2xl tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            Retina<span className="text-neon-cyan">AI</span>
          </span>
        </div>
        <div className="text-[10px] md:text-sm font-mono text-neon-cyan uppercase tracking-[0.3em] font-light">
          Ai Diagnostics Core
        </div>
      </nav>

      <main className="relative w-full h-full flex flex-col items-center pt-[80px]">
        
        {/* Dynamic Header Titles */}
        <div className={`w-full flex flex-col items-center justify-center transition-all duration-1000 z-50 ${
          appState === 'RESULT' ? 'h-0 opacity-0 -translate-y-10 scale-90 overflow-hidden' : 'opacity-100 translate-y-0 scale-100 mb-6'
        }`}>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-xl mb-3 text-center">
            Diabetic Retinopathy Detection
          </h1>
          <p className="text-sm md:text-lg text-slate-400 font-light tracking-wide text-center">
            AI-powered retinal analysis with real-time heatmap visualization
          </p>
        </div>

        {/* The Eye Layout - Flex Centered */}
        <div className={`w-full flex-1 flex flex-col items-center justify-center pb-[10vh] transition-all duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
           appState === 'RESULT' ? 'absolute opacity-0 scale-50 -translate-y-[20vh] blur-md pointer-events-none' : 'relative opacity-100 scale-100 translate-y-0 blur-0'
        }`}>
           <EyeScanner appState={appState} onImageUpload={handleImageUpload} />
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 px-6 py-4 bg-red-900/80 border border-neon-red rounded-lg text-white font-mono animate-fade-in drop-shadow-2xl backdrop-blur-md">
             [ERROR]: {error}
          </div>
        )}

        {/* The Results View */}
        <div className={`absolute inset-0 pt-[80px] transition-all duration-1000 ${
          appState === 'RESULT' ? 'opacity-100 pointer-events-auto z-40' : 'opacity-0 pointer-events-none z-0'
        }`}>
            <ResultLens appState={appState} result={result} onReset={() => setAppState('UPLOAD')} />
        </div>
      </main>
    </div>
  );
}
