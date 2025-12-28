
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Acordao, SearchFilters } from '../types';
import { Search, FileText, Loader2, Tag, AlignLeft, Sparkles, Trash2, Calendar, Users, Filter, X, ChevronRight, Activity, UserCheck, ChevronDown, Eye, Play, StopCircle, Info } from 'lucide-react';
import { extractMetadataWithAI, suggestDescriptorsWithAI } from '../services/geminiService';

// Função de normalização avançada para pesquisa difusa (ignore acentos, espaços extras, e grafias antigas/novas)
const fuzzyNormalize = (str: string) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .toLowerCase()
    .replace(/\s+/g, "") // Remove todos os espaços para apanhar "fa tura"
    .replace(/ct/g, "t") // Normalização "factura" -> "fatura"
    .replace(/cc/g, "c") // Normalização "acção" -> "ação"
    .trim();
};

const SearchAutocomplete: React.FC<{
  items: string[];
  value: string;
  onSelect: (val: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
}> = ({ items, value, onSelect, placeholder, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const normValue = fuzzyNormalize(value);
    if (!value) return items.slice(0, 10);
    return items.filter(i => fuzzyNormalize(i).includes(normValue)).slice(0, 20);
  }, [items, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input 
          placeholder={placeholder} 
          className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-legal-400" 
          value={value} 
          onChange={e => { onSelect(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
        />
        {icon && <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30">{icon}</div>}
      </div>
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-[120] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
          {filtered.map((item, idx) => (
            <button 
              key={idx} 
              onClick={() => { onSelect(item); setIsOpen(false); }}
              className="w-full text-left px-4 py-2 text-[10px] font-black uppercase hover:bg-legal-50 hover:text-legal-900 border-b border-gray-50 last:border-0 transition-colors"
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MultiDescriptorSelect: React.FC<{
  available: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}> = ({ available, selected, onToggle }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const normQuery = fuzzyNormalize(query);
    return available.filter(t => fuzzyNormalize(t).includes(normQuery) && !selected.includes(t)).slice(0, 20);
  }, [available, query, selected]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="space-y-3">
      <div className="relative">
        <input 
          placeholder="Escolher descritores..." 
          className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-legal-400" 
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
        />
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        
        {isOpen && filtered.length > 0 && (
          <div className="absolute z-[120] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
            {filtered.map((tag, idx) => (
              <button 
                key={idx} 
                onClick={() => { onToggle(tag); setQuery(''); setIsOpen(false); }}
                className="w-full text-left px-4 py-2 text-[10px] font-black uppercase hover:bg-legal-50 hover:text-legal-900 border-b border-gray-50 last:border-0 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {selected.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-legal-900 text-white rounded-lg text-[9px] font-black uppercase shadow-sm">
            {tag}
            <button onClick={() => onToggle(tag)} className="hover:text-red-300 transition-colors"><X className="w-3 h-3"/></button>
          </span>
        ))}
      </div>
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
    processo: '', relator: '', adjunto: '', descritores: [], dataInicio: '', dataFim: '', booleanAnd: '', booleanOr: '', booleanNot: ''
  });
  
  const [isProcessing, setIsProcessing] = useState<{id: string | 'batch', mode: string} | null>(null);
  const [batchMode, setBatchMode] = useState<'sumario' | 'tags' | 'dados' | null>(null);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [viewingSummary, setViewingSummary] = useState<string | null>(null);

  const filteredResults = useMemo(() => {
    return db.filter(item => {
      // Filtros Básicos com Normalização Difusa
      if (filters.processo && !fuzzyNormalize(item.processo).includes(fuzzyNormalize(filters.processo))) return false;
      if (filters.relator && !fuzzyNormalize(item.relator).includes(fuzzyNormalize(filters.relator))) return false;
      if (filters.adjunto && !item.adjuntos.some(a => fuzzyNormalize(a).includes(fuzzyNormalize(filters.adjunto)))) return false;
      
      // Múltiplos Descritores
      if (filters.descritores.length > 0) {
        if (!filters.descritores.every(d => item.descritores.some(tag => fuzzyNormalize(tag) === fuzzyNormalize(d)))) return false;
      }

      // Datas
      if (filters.dataInicio && item.data !== 'N/D') {
        const parts = item.data.split('-');
        if (parts.length === 3) {
            const itemDate = new Date(parts.reverse().join('-'));
            const startDate = new Date(filters.dataInicio);
            if (itemDate < startDate) return false;
        }
      }
      if (filters.dataFim && item.data !== 'N/D') {
        const parts = item.data.split('-');
        if (parts.length === 3) {
            const itemDate = new Date(parts.reverse().join('-'));
            const endDate = new Date(filters.dataFim);
            if (itemDate > endDate) return false;
        }
      }

      // Lógica Booleana Difusa
      const fullTextFuzzy = fuzzyNormalize(item.sumario + " " + item.textoAnalise + " " + item.processo);
      
      if (filters.booleanAnd) {
        const terms = filters.booleanAnd.split(',').map(t => fuzzyNormalize(t.trim())).filter(t => t.length > 0);
        if (!terms.every(t => fullTextFuzzy.includes(t))) return false;
      }
      
      if (filters.booleanOr) {
        const terms = filters.booleanOr.split(',').map(t => fuzzyNormalize(t.trim())).filter(t => t.length > 0);
        // Se houver termos no OR, pelo menos um deve existir. Se não houver termos, o filtro não bloqueia.
        if (terms.length > 0 && !terms.some(t => fullTextFuzzy.includes(t))) return false;
      }

      if (filters.booleanNot) {
        const terms = filters.booleanNot.split(',').map(t => fuzzyNormalize(t.trim())).filter(t => t.length > 0);
        if (terms.some(t => fullTextFuzzy.includes(t))) return false;
      }

      return true;
    });
  }, [db, filters]);

  const runIA = async (item: Acordao, mode: 'sumario' | 'tags' | 'dados') => {
    setIsProcessing({ id: item.id, mode });
    try {
      if (mode === 'sumario' || mode === 'dados') {
        const result = await extractMetadataWithAI(item.textoAnalise, availableDescriptors);
        if (result && result !== "API_LIMIT_REACHED") {
          const updated = { ...item };
          if (mode === 'sumario' && result.sumario) updated.sumario = result.sumario;
          if (mode === 'dados') {
            if (result.relator && result.relator !== 'Desconhecido') updated.relator = result.relator;
            if (result.data && result.data !== 'N/D') updated.data = result.data;
          }
          onUpdateAcordao(updated);
        }
      } else if (mode === 'tags') {
        const tags = await suggestDescriptorsWithAI(item.sumario, availableDescriptors);
        if (tags.length > 0) {
          onUpdateAcordao({ ...item, descritores: tags });
        }
      }
    } finally {
      if (item.id !== 'batch') setIsProcessing(null);
    }
  };

  const startBatchIA = async () => {
    if (!batchMode) return;
    setIsProcessing({ id: 'batch', mode: batchMode });
    setBatchProgress({ current: 0, total: filteredResults.length });
    
    let count = 0;
    for (const item of filteredResults) {
      if (isProcessing?.id !== 'batch') break; // Suporte a cancelamento básico
      await runIA(item, batchMode);
      count++;
      setBatchProgress(p => ({ ...p, current: count }));
    }
    
    setIsProcessing(null);
    setBatchMode(null);
    alert(`Processamento de ${count} documentos concluído.`);
  };

  const resetFilters = () => setFilters({
    processo: '', relator: '', adjunto: '', descritores: [], dataInicio: '', dataFim: '', booleanAnd: '', booleanOr: '', booleanNot: ''
  });

  const toggleDescriptor = (tag: string) => {
    setFilters(prev => {
      const isSelected = prev.descritores.includes(tag);
      return {
        ...prev,
        descritores: isSelected ? prev.descritores.filter(t => t !== tag) : [...prev.descritores, tag]
      };
    });
  };

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden relative">
      {/* Modal de Sumário */}
      {viewingSummary && (
          <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-8 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white max-w-4xl w-full rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-8 border-b flex justify-between items-center bg-gray-50">
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter text-legal-900">Visualização de Sumário</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Processo {db.find(a => a.id === viewingSummary)?.processo}</p>
                      </div>
                      <button onClick={() => setViewingSummary(null)} className="p-3 hover:bg-white rounded-full transition-all text-gray-400 hover:text-red-600 shadow-sm"><X className="w-6 h-6"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                      <p className="text-lg text-gray-800 font-serif leading-relaxed first-letter:text-5xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:text-legal-900 italic">
                        {db.find(a => a.id === viewingSummary)?.sumario}
                      </p>
                  </div>
                  <div className="p-8 border-t bg-gray-50 flex justify-end">
                      <button onClick={() => setViewingSummary(null)} className="bg-legal-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Fechar</button>
                  </div>
              </div>
          </div>
      )}

      {/* Sidebar de Filtros */}
      <div className="w-80 bg-white border-r flex flex-col shadow-sm">
        <div className="p-6 border-b flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-legal-900 flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filtros Avançados
            </h3>
            <button onClick={resetFilters} className="text-[9px] font-black uppercase text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all">Limpar</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Identificação</label>
              <input placeholder="Nº Processo..." className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-legal-400 outline-none" value={filters.processo} onChange={e => setFilters({...filters, processo: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Magistrados</label>
              <div className="space-y-2">
                <SearchAutocomplete 
                  items={availableJudges} 
                  value={filters.relator} 
                  onSelect={val => setFilters({...filters, relator: val})} 
                  placeholder="Relator..." 
                  icon={<UserCheck className="w-3.5 h-3.5"/>}
                />
                <SearchAutocomplete 
                  items={availableJudges} 
                  value={filters.adjunto} 
                  onSelect={val => setFilters({...filters, adjunto: val})} 
                  placeholder="Adjunto..." 
                  icon={<Users className="w-3.5 h-3.5"/>}
                />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Temporal</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="w-full p-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold" value={filters.dataInicio} onChange={e => setFilters({...filters, dataInicio: e.target.value})} />
                <input type="date" className="w-full p-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold" value={filters.dataFim} onChange={e => setFilters({...filters, dataFim: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Vocabulário Controlado (Seleção)</label>
              <MultiDescriptorSelect 
                available={availableDescriptors} 
                selected={filters.descritores} 
                onToggle={toggleDescriptor}
              />
            </div>
          </div>

          <div className="pt-6 border-t space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-legal-600 uppercase tracking-widest block">Lógica Booleana Difusa</label>
                <div title="Ignora espaços, acentos e grafia" className="text-gray-300 cursor-help"><Info className="w-3.5 h-3.5"/></div>
            </div>
            <div className="space-y-3">
               <div className="relative">
                 <div className="absolute left-3 top-3 text-[9px] font-black text-green-600">AND</div>
                 <input placeholder="termo1, termo2..." className="w-full p-3 pl-10 bg-green-50/30 border border-green-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-green-400" value={filters.booleanAnd} onChange={e => setFilters({...filters, booleanAnd: e.target.value})} />
               </div>
               <div className="relative">
                 <div className="absolute left-3 top-3 text-[9px] font-black text-blue-600">OR</div>
                 <input placeholder="opção1, opção2..." className="w-full p-3 pl-10 bg-blue-50/30 border border-blue-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400" value={filters.booleanOr} onChange={e => setFilters({...filters, booleanOr: e.target.value})} />
               </div>
               <div className="relative">
                 <div className="absolute left-3 top-3 text-[9px] font-black text-red-600">NOT</div>
                 <input placeholder="excluir termo..." className="w-full p-3 pl-10 bg-red-50/30 border border-red-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-red-400" value={filters.booleanNot} onChange={e => setFilters({...filters, booleanNot: e.target.value})} />
               </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-gray-50 border-t">
            <div className="text-[9px] font-bold text-gray-400 uppercase text-center mb-3">Pesquisa automática ao digitar</div>
            <button onClick={() => {}} className="w-full bg-legal-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-all">
                <Search className="w-4 h-4" /> Atualizar Lista
            </button>
        </div>
      </div>

      {/* Área de Resultados */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Barra de Ações em Massa - Reformulada */}
        <div className="bg-white p-6 border-b flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
            <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase text-gray-400">Total Encontrados: <span className="text-legal-900 bg-gray-100 px-3 py-1 rounded-full">{filteredResults.length}</span></span>
            </div>
            
            {isProcessing?.id === 'batch' ? (
                <div className="flex-1 max-w-md mx-8">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-[9px] font-black uppercase text-legal-600 animate-pulse">A processar {isProcessing.mode}...</span>
                        <span className="text-[10px] font-black text-legal-900">{batchProgress.total - batchProgress.current} restantes</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                        <div 
                          className="h-full bg-legal-600 transition-all duration-500" 
                          style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                        ></div>
                    </div>
                </div>
            ) : batchMode ? (
                <div className="flex items-center gap-3 animate-in slide-in-from-right-4">
                    <span className="text-[10px] font-black uppercase text-orange-600">Pronto para {batchMode}:</span>
                    <button 
                        onClick={startBatchIA}
                        className="bg-orange-600 text-white px-8 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl hover:bg-black transition-all"
                    >
                        <Play className="w-3.5 h-3.5 fill-current"/> Iniciar Processamento ({filteredResults.length})
                    </button>
                    <button 
                        onClick={() => setBatchMode(null)}
                        className="text-gray-400 hover:text-red-600 p-2"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <button 
                      onClick={() => setBatchMode('sumario')} 
                      className="flex items-center gap-2 px-5 py-2.5 bg-orange-50 text-orange-700 rounded-xl text-[9px] font-black uppercase border border-orange-100 hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                    >
                        <AlignLeft className="w-3.5 h-3.5"/> Tratar Sumários
                    </button>
                    <button 
                      onClick={() => setBatchMode('tags')} 
                      className="flex items-center gap-2 px-5 py-2.5 bg-purple-50 text-purple-700 rounded-xl text-[9px] font-black uppercase border border-purple-100 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                    >
                        <Tag className="w-3.5 h-3.5"/> Sugerir Tags
                    </button>
                    <button 
                      onClick={() => setBatchMode('dados')} 
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-[9px] font-black uppercase border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                    >
                        <Activity className="w-3.5 h-3.5"/> Metadados IA
                    </button>
                </div>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {filteredResults.length > 0 ? filteredResults.map(item => (
            <div key={item.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden">
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-legal-900 text-white px-4 py-2 rounded-xl text-[11px] font-black shadow-sm">{item.processo}</div>
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-2 rounded-xl">
                        <Calendar className="w-3.5 h-3.5 text-legal-400" /> {item.data}
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                    <button onClick={() => setViewingSummary(item.id)} title="Ver Sumário Completo" className="p-3 bg-gray-50 text-legal-700 rounded-2xl hover:bg-legal-100 transition-all border border-gray-100">
                        <Eye className="w-4 h-4"/>
                    </button>
                    <button onClick={() => runIA(item, 'sumario')} title="IA: Extrair Sumário" className="p-3 bg-orange-50 text-orange-600 rounded-2xl hover:bg-orange-600 hover:text-white transition-all">
                        {isProcessing?.id === item.id && isProcessing.mode === 'sumario' ? <Loader2 className="w-4 h-4 animate-spin"/> : <AlignLeft className="w-4 h-4"/>}
                    </button>
                    <button onClick={() => runIA(item, 'tags')} title="IA: Sugerir Tags" className="p-3 bg-purple-50 text-purple-600 rounded-2xl hover:bg-purple-600 hover:text-white transition-all">
                        {isProcessing?.id === item.id && isProcessing.mode === 'tags' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Tag className="w-4 h-4"/>}
                    </button>
                    <button onClick={() => onOpenPdf(item.fileName)} title="Abrir Documento Original" className="p-3 bg-legal-900 text-white rounded-2xl shadow-xl hover:bg-black transition-all">
                        <FileText className="w-4 h-4"/>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr,250px] gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-black text-legal-700 uppercase tracking-widest opacity-60">
                            <AlignLeft className="w-3.5 h-3.5" /> Excerto do Sumário
                        </div>
                        <div className="relative">
                            <p className="text-sm text-gray-700 font-serif italic leading-relaxed bg-gray-50/50 p-6 rounded-[2rem] border border-gray-50 line-clamp-4">
                                {item.sumario}
                            </p>
                            <button onClick={() => setViewingSummary(item.id)} className="absolute bottom-2 right-2 bg-white/80 backdrop-blur-sm p-2 rounded-xl text-[9px] font-black uppercase text-legal-600 border border-gray-100 hover:bg-legal-900 hover:text-white transition-all shadow-sm">Ler tudo</button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                            {item.descritores.map((tag, idx) => (
                                <span key={idx} className="bg-legal-50 text-legal-800 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-legal-100 flex items-center gap-1.5">
                                    <Tag className="w-3 h-3 opacity-40" /> {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-[2rem] p-6 space-y-4 self-start">
                        <div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Relator</span>
                            <div className="text-[11px] font-black text-legal-900 uppercase flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-legal-400" /> {item.relator}
                            </div>
                        </div>
                        {item.adjuntos.length > 0 && (
                            <div>
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Adjuntos</span>
                                <div className="space-y-1.5">
                                    {item.adjuntos.map((adj, i) => (
                                        <div key={i} className="text-[10px] font-bold text-gray-600 uppercase flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5 text-gray-300" /> {adj}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4 uppercase font-black text-xs tracking-widest opacity-30">
                <Search className="w-16 h-16" />
                Nenhum resultado encontrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModule;
