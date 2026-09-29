import { chatMarkdownToHtml } from '../../lib/chatMarkdown'

type Props = { content: string; role: 'user' | 'assistant' }

export default function ChatMessageContent({ content, role }: Props) {
  if (role === 'user') {
    return <div className="chat-md-user">{content}</div>
  }
  const html = chatMarkdownToHtml(content)
  return (
    <div
      className="chat-md-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
