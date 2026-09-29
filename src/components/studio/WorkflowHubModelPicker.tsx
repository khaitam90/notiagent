import type { WorkflowNodeType } from '../../lib/workflows'
import { IMAGE_BRAND_GROUPS } from '../../lib/imageModels'
import { MODEL_GROUPS as VIDEO_MODEL_GROUPS } from '../../lib/videoModels'

// 2026-07-27g: Sep yeu cau (1) giao dien chon model dang card giong Studio AI Composer thay vi 1 o
// chu "model" tro trui trong bang config chung, va (2) moi model phai co dong "khuyen dung cho...".
// Component nay dung DUNG catalog that da co san (imageModels.ts / videoModels.ts - cung 1 nguon
// Studio AI Composer dang dung) - KHONG bia them model nao khong co trong catalog (vd Sep vi du
// "Kling 3.0" trong yeu cau, nhung catalog video that hien chi co Seedance 2.0/2.0-fast/2.0-mini va
// model Kling/Google/xAI được nhóm theo đúng hãng trong catalog.
// "Khuyen dung cho" lay tu field `strengths`/`desc` (anh) hoac `strength` (video) co san trong
// catalog, khong tu bia so lieu moi.

type Props = {
  nodeType: WorkflowNodeType
  currentModel: string
  isEditable: boolean
  onSelect: (picked: { provider: string; apiModel: string }) => void
}

export function WorkflowHubModelPicker({ nodeType, currentModel, isEditable, onSelect }: Props) {
  if (nodeType === 'image') {
    return (
      <div className="wf-field wf-model-picker">
        <span>Model AI tạo ảnh</span>
        <div className="wf-model-groups">
          {IMAGE_BRAND_GROUPS.map((group) => (
            <div key={group.brand} className="wf-model-group">
              <p className="wf-model-group-label">{group.label}</p>
              <div className="wf-node-template-grid">
                {group.models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    className={`wf-node-template-card${model.apiModel === currentModel ? ' active' : ''}`}
                    onClick={() => onSelect({ provider: model.provider, apiModel: model.apiModel })}
                    disabled={!isEditable}
                    title={model.desc}
                  >
                    <strong>
                      {model.label}
                      {model.premium ? ' · Premium' : ''}
                      {model.status === 'ready' ? ' · Sẵn sàng' : ''}
                    </strong>
                    <small>Khuyên dùng cho: {model.strengths.join(', ')}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (nodeType === 'video') {
    return (
      <div className="wf-field wf-model-picker">
        <span>Model AI tạo video</span>
        <div className="wf-model-groups">
          {VIDEO_MODEL_GROUPS.map((group) => (
            <div key={group.brand} className="wf-model-group">
              <p className="wf-model-group-label">{group.brand}</p>
              <div className="wf-node-template-grid">
                {group.models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    className={`wf-node-template-card${model.apiModel === currentModel ? ' active' : ''}`}
                    onClick={() => onSelect({ provider: model.provider, apiModel: model.apiModel })}
                    disabled={!isEditable}
                    title={model.desc}
                  >
                    <strong>
                      {model.label}
                      {model.tier === 'pro' ? ' · Premium' : ''}
                    </strong>
                    <small>Khuyên dùng cho: {model.desc}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}
