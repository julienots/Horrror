# VEILBOUND — Les Enfants du Brouillard

RPG d’aventure 2D en vue de dessus, d’exploration et de **lien** avec des créatures horrifiques originales, les **Rémanents**. Ambiance sombre, mystère central (la *Veille Blanche*), combats au tour par tour, enquête, trois fins.

Tout le contenu est original : univers, personnages, 27 Rémanents, noms, objets, interface. **Aucun asset externe** : les graphismes (tuiles, personnages, portraits, créatures, décors de combat) sont dessinés pixel par pixel par le code, et toute la musique et les sons sont synthétisés en temps réel (WebAudio). Seule ressource tierce : la police **VT323** (licence SIL Open Font, via `@fontsource/vt323`).

## Lancer le jeu

```bash
npm install
npm run dev        # serveur de développement (http://localhost:5173)
npm run build      # vérification des types + build de production dans dist/
npm run preview    # sert le build de production
```

Le build est statique (`dist/`) : il peut être hébergé tel quel sur n’importe quel serveur web.

### Application Android (APK)

Le jeu est emballé pour Android avec Capacitor (dossier `android/`) : plein écran immersif, orientation paysage, écran maintenu allumé, commandes tactiles à l’écran, icône et écran de démarrage tirés du sprite de la Veilleuse.

```bash
export ANDROID_HOME=/chemin/vers/android-sdk   # plateforme 35 + build-tools 35
npm run android                                # → android/app/build/outputs/apk/debug/app-debug.apk
```

Il faut Java 21. L’APK produit est signé avec la clé de débogage : il s’installe directement (« sources inconnues » à autoriser), mais pour une publication sur un magasin d’applications il faudra le signer avec votre propre clé.

### Contrôles

| Action | Clavier | Manette |
| --- | --- | --- |
| Se déplacer | Flèches, ZQSD (AZERTY) ou WASD (QWERTY) | Croix / stick gauche |
| Courir | Maj (maintenir) | X / RT |
| Agir, valider | Entrée, Espace, E | A |
| Retour, menu | Échap, Retour arrière, X | B |
| Menu | M, Tab | Start / Y |
| Changer d’onglet | Q / R, Page préc./suiv. | LB / RB |

Sur écran tactile, une croix directionnelle et des boutons apparaissent automatiquement.

## Tests

```bash
npm test            # 88 tests unitaires et d’intégration (Vitest, sans navigateur)
npm run smoke       # test de fumée dans Chromium : titre, intro, marche, menus, combat,
                    # sauvegarde auto, 3000 images simulées, 4 résolutions
npm run scenarios   # scénarios joués au clavier : porte, dialogue au comptoir, sommeil,
                    # cadenas à code, poursuite du Sonneur, défaite, rechargement
npm run gallery     # captures de toutes les zones (jour/nuit), des créatures et portraits
npm run check       # tout ce qui précède sauf la galerie
```

Les scripts navigateur utilisent `playwright-core` avec le Chromium de `/opt/pw-browsers` (modifiable via la variable `CHROMIUM`). Les captures sont écrites dans `test-results/`.

Ce que couvrent les tests unitaires (`tests/`) :

- **Intégrité des données** : cartes rectangulaires, tuiles connues, chaque passage mène à une case praticable, toutes les zones sont reliées entre elles et permettent de revenir au village, chaque passage et chaque entité est atteignable à pied, aucune variante horaire ne referme un chemin, toutes les références des scripts existent (objets, indices, quêtes, créatures, zones, personnages), aucun drapeau lu n’est jamais posé, chaque indice est obtenable.
- **Histoire jouable de bout en bout** (`walkthrough.test.ts`) : les trois fins sont atteintes en jouant les scripts réels (portes, clés, code, train, révélation, Institut, Seuil), plus la route alternative par la mine, les quêtes secondaires faites dans un ordre inhabituel, un combat perdu qui interrompt proprement un script, un objet ramassé avec le sac plein.
- **Combat** : combat complet, défaite, changement forcé, affinités, statuts simultanés, immunités, fuite interdite, énergie insuffisante.
- **Lien** : observer, apaiser, pacte, offrande, choix nécessitant un indice, repousser, créature impossible à lier, équipe pleine vers le Reliquaire.
- **Progression** : courbe d’expérience, apprentissage, transformations par niveau et par lien.
- **Équilibrage** (simulations) : la créature de départ gagne le début de jeu, durée moyenne des combats, l’avantage d’affinité se ressent, aucune espèce commune n’est imbattable ni sans espoir, et chaque combat imposé par l’histoire est gagnable avec une équipe plausible tout en restant exigeant (`bosses.test.ts`). Un Rémanent n’est jamais sans action (« Se débattre » quand l’énergie manque).
- **Inventaire** : objets uniques jamais dupliqués, piles et sac plein sans perte, équiper/déséquiper sans duplication, documents qui changent après certaines scènes.
- **Sauvegarde** : aller-retour, données altérées (somme de contrôle) → copie de secours, fermeture inattendue pendant l’écriture → fichier temporaire récupéré, version future refusée, réparations (position, objets inconnus, doublons, bornes), données arbitraires sans plantage.
- **Horreur** : délai global entre événements, plafonds, mode atténué.

## L’histoire (sans trop en dire)

Une lettre signée *Élise* vous fait venir à Saint-Ormel, dans la région de Vesper. Personne au village ne connaît d’Élise. La rue des Tilleuls n’a que huit numéros… le jour. Les habitants oublient des proches, et vous oublient vous aussi, chaque matin. Des Rémanents apparaissent là où la réalité s’est déchirée, trente ans plus tôt, pendant une nuit effacée de toutes les archives : la **Veille Blanche**.

Chaque révélation est préparée par des indices récupérables (lettres, cassettes, dossiers, photos, miroirs, témoignages). Le journal distingue les **objectifs actifs**, les **indices** (dont les *preuves clés*) et les **pistes non résolues**.

**Trois fins**, selon ce que vous aurez compris et révélé :
- *La Mémoire* — demande d’avoir rassemblé assez de preuves et de les avoir confiées à quelqu’un qui saura s’en souvenir ;
- *Le Sceau* ;
- *Le Brouillard*.

## Contenu

- **24 zones reliées** : le village de Saint-Ormel (5 intérieurs dont une maison qui n’existe que la nuit), la Forêt des Lacets dont les sentiers s’ouvrent après minuit, la chapelle brûlée, l’école Sainte-Brume et son couloir impossible, l’hôpital Saint-Aubin, la gare et le train de 23 h 50, le Marais des Noyés, les mines de Basse-Vesper (obscures, leviers), le quartier des Cendriers figé dans une nuit éternelle (maisons Lys et Varenne), l’Institut Halden et le Seuil Blanc.
- **27 Rémanents** (dont 8 formes transformées), chacun avec silhouette, sprite animé, statistiques, affinités, capacités, passif, cri unique, signes (signe / peur / désir), histoire, méthode de lien et comportement sur la carte. Parmi eux : *Le Pli*, *Mère-Cendre*, *Le Sonneur*, *L’Enfant du Quai*, *L’Archivore*, *Le Chien Creux*, *La Veuve de Verre*, *Le Faux-Ami*, et la *Veilleuse*, qui vous suit dès le début.
- **8 quêtes** (principale + 7 secondaires), **19 indices**, **8 pistes**, **38 objets** (soins, fils de lien, cierges, clés, outils, documents et cassettes, équipements).
- **8 affinités** : Chair, Écho, Cendre, Vide, Rêve, Verre, Racine, Signal.

### Le lien

En combat, le menu **Lien** propose :
- **Observer** : révèle tour à tour un *signe*, sa *peur*, puis son *désir* (enregistrés dans la collection) ;
- **Apaiser** (cierge) : quand elle est assez comprise et affaiblie, la créature trouve le repos et laisse un *Fragment de mémoire* (+ Lumière) ;
- **Pacte** (fil rouge / fil doré) : elle rejoint l’équipe (ou le Reliquaire si l’équipe est pleine) ;
- **Offrir un objet** : certaines créatures n’acceptent qu’un objet précis (une photographie, un ruban, un billet) ;
- **Lui répondre** : d’autres attendent une réponse — un prénom qu’il faut avoir trouvé ;
- **Repousser** : elle fuit, blessée de ne pas avoir été comprise (+ Ombre).

Certaines créatures se lient **hors combat**, par une décision (le Sonneur, l’Enfant du Quai, Mère-Cendre).

### Affinités

Règle unique : si A domine B, les attaques de A contre B font ×1,5 et celles de B contre A ×0,6. Une affinité résiste à elle-même (×0,8). Les doubles affinités se multiplient (bornées entre ×0,25 et ×2,25).

| Affinité | Domine |
| --- | --- |
| Chair | Rêve, Signal |
| Écho | Verre, Vide |
| Cendre | Racine, Chair |
| Vide | Racine, Cendre |
| Rêve | Vide, Écho |
| Verre | Signal, Cendre |
| Racine | Verre, Chair |
| Signal | Écho, Rêve |

Tout est centralisé dans `src/data/affinities.ts`.

### Horreur intégrée au jeu

Silhouettes en bord d’écran, coups derrière les murs, lumières qui vacillent, messages radio incomplets, pas derrière soi, cloches lointaines, habitants qui vous oublient, lieux qui changent selon l’heure, documents qui changent après certaines scènes, rencontres rares la nuit, une poursuite, des choix moraux. Un **directeur d’horreur** espace les événements (délai global de 45 s, plafonds par événement, jamais pendant une transition, un combat ou un dialogue) et ne modifie jamais la sauvegarde. L’Archivore « mange » visuellement des lignes du journal : c’est un simple masque d’affichage, rien n’est supprimé.

### Accessibilité

Vitesse du texte (4 niveaux), accélération des animations (×1, ×2, ×4), volumes séparés musique / effets / ambiance, grande taille de texte, réduction des flashs, réduction des secousses, intensité horrifique atténuée, contraste élevé, manette, commandes tactiles, ZQSD et WASD.

## Architecture

```
src/
  data/          Données centralisées et modifiables
    types.ts       Types de toutes les données
    affinities.ts  Table des affinités
    statuses.ts    Statuts et passifs
    abilities.ts   50 capacités
    creatures.ts   27 Rémanents
    items.ts       Objets
    story.ts       Indices, quêtes, pistes, fins
    characters.ts  Personnages (apparence, rôle, secret)
    tiles.ts       Légende des tuiles
    zones/         Cartes ASCII, passages, entités et scripts par région
  core/          État de partie, horloge, aléatoire déterministe, sauvegarde
  systems/       Logique pure (sans navigateur) : créatures et progression,
                 inventaire, quêtes et journal, conditions, interpréteur de scripts,
                 rencontres, directeur d’horreur
  battle/        Moteur de combat pur (dégâts, statuts, IA, lien)
  world/         Carte effective (variantes horaires), collisions, chemins
  render/        Pixel art procédural : tuiles, personnages, portraits, créatures, décors
  audio/         Synthèse : ambiances, musiques, effets, cris
  engine/        Entrées (clavier, manette, tactile)
  ui/            Outils de dessin de l’interface
  scenes/        Titre, exploration, dialogues, combat, menu, fins
  game.ts        Boucle, pile de scènes, effets globaux, hôte des scripts
```

La logique (`data`, `core`, `systems`, `battle`, `world`) ne dépend pas du navigateur : elle est testée directement sous Node. Les événements des zones sont des **scripts de données** (dire, choisir, donner, poser un drapeau, avancer une quête, combattre, se téléporter, poursuite, code…) exécutés par un interpréteur unique.

### Ajouter du contenu

- **Une créature** : ajouter une entrée dans `src/data/creatures.ts` et une fonction de dessin dans `src/render/creatures.ts` (sinon un sprite générique est utilisé). Les tests vérifient les références.
- **Une zone** : écrire la carte ASCII et ses passages dans `src/data/zones/`, l’ajouter à `zones/index.ts`. Les tests vérifient raccords, accessibilité et retour au village.
- **Une quête ou un indice** : `src/data/story.ts`, puis les étapes dans les scripts d’entités.

## Sauvegarde

- 3 emplacements manuels + 1 sauvegarde automatique (changement de zone, repos, toutes les 2 minutes, quand l’onglet passe en arrière-plan ou se ferme).
- Format versionné avec somme de contrôle (FNV-1a), migrations entre versions.
- Écriture en deux temps : fichier temporaire vérifié → ancienne version conservée en secours → fichier principal. En cas de fermeture pendant l’écriture ou de données altérées, la copie valide la plus récente est utilisée.
- À la lecture, l’état est validé et réparé prudemment (objets ou créatures inconnus, doublons, bornes, position dans un mur → dernier lieu de repos).
- Aucune sauvegarde n’est possible pendant une transition, un combat ou une poursuite ; une sauvegarde automatique demandée à ce moment-là est différée.
- Défaite : retour au dernier lieu de repos, équipe soignée, aucun objet perdu.

## État du projet

Le dépôt était vide au départ : le moteur choisi est **TypeScript + Vite + Canvas 2D + WebAudio**, sans moteur de jeu externe, pour que tout soit original, testable sous Node et jouable dans un navigateur.

**Terminé et vérifié** : exploration (déplacement case par case, collisions, portes, escaliers, intérieurs/extérieurs, PNJ, dialogues au comptoir, objets, cachettes accessibles par compétence), cycle jour/nuit avec lieux qui changent, rencontres, combat complet, lien, collection, progression et transformations, inventaire, équipement, quêtes, journal, carte, trois fins, sauvegarde robuste, options d’accessibilité, audio synthétisé, interface complète. Tests automatisés listés plus haut.

**Limites connues et pistes d’amélioration** (honnêtement) :
- L’équilibrage a été réglé par simulation (combats automatiques), **pas encore par des parties humaines complètes** ; la durée de jeu réelle n’a pas été mesurée.
- Les sprites des créatures ont deux images d’animation ; le Rémanent du joueur est affiché en miroir plutôt qu’avec un vrai sprite de dos.
- Les combats opposent un seul adversaire à la fois.
- La musique est procédurale et volontairement sobre ; elle n’a pas la richesse d’une bande-son composée.
- Pas de réaffectation des touches dans les options (ZQSD et WASD sont tous deux pris en charge).
- La compétence d’exploration « Écouter » est prévue dans les types mais aucune créature ne la possède encore.
- La carte de la région est schématique.
