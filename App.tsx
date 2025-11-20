import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  BookOpen, 
  Minimize2, 
  Maximize2, 
  Copy, 
  Check, 
  Search, 
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Feather,
  AlertTriangle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { streamResearch } from './services/geminiService';

// --- Types ---

interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
}

interface GroundingChunk {
  web?: { uri: string; title: string };
}

// --- Main App ---

const App: React.FC = () => {
  // State
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: "Hello. I am your Deep Research Assistant. Give me a topic, and I will conduct a comprehensive analysis, searching the web for the latest data.",
      timestamp: Date.now(),
    }
  ]);
  const [isArtifactOpen, setIsArtifactOpen] = useState(true);
  const [isResearching, setIsResearching] = useState(false);
  const [artifactContent, setArtifactContent] = useState<string>("");
  const [groundingSources, setGroundingSources] = useState<GroundingChunk[]>([]);
  const [loadingStatus, setLoadingStatus] = useState<string>('');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Handlers
  const handleSend = async () => {
    if (!input.trim() || isResearching) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsResearching(true);
    setIsArtifactOpen(true);
    setLoadingStatus('Initializing research protocols...');

    const thinkingId = 'thinking-' + Date.now();

    try {
      // Prepend separator if content exists
      setArtifactContent(prev => prev ? prev + "\n\n---\n\n" : "");
      
      setMessages(prev => [...prev, {
        id: thinkingId,
        role: 'system',
        content: 'Conducting deep search and analysis...',
        timestamp: Date.now()
      }]);

      setLoadingStatus('Searching global indices...');
      const result = await streamResearch(userMsg.content, artifactContent);
      
      for await (const chunk of result) {
         let text = '';
         try {
           // Accessing .text can throw if the content is blocked by safety settings
           text = chunk.text || '';
         } catch (e) {
           console.warn("Safety filter triggered for this chunk:", e);
           continue; 
         }

         if (text) {
           setArtifactContent(prev => prev + text);
         }
         
         // Safely access grounding metadata
         const metadata = chunk.candidates?.[0]?.groundingMetadata;
         if (metadata?.groundingChunks) {
            setGroundingSources(prev => {
                // Avoid duplicates based on URI
                const newChunks = metadata.groundingChunks as GroundingChunk[];
                const existingUris = new Set(prev.map(c => c.web?.uri));
                const uniqueChunks = newChunks.filter(c => c.web?.uri && !existingUris.has(c.web.uri));
                return [...prev, ...uniqueChunks];
            });
         }
      }

      setLoadingStatus('');
      
      setMessages(prev => prev.filter(m => m.id !== thinkingId).concat({
        id: Date.now().toString(),
        role: 'ai',
        content: `I've updated the research artifact with findings on "${userMsg.content}".`,
        timestamp: Date.now()
      }));

    } catch (error) {
      console.error(error);
      setLoadingStatus('');
      setMessages(prev => prev.filter(m => m.id !== thinkingId).concat({
        id: Date.now().toString(),
        role: 'system',
        content: "An error occurred during research. Please try again.",
        timestamp: Date.now()
      }));
    } finally {
      setIsResearching(false);
      setLoadingStatus('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Copy Artifact
  const [copied, setCopied] = useState(false);
  const copyToClipboard = () => {
    navigator.clipboard.writeText(artifactContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      
      {/* LEFT PANEL: CHAT */}
      <div className={`flex flex-col h-full transition-all duration-500 ease-in-out ${isArtifactOpen ? 'w-full lg:w-[450px] xl:w-[500px]' : 'w-full max-w-3xl mx-auto'} border-r border-white/5 relative z-10`}>
        
        {/* Header */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2 text-indigo-400">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold tracking-tight text-slate-100">DeepDive</span>
          </div>
          {!isArtifactOpen && (
            <button 
              onClick={() => setIsArtifactOpen(true)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <PanelRightOpen className="w-5 h-5" />
            </button>
          )}
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth">
          {messages.map((msg) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id} 
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                msg.role === 'ai' ? 'bg-indigo-500/10 text-indigo-400' : 
                msg.role === 'user' ? 'bg-slate-800 text-slate-200' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {msg.role === 'ai' ? <Sparkles className="w-4 h-4" /> : 
                 msg.role === 'user' ? <div className="w-4 h-4 rounded-full border-2 border-current" /> :
                 <AlertTriangle className="w-4 h-4" />}
              </div>
              
              <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-slate-800 text-slate-100 rounded-tr-sm' 
                    : msg.role === 'system' 
                    ? 'bg-transparent border border-emerald-500/20 text-emerald-400/90 italic'
                    : 'bg-white/5 text-slate-300 border border-white/5 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-slate-600 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </motion.div>
          ))}
          
          {isResearching && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                 <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-500/80 py-2">
                <span>{loadingStatus || "Processing..."}</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[#0a0a0a] border-t border-white/5">
          <div className="relative max-w-2xl mx-auto w-full group">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to research today?"
              className="w-full bg-slate-900/50 text-slate-100 rounded-xl border border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 pl-4 pr-12 py-3 resize-none outline-none max-h-32 min-h-[50px] transition-all shadow-lg shadow-black/20"
              rows={1}
              disabled={isResearching}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isResearching}
              className="absolute right-2 bottom-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
            >
              {isResearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-center text-xs text-slate-600 mt-3">
            AI can make mistakes. Check sources.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL: ARTIFACT */}
      <AnimatePresence>
        {isArtifactOpen && (
          <motion.div 
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 lg:static lg:inset-auto flex-1 bg-[#0f0f10] h-full flex flex-col border-l border-white/5 z-30 shadow-2xl lg:shadow-none"
          >
            {/* Artifact Header */}
            <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f0f10] sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-indigo-500/20 text-indigo-400">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span className="font-medium text-slate-200 text-sm uppercase tracking-wider">Research Artifact</span>
              </div>
              
              <div className="flex items-center gap-1">
                 <button 
                  onClick={copyToClipboard}
                  className="p-2 hover:bg-white/5 rounded-md transition-colors text-slate-400 hover:text-white"
                  title="Copy Markdown"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsArtifactOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-md transition-colors text-slate-400 hover:text-white lg:hidden"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setIsArtifactOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-md transition-colors text-slate-400 hover:text-white hidden lg:block"
                  title="Close Panel"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Artifact Content */}
            <div className="flex-1 overflow-y-auto p-8 lg:p-10 scroll-smooth relative">
              {artifactContent ? (
                <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                   <div className="markdown-body text-slate-300 text-base leading-relaxed">
                     <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-3xl font-bold text-white mb-6 pb-2 border-b border-white/10" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-indigo-200 mt-8 mb-4 flex items-center gap-2" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-medium text-slate-100 mt-6 mb-3" {...props} />,
                        p: ({node, ...props}) => <p className="mb-4 text-slate-300/90 leading-7" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 marker:text-indigo-500" {...props} />,
                        li: ({node, ...props}) => <li className="pl-1" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 my-4 bg-indigo-500/5 italic text-indigo-200 rounded-r" {...props} />,
                        code: ({node, className, ...props}: any) => {
                           const match = /language-(\w+)/.exec(className || '')
                           return !match ? (
                             <code className="bg-white/10 text-orange-200 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                           ) : (
                             <code className={className} {...props} />
                           )
                        },
                        a: ({node, ...props}) => <a className="text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/30 underline-offset-2 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />
                      }}
                     >
                      {artifactContent}
                     </ReactMarkdown>
                   </div>

                   {groundingSources.length > 0 && (
                     <div className="mt-12 pt-6 border-t border-white/10">
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Sources & Grounding</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {groundingSources.map((source, i) => (
                            source.web?.uri && (
                              <a 
                                key={i} 
                                href={source.web.uri} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-2 p-3 rounded bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-indigo-500/30 group"
                              >
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:text-indigo-400">
                                  {i + 1}
                                </div>
                                <div className="overflow-hidden">
                                  <div className="text-sm font-medium text-slate-300 truncate group-hover:text-indigo-200">{source.web.title}</div>
                                  <div className="text-xs text-slate-500 truncate">{new URL(source.web.uri).hostname}</div>
                                </div>
                              </a>
                            )
                          ))}
                        </div>
                     </div>
                   )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                   <Feather className="w-16 h-16 mb-4 stroke-1" />
                   <p className="text-lg font-light">Research Artifact Empty</p>
                   <p className="text-sm">Ask a question to begin deep research.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
};

export default App;