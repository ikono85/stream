/**
 * Fabrique l'empreinte du mot de passe d'administration.
 *
 *   npm run admin:motdepasse
 *
 * Le mot de passe n'est jamais écrit nulle part : seule son empreinte scrypt
 * part dans .env, et elle ne permet pas de le retrouver. La saisie est
 * masquée quand le terminal le permet.
 */

import { createInterface } from 'node:readline'
import { empreinteMotDePasse } from '../server/admin.mjs'

function demande(question, masque = true) {
  return new Promise((resoud) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })

    if (masque && process.stdin.isTTY) {
      /* readline écrit chaque caractère tapé ; on intercepte l'écriture pour
         ne rien laisser paraître à l'écran. */
      const ecrire = rl._writeToOutput?.bind(rl)
      let premiere = true
      rl._writeToOutput = (texte) => {
        if (premiere) { ecrire?.(texte); premiere = false; return }
        if (texte.includes('\n')) ecrire?.('\n')
      }
    }

    rl.question(question, (reponse) => {
      rl.close()
      resoud(reponse)
    })
  })
}

const premier = await demande('Mot de passe d’administration : ')
if (premier.length < 8) {
  console.error('\nTrop court : huit caractères au minimum.')
  process.exit(1)
}

const second = await demande('Confirmez : ')
if (premier !== second) {
  console.error('\nLes deux saisies diffèrent.')
  process.exit(1)
}

console.log(`
Collez cette ligne dans votre fichier .env :

ADMIN_MOTDEPASSE=${empreinteMotDePasse(premier)}

Puis redémarrez le serveur. Le mot de passe lui-même n'est stocké nulle part :
cette empreinte ne permet pas de le retrouver. Si vous le perdez, relancez
simplement cette commande.
`)
