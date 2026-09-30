import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Archive, ArrowLeft, Check, CheckCheck, ChevronDown, CircleHelp, Inbox as InboxIcon, MessageCircle, PanelRightClose, PanelRightOpen, Search, Send, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import { getConversations, getHealth, getMessages, getNote, saveNote, sendMessage, type Conversation, type Message } from './api'
import './App.css'

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

function formatTime(value: string | null) {
  if (!value) return 'No recent activity'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toDateString() === new Date().toDateString()
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [note, setNote] = useState('')
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all')
  const [connection, setConnection] = useState<'checking' | 'connected' | 'offline'>('checking')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [savingMessage, setSavingMessage] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [showNotePanel, setShowNotePanel] = useState(() => window.innerWidth > 1220)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const messageEndRef = useRef<HTMLDivElement>(null)
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return conversations.filter((conversation) => {
      const open = !conversation.opted_out
      const matchesFilter = filter === 'all' || (filter === 'open' ? open : !open)
      const matchesSearch = !query || [conversation.display_name ?? '', conversation.phone, conversation.lms_user_id ?? '']
        .some((value) => value.toLowerCase().includes(query))
      return matchesFilter && matchesSearch
    })
  }, [conversations, filter, search])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const [health, latest] = await Promise.all([getHealth(), getConversations()])
        if (!active) return
        setConnection(health.ok ? 'connected' : 'offline')
        setConversations(latest)
        setError('')
      } catch (cause) {
        if (!active) return
        setConnection('offline')
        setError(cause instanceof Error ? cause.message : 'Could not connect to the inbox API.')
      } finally {
        if (active) setLoadingConversations(false)
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      setNote('')
      setNoteUpdatedAt(null)
      return
    }
    let active = true
    const refreshThread = async () => {
      setLoadingMessages(true)
      try {
        const [latestMessages, savedNote] = await Promise.all([getMessages(selectedId), getNote(selectedId)])
        if (!active) return
        setMessages(latestMessages)
        setNote(savedNote.content)
        setNoteUpdatedAt(savedNote.updated_at)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load this conversation.')
      } finally {
        if (active) setLoadingMessages(false)
      }
    }
    void refreshThread()
    const timer = window.setInterval(async () => {
      try {
        const latest = await getMessages(selectedId)
        if (active) setMessages(latest)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not refresh messages.')
      }
    }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [selectedId])

  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, selectedId])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!selected || !text || savingMessage) return
    setSavingMessage(true)
    setError('')
    try {
      await sendMessage(selected.id, text)
      setDraft('')
      setNotice('Reply sent')
      setMessages(await getMessages(selected.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your reply could not be sent.')
    } finally { setSavingMessage(false) }
  }

  async function handleSaveNote() {
    if (!selected || savingNote) return
    setSavingNote(true)
    setError('')
    try {
      const saved = await saveNote(selected.id, note)
      setNote(saved.content)
      setNoteUpdatedAt(saved.updated_at)
      setNotice('Note saved')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your note could not be saved.')
    } finally { setSavingNote(false) }
  }

  return (
    <main className="desk-shell">
      <aside className="app-rail" aria-label="Main navigation">
        <a className="brand-mark" href="#inbox" aria-label="Fieldnote inbox"><MessageCircle size={22} strokeWidth={2.3} /><span className="brand-spark" /></a>
        <div className="rail-divider" />
        <button className="rail-button is-active" type="button" title="Inbox" aria-label="Inbox"><InboxIcon size={20} /><span className="rail-indicator" /></button>
        <button className="rail-button" type="button" title="Show closed conversations" aria-label="Show closed conversations" onClick={() => setFilter('closed')}><Archive size={19} /></button>
        <div className="rail-spacer" />
        <span className="rail-button" title={connection === 'connected' ? 'API connected' : 'API offline'} aria-label={connection === 'connected' ? 'API connected' : 'API offline'}>{connection === 'connected' ? <Wifi size={19} /> : <WifiOff size={19} />}</span>
        <div className="staff-avatar" title="Staff workspace">A</div>
      </aside>

      <section className={`conversation-list ${selectedId ? 'has-selection' : ''}`} id="inbox" aria-label="Conversations">
        <header className="list-header">
          <div className="eyebrow"><span className="eyebrow-dot" /> PIKIATA / MESSAGES</div>
          <div className="list-title-row"><h1>Inbox</h1><span className="conversation-count">{conversations.length.toString().padStart(2, '0')}</span></div>
          <div className={`connection-pill ${connection}`}><span className="connection-dot" />{connection === 'connected' ? 'Connected' : connection === 'checking' ? 'Connecting' : 'Offline'}<ChevronDown size={13} /></div>
          <label className="search-box"><Search size={17} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or number" aria-label="Search conversations" /><kbd>/</kbd></label>
          <div className="filter-tabs" role="tablist" aria-label="Conversation filters">
            {(['all', 'open', 'closed'] as const).map((value) => <button key={value} className={filter === value ? 'selected' : ''} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'open' ? 'Open' : 'Closed'}{value === 'open' && <span className="tab-count">{conversations.filter((item) => !item.opted_out).length}</span>}</button>)}
          </div>
        </header>
        <div className="conversation-items">
          {loadingConversations && conversations.length === 0 ? <div className="list-state"><span className="loader" /> Loading conversations</div> : filteredConversations.length === 0 ? (
            <div className="list-state empty-list-state"><div className="empty-symbol"><MessageCircle size={21} /></div><strong>{search ? 'No matching conversations' : 'Nothing here yet'}</strong><span>{search ? 'Try another name or number.' : 'New WhatsApp messages will show up here.'}</span></div>
          ) : filteredConversations.map((conversation, index) => (
            <button key={conversation.id} type="button" className={`conversation-item ${selectedId === conversation.id ? 'selected' : ''}`} onClick={() => { setSelectedId(conversation.id); setError('') }} style={{ animationDelay: `${Math.min(index * 35, 245)}ms` }}>
              <span className={`contact-avatar avatar-${index % 5}`}>{initials(conversation.display_name || conversation.phone)}</span>
              <span className="conversation-copy"><span className="conversation-name-row"><strong>{conversation.display_name || conversation.phone}</strong><time>{formatTime(conversation.last_inbound_at || conversation.created_at)}</time></span><span className="conversation-preview">{conversation.phone}{conversation.opted_out ? ' · opted out' : ''}</span></span>
              {selectedId === conversation.id && <span className="selection-mark" />}
            </button>
          ))}
        </div>
        <footer className="list-footer"><span><span className="live-dot" /> Updates every 10 sec</span><span>WhatsApp Cloud</span></footer>
      </section>

      <section className={`thread-panel ${selectedId ? 'thread-open' : ''}`} aria-label="Message thread">
        {error && <div className="error-banner" role="alert"><CircleHelp size={16} /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
        {selected ? <>
          <header className="thread-header">
            <button className="icon-button mobile-back" type="button" onClick={() => setSelectedId(null)} title="Back to inbox" aria-label="Back to inbox"><ArrowLeft size={19} /></button>
            <span className="contact-avatar thread-avatar">{initials(selected.display_name || selected.phone)}</span>
            <div className="thread-contact"><strong>{selected.display_name || selected.phone}</strong><span>{selected.phone} <i /> {selected.opted_out ? 'Opted out' : 'WhatsApp conversation'}</span></div>
            <div className="thread-actions"><span className={`service-window ${selected.opted_out ? 'closed' : ''}`}><span />{selected.opted_out ? 'Opted out' : '24h service window'}</span><button className="icon-button note-toggle" type="button" title={showNotePanel ? 'Hide inquiry note' : 'Show inquiry note'} aria-label={showNotePanel ? 'Hide inquiry note' : 'Show inquiry note'} onClick={() => setShowNotePanel((value) => !value)}>{showNotePanel ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}</button></div>
          </header>
          <div className="thread-date"><span /><span>Conversation</span><span /></div>
          <div className="message-scroll" aria-live="polite">
            {loadingMessages && messages.length === 0 ? <div className="thread-state"><span className="loader" /> Loading messages</div> : messages.length === 0 ? (
              <div className="thread-state empty-thread"><div className="empty-symbol"><MessageCircle size={23} /></div><strong>This conversation is just beginning</strong><span>Messages from {selected.display_name || selected.phone} will appear here.</span></div>
            ) : messages.map((message, index) => <MessageBubble key={message.id} message={message} previous={messages[index - 1]} />)}
            <div ref={messageEndRef} />
          </div>
          <div className="composer-wrap">
            {!selected.opted_out && <div className="composer-context"><ShieldCheck size={14} /> Replies are available inside Meta’s 24-hour service window.</div>}
            <form className="composer" onSubmit={handleSend}>
              <textarea aria-label="Write a reply" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder={selected.opted_out ? 'This contact has opted out' : 'Write a reply…'} maxLength={4096} disabled={selected.opted_out || savingMessage} />
              <div className="composer-bottom"><span className="composer-hint">Enter to send <kbd>↵</kbd></span><div className="composer-send-row"><span className="character-count">{draft.length}/4096</span><button className="send-button" type="submit" disabled={!draft.trim() || savingMessage || selected.opted_out} aria-label="Send reply">{savingMessage ? <span className="button-spinner" /> : <><Send size={16} /> Send</>}</button></div></div>
            </form>
            <div className="composer-footnote">Messages are sent from your business WhatsApp number.</div>
          </div>
        </> : <div className="welcome-panel"><div className="welcome-graphic"><div className="graphic-line line-one" /><div className="graphic-line line-two" /><span className="graphic-bubble"><MessageCircle size={38} strokeWidth={1.4} /></span><span className="graphic-spark spark-one">✳</span><span className="graphic-spark spark-two">·</span></div><span className="eyebrow">YOUR CUSTOMER DESK</span><h2>{connection === 'offline' ? 'Connect to your inbox' : 'A little more room to listen.'}</h2><p>{connection === 'offline' ? 'Check that the backend and local API proxy are running.' : 'Choose a conversation to read the thread and reply.'}</p><span className="welcome-foot"><span className="live-dot" /> PRIVATE STAFF INBOX</span></div>}
      </section>

      {selected && showNotePanel && <aside className="note-panel" aria-label="Customer inquiry note">
        <header className="note-header"><div><span className="eyebrow">INTERNAL ONLY</span><h2>Inquiry note</h2></div><span className="note-lock"><ShieldCheck size={16} /></span></header>
        <div className="note-contact"><span className="contact-avatar mini-avatar">{initials(selected.display_name || selected.phone)}</span><div><strong>{selected.display_name || 'Customer'}</strong><span>{selected.phone}</span></div></div>
        <label className="note-label" htmlFor="customer-note">SHARED WITH YOUR TEAM</label>
        <textarea id="customer-note" className="note-editor" value={note} onChange={(event) => setNote(event.target.value)} maxLength={20000} placeholder="Add context, follow-ups, or details to remember…" />
        <div className="note-count">{note.length.toLocaleString()} / 20,000</div>
        <div className="note-save-area"><button className="save-note-button" type="button" onClick={() => void handleSaveNote()} disabled={savingNote}>{savingNote ? <span className="button-spinner dark" /> : <Check size={16} />}{savingNote ? 'Saving…' : 'Save note'}</button><span>{noteUpdatedAt ? `Updated ${formatTime(noteUpdatedAt)}` : 'Not saved yet'}</span></div>
        <div className="note-disclaimer"><ShieldCheck size={15} /><span>Private to your team. Never sent to the customer.</span></div>
      </aside>}
      {notice && <div className="toast" role="status"><CheckCheck size={17} />{notice}</div>}
    </main>
  )
}

function MessageBubble({ message, previous }: { message: Message; previous?: Message }) {
  const outbound = message.direction === 'outbound'
  const sameDirection = previous?.direction === message.direction
  const content = message.body || (message.kind === 'unsupported' ? 'Unsupported message type' : 'Template message')
  return <article className={`message-row ${outbound ? 'outbound' : 'inbound'} ${sameDirection ? 'grouped' : ''}`}>
    {!outbound && <span className={`message-avatar ${sameDirection ? 'ghost' : ''}`}>{message.kind === 'unsupported' ? '·' : 'C'}</span>}
    <div className="message-content">{!outbound && !sameDirection && <span className="message-sender">Customer</span>}<div className="message-bubble">{content}</div><div className="message-meta"><time>{formatTime(message.created_at)}</time>{outbound && <span className="message-status">{message.status === 'read' ? <CheckCheck size={14} /> : <Check size={14} />}{message.status}</span>}</div></div>
  </article>
}

export default App
