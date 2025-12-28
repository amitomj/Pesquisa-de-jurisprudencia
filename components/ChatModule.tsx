
import React, { useState } from 'react';
import { Acordao, ChatSession, ChatMessage } from '../types';
import { generateLegalAnswer } from '../services/geminiService';
import { Send, Bot, Trash2, FileText, X, Scale, Library, ExternalLink, Calendar, User } from 'lucide-react';
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

  const startNewChat = () => {
    setCurrentSession({ id: crypto.randomUUID(), title: 'Nova Conversa', messages: [], createdAt: Date.now() });
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!currentSession) startNewChat();

    const session = currentSession || { id: crypto.randomUUID(), title: input.substring(0, 30), messages: [], createdAt: Date.now() };
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: input, timestamp: Date.now() };

    setCurrentSession(prev => prev ? { ...prev, messages: [...prev.messages, userMsg] } : null);
    setInput('');
    setLoading(true);

    try {
      const keywords = input.toLowerCase().split(' ').filter(w => w.length > 3);
      const relevantContext = db.filter(d => {
        const text = (d.sumario + ' ' + d.textoAnalise).toLowerCase();
        return keywords.some(k => text.includes(k));
      }).slice(0, 35); 

      const answer = await generateLegalAnswer(input, relevantContext);
      const botMsg: ChatMessage = { id: crypto.randomUUID(), role: 'model', content: answer, timestamp: Date.now(), sources: relevantContext };

      setCurrentSession(prev => {
        const next = prev ? { ...prev, messages: [...prev.messages, botMsg] } : null;
        if (next) onSaveSession(next);
        return next;
      });
    } catch (e) {} finally { setLoading(false); }
  };

  const formatDocLabel = (doc: Acordao) => {
    const isDoc = doc.tipoDecisao === 'Decisão Sumária' ? 'decisão' : 'acórdão';
    const hasData = doc.data && doc.data !== 'N/D';
    const hasRelator = doc.relator && doc.relator !== 'Desconhecido';
    
    if (hasData && hasRelator) {
        return `${isDoc} de ${doc.data}, relator ${doc.relator}`;
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
          return <ReactMarkdown key={i} components={{ p: ({children}) => <span className="inline">{children}</span>, h3: ({children}) => <h3 className="text-xl font-black text-legal-900 mt-6 mb-2 border-b border-gray-100 pb-2">{children}</h3> }}>{part}</ReactMarkdown>;
        })}
      </div>
    );
  };

  return (
    <div className="flex h-full bg-gray-50">
      <div className="w-72 bg-white border-r flex flex-col">
        <div className="p-6 border-b"><button onClick={startNewChat} className="w-full bg-legal-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg">Novo Chat</button></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {sessions.map(s => (
            <div key={s.id} onClick={() => setCurrentSession(s)} className={`p-4 rounded-2xl cursor-pointer text-xs flex justify-between group transition-all border ${currentSession?.id === s.id ? 'bg-legal-900 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
               <span className="truncate font-black uppercase">{s.title}</span>
               <button onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }} className="opacity-0 group-hover:opacity-100 text-red-500"><Trash2 className="w-4 h-4"/></button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
          {!currentSession ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-300 uppercase font-black tracking-widest text-xs gap-4"><Scale className="w-20 h-20 opacity-20"/> Selecione ou inicie uma análise</div>
          ) : (
             currentSession.messages.map(msg => {
               const citedIds = [...msg.content.matchAll(/ID_REF:\s*([a-f0-9-]{36})/gi)].map(m => m[1]);
               const citedDocs = (msg.sources || []).filter(s => [...new Set(citedIds)].includes(s.id));
               
               return (
                 <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                   <div className={`max-w-[90%] rounded-[2.5rem] p-10 shadow-2xl border ${msg.role === 'user' ? 'bg-legal-900 text-white' : 'bg-white'}`}>
                        {msg.role === 'model' && <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-50"><Bot className="w-5 h-5 text-legal-600"/><span className="text-[10px] font-black uppercase text-legal-900">Relatório Jurisprudencial</span></div>}
                        {msg.role === 'model' ? <TextWithRefs content={msg.content} sources={msg.sources || []} /> : <p className="font-bold text-lg">{msg.content}</p>}
                        
                        {msg.role === 'model' && citedDocs.length > 0 && (
                            <div className="mt-12 pt-10 border-t border-gray-100">
                                <h4 className="text-[10px] font-black text-legal-900 uppercase tracking-[0.4em] mb-6 flex items-center gap-2 opacity-60"><Library className="w-4 h-4" /> Fontes Analisadas</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {citedDocs.map(src => (
                                        <button key={src.id} onClick={() => onOpenPdf(src.fileName)} className="text-left bg-gray-50 border p-6 rounded-[2rem] hover:bg-legal-900 hover:text-white transition-all shadow-sm flex items-start gap-4">
                                            <FileText className="w-5 h-5 flex-shrink-0 opacity-40"/>
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
          {loading && <div className="flex justify-start animate-pulse"><div className="bg-white p-8 rounded-[3rem] shadow-xl flex items-center gap-4"><Bot className="w-8 h-8 text-legal-600 animate-bounce" /><span className="text-xs font-black uppercase tracking-widest text-legal-900">Cruzando fundamentos...</span></div></div>}
        </div>

        <div className="p-10 bg-white border-t flex gap-4 shadow-2xl items-center">
            <input type="text" className="flex-1 border-2 border-gray-100 bg-gray-50 rounded-[2.5rem] p-6 focus:outline-none focus:ring-8 focus:ring-legal-50 focus:border-legal-200 transition-all text-lg font-bold" placeholder="Questão (ex: Há decisões contraditórias sobre nexo de causalidade?)" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} disabled={loading} />
            <button onClick={handleSend} disabled={loading || !input.trim()} className="bg-legal-900 text-white p-6 rounded-full shadow-2xl hover:bg-black transition-all disabled:opacity-30"><Send className="w-6 h-6" /></button>
        </div>
      </div>
    </div>
  );
};

export default ChatModule;
