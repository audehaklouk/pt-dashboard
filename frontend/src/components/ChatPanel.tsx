import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
}

type ModelKey = 'haiku' | 'sonnet';

const MODELS: { key: ModelKey; label: string; desc: string }[] = [
  { key: 'haiku', label: 'Haiku', desc: 'Fast' },
  { key: 'sonnet', label: 'Sonnet', desc: 'Smarter' },
];

const STARTERS = [
  'Which segment converts best?',
  'Do female-tutor requests convert better?',
  'What % went dark after a price quote?',
  "What's the after-hours response time?",
  'Compare trial vs non-trial booking rates',
  'What are the top objections?',
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
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-brand-text mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-brand-text text-[15px] mt-3 mb-1">$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-brand-text">$1</strong>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-brand-surface-2 text-brand-primary px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    // Bullet lists
    .replace(/^[-•]\s+(.*)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n/g, '<br>');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*?<\/li><br>?)+)/g, (match) => {
    const items = match.replace(/<br>/g, '');
    return `<ul class="space-y-1 my-2 ml-1">${items}</ul>`;
  });
  return html;
}

export const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<ModelKey>('haiku');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, session_id: sessionId(), model }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      const reply = data.reply || data.error || 'No response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply, model }]);
    } catch (err) {
      const message = err instanceof DOMException && err.name === 'AbortError'
        ? 'Request timed out — try a simpler question.'
        : 'Failed to reach the server. Try refreshing the page.';
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [loading, model]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    sessionStorage.removeItem('chat_session');
  };

  return (
    <div className="bg-brand-surface rounded-card shadow-card overflow-hidden flex flex-col" style={{ height: '600px' }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-brand-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-[#7C5CFC] flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6zm4 4h-2v-2h2v2zm0-4h-2V7h2v6z" opacity="0" />
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
              <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-brand-text font-display leading-tight">Ask the Data</h3>
            <p className="text-[11px] text-brand-text-muted leading-tight">AI analyst &middot; 27,881 conversations</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model switcher */}
          <div className="flex items-center bg-brand-surface-2 rounded-lg p-0.5 border border-brand-border">
            {MODELS.map(m => (
              <button
                key={m.key}
                onClick={() => setModel(m.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 ${
                  model === m.key
                    ? 'bg-brand-surface shadow-sm text-brand-text border border-brand-border'
                    : 'text-brand-text-muted hover:text-brand-text-secondary'
                }`}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Clear chat */}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-2 transition-all duration-150"
              title="New conversation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && !loading ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full px-6 py-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-primary to-[#7C5CFC] flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-brand-text font-display mb-1">What would you like to know?</h3>
            <p className="text-sm text-brand-text-muted mb-6 text-center max-w-md">
              I can query the conversation data live. Ask about conversion rates, drop-offs, segments, response times, or anything else.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {STARTERS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => send(q)}
                  className="text-left text-xs px-3.5 py-2.5 rounded-xl border border-brand-border text-brand-text-secondary hover:bg-brand-surface-2 hover:border-brand-primary/20 hover:text-brand-text transition-all duration-150"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation */
          <div className="px-5 py-4 space-y-5">
            {messages.map((m, i) => (
              <div key={i} className="flex gap-3">
                {/* Avatar */}
                <div className="shrink-0 mt-0.5">
                  {m.role === 'assistant' ? (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-[#7C5CFC] flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                        <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-brand-surface-2 border border-brand-border flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-brand-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-brand-text">
                      {m.role === 'assistant' ? 'Ask the Data' : 'You'}
                    </span>
                    {m.role === 'assistant' && m.model && (
                      <span className="text-[10px] text-brand-text-muted px-1.5 py-0.5 bg-brand-surface-2 rounded-md border border-brand-border">
                        {m.model === 'sonnet' ? 'Sonnet' : 'Haiku'}
                      </span>
                    )}
                  </div>
                  {m.role === 'assistant' ? (
                    <div
                      className="text-sm text-brand-text-secondary leading-relaxed prose-sm"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                    />
                  ) : (
                    <p className="text-sm text-brand-text-secondary leading-relaxed">{m.content}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="shrink-0 mt-0.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-[#7C5CFC] flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                      <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-brand-text mb-1.5">Ask the Data</div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-brand-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-brand-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-brand-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-brand-text-muted ml-1">Querying data...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-brand-border p-4">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end gap-2 bg-brand-surface-2 border border-brand-border rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-brand-primary/20 focus-within:border-brand-primary/40 transition-all duration-150">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about the conversations..."
              maxLength={2000}
              disabled={loading}
              rows={1}
              className="flex-1 bg-transparent text-sm text-brand-text placeholder:text-brand-text-muted outline-none resize-none disabled:opacity-50 leading-relaxed"
              style={{ maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </form>
        <p className="text-[10px] text-brand-text-muted mt-2 text-center">
          Computed live from Jan–Jun 2026 conversations. &lsquo;Booked&rsquo; is a proxy. Covers inbound only.
        </p>
      </div>
    </div>
  );
};
