
import React, { useState, useEffect, useMemo } from 'react';
import { Acordao, SearchFilters } from '../types';
import { Search, FileText, Loader2, Tag, AlignLeft, Trash2, Calendar, Users, Filter, X, ChevronRight, Activity, UserCheck, Key, AlertTriangle } from 'lucide-react';
import { extractMetadataWithAI, suggestDescriptorsWithAI } from '../services/geminiService';

const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const SearchModule: React.FC<{
  db: Acordao[];
  onOpenPdf: (fileName: string) => void;
  onUpdateAcordao: (item: Acordao) => void;
  availableDescriptors: string[];
  availableJudges: string[];
  apiKey: string;
}> = ({ db, onOpenPdf, onUpdateAcordao, availableDescriptors, availableJudges, apiKey }) => {
  const [filters, setFilters] = useState<SearchFilters>({
    processo: '', relator: '', adjunto: '', descritor: '', dataInicio: '', dataFim: '', booleanAnd: '', booleanOr: '', booleanNot: ''
  });
  const [isProcessing, setIsProcessing] = useState<{id: string | 'batch', mode: string} | null>(null);

  const filteredResults = useMemo(() => {
    return db.filter(item => {
      if (filters.processo && !normalize(item.processo).includes(normalize(filters.processo))) return false;
      if (filters.relator && !normalize(item.relator).includes(normalize(filters.relator))) return false;
      if (filters.adjunto && !item.adjuntos.some(a => normalize(a).includes(normalize(filters.adjunto)))) return false;
      if (filters.descritor && !item.descritores.some(d => normalize(d).includes(normalize(filters.descritor)))) return false;

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

      const fullText = normalize(item.sumario + " " + item.textoAnalise);
      if (filters.booleanAnd) {
        const terms = filters.booleanAnd.split(',').map(t => normalize(t));
        if (!terms.every(t => fullText.includes(t))) return false;
      }
      if (filters.booleanOr) {
        const terms = filters.booleanOr.split(',').map(t => normalize(t));
        if (!terms.some(t => fullText.includes(t))) return false;
      }
      if (filters.booleanNot) {
        const terms = filters.booleanNot.split(',').map(t => normalize(t));
        if (terms.some(t => fullText.includes(t))) return false;
      }
      return true;
    });
  }, [db, filters]);

  const runIA = async (item: Acordao, mode: 'sumario' | 'tags' | 'dados') => {
    if (!apiKey) {
      alert("Configure a sua API Key para usar funções de IA.");
      return;
    }
    setIsProcessing({ id: item.id, mode });
    try {
      if (mode === 'sumario' || mode === 'dados') {
        const result = await extractMetadataWithAI(item.textoAnalise, availableDescriptors, apiKey);
        if (result) {
          const updated = { ...item };
          if (mode === 'sumario' && result.sumario) updated.sumario = result.sumario;
          if (mode === 'dados') {
            if (result.relator) updated.relator = result.relator;
            if (result.data) updated.data = result.data;
          }
          onUpdateAcordao(updated);
        }
      } else if (mode === 'tags') {
        const tags = await suggestDescriptorsWithAI(item.sumario, availableDescriptors, apiKey);
        if (tags.length > 0) {
          onUpdateAcordao({ ...item, descritores: tags });
        }
      }
    } finally {
      setIsProcessing(null);
    }
  };

  const handleBatchIA = async (mode: 'sumario' | 'tags' | 'dados') => {
    if (!apiKey) {
        alert("Configuração de IA necessária.");
        return;
    }
    if (!confirm(`Processar ${filteredResults.length} documentos via IA?`)) return;
    setIsProcessing({ id: 'batch', mode });
    for (const item of filteredResults) {
      await runIA(item, mode);
    }
    setIsProcessing(null);
  };

  const resetFilters = () => setFilters({
    processo: '', relator: '', adjunto: '', descritor: '', dataInicio: '', dataFim: '', booleanAnd: '', booleanOr: '', booleanNot: ''
  });

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
      <div className="w-80 bg-white border-r flex flex-col shadow-sm">
        <div className="p-6 border-b flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-legal-900 flex items-center gap-2">
                <Filter className="w-4 h-4" /> Filtros
            </h3>
            <button onClick={resetFilters} className="text-[9px] font-black uppercase text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all">Limpar</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Processo</label>
              <input placeholder="Ex: 123/24..." className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none" value={filters.processo} onChange={e => setFilters({...filters, processo: e.target.value})} />
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Magistrados</label>
              <div className="space-y-2">
                <input placeholder="Relator..." className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none" value={filters.relator} onChange={e => setFilters({...filters, relator: e.target.value})} />
                <input placeholder="Adjunto..." className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none" value={filters.adjunto} onChange={e => setFilters({...filters, adjunto: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Temporal</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="w-full p-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold" value={filters.dataInicio} onChange={e => setFilters({...filters, dataInicio: e.target.value})} />
                <input type="date" className="w-full p-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold" value={filters.dataFim} onChange={e => setFilters({...filters, dataFim: e.target.value})} />
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-50 border-t">
            <button className="w-full bg-legal-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
                <Search className="w-4 h-4" /> Pesquisar
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase text-gray-400">Resultados: <span className="text-legal-900">{filteredResults.length}</span></span>
            </div>
            {apiKey && (
               <div className="flex gap-2">
                  <button onClick={() => handleBatchIA('sumario')} disabled={!!isProcessing} className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-xl text-[9px] font-black uppercase border border-orange-100 hover:bg-orange-100 transition-all disabled:opacity-50">
                      <AlignLeft className="w-3 h-3"/> Sumários IA
                  </button>
                  <button onClick={() => handleBatchIA('tags')} disabled={!!isProcessing} className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-xl text-[9px] font-black uppercase border border-purple-100 hover:bg-purple-100 transition-all disabled:opacity-50">
                      <Tag className="w-3 h-3"/> Tags IA
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
                    <div className="bg-legal-900 text-white px-4 py-2 rounded-xl text-[11px] font-black">{item.processo}</div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-2 rounded-xl">{item.data}</div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    {apiKey && (
                      <>
                        <button onClick={() => runIA(item, 'sumario')} className="p-3 bg-orange-50 text-orange-600 rounded-2xl hover:bg-orange-600 hover:text-white transition-all">
                            <AlignLeft className="w-4 h-4"/>
                        </button>
                        <button onClick={() => runIA(item, 'tags')} className="p-3 bg-purple-50 text-purple-600 rounded-2xl hover:bg-purple-600 hover:text-white transition-all">
                            <Tag className="w-4 h-4"/>
                        </button>
                      </>
                    )}
                    <button onClick={() => onOpenPdf(item.fileName)} className="p-3 bg-legal-900 text-white rounded-2xl shadow-xl hover:bg-black transition-all">
                        <FileText className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr,250px] gap-8">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700 font-serif italic leading-relaxed bg-gray-50/50 p-6 rounded-[2rem] border border-gray-50">{item.sumario}</p>
                        <div className="flex flex-wrap gap-2">
                            {item.descritores.map((tag, idx) => (
                                <span key={idx} className="bg-legal-50 text-legal-800 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-legal-100">{tag}</span>
                            ))}
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded-[2rem] p-6 space-y-4 self-start">
                        <div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Relator</span>
                            <div className="text-[11px] font-black text-legal-900 uppercase">{item.relator}</div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4 uppercase font-black text-xs tracking-widest opacity-30">
                <Search className="w-16 h-16" /> Resultados vazios.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModule;
