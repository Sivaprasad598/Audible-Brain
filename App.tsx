
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppState, FileType, HistoryItem, ViewMode, VoiceOption, LANGUAGES, BASE_VOICES, VoicePersona, AssessmentResult, AnalysisResult, ListenToMeResult } from './types';
import LanguageSelector from './components/LanguageSelector';
import AnalysisView from './components/AnalysisView';
import AssessmentResultView from './components/AssessmentResultView';
import ListenToMeView from './components/ListenToMeView';
import LoginScreen from './components/LoginScreen';
import Logo from './components/Logo';
import { analyzeContent, assessContent, validateVocalAnswer } from './services/gemini';

const STORAGE_KEY_HISTORY = 'audilebrain_history_v3';
const STORAGE_KEY_PROFILE = 'audilebrain_profile_v3';
const STORAGE_KEY_AUTH = 'audilebrain_auth_v1';

// --- IndexedDB for PDF Storage ---
const DB_NAME = 'AudileBrainDB';
const STORE_NAME = 'pdfs';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const storePDF = async (id: string, blob: Blob) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getPDF = async (id: string): Promise<Blob | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isLoggedIn: localStorage.getItem(STORAGE_KEY_AUTH) === 'true',
    view: 'dashboard',
    file: null,
    fileType: null,
    textInput: '',
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    language: 'English',
    activeVoiceId: 'Kore',
    isAnalyzing: false,
    result: null,
    assessmentResult: null,
    listenToMeResult: null,
    error: null,
    history: [],
    activeHistoryId: null,
    profile: { 
      name: 'Explorer', 
      photo: null, 
      totalAnalyses: 0, 
      joinedDate: Date.now(),
      voicePersonas: [
        { voiceId: 'Kore', customName: 'Main Narrator' },
        { voiceId: 'Charon', customName: 'Head Mentor' }
      ]
    },
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [correctMeFiles, setCorrectMeFiles] = useState<File[]>([]);
  const [correctMeRefFile, setCorrectMeRefFile] = useState<File | null>(null);
  const [refMode, setRefMode] = useState<'text' | 'pdf' | 'none'>('text');

  // Listen To Me State
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Memoized URL to prevent flicker and leaks
  const audioUrl = useMemo(() => audioBlob ? URL.createObjectURL(audioBlob) : null, [audioBlob]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (savedHistory) setState(s => ({ ...s, history: JSON.parse(savedHistory) }));
    if (savedProfile) {
      const p = JSON.parse(savedProfile);
      setState(s => ({ ...s, profile: p, activeVoiceId: p.voicePersonas[0]?.voiceId || 'Kore' }));
    }

    const pdfjsLib = (window as any).pdfjsLib;
    if (pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state.history));
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(state.profile));
    localStorage.setItem(STORAGE_KEY_AUTH, state.isLoggedIn.toString());
  }, [state.history, state.profile, state.isLoggedIn]);

  const renderPage = useCallback(async (pageNum: number, pdf: any) => {
    if (!canvasRef.current || !pdf) return;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport: viewport }).promise;

      setState(s => {
        const item = s.history.find(h => h.id === s.activeHistoryId);
        const pageResult = item?.pdfData?.pageResults[pageNum] || null;
        
        const updatedHistory = s.history.map(h => 
          h.id === s.activeHistoryId && h.pdfData 
          ? { ...h, pdfData: { ...h.pdfData, lastViewedPage: pageNum } } 
          : h
        );

        return { 
          ...s, 
          result: pageResult, 
          currentPage: pageNum,
          history: updatedHistory
        };
      });
    } catch (err) { console.error("PDF Render error", err); }
  }, [state.activeHistoryId]);

  const handleLogin = (userData: { name: string; email: string; photo: string | null; isGuest?: boolean }) => {
    setState(s => ({
      ...s,
      isLoggedIn: true,
      profile: {
        ...s.profile,
        name: userData.name,
        photo: userData.photo
      }
    }));
  };

  const handleLogout = () => {
    setState(s => ({ ...s, isLoggedIn: false, assessmentResult: null, result: null, listenToMeResult: null, file: null, view: 'dashboard', activeHistoryId: null, pdfDoc: null }));
    localStorage.removeItem(STORAGE_KEY_AUTH);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | null } }, forcedId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let type: FileType = file.type === 'application/pdf' ? 'pdf' : file.type.startsWith('image/') ? 'image' : null;
    if (!type) { setState(s => ({ ...s, error: 'Select a valid PDF or Image.' })); return; }
    
    const activeId = forcedId || state.activeHistoryId;
    const isRestoring = !!activeId;

    setState(s => ({ 
      ...s, 
      file, 
      fileType: type, 
      error: null, 
      result: isRestoring ? s.result : null, 
      pdfDoc: null, 
      activeHistoryId: activeId,
      currentPage: isRestoring ? s.currentPage : 1 
    }));
    
    if (type === 'pdf') {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const arrayBuffer = ev.target?.result as ArrayBuffer;
        const pdf = await (window as any).pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
        
        let storeId = activeId;
        if (!storeId) {
          storeId = Math.random().toString(36).substr(2, 9);
          setState(prev => ({ ...prev, activeHistoryId: storeId }));
        }
        
        try {
          await storePDF(storeId!, new Blob([arrayBuffer], { type: 'application/pdf' }));
        } catch (err) {
          console.warn("Failed to store PDF in IDB:", err);
        }

        setState(s => ({ ...s, pdfDoc: pdf, totalPages: pdf.numPages }));
        renderPage(isRestoring ? state.currentPage : 1, pdf);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const performAnalysis = async () => {
    try {
      setState(s => ({ ...s, isAnalyzing: true, error: null }));
      let payload: any = {};
      if (state.fileType === 'pdf' && canvasRef.current) {
        payload.imageBase64 = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
        payload.mimeType = 'image/jpeg';
      } else if (state.fileType === 'image' && state.file) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((res) => { reader.onload = () => res(reader.result as string); reader.readAsDataURL(state.file!); });
        payload.imageBase64 = base64.split(',')[1];
        payload.mimeType = state.file.type;
      } else if (state.fileType === 'text') {
        payload.text = state.textInput;
      }

      const result = await analyzeContent(payload, state.language);
      
      setState(s => {
        let newHistory = [...s.history];
        let currentActiveId = s.activeHistoryId;

        if (s.fileType === 'pdf') {
          if (!currentActiveId) {
            currentActiveId = Math.random().toString(36).substr(2, 9);
          }
          
          const existingItemIdx = newHistory.findIndex(h => h.id === currentActiveId);
          if (existingItemIdx === -1) {
            const newItem: HistoryItem = {
              id: currentActiveId!,
              title: s.file?.name || 'Untitled Document',
              type: 'pdf',
              date: Date.now(),
              language: s.language,
              pdfData: {
                pageResults: { [s.currentPage]: result },
                lastViewedPage: s.currentPage,
                totalPages: s.totalPages,
                completedPages: [s.currentPage]
              }
            };
            newHistory = [newItem, ...newHistory];
          } else {
            newHistory = newHistory.map(h => {
              if (h.id === currentActiveId && h.pdfData) {
                return {
                  ...h,
                  pdfData: {
                    ...h.pdfData,
                    pageResults: { ...h.pdfData.pageResults, [s.currentPage]: result },
                    lastViewedPage: s.currentPage,
                    completedPages: Array.from(new Set([...h.pdfData.completedPages, s.currentPage]))
                  }
                };
              }
              return h;
            });
          }
        } else {
          const title = s.fileType === 'image' ? s.file?.name : (s.textInput.slice(0, 30) + '...');
          const newItem: HistoryItem = { id: Math.random().toString(36).substr(2, 9), title: title || 'Neural Input', type: s.fileType, date: Date.now(), language: s.language, result };
          newHistory = [newItem, ...newHistory];
        }

        return {
          ...s,
          result,
          isAnalyzing: false,
          history: newHistory,
          activeHistoryId: currentActiveId,
          profile: { ...s.profile, totalAnalyses: s.profile.totalAnalyses + 1 }
        };
      });

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      setState(s => ({ ...s, isAnalyzing: false, error: err.message || 'Brain overload. Try again.' }));
    }
  };

  const handleRecallHistory = async (item: HistoryItem) => {
    if (item.type === 'pdf') {
      try {
        const storedBlob = await getPDF(item.id);
        if (storedBlob) {
          const arrayBuffer = await storedBlob.arrayBuffer();
          const pdfDoc = await (window as any).pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
          const targetPage = item.pdfData?.lastViewedPage || 1;
          
          setState(s => ({ 
            ...s, 
            view: 'dashboard', 
            file: new File([storedBlob], item.title, { type: 'application/pdf' }), 
            fileType: 'pdf', 
            pdfDoc, 
            totalPages: pdfDoc.numPages, 
            currentPage: targetPage,
            activeHistoryId: item.id,
            language: item.language,
            result: item.pdfData?.pageResults[targetPage] || null,
            error: null
          }));
          
          setTimeout(() => {
             renderPage(targetPage, pdfDoc);
          }, 400);
          return;
        }
      } catch (idbErr) {
        console.warn("IDB Resume failed:", idbErr);
      }

      setState(s => ({ 
        ...s, 
        activeHistoryId: item.id,
        error: `History context loaded. Re-upload "${item.title}" to view content.`,
        currentPage: item.pdfData?.lastViewedPage || 1,
        language: item.language,
        view: 'dashboard',
        fileType: 'pdf',
        result: item.pdfData?.pageResults[item.pdfData?.lastViewedPage || 1] || null
      }));
      
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.pdf';
      fileInput.onchange = (e: any) => handleFileUpload(e, item.id);
      fileInput.click();
    } else {
      setState(s => ({ 
        ...s, 
        view: 'dashboard', 
        result: item.result || null, 
        fileType: item.type, 
        activeHistoryId: item.id, 
        language: item.language,
        file: null,
        pdfDoc: null,
        textInput: item.type === 'text' ? (item.result?.concept || '') : ''
      }));
    }
  };

  const performAssessment = async () => {
    if (correctMeFiles.length === 0) {
      setState(s => ({ ...s, error: 'Required: Upload at least one answer sheet.' }));
      return;
    }
    try {
      setState(s => ({ ...s, isAnalyzing: true, error: null, assessmentResult: null }));
      
      let referenceContent = "";
      if (refMode === 'text') {
        referenceContent = state.textInput;
        if (!referenceContent) throw new Error("Reference text is missing.");
      } else if (refMode === 'pdf' && correctMeRefFile) {
        const buffer = await correctMeRefFile.arrayBuffer();
        const pdf = await (window as any).pdfjsLib.getDocument(new Uint8Array(buffer)).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + "\n";
        }
        referenceContent = fullText;
      } else if (refMode === 'none') {
        referenceContent = "General subject knowledge";
      }

      const images: { data: string; mimeType: string }[] = [];
      for (const file of correctMeFiles) {
        if (file.type === 'application/pdf') {
          const buffer = await file.arrayBuffer();
          const pdf = await (window as any).pdfjsLib.getDocument(new Uint8Array(buffer)).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context!, viewport }).promise;
            images.push({ data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], mimeType: 'image/jpeg' });
          }
        } else {
          const reader = new FileReader();
          const base64 = await new Promise<string>((res) => { reader.onload = () => res(reader.result as string); reader.readAsDataURL(file); });
          images.push({ data: base64.split(',')[1], mimeType: file.type });
        }
      }

      const res = await assessContent(images, referenceContent, state.language);
      setState(s => ({ ...s, assessmentResult: res, isAnalyzing: false }));
    } catch (err: any) {
      setState(s => ({ ...s, isAnalyzing: false, error: err.message || 'Neural failure.' }));
    }
  };

  // --- Listen To Me Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setState(s => ({ ...s, error: "Microphone access denied." }));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const performListenToMeAnalysis = async () => {
    if (!audioBlob || (!state.file && !state.textInput)) {
      setState(s => ({ ...s, error: "Required: Reference input + Audio Answer." }));
      return;
    }

    try {
      setState(s => ({ ...s, isAnalyzing: true, error: null, listenToMeResult: null }));
      
      // Get Audio Base64
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((res) => {
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.readAsDataURL(audioBlob);
      });

      // Get Reference Payload
      let refPayload: any = {};
      if (state.fileType === 'pdf' && canvasRef.current) {
        refPayload.imageBase64 = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
        refPayload.mimeType = 'image/jpeg';
      } else if (state.fileType === 'image' && state.file) {
        const r2 = new FileReader();
        const b64 = await new Promise<string>((res) => { r2.onload = () => res(r2.result as string); r2.readAsDataURL(state.file!); });
        refPayload.imageBase64 = b64.split(',')[1];
        refPayload.mimeType = state.file.type;
      } else if (state.fileType === 'text') {
        refPayload.text = state.textInput;
      }

      const res = await validateVocalAnswer(audioBase64, refPayload, state.language);
      setState(s => ({ ...s, listenToMeResult: res, isAnalyzing: false }));
    } catch (err: any) {
      setState(s => ({ ...s, isAnalyzing: false, error: err.message || "Voice processing failed." }));
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 'correctMe', label: 'Correct Me', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'listenToMe', label: 'Listen To Me', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
    { id: 'history', label: 'Archives', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'profile', label: 'Persona', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' }
  ];

  if (!state.isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col md:flex-row text-slate-100 selection:bg-indigo-500 selection:text-white relative">
      <aside className="w-full md:w-20 lg:w-64 bg-[#010411] flex flex-row md:flex-col p-3 md:p-6 shrink-0 z-50 border-b md:border-b-0 md:border-r border-white/5 transition-all duration-300 shadow-4xl sticky top-0 md:h-screen md:overflow-y-auto">
        <div className="flex items-center justify-center lg:justify-start gap-4 md:mb-16 px-2">
           <Logo size="sm" />
           <div className="hidden lg:block min-w-0">
            <h1 className="text-white font-black text-xl leading-none truncate tracking-tighter">Audible Brain</h1>
            <p className="text-[8px] text-indigo-500 font-black uppercase tracking-[0.3em] mt-1.5">Neural Core</p>
          </div>
        </div>
        
        <nav className="flex flex-row md:flex-col md:flex-1 space-x-2 md:space-x-0 md:space-y-4 items-center justify-around md:justify-start">
          {navItems.map(nav => (
            <button key={nav.id} onClick={() => setState(s => ({ ...s, view: nav.id as ViewMode, error: null, listenToMeResult: null, assessmentResult: null }))} className={`flex items-center justify-center lg:justify-start gap-4 p-3 md:p-4 rounded-2xl transition-all relative group ${state.view === nav.id ? 'bg-indigo-600/20 text-indigo-400 shadow-inner' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}>
              <svg className={`h-6 w-6 md:h-7 md:w-7 transition-all ${state.view === nav.id ? 'scale-110 text-indigo-400' : 'group-hover:text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d={nav.icon} /></svg>
              <span className="hidden lg:block font-bold text-sm tracking-tight truncate">{nav.label}</span>
            </button>
          ))}
        </nav>

        <div className="hidden md:block mt-auto pt-6 border-t border-white/5">
           <button onClick={handleLogout} className="w-full flex items-center justify-center lg:justify-start gap-4 p-4 rounded-2xl text-rose-500 hover:bg-rose-500/10 transition-all group">
              <svg className="h-6 w-6 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              <span className="hidden lg:block font-black text-[10px] uppercase tracking-widest">Terminate</span>
           </button>
        </div>
      </aside>

      <main className="flex-1 min-h-screen relative bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-y-auto flex flex-col">
        <div className="flex-1 w-full max-w-[1200px] mx-auto p-4 md:p-12 lg:p-20 space-y-12 pb-32 md:pb-12">
          
          {state.error && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 md:p-6 rounded-3xl flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
               <div className="flex items-center gap-3 md:gap-4 min-w-0">
                 <svg className="h-5 w-5 md:h-6 md:w-6 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 <p className="text-rose-200 text-xs md:text-sm font-bold leading-snug truncate">{state.error}</p>
               </div>
               <button onClick={() => setState(s => ({ ...s, error: null }))} className="text-rose-500 hover:text-rose-400 font-black text-[9px] md:text-[10px] uppercase tracking-widest px-3 md:px-4 py-2 bg-rose-500/10 rounded-xl shrink-0 transition-colors">Dismiss</button>
            </div>
          )}

          {state.view === 'dashboard' && (
            <div className="flex flex-col xl:flex-row gap-12 items-start">
              <div className="w-full flex-1 space-y-12 min-w-0">
                <div className="bg-white/5 backdrop-blur-2xl rounded-[32px] md:rounded-[48px] border border-white/10 shadow-4xl overflow-hidden flex flex-col">
                  <div className="p-4 md:p-10 border-b border-white/5 flex flex-wrap items-center justify-between gap-6">
                    <div className="flex bg-black/40 p-1.5 rounded-2xl gap-2 border border-white/5">
                       <button onClick={() => setState(s => ({ ...s, fileType: 'pdf', result: null, file: null, activeHistoryId: null, pdfDoc: null }))} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${state.fileType !== 'text' ? 'bg-indigo-600 text-white shadow-glow-indigo' : 'text-slate-500 hover:text-slate-300'}`}>SCAN</button>
                       <button onClick={() => setState(s => ({ ...s, fileType: 'text', result: null, file: null, activeHistoryId: null, pdfDoc: null }))} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${state.fileType === 'text' ? 'bg-indigo-600 text-white shadow-glow-indigo' : 'text-slate-500 hover:text-slate-300'}`}>TEXT</button>
                    </div>
                    {state.fileType === 'pdf' && state.pdfDoc && (
                      <div className="flex items-center gap-3">
                         <button onClick={() => { const p = Math.max(1, state.currentPage-1); renderPage(p, state.pdfDoc); }} className="p-2.5 md:p-3 bg-slate-800 rounded-xl hover:bg-slate-700 disabled:opacity-30 transition-all border border-white/5" disabled={state.currentPage === 1 || state.isAnalyzing}>
                           <svg className="h-5 w-5 md:h-6 md:w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                         </button>
                         <div className="h-10 w-14 md:h-12 md:w-16 flex items-center justify-center bg-indigo-600/10 rounded-xl border border-indigo-500/20">
                            <span className="text-sm md:text-base font-black text-white">{state.currentPage}</span>
                         </div>
                         <button onClick={() => { const p = Math.min(state.totalPages, state.currentPage+1); renderPage(p, state.pdfDoc); }} className="p-2.5 md:p-3 bg-slate-800 rounded-xl hover:bg-slate-700 disabled:opacity-30 transition-all border border-white/5" disabled={state.currentPage === state.totalPages || state.isAnalyzing}>
                           <svg className="h-5 w-5 md:h-6 md:w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                         </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-4 md:p-12 flex items-center justify-center min-h-[400px] md:min-h-[600px]">
                    {state.fileType === 'text' ? (
                      <textarea className="w-full h-full min-h-[400px] p-6 md:p-10 rounded-3xl md:rounded-[40px] border border-white/10 bg-black/20 text-white text-lg md:text-xl font-medium outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-inner resize-none" placeholder="Inject knowledge. Paste target text..." value={state.textInput} onChange={e => setState(s=>({...s, textInput: e.target.value}))} />
                    ) : !state.file ? (
                      <div className="text-center group cursor-pointer p-12 md:p-40 w-full" onClick={() => document.getElementById('dash-fup')?.click()}>
                         <div className="h-24 w-24 md:h-32 md:w-32 bg-black border border-white/10 rounded-[32px] md:rounded-[48px] flex items-center justify-center mx-auto mb-8 shadow-4xl group-hover:scale-105 transition-all text-indigo-500">
                           <svg className="h-12 w-12 md:h-16 md:w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                         </div>
                         <h4 className="text-xl md:text-2xl font-black text-white tracking-widest uppercase">Initialize Sync</h4>
                         <p className="text-slate-500 mt-2 text-xs font-black uppercase tracking-[0.3em]">PDF / IMAGE / ASSETS</p>
                         <input type="file" id="dash-fup" className="hidden" onChange={handleFileUpload} />
                      </div>
                    ) : (
                      <div className="w-full flex justify-center py-6 md:py-10 animate-in zoom-in-95 duration-700">
                        {state.fileType === 'pdf' ? <canvas ref={canvasRef} className="max-w-full rounded-3xl md:rounded-[40px] shadow-4xl border border-white/10 bg-black h-auto" /> : <img src={URL.createObjectURL(state.file)} className="max-h-[600px] md:max-h-[800px] w-auto rounded-3xl md:rounded-[40px] shadow-4xl border-4 border-white/10" />}
                      </div>
                    )}
                  </div>
                </div>

                <div ref={resultRef} className="pb-12">
                  {state.result && <div className="rounded-[40px] md:rounded-[60px] bg-white/5 backdrop-blur-3xl border border-white/10 p-6 md:p-20 shadow-4xl overflow-hidden"><AnalysisView result={state.result} selectedVoice={state.activeVoiceId} voicePersonas={state.profile.voicePersonas} /></div>}
                  {state.isAnalyzing && (
                    <div className="py-24 md:py-40 flex flex-col items-center justify-center gap-8 md:gap-10">
                      <div className="relative h-20 w-20 md:h-24 md:w-24">
                         <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500/20"></div>
                         <div className="h-full w-full animate-spin rounded-full border-[8px] md:border-[10px] border-indigo-600/10 border-t-indigo-500 shadow-glow-indigo"></div>
                      </div>
                      <p className="text-lg md:text-2xl font-black text-white tracking-widest animate-pulse uppercase">De-coding Reality...</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="w-full xl:w-[420px] shrink-0 xl:sticky xl:top-12">
                <div className="bg-white/5 backdrop-blur-3xl p-8 md:p-10 rounded-[40px] md:rounded-[60px] border border-white/10 shadow-4xl space-y-10 md:space-y-12">
                  <h3 className="text-[12px] font-black uppercase tracking-[0.6em] text-slate-600">Calibration</h3>
                  <LanguageSelector value={state.language} onChange={v => setState(s=>({...s, language: v}))} />
                  
                  <div className="space-y-6 md:space-y-8">
                    <label className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-400 pl-2">Active Persona</label>
                    <div className="grid gap-3 md:gap-4">
                      {state.profile.voicePersonas.map(vp => (
                        <button key={vp.voiceId} onClick={() => setState(s => ({ ...s, activeVoiceId: vp.voiceId }))} className={`flex items-center gap-4 p-4 md:p-5 rounded-3xl border-2 transition-all ${state.activeVoiceId === vp.voiceId ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl -translate-y-1' : 'bg-black/40 border-white/5 text-slate-500 hover:border-white/20'}`}>
                          <div className={`h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center font-black text-xl md:text-2xl ${state.activeVoiceId === vp.voiceId ? 'bg-white/20' : 'bg-slate-800'}`}>
                            {vp.customName[0]}
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-black text-sm md:text-base truncate">{vp.customName}</p>
                            <p className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">{BASE_VOICES.find(bv => bv.id === vp.voiceId)?.label}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={performAnalysis} 
                    disabled={state.isAnalyzing || (state.fileType === 'text' ? !state.textInput : !state.file)} 
                    className="w-full py-6 md:py-8 bg-indigo-600 text-white rounded-3xl md:rounded-[32px] font-black text-xl md:text-2xl shadow-4xl hover:bg-indigo-500 active:scale-95 transition-all disabled:bg-slate-800 disabled:text-slate-600 border border-white/10"
                  >
                    IGNITE EXPLAIN
                  </button>
                </div>
              </div>
            </div>
          )}

          {state.view === 'correctMe' && (
            <div className="flex flex-col gap-12">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter">Correct Me</h2>
                <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs">Answer Validation Engine</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                <div className="space-y-8">
                  {/* Step 1: Reference Key */}
                  <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 shadow-xl space-y-6">
                    <h3 className="text-xs font-black uppercase text-indigo-400 tracking-widest">Stage 1: Reference Source</h3>
                    <div className="flex gap-2">
                       <button onClick={() => setRefMode('text')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${refMode === 'text' ? 'bg-indigo-600' : 'bg-white/5'}`}>TEXT</button>
                       <button onClick={() => setRefMode('pdf')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${refMode === 'pdf' ? 'bg-indigo-600' : 'bg-white/5'}`}>PDF</button>
                    </div>
                    {refMode === 'text' ? (
                       <textarea className="w-full h-32 bg-black/20 rounded-2xl border border-white/5 p-4 text-sm outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Paste target answer key or notes..." value={state.textInput} onChange={e => setState(s => ({...s, textInput: e.target.value}))} />
                    ) : (
                      <div className="p-8 border-2 border-dashed border-white/10 rounded-3xl text-center cursor-pointer hover:bg-white/5 transition-all" onClick={() => document.getElementById('correct-ref-fup')?.click()}>
                        {correctMeRefFile ? <p className="text-xs font-black text-emerald-400 truncate">{correctMeRefFile.name}</p> : <p className="text-xs font-bold text-slate-500">Upload Reference PDF</p>}
                        <input type="file" id="correct-ref-fup" className="hidden" accept=".pdf" onChange={(e) => setCorrectMeRefFile(e.target.files?.[0] || null)} />
                      </div>
                    )}
                  </div>

                  {/* Step 2: Answer Sheets */}
                  <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 shadow-xl space-y-6">
                    <h3 className="text-xs font-black uppercase text-indigo-400 tracking-widest">Stage 2: Student Input</h3>
                    <div 
                      className="p-12 border-2 border-dashed border-white/10 rounded-3xl text-center cursor-pointer hover:bg-white/5 transition-all group" 
                      onClick={() => document.getElementById('correct-sheets-fup')?.click()}
                    >
                      <svg className="h-10 w-10 mx-auto mb-4 text-slate-500 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      <p className="text-xs font-bold text-slate-500">Upload Answer Sheets (Images/PDFs)</p>
                      <input type="file" id="correct-sheets-fup" className="hidden" multiple accept="image/*,.pdf" onChange={(e) => setCorrectMeFiles(Array.from(e.target.files || []))} />
                    </div>
                    {correctMeFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Pending Nodes ({correctMeFiles.length})</p>
                        <div className="grid gap-2">
                          {correctMeFiles.map((f, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-white/2 rounded-xl border border-white/5">
                              <span className="text-[10px] font-bold text-slate-400 truncate max-w-[200px]">{f.name}</span>
                              <button onClick={() => setCorrectMeFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-rose-500 hover:text-rose-400"><svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={performAssessment}
                    disabled={state.isAnalyzing || correctMeFiles.length === 0}
                    className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black text-xl shadow-glow-indigo hover:bg-indigo-500 transition-all disabled:opacity-30 active:scale-95"
                  >
                    RUN NEURAL AUDIT
                  </button>
                </div>

                <div className="min-w-0">
                  {state.isAnalyzing && (
                    <div className="h-full flex flex-col items-center justify-center py-24 gap-8">
                       <div className="h-20 w-20 animate-spin rounded-full border-[8px] border-indigo-600/10 border-t-indigo-500 shadow-glow-indigo"></div>
                       <p className="text-lg font-black text-white animate-pulse">Audit in Progress...</p>
                    </div>
                  )}
                  {state.assessmentResult && <AssessmentResultView result={state.assessmentResult} activeVoice={state.activeVoiceId} personas={state.profile.voicePersonas} />}
                  {!state.assessmentResult && !state.isAnalyzing && (
                    <div className="h-full border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center p-12 text-center text-slate-700 min-h-[500px]">
                      <svg className="h-20 w-20 mb-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-3xl font-black uppercase mb-4">Diagnostic Idle</p>
                      <p className="text-sm font-medium">Upload inputs to begin verification cycle.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {state.view === 'listenToMe' && (
            <div className="flex flex-col gap-12">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter">Listen To Me</h2>
                <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs">Vocal Validation Module</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  {/* Step 1: Reference */}
                  <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 shadow-xl space-y-6">
                    <h3 className="text-xs font-black uppercase text-indigo-400 tracking-widest">Step 1: Calibration Target</h3>
                    <div className="flex gap-2">
                       <button onClick={() => setState(s => ({ ...s, fileType: 'pdf', file: null }))} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${state.fileType === 'pdf' ? 'bg-indigo-600' : 'bg-white/5'}`}>PDF</button>
                       <button onClick={() => setState(s => ({ ...s, fileType: 'image', file: null }))} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${state.fileType === 'image' ? 'bg-indigo-600' : 'bg-white/5'}`}>IMG</button>
                       <button onClick={() => setState(s => ({ ...s, fileType: 'text', file: null }))} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${state.fileType === 'text' ? 'bg-indigo-600' : 'bg-white/5'}`}>TXT</button>
                    </div>
                    {state.fileType === 'text' ? (
                       <textarea className="w-full h-32 bg-black/20 rounded-2xl border border-white/5 p-4 text-sm" placeholder="Paste truth text..." value={state.textInput} onChange={e => setState(s => ({...s, textInput: e.target.value}))} />
                    ) : (
                      <div className="p-8 border-2 border-dashed border-white/10 rounded-3xl text-center cursor-pointer hover:bg-white/5" onClick={() => document.getElementById('listen-fup')?.click()}>
                        {state.file ? <p className="text-xs font-black text-emerald-400 truncate">{state.file.name}</p> : <p className="text-xs font-bold text-slate-500">Inject Reference Asset</p>}
                        <input type="file" id="listen-fup" className="hidden" onChange={handleFileUpload} />
                      </div>
                    )}
                  </div>

                  {/* Step 2: Audio Recording */}
                  <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 shadow-xl space-y-8">
                    <h3 className="text-xs font-black uppercase text-indigo-400 tracking-widest">Step 2: Vocalize Response</h3>
                    <div className="flex flex-col items-center gap-6">
                      <button 
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`h-24 w-24 rounded-full flex items-center justify-center transition-all shadow-4xl active:scale-95 ${isRecording ? 'bg-rose-500 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                      >
                        {isRecording ? <svg className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>}
                      </button>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                        {isRecording ? "Listening to your thoughts..." : audioBlob ? "Vocal imprint ready" : "Awaiting Neural Command"}
                      </p>
                      {audioUrl && (
                         <audio src={audioUrl} controls className="w-full rounded-full bg-white/5" />
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={performListenToMeAnalysis}
                    disabled={state.isAnalyzing || !audioBlob || (!state.file && !state.textInput)}
                    className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black text-xl shadow-glow-indigo hover:bg-indigo-500 transition-all disabled:opacity-30"
                  >
                    VALIDATE NEURAL OUTPUT
                  </button>
                </div>

                <div className="min-w-0">
                  {state.isAnalyzing && (
                    <div className="h-full flex flex-col items-center justify-center py-24 gap-8">
                       <div className="h-20 w-20 animate-spin rounded-full border-[8px] border-indigo-600/10 border-t-indigo-500"></div>
                       <p className="text-lg font-black text-white animate-pulse">Syncing Vocal Imprint...</p>
                    </div>
                  )}
                  {state.listenToMeResult && <ListenToMeView result={state.listenToMeResult} audioUrl={audioUrl || undefined} />}
                  {!state.listenToMeResult && !state.isAnalyzing && (
                    <div className="h-full border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center p-12 text-center text-slate-700">
                      <p className="text-3xl font-black uppercase mb-4">Awaiting Signal</p>
                      <p className="text-sm font-medium">Record your answer to see the breakdown.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {state.view === 'history' && (
             <div className="space-y-10 md:space-y-16 py-6 md:py-12 max-w-5xl mx-auto w-full px-2">
                <div className="space-y-4 text-center md:text-left">
                  <h2 className="text-5xl md:text-8xl font-black tracking-tighter text-white leading-none">Archives</h2>
                  <p className="text-[10px] md:text-sm font-black text-indigo-500 uppercase tracking-[0.6em]">Stored Memories</p>
                </div>
                <div className="grid gap-6 md:gap-8 mt-12 md:mt-16">
                   {state.history.length === 0 ? (
                      <div className="p-20 md:p-40 text-center border-4 border-dashed border-white/5 rounded-[40px] md:rounded-[80px] bg-white/5">
                         <p className="text-slate-700 font-black text-3xl md:text-5xl uppercase tracking-widest">Null Set</p>
                      </div>
                   ) : state.history.map(item => (
                     <div key={item.id} className="p-5 md:p-10 bg-white/5 border border-white/10 rounded-[32px] md:rounded-[48px] flex flex-col md:flex-row items-center justify-between group hover:bg-white/10 transition-all cursor-pointer shadow-4xl gap-6 md:gap-10" onClick={() => handleRecallHistory(item)}>
                        <div className="flex items-center gap-5 md:gap-8 w-full md:w-auto">
                           <div className="h-16 w-16 md:h-24 md:w-24 bg-indigo-600/10 text-indigo-400 rounded-2xl md:rounded-[32px] flex items-center justify-center font-black text-lg md:text-2xl border border-indigo-500/10 shadow-inner shrink-0">{item.type === 'pdf' ? 'PDF' : item.type === 'image' ? 'IMG' : 'DOC'}</div>
                           <div className="min-w-0 flex-1">
                              <p className="text-lg md:text-3xl lg:text-4xl font-black text-white tracking-tighter truncate group-hover:text-indigo-400 transition-colors leading-tight">{item.title}</p>
                              <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 md:mt-4">
                                 <span className="text-[8px] md:text-[11px] font-black text-slate-500 bg-black/40 px-3 md:px-4 py-1.5 rounded-full border border-white/5 uppercase tracking-widest">{new Date(item.date).toLocaleDateString()}</span>
                                 <span className="text-[8px] md:text-[11px] font-black text-indigo-400 uppercase tracking-widest">{item.language}</span>
                                 {item.type === 'pdf' && (
                                   <span className="text-[8px] md:text-[11px] font-black text-emerald-400 uppercase tracking-widest">{Object.keys(item.pdfData?.pageResults || {}).length} Node(s)</span>
                                 )}
                              </div>
                           </div>
                        </div>
                        <button className="w-full md:w-auto px-8 md:px-12 py-3 md:py-4 bg-indigo-600 text-white rounded-2xl md:rounded-[24px] font-black uppercase text-[10px] md:text-base tracking-widest hover:bg-indigo-500 transition-all shadow-glow-indigo border border-white/10 shrink-0">RESUME</button>
                     </div>
                   ))}
                </div>
             </div>
          )}

          {state.view === 'profile' && (
            <div className="max-w-4xl mx-auto py-12 w-full px-4">
               <div className="bg-white/5 backdrop-blur-3xl p-10 md:p-24 rounded-[48px] md:rounded-[80px] border border-white/10 shadow-4xl text-center space-y-12 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-600 via-rose-600 to-indigo-600"></div>
                  <div className="h-32 w-32 md:h-48 md:w-48 bg-indigo-600 text-white text-4xl md:text-6xl flex items-center justify-center rounded-[32px] md:rounded-[60px] mx-auto font-black shadow-4xl border-4 border-white/10">
                    {state.profile.name[0]}
                  </div>
                  <div className="space-y-4">
                     <h2 className="text-4xl md:text-8xl font-black text-white tracking-tighter leading-none">{state.profile.name}</h2>
                     <p className="text-indigo-400 font-black uppercase tracking-[0.4em] text-xs">Neural Identity Validated</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-12">
                    <div className="p-8 md:p-16 bg-black/40 rounded-[32px] md:rounded-[60px] border border-white/5 shadow-inner">
                      <p className="text-5xl md:text-9xl font-black text-white tracking-tighter leading-none">{state.profile.totalAnalyses}</p>
                      <p className="text-[10px] md:text-xs font-black text-slate-600 uppercase tracking-[0.3em] mt-8">Extracted Insights</p>
                    </div>
                    <div className="p-8 md:p-16 bg-black/40 rounded-[32px] md:rounded-[60px] border border-white/5 shadow-inner">
                      <p className="text-5xl md:text-9xl font-black text-white tracking-tighter leading-none">{state.history.length}</p>
                      <p className="text-[10px] md:text-xs font-black text-slate-600 uppercase tracking-[0.3em] mt-8">Total Memories</p>
                    </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
