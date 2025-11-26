
import React from 'react';
import { CropMargins, EditMode, Mask, MaskFillType } from '../types';
import { AlignVerticalSpaceAround, AlignHorizontalSpaceAround, MonitorX, Sparkles, Loader2, Eraser, Scissors, Trash2, Edit3, Pipette, ArrowDownFromLine, ArrowUpFromLine, ArrowLeftFromLine, ArrowRightFromLine, Globe, File } from 'lucide-react';

interface CropControlsProps {
  margins: CropMargins;
  onChangeMargins: (newMargins: CropMargins) => void;
  onAutoDetect: () => void;
  isAutoDetecting: boolean;
  mode: EditMode;
  onModeChange: (mode: EditMode) => void;
  masks: Mask[];
  selectedMaskId?: string | null;
  onUpdateMask?: (mask: Mask) => void;
  onDeleteMask?: (id: string) => void;
  onSelectMask?: (id: string) => void;
  currentPage?: number;
}

const CropControls: React.FC<CropControlsProps> = ({ 
    margins, 
    onChangeMargins, 
    onAutoDetect, 
    isAutoDetecting, 
    mode, 
    onModeChange,
    masks,
    selectedMaskId,
    onUpdateMask,
    onDeleteMask,
    onSelectMask,
    currentPage = 1
}) => {
  const handleChange = (key: keyof CropMargins, value: number) => {
    let safeValue = value;
    if (key === 'top' && value + margins.bottom > 90) safeValue = 90 - margins.bottom;
    if (key === 'bottom' && value + margins.top > 90) safeValue = 90 - margins.top;
    if (key === 'left' && value + margins.right > 90) safeValue = 90 - margins.right;
    if (key === 'right' && value + margins.left > 90) safeValue = 90 - margins.left;

    onChangeMargins({ ...margins, [key]: safeValue });
  };

  const Slider = ({ 
    label, 
    value, 
    axis 
  }: { 
    label: keyof CropMargins; 
    value: number; 
    axis: 'Vertical' | 'Horizontal' 
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="capitalize text-slate-300 font-medium flex items-center gap-2">
            {label}
        </span>
        <span className="text-blue-400 font-mono bg-blue-400/10 px-2 py-0.5 rounded text-xs">{value.toFixed(1)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="45"
        step="0.5"
        value={value}
        onChange={(e) => handleChange(label, parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
      />
    </div>
  );

  const selectedMask = masks.find(m => m.id === selectedMaskId);

  const handleMaskChange = (key: keyof Mask, value: any) => {
      if (!selectedMask || !onUpdateMask) return;
      const updates: Partial<Mask> = { [key]: value };
      if (key === 'fillType') {
          updates.imageSnapshot = undefined; 
      }
      onUpdateMask({ ...selectedMask, ...updates });
  };

  const toggleMaskScope = () => {
      if (!selectedMask || !onUpdateMask) return;
      // If currently page-specific (defined), switch to global (undefined)
      // If currently global (undefined), switch to current page
      const newPageIndex = selectedMask.pageIndex !== undefined ? undefined : (currentPage - 1);
      onUpdateMask({ ...selectedMask, pageIndex: newPageIndex });
  };

  const getFillTypeIcon = (type: MaskFillType) => {
      switch (type) {
          case 'solid': return <Pipette className="w-4 h-4" />;
          case 'clone-top': return <ArrowDownFromLine className="w-4 h-4" />;
          case 'clone-bottom': return <ArrowUpFromLine className="w-4 h-4" />;
          case 'clone-left': return <ArrowRightFromLine className="w-4 h-4" />;
          case 'clone-right': return <ArrowLeftFromLine className="w-4 h-4" />;
      }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
        
        {/* Mode Toggles */}
        <div className="flex p-1 bg-slate-900 rounded-lg">
            <button
                onClick={() => onModeChange('MASK')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                    mode === 'MASK' 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
            >
                <Eraser className="w-4 h-4" /> Patch
            </button>
            <button
                onClick={() => onModeChange('CROP')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                    mode === 'CROP' 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
            >
                <Scissors className="w-4 h-4" /> Crop
            </button>
        </div>

        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <div className="flex items-center gap-2">
                {mode === 'MASK' ? (
                    <Eraser className="w-5 h-5 text-blue-400" />
                ) : (
                    <MonitorX className="w-5 h-5 text-blue-400" />
                )}
                <h3 className="font-semibold text-white">
                    {mode === 'MASK' ? 'Settings' : 'Crop'}
                </h3>
            </div>
            
            <button
                onClick={onAutoDetect}
                disabled={isAutoDetecting}
                className="flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white px-3 py-1.5 rounded-full transition-all border border-indigo-500/50 shadow-sm hover:shadow-indigo-500/20"
            >
                {isAutoDetecting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                    <Sparkles className="w-3 h-3" />
                )}
                Auto {mode === 'MASK' ? `(Page ${currentPage})` : ''}
            </button>
        </div>

      {mode === 'CROP' ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 animate-fade-in">
            <div className="col-span-2 space-y-6">
                <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">
                    <AlignVerticalSpaceAround className="w-4 h-4" /> Vertical
                </div>
                <Slider label="top" value={margins.top} axis="Vertical" />
                <Slider label="bottom" value={margins.bottom} axis="Vertical" />
            </div>

            <div className="col-span-2 space-y-6">
                <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">
                    <AlignHorizontalSpaceAround className="w-4 h-4" /> Horizontal
                </div>
                <Slider label="left" value={margins.left} axis="Horizontal" />
                <Slider label="right" value={margins.right} axis="Horizontal" />
            </div>
          </div>
      ) : (
          <div className="space-y-4 animate-fade-in">
              
              {/* Active Mask Editor */}
              {selectedMask ? (
                  <div className="bg-slate-700/50 p-4 rounded-lg border border-indigo-500/30 space-y-4">
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-indigo-300 uppercase flex items-center gap-1">
                              <Edit3 className="w-3 h-3" /> Selected Patch
                          </span>
                          <button 
                             onClick={() => onDeleteMask?.(selectedMask.id)}
                             className="text-red-400 hover:text-red-300 p-1 hover:bg-red-400/10 rounded"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                           {/* Scope Toggle */}
                           <div className="col-span-2">
                               <button 
                                   onClick={toggleMaskScope}
                                   className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium border transition-colors ${
                                       selectedMask.pageIndex === undefined 
                                       ? 'bg-blue-600/20 border-blue-500/50 text-blue-200 hover:bg-blue-600/30' 
                                       : 'bg-emerald-600/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-600/30'
                                   }`}
                               >
                                   <div className="flex items-center gap-2">
                                       {selectedMask.pageIndex === undefined ? <Globe className="w-4 h-4"/> : <File className="w-4 h-4"/>}
                                       <span>{selectedMask.pageIndex === undefined ? "Applied to All Pages" : `Page ${selectedMask.pageIndex + 1} Only`}</span>
                                   </div>
                                   <div className="text-[10px] uppercase opacity-70">Click to Change</div>
                               </button>
                           </div>

                           <div className="col-span-2">
                               <label className="text-[10px] text-slate-400 uppercase mb-1 block">Fill Style</label>
                               <div className="grid grid-cols-1 gap-2">
                                    <select
                                        value={selectedMask.fillType}
                                        onChange={(e) => handleMaskChange('fillType', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                                    >
                                        <option value="solid">Solid Color</option>
                                        <option value="clone-top">Extend Top</option>
                                        <option value="clone-bottom">Extend Bottom</option>
                                        <option value="clone-left">Extend Left</option>
                                        <option value="clone-right">Extend Right</option>
                                    </select>
                               </div>
                           </div>

                           {selectedMask.fillType === 'solid' && (
                                <div className="col-span-2">
                                    <label className="text-[10px] text-slate-400 uppercase">Fill Color</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="color" 
                                            value={selectedMask.color}
                                            onChange={(e) => handleMaskChange('color', e.target.value)}
                                            className="h-8 w-8 bg-transparent border-0 cursor-pointer rounded overflow-hidden p-0"
                                        />
                                        <input 
                                            type="text" 
                                            value={selectedMask.color}
                                            onChange={(e) => handleMaskChange('color', e.target.value)}
                                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white uppercase font-mono"
                                        />
                                    </div>
                                </div>
                           )}

                           <div className="col-span-2 border-t border-slate-600/50 my-1"></div>

                           <div>
                               <label className="text-[10px] text-slate-400 uppercase">X (%)</label>
                               <input 
                                  type="number" step="0.1" 
                                  value={selectedMask.x}
                                  onChange={(e) => handleMaskChange('x', parseFloat(e.target.value))}
                                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                               />
                           </div>
                           <div>
                               <label className="text-[10px] text-slate-400 uppercase">Y (%)</label>
                               <input 
                                  type="number" step="0.1" 
                                  value={selectedMask.y}
                                  onChange={(e) => handleMaskChange('y', parseFloat(e.target.value))}
                                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                               />
                           </div>
                           <div>
                               <label className="text-[10px] text-slate-400 uppercase">W (%)</label>
                               <input 
                                  type="number" step="0.1" 
                                  value={selectedMask.width}
                                  onChange={(e) => handleMaskChange('width', parseFloat(e.target.value))}
                                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                               />
                           </div>
                           <div>
                               <label className="text-[10px] text-slate-400 uppercase">H (%)</label>
                               <input 
                                  type="number" step="0.1" 
                                  value={selectedMask.height}
                                  onChange={(e) => handleMaskChange('height', parseFloat(e.target.value))}
                                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                               />
                           </div>
                      </div>
                  </div>
              ) : (
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 text-center text-sm text-slate-500 italic">
                      Click/Drag on preview to mask.
                  </div>
              )}

              {/* Mask List */}
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300 font-medium">Patches</span>
                    <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">{masks.length}</span>
                </div>
                
                {masks.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm italic">
                        No active patches.
                    </div>
                ) : (
                    <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {masks.map((mask, i) => (
                            <li 
                                key={mask.id} 
                                onClick={() => onSelectMask?.(mask.id)}
                                className={`flex items-center gap-3 text-xs p-2 rounded cursor-pointer transition-colors ${selectedMaskId === mask.id ? 'bg-indigo-600/20 border border-indigo-500/50 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >
                                <div 
                                    className="w-4 h-4 rounded border border-slate-600 shadow-sm flex items-center justify-center overflow-hidden" 
                                    style={{ backgroundColor: mask.fillType === 'solid' ? mask.color : '#334155' }}
                                >
                                    {mask.fillType !== 'solid' && getFillTypeIcon(mask.fillType)}
                                </div>
                                <div className="flex flex-col">
                                    <span>Patch {i + 1}</span>
                                    {mask.pageIndex !== undefined && (
                                        <span className="text-[9px] text-slate-500">Page {mask.pageIndex + 1}</span>
                                    )}
                                </div>
                                {selectedMaskId === mask.id && <span className="ml-auto text-indigo-400"><Edit3 className="w-3 h-3"/></span>}
                            </li>
                        ))}
                    </ul>
                )}
              </div>
          </div>
      )}
    </div>
  );
};

export default CropControls;
