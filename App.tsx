
import React, { useState, useRef, useEffect } from 'react';
import ProcessingModule from './components/ProcessingModule';
import SearchModule from './components/SearchModule';
import ChatModule from './components/ChatModule';
import { Acordao, ChatSession } from './types';
import { Scale, Save, Briefcase, Gavel, Scale as ScaleIcon, Upload, MessageSquare, Download, History, Database, Trash2, Key, ShieldCheck, AlertCircle, Info, Lock, ExternalLink, Globe, Loader2, Settings, FolderOpen, X } from 'lucide-react';

const SOCIAL_DESCRIPTORS_LIST = [
  "Abandono do trabalho", "Acidente de trabalho", "Categoria profissional", "Contrato de trabalho", "Despedimento", "Férias", "Horário de trabalho", "Indemnização", "Justa causa", "Retribuição", "Segurança Social", "Trabalho suplementar"
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
  const [rootHandleName, setRootHandleName] = useState<string | null>(null);
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  
  // BYOK State - Frontend Only
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [isAiConfigured, setIsAiConfigured] = useState<boolean>(false);
  
  const [onboardingStep, setOnboardingStep] = useState<'area' | 'app'>('area');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Carrega key do localStorage ao iniciar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gemini_user_key');
      if (stored && stored.length > 20) {
        setUserApiKey(stored);
        setIsAiConfigured(true);
      }
    }
  }, []);

  // Botão "Configurar IA" - Frontend Only sem window.aistudio
  const handleSetupKey = () => {
    const key = window.prompt(
      'Configuração de IA (Apenas Frontend):\n\n' +
      'Cole aqui a sua Gemini API Key.\n\n' +
      '✓ Fica guardada apenas neste browser\n' +
      '✓ Sem backend, 100% privado e seguro\n' +
      '✓ Usa a sua própria quota/créditos',
      userApiKey || ''
    );
    
    if (key !== null) {
      const trimmed = key.trim();
      if (trimmed === '') {
        setUserApiKey('');
        setIsAiConfigured(false);
        localStorage.removeItem('gemini_user_key');
      } else if (trimmed.length < 20) {
        alert('Chave inválida (deve ter aproximadamente 40 caracteres).');
      } else {
        setUserApiKey(trimmed);
        setIsAiConfigured(true);
        localStorage.setItem('gemini_user_key', trimmed);
      }
    }
  };

  const selectLegalArea = (area: 'social' | 'crime' | 'civil') => {
    setLegalArea(area);
    setOnboardingStep('app');
  };

  useEffect(() => {
    const extracted = new Set<string>();
    db.forEach(ac => {
      if (ac.relator && ac.relator !== 'Desconhecido') extracted.add(ac.relator.trim());
      ac.adjuntos.forEach(adj => { 
        if (adj && adj !== 'Nenhum' && adj.trim().length > 0) extracted.add(adj.trim()); 
      });
    });
    setJudges(Array.from(extracted).sort((a, b) => a.localeCompare(b, 'pt-PT')));
  }, [db]);

  const handleMergeJudges = (main: string, others: string[]) => {
    const mainClean = main.trim();
    const othersLower = others.map(o => o.trim().toLowerCase());

    setDb(currentDb => {
      return currentDb.map(ac => {
        let changed = false;
        let newRelator = ac.relator.trim();
        if (othersLower.includes(newRelator.toLowerCase())) {
          newRelator = mainClean;
          changed = true;
        }
        const newAdjuntos = ac.adjuntos.map(adj => {
          const adjTrimmed = adj.trim();
          if (othersLower.includes(adjTrimmed.toLowerCase())) {
            changed = true;
            return mainClean;
          }
          return adjTrimmed;
        });

        if (changed) {
            const uniqueAdjuntos = Array.from(new Set(newAdjuntos))
              .filter(a => a.toLowerCase() !== newRelator.toLowerCase() && a !== 'Nenhum' && a.length > 0);
            return { ...ac, relator: newRelator, adjuntos: uniqueAdjuntos };
        }
        return ac;
      });
    });
  };

  const handleSetRoot = (handle: FileSystemDirectoryHandle) => {
    setRootHandle(handle);
    setRootHandleName(handle.name);
    setActiveTab('process');
  };

  const handleAddAcordaos = (incoming: Acordao[]) => {
    setDb(currentDb => {
        const dbMap = new Map<string, Acordao>();
        currentDb.forEach(a => dbMap.set(a.processo.toLowerCase().trim(), a));
        incoming.forEach(newA => {
            const procKey = newA.processo.toLowerCase().trim();
            if (!dbMap.has(procKey)) dbMap.set(procKey, newA);
        });
        return Array.from(dbMap.values());
    });
  };

  const openPdf = async (fileName: string) => {
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
       if (handle) {
          const file = await handle.getFile();
          window.open(URL.createObjectURL(file), '_blank');
       }
    }
  };

  const handleSaveDb = () => {
    const json = JSON.stringify({ db, descriptors, judges }, null, 2);
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
        if (parsed.db) handleAddAcordaos(parsed.db);
        if (parsed.descriptors) {
            const merged = { ...descriptors };
            if (parsed.descriptors.social) merged.social = Array.from(new Set([...descriptors.social, ...parsed.descriptors.social])).sort();
            if (parsed.descriptors.crime) merged.crime = Array.from(new Set([...descriptors.crime, ...parsed.descriptors.crime])).sort();
            if (parsed.descriptors.civil) merged.civil = Array.from(new Set([...descriptors.civil, ...parsed.descriptors.civil])).sort();
            setDescriptors(merged);
        }
        setOnboardingStep('app');
      } catch (err) {
        alert("Erro ao ler ficheiro de backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handleLoadChatFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.chatSessions) {
            setChatSessions(current => {
                const existingIds = new Set(current.map(s => s.id));
                const filteredNew = parsed.chatSessions.filter((s: ChatSession) => !existingIds.has(s.id));
                return [...filteredNew, ...current];
            });
            alert("Chat carregado com sucesso.");
        }
      } catch (err) {
        alert("Erro ao ler histórico.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const mainContent = onboardingStep === 'app' ? (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-legal-900 text-white shadow-xl z-50 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ScaleIcon className="w-8 h-8 text-legal-100" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">JurisAnalítica</h1>
              <p className="text-[9px] text-legal-400 uppercase tracking-widest font-black mt-1">Área {legalArea}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            
            <button 
                onClick={handleSetupKey}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${isAiConfigured ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}
            >
                {isAiConfigured ? <ShieldCheck className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                {isAiConfigured ? 'Sua Chave API Ativa' : 'Configurar Chave Gemini'}
            </button>

            <div className="h-10 w-px bg-legal-800 mx-2 self-center"></div>
            
            <button onClick={() => chatInputRef.current?.click()} className="p-2.5 text-legal-300 hover:text-white transition-all" title="Importar Chat">
                <History className="w-4 h-4" />
            </button>
            
            <div className="flex gap-1 items-center bg-legal-800/40 p-1 rounded-2xl border border-legal-700 ml-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-legal-300 hover:text-white transition-all" title="Importar Base">
                    <FolderOpen className="w-4 h-4" />
                </button>
                <button onClick={handleSaveDb} className="flex items-center gap-2 px-4 py-2 bg-white text-legal-900 hover:bg-legal-50 rounded-xl text-[9px] font-black uppercase transition-all">
                    <Save className="w-4 h-4" /> Backup
                </button>
            </div>
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
              <ProcessingModule 
                onDataLoaded={handleAddAcordaos} 
                existingDB={db} 
                onSetRootHandle={handleSetRoot} 
                rootHandleName={rootHandleName} 
                onCacheFiles={() => {}} 
                onAddDescriptors={(cat, l) => setDescriptors(p=>({...p, [cat]:l}))} 
                onAddJudges={setJudges} 
                onMergeJudges={handleMergeJudges}
                availableJudges={judges} 
                availableDescriptors={descriptors[legalArea]}
                legalArea={legalArea}
                onUpdateDb={setDb}
                onSaveDb={handleSaveDb}
                apiKey={userApiKey}
              />
            )}
            {activeTab === 'search' && (
              <SearchModule 
                db={db} 
                onOpenPdf={openPdf} 
                onUpdateAcordao={u => setDb(p => p.map(x=>x.id===u.id?u:x))} 
                availableDescriptors={legalArea?descriptors[legalArea]:[]} 
                availableJudges={judges} 
                apiKey={userApiKey}
              />
            )}
            {activeTab === 'chat' && (
              <ChatModule 
                db={db} 
                sessions={chatSessions} 
                onSaveSession={s => setChatSessions(p => {
                    const idx = p.findIndex(x => x.id === s.id);
                    if (idx > -1) {
                        const next = [...p];
                        next[idx] = s;
                        return next;
                    }
                    return [s, ...p];
                })} 
                onDeleteSession={(id) => setChatSessions(p => p.filter(s => s.id !== id))} 
                onOpenPdf={openPdf}
                apiKey={userApiKey}
              />
            )}
        </div>
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 bg-[#0f172a] z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-[32px] shadow-2xl p-10 max-w-[500px] w-full text-center border border-slate-700/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-legal-400 to-blue-500"></div>
          
          <div className="mb-10 flex justify-center">
            <div className="p-8 bg-blue-600/10 rounded-full border border-blue-600/20">
              <ScaleIcon className="w-12 h-12 text-blue-500"/>
            </div>
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tighter text-white uppercase">JurisAnalítica</h2>
          <p className="text-slate-400 mb-10 text-sm">Selecione a jurisdição de trabalho.</p>
          <div className="grid grid-cols-1 gap-4">
            {['social', 'crime', 'civil'].map((area: any) => (
              <button 
                key={area} 
                onClick={() => selectLegalArea(area)} 
                className="group p-6 rounded-[24px] border border-slate-700 bg-slate-800/50 hover:border-blue-500 hover:bg-slate-800 transition-all flex items-center gap-6 text-left active:scale-95 shadow-sm"
              >
                <div className="p-4 bg-slate-700 rounded-2xl group-hover:bg-blue-900/20 transition-all">
                  {area === 'social' ? <Briefcase className="w-8 h-8 text-blue-400"/> : area === 'crime' ? <Gavel className="w-8 h-8 text-blue-400"/> : <ScaleIcon className="w-8 h-8 text-blue-400"/>}
                </div>
                <div>
                    <div className="capitalize font-black text-xl text-white tracking-tighter">Área {area}</div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Sessão Local</div>
                </div>
              </button>
            ))}
            <div className="h-px bg-slate-700/50 my-6"></div>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-dashed border-slate-600 text-slate-400 hover:text-white transition-all font-bold text-[9px] uppercase tracking-widest group">
                    <Database className="w-5 h-5 text-blue-500"/> Base JSON
                </button>
                <button onClick={() => chatInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-dashed border-slate-600 text-slate-400 hover:text-white transition-all font-bold text-[9px] uppercase tracking-widest group">
                    <MessageSquare className="w-5 h-5 text-green-500"/> Chats JSON
                </button>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-700/50 flex flex-col gap-3">
                 <button onClick={handleSetupKey} className="flex items-center justify-center gap-2 text-[10px] font-black uppercase text-blue-400 hover:text-blue-300 transition-all">
                    <Settings className="w-4 h-4"/> Configurar Chave Gemini (Privado)
                 </button>
            </div>
          </div>
      </div>
    </div>
  );

  return (
    <>
      {mainContent}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".json" 
        onChange={handleLoadDbFile}
      />
      <input 
        type="file" 
        ref={chatInputRef} 
        className="hidden" 
        accept=".json" 
        onChange={handleLoadChatFile}
      />
    </>
  );
}

export default App;
