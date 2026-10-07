import { useEffect, useMemo, useRef, useState, type FormEvent, type WheelEvent } from 'react'
import { Archive, ArrowLeft, ArrowRightLeft, Check, CheckCheck, ChevronDown, CircleHelp, Inbox as InboxIcon, MessageCircle, PanelRightClose, PanelRightOpen, Plus, Search, Send, ShieldCheck, Wifi, WifiOff, X } from 'lucide-react'
import { createRider, getConversations, getHealth, getMessages, getNote, saveNote, sendMessage, transferConversation, type Conversation, type Message } from './api'
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

function routeWheel(event: WheelEvent<HTMLElement>, scrollerSelector: string, nativeSelector: string) {
  const target = event.target
  if (target instanceof Element && target.closest(`${nativeSelector}, input, textarea, button, a`)) return
  const scroller = event.currentTarget.querySelector<HTMLElement>(scrollerSelector)
  if (!scroller || event.deltaY === 0) return
  scroller.scrollTop += event.deltaY
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
  const [threadAccessVerified, setThreadAccessVerified] = useState(false)
  const [savingMessage, setSavingMessage] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [showCreateRider, setShowCreateRider] = useState(false)
  const [riderName, setRiderName] = useState('')
  const [riderPhone, setRiderPhone] = useState('')
  const [creatingRider, setCreatingRider] = useState(false)
  const [createRiderError, setCreateRiderError] = useState('')
  const [showTransfer, setShowTransfer] = useState(false)
  const [targetStaffId, setTargetStaffId] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [showNotePanel, setShowNotePanel] = useState(() => window.innerWidth > 1220)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const messageEndRef = useRef<HTMLDivElement>(null)
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null
  const lastInboundMs = selected?.last_inbound_at ? new Date(selected.last_inbound_at).getTime() : null
  const replyAllowed = Boolean(selected && !selected.opted_out && lastInboundMs !== null && lastInboundMs <= now && now - lastInboundMs < 24 * 60 * 60 * 1000)
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

  function clearThread() {
    setMessages([])
    setNote('')
    setNoteUpdatedAt(null)
    setThreadAccessVerified(false)
  }

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
        const latestMessages = await getMessages(selectedId)
        const savedNote = await getNote(selectedId)
        if (!active) return
        setMessages(latestMessages)
        setNote(savedNote.content)
        setNoteUpdatedAt(savedNote.updated_at)
        setThreadAccessVerified(true)
      } catch (cause) {
        if (active) {
          clearThread()
          setError(cause instanceof Error ? cause.message : 'Could not load this conversation.')
          setSelectedId(null)
        }
      } finally {
        if (active) setLoadingMessages(false)
      }
    }
    void refreshThread()
    const timer = window.setInterval(async () => {
      try {
        const latest = await getMessages(selectedId)
        if (active) {
          setMessages(latest)
          setThreadAccessVerified(true)
        }
      } catch (cause) {
        if (active) {
          clearThread()
          setError(cause instanceof Error ? cause.message : 'Could not refresh messages.')
          setSelectedId(null)
        }
      }
    }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [selectedId])

  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, selectedId])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

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

  async function handleTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const destination = targetStaffId.trim()
    if (!selected || !destination || transferring) return
    setTransferring(true)
    setTransferError('')
    setError('')
    try {
      await transferConversation(selected.id, destination)
      setConversations((current) => current.map((item) => (
        item.id === selected.id ? { ...item, assigned_staff_id: destination } : item
      )))
      clearThread()
      setSelectedId(null)
      setShowTransfer(false)
      setTargetStaffId('')
      setNotice('Conversation transferred')
    } catch (cause) {
      setTransferError(cause instanceof Error ? cause.message : 'Conversation could not be transferred.')
    } finally { setTransferring(false) }
  }

  async function handleCreateRider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (creatingRider) return
    setCreatingRider(true)
    setCreateRiderError('')
    try {
      const created = await createRider(riderName.trim(), riderPhone.trim())
      setConversations((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setSelectedId(created.id)
      setRiderName('')
      setRiderPhone('')
      setShowCreateRider(false)
      setNotice('Rider added to your inbox')
      setError('')
    } catch (cause) {
      setCreateRiderError(cause instanceof Error ? cause.message : 'Rider could not be created.')
    } finally { setCreatingRider(false) }
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

      <section className={`conversation-list ${selectedId ? 'has-selection' : ''}`} id="inbox" aria-label="Conversations" onWheel={(event) => routeWheel(event, '.conversation-items', '.conversation-items')}>
        <header className="list-header">
          <div className="eyebrow"><span className="eyebrow-dot" /> PIKIPATA / MESSAGES</div>
          <div className="list-title-row"><h1>Inbox</h1><span className="conversation-count">{conversations.length.toString().padStart(2, '0')}</span><button className="create-rider-button" type="button" onClick={() => { setShowCreateRider(true); setCreateRiderError('') }}><Plus size={14} /> Create rider</button></div>
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
            <button key={conversation.id} type="button" className={`conversation-item ${selectedId === conversation.id ? 'selected' : ''}`} onClick={() => { clearThread(); setSelectedId(conversation.id); setError('') }} style={{ animationDelay: `${Math.min(index * 35, 245)}ms` }}>
              <span className={`contact-avatar avatar-${index % 5}`}>{initials(conversation.display_name || conversation.phone)}</span>
              <span className="conversation-copy"><span className="conversation-name-row"><strong>{conversation.display_name || conversation.phone}</strong><time>{formatTime(conversation.last_inbound_at || conversation.created_at)}</time></span><span className="conversation-preview">{conversation.phone}{conversation.opted_out ? ' · opted out' : ''}</span></span>
              {selectedId === conversation.id && <span className="selection-mark" />}
            </button>
          ))}
        </div>
        <footer className="list-footer"><span><span className="live-dot" /> Updates every 10 sec</span><span>WhatsApp Cloud</span></footer>
      </section>

      <section className={`thread-panel ${selectedId ? 'thread-open' : ''}`} aria-label="Message thread" onWheel={(event) => routeWheel(event, '.message-scroll', '.message-scroll')}>
        {error && <div className="error-banner" role="alert"><CircleHelp size={16} /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
        {selected ? <>
          <header className="thread-header">
            <button className="icon-button mobile-back" type="button" onClick={() => setSelectedId(null)} title="Back to inbox" aria-label="Back to inbox"><ArrowLeft size={19} /></button>
            <span className="contact-avatar thread-avatar">{initials(selected.display_name || selected.phone)}</span>
            <div className="thread-contact"><strong>{selected.display_name || selected.phone}</strong><span>{selected.phone} <i /> {selected.opted_out ? 'Opted out' : 'WhatsApp conversation'}</span></div>
            <div className="thread-actions"><span className={`service-window ${selected.opted_out ? 'closed' : ''}`}><span />{selected.opted_out ? 'Opted out' : '24h service window'}</span><button className="transfer-chat-button" type="button" onClick={() => { setTransferError(''); setTargetStaffId(''); setShowTransfer(true) }} disabled={!threadAccessVerified} title={threadAccessVerified ? 'Transfer conversation to another caregiver' : 'Open this chat before transferring'}><ArrowRightLeft size={15} /><span>Transfer</span></button><button className="icon-button note-toggle" type="button" title={showNotePanel ? 'Hide inquiry note' : 'Show inquiry note'} aria-label={showNotePanel ? 'Hide inquiry note' : 'Show inquiry note'} onClick={() => setShowNotePanel((value) => !value)}>{showNotePanel ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}</button></div>
          </header>
          <div className="thread-date"><span /><span>Conversation</span><span /></div>
          <div className="message-scroll" aria-live="polite">
            {loadingMessages && messages.length === 0 ? <div className="thread-state"><span className="loader" /> Loading messages</div> : messages.length === 0 ? (
              <div className="thread-state empty-thread"><div className="empty-symbol"><MessageCircle size={23} /></div><strong>This conversation is just beginning</strong><span>Messages from {selected.display_name || selected.phone} will appear here.</span></div>
            ) : messages.map((message, index) => <MessageBubble key={message.id} message={message} previous={messages[index - 1]} />)}
            <div ref={messageEndRef} />
          </div>
          <div className="composer-wrap">
            {!selected.opted_out && <div className="composer-context"><ShieldCheck size={14} />{replyAllowed ? 'Replies are available inside Meta’s 24-hour service window.' : 'A reply is available after the customer messages you.'}</div>}
            <form className="composer" onSubmit={handleSend}>
              <textarea aria-label="Write a reply" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder={selected.opted_out ? 'This contact has opted out' : replyAllowed ? 'Write a reply…' : 'Waiting for an inbound message'} maxLength={4096} disabled={!replyAllowed || savingMessage} />
              <div className="composer-bottom"><span className="composer-hint">Enter to send <kbd>↵</kbd></span><div className="composer-send-row"><span className="character-count">{draft.length}/4096</span><button className="send-button" type="submit" disabled={!draft.trim() || savingMessage || !replyAllowed} aria-label="Send reply">{savingMessage ? <span className="button-spinner" /> : <><Send size={16} /> Send</>}</button></div></div>
            </form>
            <div className="composer-footnote">Messages are sent from your business WhatsApp number.</div>
          </div>
        </> : <div className="welcome-panel"><div className="welcome-graphic"><div className="graphic-line line-one" /><div className="graphic-line line-two" /><span className="graphic-bubble"><MessageCircle size={38} strokeWidth={1.4} /></span><span className="graphic-spark spark-one">✳</span><span className="graphic-spark spark-two">·</span></div><span className="eyebrow">YOUR CUSTOMER DESK</span><h2>{connection === 'offline' ? 'Connect to your inbox' : 'A little more room to listen.'}</h2><p>{connection === 'offline' ? 'Check that the backend and local API proxy are running.' : 'Choose a conversation to read the thread and reply.'}</p><span className="welcome-foot"><span className="live-dot" /> PRIVATE STAFF INBOX</span></div>}
      </section>

      {selected && showNotePanel && <aside className="note-panel" aria-label="Customer inquiry note" onWheel={(event) => routeWheel(event, '.note-editor', '.note-editor')}>
        <header className="note-header"><div><span className="eyebrow">INTERNAL ONLY</span><h2>Inquiry note</h2></div><span className="note-lock"><ShieldCheck size={16} /></span></header>
        <div className="note-contact"><span className="contact-avatar mini-avatar">{initials(selected.display_name || selected.phone)}</span><div><strong>{selected.display_name || 'Customer'}</strong><span>{selected.phone}</span></div></div>
        <label className="note-label" htmlFor="customer-note">SHARED WITH YOUR TEAM</label>
        <textarea id="customer-note" className="note-editor" value={note} onChange={(event) => setNote(event.target.value)} maxLength={20000} placeholder="Add context, follow-ups, or details to remember…" />
        <div className="note-count">{note.length.toLocaleString()} / 20,000</div>
        <div className="note-save-area"><button className="save-note-button" type="button" onClick={() => void handleSaveNote()} disabled={savingNote}>{savingNote ? <span className="button-spinner dark" /> : <Check size={16} />}{savingNote ? 'Saving…' : 'Save note'}</button><span>{noteUpdatedAt ? `Updated ${formatTime(noteUpdatedAt)}` : 'Not saved yet'}</span></div>
        <div className="note-disclaimer"><ShieldCheck size={15} /><span>Private to your team. Never sent to the customer.</span></div>
      </aside>}
      {showCreateRider && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreateRider(false) }}>
        <section className="create-rider-modal" role="dialog" aria-modal="true" aria-labelledby="create-rider-title">
          <header className="modal-header"><div><span className="eyebrow">NEW CONTACT</span><h2 id="create-rider-title">Create rider</h2></div><button className="icon-button" type="button" title="Close" aria-label="Close create rider form" onClick={() => setShowCreateRider(false)}><X size={19} /></button></header>
          <p className="modal-description">Save a rider to the inbox. They can be messaged after they contact your business on WhatsApp.</p>
          <form className="create-rider-form" onSubmit={handleCreateRider}>
            <label htmlFor="rider-name">Rider name</label>
            <input id="rider-name" name="name" autoComplete="name" value={riderName} onChange={(event) => setRiderName(event.target.value)} placeholder="e.g. Amina Otieno" minLength={1} maxLength={255} required autoFocus />
            <label htmlFor="rider-phone">WhatsApp phone number</label>
              <input id="rider-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" value={riderPhone} onChange={(event) => setRiderPhone(event.target.value)} placeholder="+254 712 345 678" pattern="\+[1-9][0-9 ]{6,22}" maxLength={24} aria-describedby="rider-phone-help" required />
            <span id="rider-phone-help" className="field-help">Include the country code, for example +254.</span>
            {createRiderError && <div className="modal-error" role="alert">{createRiderError}</div>}
            <div className="modal-actions"><button className="cancel-button" type="button" onClick={() => setShowCreateRider(false)}>Cancel</button><button className="create-submit-button" type="submit" disabled={creatingRider || !riderName.trim() || !riderPhone.trim()}>{creatingRider ? <span className="button-spinner" /> : <Plus size={15} />}{creatingRider ? 'Creating…' : 'Create rider'}</button></div>
          </form>
        </section>
      </div>}
      {showTransfer && selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !transferring) setShowTransfer(false) }}>
        <section className="create-rider-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-chat-title">
          <header className="modal-header"><div><span className="eyebrow">HAND OFF CONVERSATION</span><h2 id="transfer-chat-title">Transfer chat</h2></div><button className="icon-button" type="button" title="Close" aria-label="Close transfer dialog" disabled={transferring} onClick={() => setShowTransfer(false)}><X size={19} /></button></header>
          <p className="modal-description">Transfer <strong>{selected.display_name || selected.phone}</strong> to another customer caregiver. After transfer, you will no longer be able to read or reply to this chat.</p>
          <form className="create-rider-form" onSubmit={handleTransfer}>
            <label htmlFor="target-staff-id">Caregiver ID</label>
            <input id="target-staff-id" name="targetStaffId" autoComplete="off" value={targetStaffId} onChange={(event) => setTargetStaffId(event.target.value)} placeholder="Enter caregiver ID" maxLength={128} required autoFocus />
            <span className="field-help">Use the caregiver ID from your staff directory.</span>
            {transferError && <div className="modal-error" role="alert">{transferError}</div>}
            <div className="modal-actions"><button className="cancel-button" type="button" onClick={() => setShowTransfer(false)} disabled={transferring}>Cancel</button><button className="create-submit-button" type="submit" disabled={transferring || !targetStaffId.trim()}>{transferring ? <span className="button-spinner" /> : <ArrowRightLeft size={15} />}{transferring ? 'Transferring…' : 'Transfer chat'}</button></div>
          </form>
        </section>
      </div>}
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
