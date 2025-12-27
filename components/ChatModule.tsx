import React, { useState, useMemo } from 'react';
import { Acordao, ChatSession, ChatMessage } from '../types';
import { generateLegalAnswer } from '../services/geminiService';
import { exportChatSession } from '../services/exportService';
import { Send, Bot, Trash2, Download, Eye, FileText, X, Library, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  db: Acordao[];
  sessions: ChatSession[];
  onSaveSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  onOpenPdf: (fileName: string) => void;
}

const ChatModule: React.FC<Props> = ({ db, sessions, onSaveSession, onDeleteSession, onOpenPdf }) => {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAcordao, setSelectedAcordao] = useState<Acordao | null>(null);

  const startNewChat = () => {
    setCurrentSession({
      id: crypto.randomUUID(),
      title: 'Nova Conversa',
      messages: [],
      createdAt: Date.now()
    });
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!currentSession) startNewChat();

    const session = currentSession || {
      id: crypto.randomUUID(),
      title: input.substring(0, 30) + '...',
      messages: [],
      createdAt: Date.now()
    };

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    const updatedSession = {
      ...session,
      messages: [...session.messages, userMsg]
    };

    setCurrentSession(updatedSession);
    setInput('');
    setLoading(true);

    try {
      // Retrieval: Procura acórdãos relevantes para o contexto
      const keywords = input.toLowerCase().split(' ').filter(w => w.length > 3);
      const relevantContext = db.filter(d => {
        const text = (d.sumario + ' ' + d.textoAnalise + ' ' + (d.descritores?.join(' ') || '')).toLowerCase();
        return keywords.some(k => text.includes(k));
      }).slice(0, 30); // Analisamos até 30 para dar margem à IA escolher os 5+5 melhores

      const answer = await generateLegalAnswer(input, relevantContext);
      
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        content: answer,
        timestamp: Date.now(),
        sources: relevantContext // Mantemos aqui para referência de busca de ID
      };

      const finalSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, botMsg]
      };

      setCurrentSession(finalSession);
      onSaveSession(finalSession);
    } catch (error) {
      alert("Erro ao processar resposta: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Extrai acórdãos citados no texto usando a tag (ref: ID)
  const getCitedAcordaos = (content: string, allSources: Acordao[]): Acordao[] => {
    const refs = [...content.matchAll(/\(ref:\s*([a-f0-9-]{36})\)/g)].map(m => m[1]);
    const uniqueRefs = [...new Set(refs)];
    return allSources.filter(s => uniqueRefs.includes(s.id));
  };

  const renderMarkdown = (content: string) => (
      <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
  );

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar History */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b">
           <button onClick={startNewChat} className="w-full bg-legal-600 text-white py-2 rounded shadow hover:bg-legal-700 font-bold transition-all">
             + Nova Conversa
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <div key={s.id} 
                 onClick={() => setCurrentSession(s)}
                 className={`p-3 rounded cursor-pointer text-sm flex justify-between group transition-colors ${currentSession?.id === s.id ? 'bg-legal-100 border-legal-200 border text-legal-900 font-medium' : 'hover:bg-gray-100 text-gray-600'}`}>
               <span className="truncate pr-2">{s.title}</span>
               <button onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }} className="text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all"><Trash2 className="w-4 h-4"/></button>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-center text-xs text-gray-400 mt-10 px-4 italic">Nenhuma conversa guardada.</p>}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
          {!currentSession ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 animate-in fade-in zoom-in duration-500">
                <div className="p-6 bg-white rounded-full shadow-sm mb-4 border border-gray-100">
                    <Bot className="w-12 h-12 text-legal-200"/>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Assistente Jurídico JurisAnalítica</h3>
                <p className="max-w-xs text-center text-sm mt-2">Faça perguntas sobre a jurisprudência carregada. A IA analisará os acórdãos localmente.</p>
             </div>
          ) : (
             currentSession.messages.map(msg => {
               const cited = msg.role === 'model' ? getCitedAcordaos(msg.content, msg.sources || []) : [];
               
               return (
                 <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                   <div className={`max-w-[85%] rounded-2xl p-5 shadow-sm border ${msg.role === 'user' ? 'bg-legal-700 text-white border-legal-800' : 'bg-white border-gray-200'}`}>
                        {msg.role === 'model' && (
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                                <Bot className="w-4 h-4 text-legal-500"/>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                    {msg.sources ? `${msg.sources.length} acórdãos analisados` : 'IA JurisAnalítica'}
                                </span>
                            </div>
                        )}

                        <div className="chat-content">
                            {msg.role === 'model' ? renderMarkdown(msg.content) : <p className="whitespace-pre-wrap">{msg.content}</p>}
                        </div>

                        {cited.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <Library className="w-3.5 h-3.5 text-legal-500"/>
                                    <span className="text-xs font-bold text-gray-500">Fontes citadas nesta resposta:</span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {cited.map(src => (
                                        <div key={src.id} className="group bg-gray-50 hover:bg-white border border-gray-100 hover:border-legal-200 p-2.5 rounded-lg transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-bold text-legal-800 truncate">{src.processo}</div>
                                                <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                                    <span>{src.relator}</span>
                                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                    <span>{src.data}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0">
                                                <button 
                                                    onClick={() => setSelectedAcordao(src)} 
                                                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-md transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5"/> Sumário
                                                </button>
                                                <button 
                                                    onClick={() => onOpenPdf(src.fileName)} 
                                                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-[11px] font-bold rounded-md transition-colors"
                                                >
                                                    <FileText className="w-3.5 h-3.5"/> PDF
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                   </div>
                 </div>
               );
             })
          )}
          {loading && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-white border border-gray-200 p-4 rounded-xl flex items-center gap-3">
                <Bot className="w-5 h-5 text-legal-300 animate-spin"/>
                <span className="text-xs text-gray-400 font-medium">A analisar jurisprudência...</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-4 border-t border-gray-200 flex gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] flex-shrink-0">
          {currentSession && (
             <button onClick={() => exportChatSession(currentSession, db)} title="Exportar Conversa" className="text-gray-500 hover:text-legal-600 p-3 border rounded-xl hover:bg-gray-50 transition-colors">
                <Download className="w-5 h-5" />
             </button>
          )}
          <div className="flex-1 relative">
            <input 
                type="text" 
                className="w-full border border-gray-300 rounded-xl p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-legal-500 focus:border-transparent transition-all shadow-sm" 
                placeholder="Ex: Qual a jurisprudência sobre assédio moral no trabalho?" 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSend()} 
                disabled={loading} 
            />
            <button 
                onClick={handleSend} 
                disabled={loading || !input.trim()} 
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-legal-600 text-white p-2 rounded-lg hover:bg-legal-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
            >
                <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

       {/* Modal de Sumário */}
       {selectedAcordao && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-legal-100 rounded-lg"><Eye className="w-5 h-5 text-legal-700"/></div>
                  <div>
                    <h3 className="font-bold text-gray-900 leading-tight">Visualização de Sumário</h3>
                    <p className="text-xs text-gray-500 font-mono">{selectedAcordao.processo} • {selectedAcordao.data}</p>
                  </div>
              </div>
              <button onClick={() => setSelectedAcordao(null)} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 bg-white">
              <div className="prose prose-sm max-w-none font-serif text-gray-800 leading-relaxed whitespace-pre-wrap text-base">
                {selectedAcordao.sumario}
              </div>
            </div>
            <div className="p-4 border-t flex flex-col sm:flex-row justify-end gap-3 bg-gray-50">
               <button onClick={() => setSelectedAcordao(null)} className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">Fechar</button>
               <button onClick={() => { onOpenPdf(selectedAcordao!.fileName); setSelectedAcordao(null); }} className="px-6 py-2.5 bg-legal-600 text-white text-sm font-bold rounded-xl hover:bg-legal-700 flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
                  <FileText className="w-4 h-4"/> Abrir Documento Completo (PDF)
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatModule;