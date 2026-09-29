import { generateId } from './uuid'
export type WorkflowMedia = 'image' | 'video' | 'hybrid' | 'automation'

export type WorkflowCategory = 'template' | 'custom'

export type WorkflowNodeType =
  | 'input'
  | 'prompt'
  | 'set'
  | 'json'
  | 'template'
  | 'array'
  | 'map'
  | 'merge'
  | 'for_each'
  | 'image'
  | 'video'
  | 'tts'
  | 'lipsync'
  | 'http'
  | 'browser'
  | 'condition'
  | 'subflow'
  | 'output'

export type WorkflowEdgeBranch = 'always' | 'true' | 'false'

export type WorkflowFolder = {
  id: string
  name: string
  system?: boolean
  environment?: 'sandbox' | 'production'
  policy?: WorkflowSandboxPolicy
  updatedAt: string
}

export type WorkflowSandboxPolicy = {
  publishAllowed: boolean
  scheduledAutomationAllowed: boolean
  maxConcurrentRuns: number
  maxDurationSeconds: number
  maxResolution: string
  retentionHours: number
}

export type WorkflowNode = {
  id: string
  type: WorkflowNodeType
  label: string
  description: string
  x: number
  y: number
  config: Record<string, string>
  // 2026-07-26L: node bi khoa thi khong keo/di chuyen duoc tren canvas nua (van xem/chon binh
  // thuong) - toggle qua nut "Khoa" trong WorkflowHubCanvasToolbar khi dang chon 1 node.
  locked?: boolean
}

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  branch?: WorkflowEdgeBranch
}

// 2026-08-02: "Khung" (Frame) - gom nhieu node lai de di chuyen cung nhau va luu rieng thanh
// preset (tham khao Comfy Cloud). Thanh vien cua khung tinh theo VI TRI hinh hoc (node.x/y nam
// trong bien khung) - khong luu danh sach id rieng, tu dong cap nhat khi keo node ra/vao.
export type WorkflowFrame = {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
}

// 2026-08-02: "Ghi chu" (Note) - ghi chu tu do tren canvas, khong gan cung node nao, dat o bat ky
// vi tri nao (tham khao Comfy Cloud).
export type WorkflowNote = {
  id: string
  x: number
  y: number
  text: string
}

export type WorkflowDefinition = {
  id: string
  name: string
  description: string
  folderId: string
  environment?: 'sandbox' | 'production'
  sandboxPolicy?: Partial<WorkflowSandboxPolicy>
  systemSample?: boolean
  media: WorkflowMedia
  category: WorkflowCategory
  updatedAt: string
  published: boolean
  component?: boolean
  componentName?: string
  componentInputSchemaJson?: string
  componentOutputSchemaJson?: string
  tags?: string[]
  metadataJson?: string
  sourceTemplateId?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  frames?: WorkflowFrame[]
  notes?: WorkflowNote[]
}

export type WorkflowVersion = {
  id: string
  workflowId: string
  workflowName: string
  component?: boolean
  componentName?: string
  createdAt: string
  note?: string
  snapshot?: WorkflowDefinition
}

export type WorkflowRunStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type WorkflowRun = {
  id: string
  workflowId: string
  workflowName: string
  media: WorkflowMedia
  status: WorkflowRunStatus
  message: string
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  assetUrls: string[]
  error?: string | null
  createdAt: string
  updatedAt: string
  finishedAt?: string | null
}

export const DEFAULT_WORKFLOW_FOLDER_ID = 'personal'
export const TEMPLATE_WORKFLOW_FOLDER_ID = 'templates'
export const SANDBOX_WORKFLOW_FOLDER_ID = 'sandbox'

export type WorkflowValidationIssue = {
  level: 'error' | 'warning'
  code: string
  message: string
}

export type WorkflowValidationResult = {
  errors: WorkflowValidationIssue[]
  warnings: WorkflowValidationIssue[]
}

export type WorkflowBlockTemplate = {
  id: string
  name: string
  description: string
  group?: 'Media' | 'Automation' | 'Logic' | 'Integration' | 'Reusable'
  difficulty?: 'Starter' | 'Intermediate' | 'Advanced' | 'Cơ bản' | 'Trung cấp' | 'Nâng cao'
  keywords?: string[]
  nodes: Array<{
    key: string
    type: WorkflowNodeType
    label: string
    description: string
    dx: number
    dy: number
    config?: Record<string, string>
  }>
  edges: Array<{
    source: string
    target: string
    branch?: WorkflowEdgeBranch
  }>
}

function normalizeEdgeBranch(branch?: string): WorkflowEdgeBranch | '' {
  const value = String(branch || '').trim().toLowerCase()
  if (value === 'always' || value === 'true' || value === 'false') return value
  return ''
}

export function buildWorkflowEdgeId(source: string, target: string, branch?: WorkflowEdgeBranch | '') {
  const normalizedBranch = normalizeEdgeBranch(branch)
  return `${source}-${target}${normalizedBranch ? `-${normalizedBranch}` : ''}`
}

export const WORKFLOW_NODE_LIBRARY: {
  type: WorkflowNodeType
  label: string
  description: string
  defaultConfig?: Record<string, string>
}[] = [
  { type: 'input', label: 'Đầu vào', description: 'Nhận tham số đầu vào từ người dùng hoặc form chạy workflow.', defaultConfig: { fields: 'prompt, reference_image' } },
  { type: 'prompt', label: 'Dựng prompt', description: 'Ghép prompt hệ thống, prompt người dùng và phong cách.', defaultConfig: { style: 'identity_lock', mode: 'append', template: '{{prompt}}' } },
  { type: 'set', label: 'Tạo biến', description: 'Tạo hoặc cập nhật nhiều biến trung gian.', defaultConfig: { assign_json: '{"slug":"{{topic}}","request_name":"{{topic}}-{{media_type}}"}' } },
  { type: 'json', label: 'Dựng JSON', description: 'Tạo payload JSON có cấu trúc.', defaultConfig: { output_key: 'payload', template_json: '{"prompt":"{{prompt}}","topic":"{{topic}}","media_type":"{{media_type}}"}' } },
  { type: 'template', label: 'Mẫu văn bản', description: 'Render text từ context hiện tại.', defaultConfig: { output_key: 'summary_text', template: '{{topic}} cho {{channel}}' } },
  { type: 'array', label: 'Tạo mảng', description: 'Tạo mảng dữ liệu để dùng cho batch hoặc payload.', defaultConfig: { output_key: 'items', items_json: '["{{topic}}","{{channel}}","{{media_type}}"]' } },
  { type: 'map', label: 'Ánh xạ trường', description: 'Ánh xạ nhiều trường thành object mới.', defaultConfig: { output_key: 'metadata', mapping_json: '{"topic":"{{topic}}","channel":"{{channel}}","request_name":"{{channel}}-{{topic}}"}' } },
  { type: 'merge', label: 'Gộp dữ liệu', description: 'Gộp nhiều object hoặc scalar vào một payload.', defaultConfig: { output_key: 'merged_payload', source_paths_json: '["metadata","payload"]' } },
  {
    type: 'for_each',
    label: 'Lặp từng item',
    description: 'Lặp qua một mảng item và gọi workflow con cho từng item.',
    defaultConfig: {
      items_path: 'items',
      workflow_id: 'template-variable-payload-pipeline',
      item_key: 'item',
      item_index_key: 'item_index',
      output_key: 'loop_results',
      inputs_json: '{"prompt":"{{prompt}}","variables":{"topic":"{{item.topic}}","channel":"{{item.channel}}","media_type":"{{item.media_type}}"}}',
    },
  },
  { type: 'image', label: 'Tạo ảnh', description: 'Sinh ảnh AI hoặc chỉnh ảnh từ prompt.', defaultConfig: { provider: 'novita', model: 'seedream-4.5' } },
  { type: 'video', label: 'Tạo video', description: 'Sinh video AI từ prompt hoặc ảnh tham chiếu.', defaultConfig: { provider: 'replicate', model: 'bytedance/seedance-2.0-fast' } },
  { type: 'tts', label: 'Tạo giọng nói', description: 'Tạo voice-over bằng TTS.', defaultConfig: { provider: 'elevenlabs', voice: 'default' } },
  { type: 'lipsync', label: 'Khớp khẩu hình', description: 'Ghép audio vào khuôn mặt nhân vật.', defaultConfig: { provider: 'heygen/lipsync-speed', mode: 'translate_or_lipsync' } },
  { type: 'http', label: 'Gọi HTTP', description: 'Gọi API ngoài hoặc webhook nội bộ.', defaultConfig: { method: 'POST', url: 'https://example.com/webhook', body_json: '{"prompt":"{{prompt}}","media_type":"{{media_type}}"}', headers_json: '{}', timeout_sec: '60' } },
  { type: 'browser', label: 'Trình duyệt', description: 'Điều khiển Chrome thật: mở trang, click, điền form, chụp ảnh màn hình (agent-browser).', defaultConfig: { url: 'https://example.com', actions_json: '[]', output_key: 'browser_result', timeout_seconds: '90' } },
  { type: 'condition', label: 'Điều kiện', description: 'Rẽ nhánh theo input hoặc kết quả node trước.', defaultConfig: { rule: 'media_type == "video"' } },
  {
    type: 'subflow',
    label: 'Workflow con',
    description: 'Gọi một workflow khác như block tái sử dụng.',
    defaultConfig: {
      workflow_id: 'template-variable-payload-pipeline',
      output_key: 'subflow_result',
      inputs_json: '{"prompt":"{{prompt}}","variables":{"topic":"{{topic}}","channel":"{{channel}}","media_type":"{{media_type}}"}}',
      expose_json: '{"payload":"state.payload"}',
    },
  },
  { type: 'output', label: 'Đầu ra', description: 'Trả ảnh, video hoặc dữ liệu cuối cùng cho ứng dụng.', defaultConfig: { output: 'asset', value_path: '' } },
]

export const WORKFLOW_BLOCK_LIBRARY: WorkflowBlockTemplate[] = [
  {
    id: 'block-variable-payload',
    name: 'Biến → JSON',
    description: 'Cụm block automation để tạo biến trung gian rồi dựng payload JSON.',
    group: 'Automation',
    difficulty: 'Cơ bản',
    keywords: ['variables', 'json', 'payload', 'metadata'],
    nodes: [
      { key: 'set_1', type: 'set', label: 'Tạo biến', description: 'Sinh slug, request_name hoặc key trung gian.', dx: 0, dy: 0, config: { assign_json: '{"slug":"{{topic}}","request_name":"{{topic}}-{{media_type}}"}' } },
      { key: 'json_1', type: 'json', label: 'Dựng payload', description: 'Đóng gói dữ liệu thành JSON có cấu trúc.', dx: 280, dy: 0, config: { output_key: 'payload', template_json: '{"prompt":"{{prompt}}","topic":"{{topic}}","slug":"{{slug}}","request_name":"{{request_name}}"}' } },
    ],
    edges: [{ source: 'set_1', target: 'json_1' }],
  },
  {
    id: 'block-condition-router',
    name: 'Rẽ nhánh điều kiện',
    description: 'Cụm rẽ nhánh chuẩn TRUE/FALSE.',
    group: 'Logic',
    difficulty: 'Cơ bản',
    keywords: ['condition', 'branch', 'router'],
    nodes: [
      { key: 'condition_1', type: 'condition', label: 'Điều kiện', description: 'Kiểm tra biến hoặc trạng thái để chia nhánh.', dx: 0, dy: 60, config: { rule: 'media_type == "video"' } },
      { key: 'output_true', type: 'output', label: 'Đầu ra ĐÚNG', description: 'Nhánh đúng.', dx: 280, dy: 0, config: { output: 'true_branch', value_path: 'media_type' } },
      { key: 'output_false', type: 'output', label: 'Đầu ra SAI', description: 'Nhánh sai.', dx: 280, dy: 120, config: { output: 'false_branch', value_path: 'media_type' } },
    ],
    edges: [
      { source: 'condition_1', target: 'output_true', branch: 'true' },
      { source: 'condition_1', target: 'output_false', branch: 'false' },
    ],
  },
  {
    id: 'block-http-transform',
    name: 'HTTP → Đầu ra',
    description: 'Cụm gọi API rồi xuất JSON path.',
    group: 'Integration',
    difficulty: 'Trung cấp',
    keywords: ['http', 'webhook', 'api', 'json'],
    nodes: [
      { key: 'http_1', type: 'http', label: 'Gọi API', description: 'Gọi webhook hoặc service JSON.', dx: 0, dy: 0, config: { method: 'POST', url: 'https://example.com/webhook', body_json: '{"prompt":"{{prompt}}","payload":"{{payload}}"}', headers_json: '{"Content-Type":"application/json"}', timeout_sec: '60' } },
      { key: 'output_1', type: 'output', label: 'Đọc output', description: 'Đọc response theo path cụ thể.', dx: 300, dy: 0, config: { output: 'nodes.http_1.data', value_path: 'nodes.http_1.data' } },
    ],
    edges: [{ source: 'http_1', target: 'output_1' }],
  },
  {
    id: 'block-for-each-subflow',
    name: 'Lặp từng item → Workflow con',
    description: 'Cụm batch loop: lặp mảng item rồi gọi workflow con theo từng item.',
    group: 'Reusable',
    difficulty: 'Nâng cao',
    keywords: ['loop', 'batch', 'subflow', 'component'],
    nodes: [
      {
        key: 'for_each_1',
        type: 'for_each',
        label: 'Loop workflow con',
        description: 'Lặp qua danh sách items rồi gọi workflow con.',
        dx: 0,
        dy: 0,
        config: {
          items_path: 'items',
          workflow_id: 'template-variable-payload-pipeline',
          item_key: 'item',
          item_index_key: 'item_index',
          output_key: 'loop_results',
          inputs_json: '{"prompt":"{{prompt}}","variables":{"topic":"{{item.topic}}","channel":"{{item.channel}}","media_type":"{{item.media_type}}"}}',
        },
      },
      {
        key: 'output_1',
        type: 'output',
        label: 'Đầu ra batch',
        description: 'Xuất kết quả batch sau vòng lặp.',
        dx: 320,
        dy: 0,
        config: { output: 'loop_results', value_path: 'loop_results' },
      },
    ],
    edges: [{ source: 'for_each_1', target: 'output_1' }],
  },
  {
    id: 'block-prompt-image-output',
    name: 'Prompt → Ảnh',
    description: 'Bộ mẫu sinh ảnh: dựng prompt, gọi model ảnh — node Ảnh tự động là kết quả cuối, không cần node Đầu ra riêng.',
    group: 'Media',
    difficulty: 'Cơ bản',
    keywords: ['image', 'prompt', 'asset', 'output'],
    nodes: [
      { key: 'prompt_1', type: 'prompt', label: 'Dựng prompt', description: 'Ghép prompt chính với style hoặc guardrail.', dx: 0, dy: 0, config: { style: 'identity_lock', mode: 'append', template: '{{prompt}}' } },
      { key: 'image_1', type: 'image', label: 'Sinh ảnh', description: 'Gọi model ảnh với prompt đã chuẩn hóa — kết quả tự động trả về, không cần node Đầu ra riêng.', dx: 280, dy: 0, config: { provider: 'novita', model: 'seedream-4.5' } },
    ],
    edges: [
      { source: 'prompt_1', target: 'image_1' },
    ],
  },
  {
    id: 'block-ref-image-video-output',
    name: 'Ảnh tham chiếu → Video',
    description: 'Bộ mẫu image-to-video với ảnh tham chiếu để giữ nhân vật nhất quán hơn.',
    group: 'Media',
    difficulty: 'Trung cấp',
    keywords: ['video', 'reference', 'character', 'consistency'],
    nodes: [
      { key: 'prompt_1', type: 'prompt', label: 'Dựng prompt video', description: 'Tối ưu prompt cho shot video.', dx: 0, dy: 0, config: { style: 'identity_lock', mode: 'append', template: '{{prompt}}' } },
      { key: 'video_1', type: 'video', label: 'Sinh video', description: 'Gọi model video với tham chiếu ảnh hiện có — kết quả tự động trả về, không cần node Đầu ra riêng.', dx: 300, dy: 0, config: { provider: 'replicate', model: 'bytedance/seedance-2.0', image_url_path: 'state.reference_image', aspect_ratio_path: 'state.aspect_ratio', duration_path: 'state.duration', quality: '1080p' } },
    ],
    edges: [
      { source: 'prompt_1', target: 'video_1' },
    ],
  },
  {
    id: 'block-tts-lipsync-output',
    name: 'Audio → Lip Sync',
    description: 'Bộ mẫu nhận audio thay thế rồi ghép lipsync cho nhân vật.',
    group: 'Media',
    difficulty: 'Trung cấp',
    keywords: ['tts', 'voiceover', 'lipsync', 'avatar'],
    nodes: [
      { key: 'tts_1', type: 'tts', label: 'Nhận audio', description: 'Giữ audio_url đã có trong state để dùng cho lipsync.', dx: 0, dy: 0, config: { audio_url_path: 'state.audio_url', output_key: 'audio_url' } },
      { key: 'lipsync_1', type: 'lipsync', label: 'Ghép lipsync', description: 'Đồng bộ audio với gương mặt tham chiếu — kết quả tự động trả về, không cần node Đầu ra riêng.', dx: 280, dy: 0, config: { provider: 'heygen/lipsync-speed', video_url_path: 'state.video_url', audio_url_path: 'state.audio_url' } },
    ],
    edges: [
      { source: 'tts_1', target: 'lipsync_1' },
    ],
  },
  {
    id: 'block-http-condition-router',
    name: 'HTTP → Condition Router',
    description: 'Bộ mẫu gọi webhook rồi rẽ nhánh theo kết quả trả về.',
    group: 'Integration',
    difficulty: 'Nâng cao',
    keywords: ['http', 'condition', 'router', 'webhook'],
    nodes: [
      { key: 'http_1', type: 'http', label: 'Gọi service', description: 'Gửi payload ra ngoài hoặc vào hệ nội bộ.', dx: 0, dy: 60, config: { method: 'POST', url: 'https://example.com/webhook', body_json: '{"prompt":"{{prompt}}","payload":"{{payload}}"}', headers_json: '{"Content-Type":"application/json"}', timeout_sec: '60' } },
      { key: 'condition_1', type: 'condition', label: 'Kiểm tra kết quả', description: 'Rẽ nhánh theo mã trạng thái hoặc cờ phản hồi.', dx: 280, dy: 60, config: { rule: 'nodes.http_1.status_code == 200' } },
      { key: 'output_true', type: 'output', label: 'Nhánh OK', description: 'Trả output khi gọi service thành công.', dx: 560, dy: 0, config: { output: 'success_payload', value_path: 'nodes.http_1.data' } },
      { key: 'output_false', type: 'output', label: 'Nhánh lỗi', description: 'Trả output fallback khi service lỗi.', dx: 560, dy: 120, config: { output: 'error_payload', value_path: 'nodes.http_1.error' } },
    ],
    edges: [
      { source: 'http_1', target: 'condition_1' },
      { source: 'condition_1', target: 'output_true', branch: 'true' },
      { source: 'condition_1', target: 'output_false', branch: 'false' },
    ],
  },
]

export function duplicateNodeAsTemplate(type: WorkflowNodeType, x: number, y: number): WorkflowNode {
  const item = WORKFLOW_NODE_LIBRARY.find((entry) => entry.type === type)
  return {
    id: generateId(),
    type,
    label: item?.label || 'Node mới',
    description: item?.description || 'Node workflow tùy chỉnh.',
    x,
    y,
    config: { ...(item?.defaultConfig || {}) },
  }
}

export function instantiateWorkflowBlock(
  blockId: string,
  baseX: number,
  baseY: number,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null {
  const block = WORKFLOW_BLOCK_LIBRARY.find((item) => item.id === blockId)
  if (!block) return null
  const nodeIdMap = new Map<string, string>()
  const nodes = block.nodes.map((template) => {
    const nodeId = generateId()
    nodeIdMap.set(template.key, nodeId)
    return {
      id: nodeId,
      type: template.type,
      label: template.label,
      description: template.description,
      x: baseX + template.dx,
      y: baseY + template.dy,
      config: { ...(template.config || {}) },
    } satisfies WorkflowNode
  })
  const edges = block.edges
    .map((template) => {
      const source = nodeIdMap.get(template.source)
      const target = nodeIdMap.get(template.target)
      if (!source || !target) return null
      return {
        id: buildWorkflowEdgeId(source, target, template.branch),
        source,
        target,
        branch: template.branch,
      } satisfies WorkflowEdge
    })
    .filter(Boolean) as WorkflowEdge[]
  return { nodes, edges }
}

export function validateWorkflowDefinition(workflow: WorkflowDefinition | null | undefined): WorkflowValidationResult {
  const errors: WorkflowValidationIssue[] = []
  const warnings: WorkflowValidationIssue[] = []
  if (!workflow) return { errors, warnings }

  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
  const edges = Array.isArray(workflow.edges) ? workflow.edges : []

  if (!String(workflow.name || '').trim()) {
    errors.push({ level: 'error', code: 'workflow_name_required', message: 'Workflow cần có tên.' })
  }
  // 2026-07-27f: Sep yeu cau bo han yeu cau "toi thieu 2 node" (vua chan xoa node vua chan Luu/Chay
  // khi workflow con it node) - xem ghi chu cung ngay trong removeSelectedNode (useWorkflowHubCanvasActions.ts).

  const nodeById = new Map<string, WorkflowNode>()
  const duplicateNodeIds = new Set<string>()
  let inputCount = 0
  let outputCount = 0
  // 2026-07-28: node Anh/Video/Lipsync khong noi ra dau (leaf) gio tu dong la "output" that su
  // (backend execute_workflow_graph tu gom assetUrls tu cac node nay bat ke co node Dau ra rieng
  // hay khong - xem ghi chu trong main.py). Validator can biet dieu nay de KHONG bao loi
  // "Workflow can it nhat 1 node output" oan cho cac workflow da gop nhu vay.
  const sourceNodeIds = new Set(edges.map((edge) => String(edge.source || '')))
  const assetLeafNodeTypes = new Set(['image', 'video', 'lipsync'])

  for (const node of nodes) {
    const nodeId = String(node.id || '').trim()
    if (!nodeId) {
      errors.push({ level: 'error', code: 'node_id_required', message: 'Có node chưa có id hợp lệ.' })
      continue
    }
    if (nodeById.has(nodeId)) {
      duplicateNodeIds.add(nodeId)
      continue
    }
    nodeById.set(nodeId, node)
    if (!String(node.label || '').trim()) {
      warnings.push({ level: 'warning', code: 'node_label_empty', message: `Node ${nodeId} chưa có label rõ ràng.` })
    }
    if (node.type === 'template' && !String(node.config.template || '').trim()) {
      errors.push({ level: 'error', code: 'template_required', message: `Node ${node.label || nodeId} cần template để render text.` })
    }
    if (node.type === 'array' && !String(node.config.items_json || '').trim()) {
      errors.push({ level: 'error', code: 'array_items_required', message: `Node ${node.label || nodeId} cần items_json để tạo mảng.` })
    }
    if (node.type === 'map' && !String(node.config.mapping_json || '').trim()) {
      errors.push({ level: 'error', code: 'map_mapping_required', message: `Node ${node.label || nodeId} cần mapping_json để map dữ liệu.` })
    }
    if (node.type === 'merge' && !String(node.config.source_paths_json || '').trim()) {
      errors.push({ level: 'error', code: 'merge_sources_required', message: `Node ${node.label || nodeId} cần source_paths_json để merge dữ liệu.` })
    }
    if (node.type === 'set' && !String(node.config.assign_json || '').trim()) {
      errors.push({ level: 'error', code: 'set_assign_required', message: `Node ${node.label || nodeId} cần assign_json để tạo biến.` })
    }
    if (node.type === 'json' && !String(node.config.template_json || '').trim()) {
      errors.push({ level: 'error', code: 'json_template_required', message: `Node ${node.label || nodeId} cần template_json để dựng payload.` })
    }
    if (node.type === 'subflow') {
      if (!String(node.config.workflow_id || '').trim()) {
        errors.push({ level: 'error', code: 'subflow_workflow_required', message: `Node ${node.label || nodeId} cần workflow_id để gọi workflow con.` })
      }
      if (String(node.config.workflow_id || '').trim() === workflow.id) {
        errors.push({ level: 'error', code: 'subflow_self_reference', message: `Node ${node.label || nodeId} đang tự gọi chính workflow hiện tại.` })
      }
    }
    if (node.type === 'for_each') {
      if (!String(node.config.items_path || '').trim()) {
        errors.push({ level: 'error', code: 'for_each_items_required', message: `Node ${node.label || nodeId} cần items_path để đọc danh sách cần lặp.` })
      }
      if (!String(node.config.workflow_id || '').trim()) {
        errors.push({ level: 'error', code: 'for_each_workflow_required', message: `Node ${node.label || nodeId} cần workflow_id để gọi workflow con.` })
      }
      if (String(node.config.workflow_id || '').trim() === workflow.id) {
        errors.push({ level: 'error', code: 'for_each_self_reference', message: `Node ${node.label || nodeId} đang tự gọi chính workflow hiện tại.` })
      }
    }
    if ((node.type === 'image' || node.type === 'video') && !String(node.config.provider || '').trim()) {
      errors.push({ level: 'error', code: 'media_provider_required', message: `Node ${node.label || nodeId} chưa chọn provider.` })
    }
    if ((node.type === 'image' || node.type === 'video') && !String(node.config.model || '').trim()) {
      errors.push({ level: 'error', code: 'media_model_required', message: `Node ${node.label || nodeId} chưa chọn model.` })
    }
    if (node.type === 'http') {
      const url = String(node.config.url || '').trim()
      if (!url) errors.push({ level: 'error', code: 'http_url_required', message: `Node ${node.label || nodeId} chưa có URL dịch vụ.` })
      if (url.includes('example.com')) errors.push({ level: 'error', code: 'http_url_placeholder', message: `Node ${node.label || nodeId} vẫn đang dùng URL mẫu example.com.` })
      if (String(node.config.ready || '').toLowerCase() === 'false') {
        warnings.push({ level: 'warning', code: 'worker_not_ready', message: `Worker của node ${node.label || nodeId} chưa được xác nhận sẵn sàng.` })
      }
    }
    if (node.type === 'input') inputCount += 1
    if (node.type === 'output') outputCount += 1
    if (assetLeafNodeTypes.has(node.type) && !sourceNodeIds.has(nodeId)) outputCount += 1
  }

  if (duplicateNodeIds.size > 0) {
    errors.push({ level: 'error', code: 'node_id_duplicate', message: `Trùng node id: ${Array.from(duplicateNodeIds).join(', ')}.` })
  }
  if (inputCount === 0) {
    warnings.push({ level: 'warning', code: 'input_missing', message: 'Workflow chưa có node input.' })
  }
  if (outputCount === 0) {
    errors.push({ level: 'error', code: 'output_missing', message: 'Workflow cần ít nhất 1 node output (hoặc 1 node Ảnh/Video/Lipsync không nối ra node nào khác — node đó sẽ tự động là kết quả cuối).' })
  }

  const indegree = new Map<string, number>()
  const seenEdges = new Set<string>()
  for (const nodeId of nodeById.keys()) indegree.set(nodeId, 0)

  for (const edgeItem of edges) {
    const source = String(edgeItem.source || '').trim()
    const target = String(edgeItem.target || '').trim()
    const branch = normalizeEdgeBranch(edgeItem.branch)
    if (!source || !target) {
      errors.push({ level: 'error', code: 'edge_invalid', message: 'Có edge thiếu source hoặc target.' })
      continue
    }
    if (!nodeById.has(source) || !nodeById.has(target)) {
      errors.push({ level: 'error', code: 'edge_missing_node', message: `Edge ${source} → ${target} đang trỏ tới node không tồn tại.` })
      continue
    }
    if (source === target) {
      errors.push({ level: 'error', code: 'edge_self_reference', message: `Edge ${source} → ${target} không được nối vào chính nó.` })
    }
    const edgeKey = `${source}:${target}:${branch || 'always'}`
    if (seenEdges.has(edgeKey)) {
      errors.push({ level: 'error', code: 'edge_duplicate', message: `Trùng edge ${source} → ${target}${branch ? ` (${branch.toUpperCase()})` : ''}.` })
      continue
    }
    seenEdges.add(edgeKey)
    if (branch && nodeById.get(source)?.type !== 'condition') {
      errors.push({ level: 'error', code: 'edge_branch_invalid', message: `Edge ${source} → ${target} chỉ được gán branch khi node nguồn là condition.` })
    }
    indegree.set(target, (indegree.get(target) || 0) + 1)
  }

  if (nodeById.size > 0 && !Array.from(indegree.values()).some((count) => count === 0)) {
    errors.push({ level: 'error', code: 'workflow_no_root', message: 'Workflow không có node gốc để bắt đầu chạy.' })
  }
  if (workflow.folderId === SANDBOX_WORKFLOW_FOLDER_ID || workflow.environment === 'sandbox') {
    warnings.push({
      level: 'warning',
      code: 'sandbox_limits',
      message: 'Phòng thử nghiệm: tối đa 1 job, video 10 giây/720p, không chạy theo lịch và không xuất bản trực tiếp.',
    })
  }

  return { errors, warnings }
}
