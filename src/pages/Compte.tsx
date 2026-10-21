import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import {
  changeMotDePasse, connexion, deconnexion, inscription, supprimeMonCompte,
  ErreurCompte,
} from '@/lib/compte'

/**
 * LES COMPTES, CÔTÉ ÉCRAN
 * =======================
 * Le site est ouvert : ces pages ne barrent la route à personne. Un compte
 * sert à retrouver sa liste et ses reprises sur un autre appareil, et c'est
 * exactement ce que les pages disent — promettre autre chose serait mentir.
 */

function Cadre({ titre, sous, children }: { titre: string; sous: string; children: ReactNode }) {
  return (
    <PageTransition>
      <div className="gutter mx-auto flex min-h-[70vh] max-w-[90rem] items-center justify-center py-24">
        <div className="w-[min(26rem,100%)]">
          <h1 className="font-wide text-2xl font-extrabold leading-tight text-paper">{titre}</h1>
          <p className="mt-2 text-sm leading-relaxed text-haze-400">{sous}</p>
          {children}
        </div>
      </div>
    </PageTransition>
  )
}

const champ = 'h-12 w-full rounded-[var(--radius-panel)] border border-ink-600 bg-ink-900 px-4 text-paper outline-none transition-colors focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-lamp-500'
const bouton = 'inline-flex h-12 w-full items-center justify-center rounded-full bg-lamp-500 font-semibold text-ink-950 transition-colors hover:bg-lamp-400 disabled:opacity-60'

function Erreur({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-panel)] border border-[#D1563F]/40 bg-[#D1563F]/10 p-3 text-sm text-[#F0B7A8]">
      <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

/* ---------- connexion ---------- */

export function Connexion() {
  const { rafraichisCompte } = useLibrary()
  const navigate = useNavigate()
  const [nom, setNom] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function envoie(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await connexion(nom, motDePasse)
      await rafraichisCompte()
      navigate('/')
    } catch (erreurRecue) {
      setErreur(erreurRecue instanceof ErreurCompte ? erreurRecue.message : 'La connexion a échoué.')
      setEnvoi(false)
    }
  }

  return (
    <Cadre titre="Se connecter" sous="Pour retrouver votre liste et vos reprises sur cet appareil.">
      <form onSubmit={envoie} className="mt-7 space-y-3">
        <div>
          <label htmlFor="nom" className="mb-1.5 block text-sm text-haze-400">Nom</label>
          <input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="username" autoFocus className={champ} />
        </div>
        <div>
          <label htmlFor="mdp" className="mb-1.5 block text-sm text-haze-400">Mot de passe</label>
          <input id="mdp" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="current-password" className={champ} />
        </div>
        <button type="submit" disabled={envoi || !nom || !motDePasse} className={`${bouton} !mt-5`}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <Erreur message={erreur} />

      <p className="mt-6 text-sm text-haze-400">
        Pas encore de compte ?{' '}
        <Link to="/inscription" className="text-lamp-500 underline underline-offset-2">En créer un</Link>
      </p>
      <p className="mt-2 text-xs text-haze-400">
        Mot de passe oublié ? Il n'y a pas de récupération automatique : demandez
        à la personne qui gère le site de le remettre à zéro.
      </p>
    </Cadre>
  )
}

/* ---------- inscription ---------- */

export function Inscription() {
  const { rafraichisCompte, inscriptionOuverte } = useLibrary()
  const navigate = useNavigate()
  const [nom, setNom] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function envoie(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await inscription(nom, motDePasse)
      await rafraichisCompte()
      navigate('/')
    } catch (erreurRecue) {
      setErreur(erreurRecue instanceof ErreurCompte ? erreurRecue.message : "L'inscription a échoué.")
      setEnvoi(false)
    }
  }

  if (!inscriptionOuverte) {
    return (
      <Cadre titre="Inscriptions fermées" sous="La création de comptes est suspendue pour le moment.">
        <Link to="/connexion" className={`${bouton} mt-7`}>Se connecter</Link>
      </Cadre>
    )
  }

  return (
    <Cadre
      titre="Créer un compte"
      sous="Votre liste et vos reprises vous suivront d'un appareil à l'autre."
    >
      <form onSubmit={envoie} className="mt-7 space-y-3">
        <div>
          <label htmlFor="nom" className="mb-1.5 block text-sm text-haze-400">Nom</label>
          <input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="username" autoFocus maxLength={24} className={champ} />
        </div>
        <div>
          <label htmlFor="mdp" className="mb-1.5 block text-sm text-haze-400">
            Mot de passe <span className="text-haze-400/70">— huit caractères au minimum</span>
          </label>
          <input id="mdp" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="new-password" className={champ} />
        </div>
        <button type="submit" disabled={envoi || nom.length < 2 || motDePasse.length < 8} className={`${bouton} !mt-5`}>
          {envoi ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>

      <Erreur message={erreur} />

      <p className="mt-6 text-sm text-haze-400">
        Déjà un compte ?{' '}
        <Link to="/connexion" className="text-lamp-500 underline underline-offset-2">Se connecter</Link>
      </p>
      {/* Dit une fois, clairement, au moment où la personne décide. */}
      <p className="mt-4 text-xs leading-relaxed text-haze-400">
        L'activité de votre compte — fiches ouvertes, lectures lancées, recherches — est
        enregistrée par le site, avec votre adresse IP. Vous pouvez supprimer votre compte et
        tout ce qui s'y rapporte à tout moment, depuis la page Mon compte.
      </p>
    </Cadre>
  )
}

/* ---------- mon compte ---------- */

export function MonCompte() {
  const { compte, compteEnCours, rafraichisCompte } = useLibrary()
  const navigate = useNavigate()

  const [actuel, setActuel] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmeSuppression, setConfirmeSuppression] = useState(false)

  if (compteEnCours) {
    return <Cadre titre="Mon compte" sous="Chargement…"><span /></Cadre>
  }

  if (!compte) {
    return (
      <Cadre titre="Mon compte" sous="Vous n'êtes pas connecté.">
        <Link to="/connexion" className={`${bouton} mt-7`}>Se connecter</Link>
      </Cadre>
    )
  }

  async function changeLeMotDePasse(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setMessage(null)
    try {
      await changeMotDePasse(actuel, nouveau)
      setActuel('')
      setNouveau('')
      setMessage('Mot de passe changé.')
    } catch (erreurRecue) {
      setErreur(erreurRecue instanceof ErreurCompte ? erreurRecue.message : 'Le changement a échoué.')
    }
  }

  async function partir() {
    await deconnexion()
    await rafraichisCompte()
    navigate('/')
  }

  async function supprime() {
    await supprimeMonCompte()
    await rafraichisCompte()
    navigate('/')
  }

  return (
    <Cadre titre="Mon compte" sous={`Connecté en tant que ${compte.nom}.`}>
      <form onSubmit={changeLeMotDePasse} className="mt-7 space-y-3">
        <p className="font-wide text-xs font-bold uppercase tracking-[0.14em] text-haze-400">
          Changer de mot de passe
        </p>
        <input
          type="password" value={actuel} onChange={(e) => setActuel(e.target.value)}
          placeholder="Mot de passe actuel" autoComplete="current-password" className={champ}
        />
        <input
          type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)}
          placeholder="Nouveau mot de passe" autoComplete="new-password" className={champ}
        />
        <button type="submit" disabled={!actuel || nouveau.length < 8} className={bouton}>
          Changer
        </button>
      </form>

      {message && <p className="mt-4 text-sm text-lamp-500">{message}</p>}
      <Erreur message={erreur} />

      <button
        type="button"
        onClick={() => void partir()}
        className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full border border-ink-500 font-medium text-paper transition-colors hover:border-haze-400 hover:bg-ink-800"
      >
        Se déconnecter
      </button>

      <div className="mt-10 border-t border-ink-700 pt-6">
        <p className="font-wide text-xs font-bold uppercase tracking-[0.14em] text-haze-400">
          Supprimer mon compte
        </p>
        <p className="mt-2 text-sm leading-relaxed text-haze-400">
          Votre compte, votre liste, vos reprises et toute votre activité enregistrée seront
          effacés. C'est immédiat et sans retour possible.
        </p>
        {confirmeSuppression ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void supprime()}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-[#D1563F] font-semibold text-paper transition-colors hover:bg-[#E0694F]"
            >
              Oui, tout supprimer
            </button>
            <button
              type="button"
              onClick={() => setConfirmeSuppression(false)}
              className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm text-haze-300 transition-colors hover:text-paper"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmeSuppression(true)}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-[#D1563F]/50 px-5 text-sm text-[#F0B7A8] transition-colors hover:bg-[#D1563F]/10"
          >
            Supprimer mon compte
          </button>
        )}
      </div>
    </Cadre>
  )
}
