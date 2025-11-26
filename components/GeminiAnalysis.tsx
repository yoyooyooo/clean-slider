import React from 'react';
import { AnalysisResult } from '../types';
import { Sparkles, BrainCircuit, Lightbulb } from 'lucide-react';

interface GeminiAnalysisProps {
  result: AnalysisResult | null;
  loading: boolean;
  onAnalyze: () => void;
  hasFile: boolean;
}

const GeminiAnalysis: React.FC<GeminiAnalysisProps> = ({ result, loading, onAnalyze, hasFile }) => {
  if (!hasFile) return null;

  return (
    <div className="bg-slate-800 rounded-xl border border-indigo-500/30 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-900/50 to-slate-900/50 p-4 border-b border-indigo-500/20 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white">Gemini AI Insights</h3>
        </div>
        {!result && !loading && (
            <button
                onClick={onAnalyze}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
            >
                <BrainCircuit className="w-3 h-3" /> Analyze Content
            </button>
        )}
      </div>

      <div className="p-6">
        {loading ? (
            <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                <div className="h-24 bg-slate-700 rounded mt-4"></div>
            </div>
        ) : result ? (
            <div className="space-y-6 animate-fade-in">
                <div>
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">Executive Summary</h4>
                    <p className="text-slate-300 leading-relaxed text-sm">{result.summary}</p>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Key Takeaways
                    </h4>
                    <ul className="space-y-2">
                        {result.keyPoints.map((point, idx) => (
                            <li key={idx} className="flex gap-2 text-sm text-slate-300">
                                <span className="text-indigo-500 mt-1">•</span>
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        ) : (
            <div className="text-center py-4 text-slate-500 text-sm">
                Get a quick summary and key points from your slide deck using Google's Gemini 2.5 Flash model.
            </div>
        )}
      </div>
    </div>
  );
};

export default GeminiAnalysis;
