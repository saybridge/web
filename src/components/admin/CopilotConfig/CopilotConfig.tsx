import React, { useState, useEffect, useCallback } from 'react';
import { PageContainer, Button, Toggle, Badge, FormField, TextInput, Select } from '@saybridge/ui';
import { 
  Brain, Cpu, BarChart3, Save, Plus, Trash2, Edit3, 
  Loader2, RefreshCw, Key, Globe, Check, X, Play
} from 'lucide-react';
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
    systemPrompt: 'Bạn là AI trợ lý thân thiện, luôn trả lời bằng tiếng Việt.',
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
      alert('Đã lưu cấu hình AI Gateway thành công!');
    } catch (err) {
      alert('Lỗi khi lưu cấu hình AI Gateway.');
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
      alert('Lỗi khi cập nhật trạng thái Agent.');
    }
  };

  // Save Agent (Create / Edit)
  const handleSaveAgent = async () => {
    if (!editingAgent?.name || !editingAgent?.username || !editingAgent?.systemPrompt) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc.');
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
      alert(err.response?.data?.error || 'Lỗi khi lưu thông tin Agent.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Agent
  const handleDeleteAgent = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa Agent này không?')) return;
    try {
      await api.delete(`/copilot/agents/${id}`);
      setAgents(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert('Lỗi khi xóa Agent.');
    }
  };

  return (
    <PageContainer
      title="Copilot Configuration"
      subtitle="Quản trị các tính năng hỗ trợ AI, dịch thuật và Multi-Agent"
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
            <span>Giám sát & Log</span>
          </button>
        </>
      }
      actions={
        <Button variant="secondary" onClick={fetchData} disabled={loading} icon={<RefreshCw size={14} className={loading ? 'spin' : ''} />}>
          Làm mới
        </Button>
      }
    >

      <div className="cc-content">
        {loading ? (
          <div className="cc-loading-state">
            <Loader2 size={32} className="spin" />
            <p>Đang tải dữ liệu Copilot...</p>
          </div>
        ) : (
          <>
            {/* ─── TAB 1: AGENTS ────────────────────────────────────────── */}
            {activeTab === 'agents' && (
              <div className="cc-tab-pane">
                <div className="cc-pane-header">
                  <h3>Danh sách AIAgent hoạt động</h3>
                  <Button variant="primary" icon={<Plus size={14} />} onClick={() => { setEditingAgent({ enabled: true, triggerType: 'mention' }); setShowAgentModal(true); }}>
                    Thêm Agent mới
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
                        <Badge variant="default">Trigger: {agent.triggerType}</Badge>
                      </div>

                      <div className="cc-agent-actions">
                        <Button size="sm" variant="secondary" icon={<Edit3 size={12} />} onClick={() => { setEditingAgent(agent); setShowAgentModal(true); }}>
                          Sửa
                        </Button>
                        <Button size="sm" variant="ghost" className="danger-btn" icon={<Trash2 size={12} />} onClick={() => handleDeleteAgent(agent.id)}>
                          Xoá
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
                <h3>Cấu hình AI Gateway Cốt lõi</h3>
                
                <div className="cc-form-grid">
                  <FormField label="Nhà cung cấp AI mặc định" required>
                    <Select
                      options={PROVIDERS}
                      value={config.provider}
                      onChange={(val: any) => {
                        const models = MODELS[val] || [];
                        setConfig(prev => ({ ...prev, provider: val, model: models[0]?.value || '' }));
                      }}
                    />
                  </FormField>

                  <FormField label="Model mặc định" required>
                    <Select
                      options={MODELS[config.provider] || []}
                      value={config.model}
                      onChange={(val: any) => setConfig(prev => ({ ...prev, model: val }))}
                    />
                  </FormField>

                  <FormField label="API Key mặc định">
                    <TextInput
                      type="password"
                      placeholder="Nhập API Key cung cấp..."
                      value={config.apiKey || ''}
                      onChange={(e: any) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    />
                  </FormField>

                  <div className="cc-form-row">
                    <FormField label="Nhiệt độ (Temperature)">
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

                    <FormField label="Số lượng Token phản hồi tối đa (Max Tokens)">
                      <TextInput
                        type="number"
                        value={config.maxTokens}
                        onChange={(e: any) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 2048 }))}
                      />
                    </FormField>
                  </div>

                  <FormField label="System Prompt Cốt lõi">
                    <textarea
                      className="cc-textarea"
                      placeholder="Mô tả hành vi mặc định của Copilot..."
                      value={config.systemPrompt}
                      onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    />
                  </FormField>

                  <div className="cc-form-row toggles-row">
                    <div className="cc-toggle-item">
                      <div className="cc-toggle-info">
                        <strong>Tự động phản hồi (Auto-Reply)</strong>
                        <p>Tự động trả lời khi được nhắc đến (@) trong phòng chat.</p>
                      </div>
                      <Toggle checked={config.autoReply} onChange={() => setConfig(prev => ({ ...prev, autoReply: !prev.autoReply }))} />
                    </div>

                    <div className="cc-toggle-item">
                      <div className="cc-toggle-info">
                        <strong>Kiểm duyệt nội dung AI (Moderation)</strong>
                        <p>Kiểm duyệt tin nhắn độc hại trước khi gửi đi.</p>
                      </div>
                      <Toggle checked={config.moderationEnabled} onChange={() => setConfig(prev => ({ ...prev, moderationEnabled: !prev.moderationEnabled }))} />
                    </div>
                  </div>

                  <FormField label="Quy tắc điều phối Multi-Agent (Orchestrator Rules)">
                    <textarea
                      className="cc-textarea"
                      placeholder="Hướng dẫn phân tích câu hỏi để giao việc cho các Agent khác nhau..."
                      value={config.orchestratorRules || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, orchestratorRules: e.target.value }))}
                    />
                  </FormField>

                  <FormField label="Quy tắc kiểm duyệt nội dung (Moderation Rules)">
                    <textarea
                      className="cc-textarea"
                      placeholder="Chính sách lọc nội dung hoặc danh sách từ cấm..."
                      value={config.moderationRules || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, moderationRules: e.target.value }))}
                    />
                  </FormField>
                </div>

                <div className="cc-form-actions">
                  <Button variant="primary" disabled={saving} onClick={handleSaveConfig} icon={saving ? <Loader2 className="spin" size={14} /> : <Save size={14} />}>
                    Lưu cấu hình Gateway
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
                    <h4>Tổng số truy vấn</h4>
                    <span className="cc-metric-value">{metrics.total_queries}</span>
                  </div>
                  <div className="cc-metric-card">
                    <h4>Tokens Đầu vào</h4>
                    <span className="cc-metric-value">{metrics.input_tokens.toLocaleString()}</span>
                  </div>
                  <div className="cc-metric-card">
                    <h4>Tokens Đầu ra</h4>
                    <span className="cc-metric-value">{metrics.output_tokens.toLocaleString()}</span>
                  </div>
                  <div className="cc-metric-card highlight-card">
                    <h4>Ước tính Chi phí</h4>
                    <span className="cc-metric-value">${metrics.total_cost.toFixed(4)}</span>
                  </div>
                </div>

                {/* Logs Table */}
                <div className="cc-logs-section">
                  <h3>Lịch sử cuộc gọi AI gần đây</h3>
                  <div className="cc-table-wrapper">
                    <table className="cc-table">
                      <thead>
                        <tr>
                          <th>Thời gian</th>
                          <th>Agent</th>
                          <th>Yêu cầu</th>
                          <th>Phản hồi</th>
                          <th>Tokens</th>
                          <th>Chi phí</th>
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
              <h3>{editingAgent.id ? 'Cập nhật Agent' : 'Tạo mới Agent'}</h3>
              <button className="cc-modal-close" onClick={() => { setShowAgentModal(false); setEditingAgent(null); }}>
                <X size={18} />
              </button>
            </div>
            <div className="cc-modal-body">
              <FormField label="Tên Agent" required>
                <TextInput
                  placeholder="Ví dụ: Coder Bot"
                  value={editingAgent.name || ''}
                  onChange={(e: any) => setEditingAgent(prev => ({ ...prev, name: e.target.value }))}
                />
              </FormField>

              <FormField label="Username (Unique ID)" required>
                <TextInput
                  placeholder="ví dụ: coder"
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

                <FormField label="Model chỉ định">
                  <Select
                    options={MODELS[config.provider] || []}
                    value={editingAgent.model || config.model}
                    onChange={(val: any) => setEditingAgent(prev => ({ ...prev, model: val }))}
                  />
                </FormField>
              </div>

              <FormField label="System Prompt riêng cho Agent" required>
                <textarea
                  className="cc-textarea"
                  placeholder="Hướng dẫn hành vi, nhiệm vụ cụ thể cho Agent này..."
                  value={editingAgent.systemPrompt || ''}
                  onChange={(e) => setEditingAgent(prev => ({ ...prev, systemPrompt: e.target.value }))}
                />
              </FormField>

              <div className="cc-modal-row">
                <FormField label="Trọng số phản hồi (Temperature)">
                  <TextInput
                    type="number"
                    step="0.1"
                    min="0"
                    max="1.5"
                    value={editingAgent.temperature !== undefined ? editingAgent.temperature : 0.7}
                    onChange={(e: any) => setEditingAgent(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0.7 }))}
                  />
                </FormField>

                <FormField label="Kịch bản kích hoạt (Trigger Type)">
                  <Select
                    options={[
                      { value: 'mention', label: 'Khi được tag (@username)' },
                      { value: 'silent', label: 'Lắng nghe thụ động (Silent)' }
                    ]}
                    value={editingAgent.triggerType || 'mention'}
                    onChange={(val: any) => setEditingAgent(prev => ({ ...prev, triggerType: val }))}
                  />
                </FormField>
              </div>

              <FormField label="Keyword kích hoạt (Trigger Keyword)">
                <TextInput
                  placeholder="Ví dụ: @sai_coder"
                  value={editingAgent.triggerKeyword || ''}
                  onChange={(e: any) => setEditingAgent(prev => ({ ...prev, triggerKeyword: e.target.value }))}
                />
              </FormField>

              <FormField label="Các Room ID giới hạn (Phân cách bằng dấu phẩy)">
                <TextInput
                  placeholder="Để trống nếu hoạt động toàn bộ room..."
                  value={editingAgent.roomIds || ''}
                  onChange={(e: any) => setEditingAgent(prev => ({ ...prev, roomIds: e.target.value }))}
                />
              </FormField>
            </div>
            <div className="cc-modal-footer">
              <Button variant="secondary" onClick={() => { setShowAgentModal(false); setEditingAgent(null); }}>Hủy</Button>
              <Button variant="primary" disabled={saving} onClick={handleSaveAgent} icon={saving ? <Loader2 className="spin" size={14} /> : <Check size={14} />}>Lưu lại</Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
