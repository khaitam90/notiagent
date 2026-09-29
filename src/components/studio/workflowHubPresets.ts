import {
  buildWorkflowEdgeId,
  duplicateNodeAsTemplate,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowEdgeBranch,
  type WorkflowMedia,
  type WorkflowNodeType,
} from '../../lib/workflows'
import { generateId } from '../../lib/uuid'

export type WorkflowWizardPreset = {
  id: string
  label: string
  description: string
  media: WorkflowMedia
  tags: string[]
  metadata: Record<string, unknown>
  nodes: Array<{
    key: string
    type: WorkflowNodeType
    label?: string
    description?: string
    x: number
    y: number
    config?: Record<string, string>
  }>
  edges: Array<{
    source: string
    target: string
    branch?: WorkflowEdgeBranch
  }>
}

export type NodeConfigTemplate = {
  id: string
  label: string
  description: string
  config: Record<string, string>
}

export const WORKFLOW_TAG_PRESETS = ['starter', 'image', 'video', 'automation', 'character', 'social', 'marketing', 'batch']

export const WORKFLOW_USE_CASE_PRESETS: Array<{ label: string; useCase: string; tags: string[] }> = [
  { label: 'Character image', useCase: 'character_image_pipeline', tags: ['starter', 'image', 'character'] },
  { label: 'Character video', useCase: 'character_video_pipeline', tags: ['starter', 'video', 'character'] },
  { label: 'Social content', useCase: 'social_content_pipeline', tags: ['starter', 'social', 'marketing'] },
  { label: 'Automation router', useCase: 'automation_router', tags: ['starter', 'automation', 'batch'] },
]

export const STARTER_COLLECTIONS = [
  { id: 'all', label: 'Tất cả starter' },
  { id: 'character', label: 'Character' },
  { id: 'social', label: 'Social' },
  { id: 'automation', label: 'Automation' },
] as const

export const COMPONENT_INPUT_FIELD_PRESETS: Array<{ field: string; hint: string }> = [
  { field: 'prompt', hint: 'Prompt chính cho ảnh/video' },
  { field: 'scene_description', hint: 'Mô tả cảnh dài' },
  { field: 'reference_image', hint: 'Giữ khuôn mặt / style tham chiếu' },
  { field: 'image_url', hint: 'Ảnh nguồn đầu vào' },
  { field: 'video_url', hint: 'Video nguồn đầu vào cho edit / lipsync' },
  { field: 'audio_url', hint: 'Audio thay thế cho lipsync / dubbing' },
  { field: 'aspect_ratio', hint: 'Tỷ lệ ảnh hoặc video' },
  { field: 'duration', hint: 'Độ dài video tính bằng giây' },
  { field: 'media_type', hint: 'Chọn image hoặc video' },
  { field: 'negative_prompt', hint: 'Ràng buộc nội dung cần tránh' },
  { field: 'topic', hint: 'Chủ đề nội dung' },
  { field: 'channel', hint: 'Kênh hoặc nơi xuất bản' },
  { field: 'tool_id', hint: 'Chọn tool/model cụ thể' },
]

export const COMPONENT_OUTPUT_SCHEMA_PRESETS: Array<{ key: string; value: string; hint: string }> = [
  { key: 'asset', value: 'final_output.value', hint: 'Output media cuối cùng' },
  { key: 'assets', value: 'final_output.assets', hint: 'Danh sách asset cuối cùng' },
  { key: 'payload', value: 'state.payload', hint: 'Payload đã xử lý' },
  { key: 'prompt_text', value: 'state.prompt', hint: 'Prompt sau khi AI hỗ trợ viết lại' },
  { key: 'trace', value: 'trace', hint: 'Trace phục vụ debug' },
  { key: 'request_name', value: 'state.request_name', hint: 'Tên request/work item' },
]

export const NODE_CONFIG_TEMPLATES: Partial<Record<WorkflowNodeType, NodeConfigTemplate[]>> = {
  input: [
    {
      id: 'image_request',
      label: 'Image request',
      description: 'Prompt ảnh cơ bản với tỷ lệ khung hình.',
      config: { fields: 'prompt,aspect_ratio' },
    },
    {
      id: 'reference_image_request',
      label: 'Reference image',
      description: 'Prompt + ảnh tham chiếu để giữ mặt nhân vật.',
      config: { fields: 'prompt,reference_image,aspect_ratio' },
    },
    {
      id: 'video_request',
      label: 'Video request',
      description: 'Prompt video có tham chiếu và duration.',
      config: { fields: 'prompt,reference_image,video_url,duration,aspect_ratio' },
    },
  ],
  prompt: [
    {
      id: 'cinematic_rewrite',
      label: 'Cinematic rewrite',
      description: 'Viết lại prompt theo hướng điện ảnh, giàu chi tiết.',
      config: {
        template:
          'Rewrite the user prompt into a cinematic creative brief with subject, lighting, composition, camera, mood, and style. User prompt: {{prompt}}',
        output_key: 'prompt',
      },
    },
    {
      id: 'character_consistency',
      label: 'Character consistency',
      description: 'Nhấn mạnh giữ nhận diện nhân vật từ reference image.',
      config: {
        template:
          'Write a production prompt that preserves the same face, hairstyle, and identity from the reference image. Request: {{prompt}}',
        output_key: 'prompt',
      },
    },
  ],
  image: [
    {
      id: 'novita_seedream',
      label: 'Novita Seedream image',
      description: 'Preset sinh ảnh với Novita Seedream 4.5.',
      config: {
        provider: 'novita',
        model: 'seedream-4.5',
        prompt_path: 'state.prompt',
        aspect_ratio_path: 'state.aspect_ratio',
        output_key: 'asset',
      },
    },
    {
      id: 'novita_ref_image',
      label: 'Novita ref image',
      description: 'Preset sinh ảnh có ảnh tham chiếu.',
      config: {
        provider: 'novita',
        model: 'seedream-4.5',
        prompt_path: 'state.prompt',
        reference_image_path: 'state.reference_image',
        aspect_ratio_path: 'state.aspect_ratio',
        output_key: 'asset',
      },
    },
  ],
  video: [
    {
      id: 'replicate_text_video',
      label: 'Replicate Seedance text-to-video',
      description: 'Preset sinh video text-to-video tối ưu chi phí.',
      config: {
        provider: 'replicate',
        model: 'bytedance/seedance-2.0-fast',
        prompt_path: 'state.prompt',
        aspect_ratio_path: 'state.aspect_ratio',
        duration_path: 'state.duration',
        quality: '720p',
        output_key: 'asset',
      },
    },
    {
      id: 'replicate_image_video',
      label: 'Replicate Seedance image-to-video',
      description: 'Preset video từ ảnh tham chiếu giữ nhân vật ổn định hơn.',
      config: {
        provider: 'replicate',
        model: 'bytedance/seedance-2.0',
        prompt_path: 'state.prompt',
        image_url_path: 'state.reference_image',
        aspect_ratio_path: 'state.aspect_ratio',
        duration_path: 'state.duration',
        quality: '1080p',
        output_key: 'asset',
      },
    },
  ],
  http: [
    {
      id: 'json_post',
      label: 'JSON POST',
      description: 'POST JSON tới một API ngoài.',
      config: {
        method: 'POST',
        url: 'https://api.example.com/run',
        headers_json: '{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer {{api_key}}"\n}',
        body_json: '{\n  "prompt": "{{prompt}}"\n}',
        output_key: 'payload',
      },
    },
    {
      id: 'poll_status',
      label: 'Poll status',
      description: 'GET trạng thái tác vụ theo request_id.',
      config: {
        method: 'GET',
        url: 'https://api.example.com/status/{{request_id}}',
        headers_json: '{\n  "Authorization": "Bearer {{api_key}}"\n}',
        output_key: 'payload',
      },
    },
  ],
  subflow: [
    {
      id: 'component_call',
      label: 'Component call',
      description: 'Khung gọi component reusable với inputs_json/expose_json.',
      config: {
        output_key: 'component_result',
        inputs_json: '{\n  "prompt": "{{prompt}}"\n}',
        expose_json: '{\n  "asset": "final_output.value"\n}',
      },
    },
  ],
  for_each: [
    {
      id: 'batch_component',
      label: 'Batch component',
      description: 'Lặp qua mảng đầu vào và gom kết quả.',
      config: {
        items_path: 'items',
        item_key: 'item',
        item_index_key: 'item_index',
        output_key: 'loop_results',
      },
    },
  ],
  output: [
    {
      id: 'final_asset',
      label: 'Final asset',
      description: 'Expose output media cuối cùng.',
      config: {
        output: 'asset',
        value_path: 'final_output.value',
      },
    },
    {
      id: 'final_payload',
      label: 'Final payload',
      description: 'Expose payload JSON cuối cùng.',
      config: {
        output: 'payload',
        value_path: 'state.payload',
      },
    },
  ],
  tts: [
    {
      id: 'basic_tts',
      label: 'Basic TTS',
      description: 'Sinh voiceover từ prompt/text.',
      config: {
        provider: 'tts',
        voice: 'alloy',
        text_path: 'state.prompt',
        output_key: 'audio',
      },
    },
  ],
  lipsync: [
    {
      id: 'basic_lipsync',
      label: 'Basic lipsync',
      description: 'Đồng bộ audio vào video/avatar.',
      config: {
        provider: 'heygen/lipsync-speed',
        video_url_path: 'state.video_url',
        audio_url_path: 'state.audio_url',
        output_key: 'asset',
      },
    },
  ],
}

export const WORKFLOW_WIZARD_PRESETS: WorkflowWizardPreset[] = [
  {
    id: 'wizard-character-image',
    label: 'Character image pipeline',
    description: 'Prompt + ảnh tham chiếu + sinh ảnh giữ khuôn mặt nhân vật.',
    media: 'image',
    tags: ['starter', 'image', 'character'],
    metadata: { use_case: 'character_image_pipeline', provider: 'novita' },
    nodes: [
      {
        key: 'input',
        type: 'input',
        label: 'Input nhân vật',
        description: 'Nhận prompt, ảnh tham chiếu và aspect ratio.',
        x: 80,
        y: 140,
        config: { fields: 'prompt,reference_image,aspect_ratio' },
      },
      {
        key: 'prompt',
        type: 'prompt',
        label: 'Giữ nhận diện nhân vật',
        description: 'Viết lại prompt với ràng buộc giữ cùng khuôn mặt.',
        x: 360,
        y: 140,
        config: {
          template:
            'Write a production-ready image prompt that keeps the same face identity, hairstyle, and overall character consistency from the reference image. Request: {{prompt}}',
          output_key: 'prompt',
        },
      },
      {
        key: 'image',
        type: 'image',
        label: 'Sinh ảnh nhân vật',
        description: 'Sinh ảnh bằng Novita Seedream 4.5 với ảnh tham chiếu.',
        x: 660,
        y: 140,
        config: {
          provider: 'novita',
          model: 'seedream-4.5',
          prompt_path: 'state.prompt',
          reference_image_path: 'state.reference_image',
          aspect_ratio_path: 'state.aspect_ratio',
          output_key: 'asset',
        },
      },
      {
        key: 'output',
        type: 'output',
        label: 'Xuất ảnh',
        description: 'Trả ảnh cuối cùng ra ứng dụng.',
        x: 960,
        y: 140,
        config: { output: 'asset', value_path: 'final_output.value' },
      },
    ],
    edges: [
      { source: 'input', target: 'prompt' },
      { source: 'prompt', target: 'image' },
      { source: 'image', target: 'output' },
    ],
  },
  {
    id: 'wizard-character-video',
    label: 'Character video pipeline',
    description: 'Prompt + ảnh tham chiếu + video giữ nhân vật với duration.',
    media: 'video',
    tags: ['starter', 'video', 'character'],
    metadata: { use_case: 'character_video_pipeline', provider: 'replicate' },
    nodes: [
      {
        key: 'input',
        type: 'input',
        label: 'Input video nhân vật',
        description: 'Nhận prompt, ảnh tham chiếu, duration và aspect ratio.',
        x: 80,
        y: 160,
        config: { fields: 'prompt,reference_image,duration,aspect_ratio' },
      },
      {
        key: 'prompt',
        type: 'prompt',
        label: 'Chuẩn hóa prompt video',
        description: 'Làm rõ hành động, chuyển động camera và giữ nhân vật.',
        x: 360,
        y: 160,
        config: {
          template:
            'Rewrite the prompt as a cinematic image-to-video direction while preserving the same face and identity from the reference image. Request: {{prompt}}',
          output_key: 'prompt',
        },
      },
      {
        key: 'video',
        type: 'video',
        label: 'Sinh video nhân vật',
        description: 'Sinh video từ ảnh tham chiếu và prompt.',
        x: 660,
        y: 160,
        config: {
          provider: 'replicate',
          model: 'bytedance/seedance-2.0',
          prompt_path: 'state.prompt',
          image_url_path: 'state.reference_image',
          aspect_ratio_path: 'state.aspect_ratio',
          duration_path: 'state.duration',
          quality: '1080p',
          output_key: 'asset',
        },
      },
      {
        key: 'output',
        type: 'output',
        label: 'Xuất video',
        description: 'Trả video cuối cùng ra ứng dụng.',
        x: 960,
        y: 160,
        config: { output: 'asset', value_path: 'final_output.value' },
      },
    ],
    edges: [
      { source: 'input', target: 'prompt' },
      { source: 'prompt', target: 'video' },
      { source: 'video', target: 'output' },
    ],
  },
  {
    id: 'wizard-api-bridge',
    label: 'API render bridge',
    description: 'Nhận input, dựng payload JSON, gọi API ngoài rồi xuất payload/asset.',
    media: 'automation',
    tags: ['starter', 'automation', 'integration'],
    metadata: { use_case: 'api_render_bridge', provider: 'http' },
    nodes: [
      {
        key: 'input',
        type: 'input',
        label: 'Input request',
        description: 'Nhận prompt, topic, media_type và tool_id.',
        x: 80,
        y: 120,
        config: { fields: 'prompt,topic,media_type,tool_id' },
      },
      {
        key: 'json',
        type: 'json',
        label: 'Dựng payload',
        description: 'Dựng JSON gửi sang service ngoài.',
        x: 360,
        y: 120,
        config: {
          output_key: 'payload',
          template_json: '{"prompt":"{{prompt}}","topic":"{{topic}}","media_type":"{{media_type}}","tool_id":"{{tool_id}}"}',
        },
      },
      {
        key: 'http',
        type: 'http',
        label: 'Gọi render API',
        description: 'Gửi payload sang API ngoài.',
        x: 660,
        y: 120,
        config: {
          method: 'POST',
          url: 'https://api.example.com/render',
          headers_json: '{"Content-Type":"application/json","Authorization":"Bearer {{api_key}}"}',
          body_json: '{{payload}}',
          output_key: 'payload',
        },
      },
      {
        key: 'output',
        type: 'output',
        label: 'Xuất payload',
        description: 'Expose payload phản hồi.',
        x: 960,
        y: 120,
        config: { output: 'payload', value_path: 'nodes.http.payload' },
      },
    ],
    edges: [
      { source: 'input', target: 'json' },
      { source: 'json', target: 'http' },
      { source: 'http', target: 'output' },
    ],
  },
  {
    id: 'wizard-social-batch',
    label: 'Social batch pack',
    description: 'Tạo batch item nội dung xã hội và xử lý qua component loop.',
    media: 'automation',
    tags: ['starter', 'automation', 'social', 'batch'],
    metadata: { use_case: 'social_batch_pack', provider: 'component' },
    nodes: [
      {
        key: 'input',
        type: 'input',
        label: 'Input social',
        description: 'Nhận prompt, topic, channel và media_type.',
        x: 80,
        y: 200,
        config: { fields: 'prompt,topic,channel,media_type' },
      },
      {
        key: 'set',
        type: 'set',
        label: 'Biến social',
        description: 'Tạo request_name và slug.',
        x: 340,
        y: 200,
        config: { assign_json: '{"slug":"{{topic}}","request_name":"{{channel}}-{{topic}}-{{media_type}}"}' },
      },
      {
        key: 'array',
        type: 'array',
        label: 'Danh sách batch',
        description: 'Tạo danh sách item cần xử lý.',
        x: 620,
        y: 200,
        config: {
          output_key: 'items',
          items_json:
            '[{"topic":"{{topic}}","channel":"{{channel}}","media_type":"image"},{"topic":"{{topic}}","channel":"{{channel}}","media_type":"video"}]',
        },
      },
      {
        key: 'loop',
        type: 'for_each',
        label: 'Loop component',
        description: 'Lặp từng item và gọi workflow con.',
        x: 920,
        y: 200,
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
        key: 'output',
        type: 'output',
        label: 'Xuất batch',
        description: 'Expose kết quả loop ra ngoài.',
        x: 1220,
        y: 200,
        config: { output: 'loop_results', value_path: 'state.loop_results' },
      },
    ],
    edges: [
      { source: 'input', target: 'set' },
      { source: 'set', target: 'array' },
      { source: 'array', target: 'loop' },
      { source: 'loop', target: 'output' },
    ],
  },
]

export function buildWorkflowDefinitionFromWizardPreset(
  preset: WorkflowWizardPreset,
  targetFolderId: string,
): WorkflowDefinition {
  const createdAt = new Date().toISOString()
  const keyToNodeId = new Map<string, string>()
  const nodes = preset.nodes.map((item) => {
    const node = duplicateNodeAsTemplate(item.type, item.x, item.y)
    const nextNode = {
      ...node,
      label: item.label || node.label,
      description: item.description || node.description,
      config: {
        ...node.config,
        ...(item.config || {}),
      },
    }
    keyToNodeId.set(item.key, nextNode.id)
    return nextNode
  })
  const edges = preset.edges
    .map((edge) => {
      const source = keyToNodeId.get(edge.source)
      const target = keyToNodeId.get(edge.target)
      if (!source || !target) return null
      return {
        id: buildWorkflowEdgeId(source, target, edge.branch),
        source,
        target,
        branch: edge.branch,
      }
    })
    .filter(Boolean) as WorkflowEdge[]
  return {
    id: generateId(),
    name: preset.label,
    description: preset.description,
    folderId: targetFolderId,
    media: preset.media,
    category: 'custom',
    updatedAt: createdAt,
    published: false,
    component: false,
    componentName: '',
    componentInputSchemaJson: '',
    componentOutputSchemaJson: '',
    tags: preset.tags,
    metadataJson: JSON.stringify(preset.metadata, null, 2),
    sourceTemplateId: preset.id,
    nodes,
    edges,
  }
}
