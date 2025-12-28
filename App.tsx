
import React, { useState, useRef, useEffect } from 'react';
import ProcessingModule from './components/ProcessingModule';
import SearchModule from './components/SearchModule';
import ChatModule from './components/ChatModule';
import { Acordao, SearchResult, ChatSession } from './types';
import { Scale, Save, Key, Briefcase, Gavel, Scale as ScaleIcon, ArrowRight, RotateCcw, Info, Sparkles, ExternalLink, Eye, EyeOff, LogOut } from 'lucide-react';

const DEFAULT_SOCIAL = ["Abandono do trabalho", "Acidente de trabalho", "Assédio", "Despedimento", "Férias", "Greve", "Insolvência", "Retribuição"];

function App() {
  const [db, setDb] = useState<Acordao[]>([]);
  const [savedSearches, setSavedSearches] = useState<SearchResult[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [descriptors, setDescriptors] = useState<{social: string[], crime: string[], civil: string[]}>({
    social: Array.from(new Set(DEFAULT_SOCIAL)).sort(),
    crime: [],
    civil: []
  });
  const [judges, setJudges] = useState<string[]>([]);
  const [legalArea, setLegalArea] = useState<'social' | 'crime' | 'civil' | null>(null);
  const [activeTab, setActiveTab] = useState<'process' | 'search' | 'chat'>('process');
  const [rootHandleName, setRootHandleName] = useState<string | null>(null);
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [cachedFiles, setCachedFiles] = useState<File[]>([]);
  
  // @google/genai guidelines: Removed manual API key management states.
  
  // Onboarding Step - Skip welcome screen as API key management is external.
  const [onboardingStep, setOnboardingStep] = useState<'area' | 'app'>('area');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectLegalArea = (area: 'social' | 'crime' | 'civil') => {
    setLegalArea(area);
    setOnboardingStep('app');
  };

  // --- Lógica de Base de Dados ---
  const updateJudgesList = (currentDb: Acordao[]) => {
    const extracted = new Set<string>();
    currentDb.forEach(ac => {
      if (ac.relator && ac.relator !== 'Desconhecido') extracted.add(ac.relator.trim());
      ac.adjuntos.forEach(adj => { if (adj) extracted.add(adj.trim()); });
    });
    setJudges(Array.from(extracted).sort());
  };

  useEffect(() => {
    updateJudgesList(db);
  }, [db]);

  const handleMergeJudges = (main: string, others: string[]) => {
    const updatedDb = db.map(ac => {
      let changed = false;
      let newRelator = ac.relator;
      if (others.includes(ac.relator)) {
        newRelator = main;
        changed = true;
      }
      const newAdjuntos = ac.adjuntos.map(adj => others.includes(adj) ? main : adj);
      const uniqueAdjuntos = Array.from(new Set(newAdjuntos)).filter(a => a !== newRelator);
      if (JSON.stringify(uniqueAdjuntos) !== JSON.stringify(ac.adjuntos)) changed = true;
      return changed ? { ...ac, relator: newRelator, adjuntos: uniqueAdjuntos } : ac;
    });
    setDb(updatedDb);
    updateJudgesList(updatedDb);
  };

  const handleSetRoot = (handle: FileSystemDirectoryHandle) => {
    setRootHandle(handle);
    setRootHandleName(handle.name);
    setActiveTab('process');
  };

  const getPdfData = async (fileName: string): Promise<ArrayBuffer | null> => {
    if (rootHandle) {
       const findFile = async (dir: FileSystemDirectoryHandle, name: string): Promise<FileSystemFileHandle | null> => {
          for await (const entry of (dir as any).values()) {
             if (entry.kind === 'file' && entry.name === name) return entry;
             if (entry.kind === 'directory') {
                const found = await findFile(entry as any, name);
                if (found) return found;
             }
          }
          return null;
       };
       const handle = await findFile(rootHandle, fileName);
       if (handle) return await (await handle.getFile()).arrayBuffer();
    } else {
       const file = cachedFiles.find(f => f.name === fileName);
       if (file) return await file.arrayBuffer();
    }
    return null;
  };

  const openPdf = async (fileName: string) => {
    const buffer = await getPdfData(fileName);
    if (buffer) {
      const blob = new Blob([buffer], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    }
  };

  const handleSaveDb = () => {
    const json = JSON.stringify({ db, savedSearches, chatSessions, descriptors, judges }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `juris_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleLoadDbFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.db) setDb(prev => [...prev, ...parsed.db.filter((x:any) => !prev.find(p=>p.id===x.id))]);
        if (parsed.savedSearches) setSavedSearches(parsed.savedSearches);
        if (parsed.chatSessions) setChatSessions(parsed.chatSessions);
        setOnboardingStep('app');
      } catch (err) {}
    };
    reader.readAsText(file);
  };

  // --- RENDER ONBOARDING ---
  if (onboardingStep !== 'app') {
    return (
      <div className="fixed inset-0 bg-[#0f172a] z-[100] flex items-center justify-center p-4">
        <div className="bg-[#1e293b] rounded-[32px] shadow-2xl p-10 max-w-[500px] w-full text-center animate-in zoom-in-95 duration-500 border border-slate-700/50">
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-10 flex justify-center">
                <div className="p-8 bg-blue-600/10 rounded-full border border-blue-600/20 shadow-inner">
                  <Sparkles className="w-12 h-12 text-blue-500"/>
                </div>
              </div>
              <h2 className="text-3xl font-black mb-2 tracking-tighter text-white uppercase">Área Jurídica</h2>
              <p className="text-slate-400 mb-10 text-sm">Selecione a jurisdição para carregar os descritores adequados.</p>
              
              <div className="grid grid-cols-1 gap-4">
                {['social', 'crime', 'civil'].map((area: any) => (
                  <button 
                    key={area} 
                    onClick={() => selectLegalArea(area)} 
                    className="group p-6 rounded-[24px] border border-slate-700 bg-slate-800/50 hover:border-blue-500 hover:bg-slate-800 transition-all flex items-center gap-6 text-left active:scale-95 shadow-sm"
                  >
                    <div className="p-4 bg-slate-700 rounded-2xl border border-slate-600 group-hover:border-blue-900 transition-all shadow-xl group-hover:bg-blue-900/20">
                      {area === 'social' ? <Briefcase className="w-8 h-8 text-blue-400"/> : area === 'crime' ? <Gavel className="w-8 h-8 text-blue-400"/> : <ScaleIcon className="w-8 h-8 text-blue-400"/>}
                    </div>
                    <div>
                        <div className="capitalize font-black text-xl text-white tracking-tighter">Área {area}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Aceder ao Painel</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleLoadDbFile}/>
      </div>
    );
  }

  // --- APP MAIN INTERFACE ---
  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans selection:bg-legal-100">
      <header className="bg-legal-900 text-white shadow-xl z-50 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-legal-800 rounded-2xl border border-legal-700">
                <ScaleIcon className="w-8 h-8 text-legal-100" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter leading-none uppercase">JurisAnalítica</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] text-legal-300 uppercase tracking-[0.2em] font-black">Sessão: {legalArea}</p>
                <button onClick={() => setOnboardingStep('area')} className="text-[9px] bg-legal-700 hover:bg-legal-600 px-2 py-0.5 rounded uppercase font-black tracking-widest flex items-center gap-1 transition-all">
                   <RotateCcw className="w-2.5 h-2.5" /> Mudar Área
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/30 border border-green-500/30 rounded-full group">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-green-400">IA Ativa</span>
                </div>
            </div>
            <div className="h-10 w-px bg-legal-700 opacity-30 mx-2"></div>
            <button onClick={() => fileInputRef.current?.click()} className="text-[11px] font-black uppercase tracking-widest text-legal-300 hover:text-white transition-all px-2">Importar</button>
            <button onClick={handleSaveDb} className="flex items-center gap-2.5 px-6 py-3 bg-white text-legal-900 hover:bg-legal-100 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95">
              <Save className="w-4 h-4" /> Exportar Backup
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        {!rootHandleName && db.length === 0 ? (
          <ProcessingModule 
            onDataLoaded={(newData) => setDb(prev => [...prev, ...newData])} 
            existingDB={db}
            onSetRootHandle={handleSetRoot}
            rootHandleName={rootHandleName}
            onCacheFiles={setCachedFiles}
            onAddDescriptors={(cat, list) => setDescriptors(p => ({...p, [cat]: Array.from(new Set([...p[cat], ...list])).sort()}))}
            onAddJudges={(list) => setJudges(p => Array.from(new Set([...p, ...list])).sort())}
            onMergeJudges={handleMergeJudges}
            availableJudges={judges}
            availableDescriptors={legalArea ? descriptors[legalArea] : []}
          />
        ) : (
          <>
            <div className="bg-white border-b px-8 pt-4 flex gap-8 flex-shrink-0 shadow-sm z-10">
               {['process', 'search', 'chat'].map((tab: any) => (
                 <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-4 px-2 text-[11px] font-black uppercase tracking-[0.15em] border-b-[3px] transition-all ${activeTab === tab ? 'border-legal-600 text-legal-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                    {tab === 'process' ? 'Processamento' : tab === 'search' ? 'Biblioteca' : 'Consultoria'}
                 </button>
               ))}
            </div>
            <div className="flex-1 overflow-hidden bg-gray-50 relative">
               {activeTab === 'process' && (
                 <ProcessingModule 
                   onDataLoaded={d => setDb(p => [...p, ...d])} 
                   existingDB={db} 
                   onSetRootHandle={handleSetRoot} 
                   rootHandleName={rootHandleName} 
                   onCacheFiles={setCachedFiles} 
                   onAddDescriptors={(cat, l) => setDescriptors(p=>({...p, [cat]:l}))} 
                   onAddJudges={setJudges} 
                   onMergeJudges={handleMergeJudges}
                   availableJudges={judges} 
                   availableDescriptors={legalArea?descriptors[legalArea]:[]}
                 />
               )}
               {activeTab === 'search' && <SearchModule db={db} onSaveSearch={s => setSavedSearches(p => [...p, s])} savedSearches={savedSearches} onDeleteSearch={id => setSavedSearches(p => p.filter(s=>s.id!==id))} onUpdateSearchName={(id, n) => setSavedSearches(p => p.map(s=>s.id===id?({...s, name:n}):s))} onOpenPdf={openPdf} onGetPdfData={getPdfData} onUpdateAcordao={u => setDb(p => p.map(x=>x.id===u.id?u:x))} availableDescriptors={legalArea?descriptors[legalArea]:[]} availableJudges={judges} onAddDescriptors={l => setDescriptors(p=>({...p, [legalArea!]:l}))}/>}
               {activeTab === 'chat' && <ChatModule db={db} sessions={chatSessions} onSaveSession={s => setChatSessions(p => p.find(x=>x.id===s.id) ? p.map(x=>x.id===s.id?s:x) : [s, ...p])} onDeleteSession={id => setChatSessions(p => p.filter(s=>s.id!==id))} onOpenPdf={openPdf}/>}
            </div>
          </>
        )}
      </div>
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleLoadDbFile}/>
    </div>
  );
}

export default App;
