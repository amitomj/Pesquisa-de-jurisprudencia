
import React, { useState, useRef, useEffect } from 'react';
import ProcessingModule from './components/ProcessingModule';
import SearchModule from './components/SearchModule';
import ChatModule from './components/ChatModule';
import { Acordao, ChatSession } from './types';
import { 
  Database, 
  Settings, 
  X, 
  PlayCircle, 
  Key, 
  Briefcase, 
  Gavel, 
  Scale as ScaleIcon, 
  ChevronRight, 
  FileJson, 
  FolderOpen,
  ShieldCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';

// Inicialização imediata do shim de process.env para o browser/Vercel
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
  // Recupera do localStorage se já existir para evitar erro de inicialização
  if (!(window as any).process.env.API_KEY) {
    (window as any).process.env.API_KEY = localStorage.getItem('gemini_api_key') || '';
  }
}

const SOCIAL_DESCRIPTORS_LIST = [
  "Abandono do trabalho", "Acidente de trabalho", "Assédio", "Caducidade", "Categoria profissional", "Contrato de trabalho",
  "Despedimento", "Despedimento ilícito", "Direito a férias", "Doença profissional", "Faltas injustificadas", "Greve",
  "Horário de trabalho", "Indemnização", "Justa causa", "Lay-off", "Retribuição", "Subsídio de Natal", "Trabalho suplementar"
];

function App() {
  const [db, setDb] = useState<Acordao[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [descriptors, setDescriptors] = useState<{social: string[], crime: string[], civil: string[]}>({
    social: Array.from(new Set(SOCIAL_DESCRIPTORS_LIST)).sort(),
    crime: [],
    civil: []
  });
  const [judges, setJudges] = useState<string[]>([]);
  const [legalArea, setLegalArea] = useState<'social' | 'crime' | 'civil' | null>(null);
  const [activeTab, setActiveTab] = useState<'process' | 'search' | 'chat'>('process');
  
  const [folderName, setFolderName] = useState<string | null>(null);
  const [fileCache, setFileCache] = useState<Map<string, File>>(new Map());
  const [manualKey, setManualKey] = useState<string>(localStorage.getItem('gemini_api_key') || '');
  const [isIndexing, setIsIndexing] = useState(false);
  
  const [onboardingStep, setOnboardingStep] = useState<'area' | 'setup' | 'app'>('area');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza a chave manual com o objeto global exigido pelo SDK
  useEffect(() => {
    if (manualKey) {
      localStorage.setItem('gemini_api_key', manualKey);
      if ((window as any).process && (window as any).process.env) {
        (window as any).process.env.API_KEY = manualKey;
      }
    }
  }, [manualKey]);

  const selectLegalArea = (area: 'social' | 'crime' | 'civil') => {
    setLegalArea(area);
    setOnboardingStep('setup');
  };

  useEffect(() => {
    const extracted = new Set<string>();
    db.forEach(ac => {
      if (ac.relator && ac.relator !== 'Desconhecido') extracted.add(ac.relator.trim());
      ac.adjuntos.forEach(adj => { if (adj && adj.trim().length > 0) extracted.add(adj.trim()); });
    });
    setJudges(Array.from(extracted).sort((a, b) => a.localeCompare(b, 'pt-PT')));
  }, [db]);

  const handleMergeJudges = (main: string, others: string[]) => {
    const mainClean = main.trim();
    const othersLower = others.map(o => o.trim().toLowerCase());
    setDb(currentDb => currentDb.map(ac => {
        let changed = false;
        let newRelator = ac.relator.trim();
        if (othersLower.includes(newRelator.toLowerCase())) { newRelator = mainClean; changed = true; }
        const newAdjuntos = ac.adjuntos.map(adj => {
          if (othersLower.includes(adj.trim().toLowerCase())) { changed = true; return mainClean; }
          return adj.trim();
        });
        if (changed) {
            const uniqueAdjuntos = Array.from(new Set(newAdjuntos)).filter((a: string) => a.toLowerCase() !== newRelator.toLowerCase() && a.length > 0);
            return { ...ac, relator: newRelator, adjuntos: uniqueAdjuntos };
        }
        return ac;
    }));
  };

  const handleAddAcordaos = (incoming: Acordao[]) => {
    setDb(currentDb => {
        const dbMap = new Map<string, Acordao>();
        currentDb.forEach(a => dbMap.set(a.filePath.toLowerCase().trim(), a));
        incoming.forEach(newA => {
            const key = (newA.filePath || newA.fileName).toLowerCase().trim();
            if (!dbMap.has(key)) dbMap.set(key, newA);
        });
        return Array.from(dbMap.values());
    });
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsIndexing(true);
    const newCache = new Map<string, File>();
    const firstFile = files[0];
    
    setFolderName(firstFile.webkitRelativePath ? firstFile.webkitRelativePath.split('/')[0] : "Biblioteca Local");

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.toLowerCase().endsWith('.pdf')) {
        if (f.webkitRelativePath) newCache.set(f.webkitRelativePath.toLowerCase(), f);
        newCache.set(f.name.toLowerCase(), f);
      }
    }
    
    setFileCache(newCache);
    setIsIndexing(false);
  };

  const openPdf = async (filePath: string) => {
    const fileName = (filePath.split('/').pop() || filePath).toLowerCase();
    const file = fileCache.get(filePath.toLowerCase()) || fileCache.get(fileName);
    
    if (!file) {
      alert(`⚠️ Ficheiro "${fileName}" não encontrado localmente.`);
      return;
    }
    window.open(URL.createObjectURL(file), '_blank');
  };

  const handleSaveDb = () => {
    const json = JSON.stringify({ db, descriptors, judges }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `juris_base_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleLoadDbFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.db) handleAddAcordaos(parsed.db);
        if (parsed.descriptors) setDescriptors(parsed.descriptors);
      } catch (err) { alert("Erro ao ler backup."); }
    };
    reader.readAsText(file);
  };

  const mainContent = onboardingStep === 'app' ? (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-legal-900 text-white shadow-xl z-50 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ScaleIcon className="w-8 h-8 text-legal-100" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">JurisAnalítica</h1>
              <p className="text-[9px] text-legal-400 uppercase tracking-widest font-black mt-1">Sessão {legalArea}</p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {fileCache.size === 0 && (
                <div className="bg-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg border border-orange-500/30 text-[9px] font-black uppercase flex items-center gap-2">
                    <AlertCircle className="w-3 h-3"/> Biblioteca Local Offline
                </div>
            )}
            <div className="flex gap-2 p-1 bg-legal-800/40 rounded-2xl border border-legal-700">
                <button onClick={handleSaveDb} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-[9px] font-black uppercase transition-all shadow-lg"><Database className="w-3.5 h-3.5" /> Backup</button>
            </div>
            <button onClick={() => setOnboardingStep('setup')} className="p-2.5 text-legal-300 hover:text-white transition-all bg-legal-800/20 rounded-xl border border-legal-700 ml-1"><Settings className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-white border-b px-8 pt-4 flex gap-8 flex-shrink-0 shadow-sm z-10">
            {['process', 'search', 'chat'].map((tab: any) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-4 px-2 text-[11px] font-black uppercase tracking-[0.15em] border-b-[3px] transition-all ${activeTab === tab ? 'border-legal-600 text-legal-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                {tab === 'process' ? 'Processamento' : tab === 'search' ? 'Biblioteca' : 'Consultoria IA'}
              </button>
            ))}
        </div>
        <div className="flex-1 overflow-hidden bg-gray-50 relative">
            {activeTab === 'process' && legalArea && (
              <ProcessingModule onDataLoaded={handleAddAcordaos} existingDB={db} onSetRootHandle={() => {}} rootHandleName={folderName} onCacheFiles={() => {}} onAddDescriptors={(cat, l) => setDescriptors(p=>({...p, [cat]:l}))} onAddJudges={setJudges} onMergeJudges={handleMergeJudges} availableJudges={judges} availableDescriptors={descriptors[legalArea]} legalArea={legalArea} onUpdateDb={setDb} onSaveDb={handleSaveDb} filesFromFolder={Array.from(fileCache.values())} />
            )}
            {activeTab === 'search' && (
              <SearchModule db={db} onOpenPdf={openPdf} onUpdateAcordao={u => setDb(p => p.map(x=>x.id===u.id?u:x))} availableDescriptors={legalArea?descriptors[legalArea]:[]} availableJudges={judges} />
            )}
            {activeTab === 'chat' && (
              <ChatModule db={db} sessions={chatSessions} onSaveSession={s => setChatSessions(p => { const idx = p.findIndex(x => x.id === s.id); return idx > -1 ? p.map(x=>x.id===s.id?s:x) : [s, ...p]; })} onDeleteSession={(id) => setChatSessions(p => p.filter(s => s.id !== id))} onOpenPdf={openPdf} />
            )}
        </div>
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 bg-[#020617] z-[100] flex items-center justify-center p-6 font-sans overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>

      {onboardingStep === 'area' ? (
        <div className="max-w-[1000px] w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
            <div className="mb-12 flex flex-col items-center">
                <div className="p-8 bg-blue-600/10 rounded-full border border-blue-500/20 mb-8 shadow-2xl shadow-blue-500/10">
                    <Database className="w-16 h-16 text-blue-500" />
                </div>
                <h1 className="text-6xl font-black text-white tracking-tighter uppercase mb-2">VERITAS FORENSE V2</h1>
                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-sm">Sistema de Transcrição e Análise Jurídica Profissional</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
              {['social', 'crime', 'civil'].map((area: any) => (
                <button key={area} onClick={() => selectLegalArea(area)} className="group p-8 rounded-[32px] border border-slate-800 bg-slate-900/40 hover:border-blue-500/50 hover:bg-slate-800 transition-all flex flex-col items-center text-center gap-6 active:scale-95">
                  <div className="p-6 bg-slate-800 rounded-3xl group-hover:bg-blue-600/20 group-hover:scale-110 transition-all">
                    {area === 'social' ? <Briefcase className="w-10 h-10 text-blue-400"/> : area === 'crime' ? <Gavel className="w-10 h-10 text-blue-400"/> : <ScaleIcon className="w-10 h-10 text-blue-400"/>}
                  </div>
                  <div>
                      <div className="capitalize font-black text-2xl text-white tracking-tighter">Área {area}</div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Sessão Local Segura</div>
                  </div>
                </button>
              ))}
            </div>
        </div>
      ) : (
        <div className="bg-[#0f172a]/80 backdrop-blur-xl rounded-[48px] shadow-2xl p-16 max-w-[700px] w-full border border-slate-800/50 relative overflow-hidden animate-in slide-in-from-bottom-10 duration-500 flex flex-col items-center">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
            
            <div className="mb-12 flex flex-col items-center">
                <div className="p-6 bg-blue-600 rounded-full mb-8 shadow-2xl shadow-blue-600/40">
                    <Database className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">VERITAS FORENSE V2</h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Configuração Geral</p>
            </div>

            <div className="w-full space-y-8 mb-12">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                        <Key className="w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input 
                        type="password"
                        placeholder="Insira a sua Gemini API Key..."
                        className="w-full bg-[#0a0f1e] border border-slate-800 rounded-[24px] py-6 pl-16 pr-6 text-white text-lg font-bold placeholder:text-slate-600 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all shadow-inner"
                        value={manualKey}
                        onChange={(e) => setManualKey(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-4 p-8 bg-[#0a0f1e] border border-slate-800 rounded-[32px] hover:bg-slate-800 transition-all group active:scale-95"
                    >
                        <div className="p-4 bg-green-500/10 rounded-2xl group-hover:bg-green-500/20">
                            <FileJson className="w-8 h-8 text-green-500" />
                        </div>
                        <div className="text-center">
                            <div className="text-white font-black text-sm uppercase tracking-tighter">PROJETO</div>
                            <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1">Restaurar Estado</div>
                        </div>
                        {db.length > 0 && <div className="bg-green-500 text-[8px] text-white px-2 py-0.5 rounded-full font-black">{db.length} ACÓRDÃOS</div>}
                    </button>

                    <button 
                        onClick={() => directoryInputRef.current?.click()}
                        className="flex flex-col items-center gap-4 p-8 bg-[#0a0f1e] border border-slate-800 rounded-[32px] hover:bg-slate-800 transition-all group active:scale-95"
                    >
                        <div className="p-4 bg-blue-500/10 rounded-2xl group-hover:bg-blue-500/20">
                            <FolderOpen className="w-8 h-8 text-blue-500" />
                        </div>
                        <div className="text-center">
                            <div className="text-white font-black text-sm uppercase tracking-tighter">BASE DADOS</div>
                            <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1">Sincronizar PDFs</div>
                        </div>
                        {fileCache.size > 0 && <div className="bg-blue-500 text-[8px] text-white px-2 py-0.5 rounded-full font-black">{fileCache.size} FICHEIROS</div>}
                        {isIndexing && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                    </button>
                </div>
            </div>

            <div className="w-full space-y-4">
                <button 
                    onClick={() => setOnboardingStep('app')}
                    disabled={!manualKey && !((window as any).process?.env?.API_KEY)}
                    className="w-full py-8 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-[32px] font-black text-xl uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/20 transition-all flex items-center justify-center gap-4 group active:scale-95"
                >
                    INICIAR APLICAÇÃO <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </button>
                <div className="flex items-center justify-center gap-2 text-slate-500 text-[9px] font-black uppercase tracking-widest">
                    <ShieldCheck className="w-3.5 h-3.5" /> Encriptação de Sessão Local Ativa
                </div>
            </div>

            <button onClick={() => setOnboardingStep('area')} className="absolute top-10 right-10 p-3 text-slate-500 hover:text-white transition-all">
                <X className="w-8 h-8" />
            </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {mainContent}
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleLoadDbFile} />
      <input type="file" ref={chatInputRef} className="hidden" accept=".json" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  try {
                      const parsed = JSON.parse(ev.target?.result as string);
                      if (parsed.chatSessions) setChatSessions(parsed.chatSessions);
                  } catch (err) { alert("Erro ao ler chats."); }
              };
              reader.readAsText(file);
          }
      }} />
      <input 
        type="file" 
        ref={directoryInputRef} 
        className="hidden" 
        webkitdirectory="true" 
        directory="true" 
        multiple 
        onChange={handleDirectorySelect} 
      />
    </>
  );
}

export default App;
