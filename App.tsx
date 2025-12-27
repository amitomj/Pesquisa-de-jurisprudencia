
import React, { useState, useRef, useEffect } from 'react';
import ProcessingModule from './components/ProcessingModule';
import SearchModule from './components/SearchModule';
import ChatModule from './components/ChatModule';
import { Acordao, SearchResult, ChatSession } from './types';
import { Scale, Save, Key, Briefcase, Gavel, Scale as ScaleIcon } from 'lucide-react';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        try {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasUserKey(selected);
        } catch (e) {
          console.warn("AI Studio key check failed", e);
        }
      }
    };
    checkKey();
  }, []);

  const handleConfigKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // Após abrir o diálogo, assumimos sucesso para atualizar a UI
        setHasUserKey(true);
      } catch (e) {
        console.error("Failed to open key selector", e);
      }
    } else {
      alert("O seletor de chaves nativo não está disponível neste ambiente.");
    }
  };

  useEffect(() => {
    const extracted = new Set<string>();
    db.forEach(ac => {
      if (ac.relator && ac.relator !== 'Desconhecido') extracted.add(ac.relator.trim());
      ac.adjuntos.forEach(adj => { if (adj) extracted.add(adj.trim()); });
    });
    setJudges(prev => Array.from(new Set([...prev, ...extracted])).sort());
  }, [db]);

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
        alert('Base de dados carregada!');
        setActiveTab('search');
      } catch (err) { alert('Erro ao ler JSON.'); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      {!legalArea && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full text-center">
                  <div className="mb-6 flex justify-center"><div className="p-4 bg-legal-100 rounded-full"><ScaleIcon className="w-10 h-10 text-legal-700"/></div></div>
                  <h2 className="text-2xl font-bold mb-2">Bem-vindo à JurisAnalítica</h2>
                  <p className="text-gray-600 mb-8">Selecione a sua área de jurisdição preferencial.</p>
                  <div className="grid grid-cols-1 gap-4">
                      {['social', 'crime', 'civil'].map((area: any) => (
                        <button key={area} onClick={() => setLegalArea(area)} className="p-4 rounded-lg border-2 border-legal-200 hover:border-legal-600 hover:bg-legal-50 transition-all flex items-center gap-4 text-left">
                           {area === 'social' ? <Briefcase className="w-6 h-6"/> : area === 'crime' ? <Gavel className="w-6 h-6"/> : <ScaleIcon className="w-6 h-6"/>}
                           <div className="capitalize font-bold text-lg">Área {area}</div>
                        </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      <header className="bg-legal-900 text-white shadow-md z-50 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-8 h-8 text-legal-200" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">JurisAnalítica</h1>
              <p className="text-[9px] text-legal-300 uppercase tracking-widest font-bold">Privacidade Total • {legalArea}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleConfigKey} 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-tighter transition-all shadow-sm ${hasUserKey ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-legal-700 text-legal-200 hover:bg-legal-600 border border-legal-600'}`}
              title="Configurar a sua própria API Key para usar saldo pessoal."
            >
              <Key className="w-3.5 h-3.5" />
              {hasUserKey ? 'Chave Ativa' : 'Configurar API Key'}
            </button>
            <div className="h-6 w-px bg-legal-700"></div>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleLoadDbFile}/>
            <button onClick={() => fileInputRef.current?.click()} className="text-[11px] font-bold uppercase tracking-tighter text-legal-300 hover:text-white transition-colors">Carregar</button>
            <button onClick={handleSaveDb} className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95">
              <Save className="w-4 h-4" /> Guardar Backup
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
            availableJudges={judges}
            availableDescriptors={legalArea ? descriptors[legalArea] : []}
          />
        ) : (
          <>
            <div className="bg-white border-b px-6 pt-2 flex gap-6 flex-shrink-0 shadow-sm z-10">
               {['process', 'search', 'chat'].map((tab: any) => (
                 <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-2 px-1 text-sm font-bold border-b-2 transition-all capitalize tracking-tight ${activeTab === tab ? 'border-legal-600 text-legal-800' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                    {tab === 'process' ? '⚙️ Processamento' : tab === 'search' ? '🔍 Biblioteca' : '💬 Consultoria'}
                 </button>
               ))}
            </div>
            <div className="flex-1 overflow-hidden bg-gray-50 relative">
               {activeTab === 'process' && <ProcessingModule onDataLoaded={d => setDb(p => [...p, ...d])} existingDB={db} onSetRootHandle={handleSetRoot} rootHandleName={rootHandleName} onCacheFiles={setCachedFiles} onAddDescriptors={(cat, l) => setDescriptors(p=>({...p, [cat]:l}))} onAddJudges={setJudges} availableJudges={judges} availableDescriptors={legalArea?descriptors[legalArea]:[]}/>}
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
