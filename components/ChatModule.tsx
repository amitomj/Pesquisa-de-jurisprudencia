
import React, { useState } from 'react';
import { Acordao, ChatSession, ChatMessage } from '../types';
import { generateLegalAnswer } from '../services/geminiService';
import { exportChatSession } from '../services/exportService';
import { Send, Bot, Trash2, FileText, X, Scale, Library, Key, AlertTriangle, Download, FileJson, FileType } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  db: Acordao[];
  sessions: ChatSession[];
  onSaveSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  onOpenPdf: (fileName: string) => void;
  apiKey: string;
}

const ChatModule: React.FC<Props> = ({ db, sessions, onSaveSession, onDeleteSession, onOpenPdf, apiKey }) => {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const startNewChat = () => {
    setCurrentSession({ id: crypto.randomUUID(), title: 'Nova Conversa', messages: [], createdAt: Date.now() });
  };

  const handleExportJson = (session: ChatSession) => {
    const data = JSON.stringify({ chatSessions: [session] }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${session.title.replace(/\s+/g, '_')}_${session.id.substring(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = async () => {
    if (!apiKey) {
      alert("Configure primeiro a sua Gemini API Key no topo.");
      return;
    }
    if (!input.trim() || loading) return;
    
    let session = currentSession;
    if (!session) {
      session = { id: crypto.randomUUID(), title: input.substring(0, 40), messages: [], createdAt: Date.now() };
      setCurrentSession(session);
    }

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: input, timestamp: Date.now() };
    const updatedMessages = [...session.messages, userMsg];
    
    setCurrentSession({ ...session, messages: updatedMessages });
    setInput('');
    setLoading(true);

    try {
      const keywords = input.toLowerCase().split(' ').filter(w => w.length > 3);
      // Busca contexto focado no Direito
      const relevantContext = db.filter(d => {
        const text = (d.sumario + ' ' + (d.fundamentacaoDireito || '')).toLowerCase();
        return keywords.some(k => text.includes(k));
      }).slice(0, 35); 

      const answer = await generateLegalAnswer(input, relevantContext, apiKey);
      const botMsg: ChatMessage = { id: crypto.randomUUID(), role: 'model', content: answer, timestamp: Date.now(), sources: relevantContext };

      const finalSession = { ...session, messages: [...updatedMessages, botMsg] };
      setCurrentSession(finalSession);
      onSaveSession(finalSession);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  const formatDocLabel = (doc: Acordao) => {
    if (doc.data !== 'N/D' && doc.relator !== 'Desconhecido') {
        return `${doc.tipoDecisao === 'Decisão Sumária' ? 'decisão' : 'acórdão'} de ${doc.data}, relator ${doc.relator}`;
    }
    return doc.fileName;
  };

  const TextWithRefs: React.FC<{ content: string, sources: Acordao[] }> = ({ content, sources }) => {
    const parts = content.split(/(\[?ID_REF:\s*[a-f0-9-]{36}\]?)/gi);
    return (
      <div className="prose prose-sm max-w-none text-gray-800 font-serif leading-relaxed">
        {parts.map((part, i) => {
          const match = part.match(/ID_REF:\s*([a-f0-9-]{36})/i);
          if (match) {
            const id = match[1];
            const doc = sources.find(s => s.id === id);
            if (doc) return (
              <button key={i} onClick={() => onOpenPdf(doc.fileName)} className="mx-1 inline-flex items-center gap-1 px-2 py-0.5 bg-legal-100 text-legal-800 rounded-lg text-[10px] font-black uppercase border border-legal-200 hover:bg-legal-200 transition-all shadow-sm">
                <FileText className="w-3 h-3" /> {doc.processo}
              </button>
            );
          }
          return <ReactMarkdown key={i} components={{ p: ({children}) => <span className="inline">{children}</span> }}>{part}</ReactMarkdown>;
        })}
      </div>
    );
  };

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
      {/* Sidebar de Histórico */}
      <div className="w-72 bg-white border-r flex flex-col shadow-sm">
        <div className="p-6 border-b">
          <button onClick={startNewChat} className="w-full bg-legal-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-black transition-all">Novo Chat</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {sessions.map(s => (
            <div key={s.id} onClick={() => setCurrentSession(s)} className={`p-4 rounded-2xl cursor-pointer text-xs flex justify-between group transition-all border ${currentSession?.id === s.id ? 'bg-legal-900 text-white border-legal-950' : 'hover:bg-gray-100 text-gray-600 border-transparent'}`}>
               <span className="truncate font-black uppercase">{s.title}</span>
               <button onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }} className="opacity-0 group-hover:opacity-100 text-red-500 hover:scale-110 transition-all"><Trash2 className="w-4 h-4"/></button>
            </div>
          ))}
        </div>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentSession && (
          <div className="bg-white border-b px-10 py-4 flex items-center justify-between shadow-sm z-20">
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Sessão Ativa</span>
                <h2 className="text-xs font-black uppercase text-legal-900">{currentSession.title}</h2>
             </div>
             <div className="flex gap-2">
                <button 
                  onClick={() => exportChatSession(currentSession, db)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-[9px] font-black uppercase border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                  title="Exportar para Word (.doc)"
                >
                  <FileType className="w-3.5 h-3.5" /> Word
                </button>
                <button 
                  onClick={() => handleExportJson(currentSession)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-[9px] font-black uppercase border border-green-100 hover:bg-green-600 hover:text-white transition-all"
                  title="Guardar Backup JSON"
                >
                  <FileJson className="w-3.5 h-3.5" /> Backup JSON
                </button>
             </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
          {!currentSession ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-300 uppercase font-black tracking-widest text-xs gap-4">
               <Scale className="w-20 h-20 opacity-10"/> 
               Selecione ou inicie uma nova consulta jurídica
             </div>
          ) : (
             currentSession.messages.map(msg => {
               const citedIds = [...msg.content.matchAll(/ID_REF:\s*([a-f0-9-]{36})/gi)].map(m => m[1]);
               const citedDocs = (msg.sources || []).filter(s => [...new Set(citedIds)].includes(s.id));
               
               return (
                 <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                   <div className={`max-w-[90%] rounded-[2.5rem] p-10 shadow-2xl border ${msg.role === 'user' ? 'bg-legal-900 text-white border-legal-950' : 'bg-white border-gray-100'}`}>
                        {msg.role === 'model' && <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-50"><Bot className="w-5 h-5 text-legal-600"/><span className="text-[10px] font-black uppercase text-legal-900">Análise da Fundamentação de Direito</span></div>}
                        {msg.role === 'model' ? <TextWithRefs content={msg.content} sources={msg.sources || []} /> : <p className="font-bold text-lg leading-tight tracking-tight">{msg.content}</p>}
                        
                        {msg.role === 'model' && citedDocs.length > 0 && (
                            <div className="mt-12 pt-10 border-t border-gray-100">
                                <h4 className="text-[10px] font-black text-legal-900 uppercase tracking-[0.4em] mb-6 flex items-center gap-2 opacity-60"><Library className="w-4 h-4" /> Jurisprudência Citada</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {citedDocs.map(src => (
                                        <button key={src.id} onClick={() => onOpenPdf(src.fileName)} className="text-left bg-gray-50 border border-gray-100 p-6 rounded-[2rem] hover:bg-legal-900 hover:text-white transition-all shadow-sm flex items-start gap-4 group">
                                            <FileText className="w-5 h-5 flex-shrink-0 opacity-40 group-hover:text-white"/>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-black uppercase truncate mb-1">{src.processo}</div>
                                                <div className="text-[10px] opacity-60 font-black uppercase tracking-widest leading-tight">{formatDocLabel(src)}</div>
                                            </div>
                                        </button>
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
              <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50 flex items-center gap-4">
                <Bot className="w-8 h-8 text-legal-600 animate-bounce" />
                <span className="text-[10px] font-black uppercase tracking-widest text-legal-900">Analisando argumentos jurídicos...</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-10 bg-white border-t flex gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] items-center z-20">
            <input 
              type="text" 
              className="flex-1 border-2 border-gray-100 bg-gray-50 rounded-[2.5rem] p-6 focus:outline-none focus:ring-8 focus:ring-legal-50 focus:border-legal-200 transition-all text-lg font-bold placeholder:text-gray-300" 
              placeholder="Pergunta Jurídica (ex: Qual o entendimento sobre a nulidade do contrato?)" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSend()} 
              disabled={loading} 
            />
            <button 
              onClick={handleSend} 
              disabled={loading || !input.trim()} 
              className="bg-legal-900 text-white p-6 rounded-full shadow-2xl hover:bg-black hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
            >
              <Send className="w-6 h-6" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatModule;
