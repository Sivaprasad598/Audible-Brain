
import React from 'react';
import { ListenToMeResult } from '../types';

interface Props {
  result: ListenToMeResult;
  audioUrl?: string;
}

const ListenToMeView: React.FC<Props> = ({ result, audioUrl }) => {
  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-700 pb-12">
      {/* Accuracy Header */}
      <div className="bg-slate-900/80 p-8 rounded-[40px] border border-white/10 shadow-2xl text-center space-y-4">
        <div className="inline-block px-4 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400 font-black text-[10px] uppercase tracking-widest">
          Vocal Calibration
        </div>
        <h2 className="text-7xl font-black text-white tracking-tighter">
          {result.correctnessPercentage}%
        </h2>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Accuracy Rating</p>
      </div>

      {/* NEW: Recorded Audio Input Display & Download */}
      {audioUrl && (
        <div className="bg-indigo-600/10 p-8 rounded-[32px] border border-indigo-500/20 space-y-4 shadow-inner">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Your Vocal Imprint</h3>
            <a 
              href={audioUrl} 
              download="neural-vocal-imprint.webm" 
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-glow-indigo flex items-center gap-2"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          </div>
          <audio src={audioUrl} controls className="w-full rounded-full bg-black/40 border border-white/5 h-12" />
        </div>
      )}

      {/* Transcription Block */}
      <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 space-y-4">
        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">Decoded Speech</h3>
        <p className="text-slate-300 font-medium leading-relaxed italic">
          "{result.transcription}"
        </p>
      </div>

      {/* Feedback Sections */}
      <div className="grid gap-6">
        {/* Content Review */}
        <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 space-y-6">
          <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Accuracy Review</h3>
          <p className="text-sm text-slate-300 leading-relaxed font-bold">
            {result.contentFeedback.accuracyReview}
          </p>
          {result.contentFeedback.missedPoints.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/5">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Missed Nodes</p>
              <ul className="space-y-2">
                {result.contentFeedback.missedPoints.map((point, i) => (
                  <li key={i} className="flex gap-3 items-start text-xs text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Grammar and Mistakes */}
        {result.grammarMistakes.length > 0 && (
          <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 space-y-6">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest">Linguistic Anomalies</h3>
            <div className="space-y-4">
              {result.grammarMistakes.map((mistake, i) => (
                <div key={i} className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-amber-500 line-through decoration-rose-500">{mistake.error}</span>
                    <span className="text-xs font-black text-emerald-500">{mistake.correction}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold">{mistake.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhancements */}
        <div className="bg-indigo-600 p-8 rounded-[32px] shadow-glow-indigo space-y-4">
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Growth Path</h3>
          <ul className="space-y-3">
            {result.enhancementSuggestions.map((suggestion, i) => (
              <li key={i} className="flex gap-3 items-start text-sm text-white font-bold">
                <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ListenToMeView;
