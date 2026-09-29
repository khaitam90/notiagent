export type ModelOption = {
  id: string
  kind: 'agent' | 'chat'
  label: string
  brand: string
  provider?: string
  model?: string
  desc?: string
  tier?: string
}

export type ModelGroup = { brand: string; models: ModelOption[] }

export const MODEL_GROUPS: ModelGroup[] = [
  {
    brand: 'Nô Tì',
    models: [
      { id: 'agent', kind: 'agent', label: 'Super Agent', brand: 'Nô Tì', desc: 'n8n + Tools tự chủ' },
    ],
  },
  {
    brand: 'ChatGPT',
    models: [
      { id: 'or-gpt4o', kind: 'chat', provider: 'openrouter', model: 'openai/gpt-4o', label: 'GPT-4o', brand: 'ChatGPT', desc: 'OpenAI · đa năng' },
      { id: 'or-gpt4o-mini', kind: 'chat', provider: 'openrouter', model: 'openai/gpt-4o-mini', label: 'GPT-4o mini', brand: 'ChatGPT', desc: 'OpenAI · nhanh, rẻ' },
      { id: 'or-o1', kind: 'chat', provider: 'openrouter', model: 'openai/o1-mini', label: 'o1-mini', brand: 'ChatGPT', desc: 'OpenAI · suy luận' },
    ],
  },
  {
    brand: 'Gemini',
    models: [
      { id: 'gemini-flash', kind: 'chat', provider: 'gemini', model: 'models/gemini-2.5-flash', label: 'Gemini 2.5 Flash', brand: 'Gemini', desc: 'Google · mặc định bot' },
      { id: 'or-gemini-pro', kind: 'chat', provider: 'openrouter', model: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro', brand: 'Gemini', desc: 'Google · mạnh hơn' },
    ],
  },
  {
    brand: 'Claude',
    models: [
      { id: 'or-claude-sonnet', kind: 'chat', provider: 'openrouter', model: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', brand: 'Claude', desc: 'Anthropic · cân bằng' },
      { id: 'or-claude-haiku', kind: 'chat', provider: 'openrouter', model: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku', brand: 'Claude', desc: 'Anthropic · nhanh' },
      { id: 'or-claude-opus', kind: 'chat', provider: 'openrouter', model: 'anthropic/claude-opus-4', label: 'Claude Opus 4', brand: 'Claude', desc: 'Anthropic · mạnh nhất' },
    ],
  },
  {
    brand: 'Grok',
    models: [
      { id: 'or-grok2', kind: 'chat', provider: 'openrouter', model: 'x-ai/grok-2-1212', label: 'Grok 2', brand: 'Grok', desc: 'xAI · mới nhất' },
      { id: 'or-grok-beta', kind: 'chat', provider: 'openrouter', model: 'x-ai/grok-beta', label: 'Grok Beta', brand: 'Grok', desc: 'xAI' },
    ],
  },
  {
    brand: 'DeepSeek',
    models: [
      { id: 'novita-deepseek', kind: 'chat', provider: 'novita', model: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2', brand: 'DeepSeek', desc: 'Novita · giá rẻ' },
      { id: 'or-deepseek-r1', kind: 'chat', provider: 'openrouter', model: 'deepseek/deepseek-r1', label: 'DeepSeek R1', brand: 'DeepSeek', desc: 'OpenRouter · suy luận' },
      { id: 'or-deepseek-chat', kind: 'chat', provider: 'openrouter', model: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', brand: 'DeepSeek', desc: 'OpenRouter' },
    ],
  },
  {
    brand: 'Khác',
    models: [
      { id: 'novita-minimax', kind: 'chat', provider: 'novita', model: 'minimax/minimax-m2.7', label: 'MiniMax M2.7', brand: 'MiniMax', desc: 'Novita · nhanh' },
      { id: 'or-llama', kind: 'chat', provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', brand: 'Meta', desc: 'Open source' },
      { id: 'or-mistral', kind: 'chat', provider: 'openrouter', model: 'mistralai/mistral-large-2411', label: 'Mistral Large', brand: 'Mistral', desc: 'Mistral AI' },
    ],
  },
]

export const ALL_MODELS = MODEL_GROUPS.flatMap((g) => g.models)

export const AGENT_MODEL_ID = 'agent'
export const DEFAULT_CHAT_MODEL_ID = 'novita-deepseek'
export const CHAT_MODEL_GROUPS: ModelGroup[] = MODEL_GROUPS
  .map((group) => ({ ...group, models: group.models.filter((model) => model.kind === 'chat') }))
  .filter((group) => group.models.length > 0)

const LAST_MODEL_KEY = 'noti-chat-last-model-id'

export function findModel(id: string): ModelOption {
  return ALL_MODELS.find((m) => m.id === id) ?? ALL_MODELS[0]
}

export function findChatModel(id: string): ModelOption {
  return ALL_MODELS.find((model) => model.kind === 'chat' && model.id === id)
    ?? ALL_MODELS.find((model) => model.id === DEFAULT_CHAT_MODEL_ID)
    ?? CHAT_MODEL_GROUPS[0].models[0]
}

export function isAgentModelId(id: string): boolean {
  return id === AGENT_MODEL_ID
}

export function loadLastModelId(): string {
  try {
    const saved = localStorage.getItem(LAST_MODEL_KEY) || ''
    return ALL_MODELS.some((model) => model.kind === 'chat' && model.id === saved)
      ? saved
      : DEFAULT_CHAT_MODEL_ID
  } catch {
    return DEFAULT_CHAT_MODEL_ID
  }
}

export function saveLastModelId(id: string) {
  if (!ALL_MODELS.some((model) => model.kind === 'chat' && model.id === id)) return
  localStorage.setItem(LAST_MODEL_KEY, id)
}

export function isModelAvailable(
  m: ModelOption,
  configured?: Record<string, boolean>,
): boolean {
  if (m.kind === 'agent') return true
  const p = m.provider ?? ''
  if (p === 'novita') return configured?.novita !== false
  if (p === 'openrouter') return configured?.openrouter !== false
  if (p === 'gemini') return configured?.gemini !== false
  return true
}
