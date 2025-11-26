
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CropMargins, Mask, EditMode } from '../types';
import { renderPageToCanvas } from '../services/pdfService';
import { Loader2, Maximize2, Minimize2, Move, ChevronLeft, ChevronRight } from 'lucide-react';

interface PdfPreviewProps {
  fileData: ArrayBuffer | null;
  margins: CropMargins;
  masks: Mask[];
  mode: EditMode;
  onAddMask?: (mask: Mask) => void;
  selectedMaskId?: string | null;
  onSelectMask?: (id: string | null) => void;
  onUpdateMask?: (mask: Mask) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
}

type InteractionState = 'IDLE' | 'DRAWING' | 'DRAGGING' | 'RESIZING';
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const PdfPreview: React.FC<PdfPreviewProps> = ({ 
    fileData, 
    margins, 
    masks, 
    mode, 
    onAddMask, 
    selectedMaskId,
    onSelectMask,
    onUpdateMask,
    isFullscreen,
    onToggleFullscreen,
    currentPage,
    numPages,
    onPageChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0);
  
  // Interaction State
  const [interactionState, setInteractionState] = useState<InteractionState>('IDLE');
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  
  // Coordinates for operations
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);
  const [currentPos, setCurrentPos] = useState<{x: number, y: number} | null>(null);
  
  // Cache original mask values during drag/resize to prevent drift
  const [initialMaskState, setInitialMaskState] = useState<Mask | null>(null);

  useEffect(() => {
    const render = async () => {
      if (!fileData || !canvasRef.current) return;
      
      setLoading(true);
      try {
        await renderPageToCanvas(fileData, currentPage, canvasRef.current);
        setRenderTrigger(prev => prev + 1);
      } catch (error) {
        console.error("Render error", error);
      } finally {
        setLoading(false);
      }
    };

    render();
  }, [fileData, isFullscreen, currentPage]); 

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  };

  const getDominantColor = (rect: {x: number, y: number, w: number, h: number}) => {
      if (!canvasRef.current || !containerRef.current) return '#FFFFFF';
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return '#FFFFFF';
      
      const displayW = containerRef.current.clientWidth;
      const displayH = containerRef.current.clientHeight;
      const scaleX = canvasRef.current.width / displayW;
      const scaleY = canvasRef.current.height / displayH;

      try {
          const x = Math.floor(Math.max(0, rect.x * scaleX));
          const y = Math.floor(Math.max(0, rect.y * scaleY));
          
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          return rgbToHex(pixel[0], pixel[1], pixel[2]);
      } catch (e) {
          return '#FFFFFF';
      }
  };

  const captureMaskSnapshot = useCallback((mask: Mask) => {
      if (!canvasRef.current || mask.fillType === 'solid') return null;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return null;

      const canvasW = canvasRef.current.width;
      const canvasH = canvasRef.current.height;
      const x = (mask.x / 100) * canvasW;
      const y = (mask.y / 100) * canvasH;
      const w = (mask.width / 100) * canvasW;
      const h = (mask.height / 100) * canvasH;

      try {
          let imageData: ImageData;
          let tempW = 0, tempH = 0;

          switch (mask.fillType) {
              case 'clone-top':
                  tempW = Math.max(1, w); tempH = 1;
                  imageData = ctx.getImageData(x, Math.max(0, y - 1), tempW, tempH);
                  break;
              case 'clone-bottom':
                  tempW = Math.max(1, w); tempH = 1;
                  imageData = ctx.getImageData(x, Math.min(canvasH - 1, y + h), tempW, tempH);
                  break;
              case 'clone-left':
                  tempW = 1; tempH = Math.max(1, h);
                  imageData = ctx.getImageData(Math.max(0, x - 1), y, tempW, tempH);
                  break;
              case 'clone-right':
                  tempW = 1; tempH = Math.max(1, h);
                  imageData = ctx.getImageData(Math.min(canvasW - 1, x + w), y, tempW, tempH);
                  break;
              default: return null;
          }

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = tempW; tempCanvas.height = tempH;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
              tempCtx.putImageData(imageData, 0, 0);
              return tempCanvas.toDataURL('image/png');
          }
      } catch (e) {
          console.error("Failed to capture snapshot", e);
      }
      return null;
  }, []);

  useEffect(() => {
    if (!onUpdateMask || loading) return;
    
    // Only update masks that are visible and need a snapshot
    const visibleMasks = masks.filter(m => m.pageIndex === undefined || m.pageIndex === currentPage - 1);
    
    visibleMasks.forEach(mask => {
        if (mask.fillType !== 'solid' && !mask.imageSnapshot) {
            const snapshot = captureMaskSnapshot(mask);
            if (snapshot) onUpdateMask({ ...mask, imageSnapshot: snapshot });
        }
    });
  }, [masks, loading, captureMaskSnapshot, onUpdateMask, renderTrigger, currentPage]);


  // --- Event Handlers ---

  const getRelativeCoords = (e: React.MouseEvent | MouseEvent) => {
      if (!containerRef.current) return { x: 0, y: 0, width: 0, height: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          width: rect.width,
          height: rect.height
      };
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
      if (mode !== 'MASK' || !containerRef.current || interactionState !== 'IDLE') return;
      
      e.preventDefault();
      onSelectMask?.(null); // Deselect any existing mask
      
      const coords = getRelativeCoords(e);
      setStartPos({ x: coords.x, y: coords.y });
      setCurrentPos({ x: coords.x, y: coords.y });
      setInteractionState('DRAWING');
  };

  const handleMaskMouseDown = (e: React.MouseEvent, mask: Mask) => {
      e.stopPropagation(); 
      e.preventDefault();
      
      onSelectMask?.(mask.id);
      setInitialMaskState({...mask});
      
      const coords = getRelativeCoords(e);
      setStartPos({ x: coords.x, y: coords.y });
      setInteractionState('DRAGGING');
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: ResizeHandle, mask: Mask) => {
      e.stopPropagation();
      e.preventDefault();
      
      setInitialMaskState({...mask});
      setActiveHandle(handle);
      
      const coords = getRelativeCoords(e);
      setStartPos({ x: coords.x, y: coords.y });
      setInteractionState('RESIZING');
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
      if (interactionState === 'IDLE' || !containerRef.current) return;
      
      const coords = getRelativeCoords(e);
      setCurrentPos({ x: coords.x, y: coords.y });

      if (interactionState === 'DRAGGING' && initialMaskState && onUpdateMask) {
          if (!startPos) return;
          
          const dxPct = ((coords.x - startPos.x) / coords.width) * 100;
          const dyPct = ((coords.y - startPos.y) / coords.height) * 100;

          onUpdateMask({
              ...initialMaskState,
              x: initialMaskState.x + dxPct,
              y: initialMaskState.y + dyPct,
              imageSnapshot: undefined 
          });
      }

      if (interactionState === 'RESIZING' && initialMaskState && activeHandle && onUpdateMask) {
          if (!startPos) return;

          const dxPct = ((coords.x - startPos.x) / coords.width) * 100;
          const dyPct = ((coords.y - startPos.y) / coords.height) * 100;

          let newX = initialMaskState.x;
          let newY = initialMaskState.y;
          let newW = initialMaskState.width;
          let newH = initialMaskState.height;

          // Calculate new dimensions based on handle
          if (activeHandle.includes('e')) newW = Math.max(0.5, initialMaskState.width + dxPct);
          if (activeHandle.includes('s')) newH = Math.max(0.5, initialMaskState.height + dyPct);
          if (activeHandle.includes('w')) {
              const proposedW = initialMaskState.width - dxPct;
              if (proposedW > 0.5) {
                  newX = initialMaskState.x + dxPct;
                  newW = proposedW;
              }
          }
          if (activeHandle.includes('n')) {
              const proposedH = initialMaskState.height - dyPct;
              if (proposedH > 0.5) {
                  newY = initialMaskState.y + dyPct;
                  newH = proposedH;
              }
          }

          onUpdateMask({
              ...initialMaskState,
              x: newX,
              y: newY,
              width: newW,
              height: newH,
              imageSnapshot: undefined
          });
      }

  }, [interactionState, startPos, initialMaskState, activeHandle, onUpdateMask]);

  const handleGlobalMouseUp = useCallback(() => {
      if (interactionState === 'DRAWING' && startPos && currentPos && containerRef.current && onAddMask) {
          const rect = containerRef.current.getBoundingClientRect();
          const rawX = Math.min(startPos.x, currentPos.x);
          const rawY = Math.min(startPos.y, currentPos.y);
          const rawW = Math.abs(currentPos.x - startPos.x);
          const rawH = Math.abs(currentPos.y - startPos.y);

          if (rawW > 5 && rawH > 5) {
              const xPct = (rawX / rect.width) * 100;
              const yPct = (rawY / rect.height) * 100;
              const wPct = (rawW / rect.width) * 100;
              const hPct = (rawH / rect.height) * 100;
              
              const color = getDominantColor({ x: rawX, y: rawY, w: rawW, h: rawH });

              onAddMask({
                  id: `mask-${Date.now()}`,
                  x: xPct, y: yPct, width: wPct, height: hPct,
                  color: color,
                  fillType: 'solid',
                  // Default to current page when manually drawing
                  pageIndex: currentPage - 1 
              });
          }
      }

      setInteractionState('IDLE');
      setStartPos(null);
      setCurrentPos(null);
      setActiveHandle(null);
      setInitialMaskState(null);
  }, [interactionState, startPos, currentPos, onAddMask, currentPage]);

  useEffect(() => {
      if (interactionState !== 'IDLE') {
          window.addEventListener('mousemove', handleGlobalMouseMove);
          window.addEventListener('mouseup', handleGlobalMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleGlobalMouseMove);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
  }, [interactionState, handleGlobalMouseMove, handleGlobalMouseUp]);


  if (!fileData) return null;

  const RenderHandle = ({ h, mask }: { h: ResizeHandle, mask: Mask }) => {
      let top = 'auto', bottom = 'auto', left = 'auto', right = 'auto';
      let cursor = 'e-resize';
      let marginLeft = '0';
      let marginTop = '0';

      if (h.includes('n')) top = '-4px';
      if (h.includes('s')) bottom = '-4px';
      if (h.includes('w')) left = '-4px';
      if (h.includes('e')) right = '-4px';
      
      if (h === 'n' || h === 's') { 
          left = '50%'; 
          marginLeft = '-4px'; 
          cursor = 'ns-resize'; 
      }
      if (h === 'e' || h === 'w') { 
          top = '50%'; 
          marginTop = '-4px'; 
          cursor = 'ew-resize'; 
      }
      
      if (h === 'nw' || h === 'se') cursor = 'nwse-resize';
      if (h === 'ne' || h === 'sw') cursor = 'nesw-resize';

      return (
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, h, mask)}
            className="absolute w-2.5 h-2.5 bg-white border border-indigo-600 rounded-full z-40 hover:scale-125 transition-transform"
            style={{ top, bottom, left, right, marginTop, marginLeft, cursor }}
          />
      );
  }
  
  // Filter masks visible on the current page
  const visibleMasks = masks.filter(m => m.pageIndex === undefined || m.pageIndex === currentPage - 1);

  return (
    <div className={`
        relative flex flex-col items-center justify-center
        ${isFullscreen ? 'w-full h-full p-6 bg-slate-900/50' : 'w-full'}
    `}>
        {/* Fullscreen Toggle Button */}
        <button
            onClick={(e) => {
                e.stopPropagation();
                onToggleFullscreen();
            }}
            className="absolute top-4 right-4 z-50 p-2 bg-slate-800/80 hover:bg-indigo-600 text-white rounded-lg shadow-lg border border-slate-600 transition-all backdrop-blur-sm"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>

        {/* Inner Container: The "Stage" */}
        <div 
            ref={containerRef}
            className={`
                relative select-none group
                ${isFullscreen 
                    ? 'shadow-2xl' 
                    : 'w-full rounded-xl bg-slate-950 border border-slate-700 shadow-2xl'
                }
                ${mode === 'MASK' ? 'cursor-crosshair' : ''}
            `}
            style={{ 
                display: 'inline-flex', 
                minHeight: isFullscreen ? 'auto' : '300px',
                maxWidth: '100%',
                maxHeight: isFullscreen ? 'calc(100% - 60px)' : 'auto', // Reserve space for pagination in fullscreen
            }}
            onMouseDown={handleContainerMouseDown}
        >
            {loading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                </div>
            )}

            <canvas 
                ref={canvasRef} 
                className="block object-contain max-w-full max-h-full w-auto h-auto"
                style={{ 
                    maxHeight: isFullscreen ? 'calc(100vh - 8rem)' : 'auto' 
                }}
            />

            {/* Drawing Preview */}
            {interactionState === 'DRAWING' && startPos && currentPos && (
                <div 
                    className="absolute border-2 border-indigo-500 bg-indigo-500/20 z-30 pointer-events-none"
                    style={{
                        left: Math.min(startPos.x, currentPos.x),
                        top: Math.min(startPos.y, currentPos.y),
                        width: Math.abs(currentPos.x - startPos.x),
                        height: Math.abs(currentPos.y - startPos.y),
                    }}
                />
            )}

            {/* Crop Margins Visualization */}
            {mode === 'CROP' && (
                <>
                    {/* ... Existing crop margins ... */}
                    <div 
                        className="absolute top-0 left-0 right-0 bg-slate-900/80 backdrop-grayscale border-b border-red-500/50 z-10 flex items-end justify-center pb-2 pointer-events-none"
                        style={{ height: `${margins.top}%` }}
                    >
                        {margins.top > 5 && <span className="text-red-400 text-xs font-bold uppercase tracking-widest">Removed</span>}
                    </div>
                    <div 
                        className="absolute bottom-0 left-0 right-0 bg-slate-900/80 backdrop-grayscale border-t border-red-500/50 z-10 flex items-start justify-center pt-2 pointer-events-none"
                        style={{ height: `${margins.bottom}%` }}
                    >
                        {margins.bottom > 5 && <span className="text-red-400 text-xs font-bold uppercase tracking-widest">Removed</span>}
                    </div>
                    <div 
                        className="absolute top-0 left-0 bottom-0 bg-slate-900/80 backdrop-grayscale border-r border-red-500/50 z-10 pointer-events-none"
                        style={{ width: `${margins.left}%` }}
                    />
                    <div 
                        className="absolute top-0 right-0 bottom-0 bg-slate-900/80 backdrop-grayscale border-l border-red-500/50 z-10 pointer-events-none"
                        style={{ width: `${margins.right}%` }}
                    />
                </>
            )}

            {/* Masks / Patches */}
            {mode === 'MASK' && (
                <>
                    {visibleMasks.map((mask) => {
                        const isSelected = mask.id === selectedMaskId;
                        const isGlobal = mask.pageIndex === undefined;
                        
                        return (
                            <div
                                key={mask.id}
                                onMouseDown={(e) => handleMaskMouseDown(e, mask)}
                                className={`absolute z-20 group/mask ${
                                    isSelected 
                                        ? 'ring-1 ring-indigo-400 cursor-move z-30' 
                                        : 'hover:ring-1 hover:ring-white/50 cursor-pointer'
                                }`}
                                style={{
                                    top: `${mask.y}%`,
                                    left: `${mask.x}%`,
                                    width: `${mask.width}%`,
                                    height: `${mask.height}%`,
                                    backgroundColor: mask.fillType === 'solid' ? mask.color : 'transparent',
                                    backgroundImage: mask.fillType !== 'solid' && mask.imageSnapshot ? `url(${mask.imageSnapshot})` : undefined,
                                    backgroundSize: '100% 100%',
                                    backgroundRepeat: 'no-repeat',
                                    boxShadow: isSelected ? '0 0 0 1px #6366f1, 0 4px 6px -1px rgba(0, 0, 0, 0.2)' : '0 0 0 1px rgba(0,0,0,0.1)', 
                                    // Visual cue for page-specific vs global: Dashed border for page specific if not selected
                                    border: (!isSelected && !isGlobal) ? '1px dashed rgba(255,255,255,0.3)' : undefined
                                }}
                            >
                                {isSelected && (
                                    <>
                                        {/* Resize Handles */}
                                        <RenderHandle h="nw" mask={mask} />
                                        <RenderHandle h="n" mask={mask} />
                                        <RenderHandle h="ne" mask={mask} />
                                        <RenderHandle h="w" mask={mask} />
                                        <RenderHandle h="e" mask={mask} />
                                        <RenderHandle h="sw" mask={mask} />
                                        <RenderHandle h="s" mask={mask} />
                                        <RenderHandle h="se" mask={mask} />

                                        {/* Drag Indicator */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover/mask:opacity-100 pointer-events-none">
                                            <Move className="w-4 h-4 text-white drop-shadow-md" />
                                        </div>
                                        
                                        {/* Label */}
                                        <div className="absolute -top-7 left-0 flex flex-col items-start pointer-events-none z-50">
                                            <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap">
                                                {Math.round(mask.width)}% x {Math.round(mask.height)}%
                                            </span>
                                        </div>
                                    </>
                                )}
                                {!isSelected && !isGlobal && (
                                     <div className="absolute top-0 right-0 p-0.5 bg-black/50 text-[8px] text-white">
                                         P{mask.pageIndex! + 1}
                                     </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}
        </div>
        
        {/* Pagination Controls */}
        <div className={`mt-4 flex items-center gap-4 bg-slate-800/80 backdrop-blur rounded-full px-4 py-2 border border-slate-700 shadow-lg z-40`}>
            <button 
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || loading}
                className="p-1 hover:bg-slate-700 rounded-full disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-slate-200 font-mono">
                Page {currentPage} / {numPages}
            </span>
            <button 
                onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
                disabled={currentPage >= numPages || loading}
                className="p-1 hover:bg-slate-700 rounded-full disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    </div>
  );
};

export default PdfPreview;
