
import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, VoiceOption, VoicePersona } from '../types';
import { generateSpeech } from '../services/gemini';
import { decodeBase64, decodeAudioData, playAudio } from '../services/audio';

interface Props {
  result: AnalysisResult;
  selectedVoice: VoiceOption;
  voicePersonas: VoicePersona[];
}

const AnalysisView: React.FC<Props> = ({ result, selectedVoice, voicePersonas }) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const stopFnRef = useRef<(() => void) | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (stopFnRef.current) stopFnRef.current();
    };
  }, []);

  const getPersonaName = () => {
    return voicePersonas.find(vp => vp.voiceId === selectedVoice)?.customName || 'Audile Narrator';
  };

  const initAudio = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const handleSpeech = async (id: string, text: string) => {
    const ctx = await initAudio();

    if (playingId === id && stopFnRef.current) {
      stopFnRef.current();
      stopFnRef.current = null;
      setPlayingId(null);
      return;
    }

    if (stopFnRef.current) {
      stopFnRef.current();
      stopFnRef.current = null;
    }

    try {
      setLoadingId(id);
      const base64 = await generateSpeech(text, selectedVoice);
      const bytes = decodeBase64(base64);
      const buffer = await decodeAudioData(bytes, ctx);
      
      const stop = playAudio(buffer, ctx);
      stopFnRef.current = stop;
      setPlayingId(id);
      setLoadingId(null);
      
      setTimeout(() => {
        setPlayingId(prev => prev === id ? null : prev);
      }, buffer.duration * 1000);
    } catch (err) {
      console.error("Narration failed", err);
      setLoadingId(null);
      setPlayingId(null);
    }
  };

  const AudioBtn = ({ id, text, small = false, label = '', personaSuffix = '' }: { id: string, text: string, small?: boolean, label?: string, personaSuffix?: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); handleSpeech(id, text); }}
      disabled={loadingId !== null && loadingId !== id}
      className={`flex items-center justify-center gap-2 rounded-xl transition-all active:scale-95 disabled:opacity-50 group/btn shadow-lg shrink-0 ${
        small ? 'p-2 md:p-3 text-[10px] font-black' : 'px-4 py-3 md:px-6 md:py-4 text-xs font-black'
      } ${
        playingId === id ? 'bg-rose-500 text-white shadow-rose-900/40' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/40'
      }`}
    >
      {loadingId === id ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      ) : playingId === id ? (
        <svg className="h-4 w-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
      ) : (
        <svg className="h-4 w-4 transition-transform group-hover/btn:scale-125" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
      )}
      <span className="hidden sm:inline truncate">{label || (playingId === id ? 'STOP' : `HEAR ${getPersonaName().toUpperCase()}${personaSuffix}`)}</span>
    </button>
  );

  return (
    <div className="space-y-8 md:space-y-12 lg:space-y-16 animate-in fade-in slide-in-from-bottom-20 duration-1000 overflow-x-hidden">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 md:pb-10 border-b border-white/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
             <div className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
             <p className="text-[9px] md:text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">Neural Extraction</p>
          </div>
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-white tracking-tighter leading-tight break-words">Insight Overview</h2>
        </div>
        <div className="flex items-center">
          <AudioBtn 
            id="full-narration" 
            text={`Analysis of concepts. Summary: ${result.concept}. Followed by detailed breakdown.`} 
            label={playingId === 'full-narration' ? 'STOP' : 'PLAY FULL SESSION'}
          />
        </div>
      </div>

      {/* Concept Card */}
      <section className="bg-slate-950/50 p-6 md:p-10 rounded-[20px] md:rounded-[40px] border border-white/5 relative group hover:border-indigo-500/30 transition-all shadow-3xl">
        <div className="absolute top-4 right-4 md:top-8 md:right-8"><AudioBtn id="concept-only" text={result.concept} small /></div>
        <h3 className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 mb-4">Executive Core</h3>
        <p className="text-base md:text-xl lg:text-3xl font-black text-white leading-tight tracking-tight max-w-full break-words overflow-wrap-anywhere whitespace-normal">{result.concept}</p>
      </section>

      {/* Sequential Breakdown */}
      {result.paragraphs && result.paragraphs.length > 0 && (
        <div className="space-y-6">
           <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 pl-2">Sequential Breakdown</h3>
           <div className="grid gap-4 md:gap-6">
              {result.paragraphs.map((p, i) => (
                <div key={i} className="flex flex-col md:flex-row bg-slate-950/30 border border-white/5 rounded-[20px] md:rounded-[32px] overflow-hidden group hover:bg-white/5 transition-all shadow-xl">
                   <div className="md:w-1/3 bg-slate-950/80 p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/5 relative">
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600/20 group-hover:bg-indigo-600 transition-all"></div>
                      <span className="text-[8px] md:text-[10px] font-black uppercase text-indigo-500/50 tracking-[0.2em]">Source Node {i+1}</span>
                      <p className="text-xs font-bold text-slate-500 italic mt-3 leading-relaxed break-words">"{p.originalText}"</p>
                   </div>
                   <div className="md:w-2/3 p-6 md:p-8 flex flex-col justify-center gap-4">
                      <div className="flex justify-between items-center">
                         <span className="text-[9px] md:text-[11px] font-black uppercase text-indigo-400 tracking-[0.2em]">Translation</span>
                         <AudioBtn id={`segment-${i}`} text={p.explanation} small />
                      </div>
                      <p className="text-sm md:text-lg lg:text-xl font-black text-slate-200 leading-snug tracking-tight break-words">{p.explanation}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Knowledge Anchors - Re-balanced Grid */}
      <div className="space-y-8">
        <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 pl-2">Knowledge Anchors</h3>
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {result.subjectExamples.map((ex, i) => (
            <div key={i} className="bg-slate-950 p-6 md:p-8 rounded-[20px] md:rounded-[32px] relative group flex flex-col shadow-2xl border border-white/5 hover:border-indigo-500/20 transition-all">
              <div className="absolute top-4 right-4"><AudioBtn id={`anchor-${i}`} text={`${ex.text}. ${ex.explanation}`} small /></div>
              <h4 className="text-[8px] md:text-[9px] font-black text-indigo-500/80 uppercase mb-4 tracking-[0.2em]">Synapse {i+1}</h4>
              <p className="font-black text-white mb-4 text-base md:text-lg lg:text-xl leading-tight tracking-tight break-words overflow-wrap-anywhere">{ex.text}</p>
              <div className="mt-auto pt-6 border-t border-white/5">
                <p className="text-xs md:text-sm font-bold text-slate-500 leading-relaxed break-words overflow-wrap-anywhere">{ex.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real World Examples */}
      <div className="grid gap-6 md:gap-10 grid-cols-1 xl:grid-cols-2 py-4">
        {result.realWorldExamples.map((item, i) => (
          <div key={i} className="bg-slate-950/80 p-6 md:p-10 rounded-[24px] md:rounded-[40px] border border-white/10 shadow-3xl relative overflow-hidden group hover:border-indigo-600 transition-all">
            <div className="absolute top-4 right-4"><AudioBtn id={`projected-friend-${i}`} text={`${item.persona} says ${item.scenario}. The takeaway is ${item.explanation}`} small /></div>
            
            <div className="flex items-center gap-4 mb-6 md:mb-10">
              <div className="h-10 w-10 md:h-16 md:w-16 bg-indigo-600 text-white rounded-[12px] md:rounded-[20px] flex items-center justify-center font-black text-lg md:text-3xl shadow-glow-indigo border-2 md:border-4 border-slate-900 shrink-0">{item.persona[0]}</div>
              <div className="min-w-0">
                <h4 className="font-black text-xl md:text-3xl text-white tracking-tighter leading-none mb-1 truncate">{item.persona}</h4>
                <p className="text-[8px] md:text-[9px] text-indigo-400 font-black uppercase tracking-[0.2em]">Projected Reality</p>
              </div>
            </div>

            <div className="p-5 md:p-8 bg-indigo-900/10 rounded-[16px] md:rounded-[24px] border border-indigo-500/20 italic font-black text-indigo-100 text-sm md:text-lg leading-relaxed relative mb-6 shadow-inner break-words">
               <svg className="absolute -left-1.5 top-4 md:-left-3 md:top-8 h-4 w-4 md:h-6 md:w-6 text-indigo-900/50 fill-current" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
               "{item.scenario}"
            </div>

            <div className="px-2 md:px-4">
               <p className="text-[8px] md:text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">Neural Imprint</p>
               <p className="text-xs md:text-sm font-bold text-slate-400 leading-relaxed tracking-tight break-words">{item.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalysisView;
