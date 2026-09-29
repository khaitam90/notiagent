import type { WorkflowDefinition, WorkflowFolder, WorkflowRun, WorkflowVersion } from './workflows'
import { getCurrentLanguage } from './i18n'

const API_BASE = import.meta.env.VITE_API_URL || '/api-proxy'

type ApiOptions = RequestInit & {
  bodyJson?: unknown
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { bodyJson, headers, ...rest } = options
  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: bodyJson === undefined ? rest.body : JSON.stringify(bodyJson),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const detail =
      typeof data?.detail === 'string'
        ? data.detail
        : typeof data === 'string'
          ? data
          : JSON.stringify(data || {})
    throw new Error(detail || `API lỗi ${response.status}`)
  }
  return data as T
}

export type WorkflowBootstrap = {
  folders: WorkflowFolder[]
  workflows: WorkflowDefinition[]
  runs: WorkflowRun[]
}

type LocalizedText = { vi: string; en: string; zh: string }

const WORKFLOW_FOLDER_I18N: Record<string, LocalizedText> = {
  templates: { vi: 'Templates', en: 'Templates', zh: '模板' },
  personal: { vi: 'Workflow của tôi', en: 'My workflows', zh: '我的工作流' },
  sandbox: { vi: 'Phòng thử nghiệm', en: 'Workflow Sandbox', zh: '工作流沙盒' },
}

const WORKFLOW_I18N: Record<string, { name?: LocalizedText; description?: LocalizedText }> = {
  'template-transform-stack': {
    name: { vi: 'Input → Array / Map / Template / Merge', en: 'Input → Array / Map / Template / Merge', zh: '输入 → 数组 / 映射 / 模板 / 合并' },
    description: {
      vi: 'Workflow automation mẫu dùng đủ các node transform để dựng payload tổng quát hơn.',
      en: 'Starter automation workflow that combines transform nodes to build reusable payloads.',
      zh: '用于组合多种转换节点并构建可复用 payload 的自动化模板。',
    },
  },
  'template-subflow-wrapper': {
    name: { vi: 'Input → Subflow → Output', en: 'Input → Subflow → Output', zh: '输入 → 子流程 → 输出' },
    description: {
      vi: 'Workflow mẫu gọi lại một workflow khác như block tái sử dụng thật.',
      en: 'Starter workflow that reuses another workflow as a real subflow block.',
      zh: '将另一个工作流作为可复用子流程块调用的模板。',
    },
  },
  'template-variable-payload-pipeline': {
    name: { vi: 'Input → Variables → JSON Payload', en: 'Input → Variables → JSON Payload', zh: '输入 → 变量 → JSON Payload' },
    description: {
      vi: 'Workflow automation tổng quát: nhận input, tạo biến trung gian rồi dựng payload JSON để dùng lại.',
      en: 'General automation workflow: receive input, derive variables, and build a reusable JSON payload.',
      zh: '通用自动化工作流：接收输入、生成中间变量并构建可复用的 JSON payload。',
    },
  },
  'template-batch-subflow-loop': {
    name: { vi: 'Input → Array → For Each → Output', en: 'Input → Array → For Each → Output', zh: '输入 → 数组 → For Each → 输出' },
    description: {
      vi: 'Workflow mẫu lặp qua nhiều item, gọi workflow con cho từng item rồi gom kết quả batch.',
      en: 'Starter batch workflow that iterates over items, calls a child workflow, and merges results.',
      zh: '遍历多个项目、调用子工作流并汇总批量结果的模板。',
    },
  },
  'template-prompt-image': {
    name: { vi: 'Prompt → Ảnh', en: 'Prompt → Image', zh: '提示词 → 图片' },
    description: {
      vi: 'Sinh ảnh AI từ prompt, phù hợp bài quảng cáo, concept art và banner.',
      en: 'Generate AI images from prompts for ads, concept art, and banners.',
      zh: '根据提示词生成适用于广告、概念图和横幅的 AI 图片。',
    },
  },
  'template-prompt-video': {
    name: { vi: 'Prompt → Video', en: 'Prompt → Video', zh: '提示词 → 视频' },
    description: {
      vi: 'Sinh video ngắn từ prompt, phục vụ short ads, reel và concept motion.',
      en: 'Generate short videos from prompts for ads, reels, and motion concepts.',
      zh: '根据提示词生成适用于广告、短视频和动态概念的短片。',
    },
  },
  'template-ref-image': {
    name: { vi: 'Ảnh tham chiếu → Ảnh nhất quán', en: 'Reference image → Consistent image', zh: '参考图 → 一致图片' },
    description: {
      vi: 'Giữ khuôn mặt nhân vật nhất quán bằng ảnh tham chiếu và prompt scene.',
      en: 'Keep character identity consistent with a reference image and scene prompt.',
      zh: '通过参考图和场景提示词保持角色形象一致。',
    },
  },
  'template-ref-video': {
    name: { vi: 'Ảnh tham chiếu → Video nhất quán', en: 'Reference image → Consistent video', zh: '参考图 → 一致视频' },
    description: {
      vi: 'Tạo video từ ảnh tham chiếu, giữ khuôn mặt nhân vật xuyên suốt các frame.',
      en: 'Create a video from a reference image while preserving the same character across frames.',
      zh: '基于参考图生成视频，并在各帧中保持角色一致。',
    },
  },
  'template-dubbing-video': {
    name: { vi: 'Video → Lipsync đa ngôn ngữ', en: 'Video → Multilingual lipsync', zh: '视频 → 多语言口型同步' },
    description: {
      vi: 'Workflow lipsync: lấy video + audio đầu vào rồi xuất video nhép miệng mới.',
      en: 'Lipsync workflow: ingest input video + replacement audio and produce a newly synced video.',
      zh: '口型同步工作流：接收输入视频和替换音频，生成新的同步视频。',
    },
  },
  'template-webhook-automation': {
    name: { vi: 'Webhook → AI → Lưu tài sản', en: 'Webhook → AI → Save asset', zh: 'Webhook → AI → 保存资产' },
    description: {
      vi: 'Workflow automation tổng quát để sau này nối n8n / Dify / webhook ngoài.',
      en: 'General automation workflow for future n8n, Dify, or external webhook integrations.',
      zh: '用于后续连接 n8n、Dify 或外部 Webhook 的通用自动化流程。',
    },
  },
  'template-media-router': {
    name: { vi: 'Router media → Ảnh / Video', en: 'Media router → Image / Video', zh: '媒体路由 → 图片 / 视频' },
    description: {
      vi: 'Một workflow mẫu có condition thật: rẽ nhánh sang node ảnh hoặc video theo media_type.',
      en: 'Starter workflow with a real condition that routes to image or video by media_type.',
      zh: '带真实条件分支的模板，可根据 media_type 路由到图片或视频节点。',
    },
  },
  'template-http-json-transform': {
    name: { vi: 'Input → HTTP JSON → Output', en: 'Input → HTTP JSON → Output', zh: '输入 → HTTP JSON → 输出' },
    description: {
      vi: 'Workflow mẫu cho webhook/API: nhận input động, gọi HTTP node, rồi xuất giá trị theo path.',
      en: 'Starter webhook/API workflow that accepts dynamic input, calls HTTP, and exposes a selected path.',
      zh: '用于 Webhook/API 的模板：接收动态输入、调用 HTTP，并输出指定路径的值。',
    },
  },
}

function localizeText(text: LocalizedText | undefined): string | undefined {
  if (!text) return undefined
  const lang = getCurrentLanguage()
  return text[lang] ?? text.vi
}

function localizeFolder(folder: WorkflowFolder): WorkflowFolder {
  const localized = WORKFLOW_FOLDER_I18N[folder.id]
  if (!localized) return folder
  return { ...folder, name: localizeText(localized) ?? folder.name }
}

function localizeWorkflow(workflow: WorkflowDefinition): WorkflowDefinition {
  const localized = WORKFLOW_I18N[workflow.id]
  if (!localized) return workflow
  return {
    ...workflow,
    name: localizeText(localized.name) ?? workflow.name,
    description: localizeText(localized.description) ?? workflow.description,
  }
}

export async function fetchWorkflowBootstrap(): Promise<WorkflowBootstrap> {
  const data = await apiRequest<WorkflowBootstrap>('/api/workflows/bootstrap')
  return {
    ...data,
    folders: data.folders.map(localizeFolder),
    workflows: data.workflows.map(localizeWorkflow),
  }
}

export async function createWorkflowFolder(name: string): Promise<WorkflowFolder> {
  return apiRequest<WorkflowFolder>('/api/workflow-folders', {
    method: 'POST',
    bodyJson: { name },
  })
}

export async function renameWorkflowFolder(folderId: string, name: string): Promise<WorkflowFolder> {
  return apiRequest<WorkflowFolder>(`/api/workflow-folders/${encodeURIComponent(folderId)}`, {
    method: 'PATCH',
    bodyJson: { name },
  })
}

export async function deleteWorkflowFolder(folderId: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/api/workflow-folders/${encodeURIComponent(folderId)}`, {
    method: 'DELETE',
  })
}

export async function createWorkflow(name: string, folderId: string): Promise<WorkflowDefinition> {
  return apiRequest<WorkflowDefinition>('/api/workflows', {
    method: 'POST',
    bodyJson: { name, folderId },
  })
}

export async function cloneWorkflow(workflowId: string, folderId: string): Promise<WorkflowDefinition> {
  return apiRequest<WorkflowDefinition>(`/api/workflows/${encodeURIComponent(workflowId)}/clone`, {
    method: 'POST',
    bodyJson: { folderId },
  })
}

export async function updateWorkflow(workflowId: string, body: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
  return apiRequest<WorkflowDefinition>(`/api/workflows/${encodeURIComponent(workflowId)}`, {
    method: 'PATCH',
    bodyJson: body,
  })
}

export type WorkflowPreflightReport = {
  ready: boolean
  publishReady: boolean
  environment: 'sandbox' | 'production'
  errors: string[]
  warnings: string[]
  checks: Array<{ id: string; label: string; status: 'passed' | 'warning' | 'failed' }>
  qualification?: {
    required: boolean
    passed: boolean
    validationGatePassed: boolean
    policyGatePassed: boolean
    modelTestPassed: boolean
    evidenceRunId?: string | null
    testedModel?: string | null
  }
}

export async function preflightWorkflow(
  workflow: WorkflowDefinition,
  forPublish = false,
): Promise<WorkflowPreflightReport> {
  return apiRequest<WorkflowPreflightReport>('/api/workflows/preflight', {
    method: 'POST',
    bodyJson: { workflow, forPublish },
  })
}

export async function fetchWorkflowVersions(workflowId: string): Promise<WorkflowVersion[]> {
  const data = await apiRequest<{ versions: WorkflowVersion[] }>(
    `/api/workflows/${encodeURIComponent(workflowId)}/versions`,
  )
  return data.versions
}

export async function restoreWorkflowVersion(workflowId: string, versionId: string): Promise<WorkflowDefinition> {
  return apiRequest<WorkflowDefinition>(`/api/workflows/${encodeURIComponent(workflowId)}/versions/restore`, {
    method: 'POST',
    bodyJson: { versionId },
  })
}

export async function deleteWorkflow(workflowId: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/api/workflows/${encodeURIComponent(workflowId)}`, {
    method: 'DELETE',
  })
}

export type WorkflowRunRequest = {
  prompt: string
  image_url?: string
  image_urls?: string[]
  video_url?: string
  audio_url?: string
  aspect_ratio?: string
  duration?: number
  tool_id?: string
  output_mode?: 'image' | 'video'
  target_node_id?: string
  variables?: Record<string, unknown>
}

export async function runWorkflow(workflowId: string, body: WorkflowRunRequest): Promise<{ run: WorkflowRun; mode: string }> {
  return apiRequest<{ run: WorkflowRun; mode: string }>(`/api/workflows/${encodeURIComponent(workflowId)}/run`, {
    method: 'POST',
    bodyJson: body,
  })
}

export async function fetchWorkflowRuns(workflowId?: string): Promise<WorkflowRun[]> {
  const suffix = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : ''
  const data = await apiRequest<{ runs: WorkflowRun[] }>(`/api/workflow-runs${suffix}`)
  return data.runs
}

export type CopilotChatTurn = { role: 'user' | 'assistant'; content: string }

export async function workflowCopilotChat(
  workflow: WorkflowDefinition,
  message: string,
  history: CopilotChatTurn[] = [],
): Promise<{ reply: string }> {
  return apiRequest<{ reply: string }>(`/api/workflows/copilot-chat`, {
    method: 'POST',
    bodyJson: { workflow, message, history },
  })
}
