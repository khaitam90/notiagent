import { Clapperboard, FileText, Sparkles, UserCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PRO_FLOWS, type ProFlowId } from '../../lib/studioProFlows'

type Props = {
  onStartFlow: (flow: ProFlowId) => void
}

/** Landing đơn giản — flow chính nằm trong StudioProWorkspace (CapCut-style) */
export default function StudioProLanding({ onStartFlow }: Props) {
  return (
    <div className="sh-pro">
      <header className="sh-pro-head">
        <Sparkles size={28} />
        <div>
          <h2>Studio Pro</h2>
          <p>Chat AI + canvas — giống CapCut AI Creator Studio</p>
        </div>
      </header>

      <div className="sh-pro-cards">
        {PRO_FLOWS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="sh-pro-card"
            onClick={() => onStartFlow(f.id)}
          >
            <f.icon size={36} strokeWidth={1.25} />
            <h3>{f.title} {f.titleHighlight}</h3>
            <p>{f.desc}</p>
            <span className="sh-pro-cta">Bắt đầu →</span>
          </button>
        ))}
      </div>

      <div className="sh-pro-or">HOẶC</div>
      <p className="sh-pro-hint">Nhấp đúp canvas — mở trình biên tập timeline đầy đủ</p>
      <Link to="/studio/editor" className="sh-pro-editor-link">
        Mở Timeline Editor (CapCut) →
      </Link>

      <p className="sh-pro-ref">
        Tham khảo:{' '}
        <a href="https://www.capcut.com/ai-creator/studio" target="_blank" rel="noreferrer">
          CapCut AI Creator Studio
        </a>
      </p>
    </div>
  )
}

export { PRO_FLOWS as STUDIO_PRO_FLOWS }
