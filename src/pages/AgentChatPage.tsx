import { Navigate } from 'react-router-dom'

/** Legacy route — gộp vào khung chat thống nhất tại / */
export default function AgentChatPage() {
  return <Navigate to="/" replace />
}
