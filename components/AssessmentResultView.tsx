
import React, { useState, useRef } from 'react';
import { AssessmentResult, VoiceOption, VoicePersona } from '../types';
import { generateSpeech } from '../services/gemini';
import { decodeBase64, decodeAudioData, playAudio } from '../services/audio';

interface Props {
  result: AssessmentResult;
  activeVoice: VoiceOption;
  personas: VoicePersona[];
}

const AssessmentResultView: React.FC<Props> = ({ result, activeVoice, personas }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const stopFnRef = useRef<(() => void) | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const personaName = personas.find(p => p.voiceId === activeVoice)?.customName || 'Brain';

  const handleAudio = async (id: string, text: string) => {
    if (playingId === id && stopFnRef.current) {
      stopFnRef.current();
      setPlayingId(null);
      return;
    }

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    try {
      setLoadingId(id);
      const base64 = await generateSpeech(text, activeVoice);
      const bytes = decodeBase64(base64);
      const buffer = await decodeAudioData(bytes, audioCtxRef.current);
      
      if (stopFnRef.current) stopFnRef.current();
      stopFnRef.current = playAudio(buffer, audioCtxRef.current);
      setPlayingId(id);
      setLoadingId(null);
      
      setTimeout(() => setPlayingId(null), buffer.duration * 1000);
    } catch (err) {
      console.error(err);
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-700">
       <div className="bg-slate-900/80 p-8 rounded-[40px] border border-white/5 shadow-2xl text-center space-y-4">
          <div className="inline-block px-6 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400 font-black text-xs uppercase tracking-widest">Global Accuracy</div>
          <h2 className="text-8xl font-black text-white tracking-tighter">{result.overallScore}%</h2>
          <p className="text-slate-500 font-bold leading-relaxed">{result.generalFeedback}</p>
          <button 
            onClick={() => handleAudio('global', result.generalFeedback)}
            className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-indigo-600 rounded-2xl text-xs font-black hover:bg-indigo-500 transition-all"
          >
             {playingId === 'global' ? 'SILENCE' : `HEAR ${personaName.toUpperCase()} FEEDBACK`}
          </button>
       </div>

       <div className="space-y-6">
          {result.pages.map((page, idx) => (
            <div key={idx} className="bg-slate-950/50 rounded-[32px] border border-white/5 overflow-hidden group">
               <div className="p-6 bg-white/2 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-4">
                     <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-sm">{page.pageNumber}</div>
                     <span className="text-xs font-black uppercase tracking-widest text-slate-500">Neural Page Audit</span>
                  </div>
                  <div className="text-2xl font-black text-indigo-400">{page.score}%</div>
               </div>
               
               <div className="p-8 space-y-6">
                  <p className="text-sm font-medium text-slate-400 leading-relaxed italic">"{page.summary}"</p>
                  
                  <div className="space-y-4">
                     {page.critique.map((c, i) => (
                        <div key={i} className="flex gap-4 p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10 hover:border-indigo-500/30 transition-all">
                           <div className="shrink-0 h-6 w-6 bg-rose-500 rounded-lg flex items-center justify-center text-white mt-1">
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                           </div>
                           <div className="flex-1 space-y-2">
                              <p className="text-xs font-black text-rose-500 uppercase tracking-widest">Observation</p>
                              <p className="text-sm font-bold text-slate-200">{c.wrongPoint}</p>
                              <div className="pt-2 border-t border-white/5">
                                 <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Correction</p>
                                 <p className="text-sm font-bold text-emerald-400">{c.correction}</p>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>

                  <button 
                    onClick={() => handleAudio(`page-${idx}`, page.summary)}
                    className="w-full py-4 border border-white/5 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-white/5 transition-all"
                  >
                     Listen to Page Analysis
                  </button>
               </div>
            </div>
          ))}
       </div>
    </div>
  );
};

export default AssessmentResultView;
