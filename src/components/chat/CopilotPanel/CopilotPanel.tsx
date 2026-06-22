import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, TextInput } from '@saybridge/ui';
import { Send, FileText, Sparkles, Loader2, Trash2, X } from 'lucide-react';
import { api } from '../../../services/api';
import { useTranslation } from 'react-i18next';
import './CopilotPanel.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface CopilotPanelProps {
  roomId: string;
  onClose: () => void;
}

export function CopilotPanel({ roomId, onClose }: CopilotPanelProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post<{ reply: string }>('/copilot/chat', {
        message: text,
        room_id: roomId,
      });
      const aiMsg: Message = { role: 'assistant', content: res.data.reply || t('copilotPanel.noResponse'), timestamp: Date.now() };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('copilotPanel.aiCallError'), timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, roomId, t]);

  const handleSummarize = useCallback(async () => {
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: t('copilotPanel.summarizeConversation'), timestamp: Date.now() }]);

    try {
      const res = await api.post<{ summary: string }>('/copilot/summarize', {
        room_id: roomId,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.summary || t('copilotPanel.nothingToSummarize'), timestamp: Date.now() },
      ]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('copilotPanel.summarizeError'), timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }, [roomId, t]);

  return (
    <div className="copilot-panel">
      {/* Header */}
      <div className="copilot-panel-header">
        <div className="copilot-panel-title">
          <Sparkles size={16} />
          <span>Copilot Assistant</span>
        </div>
        <div className="copilot-panel-actions">
          <button className="copilot-icon-btn" title={t('copilotPanel.summarizeTooltip')} onClick={handleSummarize} disabled={loading}>
            <FileText size={14} />
          </button>
          <button
            className="copilot-icon-btn"
            title={t('copilotPanel.clearHistoryTooltip')}
            onClick={() => setMessages([])}
            disabled={loading}
          >
            <Trash2 size={14} />
          </button>
          <button className="copilot-panel-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="copilot-panel-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="copilot-panel-empty">
            <div className="copilot-panel-empty-icon">
              <Sparkles size={28} />
            </div>
            <h4>{t('copilotPanel.emptyTitle')}</h4>
            <p>{t('copilotPanel.emptyDescription')}</p>
            <Button variant="secondary" size="sm" onClick={handleSummarize}>
              {t('copilotPanel.summarizeButton')}
            </Button>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`copilot-msg copilot-msg--${msg.role}`}>
            <div className="copilot-msg-bubble">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="copilot-msg copilot-msg--assistant">
            <div className="copilot-msg-bubble copilot-msg-loading">
              <Loader2 size={14} className="copilot-spinner" />
              {t('copilotPanel.thinking')}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="copilot-panel-input-bar">
        <TextInput
          placeholder={t('copilotPanel.inputPlaceholder')}
          value={input}
          onChange={(e: any) => setInput(e.target.value)}
          onKeyDown={(e: any) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={loading}
          style={{ flex: 1 }}
        />
        <button className="copilot-send-btn" onClick={handleSend} disabled={!input.trim() || loading}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
