import React, { useState, useEffect, useCallback } from 'react';
import { PageContainer, Button, Toggle, Badge, FormField, TextInput, Select } from '@saybridge/ui';
import { 
  Brain, Cpu, BarChart3, Save, Plus, Trash2, Edit3, 
  Loader2, RefreshCw, Key, Globe, Check, X, Play
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../services/api';
import './CopilotConfig.css';

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface AIConfig {
  provider: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  autoReply: boolean;
  moderationEnabled: boolean;
  orchestratorRules: string;
  moderationRules: string;
  providers: Record<string, ProviderConfig>;
}

interface AIAgent {
  id: string;
  name: string;
  username: string;
  avatar: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  triggerType: string;
  triggerKeyword: string;
  roomIds: string;
  enabled: boolean;
}

interface BotMetric {
  agent_id: string;
  name: string;
  username: string;
  avatar: string;
  queries: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
}

interface QueryLog {
  timestamp: string;
  agentId: string;
  agentName: string;
  query: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

const PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Anthropic Claude' },
  { value: 'ollama', label: 'Ollama (Local)' },
];

const MODELS: Record<string, { value: string; label: string }[]> = {
  gemini: [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  ],
  claude: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ],
  ollama: [
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'mistral', label: 'Mistral' },
  ],
};

export function CopilotConfig() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'agents' | 'gateway' | 'metrics'>('agents');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // AI Config
  const [config, setConfig] = useState<AIConfig>({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: t('copilotConfig.defaultSystemPrompt'),
    autoReply: false,
    moderationEnabled: true,
    orchestratorRules: '',
    moderationRules: '',
    providers: {
      openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
      claude: { apiKey: '', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
      gemini: { apiKey: '', baseUrl: '', model: 'gemini-2.5-flash' },
      ollama: { apiKey: '', baseUrl: 'http://localhost:11434', model: 'llama3.1' }
    }
  });

  // Agents
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [editingAgent, setEditingAgent] = useState<Partial<AIAgent> | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);

  // Metrics
  const [metrics, setMetrics] = useState({
    total_queries: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_cost: 0,
    bots: [] as BotMetric[],
    logs: [] as QueryLog[],
  });

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, agentsRes, metricsRes] = await Promise.all([
        api.get('/copilot/config'),
        api.get('/copilot/agents'),
        api.get('/copilot/metrics')
      ]);

      if (configRes.data) {
        const loadedConfig = { ...configRes.data };
        if (!loadedConfig.provider) {
          loadedConfig.provider = 'gemini';
        }
        if (!loadedConfig.model) {
          loadedConfig.model = 'gemini-2.5-flash';
        }
        setConfig(loadedConfig);
      }
      if (agentsRes.data) {
        setAgents(agentsRes.data);
      }
      if (metricsRes.data) {
        setMetrics(metricsRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch Copilot data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save Gateway Config
  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      if (payload.provider && payload.providers[payload.provider]) {
        payload.providers[payload.provider].apiKey = payload.apiKey || '';
        payload.providers[payload.provider].model = payload.model || '';
      }
      await api.put('/copilot/config', payload);
      alert(t('copilotConfig.saveGatewaySuccess'));
    } catch (err) {
      alert(t('copilotConfig.saveGatewayError'));
    } finally {
      setSaving(false);
    }
  };

  // Toggle Agent Enabled
  const handleToggleAgent = async (agent: AIAgent) => {
    const updated = { ...agent, enabled: !agent.enabled };
    try {
      await api.put(`/copilot/agents/${agent.id}`, updated);
      setAgents(prev => prev.map(a => a.id === agent.id ? updated : a));
    } catch (err) {
      alert(t('copilotConfig.toggleAgentError'));
    }
  };

  // Save Agent (Create / Edit)
  const handleSaveAgent = async () => {
    if (!editingAgent?.name || !editingAgent?.username || !editingAgent?.systemPrompt) {
      alert(t('copilotConfig.requiredFieldsError'));
      return;
    }

    setSaving(true);
    try {
      if (editingAgent.id) {
        // Update
        const res = await api.put(`/copilot/agents/${editingAgent.id}`, editingAgent);
        setAgents(prev => prev.map(a => a.id === editingAgent.id ? res.data : a));
      } else {
        // Create
        const res = await api.post('/copilot/agents', editingAgent);
        setAgents(prev => [...prev, res.data]);
      }
      setShowAgentModal(false);
      setEditingAgent(null);
    } catch (err: any) {
      alert(err.response?.data?.error || t('copilotConfig.saveAgentError'));
    } finally {
      setSaving(false);
    }
  };

  // Delete Agent
  const handleDeleteAgent = async (id: string) => {
    if (!window.confirm(t('copilotConfig.deleteAgentConfirm'))) return;
    try {
      await api.delete(`/copilot/agents/${id}`);
      setAgents(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert(t('copilotConfig.deleteAgentError'));
    }
  };

  return (
    <PageContainer
      title="Copilot Configuration"
      subtitle={t('copilotConfig.subtitle')}
      icon={<Brain size={18} />}
      tabs={
        <>
          <button className={activeTab === 'agents' ? 'active' : ''} onClick={() => setActiveTab('agents')}>
            <Cpu size={16} />
            <span>Multi-Agents</span>
          </button>
          <button className={activeTab === 'gateway' ? 'active' : ''} onClick={() => setActiveTab('gateway')}>
            <Globe size={16} />
            <span>AI Gateway</span>
          </button>
          <button className={activeTab === 'metrics' ? 'active' : ''} onClick={() => setActiveTab('metrics')}>
            <BarChart3 size={16} />
            <span>{t('copilotConfig.tabMonitoring')}</span>
          </button>
        </>
      }
      actions={
        <Button variant="secondary" onClick={fetchData} disabled={loading} icon={<RefreshCw size={14} className={loading ? 'spin' : ''} />}>
          {t('copilotConfig.refresh')}
        </Button>
      }
    >

      <div className="cc-content">
        {loading ? (
          <div className="cc-loading-state">
            <Loader2 size={32} className="spin" />
            <p>{t('copilotConfig.loading')}</p>
          </div>
        ) : (
          <>
            {/* ─── TAB 1: AGENTS ────────────────────────────────────────── */}
            {activeTab === 'agents' && (
              <div className="cc-tab-pane">
                <div className="cc-pane-header">
                  <h3>{t('copilotConfig.activeAgentsTitle')}</h3>
                  <Button variant="primary" icon={<Plus size={14} />} onClick={() => { setEditingAgent({ enabled: true, triggerType: 'mention' }); setShowAgentModal(true); }}>
                    {t('copilotConfig.addAgent')}
                  </Button>
                </div>

                <div className="cc-agents-grid">
                  {agents.map(agent => (
                    <div className={`cc-agent-card ${agent.enabled ? '' : 'disabled'}`} key={agent.id}>
                      <div className="cc-agent-card-header">
                        <span className="cc-agent-avatar">{agent.avatar || '🤖'}</span>
                        <div className="cc-agent-info">
                          <h4>{agent.name}</h4>
                          <span className="cc-agent-username">@{agent.username}</span>
                        </div>
                        <Toggle checked={agent.enabled} onChange={() => handleToggleAgent(agent)} />
                      </div>
                      
                      <p className="cc-agent-prompt" title={agent.systemPrompt}>{agent.systemPrompt}</p>

                      <div className="cc-agent-meta">
                        <Badge variant="info">{agent.model}</Badge>
                        <Badge variant="default">{t('copilotConfig.triggerBadge', { type: agent.triggerType })}</Badge>
                      </div>

                      <div className="cc-agent-actions">
                        <Button size="sm" variant="secondary" icon={<Edit3 size={12} />} onClick={() => { setEditingAgent(agent); setShowAgentModal(true); }}>
                          {t('copilotConfig.edit')}
                        </Button>
                        <Button size="sm" variant="ghost" className="danger-btn" icon={<Trash2 size={12} />} onClick={() => handleDeleteAgent(agent.id)}>
                          {t('copilotConfig.delete')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── TAB 2: GATEWAY ───────────────────────────────────────── */}
            {activeTab === 'gateway' && (
              <div className="cc-tab-pane cc-form-pane">
                <h3>{t('copilotConfig.gatewayConfigTitle')}</h3>

                <div className="cc-form-grid">
                  <FormField label={t('copilotConfig.defaultProvider')} required>
                    <Select
                      options={PROVIDERS}
                      value={config.provider}
                      onChange={(val: any) => {
                        const models = MODELS[val] || [];
                        setConfig(prev => ({ ...prev, provider: val, model: models[0]?.value || '' }));
                      }}
                    />
                  </FormField>

                  <FormField label={t('copilotConfig.defaultModel')} required>
                    <Select
                      options={MODELS[config.provider] || []}
                      value={config.model}
                      onChange={(val: any) => setConfig(prev => ({ ...prev, model: val }))}
                    />
                  </FormField>

                  <FormField label={t('copilotConfig.defaultApiKey')}>
                    <TextInput
                      type="password"
                      placeholder={t('copilotConfig.apiKeyPlaceholder')}
                      value={config.apiKey || ''}
                      onChange={(e: any) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    />
                  </FormField>

                  <div className="cc-form-row">
                    <FormField label={t('copilotConfig.temperature')}>
                      <div className="cc-range-slider">
                        <input
                          type="range"
                          min="0"
                          max="1.5"
                          step="0.1"
                          value={config.temperature}
                          onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                        />
                        <span>{config.temperature}</span>
                      </div>
                    </FormField>

                    <FormField label={t('copilotConfig.maxTokens')}>
                      <TextInput
                        type="number"
                        value={config.maxTokens}
                        onChange={(e: any) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 2048 }))}
                      />
                    </FormField>
                  </div>

                  <FormField label={t('copilotConfig.coreSystemPrompt')}>
                    <textarea
                      className="cc-textarea"
                      placeholder={t('copilotConfig.coreSystemPromptPlaceholder')}
                      value={config.systemPrompt}
                      onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    />
                  </FormField>

                  <div className="cc-form-row toggles-row">
                    <div className="cc-toggle-item">
                      <div className="cc-toggle-info">
                        <strong>{t('copilotConfig.autoReplyTitle')}</strong>
                        <p>{t('copilotConfig.autoReplyDesc')}</p>
                      </div>
                      <Toggle checked={config.autoReply} onChange={() => setConfig(prev => ({ ...prev, autoReply: !prev.autoReply }))} />
                    </div>

                    <div className="cc-toggle-item">
                      <div className="cc-toggle-info">
                        <strong>{t('copilotConfig.moderationTitle')}</strong>
                        <p>{t('copilotConfig.moderationDesc')}</p>
                      </div>
                      <Toggle checked={config.moderationEnabled} onChange={() => setConfig(prev => ({ ...prev, moderationEnabled: !prev.moderationEnabled }))} />
                    </div>
                  </div>

                  <FormField label={t('copilotConfig.orchestratorRules')}>
                    <textarea
                      className="cc-textarea"
                      placeholder={t('copilotConfig.orchestratorRulesPlaceholder')}
                      value={config.orchestratorRules || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, orchestratorRules: e.target.value }))}
                    />
                  </FormField>

                  <FormField label={t('copilotConfig.moderationRules')}>
                    <textarea
                      className="cc-textarea"
                      placeholder={t('copilotConfig.moderationRulesPlaceholder')}
                      value={config.moderationRules || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, moderationRules: e.target.value }))}
                    />
                  </FormField>
                </div>

                <div className="cc-form-actions">
                  <Button variant="primary" disabled={saving} onClick={handleSaveConfig} icon={saving ? <Loader2 className="spin" size={14} /> : <Save size={14} />}>
                    {t('copilotConfig.saveGateway')}
                  </Button>
                </div>
              </div>
            )}

            {/* ─── TAB 3: METRICS ───────────────────────────────────────── */}
            {activeTab === 'metrics' && (
              <div className="cc-tab-pane cc-metrics-pane">
                {/* Cards */}
                <div className="cc-metrics-grid">
                  <div className="cc-metric-card">
                    <h4>{t('copilotConfig.totalQueries')}</h4>
                    <span className="cc-metric-value">{metrics.total_queries}</span>
                  </div>
                  <div className="cc-metric-card">
                    <h4>{t('copilotConfig.inputTokens')}</h4>
                    <span className="cc-metric-value">{metrics.input_tokens.toLocaleString()}</span>
                  </div>
                  <div className="cc-metric-card">
                    <h4>{t('copilotConfig.outputTokens')}</h4>
                    <span className="cc-metric-value">{metrics.output_tokens.toLocaleString()}</span>
                  </div>
                  <div className="cc-metric-card highlight-card">
                    <h4>{t('copilotConfig.estimatedCost')}</h4>
                    <span className="cc-metric-value">${metrics.total_cost.toFixed(4)}</span>
                  </div>
                </div>

                {/* Logs Table */}
                <div className="cc-logs-section">
                  <h3>{t('copilotConfig.recentCallsTitle')}</h3>
                  <div className="cc-table-wrapper">
                    <table className="cc-table">
                      <thead>
                        <tr>
                          <th>{t('copilotConfig.colTime')}</th>
                          <th>{t('copilotConfig.colAgent')}</th>
                          <th>{t('copilotConfig.colRequest')}</th>
                          <th>{t('copilotConfig.colResponse')}</th>
                          <th>{t('copilotConfig.colTokens')}</th>
                          <th>{t('copilotConfig.colCost')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.logs?.map((log, i) => (
                          <tr key={i}>
                            <td className="time-col">{new Date(log.timestamp).toLocaleTimeString()}</td>
                            <td><Badge>{log.agentName}</Badge></td>
                            <td className="text-col" title={log.query}>{log.query}</td>
                            <td className="text-col" title={log.response}>{log.response}</td>
                            <td>{(log.inputTokens + log.outputTokens)}</td>
                            <td className="cost-col">${log.cost.toFixed(5)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Agent Creation Modal */}
      {showAgentModal && editingAgent && (
        <div className="cc-modal-backdrop">
          <div className="cc-modal">
            <div className="cc-modal-header">
              <h3>{editingAgent.id ? t('copilotConfig.modalEditTitle') : t('copilotConfig.modalCreateTitle')}</h3>
              <button className="cc-modal-close" onClick={() => { setShowAgentModal(false); setEditingAgent(null); }}>
                <X size={18} />
              </button>
            </div>
            <div className="cc-modal-body">
              <FormField label={t('copilotConfig.agentName')} required>
                <TextInput
                  placeholder={t('copilotConfig.agentNamePlaceholder')}
                  value={editingAgent.name || ''}
                  onChange={(e: any) => setEditingAgent(prev => ({ ...prev, name: e.target.value }))}
                />
              </FormField>

              <FormField label={t('copilotConfig.username')} required>
                <TextInput
                  placeholder={t('copilotConfig.usernamePlaceholder')}
                  value={editingAgent.username || ''}
                  onChange={(e: any) => setEditingAgent(prev => ({ ...prev, username: e.target.value }))}
                  disabled={!!editingAgent.id}
                />
              </FormField>

              <div className="cc-modal-row">
                <FormField label="Avatar (Emoji)">
                  <TextInput
                    placeholder="🤖"
                    value={editingAgent.avatar || ''}
                    onChange={(e: any) => setEditingAgent(prev => ({ ...prev, avatar: e.target.value }))}
                  />
                </FormField>

                <FormField label={t('copilotConfig.assignedModel')}>
                  <Select
                    options={MODELS[config.provider] || []}
                    value={editingAgent.model || config.model}
                    onChange={(val: any) => setEditingAgent(prev => ({ ...prev, model: val }))}
                  />
                </FormField>
              </div>

              <FormField label={t('copilotConfig.agentSystemPrompt')} required>
                <textarea
                  className="cc-textarea"
                  placeholder={t('copilotConfig.agentSystemPromptPlaceholder')}
                  value={editingAgent.systemPrompt || ''}
                  onChange={(e) => setEditingAgent(prev => ({ ...prev, systemPrompt: e.target.value }))}
                />
              </FormField>

              <div className="cc-modal-row">
                <FormField label={t('copilotConfig.agentTemperature')}>
                  <TextInput
                    type="number"
                    step="0.1"
                    min="0"
                    max="1.5"
                    value={editingAgent.temperature !== undefined ? editingAgent.temperature : 0.7}
                    onChange={(e: any) => setEditingAgent(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0.7 }))}
                  />
                </FormField>

                <FormField label={t('copilotConfig.triggerType')}>
                  <Select
                    options={[
                      { value: 'mention', label: t('copilotConfig.triggerMention') },
                      { value: 'silent', label: t('copilotConfig.triggerSilent') }
                    ]}
                    value={editingAgent.triggerType || 'mention'}
                    onChange={(val: any) => setEditingAgent(prev => ({ ...prev, triggerType: val }))}
                  />
                </FormField>
              </div>

              <FormField label={t('copilotConfig.triggerKeyword')}>
                <TextInput
                  placeholder={t('copilotConfig.triggerKeywordPlaceholder')}
                  value={editingAgent.triggerKeyword || ''}
                  onChange={(e: any) => setEditingAgent(prev => ({ ...prev, triggerKeyword: e.target.value }))}
                />
              </FormField>

              <FormField label={t('copilotConfig.roomIds')}>
                <TextInput
                  placeholder={t('copilotConfig.roomIdsPlaceholder')}
                  value={editingAgent.roomIds || ''}
                  onChange={(e: any) => setEditingAgent(prev => ({ ...prev, roomIds: e.target.value }))}
                />
              </FormField>
            </div>
            <div className="cc-modal-footer">
              <Button variant="secondary" onClick={() => { setShowAgentModal(false); setEditingAgent(null); }}>{t('copilotConfig.cancel')}</Button>
              <Button variant="primary" disabled={saving} onClick={handleSaveAgent} icon={saving ? <Loader2 className="spin" size={14} /> : <Check size={14} />}>{t('copilotConfig.save')}</Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
