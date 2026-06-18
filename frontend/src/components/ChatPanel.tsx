import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STARTERS = [
  'Which segment converts best?',
  'Do female-tutor requests convert better in Qatar?',
  'What % of Qatar chats reach a payment link?',
  "What's the after-hours response time?",
  'Which subjects convert best?',
  'What are the top objections in National KSA?',
];

function sessionId(): string {
  let id = sessionStorage.getItem('chat_session');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('chat_session', id);
  }
  return id;
}

function renderMarkdown(text: string): string {
  // Minimal markdown: bold, bullets, code
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-brand-surface-2 px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/^[-•]\s+(.*)$/gm, '<li class="ml-4">$1</li>')
    .replace(/\n/g, '<br>');
}

export const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, session_id: sessionId() }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || 'No response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to reach the server.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="bg-brand-surface rounded-card shadow-card overflow-hidden flex flex-col" style={{ height: '520px' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-primary-100">
          <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-brand-text font-display">Ask the Data</h3>
          <p className="text-[11px] text-brand-text-muted">AI analyst &middot; computes answers live from the conversation data</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-3">
            <p className="text-sm text-brand-text-secondary">Ask anything about the 27,881 conversations. Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => send(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-brand-border text-brand-text-secondary hover:bg-brand-primary-100 hover:text-brand-primary hover:border-brand-primary/30 transition-all duration-150"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-card px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-brand-primary text-white rounded-br-sm'
                  : 'bg-brand-surface-2 text-brand-text border border-brand-border rounded-bl-sm'
              }`}
              dangerouslySetInnerHTML={
                m.role === 'assistant' ? { __html: renderMarkdown(m.content) } : undefined
              }
            >
              {m.role === 'user' ? m.content : undefined}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-brand-surface-2 border border-brand-border rounded-card rounded-bl-sm px-4 py-2.5 text-sm text-brand-text-muted flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              Computing…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-brand-border px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about the conversations…"
            maxLength={2000}
            disabled={loading}
            className="flex-1 bg-brand-surface-2 border border-brand-border text-brand-text text-sm rounded-btn px-3.5 py-2 outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary disabled:opacity-50 transition-all duration-150"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-btn transition-all duration-150"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
        <p className="text-[10px] text-brand-text-muted mt-2 leading-relaxed">
          Answers are computed live from the conversation data (Jan–Jun 2026). &lsquo;Booked&rsquo; is a chat-language proxy; covers people who already messaged — not acquisition.
        </p>
      </div>
    </div>
  );
};
