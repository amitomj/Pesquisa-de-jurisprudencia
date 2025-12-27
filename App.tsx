
import React, { useState, useRef, useEffect } from 'react';
import ProcessingModule from './components/ProcessingModule';
import SearchModule from './components/SearchModule';
import ChatModule from './components/ChatModule';
import { Acordao, SearchResult, ChatSession } from './types';
import { Scale, Save, Key, Briefcase, Gavel, Scale as ScaleIcon, ShieldCheck, ArrowRight, Lock } from 'lucide-react';

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
  const [hasUserKey, setHasUserKey] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<'key' | 'area' | 'app'>('key');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        try {
          // @ts-ignore
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasUserKey(selected);
          if (selected) setOnboardingStep('area');
        } catch (e) {}
      }
    };
    checkKey();
  }, []);

  const handleEnterWithKey = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      try {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setHasUserKey(true);
        setOnboardingStep('area');
      } catch (e) {
        setOnboardingStep('area');
      }
    } else {
      setOnboardingStep('area');
    }
  };

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
    alert(`Identidades fundidas com sucesso.`);
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
    } else alert('Ficheiro não encontrado.');
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
        alert('Dados importados.');
        setActiveTab('search');
        setOnboardingStep('app');
      } catch (err) { alert('Erro ao carregar ficheiro.'); }
    };
    reader.readAsText(file);
  };

  const selectLegalArea = (area: 'social' | 'crime' | 'civil') => {
    setLegalArea(area);
    setOnboardingStep('app');
  };

  // Render Onboarding
  if (onboardingStep !== 'app') {
    return (
      <div className="fixed inset-0 bg-legal-900 z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-[40px] shadow-2xl p-10 max-w-xl w-full text-center animate-in zoom-in-95 duration-500 overflow-hidden relative border-t-8 border-legal-600">
          
          {onboardingStep === 'key' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8 flex justify-center">
                <div className="p-6 bg-blue-50 rounded-full">
                  <Lock className="w-12 h-12 text-blue-600"/>
                </div>
              </div>
              <h2 className="text-3xl font-black mb-3 tracking-tighter text-legal-900">JurisAnalítica</h2>
              <p className="text-gray-500 mb-8 font-medium">
                Para iniciar a análise local dos acórdãos, introduza a sua chave de acesso Gemini.
              </p>
              
              <button 
                onClick={handleEnterWithKey} 
                className="w-full bg-legal-900 text-white p-6 rounded-3xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl active:scale-95 mb-4"
              >
                <Key className="w-5 h-5 text-legal-200" />
                Colar Chave e Entrar
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest flex items-center justify-center gap-2">
                <ShieldCheck className="w-3 h-3"/> Processamento 100% Local e Seguro
              </p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8 flex justify-center">
                <div className="p-6 bg-legal-50 rounded-full">
                  <ScaleIcon className="w-12 h-12 text-legal-700"/>
                </div>
              </div>
              <h2 className="text-3xl font-black mb-2 tracking-tighter text-legal-900">Área de Atuação</h2>
              <p className="text-gray-500 mb-10 font-medium">Selecione a jurisdição pretendida.</p>
              
              <div className="grid grid-cols-1 gap-4">
                {['social', 'crime', 'civil'].map((area: any) => (
                  <button 
                    key={area} 
                    onClick={() => selectLegalArea(area)} 
                    className="group p-5 rounded-3xl border-2 border-gray-100 hover:border-legal-600 hover:bg-legal-50 transition-all flex items-center gap-5 text-left active:scale-95"
                  >
                    <div className="p-3 bg-white rounded-2xl border border-gray-100 group-hover:border-legal-200 transition-all">
                      {area === 'social' ? <Briefcase className="w-7 h-7 text-legal-600"/> : area === 'crime' ? <Gavel className="w-7 h-7 text-legal-600"/> : <ScaleIcon className="w-7 h-7 text-legal-600"/>}
                    </div>
                    <div>
                        <div className="capitalize font-black text-xl text-gray-800 tracking-tight">Área {area}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Clique para aceder</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans selection:bg-legal-100">
      <header className="bg-legal-900 text-white shadow-xl z-50 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-legal-800 rounded-2xl border border-legal-700">
                <Scale className="w-8 h-8 text-legal-100" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter leading-none">JurisAnalítica</h1>
              <p className="text-[10px] text-legal-300 uppercase tracking-[0.2em] font-black mt-1">Sessão Ativa • {legalArea}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-900/30 border border-green-500/30 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Motor de IA Pronto</span>
            </div>
            <div className="h-10 w-px bg-legal-700 opacity-30 mx-2"></div>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleLoadDbFile}/>
            <button onClick={() => fileInputRef.current?.click()} className="text-[11px] font-black uppercase tracking-widest text-legal-300 hover:text-white transition-all">Importar</button>
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
    </div>
  );
}

export default App;
