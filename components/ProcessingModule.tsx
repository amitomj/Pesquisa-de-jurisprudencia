
import React, { useState, useRef } from 'react';
import { Acordao } from '../types';
import { extractDataFromPdf } from '../services/pdfService';
import { extractMetadataWithAI, suggestDescriptorsWithAI } from '../services/geminiService';
import { FolderUp, CheckCircle, AlertCircle, RefreshCw, FilePlus, UserPlus, Tag, Bot, Users, ArrowRight, Loader2, Info } from 'lucide-react';

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
}

const ProcessingModule: React.FC<Props> = ({ 
    onDataLoaded, existingDB, onSetRootHandle, rootHandleName, onCacheFiles,
    onAddDescriptors, onAddJudges, onMergeJudges, availableJudges = [], availableDescriptors = []
}) => {
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLegacyFallback, setShowLegacyFallback] = useState(false);
  
  // Management State
  const [judgeInput, setJudgeInput] = useState('');
  const [descriptorInput, setDescriptorInput] = useState('');
  const [descriptorCategory, setDescriptorCategory] = useState<'social' | 'crime' | 'civil'>('social');

  // Merge Judges State
  const [mergeMain, setMergeMain] = useState('');
  const [mergeSecondary, setMergeSecondary] = useState('');

  // Legacy input for fallback
  const legacyInputRef = useRef<HTMLInputElement>(null);

  const getFilesRecursively = async (handle: FileSystemDirectoryHandle): Promise<File[]> => {
    const files: File[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const entry of (handle as any).values()) {
      if (entry.kind === 'file') {
        if (entry.name.toLowerCase().endsWith('.pdf')) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          files.push(await (entry as any).getFile());
        }
      } else if (entry.kind === 'directory') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        files.push(...await getFilesRecursively(entry as any));
      }
    }
    return files;
  };

  const processFileList = async (files: File[]) => {
    // Verificação de segurança da chave antes de iniciar o loop pesado
    if (!process.env.API_KEY || process.env.API_KEY === 'undefined') {
        alert("A chave de acesso não foi detetada. O processamento em lote requer uma chave configurada. Por favor, utilize o botão 'Chave Ativa' no topo.");
        setProcessing(false);
        return;
    }

    setLogs(prev => [...prev, `${files.length} ficheiros PDF encontrados. Inicia análise...`]);

    const existingFileNames = new Set(existingDB.map(a => a.fileName));
    const newFiles = files.filter(f => !existingFileNames.has(f.name));

    if (newFiles.length === 0) {
      setLogs(prev => [...prev, 'Não foram encontrados novos acórdãos para adicionar.']);
      setProcessing(false);
      return;
    }

    setLogs(prev => [...prev, `A processar ${newFiles.length} novos ficheiros...`]);
    
    const newData: Acordao[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      try {
        if (i % 5 === 0) setLogs(prev => [...prev, `Progresso (${i + 1}/${newFiles.length}): ${file.name}...`]);
        
        let data = await extractDataFromPdf(file);

        const isDataMissing = data.data === 'N/D' || data.relator === 'Desconhecido';
        const isSumarioMissing = data.sumario.includes('Sumário não identificado automaticamente');
        const hasDescriptors = data.descritores && data.descritores.length > 0;

        if (isDataMissing || isSumarioMissing) {
            setLogs(prev => [...prev, `⚠️ IA a analisar ${file.name} para recuperar dados...`]);
            try {
                const textLen = data.textoCompleto.length;
                const context = textLen < 6000 
                    ? data.textoCompleto 
                    : data.textoCompleto.substring(0, 3000) + "\n...[CORTE]...\n" + data.textoCompleto.substring(textLen - 3000);

                const aiResult = await extractMetadataWithAI(context);
                
                if (!aiResult) {
                    // Se o serviço falhar (ex: erro de chave), paramos o lote imediatamente
                    setLogs(prev => [...prev, "❌ Processamento interrompido devido a erro na API (Chave ausente ou inválida)."]);
                    break; 
                }

                if (aiResult.data && aiResult.data !== 'N/D') data.data = aiResult.data;
                if (aiResult.relator && aiResult.relator !== 'Desconhecido') data.relator = aiResult.relator;
                if (aiResult.adjuntos && aiResult.adjuntos.length > 0) data.adjuntos = aiResult.adjuntos;
                if (isSumarioMissing && aiResult.sumario && aiResult.sumario.length > 20) data.sumario = aiResult.sumario;
            } catch (aiError) {
                console.warn("AI Metadata failed", aiError);
                // Se o erro for de chave, pára o loop
                if ((aiError as Error).message?.includes("Chave") || (aiError as Error).message?.includes("API_KEY")) break;
            }
        }

        if (!hasDescriptors && availableDescriptors.length > 0 && data.sumario.length > 50) {
             try {
                 const suggested = await suggestDescriptorsWithAI(data.sumario, availableDescriptors);
                 if (suggested && suggested.length > 0) data.descritores = suggested;
             } catch (err) {
                 console.warn("Descriptor suggestion failed");
             }
        }

        newData.push(data);
      } catch (err) {
        setLogs(prev => [...prev, `ERRO em ${file.name}: ${(err as Error).message}`]);
      }
    }

    setLogs(prev => [...prev, `Concluído: ${newData.length} novos acórdãos adicionados.`]);
    onDataLoaded(newData);
    setProcessing(false);
  };

  const handleSelectFolder = async () => {
    if (!window.showDirectoryPicker) {
      setShowLegacyFallback(true);
      return;
    }
    try {
      setProcessing(true);
      const handle = await window.showDirectoryPicker();
      onSetRootHandle(handle); 
      setLogs(['A varrer pasta (Modo Nativo)...']);
      const allFiles: File[] = await getFilesRecursively(handle);
      await processFileList(allFiles);
    } catch (err: any) {
      const error = err as Error;
      if (error.name === 'SecurityError' || error.message?.includes('Cross-origin') || error.message?.includes('frame')) {
        setLogs(prev => [...prev, '⚠️ Ambiente Restrito: O browser não permite acesso direto a pastas neste modo.']);
        setShowLegacyFallback(true);
      } else {
        setLogs(prev => [...prev, `Erro: ${error.message}`]);
      }
      setProcessing(false);
    }
  };

  const handleLegacyFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setShowLegacyFallback(false);
    setProcessing(true);
    setLogs(['A carregar ficheiros (Modo Compatibilidade)...']);
    const files: File[] = (Array.from(e.target.files) as File[]).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    onCacheFiles(files);
    await processFileList(files);
    e.target.value = '';
  };

  const handleAddJudges = () => {
      const list = judgeInput.split('\n').map(x => x.trim()).filter(x => x.length > 0);
      if (list.length > 0) {
          onAddJudges(list);
          setJudgeInput('');
          alert(`${list.length} juízes adicionados.`);
      }
  };

  const handleAddDescriptors = () => {
      const list = descriptorInput.split('\n').map(x => x.trim()).filter(x => x.length > 0);
      if (list.length > 0) {
          onAddDescriptors(descriptorCategory, list);
          setDescriptorInput('');
          alert(`${list.length} descritores adicionados.`);
      }
  };

  const triggerMerge = () => {
      if (!onMergeJudges || !mergeMain || !mergeSecondary) return;
      if (confirm(`Confirmar fusão de identidades?\n\nOrigem: "${mergeSecondary}"\nDestino: "${mergeMain}"`)) {
          onMergeJudges(mergeMain.trim(), [mergeSecondary.trim()]);
          setMergeSecondary('');
      }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
      
      {processing && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex flex-col items-center justify-center backdrop-blur-sm">
           <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full text-center">
              <div className="w-16 h-16 border-4 border-legal-200 border-t-legal-600 rounded-full animate-spin"></div>
              <h3 className="text-xl font-bold text-gray-800">A Processar Biblioteca</h3>
              <p className="text-gray-500 text-sm">Analisando documentos e corrigindo dados...</p>
           </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-xl shadow-md border border-gray-100 relative overflow-hidden">
        <h2 className="text-2xl font-bold text-legal-800 mb-4 flex items-center gap-2">
          <FolderUp className="w-6 h-6" /> Gestão da Biblioteca
        </h2>
        
        {showLegacyFallback ? (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-4">
                <div className="flex gap-3 items-start">
                    <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm text-amber-800 font-bold">Modo de Compatibilidade Ativado</p>
                        <p className="text-xs text-amber-700 mt-1">O seu ambiente (ou browser) impede a seleção direta de pastas. Use o botão abaixo para selecionar múltiplos ficheiros ou a pasta de forma manual.</p>
                        <button onClick={() => legacyInputRef.current?.click()} className="mt-3 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded text-sm font-bold transition-all shadow-sm">
                            Selecionar Ficheiros PDF
                        </button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <button onClick={handleSelectFolder} disabled={processing} className="bg-legal-600 hover:bg-legal-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg active:scale-95">
                  {processing ? <RefreshCw className="animate-spin w-5 h-5"/> : <FilePlus className="w-5 h-5"/>}
                  {rootHandleName ? `Sincronizar: ${rootHandleName}` : 'Selecionar Pasta Mãe'}
                </button>
                {rootHandleName && <span className="text-sm text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4"/> Pasta vinculada</span>}
              </div>
              <p className="text-xs text-gray-400 font-medium">Nota: O sistema analisará todos os PDFs na pasta e subpastas. Requer chave de API ativa para correções automáticas.</p>
            </div>
        )}
        {/* Fix: cast webkitdirectory to any to avoid TypeScript error on standard input element */}
        <input type="file" ref={legacyInputRef} className="hidden" onChange={handleLegacyFileSelect} multiple {...({ webkitdirectory: "" } as any)} />
      </div>
      
      {logs.length > 0 && (
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-48 overflow-y-auto shadow-inner border border-gray-700 custom-scrollbar">
          <div className="sticky top-0 bg-gray-900 pb-2 border-b border-gray-800 mb-2 font-bold text-white flex justify-between">
              <span>Log de Processamento</span>
              {processing && <span className="animate-pulse text-yellow-400">EM CURSO...</span>}
          </div>
          {logs.map((log, i) => <div key={i} className="mb-1 text-xs">{log}</div>)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 col-span-1 md:col-span-2">
               <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><Users className="w-5 h-5 text-legal-600"/> Gestão de Identidades (Juízes)</h3>
               <div className="flex flex-col md:flex-row gap-4 items-end bg-gray-50 p-4 rounded-lg">
                   <div className="flex-1 w-full">
                       <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block tracking-widest">Variação a Corrigir</label>
                       <input list="judges-list" className="w-full p-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-legal-100" placeholder="Nome original no PDF..." value={mergeSecondary} onChange={e => setMergeSecondary(e.target.value)} />
                   </div>
                   <div className="flex items-center justify-center mb-2 px-2">
                       <ArrowRight className="w-5 h-5 text-gray-400" />
                   </div>
                   <div className="flex-1 w-full">
                       <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block tracking-widest">Nome Correto / Oficial</label>
                       <input list="judges-list" className="w-full p-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-legal-100" placeholder="Nome para o qual converter..." value={mergeMain} onChange={e => setMergeMain(e.target.value)} />
                   </div>
                   <button onClick={triggerMerge} disabled={!mergeMain.trim() || !mergeSecondary.trim()} className="bg-orange-600 text-white px-8 py-2.5 rounded-xl shadow-lg hover:bg-orange-700 disabled:opacity-30 font-black uppercase text-xs tracking-widest transition-all">
                       Fundir
                   </button>
               </div>
               <datalist id="judges-list">{availableJudges.map((j, i) => <option key={i} value={j}/>)}</datalist>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><UserPlus className="w-5 h-5 text-legal-600"/> Adicionar Juízes</h3>
              <textarea className="w-full h-24 p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-legal-100" placeholder="Um nome por linha..." value={judgeInput} onChange={e => setJudgeInput(e.target.value)}/>
              <div className="mt-3 flex justify-end"><button onClick={handleAddJudges} disabled={!judgeInput.trim()} className="bg-legal-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-legal-700 disabled:opacity-50 transition-all">Adicionar</button></div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><Tag className="w-5 h-5 text-legal-600"/> Adicionar Descritores</h3>
              <div className="flex gap-2 mb-2">
                  <button onClick={() => setDescriptorCategory('social')} className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter transition-all ${descriptorCategory === 'social' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>Social</button>
                  <button onClick={() => setDescriptorCategory('crime')} className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter transition-all ${descriptorCategory === 'crime' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>Crime</button>
                  <button onClick={() => setDescriptorCategory('civil')} className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter transition-all ${descriptorCategory === 'civil' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>Cível</button>
              </div>
              <textarea className="w-full h-24 p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-legal-100" placeholder="Descritores (um por linha)..." value={descriptorInput} onChange={e => setDescriptorInput(e.target.value)}/>
              <div className="mt-3 flex justify-end"><button onClick={handleAddDescriptors} disabled={!descriptorInput.trim()} className="bg-legal-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-legal-700 disabled:opacity-50 transition-all">Adicionar</button></div>
          </div>
      </div>
    </div>
  );
};

export default ProcessingModule;
