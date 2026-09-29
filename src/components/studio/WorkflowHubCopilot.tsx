import { useEffect, useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, Lightbulb, Maximize2, Minimize2, Plus, Send, X } from 'lucide-react'
import { validateWorkflowDefinition, type WorkflowDefinition, type WorkflowNodeType } from '../../lib/workflows'
import { workflowCopilotChat, type CopilotChatTurn } from '../../lib/workflowApi'

type Props = {
  workflow: WorkflowDefinition
  isEditable: boolean
  onAddNode: (type: WorkflowNodeType) => void
}

function missingCoreNodes(workflow: WorkflowDefinition): WorkflowNodeType[] {
  const types = new Set(workflow.nodes.map((node) => node.type))
  const hasDepthVideo = workflow.nodes.some(
    (node) => node.type === 'http' && node.config.capability === 'depth_video',
  )
  const missing: WorkflowNodeType[] = []
  if (!types.has('input')) missing.push('input')
  if (!types.has('prompt') && ['image', 'video', 'hybrid'].includes(workflow.media)) missing.push('prompt')
  if (!types.has('image') && workflow.media === 'image') missing.push('image')
  if (!types.has('video') && !hasDepthVideo && workflow.media === 'video') missing.push('video')
  if (!types.has('output')) missing.push('output')
  return missing
}

function connectionAdvice(workflow: WorkflowDefinition) {
  const types = new Set(workflow.nodes.map((node) => node.type))
  const hasDepthVideo = workflow.nodes.some(
    (node) => node.type === 'http' && node.config.capability === 'depth_video',
  )
  if (!types.has('input')) return 'Thêm Input để khai báo prompt và dữ liệu tham chiếu.'
  if (!types.has('output')) return 'Thêm node Đầu ra để ứng dụng nhận tài sản hoặc payload cuối.'
  if (workflow.media === 'image' && !types.has('image')) return 'Luồng ảnh cần node tạo ảnh.'
  if (workflow.media === 'video' && !types.has('video') && !hasDepthVideo) return 'Luồng video cần node tạo video.'
  if (hasDepthVideo && workflow.nodes.some((node) => node.config.ready === 'false')) {
    return 'Sơ đồ Depth Video đã đúng; bước còn lại là bật worker và chạy thử video ngắn trước khi chuyển khỏi Sandbox.'
  }
  if (types.has('condition')) return 'Kiểm tra Condition có đủ nhánh ĐÚNG/SAI và đúng đích.'
  return 'Luồng chính đã đủ. Nên nối node theo chiều trái sang phải và chạy thử trước khi xuất bản.'
}

export function WorkflowHubCopilot({ workflow, isEditable, onAddNode }: Props) {
  const missing = missingCoreNodes(workflow)
  const validation = validateWorkflowDefinition(workflow)
  const issueCount = validation.errors.length + validation.warnings.length + missing.length
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<CopilotChatTurn[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState('')

  useEffect(() => {
    if (!expanded) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [expanded])

  const sendChat = async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    setChatInput('')
    setChatError('')
    const nextHistory: CopilotChatTurn[] = [...chatHistory, { role: 'user', content: text }]
    setChatHistory(nextHistory)
    setChatLoading(true)
    try {
      const { reply } = await workflowCopilotChat(workflow, text, chatHistory)
      setChatHistory([...nextHistory, { role: 'assistant', content: reply }])
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Không hỏi được trợ lý AI, thử lại sau.')
    } finally {
      setChatLoading(false)
    }
  }

  const chatLog = (
    <>
      {chatHistory.length === 0 && (
        <p className="wf-copilot-chat-hint">Hỏi: “Sơ đồ này sai ở đâu?”, “node nào thiếu cấu hình?” hoặc “nên nối node thế nào?”</p>
      )}
      {chatHistory.map((turn, index) => (
        <div key={index} className={`wf-copilot-chat-turn wf-copilot-chat-turn-${turn.role}`}>
          <span className="wf-copilot-chat-role">{turn.role === 'user' ? 'Bạn' : 'AI'}</span>
          <p>{turn.content}</p>
        </div>
      ))}
      {chatLoading && <p className="wf-copilot-chat-hint">AI đang đọc toàn bộ sơ đồ...</p>}
      {chatError && <p className="wf-copilot-chat-error">{chatError}</p>}
    </>
  )

  const chatInputRow = (
    <div className="wf-copilot-chat-input-row">
      <textarea
        value={chatInput}
        onChange={(event) => setChatInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void sendChat()
          }
        }}
        placeholder="Hỏi AI về workflow hiện tại..."
        rows={expanded ? 3 : 2}
        disabled={chatLoading}
      />
      <button type="button" className="wf-primary-btn" onClick={() => void sendChat()} disabled={chatLoading || !chatInput.trim()}>
        <Send size={14} />
      </button>
    </div>
  )

  return (
    <div className="wf-copilot-floating">
      <button
        type="button"
        className={`wf-copilot-fab${open ? ' is-open' : ''}${issueCount > 0 ? ' has-issues' : ''}`}
        onClick={() => setOpen((current) => !current)}
        title="AI kiểm tra và hướng dẫn workflow"
        aria-label="Mở trợ lý AI workflow"
      >
        <Bot size={24} />
        {issueCount > 0 && <span className="wf-copilot-fab-badge">{issueCount > 9 ? '9+' : issueCount}</span>}
      </button>

      {open && (
        <aside className="wf-copilot-popover">
          <header className="wf-copilot-popover-head">
            <span>
              <Bot size={18} />
              <span>
                <strong>AI kiểm tra workflow</strong>
                <small>Đang thấy {workflow.nodes.length} node · {workflow.edges.length} liên kết</small>
              </span>
            </span>
            <span className="wf-copilot-popover-actions">
              <button type="button" onClick={() => setExpanded(true)} title="Mở rộng"><Maximize2 size={14} /></button>
              <button type="button" onClick={() => setOpen(false)} title="Đóng"><X size={15} /></button>
            </span>
          </header>

          <section className={`wf-copilot-health${issueCount > 0 ? ' has-issues' : ' is-ready'}`}>
            <div className="wf-copilot-section-title">
              {issueCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              {issueCount > 0 ? `${issueCount} điểm cần kiểm tra` : 'Sơ đồ hợp lệ'}
            </div>
            {validation.errors.slice(0, 3).map((issue, index) => <p key={`e-${index}`}>• {issue.message}</p>)}
            {validation.warnings.slice(0, 2).map((issue, index) => <p key={`w-${index}`}>• {issue.message}</p>)}
            {issueCount === 0 && <p>Các node và liên kết chính đã sẵn sàng để chạy.</p>}
          </section>

          <section className="wf-copilot-chat">
            <div className="wf-copilot-chat-log">{chatLog}</div>
            {chatInputRow}
          </section>

          <section className="wf-copilot-next">
            <div className="wf-copilot-section-title"><Lightbulb size={14} />Gợi ý tiếp theo</div>
            <p>{connectionAdvice(workflow)}</p>
            {missing.length > 0 && (
              <div className="wf-copilot-actions">
                {missing.slice(0, 4).map((type) => (
                  <button key={type} type="button" className="wf-secondary-btn" onClick={() => onAddNode(type)} disabled={!isEditable}>
                    <Plus size={13} /> Thêm {type}
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      )}

      {expanded && (
        <div className="wf-text-modal-backdrop" onMouseDown={() => setExpanded(false)}>
          <div className="wf-copilot-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="wf-text-modal-head">
              <strong>AI workflow — hiểu toàn bộ sơ đồ hiện tại</strong>
              <button type="button" className="wf-node-inline-close" onClick={() => setExpanded(false)}>
                <Minimize2 size={13} /> Thu nhỏ
              </button>
            </div>
            <div className="wf-copilot-chat-log wf-copilot-chat-log-expanded">{chatLog}</div>
            {chatInputRow}
          </div>
        </div>
      )}
    </div>
  )
}
