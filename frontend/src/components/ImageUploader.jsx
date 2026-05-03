import React, { useState, useRef } from 'react';
import { UploadCloud, FileImage, X } from 'lucide-react';

export default function ImageUploader({ onImageUpload, isProcessing }) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    
    const url = URL.createObjectURL(file);
    setPreview(url);
    onImageUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    if(inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 relative">
      <form 
        onDragEnter={handleDrag} 
        onSubmit={(e) => e.preventDefault()}
        className={`relative flex flex-col items-center justify-center w-full h-80 rounded-2xl border-2 border-dashed transition-all duration-200 ease-in-out ${
          dragActive ? "border-blue-400 bg-blue-900/20" : "border-slate-600 bg-slate-800/50 hover:bg-slate-800"
        } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input 
          ref={inputRef}
          type="file" 
          className="hidden" 
          accept="image/png, image/jpeg, image/jpg" 
          onChange={handleChange} 
        />
        
        {preview ? (
          <div className="relative w-full h-full p-4 flex flex-col items-center justify-center">
             <button 
                onClick={(e) => { e.stopPropagation(); clearPreview(); }}
                className="absolute top-4 right-4 p-2 bg-slate-900/80 rounded-full text-white hover:bg-red-500 transition-colors z-10"
              >
                <X size={20} />
              </button>
             <img src={preview} alt="Upload preview" className="max-h-full rounded-lg object-contain" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-300 pointer-events-none">
            <UploadCloud size={64} className={`mb-4 ${dragActive ? 'text-blue-400' : 'text-slate-400'}`} />
            <p className="mb-2 text-lg font-medium">
              <span className="text-blue-400 font-semibold pointer-events-auto cursor-pointer hover:underline" onClick={() => inputRef.current?.click()}>Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-slate-500">Fundus Scan (JPEG, PNG, JPG)</p>
          </div>
        )}

        {dragActive && !preview && (
          <div 
            className="absolute inset-0 w-full h-full" 
            onDragEnter={handleDrag} 
            onDragLeave={handleDrag} 
            onDragOver={handleDrag} 
            onDrop={handleDrop} 
          />
        )}
      </form>
    </div>
  );
}
