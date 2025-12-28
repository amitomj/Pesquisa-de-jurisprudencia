
import React, { useState, useEffect, useMemo } from 'react';
import { Acordao, SearchFilters } from '../types';
import { Search, FileText, Loader2, Tag, AlignLeft, Trash2, Calendar, Users, Filter, X, ChevronRight, Activity, UserCheck, Key, AlertTriangle, Pencil, Save, Trash, Play, Pause, CheckCircle2 } from 'lucide-react';
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
  
  // Estados para Processamento Batch
  const [batchMode, setBatchMode] = useState<'sumario' | 'tags' | 'dados' | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  
  const [isProcessing, setIsProcessing] = useState<{id: string, mode: string} | null>(null);
  const [editingItem, setEditingItem] = useState<Acordao | null>(null);

  // Filtra os resultados normais + filtro de batch se ativo
  const filteredResults = useMemo(() => {
    let results = db.filter(item => {
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

    // Filtro adicional para o modo Batch
    if (batchMode === 'sumario') {
      results = results.filter(item => !item.sumario || item.sumario.includes("não identificado") || item.sumario.length < 50);
    } else if (batchMode === 'tags') {
      results = results.filter(item => item.descritores.length === 0);
    } else if (batchMode === 'dados') {
      results = results.filter(item => item.relator === 'Desconhecido' || item.data === 'N/D');
    }

    return results;
  }, [db, filters, batchMode]);

  const runIA = async (item: Acordao, mode: 'sumario' | 'tags' | 'dados', silent = false) => {
    if (!apiKey) {
      if (!silent) alert("⚠️ Chave API não configurada. Clique em 'CONFIGURAR CHAVE GEMINI' no topo da aplicação para ativar as funções de IA.");
      return;
    }
    
    if (!silent) setIsProcessing({ id: item.id, mode });
    
    try {
      // Regra: Sumário ou Tags limpam ambos os conteúdos existentes e procuram novos
      if (mode === 'sumario' || mode === 'tags') {
        const result = await extractMetadataWithAI(item.textoAnalise, availableDescriptors, apiKey);
        if (result) {
          const updated = { ...item };
          // Atualiza sumário e descritores (limpeza lógica ocorre na atribuição do novo resultado da IA)
          if (result.sumario) updated.sumario = result.sumario;
          if (result.descritores) updated.descritores = result.descritores;
          onUpdateAcordao(updated);
        }
      } 
      // Regra: Dados apenas completa o que falta (relator 'Desconhecido' ou data 'N/D')
      else if (mode === 'dados') {
        const result = await extractMetadataWithAI(item.textoAnalise, availableDescriptors, apiKey);
        if (result) {
          const updated = { ...item };
          if ((updated.relator === 'Desconhecido' || !updated.relator) && result.relator) updated.relator = result.relator;
          if ((updated.data === 'N/D' || !updated.data) && result.data) updated.data = result.data;
          if (updated.adjuntos.length === 0 && result.adjuntos) updated.adjuntos = result.adjuntos;
          onUpdateAcordao(updated);
        }
      }
    } finally {
      if (!silent) setIsProcessing(null);
    }
  };

  const startBatchProcess = async () => {
    if (!apiKey) {
      alert("⚠️ Chave API necessária para processamento em lote.");
      return;
    }
    if (!batchMode) return;
    setIsBatchRunning(true);
    setBatchProgress(0);
    
    const queue = [...filteredResults];
    for (let i = 0; i < queue.length; i++) {
      if (!isBatchRunning && i > 0 && !batchMode) break;
      setBatchProgress(i + 1);
      await runIA(queue[i], batchMode, true);
    }
    
    setIsBatchRunning(false);
    setBatchMode(null);
    setBatchProgress(0);
  };

  const resetFilters = () => {
    setFilters({
      processo: '', relator: '', adjunto: '', descritor: '', dataInicio: '', dataFim: '', booleanAnd: '', booleanOr: '', booleanNot: ''
    });
    setBatchMode(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      onUpdateAcordao(editingItem);
      setEditingItem(null);
    }
  };

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden relative">
      {/* Sidebar de Filtros */}
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

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase text-gray-400">Resultados: <span className="text-legal-900">{filteredResults.length}</span></span>
            </div>
            
            {/* Botões IA Sempre Visíveis no Topo */}
            <div className="flex gap-2">
                <button 
                  onClick={() => {
                    if (!apiKey) alert("⚠️ Chave API não configurada.");
                    setBatchMode(batchMode === 'sumario' ? null : 'sumario');
                  }} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${batchMode === 'sumario' ? 'bg-orange-600 text-white border-orange-700 shadow-inner' : 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100'}`}
                >
                    <AlignLeft className="w-3 h-3"/> Sumários em Falta
                </button>
                <button 
                  onClick={() => {
                    if (!apiKey) alert("⚠️ Chave API não configurada.");
                    setBatchMode(batchMode === 'tags' ? null : 'tags');
                  }} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${batchMode === 'tags' ? 'bg-purple-600 text-white border-purple-700 shadow-inner' : 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100'}`}
                >
                    <Tag className="w-3 h-3"/> Tags em Falta
                </button>
                <button 
                  onClick={() => {
                    if (!apiKey) alert("⚠️ Chave API não configurada.");
                    setBatchMode(batchMode === 'dados' ? null : 'dados');
                  }} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${batchMode === 'dados' ? 'bg-blue-600 text-white border-blue-700 shadow-inner' : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'}`}
                >
                    <UserCheck className="w-3 h-3"/> Completar Dados
                </button>
            </div>
        </div>

        {/* Banner de Processamento Batch */}
        {batchMode && (
          <div className="bg-legal-900 text-white p-6 flex items-center justify-between animate-in slide-in-from-top duration-300">
             <div className="flex items-center gap-6">
                <div className="p-3 bg-white/10 rounded-2xl">
                    <Activity className={`w-6 h-6 ${isBatchRunning ? 'animate-pulse text-orange-400' : 'text-white'}`} />
                </div>
                <div>
                   <h4 className="text-xs font-black uppercase tracking-widest">
                      Modo Batch: {batchMode === 'sumario' ? 'Extração de Sumários' : batchMode === 'tags' ? 'Geração de Descritores' : 'Preenchimento de Metadados'}
                   </h4>
                   <p className="text-[10px] font-bold text-legal-400 uppercase mt-1">
                      {isBatchRunning 
                        ? `A processar... Faltam ${filteredResults.length - batchProgress} documentos` 
                        : `${filteredResults.length} documentos identificados para processamento.`}
                   </p>
                </div>
             </div>
             <div className="flex gap-3">
                <button 
                  onClick={() => setBatchMode(null)} 
                  disabled={isBatchRunning}
                  className="px-6 py-3 rounded-xl border border-white/20 text-[10px] font-black uppercase hover:bg-white/10 transition-all disabled:opacity-30"
                >
                  Cancelar
                </button>
                {!isBatchRunning ? (
                  <button 
                    onClick={startBatchProcess}
                    className="px-8 py-3 bg-white text-legal-900 rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-legal-50 flex items-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5 fill-current"/> Iniciar Processamento
                  </button>
                ) : (
                   <div className="flex items-center gap-4 px-6 py-3 bg-white/5 rounded-xl border border-white/10">
                      <div className="h-1.5 w-32 bg-white/10 rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-orange-500 transition-all duration-500" 
                           style={{ width: `${(batchProgress / filteredResults.length) * 100}%` }}
                         ></div>
                      </div>
                      <span className="text-[10px] font-black font-mono">{Math.round((batchProgress / filteredResults.length) * 100)}%</span>
                   </div>
                )}
             </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {filteredResults.length > 0 ? filteredResults.map(item => (
            <div key={item.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden">
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-legal-900 text-white px-4 py-2 rounded-xl text-[11px] font-black">{item.processo}</div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-2 rounded-xl">{item.data}</div>
                  </div>
                  
                  {/* Botões IA Sempre Visíveis no Card */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => runIA(item, 'sumario')} 
                      className={`p-3 rounded-2xl transition-all ${isProcessing?.id === item.id && isProcessing.mode === 'sumario' ? 'bg-orange-600 text-white animate-pulse' : 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white'}`} 
                      title="IA: Regenerar Sumário e Tags"
                    >
                        <AlignLeft className="w-4 h-4"/>
                    </button>
                    <button 
                      onClick={() => runIA(item, 'tags')} 
                      className={`p-3 rounded-2xl transition-all ${isProcessing?.id === item.id && isProcessing.mode === 'tags' ? 'bg-purple-600 text-white animate-pulse' : 'bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white'}`} 
                      title="IA: Regenerar Tags"
                    >
                        <Tag className="w-4 h-4"/>
                    </button>
                    <button 
                      onClick={() => runIA(item, 'dados')} 
                      className={`p-3 rounded-2xl transition-all ${isProcessing?.id === item.id && isProcessing.mode === 'dados' ? 'bg-blue-600 text-white animate-pulse' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'}`} 
                      title="IA: Completar Dados em Falta"
                    >
                        <UserCheck className="w-4 h-4"/>
                    </button>
                    
                    <button onClick={() => setEditingItem(item)} className="p-3 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all" title="Editar Manualmente">
                        <Pencil className="w-4 h-4"/>
                    </button>
                    <button onClick={() => onOpenPdf(item.fileName)} className="p-3 bg-legal-900 text-white rounded-2xl shadow-xl hover:bg-black transition-all" title="Ver PDF">
                        <FileText className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-[1fr,250px] gap-8">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700 font-serif italic leading-relaxed bg-gray-50/50 p-6 rounded-[2rem] border border-gray-50 whitespace-pre-wrap">
                          {isProcessing?.id === item.id ? "A processar novos dados..." : item.sumario}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {item.descritores.map((tag, idx) => (
                                <span key={idx} className="bg-legal-50 text-legal-800 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-legal-100">{tag}</span>
                            ))}
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded-[2rem] p-6 space-y-4 self-start">
                        <div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Relator</span>
                            <div className={`text-[11px] font-black uppercase ${item.relator === 'Desconhecido' ? 'text-red-400' : 'text-legal-900'}`}>{item.relator}</div>
                        </div>
                        {item.adjuntos.length > 0 && (
                          <div>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Adjuntos</span>
                              <div className="text-[10px] font-bold text-gray-600 uppercase leading-tight">{item.adjuntos.join(', ')}</div>
                          </div>
                        )}
                        <div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Ficheiro</span>
                            <div className="text-[9px] font-mono text-gray-400 truncate">{item.fileName}</div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4 uppercase font-black text-xs tracking-widest opacity-30">
                <Search className="w-16 h-16" /> Resultados vazios ou filtros ativos.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição Manual */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-8 bg-legal-900 text-white flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Pencil className="w-6 h-6 text-legal-300" />
                  <h3 className="text-xl font-black uppercase tracking-tighter">Edição Manual do Acórdão</h3>
                </div>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Processo</label>
                  <input 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-legal-400 outline-none" 
                    value={editingItem.processo} 
                    onChange={e => setEditingItem({...editingItem, processo: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Relator</label>
                  <input 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-legal-400 outline-none" 
                    value={editingItem.relator} 
                    onChange={e => setEditingItem({...editingItem, relator: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Data da Decisão</label>
                  <input 
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-legal-400 outline-none" 
                    value={editingItem.data} 
                    onChange={e => setEditingItem({...editingItem, data: e.target.value})}
                    placeholder="DD-MM-AAAA"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Sumário</label>
                <textarea 
                  rows={10}
                  className="w-full p-6 bg-gray-50 border border-gray-100 rounded-[2rem] text-sm font-serif italic leading-relaxed focus:ring-2 focus:ring-legal-400 outline-none resize-none" 
                  value={editingItem.sumario} 
                  onChange={e => setEditingItem({...editingItem, sumario: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Descritores (separados por vírgula)</label>
                <input 
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-legal-400 outline-none" 
                  value={editingItem.descritores.join(', ')} 
                  onChange={e => setEditingItem({...editingItem, descritores: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')})}
                />
              </div>
            </form>

            <div className="p-8 bg-gray-50 border-t flex gap-4 flex-shrink-0">
                <button type="button" onClick={() => setEditingItem(null)} className="flex-1 py-4 border border-gray-200 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all">
                  Cancelar
                </button>
                <button type="submit" onClick={handleSaveEdit} className="flex-1 py-4 bg-legal-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> Guardar Alterações
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchModule;
