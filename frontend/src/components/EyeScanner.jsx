import React, { useState, useRef, useEffect } from 'react';
import { Upload, ScanLine } from 'lucide-react';

export default function EyeScanner({ appState, onImageUpload }) {
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  // Pupil Parallax Tracking
  useEffect(() => {
    if (appState !== 'UPLOAD') return;

    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      const x = ((e.clientX / innerWidth) - 0.5) * 20; // max offset 20px
      const y = ((e.clientY / innerHeight) - 0.5) * 20;
      setPupilOffset({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [appState]);

  // Drag logic
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (appState !== 'UPLOAD') return;
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (appState !== 'UPLOAD') return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };
  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };
  const processFile = (file) => {
    if (file && file.type.startsWith('image/')) onImageUpload(file);
  };

  const isScanning = appState === 'SCANNING';
  const isZoomed = appState !== 'UPLOAD'; // zooms into the eye on SCANNING & RESULT

  return (
    <div className="relative flex flex-col items-center justify-center w-full gap-10">
      
      {/* Container that scales/zooms upon state change */}
      <div className={`relative flex items-center justify-center transition-all duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          isZoomed ? "scale-[1.8] opacity-5 md:scale-[2.5]" : "scale-100"
        }`}
      >
        {/* Core Eye Graphic */}
        <div className="relative animate-float-hud group">
          <svg width="340" height="180" viewBox="0 0 340 180" className="animate-blink-eye overflow-visible">
            {/* Sclera (White part) - Glass UI */}
            <path d="M 0 90 Q 170 -20 340 90 Q 170 200 0 90 Z" fill="rgba(15, 23, 42, 0.4)" stroke="rgba(6, 182, 212, 0.5)" strokeWidth="2" />
            
            {/* Iris & Pupil Group with Tracking Offset */}
            <g style={{ transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`, transition: 'transform 0.1s ease-out' }}>
              {/* Iris Glow */}
              <circle cx="170" cy="90" r="55" fill="rgba(6, 182, 212, 0.1)" filter="blur(8px)" />
              {/* Iris */}
              <circle cx="170" cy="90" r="45" fill="none" stroke="rgba(6, 182, 212, 0.8)" strokeWidth="4" />
              {/* Inner detail rings */}
              <circle cx="170" cy="90" r="35" fill="none" stroke="rgba(59, 130, 246, 0.5)" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx="170" cy="90" r="28" fill="none" stroke="rgba(139, 92, 246, 0.6)" strokeWidth="2" strokeDasharray="10 5" />
              {/* Pupil */}
              <circle cx="170" cy="90" r="15" fill="#06b6d4" className="animate-pulse-glow" />
              {/* Lens Glare */}
              <ellipse cx="155" cy="75" rx="8" ry="4" fill="rgba(255,255,255,0.8)" transform="rotate(-30 155 75)" />
            </g>
          </svg>

          {/* Biometric Scan Overlay Rules (Shown only in Scanning state) */}
          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center animate-fade-in pointer-events-none">
              {/* Rotating HUD Rings */}
              <div className="absolute w-[200px] h-[200px] rounded-full border border-cyan-500/30 border-t-cyan-400 animate-spin-slow"></div>
              <div className="absolute w-[240px] h-[240px] rounded-full border border-blue-500/20 border-b-blue-400 animate-spin-reverse-slow"></div>
              
              {/* Scanning Laser */}
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: 'path("M 0 90 Q 170 -20 340 90 Q 170 200 0 90 Z")' }}>
                 <div className="absolute w-full h-[2px] bg-cyan-400 shadow-[0_0_15px_3px_rgba(6,182,212,0.8)] animate-scanline"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Box Container (Only visible during UPLOAD) */}
      <div 
        className={`w-full max-w-md transition-all duration-700 ${
          appState === 'UPLOAD' ? 'opacity-100 translate-y-0' : 'absolute opacity-0 translate-y-10 pointer-events-none'
        }`}
      >
        <form 
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          className={`relative p-6 rounded-2xl backdrop-blur-md bg-slate-900/60 border-2 overflow-hidden transition-colors ${
            dragActive ? "border-cyan-400/80 shadow-[0_0_30px_rgba(6,182,212,0.3)]" : "border-slate-700/50 hover:border-cyan-500/40"
          }`}
        >
          <input ref={inputRef} type="file" className="hidden" accept="image/png, image/jpeg, image/jpg" onChange={handleChange} />
          
          <div className="flex flex-col items-center justify-center text-center gap-3">
             <div className="p-3 bg-cyan-500/10 rounded-full text-cyan-400">
               <Upload size={28} />
             </div>
             <div>
               <p className="text-slate-200 font-medium tracking-wide">
                 <span className="text-cyan-400 cursor-pointer hover:underline" onClick={() => inputRef.current?.click()}>Upload Fundus Scan</span> or drag here
               </p>
               <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">JPEG, PNG Max 10MB</p>
             </div>
          </div>
        </form>
      </div>

      {/* Scanning Status Text (Only visible during SCANNING) */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-700 delay-300 ${
        isScanning ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
      }`}>
         <ScanLine size={48} className="text-cyan-400 animate-pulse mb-6" />
         <h2 className="text-3xl font-bold text-white tracking-widest uppercase mb-2 drop-shadow-lg">Analyzing Retina</h2>
         <div className="flex gap-2 items-center">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
            <p className="text-cyan-200 uppercase tracking-widest text-sm font-semibold">AI Model Processing</p>
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse [animation-delay:200ms]"></div>
         </div>
      </div>

    </div>
  );
}
