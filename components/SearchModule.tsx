
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Acordao, SearchFilters } from '../types';
import { Search, FileText, Tag, AlignLeft, Filter, X, Activity, UserCheck, Pencil, Save, Play, ChevronDown, Loader2, Calendar } from 'lucide-react';
import { extractMetadataWithAI } from '../services/geminiService';

const normalizeFuzzy = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "").replace(/(.)\1+/g, "$1").trim();
};

const fuzzyMatch = (text: string, query: string) => {
  if (!query) return true;
  return normalizeFuzzy(text).includes(normalizeFuzzy(query));
};

const SidebarAutocomplete: React.FC<{
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}> = ({ label, options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    if (!value) return options.slice(0, 20);
    return options.filter(o => normalizeFuzzy(o).includes(normalizeFuzzy(value))).slice(0, 20);
  }, [options, value]);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">{label}</label>
      <div className="relative">
        <input 
          placeholder={placeholder} 
          className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-legal-200" 
          value={value} 
          onChange={e => { onChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
      </div>
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
          {filtered.map((opt, i) => (
            <button key={i} onClick={() => { onChange(opt); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase hover:bg-legal-50 text-gray-700 border-b border-gray-50 last:border-0 transition-colors">
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SearchModule: React.FC<{
  db: Acordao[];
  onOpenPdf: (fileName: string) => void;
  onUpdateAcordao: (item: Acordao) => void;
  availableDescriptors: string[];
  availableJudges: string[];
}> = ({ db, onOpenPdf, onUpdateAcordao, availableDescriptors, availableJudges }) => {
  const [filters, setFilters] = useState<SearchFilters>({
    processo: '', relator: '', adjunto: '', descritor: '', dataInicio: '', dataFim: '', booleanAnd: '', booleanOr: '', booleanNot: ''
  });
  
  const [batchMode, setBatchMode] = useState<'sumario' | 'tags' | 'dados' | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState<{id: string, mode: string} | null>(null);
  const [editingItem, setEditingItem] = useState<Acordao | null>(null);

  const filteredResults = useMemo(() => {
    let results = db.filter(item => {
      if (filters.processo && !fuzzyMatch(item.processo, filters.processo)) return false;
      if (filters.relator && !fuzzyMatch(item.relator, filters.relator)) return false;
      if (filters.adjunto && !item.adjuntos.some(a => fuzzyMatch(a, filters.adjunto))) return false;
      if (filters.descritor && !item.descritores.some(d => fuzzyMatch(d, filters.descritor))) return false;

      if (filters.dataInicio && item.data !== 'N/D') {
        const itemDate = new Date(item.data.split('-').reverse().join('-'));
        const startDate = new Date(filters.dataInicio);
        if (itemDate < startDate) return false;
      }
      if (filters.dataFim && item.data !== 'N/D') {
        const itemDate = new Date(item.data.split('-').reverse().join('-'));
        const endDate = new Date(filters.dataFim);
        if (itemDate > endDate) return false;
      }

      const searchableContent = `${item.sumario} ${item.fundamentacaoDireito} ${item.relatorio} ${item.processo}`;
      if (filters.booleanAnd) {
        const terms = filters.booleanAnd.split(',').map(t => t.trim());
        if (!terms.every(t => fuzzyMatch(searchableContent, t))) return false;
      }
      if (filters.booleanOr) {
        const terms = filters.booleanOr.split(',').map(t => t.trim());
        if (!terms.some(t => fuzzyMatch(searchableContent, t))) return false;
      }
      if (filters.booleanNot) {
        const terms = filters.booleanNot.split(',').map(t => t.trim());
        if (terms.some(t => fuzzyMatch(searchableContent, t))) return false;
      }
      return true;
    });

    if (batchMode === 'sumario') {
      results = results.filter(item => item.sumario === "Sumário não encontrado" || !item.sumario);
    } else if (batchMode === 'tags') {
      results = results.filter(item => item.descritores.length === 0);
    } else if (batchMode === 'dados') {
      results = results.filter(item => item.relator === 'Desconhecido' || item.data === 'N/D');
    }

    return results;
  }, [db, filters, batchMode]);

  const runIA = async (item: Acordao, mode: 'sumario' | 'tags' | 'dados', silent = false) => {
    if (!silent) setIsProcessing({ id: item.id, mode });

    try {
      if (mode === 'sumario' || mode === 'tags') {
         if (!silent) onUpdateAcordao({ ...item, sumario: mode === 'sumario' ? 'A pesquisar sumário literal...' : item.sumario, descritores: mode === 'tags' ? [] : item.descritores });
         
         const result = await extractMetadataWithAI(item.textoAnalise, availableDescriptors);
         if (result) {
            onUpdateAcordao({
                ...item,
                sumario: mode === 'sumario' ? (result.sumario || "Sumário não encontrado") : item.sumario,
                descritores: mode === 'tags' ? (result.descritores || []) : item.descritores
            });
         }
      } else if (mode === 'dados') {
         const result = await extractMetadataWithAI(item.textoAnalise, availableDescriptors);
         if (result) {
            const updated = { ...item };
            if (updated.relator === 'Desconhecido' && result.relator) updated.relator = result.relator;
            if (updated.data === 'N/D' && result.data) updated.data = result.data;
            if (updated.adjuntos.length === 0 && result.adjuntos) updated.adjuntos = result.adjuntos;
            onUpdateAcordao(updated);
         }
      }
    } finally {
      if (!silent) setIsProcessing(null);
    }
  };

  const startBatchProcess = async () => {
    if (!batchMode) return;
    setIsBatchRunning(true);
    setBatchProgress(0);
    const queue = [...filteredResults];
    for (let i = 0; i < queue.length; i++) {
      setBatchProgress(i + 1);
      await runIA(queue[i], batchMode, true);
    }
    setIsBatchRunning(false);
    setBatchMode(null);
  };

  const handleSaveManualEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      onUpdateAcordao(editingItem);
      setEditingItem(null);
    }
  };

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden relative">
      <div className="w-80 bg-white border-r flex flex-col shadow-sm">
        <div className="p-6 border-b flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-legal-900 flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filtros
            </h3>
            <button onClick={() => setFilters({processo:'', relator:'', adjunto:'', descritor:'', dataInicio:'', dataFim:'', booleanAnd:'', booleanOr:'', booleanNot:''})} className="text-[9px] font-black uppercase text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all">Limpar</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-6">
            <SidebarAutocomplete label="Relator" options={availableJudges} value={filters.relator} onChange={v => setFilters({...filters, relator:v})} placeholder="Filtrar por relator..." />
            <SidebarAutocomplete label="Adjunto" options={availableJudges} value={filters.adjunto} onChange={v => setFilters({...filters, adjunto:v})} placeholder="Filtrar por adjunto..." />
            
            <div className="pt-2">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-3 flex items-center gap-2">
                <Calendar className="w-3 h-3"/> Período
              </label>
              <div className="grid grid-cols-1 gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-400 uppercase pointer-events-none">Desde</span>
                  <input 
                    type="date" 
                    className="w-full pl-14 pr-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-legal-100"
                    value={filters.dataInicio}
                    onChange={e => setFilters({...filters, dataInicio: e.target.value})}
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-400 uppercase pointer-events-none">Até</span>
                  <input 
                    type="date" 
                    className="w-full pl-14 pr-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-legal-100"
                    value={filters.dataFim}
                    onChange={e => setFilters({...filters, dataFim: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <SidebarAutocomplete label="Descritor" options={availableDescriptors} value={filters.descritor} onChange={v => setFilters({...filters, descritor:v})} placeholder="Filtrar por tema..." />
            
            <div className="pt-4 border-t border-gray-50">
              <label className="text-[9px] font-black text-legal-600 uppercase tracking-widest block mb-3">Pesquisa Booleana (Fuzzy)</label>
              <div className="space-y-2">
                <input placeholder="AND: termo1, termo2" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-legal-100 transition-all" value={filters.booleanAnd} onChange={e => setFilters({...filters, booleanAnd: e.target.value})} />
                <input placeholder="OR: termo1, termo2" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-legal-100 transition-all" value={filters.booleanOr} onChange={e => setFilters({...filters, booleanOr: e.target.value})} />
                <input placeholder="NOT: termo1" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-legal-100 transition-all" value={filters.booleanNot} onChange={e => setFilters({...filters, booleanNot: e.target.value})} />
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-50 border-t">
            <button className="w-full bg-legal-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-all">
                <Search className="w-4 h-4" /> Atualizar
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white p-6 border-b flex items-center justify-between shadow-sm">
            <span className="text-[10px] font-black uppercase text-gray-400">Documentos: <span className="text-legal-900">{filteredResults.length}</span></span>
            <div className="flex gap-2">
                <button onClick={() => setBatchMode(batchMode === 'sumario' ? null : 'sumario')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${batchMode === 'sumario' ? 'bg-orange-600 text-white shadow-inner' : 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100'}`} title="Filtrar por sumários não encontrados">Sumários</button>
                <button onClick={() => setBatchMode(batchMode === 'tags' ? null : 'tags')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${batchMode === 'tags' ? 'bg-purple-600 text-white shadow-inner' : 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100'}`} title="Filtrar por tags em falta">Tags</button>
                <button onClick={() => setBatchMode(batchMode === 'dados' ? null : 'dados')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${batchMode === 'dados' ? 'bg-blue-600 text-white shadow-inner' : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'}`} title="Filtrar por metadados em falta">Dados</button>
            </div>
        </div>

        {batchMode && (
          <div className="bg-legal-900 text-white p-6 flex items-center justify-between animate-in slide-in-from-top duration-300">
             <div className="flex items-center gap-6">
                <Activity className={`w-6 h-6 ${isBatchRunning ? 'animate-pulse text-orange-400' : 'text-white'}`} />
                <div>
                   <h4 className="text-xs font-black uppercase tracking-widest">Localização em Lote: {batchMode === 'sumario' ? 'Pesquisa de Sumários Literais' : batchMode === 'tags' ? 'Geração de Tags' : 'Completar Metadados'}</h4>
                   <p className="text-[10px] font-bold text-legal-400 uppercase mt-1">
                     {isBatchRunning 
                       ? `Processando... ${batchProgress} de ${filteredResults.length} concluídos` 
                       : `${filteredResults.length} documentos isolados.`}
                   </p>
                </div>
             </div>
             {!isBatchRunning && (
                <button onClick={startBatchProcess} className="px-8 py-3 bg-white text-legal-900 rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                  <Play className="w-3.5 h-3.5 fill-current"/> Iniciar Processamento
                </button>
             )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {filteredResults.length > 0 ? filteredResults.map(item => (
            <div key={item.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-legal-900 text-white px-4 py-2 rounded-xl text-[11px] font-black">{item.processo}</div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-2 rounded-xl">{item.data}</div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => runIA(item, 'sumario')} title="Localizar Sumário Literal com IA (Pesquisa apenas no início/fim)" className={`p-3 rounded-2xl transition-all ${isProcessing?.id === item.id && isProcessing.mode === 'sumario' ? 'bg-orange-600 text-white animate-pulse' : 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white'}`}>
                      {isProcessing?.id === item.id && isProcessing.mode === 'sumario' ? <Loader2 className="w-4 h-4 animate-spin"/> : <AlignLeft className="w-4 h-4"/>}
                    </button>
                    <button onClick={() => runIA(item, 'tags')} title="Extrair Descritores do Texto" className={`p-3 rounded-2xl transition-all ${isProcessing?.id === item.id && isProcessing.mode === 'tags' ? 'bg-purple-600 text-white animate-pulse' : 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100'}`}>
                      {isProcessing?.id === item.id && isProcessing.mode === 'tags' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Tag className="w-4 h-4"/>}
                    </button>
                    <button onClick={() => runIA(item, 'dados')} title="Completar Magistrados e Data" className={`p-3 rounded-2xl transition-all ${isProcessing?.id === item.id && isProcessing.mode === 'dados' ? 'bg-blue-600 text-white animate-pulse' : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'}`}>
                      {isProcessing?.id === item.id && isProcessing.mode === 'dados' ? <Loader2 className="w-4 h-4 animate-spin"/> : <UserCheck className="w-4 h-4"/>}
                    </button>
                    <button onClick={() => setEditingItem(item)} className="p-3 bg-gray-50 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all" title="Editar Manualmente"><Pencil className="w-4 h-4"/></button>
                    <button onClick={() => onOpenPdf(item.fileName)} className="p-3 bg-legal-900 text-white rounded-2xl shadow-xl hover:bg-black transition-all" title="Ver PDF Original"><FileText className="w-4 h-4"/></button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr,250px] gap-8">
                    <div className="space-y-4">
                        <p className={`text-sm text-gray-700 font-serif italic leading-relaxed bg-gray-50/50 p-6 rounded-[2rem] border border-gray-50 whitespace-pre-wrap ${item.sumario === 'Sumário não encontrado' ? 'opacity-40 italic' : ''}`}>
                          {item.sumario}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {item.descritores.map((tag, idx) => (<span key={idx} className="bg-legal-50 text-legal-800 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-legal-100">{tag}</span>))}
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded-[2rem] p-6 space-y-6 self-start">
                        <div>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Relator</span>
                          <div className={`text-[11px] font-black uppercase ${item.relator === 'Desconhecido' ? 'text-red-400' : 'text-legal-900'}`}>{item.relator}</div>
                        </div>
                        
                        {item.adjuntos && item.adjuntos.length > 0 && (
                          <div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                              Adjuntos
                            </span>
                            <div className="flex flex-col gap-1.5 pl-1 border-l-2 border-gray-200">
                              {item.adjuntos.map((adj, i) => (
                                <div key={i} className="text-[10px] font-bold uppercase text-gray-600 leading-tight">
                                  {adj}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Análise de Direito</span>
                          <div className="text-[9px] font-bold text-gray-500 uppercase">{item.fundamentacaoDireito ? `${Math.round(item.fundamentacaoDireito.length / 5)} palavras extraídas` : 'Não segmentado'}</div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4 uppercase font-black text-xs tracking-widest opacity-30 mt-20">
              <Search className="w-16 h-16" /> Nenhum documento encontrado com os filtros atuais.
            </div>
          )}
        </div>
      </div>

      {/* Modal Edição Manual */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-8 bg-legal-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Pencil className="w-6 h-6 text-legal-300" />
                  <h3 className="text-xl font-black uppercase tracking-tighter">Edição Manual</h3>
                </div>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSaveManualEdit} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-3 gap-6">
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Processo</label><input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none" value={editingItem.processo} onChange={e => setEditingItem({...editingItem, processo: e.target.value})} /></div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Relator</label><input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none" value={editingItem.relator} onChange={e => setEditingItem({...editingItem, relator: e.target.value})} /></div>
                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Data</label><input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none" value={editingItem.data} onChange={e => setEditingItem({...editingItem, data: e.target.value})} /></div>
              </div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Adjuntos (separados por vírgula)</label><input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none" value={editingItem.adjuntos.join(', ')} onChange={e => setEditingItem({...editingItem, adjuntos: e.target.value.split(',').map(s => s.trim())})} /></div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Sumário Literal (Deve ser fiel ao documento)</label>
                <textarea rows={10} className="w-full p-6 bg-gray-50 border border-gray-100 rounded-[2rem] text-sm font-serif italic outline-none resize-none focus:ring-2 focus:ring-legal-100 transition-all" value={editingItem.sumario} onChange={e => setEditingItem({...editingItem, sumario: e.target.value})} />
              </div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Descritores (separados por vírgula)</label><input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none" value={editingItem.descritores.join(', ')} onChange={e => setEditingItem({...editingItem, descritores: e.target.value.split(',').map(s => s.trim())})} /></div>
            </form>
            <div className="p-8 bg-gray-50 border-t flex gap-4">
                <button type="button" onClick={() => setEditingItem(null)} className="flex-1 py-4 border border-gray-200 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all">Cancelar</button>
                <button onClick={handleSaveManualEdit} className="flex-1 py-4 bg-legal-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95"><Save className="w-4 h-4" /> Guardar Alterações</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchModule;