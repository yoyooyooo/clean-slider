
import React, { useState } from 'react';
import { AppState, CropMargins, AnalysisResult, EditMode, Mask } from './types';
import DropZone from './components/DropZone';
import PdfPreview from './components/PdfPreview';
import CropControls from './components/CropControls';
import GeminiAnalysis from './components/GeminiAnalysis';
import { loadPdfDocument, cropAndDownloadPdf, getPdfPageText, getPageAsImage, modifyPdfWithMasks, getPdfPageCount } from './services/pdfService';
import { analyzePdfContent, detectWatermarkMargins, detectWatermarkMasks } from './services/geminiService';
import { Download, RefreshCw, Layers, Minimize2 } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [editMode, setEditMode] = useState<EditMode>('MASK'); 
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(1);
  
  const [margins, setMargins] = useState<CropMargins>({
    top: 0, bottom: 0, left: 0, right: 0
  });
  
  const [masks, setMasks] = useState<Mask[]>([]);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  const handleFileSelected = async (selectedFile: File) => {
    setAppState(AppState.LOADING);
    try {
      const data = await loadPdfDocument(selectedFile);
      const pageCount = await getPdfPageCount(data);
      
      setFile(selectedFile);
      setFileData(data);
      setNumPages(pageCount);
      setCurrentPage(1);
      
      setMargins({ top: 0, bottom: 0, left: 0, right: 0 });
      setMasks([]);
      setSelectedMaskId(null);
      setAnalysis(null);
      setAppState(AppState.READY);
    } catch (error) {
      console.error("Failed to load PDF", error);
      setAppState(AppState.IDLE);
      alert("Failed to load PDF file.");
    }
  };

  const handleProcess = async () => {
    if (!fileData || !file) return;

    setAppState(AppState.PROCESSING);
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      if (editMode === 'CROP') {
        await cropAndDownloadPdf(fileData, margins, file.name);
      } else {
        await modifyPdfWithMasks(fileData, masks, file.name);
      }
    } catch (error) {
      console.error("Processing failed", error);
      alert("Failed to process PDF.");
    } finally {
      setAppState(AppState.READY);
    }
  };

  const handleAnalysis = async () => {
    if (!fileData) return;

    setIsAnalyzing(true);
    try {
      const text = await getPdfPageText(fileData);
      if (!text.trim()) {
        alert("Could not extract text from this PDF. It might be scanned images.");
        setIsAnalyzing(false);
        return;
      }
      const result = await analyzePdfContent(text);
      setAnalysis(result);
    } catch (error) {
      console.error("Analysis failed", error);
      alert("AI Analysis failed. Check console or API key.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoDetect = async () => {
    if (!fileData) return;
    
    setIsAutoDetecting(true);
    const startTime = Date.now();
    console.log("[App] Starting Auto Detect...");

    // Create a timeout promise that rejects after 90 seconds
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Auto-detection timed out after 90 seconds.")), 90000);
    });

    const processPromise = (async () => {
        // Use the current page for analysis
        console.log(`[App] Extracting image for page ${currentPage}...`);
        const imageStartTime = Date.now();
        const imageBase64 = await getPageAsImage(fileData, currentPage);
        console.log(`[App] Image extracted in ${(Date.now() - imageStartTime) / 1000}s. Calling Gemini...`);
        
        const aiStartTime = Date.now();

        if (editMode === 'CROP') {
             const suggestedMargins = await detectWatermarkMargins(imageBase64);
             setMargins(suggestedMargins);
             console.log(`[App] Margins updated. AI time: ${(Date.now() - aiStartTime) / 1000}s`);
        } else {
             const detectedMasks = await detectWatermarkMasks(imageBase64);
             console.log(`[App] Received ${detectedMasks.length} masks. AI time: ${(Date.now() - aiStartTime) / 1000}s`);
             
             // Assign detected masks to the current page only by default
             const pageSpecificMasks = detectedMasks.map(m => ({
                 ...m,
                 pageIndex: currentPage - 1
             }));
             
             setMasks(prev => [...prev, ...pageSpecificMasks]);
             if (detectedMasks.length === 0) {
                 alert("AI didn't find any obvious watermarks to patch. Try drawing one manually.");
             }
        }
    })();

    try {
        await Promise.race([processPromise, timeoutPromise]);
        console.log(`[App] Auto detection completed in ${(Date.now() - startTime) / 1000}s`);
    } catch (error: any) {
        console.error("Auto detect failed", error);
        alert(`Auto-detection failed: ${error.message || "Unknown error"}. Check console for details.`);
    } finally {
        setIsAutoDetecting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileData(null);
    setAppState(AppState.IDLE);
    setAnalysis(null);
    setMasks([]);
    setSelectedMaskId(null);
    setMargins({ top: 0, bottom: 0, left: 0, right: 0 });
    setIsFullscreen(false);
    setCurrentPage(1);
    setNumPages(1);
  };

  // Mask CRUD
  const handleAddMask = (newMask: Mask) => {
      // Manual masks default to current page
      const maskWithPage = { ...newMask, pageIndex: currentPage - 1 };
      setMasks([...masks, maskWithPage]);
      setSelectedMaskId(newMask.id);
  };

  const handleUpdateMask = (updatedMask: Mask) => {
      setMasks(masks.map(m => m.id === updatedMask.id ? updatedMask : m));
  };

  const handleDeleteMask = (id: string) => {
      setMasks(masks.filter(m => m.id !== id));
      if (selectedMaskId === id) setSelectedMaskId(null);
  };

  const renderControls = () => (
    <>
        <CropControls 
            margins={margins} 
            onChangeMargins={setMargins} 
            onAutoDetect={handleAutoDetect}
            isAutoDetecting={isAutoDetecting}
            mode={editMode}
            onModeChange={setEditMode}
            masks={masks}
            selectedMaskId={selectedMaskId}
            onUpdateMask={handleUpdateMask}
            onDeleteMask={handleDeleteMask}
            onSelectMask={setSelectedMaskId}
            currentPage={currentPage}
        />

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg mt-6">
            <div className="flex items-center gap-2 mb-4">
                <Download className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">Export</h3>
            </div>
            
            <p className="text-slate-400 text-sm mb-6">
                Ready to process <strong>{file?.name}</strong>? This will create a new PDF file with the selected {editMode === 'MASK' ? 'patches applied' : 'edges cropped'}.
            </p>

            <button
                onClick={handleProcess}
                disabled={appState === AppState.PROCESSING}
                className={`
                    w-full py-4 rounded-lg font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all
                    ${appState === AppState.PROCESSING 
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transform hover:scale-[1.02]'}
                `}
            >
                {appState === AppState.PROCESSING ? (
                    <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Processing...
                    </>
                ) : (
                    <>
                        <Download className="w-5 h-5" />
                        {editMode === 'MASK' ? 'Apply Patches & Download' : 'Crop & Download PDF'}
                    </>
                )}
            </button>
        </div>
    </>
  );

  return (
    <div className={`min-h-screen ${isFullscreen ? 'overflow-hidden bg-slate-950' : 'p-4 md:p-8 max-w-7xl mx-auto'}`}>
      
      {/* Header (Only shown when not fullscreen) */}
      {!isFullscreen && (
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 tracking-tight">
                CleanSlide
            </h1>
            <p className="text-slate-400 mt-1">
                Smart AI Removal of Watermarks & Edges from PDFs
            </p>
            </div>
            
            {file && (
                <button 
                    onClick={handleReset}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors self-start md:self-auto"
                >
                    <RefreshCw className="w-4 h-4" /> Upload New File
                </button>
            )}
        </header>
      )}

      <main className="h-full">
        {appState === AppState.IDLE || appState === AppState.LOADING ? (
          <div className="max-w-xl mx-auto mt-20">
             {appState === AppState.LOADING ? (
                <div className="flex flex-col items-center justify-center h-64 border border-slate-700 rounded-xl bg-slate-800/50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-slate-300">Loading your presentation...</p>
                </div>
             ) : (
                 <DropZone onFileSelected={handleFileSelected} />
             )}
          </div>
        ) : isFullscreen ? (
            /* Fullscreen Layout */
            <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col md:flex-row">
                 {/* Main Preview Area */}
                 <div className="flex-1 relative bg-black/90 flex items-center justify-center p-0 overflow-hidden">
                     <PdfPreview 
                        fileData={fileData} 
                        margins={margins} 
                        masks={masks}
                        mode={editMode}
                        onAddMask={handleAddMask}
                        selectedMaskId={selectedMaskId}
                        onSelectMask={setSelectedMaskId}
                        onUpdateMask={handleUpdateMask}
                        isFullscreen={true}
                        onToggleFullscreen={() => setIsFullscreen(false)}
                        currentPage={currentPage}
                        numPages={numPages}
                        onPageChange={setCurrentPage}
                    />
                 </div>
                 {/* Sidebar Controls */}
                 <div className="w-full md:w-96 bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto shadow-2xl z-10">
                     <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                         <h2 className="font-bold text-white text-lg flex items-center gap-2">
                             <Layers className="w-5 h-5 text-indigo-400" />
                             Editor Tools
                         </h2>
                         <button 
                             onClick={() => setIsFullscreen(false)} 
                             className="text-slate-400 hover:text-white flex items-center gap-1 text-sm bg-slate-800 px-3 py-1.5 rounded-full"
                         >
                             <Minimize2 className="w-4 h-4" /> Exit
                         </button>
                     </div>
                     {renderControls()}
                 </div>
            </div>
        ) : (
          /* Normal Grid Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Preview */}
            <div className="lg:col-span-7 space-y-6">
                <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-2 text-slate-300 font-medium">
                        <Layers className="w-4 h-4" />
                        <h2>Preview</h2>
                     </div>
                     <span className="text-xs font-mono text-slate-500 uppercase">{editMode} Mode</span>
                </div>
                
                <PdfPreview 
                    fileData={fileData} 
                    margins={margins} 
                    masks={masks}
                    mode={editMode}
                    onAddMask={handleAddMask}
                    selectedMaskId={selectedMaskId}
                    onSelectMask={setSelectedMaskId}
                    onUpdateMask={handleUpdateMask}
                    isFullscreen={false}
                    onToggleFullscreen={() => setIsFullscreen(true)}
                    currentPage={currentPage}
                    numPages={numPages}
                    onPageChange={setCurrentPage}
                />
                
                <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-lg text-sm text-blue-200">
                    {editMode === 'MASK' 
                        ? "Smart Patch Mode: Click and drag on the image to manually hide watermarks. Use 'Fill Style' settings for gradients. Masks can be set per-page or globally."
                        : "Crop Mode: Edges are physically cut off from the PDF pages."
                    }
                </div>

                <GeminiAnalysis 
                    hasFile={!!file} 
                    loading={isAnalyzing} 
                    onAnalyze={handleAnalysis} 
                    result={analysis} 
                />
            </div>

            {/* Right Column: Controls */}
            <div className="lg:col-span-5 space-y-6">
                {renderControls()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
