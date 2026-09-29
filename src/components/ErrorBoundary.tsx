import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** Chặn lỗi render của 1 vùng để KHÔNG làm sập (đen) cả app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Nô Tì] Lỗi giao diện:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            margin: 'auto', maxWidth: 460, padding: 24, textAlign: 'center',
            color: '#ECECEF', display: 'flex', flexDirection: 'column',
            gap: 12, alignItems: 'center', justifyContent: 'center', minHeight: 240,
          }}
        >
          <div style={{ fontSize: 32 }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Phần này gặp lỗi, nhưng app vẫn chạy</h2>
          <p style={{ margin: 0, color: '#9a9aa4', fontSize: 13, wordBreak: 'break-word' }}>
            {this.state.error.message}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #2a2a31', background: '#1b1b1f', color: '#ECECEF', cursor: 'pointer' }}
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c6cff,#a855f7)', color: '#fff', cursor: 'pointer' }}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
