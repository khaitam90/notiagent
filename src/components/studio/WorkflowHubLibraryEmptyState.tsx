import { Workflow } from 'lucide-react'

type Props = {
  onShowTemplates: () => void
  onCreateWorkflow: () => void
}

export function WorkflowHubLibraryEmptyState({ onShowTemplates, onCreateWorkflow }: Props) {
  return (
    <div className="wf-empty">
      <Workflow size={40} />
      <h3>Chưa có workflow trong mục này</h3>
      <p>Tạo workflow mới hoặc nhân bản từ mẫu để bắt đầu xây thư viện workflow riêng của bạn.</p>
      <div className="wf-empty-actions">
        <button type="button" className="wf-secondary-btn" onClick={onShowTemplates}>
          Xem mẫu
        </button>
        <button type="button" className="wf-primary-btn" onClick={onCreateWorkflow}>
          Tạo workflow mới
        </button>
      </div>
    </div>
  )
}
