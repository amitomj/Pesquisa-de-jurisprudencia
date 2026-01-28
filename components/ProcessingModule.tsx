
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Acordao } from '../types';
import { extractDataFromPdf } from '../services/pdfService';
import { extractMetadataWithAI } from '../services/geminiService';
import { 
  FolderUp, Trash2, Tag, Plus, Search, Loader2, GitMerge, Check, 
  UserCheck, X, ChevronDown, ArrowRight, AlertTriangle, Activity, 
  FileWarning, Tags, FileText, LayoutDashboard, ChevronRight
} from 'lucide-react';

interface Props {
  onDataLoaded: (data: Acordao[]) => void;
  existingDB: Acordao[];
  onSetRootHandle: (handle: any) => void;
  rootHandleName: string | null;
  onCacheFiles: (files: File[]) => void;
  onAddDescriptors: (category: 'social' | 'crime' | 'civil', list: string[]) => void;
  onAddJudges: (list: string[]) => void;
  onMergeJudges?: (main: string, others: string[]) => void;
  availableJudges?: string[];
  availableDescriptors?: string[]; 
  legalArea: 'social' | 'crime' | 'civil';
  onUpdateDb: (db: Acordao[]) => void;
  onSaveDb: () => void;
  filesFromFolder?: File[];
}

const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const STOP_WORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'os', 'as', 'com', 'em', 'por', 'para', 'um', 'uma', 'uns', 'umas', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'à', 'às']);

const getKeywords = (str: string) => {
    return normalize(str)
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word));
};

const JudgeAutocomplete: React.FC<{
    allJudges: string[];
    onSelect: (judge: string) => void;
    placeholder: string;
    exclude?: string[];
}> = ({ allJudges, onSelect, placeholder, exclude = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filtered = allJudges
        .filter(j => !exclude.includes(j))
        .filter(j => normalize(j).includes(normalize(query)))
        .slice(0, 50);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="relative">
                <input 
                    type="text" 
                    className="w-full p-4 pr-12 bg-white border border-gray-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-legal-400 outline-none transition-all shadow-sm"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                />
                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-[110] w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2">
                    {filtered.length > 0 ? (
                        filtered.map((j, i) => (
                            <button 
                                key={i}
                                onClick={() => { onSelect(j); setQuery(''); setIsOpen(false); }}
                                className="w-full text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-gray-700 hover:bg-legal-50 hover:text-legal-900 border-b border-gray-50 last:border-0 transition-colors"
                            >
                                {j}
                            </button>
                        ))
                    ) : (
                        <div className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase italic">Não encontrado.</div>
                    )}
                </div>
            )}
        </div>
    );
};

const ProcessingModule: React.FC<Props> = ({ 
    onDataLoaded, existingDB, rootHandleName,
    onAddDescriptors, onMergeJudges, availableJudges = [], availableDescriptors = [],
    legalArea, onUpdateDb, filesFromFolder = []
}) => {
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const stopRequested = useRef(false);

  const [selectedMainJudge, setSelectedMainJudge] = useState<string | null>(null);
  const [selectedAliases, setSelectedAliases] = useState<string[]>([]);
  const [newDescriptor, setNewDescriptor] = useState('');
  const [searchDescriptor, setSearchDescriptor] = useState('');
  const [similarityCheck, setSimilarityCheck] = useState<{ newTag: string, similarTags: string[] } | null>(null);

  // Estatísticas de saúde da base de dados
  const stats = useMemo(() => {
    return {
      total: existingDB.length,
      missingSummary: existingDB.filter(a => a.sumario === 'Sumário não encontrado' || !a.sumario).length,
      missingTags: existingDB.filter(a => a.descritores.length === 0).length,
      incompleteMetadata: existingDB.filter(a => a.relator === 'Desconhecido' || a.data === 'N/D').length,
    };
  }, [existingDB]);

  const sortedDescriptors = useMemo(() => {
    return (availableDescriptors || [])
      .filter(d => normalize(d).includes(normalize(searchDescriptor)))
      .sort((a, b) => a.localeCompare(b, 'pt-PT'));
  }, [availableDescriptors, searchDescriptor]);

  const processFileList = async (files: File[]) => {
    setProcessing(true);
    stopRequested.current = false;
    
    const existingKeys = new Set(existingDB.map(a => a.filePath.toLowerCase()));
    const newFiles = files.filter(f => !existingKeys.has(f.webkitRelativePath.toLowerCase()));

    if (newFiles.length === 0) {
      setLogs(prev => [...prev, 'Biblioteca sincronizada.']);
      setProcessing(false);
      return;
    }

    setLogs(prev => [...prev, `Detetados ${newFiles.length} novos. A processar...`]);

    for (let i = 0; i < newFiles.length; i++) {
      if (stopRequested.current) break;
      const file = newFiles[i];
      try {
        setLogs(prev => [...prev.slice(-15), `[${i+1}/${newFiles.length}] A extrair: ${file.name}`]);
        const data = await extractDataFromPdf(file);
        data.filePath = file.webkitRelativePath;

        if (data.sumario.includes('Sumário não encontrado')) {
            const aiResult = await extractMetadataWithAI(data.textoAnalise, availableDescriptors || []);
            if (aiResult) {
                if (aiResult.sumario) data.sumario = aiResult.sumario;
                if (aiResult.descritores) data.descritores = aiResult.descritores;
            }
        }
        onDataLoaded([data]);
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        setLogs(prev => [...prev, `⚠️ Erro em: ${file.name}`]);
      }
    }
    setProcessing(false);
    setLogs(prev => [...prev, `✅ Sincronização terminada.`]);
  };

  const handleSyncClick = () => {
    if (!filesFromFolder || filesFromFolder.length === 0) {
        alert("Selecione a pasta no ecrã de Configuração.");
        return;
    }
    processFileList(filesFromFolder);
  };

  const handleMerge = () => {
    if (selectedMainJudge && selectedAliases.length > 0 && onMergeJudges) {
      if (confirm(`Atenção: Irá substituir permanentemente ${selectedAliases.length} nomes por "${selectedMainJudge}". Continuar?`)) {
        onMergeJudges(selectedMainJudge, selectedAliases);
        setSelectedMainJudge(null);
        setSelectedAliases([]);
      }
    }
  };

  const handleAddDescriptor = () => {
    const val = newDescriptor.trim();
    if (!val) return;
    if (availableDescriptors?.some(d => normalize(d) === normalize(val))) {
        alert("Este descritor já existe.");
        setNewDescriptor('');
        return;
    }
    const newKeywords = getKeywords(val);
    const similar = (availableDescriptors || []).filter(existing => {
        const existingKeywords = getKeywords(existing);
        return newKeywords.some(kw => existingKeywords.includes(kw));
    });

    if (similar.length > 0) {
        setSimilarityCheck({ newTag: val, similarTags: similar });
    } else {
        onAddDescriptors(legalArea, [...(availableDescriptors || []), val].sort());
        setNewDescriptor('');
    }
  };

  const confirmAddDescriptor = (type: 'new' | 'replace', targetTag?: string) => {
      if (!similarityCheck) return;
      const val = similarityCheck.newTag;
      if (type === 'new') {
          onAddDescriptors(legalArea, [...(availableDescriptors || []), val].sort());
      } else if (type === 'replace' && targetTag) {
          const updatedList = (availableDescriptors || []).map(d => d === targetTag ? val : d).sort();
          onAddDescriptors(legalArea, updatedList);
          const updatedDb = existingDB.map(ac => ({
              ...ac,
              descritores: ac.descritores.map(d => d === targetTag ? val : d)
          }));
          onUpdateDb(updatedDb);
      }
      setNewDescriptor('');
      setSimilarityCheck(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10 h-full overflow-y-auto custom-scrollbar pb-32">
      {processing && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-md">
           <div className="bg-white p-10 rounded-[40px] shadow-2xl flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-legal-100 border-t-legal-600 rounded-full animate-spin"></div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Sincronizando Biblioteca</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Segurança Ativa: Processando localmente</p>
              <button onClick={() => stopRequested.current = true} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase">Parar</button>
           </div>
        </div>
      )}

      {similarityCheck && (
          <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
              <div className="bg-white max-w-xl w-full rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <div className="bg-orange-600 p-8 text-white">
                      <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-8 h-8"/>
                        <h3 className="text-xl font-black uppercase tracking-tighter">Termos Semelhantes</h3>
                      </div>
                      <p className="text-[11px] font-bold uppercase text-orange-100">O termo "{similarityCheck.newTag}" é semelhante a descritores existentes.</p>
                  </div>
                  <div className="p-10 space-y-8">
                      <div className="space-y-3">
                          {similarityCheck.similarTags.map(tag => (
                              <div key={tag} className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100 group">
                                  <span className="text-[11px] font-black uppercase">{tag}</span>
                                  <button onClick={() => confirmAddDescriptor('replace', tag)} className="bg-orange-100 text-orange-700 px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-orange-600 hover:text-white transition-all">Substituir</button>
                              </div>
                          ))}
                      </div>
                      <div className="pt-6 border-t flex gap-4">
                          <button onClick={() => setSimilarityCheck(null)} className="flex-1 py-4 border border-gray-200 text-gray-400 rounded-2xl font-black text-[10px] uppercase">Cancelar</button>
                          <button onClick={() => confirmAddDescriptor('new')} className="flex-1 py-4 bg-legal-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl">Adicionar Novo</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-3 text-legal-900 mb-2">
            <LayoutDashboard className="w-6 h-6" />
            <h2 className="text-2xl font-black uppercase tracking-tighter">Cockpit de Gestão</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Total na Biblioteca</span>
                <span className="text-3xl font-black text-legal-900">{stats.total}</span>
            </div>
            <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col gap-1 ${stats.missingSummary > 0 ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-start">
                    <span className="text-[9px] font-black uppercase text-orange-600 tracking-widest">Sem Sumário</span>
                    <FileWarning className="w-4 h-4 text-orange-400" />
                </div>
                <span className={`text-3xl font-black ${stats.missingSummary > 0 ? 'text-orange-700' : 'text-gray-300'}`}>{stats.missingSummary}</span>
            </div>
            <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col gap-1 ${stats.missingTags > 0 ? 'bg-purple-50 border-purple-100' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-start">
                    <span className="text-[9px] font-black uppercase text-purple-600 tracking-widest">Sem Tags</span>
                    <Tags className="w-4 h-4 text-purple-400" />
                </div>
                <span className={`text-3xl font-black ${stats.missingTags > 0 ? 'text-purple-700' : 'text-gray-300'}`}>{stats.missingTags}</span>
            </div>
            <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col gap-1 ${stats.incompleteMetadata > 0 ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-start">
                    <span className="text-[9px] font-black uppercase text-blue-600 tracking-widest">Dados em Falta</span>
                    <UserCheck className="w-4 h-4 text-blue-400" />
                </div>
                <span className={`text-3xl font-black ${stats.incompleteMetadata > 0 ? 'text-blue-700' : 'text-gray-300'}`}>{stats.incompleteMetadata}</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,350px] gap-8">
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <h2 className="text-xl font-black text-legal-900 mb-6 flex items-center gap-3 uppercase tracking-tighter">
                    <FolderUp className="w-5 h-5 text-legal-600"/> Sincronização Local
                </h2>
                <div className="flex flex-col gap-6">
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Caminho da Biblioteca</p>
                        <p className="text-sm text-legal-900 font-bold">{rootHandleName || 'Pasta não selecionada'}</p>
                    </div>
                    {stats.total > 0 && <Check className="w-6 h-6 text-green-500" />}
                </div>
                <button onClick={handleSyncClick} className="bg-legal-900 hover:bg-black text-white px-10 py-5 rounded-[22px] flex items-center justify-center gap-3 transition-all shadow-2xl font-black text-xs uppercase tracking-widest">
                    <Loader2 className={`w-5 h-5 ${processing ? 'animate-spin' : ''}`}/> {processing ? 'Sincronizando...' : 'Procurar Novos Acórdãos na Pasta'}
                </button>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-8 border-b border-gray-50 pb-6">
                    <h3 className="text-sm font-black text-legal-900 flex items-center gap-2 uppercase tracking-widest">
                        <UserCheck className="w-5 h-5 text-legal-600"/> Padronização de Magistrados
                    </h3>
                    {selectedMainJudge && selectedAliases.length > 0 && (
                        <button onClick={handleMerge} className="bg-green-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl hover:bg-green-700 transition-all active:scale-95 animate-in fade-in">
                            <GitMerge className="w-4 h-4" /> Executar Fusão
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] items-start gap-8">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block px-1">Substituir (Eliminar Alias)</label>
                        <JudgeAutocomplete allJudges={availableJudges} onSelect={(j) => { if (!selectedAliases.includes(j)) setSelectedAliases(p => [...p, j]); }} placeholder="Nome incorreto..." exclude={selectedMainJudge ? [selectedMainJudge, ...selectedAliases] : selectedAliases} />
                        <div className="flex flex-wrap gap-2 pt-2">
                            {selectedAliases.map(alias => (
                                <div key={alias} className="bg-orange-100 text-orange-800 text-[9px] font-black uppercase px-3 py-2 rounded-xl border border-orange-200 flex items-center gap-2">
                                    {alias}
                                    <button onClick={() => setSelectedAliases(p => p.filter(a => a !== alias))} className="text-orange-400 hover:text-orange-600"><X className="w-3.5 h-3.5"/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="hidden md:flex items-center justify-center pt-12 text-gray-200"><ArrowRight className="w-6 h-6" /></div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block px-1">Manter (Perfil Oficial)</label>
                        <JudgeAutocomplete allJudges={availableJudges} onSelect={setSelectedMainJudge} placeholder="Nome oficial..." exclude={selectedAliases} />
                        {selectedMainJudge && (
                            <div className="p-4 bg-legal-900 text-white rounded-2xl flex items-center justify-between shadow-lg animate-in zoom-in-95 mt-2">
                                <span className="text-[11px] font-black uppercase">{selectedMainJudge}</span>
                                <button onClick={() => setSelectedMainJudge(null)} className="text-legal-300 hover:text-white"><X className="w-4 h-4"/></button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 h-fit">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-legal-900 flex items-center gap-2 uppercase tracking-widest">
                        <Tag className="w-5 h-5 text-legal-600"/> Vocabulário
                    </h3>
                </div>
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <input type="text" placeholder="Filtrar temas..." className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-legal-400 outline-none" value={searchDescriptor} onChange={e => setSearchDescriptor(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <input type="text" className="flex-1 p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none" placeholder="Novo tema..." value={newDescriptor} onChange={e => setNewDescriptor(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddDescriptor()} />
                        <button onClick={handleAddDescriptor} className="bg-legal-900 text-white px-4 rounded-xl hover:bg-black transition-all shadow-lg"><Plus className="w-5 h-5"/></button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-4 bg-gray-50 rounded-[1.5rem] border border-gray-100 custom-scrollbar grid grid-cols-1 gap-2">
                        {sortedDescriptors.map(tag => (
                            <div key={tag} className="flex items-center justify-between bg-white text-legal-900 text-[10px] font-black px-4 py-3 rounded-xl border border-gray-100 group">
                                <span className="truncate">{tag}</span>
                                <button onClick={() => { if (confirm(`Remover "${tag}"?`)) onAddDescriptors(legalArea, availableDescriptors!.filter(d => d !== tag)); }} className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 ml-2"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 text-slate-300 p-6 rounded-[2rem] font-mono text-[10px] h-48 overflow-y-auto shadow-2xl border border-slate-800 custom-scrollbar">
                <div className="flex items-center gap-2 mb-4 text-slate-500 border-b border-slate-800 pb-2">
                    <Activity className="w-3.5 h-3.5" />
                    <span className="uppercase tracking-widest font-black">Consola de Eventos</span>
                </div>
                {logs.length === 0 ? (
                    <div className="opacity-20 italic">A aguardar atividade...</div>
                ) : (
                    logs.map((log, i) => <div key={i} className="mb-1 opacity-80">{" > "} {log}</div>)
                )}
            </div>
          </div>
      </div>
    </div>
  );
};

export default ProcessingModule;
