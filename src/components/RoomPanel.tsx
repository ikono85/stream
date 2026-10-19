import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/Icon'
import { PROFILE_TINTS } from '@/config'
import type { WatchTogether } from '@/sync/useWatchTogether'

interface Props {
  room: WatchTogether
  code: string
  /** How this viewer appears to the others. */
  name: string
  onRename: (name: string) => void
  onClose: () => void
  onLeave: () => void
}

const STATUS_LABEL: Record<WatchTogether['status'], string> = {
  off: 'Hors salle',
  connecting: 'Connexion…',
  open: 'Connecté',
  lost: 'Connexion perdue',
}

function tint(index: number): string {
  return PROFILE_TINTS[index % PROFILE_TINTS.length] ?? PROFILE_TINTS[0]
}

export function RoomPanel({ room, code, name, onRename, onClose, onLeave }: Props) {
  const [draft, setDraft] = useState('')
  const [nameDraft, setNameDraft] = useState(name)
  const [copied, setCopied] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [room.messages.length])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  async function copyLink() {
    const link = window.location.href
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      /* Clipboard refused — the code stays on screen to read out loud. */
      setCopied(false)
    }
  }

  useEffect(() => { setNameDraft(name) }, [name])

  const waiting = room.members.length < 2
  /* Several people on the same profile name need telling apart. */
  const clash = room.members.filter((m) => m.name === name).length > 1

  function commitName() {
    const next = nameDraft.trim().slice(0, 24)
    if (next && next !== name) onRename(next)
    else setNameDraft(name)
  }

  return (
    <aside
      aria-label="Séance partagée"
      className="fixed inset-x-0 bottom-0 z-50 flex h-[62dvh] flex-col rounded-t-2xl border-t border-ink-600 bg-ink-900 lg:static lg:h-auto lg:w-80 lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0"
    >
      <header className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            room.status === 'open' ? 'bg-lamp-500' : room.status === 'lost' ? 'bg-red-400' : 'bg-haze-400 animate-pulse'
          }`}
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-wide text-sm font-bold text-paper">Séance partagée</h2>
          <p className="truncate text-xs text-haze-400">{STATUS_LABEL[room.status]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Masquer le panneau"
          className="grid h-8 w-8 place-items-center rounded-full text-haze-400 transition-colors hover:bg-ink-700 hover:text-paper"
        >
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className="border-b border-ink-700 p-4">
        <p className="text-xs text-haze-400">Code de la salle</p>
        <p className="mt-1 font-wide text-xl font-extrabold tracking-[0.18em] text-lamp-500 nums-tabular">
          {code}
        </p>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border border-ink-600 text-sm text-paper transition-colors hover:border-haze-400 hover:bg-ink-800"
        >
          <Icon name={copied ? 'check' : 'link'} size={15} />
          {copied ? 'Lien copié' : 'Copier le lien'}
        </button>
        {waiting && (
          <p className="mt-3 text-xs leading-relaxed text-haze-400">
            Envoyez ce lien à la personne avec qui vous regardez. Elle arrivera sur le même film,
            au même endroit.
          </p>
        )}
      </div>

      <div className="border-b border-ink-700 px-4 py-3">
        <p className="mb-2 text-xs text-haze-400">
          {room.members.length === 1 ? 'Vous êtes seul pour le moment' : `${room.members.length} personnes`}
        </p>
        <ul className="flex flex-wrap gap-2">
          {room.members.map((member) => (
            <li
              key={member.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 py-1 pl-1 pr-3 text-xs text-paper"
            >
              <span
                className="grid h-5 w-5 place-items-center rounded-full text-[0.6rem] font-bold text-ink-950"
                style={{ backgroundColor: tint(member.order) }}
              >
                {member.name.slice(0, 1).toUpperCase()}
              </span>
              {member.name}
              {member.id === room.me?.id && <span className="text-haze-400">· vous</span>}
            </li>
          ))}
        </ul>

        <form
          className="mt-3"
          onSubmit={(e) => { e.preventDefault(); commitName() }}
        >
          <label className="block text-xs text-haze-400" htmlFor="room-name">
            Votre nom dans la salle
          </label>
          <input
            id="room-name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            maxLength={24}
            className={`mt-1 h-9 w-full rounded-lg bg-ink-800 px-3 text-sm text-paper outline-none ${
              clash ? 'ring-1 ring-lamp-500' : ''
            }`}
          />
          {clash && (
            <p className="mt-1.5 text-xs text-lamp-400">
              Quelqu'un porte déjà ce nom. Changez-le pour qu'on vous distingue.
            </p>
          )}
        </form>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {room.messages.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-haze-400">
              Les messages restent entre vous et disparaissent à la fin de la séance.
            </p>
          ) : (
            <ul className="space-y-3">
              {room.messages.map((message) => (
                <li key={message.id} className={message.mine ? 'text-right' : ''}>
                  {!message.mine && (
                    <p className="mb-0.5 text-xs text-haze-400">{message.name}</p>
                  )}
                  <p
                    className={`inline-block max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm ${
                      message.mine
                        ? 'rounded-br-md bg-lamp-500 text-ink-950'
                        : 'rounded-bl-md bg-ink-700 text-paper'
                    }`}
                  >
                    {message.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-center gap-2 border-t border-ink-700 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            room.sendChat(draft)
            setDraft('')
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Écrire un message"
            aria-label="Message"
            maxLength={500}
            disabled={room.status !== 'open'}
            className="h-10 min-w-0 flex-1 rounded-full bg-ink-800 px-4 text-sm text-paper outline-none placeholder:text-haze-400/70 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={room.status !== 'open' || !draft.trim()}
            aria-label="Envoyer"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-700 text-paper transition-colors hover:bg-lamp-500 hover:text-ink-950 disabled:pointer-events-none disabled:opacity-40"
          >
            <Icon name="send" size={17} />
          </button>
        </form>
      </div>

      <button
        type="button"
        onClick={onLeave}
        className="border-t border-ink-700 px-4 py-3 text-left text-xs text-haze-400 transition-colors hover:bg-ink-800 hover:text-paper"
      >
        Quitter la séance partagée
      </button>
    </aside>
  )
}
