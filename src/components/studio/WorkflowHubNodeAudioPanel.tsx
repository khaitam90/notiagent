import type { WorkflowNode } from '../../lib/workflows'
import { audioModelsForKind } from '../../lib/audioModels'

// Chon model giong doc/khop moi ngay tren khoi node (trinh sua workflow khong con panel phai, xem
// ghi chu 2026-08-03 trong index.css). Danh muc tham khao - backend chay mock cho toi khi co key that.
type Props = {
  node: WorkflowNode
  isEditable: boolean
  onUpdateConfig: (patch: Record<string, string>) => void
}

export function WorkflowHubNodeAudioPanel({ node, isEditable, onUpdateConfig }: Props) {
  const kind = node.type === 'tts' ? 'tts' : 'lipsync'
  const models = audioModelsForKind(kind)
  const selected = models.find((model) => model.apiModel === node.config.model)

  return (
    <div
      className="wf-node-audio-panel"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <label>
        <span>{kind === 'tts' ? 'Model giọng đọc' : 'Model khớp môi'}</span>
        <select
          value={selected?.apiModel ?? ''}
          disabled={!isEditable}
          onChange={(event) => {
            const picked = models.find((model) => model.apiModel === event.target.value)
            if (picked) onUpdateConfig({ provider: picked.provider, model: picked.apiModel })
          }}
        >
          <option value="" disabled>
            Chọn model…
          </option>
          {models.map((model) => (
            <option key={model.id} value={model.apiModel}>
              {model.label} ({model.priceHint})
            </option>
          ))}
        </select>
      </label>
      <small>{selected ? selected.desc : 'Danh mục tham khảo — chưa nối API, workflow chạy bản thử miễn phí (mock).'}</small>
    </div>
  )
}
