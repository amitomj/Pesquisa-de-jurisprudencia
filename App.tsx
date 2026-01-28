
import React, { useState, useRef, useEffect } from 'react';
import ProcessingModule from './components/ProcessingModule';
import SearchModule from './components/SearchModule';
import ChatModule from './components/ChatModule';
import { Acordao, ChatSession } from './types';
import { Scale, Save, Briefcase, Gavel, Scale as ScaleIcon, Database, MessageSquare, Settings, FolderOpen, X, PlayCircle, UserCheck, Key, ShieldCheck, AlertTriangle, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';

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
  const [isIndexing, setIsIndexing] = useState(false);
  
  const [onboardingStep, setOnboardingStep] = useState<'area' | 'setup' | 'app'>('area');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);

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
    
    // Tenta detetar o nome da pasta principal
    const firstFile = files[0];
    if (firstFile.webkitRelativePath) {
      setFolderName(firstFile.webkitRelativePath.split('/')[0]);
    } else {
      setFolderName("Biblioteca Local");
    }

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.toLowerCase().endsWith('.pdf')) {
        // Indexação dupla: por caminho relativo e por nome base
        if (f.webkitRelativePath) {
          newCache.set(f.webkitRelativePath.toLowerCase(), f);
        }
        newCache.set(f.name.toLowerCase(), f);
      }
    }
    
    setFileCache(newCache);
    setIsIndexing(false);
  };

  const openPdf = async (filePath: string) => {
    if (fileCache.size === 0) {
      alert("⚠️ Pasta de documentos não carregada.\n\nPor favor, utilize o botão 'Selecionar Pasta Mãe' no ecrã de Configuração para permitir a visualização dos PDFs.");
      return;
    }

    const pathLower = filePath.toLowerCase();
    const fileName = (filePath.split('/').pop() || filePath).toLowerCase();
    
    // Procura no cache por caminho completo ou apenas pelo nome do ficheiro
    const file = fileCache.get(pathLower) || fileCache.get(fileName);
    
    if (!file) {
      alert(`⚠️ Ficheiro "${fileName}" não encontrado.\n\nCertifique-se de que selecionou a pasta que contém este documento.`);
      return;
    }
    
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
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
                <div className="bg-orange-500/20 text-orange-400 px-3 py-1.5 rounded-lg border border-orange-500/30 text-[9px] font-black uppercase flex items-center gap-2 animate-pulse">
                    <AlertTriangle className="w-3 h-3"/> PDFs Offline
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
    <div className="fixed inset-0 bg-[#0f172a] z-[100] flex items-center justify-center p-6">
      {onboardingStep === 'area' ? (
        <div className="bg-[#1e293b] rounded-[32px] shadow-2xl p-10 max-w-[500px] w-full text-center border border-slate-700/50 relative overflow-hidden animate-in zoom-in-95">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-400"></div>
            <div className="mb-10 flex justify-center"><div className="p-8 bg-blue-600/10 rounded-full border border-blue-600/20"><ScaleIcon className="w-12 h-12 text-blue-500"/></div></div>
            <h2 className="text-3xl font-black mb-2 tracking-tighter text-white uppercase">JurisAnalítica</h2>
            <p className="text-slate-400 mb-10 text-sm">Bem-vindo. Escolha a sua jurisdição.</p>
            <div className="grid grid-cols-1 gap-4">
              {['social', 'crime', 'civil'].map((area: any) => (
                <button key={area} onClick={() => selectLegalArea(area)} className="group p-6 rounded-[24px] border border-slate-700 bg-slate-800/50 hover:border-blue-500 hover:bg-slate-800 transition-all flex items-center gap-6 text-left active:scale-95 shadow-sm">
                  <div className="p-4 bg-slate-700 rounded-2xl group-hover:bg-blue-900/20 transition-all">
                    {area === 'social' ? <Briefcase className="w-8 h-8 text-blue-400"/> : area === 'crime' ? <Gavel className="w-8 h-8 text-blue-400"/> : <ScaleIcon className="w-8 h-8 text-blue-400"/>}
                  </div>
                  <div>
                      <div className="capitalize font-black text-xl text-white tracking-tighter">Área {area}</div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Análise Local</div>
                  </div>
                </button>
              ))}
            </div>
        </div>
      ) : (
        <div className="bg-[#1e293b] rounded-[40px] shadow-2xl p-12 max-w-[750px] w-full border border-slate-700/50 relative overflow-hidden animate-in slide-in-from-bottom-10">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-600/20 rounded-2xl border border-blue-500/20"><Settings className="w-8 h-8 text-blue-500" /></div>
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Configuração Local</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Preparação da Biblioteca</p>
                    </div>
                </div>
                <button onClick={() => setOnboardingStep('area')} className="p-2 text-slate-500 hover:text-white transition-all"><X/></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {/* Passo 1: Metadados */}
                <div className={`p-6 rounded-[28px] border-2 transition-all ${db.length > 0 ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700 bg-slate-800/30'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <Database className={`w-6 h-6 ${db.length > 0 ? 'text-green-500' : 'text-slate-400'}`} />
                      {db.length > 0 && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    </div>
                    <h3 className="text-white font-black text-[11px] uppercase tracking-widest mb-2">1. Base de Dados (Opcional)</h3>
                    <p className="text-slate-400 text-[10px] mb-4">{db.length > 0 ? `${db.length} acórdãos lidos.` : 'Carregue um ficheiro JSON de backup anterior.'}</p>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-600 transition-all">Carregar JSON</button>
                </div>

                {/* Passo 2: Pasta PDF */}
                <div className={`p-6 rounded-[28px] border-2 transition-all ${fileCache.size > 0 ? 'border-green-500/30 bg-green-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <FolderOpen className={`w-6 h-6 ${fileCache.size > 0 ? 'text-green-500' : 'text-orange-500'}`} />
                      {fileCache.size > 0 && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    </div>
                    <h3 className="text-white font-black text-[11px] uppercase tracking-widest mb-2">2. Documentos PDF (Importante)</h3>
                    <p className="text-slate-400 text-[10px] mb-4">{fileCache.size > 0 ? `${fileCache.size} ficheiros disponíveis.` : 'Selecione a pasta para poder abrir e processar ficheiros.'}</p>
                    <button onClick={() => directoryInputRef.current?.click()} className="w-full py-3 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-orange-500 shadow-lg shadow-orange-900/20 transition-all">Selecionar Pasta</button>
                    {isIndexing && <div className="mt-2 text-[9px] text-orange-400 font-bold uppercase animate-pulse">Indexando ficheiros...</div>}
                </div>
            </div>

            <div className="bg-slate-800/50 p-6 rounded-[24px] mb-8 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h4 className="text-white font-black text-[10px] uppercase tracking-widest">Segurança Gemini Ativa</h4>
              </div>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                A aplicação utiliza a chave API configurada no ambiente para processar os dados localmente. Nenhuma informação de identificação é partilhada externamente.
              </p>
            </div>

            <button 
                onClick={() => setOnboardingStep('app')}
                className="w-full py-6 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 bg-blue-600 text-white hover:scale-[1.01] active:scale-95 shadow-blue-900/40"
            >
                <PlayCircle className="w-6 h-6" /> Iniciar JurisAnalítica
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
