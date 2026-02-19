import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import type { ChatMessage } from '../lib/types'

interface Props {
  messages: ChatMessage[]
  onSendMessage: (text: string) => void
  currentUserId: string
}

export default function Chat({ messages, onSendMessage, currentUserId }: Props) {
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    onSendMessage(text.trim())
    setText('')
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/10 text-sm">No messages yet</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="animate-fade-in">
            {msg.type === 'system' ? (
              <div className="flex items-center justify-center py-2">
                <span className="text-[11px] text-white/20 font-medium">{msg.text}</span>
              </div>
            ) : (
              <div className={`group flex gap-2.5 py-1.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors ${
                msg.userId === currentUserId ? '' : ''
              }`}>
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center text-sm mt-0.5">
                  {msg.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xs font-semibold ${
                      msg.userId === currentUserId ? 'text-red-400' : 'text-white/60'
                    }`}>
                      {msg.userName}
                    </span>
                    <span className="text-[10px] text-white/15 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 break-words leading-relaxed">{msg.text}</p>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-red-500/30 focus-within:bg-white/[0.05] transition-all">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
            className="flex-1 bg-transparent text-white text-sm placeholder-white/20 outline-none min-w-0"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-600/80 hover:bg-red-600 flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </form>
    </div>
  )
}
