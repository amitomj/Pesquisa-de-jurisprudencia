
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Acordao, SearchFilters, SearchResult } from '../types';
import { Search, Filter, Eye, FileText, X, Edit2, ChevronLeft, ChevronRight, Save, MousePointerClick, Wand2, Loader2, Plus, AlertCircle, Sparkles, Check } from 'lucide-react';
import { extractMetadataWithAI, suggestDescriptorsWithAI } from '../services/geminiService';

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
    const [error, setError] = useState<string | null>(null);
    const [inputPage, setInputPage] = useState('1');
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
                setInputPage('1');
                setError(null);
            } catch (err: any) {
                setError("Erro ao carregar PDF.");
            }
        };
        loadPdf();
    }, [data]);

    useEffect(() => {
        if (!pdfDoc) return;
        renderPage(pageNum);
        setInputPage(String(pageNum));
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
                    <span className="text-xs">{pageNum} / {pdfDoc?.numPages || '-'}</span>
                    <button onClick={() => setPageNum(p => Math.min(pdfDoc?.numPages || 1, p + 1))} className="p-1 hover:bg-gray-600 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
                </div>
            </div>
            <div className="flex-1 overflow-auto flex justify-center p-4">
                 <canvas ref={canvasRef} className="shadow-lg bg-white" />
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
    db, onSaveSearch, savedSearches, onDeleteSearch, onUpdateSearchName, 
    onOpenPdf, onGetPdfData, onUpdateAcordao, availableDescriptors, availableJudges, onAddDescriptors 
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    processo: '', relator: '', adjunto: '', descritor: '', dataInicio: '', dataFim: '', booleanAnd: '', booleanOr: '', booleanNot: ''
  });
  const [showBoolean, setShowBoolean] = useState(false);
  const [results, setResults] = useState<Acordao[]>([]);
  
  // States
  const [correctionMode, setCorrectionMode] = useState<Acordao | null>(null);
  const [correctionForm, setCorrectionForm] = useState<Acordao | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [viewMode, setViewMode] = useState<'pdf' | 'text'>('pdf'); 
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [summaryView, setSummaryView] = useState<Acordao | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [descriptorInput, setDescriptorInput] = useState('');
  
  // Batch processing
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null);

  useEffect(() => {
    const sorted = [...db].sort((a, b) => parseDate(b.data) - parseDate(a.data));
    setResults(sorted);
  }, [db]);

  useEffect(() => {
     if (correctionMode) {
         setPdfData(null);
         onGetPdfData(correctionMode.fileName).then(buffer => setPdfData(buffer));
     }
  }, [correctionMode]);

  const handleSearch = () => {
    const filtered = db.filter(item => {
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
    setResults(filtered);
    setCurrentPage(1);
  };

  const handleBatchAI = async (type: 'sumario' | 'missing') => {
      const targetList = type === 'sumario' 
          ? db.filter(i => !i.sumario || i.sumario.length < 50 || i.sumario.includes('Sumário não identificado'))
          : db.filter(i => i.relator === 'Desconhecido' || i.data === 'N/D');

      if (targetList.length === 0) return alert("Nenhum acórdão encontrado para processar.");
      if (!confirm(`Deseja processar ${targetList.length} acórdãos com IA? Isto pode demorar.`)) return;

      setBatchProgress({ current: 0, total: targetList.length });
      
      for (let i = 0; i < targetList.length; i++) {
          const item = targetList[i];
          try {
              const textLen = item.textoCompleto.length;
              const context = textLen < 6000 ? item.textoCompleto : item.textoCompleto.substring(0, 3000) + "\n...[CORTE]...\n" + item.textoCompleto.substring(textLen - 3000);
              const aiResult = await extractMetadataWithAI(context);
              
              const updated = { ...item };
              if (aiResult.data && aiResult.data !== 'N/D') updated.data = aiResult.data;
              if (aiResult.relator && aiResult.relator !== 'Desconhecido') updated.relator = aiResult.relator;
              if (aiResult.adjuntos) updated.adjuntos = aiResult.adjuntos;
              if (aiResult.sumario && aiResult.sumario.length > 50) updated.sumario = aiResult.sumario;
              
              onUpdateAcordao(updated);
              setBatchProgress({ current: i + 1, total: targetList.length });
          } catch (e) {
              console.error(`Error processing ${item.processo}`, e);
          }
      }
      setBatchProgress(null);
      alert("Processamento em lote concluído!");
  };

  const completeSingleWithAI = async (item: Acordao) => {
      setIsSuggesting(true);
      try {
          const textLen = item.textoCompleto.length;
          const context = textLen < 6000 ? item.textoCompleto : item.textoCompleto.substring(0, 3000) + "\n...[CORTE]...\n" + item.textoCompleto.substring(textLen - 3000);
          const aiResult = await extractMetadataWithAI(context);
          
          const updated = { ...item };
          if (aiResult.data && aiResult.data !== 'N/D') updated.data = aiResult.data;
          if (aiResult.relator && aiResult.relator !== 'Desconhecido') updated.relator = aiResult.relator;
          if (aiResult.adjuntos) updated.adjuntos = aiResult.adjuntos;
          if (aiResult.sumario && aiResult.sumario.length > 50) updated.sumario = aiResult.sumario;
          
          onUpdateAcordao(updated);
          setResults(prev => prev.map(r => r.id === item.id ? updated : r));
      } catch (e) {
          alert("Erro ao processar com IA.");
      } finally {
          setIsSuggesting(false);
      }
  };

  const openCorrection = (item: Acordao) => {
    setCorrectionMode(item);
    setCorrectionForm({...item, descritores: item.descritores || []});
  };

  const saveCorrection = () => {
    if (correctionForm) {
      onUpdateAcordao(correctionForm);
      setResults(prev => prev.map(r => r.id === correctionForm.id ? correctionForm : r));
      setCorrectionMode(null);
    }
  };

  const displayedResults = results.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="flex h-full p-0 md:p-6 gap-6 overflow-hidden">
      {/* Batch Progress Overlay */}
      {batchProgress && (
          <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
              <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
                  <Loader2 className="w-12 h-12 text-legal-600 animate-spin mx-auto mb-4"/>
                  <h3 className="text-xl font-bold mb-2">Processando Lote IA</h3>
                  <p className="text-gray-500 mb-6">A analisar acórdãos e extrair dados...</p>
                  <div className="w-full bg-gray-100 rounded-full h-4 mb-2 overflow-hidden">
                      <div className="bg-legal-600 h-full transition-all duration-300" style={{width: `${(batchProgress.current/batchProgress.total)*100}%`}}></div>
                  </div>
                  <div className="text-sm font-bold text-legal-800">{batchProgress.current} de {batchProgress.total}</div>
              </div>
          </div>
      )}

      {/* Sidebar - Fix: No scroll on main buttons */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-white border-r md:border-none md:bg-transparent overflow-hidden">
        <div className="flex flex-col h-full bg-white p-5 md:rounded-2xl md:shadow-xl border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-legal-100 rounded-lg"><Filter className="w-5 h-5 text-legal-700"/></div>
              <h3 className="font-black text-lg text-legal-800 tracking-tight">Filtros</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Processo</label><input type="text" className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-legal-100 outline-none" value={filters.processo} onChange={e => setFilters({...filters, processo: e.target.value})} /></div>
            <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Relator</label><input type="text" list="judges-list" className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-legal-100 outline-none" value={filters.relator} onChange={e => setFilters({...filters, relator: e.target.value})} /></div>
            <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Descritor</label><input type="text" list="desc-list" className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-legal-100 outline-none" value={filters.descritor} onChange={e => setFilters({...filters, descritor: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">Início</label><input type="text" className="w-full p-2 bg-gray-50 border rounded-lg text-xs" placeholder="DD-MM-AAAA" value={filters.dataInicio} onChange={e => setFilters({...filters, dataInicio: e.target.value})} /></div>
                <div><label className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">Fim</label><input type="text" className="w-full p-2 bg-gray-50 border rounded-lg text-xs" placeholder="DD-MM-AAAA" value={filters.dataFim} onChange={e => setFilters({...filters, dataFim: e.target.value})} /></div>
            </div>

            <div className="pt-4 border-t border-gray-50 space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Manutenção da Base</p>
                <button onClick={() => handleBatchAI('sumario')} className="w-full flex items-center justify-between p-2 bg-orange-50 hover:bg-orange-100 border border-orange-100 rounded-lg text-[10px] font-bold text-orange-800 transition-all">
                    <span>COMPLETAR SUMÁRIOS (LOTE)</span>
                    <Sparkles className="w-3 h-3"/>
                </button>
                <button onClick={() => handleBatchAI('missing')} className="w-full flex items-center justify-between p-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg text-[10px] font-bold text-blue-800 transition-all">
                    <span>CORRIGIR DADOS EM FALTA (LOTE)</span>
                    <Wand2 className="w-3 h-3"/>
                </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 flex-shrink-0">
            <button onClick={handleSearch} className="w-full bg-legal-600 text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg hover:bg-legal-800 transition-all flex items-center justify-center gap-2 active:scale-95">
              <Search className="w-4 h-4" /> Pesquisar Agora
            </button>
            <button onClick={() => setFilters({processo:'', relator:'', adjunto:'', descritor:'', dataInicio:'', dataFim:'', booleanAnd:'', booleanOr:'', booleanNot:''})} className="w-full text-[10px] font-bold text-gray-400 hover:text-gray-600 py-1 transition-colors uppercase">Limpar Tudo</button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 scroll-smooth">
            {displayedResults.map(item => {
              const isMissingData = item.relator === 'Desconhecido' || item.data === 'N/D' || !item.sumario || item.sumario.length < 50;
              return (
                <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-legal-200 transition-all group relative">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <span className="bg-legal-50 text-legal-800 text-xs font-black px-3 py-1 rounded-lg border border-legal-100">{item.processo}</span>
                      <span className="text-xs font-bold text-gray-400">{item.data}</span>
                      {isMissingData && (
                          <span className="flex items-center gap-1 text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded uppercase tracking-tighter animate-pulse">
                              <AlertCircle className="w-3 h-3"/> Dados em falta
                          </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                       {isMissingData && (
                           <button onClick={() => completeSingleWithAI(item)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 border border-purple-100 transition-all shadow-sm" title="Completar com IA">
                               <Sparkles className="w-4 h-4" />
                           </button>
                       )}
                       <button onClick={() => setSummaryView(item)} className="p-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-100 transition-all shadow-sm" title="Ver Sumário"><Eye className="w-4 h-4" /></button>
                       <button onClick={() => openCorrection(item)} className="p-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-100 transition-all shadow-sm" title="Corrigir"><Edit2 className="w-4 h-4" /></button>
                       <button onClick={() => onOpenPdf(item.fileName)} className="p-2 bg-legal-900 text-white rounded-lg hover:bg-black transition-all shadow-sm" title="PDF"><FileText className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                    <div className="flex items-center gap-2"><span className="font-black text-gray-400 uppercase text-[9px]">Relator:</span> <span className="font-bold text-gray-700">{item.relator}</span></div>
                    <div className="flex items-center gap-2"><span className="font-black text-gray-400 uppercase text-[9px]">Adjuntos:</span> <span className="text-gray-500 truncate">{item.adjuntos.join(', ') || 'N/D'}</span></div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl relative overflow-hidden group-hover:bg-legal-50/30 transition-colors">
                      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed italic">{item.sumario}</p>
                  </div>
                </div>
              );
            })}
            
            {results.length > ITEMS_PER_PAGE && (
                <div className="flex justify-center items-center gap-4 pt-4 pb-10">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-2 bg-white border rounded-lg disabled:opacity-30"><ChevronLeft className="w-5 h-5"/></button>
                    <span className="text-sm font-bold text-gray-500">Página {currentPage} de {Math.ceil(results.length/ITEMS_PER_PAGE)}</span>
                    <button onClick={() => setCurrentPage(p => p+1)} disabled={currentPage * ITEMS_PER_PAGE >= results.length} className="p-2 bg-white border rounded-lg disabled:opacity-30"><ChevronRight className="w-5 h-5"/></button>
                </div>
            )}
        </div>
      </div>

      {/* Summary View Modal */}
      {summaryView && (
          <div className="fixed inset-0 bg-black/70 z-[150] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                  <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                      <div>
                          <h3 className="font-black text-legal-900 text-xl tracking-tight">Sumário do Acórdão</h3>
                          <div className="text-[10px] font-black text-legal-600 uppercase tracking-widest">{summaryView.processo} • {summaryView.data}</div>
                      </div>
                      <button onClick={() => setSummaryView(null)} className="p-3 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-all"><X className="w-6 h-6"/></button>
                  </div>
                  <div className="p-10 overflow-y-auto flex-1 font-serif text-lg leading-relaxed text-gray-800 whitespace-pre-wrap selection:bg-legal-100">
                      {summaryView.sumario}
                  </div>
                  <div className="p-6 border-t flex justify-end gap-3 bg-gray-50">
                       <button onClick={() => setSummaryView(null)} className="px-8 py-3 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-2xl transition-all">Fechar</button>
                       <button onClick={() => onOpenPdf(summaryView.fileName)} className="px-8 py-3 bg-legal-700 text-white text-sm font-bold rounded-2xl hover:bg-black shadow-xl transition-all flex items-center gap-2">
                           <FileText className="w-5 h-5"/> Ver Acórdão Integral
                       </button>
                  </div>
              </div>
          </div>
      )}

      {/* Correction Modal */}
      {correctionMode && correctionForm && (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-[95%] h-[95vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-legal-900 text-white p-5 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-legal-800 rounded-xl"><Edit2 className="w-5 h-5 text-legal-200"/></div>
                    <h2 className="text-xl font-black tracking-tight">Editor de Acórdão: {correctionMode.processo}</h2>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setCorrectionMode(null)} className="text-sm font-bold text-gray-400 hover:text-white px-4 transition-colors">CANCELAR</button>
                    <button onClick={saveCorrection} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-2xl font-black text-sm tracking-widest shadow-lg flex items-center gap-3 transition-all active:scale-95"><Check className="w-5 h-5"/> GUARDAR REVISÃO</button>
                </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
                <div className="w-[400px] bg-gray-50 p-8 border-r overflow-y-auto space-y-8 flex-shrink-0">
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-1"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data do Acórdão</label><button onClick={() => navigator.clipboard.readText().then(t => setCorrectionForm({...correctionForm, data: t}))} className="text-[9px] font-black text-blue-600 uppercase">Colar</button></div>
                            <input type="text" className="w-full p-3 bg-white border border-gray-100 rounded-xl shadow-inner text-sm font-bold" value={correctionForm.data} onChange={e => setCorrectionForm({...correctionForm, data: e.target.value})} />
                        </div>
                        <div>
                            <div className="flex justify-between mb-1"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Juiz Relator</label><button onClick={() => navigator.clipboard.readText().then(t => setCorrectionForm({...correctionForm, relator: t}))} className="text-[9px] font-black text-blue-600 uppercase">Colar</button></div>
                            <input type="text" className="w-full p-3 bg-white border border-gray-100 rounded-xl shadow-inner text-sm font-bold" value={correctionForm.relator} onChange={e => setCorrectionForm({...correctionForm, relator: e.target.value})} />
                        </div>
                        <div>
                            <div className="flex justify-between mb-1"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Juízes Adjuntos</label></div>
                            <textarea className="w-full p-3 bg-white border border-gray-100 rounded-xl shadow-inner text-xs font-medium h-20" value={correctionForm.adjuntos.join(', ')} onChange={e => setCorrectionForm({...correctionForm, adjuntos: e.target.value.split(',').map(s=>s.trim())})} />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between mb-1"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sumário Jurisprudencial</label><button onClick={() => navigator.clipboard.readText().then(t => setCorrectionForm({...correctionForm, sumario: t}))} className="text-[9px] font-black text-blue-600 uppercase">Colar</button></div>
                            <textarea className="w-full h-80 p-4 bg-white border border-gray-100 rounded-xl shadow-inner font-serif text-sm leading-relaxed" value={correctionForm.sumario} onChange={e => setCorrectionForm({...correctionForm, sumario: e.target.value})}/>
                        </div>
                    </div>
                </div>
                <div className="flex-1 bg-gray-200 p-0 relative flex flex-col min-w-0">
                    <PdfViewer data={pdfData} />
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Datalists */}
      <datalist id="judges-list">{availableJudges.map((j, i) => <option key={i} value={j}/>)}</datalist>
      <datalist id="desc-list">{availableDescriptors.map((d, i) => <option key={i} value={d}/>)}</datalist>
    </div>
  );
};

export default SearchModule;
