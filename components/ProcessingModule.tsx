
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Acordao } from '../types';
import { extractDataFromPdf } from '../services/pdfService';
import { extractMetadataWithAI } from '../services/geminiService';
import { FolderUp, FilePlus, Users, Trash2, Tag, Plus, Search, Loader2, GitMerge, Check, UserCheck, AlertCircle, X, ChevronDown, ArrowRight, AlertTriangle, Save, Download } from 'lucide-react';

interface Props {
  onDataLoaded: (data: Acordao[]) => void;
  existingDB: Acordao[];
  onSetRootHandle: (handle: FileSystemDirectoryHandle) => void;
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
    onDataLoaded, existingDB, onSetRootHandle, rootHandleName,
    onAddDescriptors, onMergeJudges, availableJudges = [], availableDescriptors = [],
    legalArea, onUpdateDb, onSaveDb
}) => {
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const stopRequested = useRef(false);

  const [selectedMainJudge, setSelectedMainJudge] = useState<string | null>(null);
  const [selectedAliases, setSelectedAliases] = useState<string[]>([]);

  const [newDescriptor, setNewDescriptor] = useState('');
  const [searchDescriptor, setSearchDescriptor] = useState('');
  
  const [similarityCheck, setSimilarityCheck] = useState<{ newTag: string, similarTags: string[] } | null>(null);

  const sortedDescriptors = useMemo(() => {
    return (availableDescriptors || [])
      .filter(d => normalize(d).includes(normalize(searchDescriptor)))
      .sort((a, b) => a.localeCompare(b, 'pt-PT'));
  }, [availableDescriptors, searchDescriptor]);

  const handleMerge = () => {
    if (selectedMainJudge && selectedAliases.length > 0 && onMergeJudges) {
      if (confirm(`Atenção: Irá substituir permanentemente ${selectedAliases.length} nomes por "${selectedMainJudge}" em toda a biblioteca. Continuar?`)) {
        onMergeJudges(selectedMainJudge, selectedAliases);
        setSelectedMainJudge(null);
        setSelectedAliases([]);
        alert("Fusão de magistrados concluída.");
      }
    }
  };

  const handleAddDescriptor = () => {
    const val = newDescriptor.trim();
    if (!val) return;
    
    if (availableDescriptors?.some(d => normalize(d) === normalize(val))) {
        alert("Este descritor já existe na lista oficial.");
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

  const removeDescriptor = (tag: string) => {
      if (confirm(`Remover "${tag}"?`)) {
          onAddDescriptors(legalArea, (availableDescriptors || []).filter(d => d !== tag));
          onUpdateDb(existingDB.map(ac => ({
              ...ac,
              descritores: ac.descritores.filter(t => t !== tag)
          })));
      }
  };

  const getFilesRecursively = async (handle: FileSystemDirectoryHandle): Promise<File[]> => {
    const files: File[] = [];
    for await (const entry of (handle as any).values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
        files.push(await (entry as any).getFile());
      } else if (entry.kind === 'directory') {
        files.push(...await getFilesRecursively(entry as any));
      }
    }
    return files;
  };

  const processFileList = async (files: File[]) => {
    setProcessing(true);
    setLogs(prev => [`Analisando ${files.length} ficheiros...`]);
    stopRequested.current = false;
    const existingFileNames = new Set(existingDB.map(a => a.fileName));
    const newFiles = files.filter(f => !existingFileNames.has(f.name));

    if (newFiles.length === 0) {
      setLogs(prev => [...prev, 'Nenhum ficheiro novo.']);
      setProcessing(false);
      return;
    }

    const newData: Acordao[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      if (stopRequested.current) break;
      const file = newFiles[i];
      try {
        setLogs(prev => [...prev, `Processando: ${file.name}`]);
        let data = await extractDataFromPdf(file);
        
        if (data.sumario.includes('não identificado')) {
            const aiResult = await extractMetadataWithAI(data.textoCompleto, availableDescriptors || []);
            if (aiResult === "API_LIMIT_REACHED") {
                stopRequested.current = true;
            } else if (aiResult) {
                if (aiResult.sumario) data.sumario = aiResult.sumario;
                if (aiResult.descritores) data.descritores = aiResult.descritores;
                if (aiResult.relator && aiResult.relator !== 'Desconhecido') data.relator = aiResult.relator;
                if (aiResult.data && aiResult.data !== 'N/D') data.data = aiResult.data;
            }
        }
        newData.push(data);
      } catch (err) {
        setLogs(prev => [...prev, `Erro: ${file.name}`]);
      }
    }
    onDataLoaded(newData);
    setProcessing(false);
  };

  const handleSelectFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      onSetRootHandle(handle); 
      const allFiles = await getFilesRecursively(handle);
      await processFileList(allFiles);
    } catch (err) {}
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 h-full overflow-y-auto custom-scrollbar pb-32">
      {processing && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-md">
           <div className="bg-white p-10 rounded-[40px] shadow-2xl flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-legal-100 border-t-legal-600 rounded-full animate-spin"></div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Sincronizando Biblioteca</h3>
              <button onClick={() => stopRequested.current = true} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase">Cancelar</button>
           </div>
        </div>
      )}

      {similarityCheck && (
          <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
              <div className="bg-white max-w-xl w-full rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <div className="bg-orange-600 p-8 text-white">
                      <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-8 h-8"/>
                        <h3 className="text-xl font-black uppercase tracking-tighter">Termos Semelhantes Detetados</h3>
                      </div>
                      <p className="text-[11px] font-bold uppercase text-orange-100">O novo termo "{similarityCheck.newTag}" partilha palavras com descritores existentes.</p>
                  </div>
                  <div className="p-10 space-y-8">
                      <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Descritores Existentes Semelhantes:</label>
                          <div className="space-y-3">
                              {similarityCheck.similarTags.map(tag => (
                                  <div key={tag} className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100 group">
                                      <span className="text-[11px] font-black uppercase">{tag}</span>
                                      <button 
                                        onClick={() => confirmAddDescriptor('replace', tag)}
                                        className="bg-orange-100 text-orange-700 px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                                      >
                                          Substituir por "{similarityCheck.newTag}"
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                      <div className="pt-6 border-t flex gap-4">
                          <button 
                            onClick={() => setSimilarityCheck(null)} 
                            className="flex-1 py-4 border border-gray-200 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all"
                          >
                              Cancelar
                          </button>
                          <button 
                            onClick={() => confirmAddDescriptor('new')} 
                            className="flex-1 py-4 bg-legal-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all"
                          >
                              Acrescentar como Novo
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 col-span-2">
            <h2 className="text-2xl font-black text-legal-900 mb-6 flex items-center gap-3 uppercase tracking-tighter">
              <FolderUp className="w-7 h-7 text-legal-600" /> Carregamento Local
            </h2>
            <button onClick={handleSelectFolder} className="bg-legal-900 hover:bg-black text-white px-10 py-5 rounded-[22px] flex items-center gap-3 transition-all shadow-2xl font-black text-xs uppercase tracking-widest">
                <FilePlus className="w-5 h-5"/> {rootHandleName ? `Pasta Ativa: ${rootHandleName}` : 'Abrir Pasta de Acórdãos'}
            </button>
          </div>

          <div className="bg-legal-900 p-8 rounded-[2.5rem] shadow-xl text-white flex flex-col justify-center gap-4">
              <div className="flex items-center justify-between border-b border-legal-800 pb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-legal-400">Documentos</span>
                <span className="text-2xl font-black">{existingDB.length}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-legal-400">Total Descritores</span>
                <span className="text-2xl font-black text-blue-400">{availableDescriptors?.length || 0}</span>
              </div>
              <button 
                onClick={onSaveDb}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/20 py-3 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"
              >
                  <Save className="w-4 h-4 text-blue-400"/> Exportar Base de Dados
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
                  <div className="flex items-center gap-2 mb-1 px-1">
                      <Trash2 className="w-3.5 h-3.5 text-orange-500" />
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Substituir (Eliminar Alias)</label>
                  </div>
                  <JudgeAutocomplete 
                    allJudges={availableJudges} 
                    onSelect={(j) => { if (!selectedAliases.includes(j)) setSelectedAliases(p => [...p, j]); }} 
                    placeholder="Nome incorreto..." 
                    exclude={selectedMainJudge ? [selectedMainJudge, ...selectedAliases] : selectedAliases}
                  />
                  <div className="flex flex-wrap gap-2 pt-2">
                      {selectedAliases.map(alias => (
                          <div key={alias} className="bg-orange-100 text-orange-800 text-[9px] font-black uppercase px-3 py-2 rounded-xl border border-orange-200 flex items-center gap-2 group">
                              {alias}
                              <button onClick={() => setSelectedAliases(p => p.filter(a => a !== alias))} className="text-orange-400 hover:text-orange-600"><X className="w-3.5 h-3.5"/></button>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="hidden md:flex items-center justify-center pt-12 text-gray-200">
                  <ArrowRight className="w-6 h-6" />
              </div>

              <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-1 px-1">
                      <Check className="w-3.5 h-3.5 text-green-600" />
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Manter (Perfil Principal)</label>
                  </div>
                  <JudgeAutocomplete 
                    allJudges={availableJudges} 
                    onSelect={setSelectedMainJudge} 
                    placeholder="Nome oficial..." 
                    exclude={selectedAliases}
                  />
                  {selectedMainJudge && (
                      <div className="p-4 bg-legal-900 text-white rounded-2xl flex items-center justify-between shadow-lg animate-in zoom-in-95 mt-2">
                          <span className="text-[11px] font-black uppercase">{selectedMainJudge}</span>
                          <button onClick={() => setSelectedMainJudge(null)} className="text-legal-300 hover:text-white"><X className="w-4 h-4"/></button>
                      </div>
                  )}
              </div>
          </div>
      </div>
      
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h3 className="text-sm font-black text-legal-900 flex items-center gap-2 uppercase tracking-widest">
                    <Tag className="w-5 h-5 text-legal-600"/> Gestão de Vocabulário Controlado
                </h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <input 
                        type="text" 
                        placeholder="Pesquisar tema na lista..." 
                        className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold w-64 focus:ring-2 focus:ring-legal-400 outline-none"
                        value={searchDescriptor}
                        onChange={e => setSearchDescriptor(e.target.value)}
                    />
                </div>
           </div>

           <div className="space-y-6">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold outline-none"
                        placeholder="Adicionar novo descritor oficial..."
                        value={newDescriptor}
                        onChange={e => setNewDescriptor(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddDescriptor()}
                    />
                    <button onClick={handleAddDescriptor} className="bg-legal-900 text-white px-6 rounded-2xl hover:bg-black transition-all shadow-xl"><Plus className="w-6 h-6"/></button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-4 bg-gray-50 rounded-3xl border border-gray-100 custom-scrollbar">
                    {sortedDescriptors.map(tag => (
                        <div key={tag} className="flex items-center justify-between bg-white text-legal-900 text-[10px] font-black px-4 py-2.5 rounded-xl border border-gray-200 group hover:border-legal-300 transition-all">
                            {tag}
                            <button onClick={() => removeDescriptor(tag)} className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>
                    ))}
                </div>
           </div>
      </div>

      <div className="bg-slate-900 text-slate-300 p-8 rounded-[2.5rem] font-mono text-[11px] h-48 overflow-y-auto shadow-2xl border border-slate-800 custom-scrollbar">
           {logs.map((log, i) => <div key={i} className="mb-1 opacity-80">{">"} {log}</div>)}
      </div>
    </div>
  );
};

export default ProcessingModule;
