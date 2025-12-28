
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Acordao, SearchFilters, SearchResult } from '../types';
import { Search, Filter, Eye, FileText, X, Edit2, ChevronLeft, ChevronRight, Wand2, Loader2, AlertCircle, Sparkles, Check, Database, Zap, Users, Info, CircleHelp, OctagonAlert, UserCheck } from 'lucide-react';
import { extractMetadataWithAI } from '../services/geminiService';

const parseDate = (dateStr: string): number => {
  const parts = dateStr.split(/[-/.]/);
  if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  return 0;
};

const fuzzyMatch = (text: string, term: string): boolean => {
  if (!term) return true;
  if (!text) return false;
  const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const nText = normalize(text);
  const nTerm = normalize(term);
  return nText.includes(nTerm);
};

// PdfViewer Component
const PdfViewer: React.FC<{ data: ArrayBuffer | null }> = ({ data }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [pageNum, setPageNum] = useState(1);
    const [scale, setScale] = useState(1.2);
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        if (!data) return;
        const loadPdf = async () => {
            try {
                // @ts-ignore
                const loadingTask = window.pdfjsLib.getDocument({ data });
                const doc = await loadingTask.promise;
                setPdfDoc(doc);
                setPageNum(1);
            } catch (err: any) {
                console.error("Erro ao carregar PDF.");
            }
        };
        loadPdf();
    }, [data]);

    useEffect(() => {
        if (!pdfDoc) return;
        renderPage(pageNum);
    }, [pdfDoc, pageNum, scale]);

    const renderPage = async (num: number) => {
        try {
            const page = await pdfDoc.getPage(num);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            if (!canvas) return;
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            if (renderTaskRef.current) {
                try { await renderTaskRef.current.cancel(); } catch (e) {}
            }
            const renderTask = page.render({ canvasContext: context, viewport: viewport });
            renderTaskRef.current = renderTask;
            await renderTask.promise;
            renderTaskRef.current = null;
        } catch (err: any) {}
    };

    return (
        <div className="flex flex-col h-full bg-gray-200">
            <div className="bg-gray-700 text-white p-2 flex justify-between items-center flex-shrink-0 z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => setPageNum(p => Math.max(1, p - 1))} className="p-1 hover:bg-gray-600 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
                    <span className="text-xs font-bold">{pageNum} / {pdfDoc?.numPages || '-'}</span>
                    <button onClick={() => setPageNum(p => Math.min(pdfDoc?.numPages || 1, p + 1))} className="p-1 hover:bg-gray-600 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
                </div>
            </div>
            <div className="flex-1 overflow-auto flex justify-center p-4">
                 <canvas ref={canvasRef} className="shadow-2xl bg-white" />
            </div>
        </div>
    );
};

interface Props {
  db: Acordao[];
  onSaveSearch: (result: SearchResult) => void;
  savedSearches: SearchResult[];
  onDeleteSearch: (id: string) => void;
  onUpdateSearchName: (id: string, name: string) => void;
  onOpenPdf: (fileName: string) => void;
  onGetPdfData: (fileName: string) => Promise<ArrayBuffer | null>;
  onUpdateAcordao: (item: Acordao) => void;
  availableDescriptors: string[];
  availableJudges: string[];
  onAddDescriptors: (tags: string[]) => void;
}

const ITEMS_PER_PAGE = 20;

const SearchModule: React.FC<Props> = ({ 
    db, onOpenPdf, onGetPdfData, onUpdateAcordao, availableDescriptors, availableJudges
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    processo: '', relator: '', adjunto: '', descritor: '', dataInicio: '', dataFim: '', booleanAnd: '', booleanOr: '', booleanNot: ''
  });
  const [showMissingSummary, setShowMissingSummary] = useState(false);
  const [showMissingData, setShowMissingData] = useState(false);

  const [results, setResults] = useState<Acordao[]>([]);
  const [correctionMode, setCorrectionMode] = useState<Acordao | null>(null);
  const [correctionForm, setCorrectionForm] = useState<Acordao | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [summaryView, setSummaryView] = useState<Acordao | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number, type: string, fileName: string, processedItems: string[], errorCount: number}>({
    current: 0, total: 0, type: '', fileName: '', processedItems: [], errorCount: 0
  });
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [isProcessingSingle, setIsProcessingSingle] = useState<string | null>(null);

  useEffect(() => {
    handleSearch();
  }, [db, showMissingSummary, showMissingData]);

  useEffect(() => {
     if (correctionMode) {
         setPdfData(null);
         onGetPdfData(correctionMode.fileName).then(buffer => setPdfData(buffer));
     }
  }, [correctionMode]);

  const handleSearch = () => {
    const filtered = db.filter(item => {
      if (showMissingSummary) {
          const noSum = !item.sumario || item.sumario.length < 50 || item.sumario.includes('Sumário não identificado');
          if (!noSum) return false;
      }
      if (showMissingData) {
          const missData = item.relator === 'Desconhecido' || item.data === 'N/D';
          if (!missData) return false;
      }
      if (filters.processo && !fuzzyMatch(item.processo, filters.processo)) return false;
      if (filters.relator && !fuzzyMatch(item.relator, filters.relator)) return false;
      if (filters.adjunto && !item.adjuntos.some(a => fuzzyMatch(a, filters.adjunto))) return false;
      if (filters.descritor && item.descritores && !item.descritores.some(d => fuzzyMatch(d, filters.descritor))) return false;
      const itemDate = parseDate(item.data);
      if (filters.dataInicio && itemDate < parseDate(filters.dataInicio)) return false;
      if (filters.dataFim && itemDate > parseDate(filters.dataFim)) return false;
      const content = (item.sumario + ' ' + item.textoAnalise);
      if (filters.booleanAnd && !filters.booleanAnd.split(' ').every(t => fuzzyMatch(content, t))) return false;
      return true;
    });
    setResults(filtered.sort((a, b) => parseDate(b.data) - parseDate(a.data)));
    setCurrentPage(1);
  };

  const handleBatchAI = async (type: 'sumario' | 'missing') => {
      const targetList = type === 'sumario' 
          ? results.filter(i => !i.sumario || i.sumario.length < 50 || i.sumario.includes('Sumário não identificado'))
          : results.filter(i => i.relator === 'Desconhecido' || i.data === 'N/D' || i.adjuntos.length === 0);

      if (targetList.length === 0) return alert("Nenhum processo filtrado necessita desta correção.");
      if (!confirm(`Confirmar o processamento por IA de ${targetList.length} processos?`)) return;

      setIsBatchRunning(true);
      setBatchProgress({ 
          current: 0, 
          total: targetList.length, 
          type: type === 'sumario' ? 'Sumários Integrais' : 'Identidades e Datas',
          fileName: '',
          processedItems: [],
          errorCount: 0
      });
      
      for (let i = 0; i < targetList.length; i++) {
          const item = targetList[i];
          setBatchProgress(prev => ({ ...prev, fileName: item.fileName }));
          await new Promise(resolve => setTimeout(resolve, 800));

          try {
              const textLen = item.textoCompleto.length;
              const context = textLen < 15000 
                ? item.textoCompleto 
                : item.textoCompleto.substring(0, 8000) + "\n[...]\n" + item.textoCompleto.substring(textLen - 7000);
              
              const aiResult = await extractMetadataWithAI(context);
              if (aiResult) {
                const updated = { ...item };
                if (type === 'missing') {
                    if (aiResult.data && aiResult.data !== 'N/D') updated.data = aiResult.data;
                    if (aiResult.relator && aiResult.relator !== 'Desconhecido') updated.relator = aiResult.relator;
                    if (aiResult.adjuntos && aiResult.adjuntos.length > 0) updated.adjuntos = aiResult.adjuntos.filter((a:string) => a !== 'N/D');
                }
                if (aiResult.sumario && aiResult.sumario.length > 50) { updated.sumario = aiResult.sumario; }
                onUpdateAcordao(updated);
              }
              setBatchProgress(prev => ({ ...prev, current: i + 1 }));
          } catch (e: any) { 
              setBatchProgress(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
          }
      }
      setIsBatchRunning(false);
  };

  const processSingle = async (item: Acordao, mode: 'full' | 'sumario' | 'dados') => {
      setIsProcessingSingle(item.id);
      try {
          const textLen = item.textoCompleto.length;
          const context = textLen < 15000 
            ? item.textoCompleto 
            : item.textoCompleto.substring(0, 8000) + "\n[...]\n" + item.textoCompleto.substring(textLen - 7000);
          
          const aiResult = await extractMetadataWithAI(context);
          if (!aiResult) return;

          const updated = { ...item };
          if (mode === 'full' || mode === 'dados') {
              if (aiResult.data) updated.data = aiResult.data;
              if (aiResult.relator) updated.relator = aiResult.relator;
              if (aiResult.adjuntos) updated.adjuntos = aiResult.adjuntos.filter((a:string)=>a!=='N/D');
          }
          if (mode === 'full' || mode === 'sumario') {
              if (aiResult.sumario && aiResult.sumario.length > 50) updated.sumario = aiResult.sumario;
          }
          onUpdateAcordao(updated);
      } catch (e: any) {
          console.error(e);
      } finally {
          setIsProcessingSingle(null);
      }
  };

  const openCorrection = (item: Acordao) => {
    setCorrectionMode(item);
    const adjs = [...(item.adjuntos || [])];
    while (adjs.length < 2) adjs.push('Nenhum');
    setCorrectionForm({...item, adjuntos: adjs, descritores: item.descritores || []});
  };

  const saveCorrection = () => {
    if (correctionForm) {
      const finalAdjs = Array.from(new Set(correctionForm.adjuntos.filter(a => a && a !== 'Nenhum')));
      onUpdateAcordao({...correctionForm, adjuntos: finalAdjs});
      setCorrectionMode(null);
    }
  };

  const handleUpdateAdjunto = (index: number, name: string) => {
      if (!correctionForm) return;
      const newAdjuntos = [...correctionForm.adjuntos];
      newAdjuntos[index] = name;
      setCorrectionForm({...correctionForm, adjuntos: newAdjuntos});
  };

  const displayedResults = results.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="flex h-full p-0 md:p-4 gap-4 overflow-hidden bg-gray-50">
      {/* Sidebar de Filtros */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-white border-r md:border md:rounded-3xl shadow-lg border-gray-100 overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b flex items-center justify-between bg-gray-50/80 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-legal-100 rounded-lg"><Filter className="w-4 h-4 text-legal-700"/></div>
                <h3 className="font-black text-xs text-legal-900 uppercase tracking-widest">Painel de Filtros</h3>
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-2">
                <div className="flex items-center gap-2 mb-3 text-legal-900">
                    <CircleHelp className="w-3.5 h-3.5" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Análise de Qualidade</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                    <button 
                        onClick={() => { setShowMissingSummary(!showMissingSummary); setShowMissingData(false); }} 
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${showMissingSummary ? 'bg-orange-600 text-white border-orange-500 shadow-lg' : 'bg-white text-gray-500 border-gray-100 hover:border-orange-200'}`}
                    >
                        <span>Sem Sumário</span>
                        <div className={`px-2 py-0.5 rounded-full text-[9px] ${showMissingSummary ? 'bg-orange-800' : 'bg-gray-100 text-gray-400'}`}>
                            {db.filter(i => !i.sumario || i.sumario.length < 50 || i.sumario.includes('não identificado')).length}
                        </div>
                    </button>
                    <button 
                        onClick={() => { setShowMissingData(!showMissingData); setShowMissingSummary(false); }} 
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${showMissingData ? 'bg-blue-600 text-white border-blue-500 shadow-lg' : 'bg-white text-gray-500 border-gray-100 hover:border-blue-200'}`}
                    >
                        <span>Metadados em falta</span>
                        <div className={`px-2 py-0.5 rounded-full text-[9px] ${showMissingData ? 'bg-blue-800' : 'bg-gray-100 text-gray-400'}`}>
                            {db.filter(i => i.relator === 'Desconhecido' || i.data === 'N/D').length}
                        </div>
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1 px-1">N.º do Processo</label>
                    <input type="text" className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-legal-600 outline-none" value={filters.processo} onChange={e => setFilters({...filters, processo: e.target.value})} placeholder="Ex: 810/22..." />
                </div>
                <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1 px-1">Juiz Relator</label>
                    <input type="text" list="judges-list" className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-legal-600 outline-none" value={filters.relator} onChange={e => setFilters({...filters, relator: e.target.value})} placeholder="Pesquisar relator..." />
                </div>
            </div>
          </div>

          <div className="p-4 border-t bg-gray-50">
            <button onClick={handleSearch} className="w-full bg-legal-900 text-white py-3 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95">
              <Search className="w-4 h-4" /> Aplicar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Listagem de Resultados */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {results.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-300">
                    <div className="p-8 bg-white rounded-full shadow-inner mb-6 opacity-30"><Search className="w-20 h-20" /></div>
                    <p className="font-black text-sm uppercase tracking-widest">Nenhum acórdão disponível</p>
                </div>
            ) : (
                displayedResults.map(item => {
                  const noSummary = !item.sumario || item.sumario.length < 50 || item.sumario.includes('não identificado');
                  const missingMeta = item.relator === 'Desconhecido' || item.data === 'N/D';
                  const isProcessing = isProcessingSingle === item.id;

                  return (
                    <div key={item.id} className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 hover:border-legal-300 transition-all group relative animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-legal-900 text-white text-[10px] font-black px-3 py-1.5 rounded-xl tracking-wider">{item.processo}</span>
                          <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{item.data}</span>
                          {(noSummary || missingMeta) && (
                              <span className="flex items-center gap-1.5 text-[9px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full uppercase tracking-tighter">
                                  <AlertCircle className="w-3 h-3"/> {noSummary ? 'S/ Sumário' : 'S/ Dados'}
                              </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                           {isProcessing ? (
                               <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                   <Loader2 className="w-3.5 h-3.5 animate-spin"/> A processar
                               </div>
                           ) : (
                               <>
                                   {(noSummary || missingMeta) && (
                                       <div className="flex gap-1">
                                           {noSummary && <button onClick={() => processSingle(item, 'sumario')} className="px-3 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Sumário IA</button>}
                                           {missingMeta && <button onClick={() => processSingle(item, 'dados')} className="px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Dados IA</button>}
                                       </div>
                                   )}
                                   <button onClick={() => setSummaryView(item)} className="p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-legal-100 hover:text-legal-900 border border-transparent transition-all shadow-sm" title="Ver Sumário"><Eye className="w-4 h-4" /></button>
                                   <button onClick={() => openCorrection(item)} className="p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-orange-100 hover:text-orange-900 border border-transparent shadow-sm transition-all" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                   <button onClick={() => onOpenPdf(item.fileName)} className="p-2.5 bg-legal-900 text-white rounded-xl hover:bg-black shadow-lg transition-all active:scale-95" title="Abrir PDF"><FileText className="w-4 h-4" /></button>
                               </>
                           )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                            <span className="font-black text-[9px] text-gray-400 uppercase block mb-1 tracking-widest">Relator</span>
                            <span className="font-bold text-gray-800 text-sm tracking-tight">{item.relator}</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                            <span className="font-black text-[9px] text-gray-400 uppercase block mb-1 tracking-widest">Colectivo Adjunto</span>
                            <span className="text-gray-500 font-bold truncate block">{item.adjuntos.filter(a=>a!=='Nenhum').join(', ') || 'N/D'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
        </div>
      </div>

      {/* Modal de Revisão / Edição */}
      {correctionMode && correctionForm && (
        <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white w-full h-full rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-legal-900 text-white p-6 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-legal-800 rounded-2xl shadow-inner"><Edit2 className="w-6 h-6 text-legal-200"/></div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight uppercase">Revisor de Conteúdo</h2>
                        <p className="text-[10px] text-legal-300 font-bold uppercase tracking-[0.3em]">PROCESSO {correctionMode.processo}</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setCorrectionMode(null)} className="text-xs font-black uppercase tracking-widest text-legal-300 hover:text-white px-4 transition-all">DESCARTAR</button>
                    <button onClick={saveCorrection} className="bg-green-600 hover:bg-green-500 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl flex items-center gap-3 transition-all active:scale-95"><Check className="w-5 h-5"/> GUARDAR DADOS</button>
                </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
                <div className="w-[480px] bg-gray-50 p-10 border-r overflow-y-auto space-y-8 flex-shrink-0 custom-scrollbar">
                    <div className="space-y-6">
                        <div>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Data da Decisão</label>
                            <input type="text" className="w-full p-4 bg-white border border-gray-300 rounded-2xl shadow-sm text-sm font-black focus:ring-2 focus:ring-legal-600 outline-none" value={correctionForm.data} onChange={e => setCorrectionForm({...correctionForm, data: e.target.value})} />
                        </div>
                        
                        {/* Seletor de Relator com Dropdown */}
                        <div>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1 flex items-center gap-2">
                                <UserCheck className="w-3 h-3 text-legal-600"/> Juiz Relator
                            </label>
                            <div className="relative">
                                <select 
                                    className="w-full p-4 bg-white border border-gray-300 rounded-2xl shadow-sm text-sm font-black focus:ring-2 focus:ring-legal-600 outline-none appearance-none cursor-pointer pr-10"
                                    value={correctionForm.relator} 
                                    onChange={e => setCorrectionForm({...correctionForm, relator: e.target.value})}
                                >
                                    <option value="Desconhecido">Escolher Relator...</option>
                                    {availableJudges.map(judge => <option key={judge} value={judge}>{judge}</option>)}
                                    {!availableJudges.includes(correctionForm.relator) && correctionForm.relator !== 'Desconhecido' && (
                                        <option value={correctionForm.relator}>{correctionForm.relator} (Atual)</option>
                                    )}
                                </select>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
                            </div>
                        </div>

                        {/* Seletores de Adjuntos Independentes */}
                        <div className="space-y-4 pt-4 border-t border-gray-200">
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Juízes Adjuntos</p>
                             <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">1º Adjunto</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full p-3.5 bg-white border border-gray-300 rounded-xl shadow-sm text-xs font-bold focus:ring-2 focus:ring-legal-600 outline-none appearance-none cursor-pointer pr-10"
                                            value={correctionForm.adjuntos[0] || 'Nenhum'}
                                            onChange={e => handleUpdateAdjunto(0, e.target.value)}
                                        >
                                            <option value="Nenhum">Nenhum</option>
                                            {availableJudges.map(judge => <option key={judge} value={judge}>{judge}</option>)}
                                        </select>
                                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 rotate-90 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">2º Adjunto</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full p-3.5 bg-white border border-gray-300 rounded-xl shadow-sm text-xs font-bold focus:ring-2 focus:ring-legal-600 outline-none appearance-none cursor-pointer pr-10"
                                            value={correctionForm.adjuntos[1] || 'Nenhum'}
                                            onChange={e => handleUpdateAdjunto(1, e.target.value)}
                                        >
                                            <option value="Nenhum">Nenhum</option>
                                            {availableJudges.map(judge => <option key={judge} value={judge}>{judge}</option>)}
                                        </select>
                                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 rotate-90 pointer-events-none" />
                                    </div>
                                </div>
                             </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Sumário Jurisprudencial Integral</label>
                            <textarea className="w-full h-[500px] p-6 bg-white border border-gray-300 rounded-3xl shadow-sm font-serif text-lg leading-relaxed focus:ring-2 focus:ring-legal-600 outline-none custom-scrollbar" value={correctionForm.sumario} onChange={e => setCorrectionForm({...correctionForm, sumario: e.target.value})}/>
                        </div>
                    </div>
                </div>
                <div className="flex-1 bg-gray-200 relative flex flex-col min-w-0">
                    <PdfViewer data={pdfData} />
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary View Modal */}
      {summaryView && (
          <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-400">
                  <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
                      <div>
                          <h3 className="font-black text-legal-900 text-2xl tracking-tighter uppercase">Sumário Jurisprudencial</h3>
                          <div className="text-xs font-black text-legal-600 uppercase tracking-widest mt-1">{summaryView.processo} • Relator: {summaryView.relator}</div>
                      </div>
                      <button onClick={() => setSummaryView(null)} className="p-4 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-full transition-all border border-transparent hover:border-red-100"><X className="w-7 h-7"/></button>
                  </div>
                  <div className="p-12 overflow-y-auto flex-1 font-serif text-xl leading-[1.8] text-gray-800 whitespace-pre-wrap selection:bg-legal-100 custom-scrollbar">
                      {summaryView.sumario}
                  </div>
                  <div className="p-8 border-t flex justify-end gap-4 bg-gray-50/50">
                       <button onClick={() => setSummaryView(null)} className="px-10 py-4 text-xs font-black uppercase tracking-[0.2em] text-gray-500 hover:bg-gray-200 rounded-2xl transition-all">Sair</button>
                       <button onClick={() => onOpenPdf(summaryView.fileName)} className="px-10 py-4 bg-legal-900 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-black shadow-2xl transition-all flex items-center gap-3 active:scale-95">
                           <FileText className="w-5 h-5"/> Acórdão Integral
                       </button>
                  </div>
              </div>
          </div>
      )}

      <datalist id="judges-list">{availableJudges.map((j, i) => <option key={i} value={j}/>)}</datalist>
    </div>
  );
};

export default SearchModule;
