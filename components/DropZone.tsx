import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
}

const DropZone: React.FC<DropZoneProps> = ({ onFileSelected }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndPassFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndPassFile(e.target.files[0]);
    }
  };

  const validateAndPassFile = (file: File) => {
    if (file.type === 'application/pdf') {
      onFileSelected(file);
    } else {
      alert('Please upload a valid PDF file.');
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        w-full h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300
        ${isDragOver 
          ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' 
          : 'border-slate-600 hover:border-blue-400 hover:bg-slate-800/50 bg-slate-800/30'}
      `}
    >
      <input
        type="file"
        ref={inputRef}
        onChange={handleInputChange}
        accept="application/pdf"
        className="hidden"
      />
      
      <div className="flex flex-col items-center space-y-4 text-center p-6">
        <div className={`p-4 rounded-full ${isDragOver ? 'bg-blue-500/20' : 'bg-slate-700/50'}`}>
          <Upload className={`w-8 h-8 ${isDragOver ? 'text-blue-400' : 'text-slate-400'}`} />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-medium text-slate-200">
            Click to upload or drag and drop
          </p>
          <p className="text-sm text-slate-400">
            NotebookLM PDF Slides (PPT)
          </p>
        </div>
        <div className="flex items-center text-xs text-slate-500 gap-2">
          <FileText className="w-3 h-3" />
          <span>Maximum file size: 50MB</span>
        </div>
      </div>
    </div>
  );
};

export default DropZone;
