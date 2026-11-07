# FACILITY DEFENSE — TECH V3.0

## Jouer avec les infrastructures

Le badge d’énergie affiche l’alimentation et les communications de l’étage. Cliquer ouvre la supervision. Chaque appareil indique son état, son camp, ses points de vie, sa salle de contrôle et la raison d’une indisponibilité. « Rejoindre cet équipement » pose un repère.

- **E** devant un équipement : console locale. Les actions sont revalidées au moment du clic.
- **Maintenir E** devant un appareil endommagé : réparation. Le bouton de réparation prend en charge souris, tactile et clavier.
- **M** : état des salles et appareils, contacts temporaires. Les marqueurs ennemis restent à la dernière position observée.
- **F3** : inspection de salles, unités et appareils ; cônes, portées et liens de contrôle.

La bataille continue pendant l’utilisation des consoles. Déplacement, tir, dégâts importants, mort, perte de contrôle ou relâchement interrompent la réparation. Un appareil détruit est réparé à l’arrêt : il faut ensuite le redémarrer.

## Carte et conquête

Les huit niveaux, les 160 salles, les sept boutiques et les accès verticaux restent en place. Des pièces existantes sont réaffectées, avec mobilier thématique. Toutes les salles restent conquérables pour préserver le jeu précédent.

Les pièces stratégiques (technique, boutique et Core) emploient une capture progressive sans opposition : 20 s à un occupant, 14 s à deux, 10 s dès trois. Les deux camps présents bloquent la capture. La dernière faction conserve le contrôle et les systèmes pendant la contestation. La progression abandonnée se résorbe ; les autres pièces gardent le calcul de majorité antérieur.

Une capture ennemie déclenche toujours une garnison unique de trois gardes et un officier, dans la limite d’effectif. Aucune duplication pendant la contestation. Les gardes attendent une place sûre si nécessaire. Les réapparitions et relèves restent interdites dans une salle envahie.

## Électricité

| État | Effets |
| --- | --- |
| Principal | Tous les réseaux fonctionnent si leurs consoles sont intactes et activées. |
| Secours général | Éclairage d’urgence, communications minimales, sécurité, soins, une caméra et une tourelle prioritaires par étage. Boutiques et ascenseurs secondaires coupés. |
| Générateur local armé | Plein fonctionnement de l’étage si le principal tombe, même sans secours global. |
| Relais local arrêté ou détruit | Étage isolé, appareils coupés, vision des deux camps réduite à 54 %. |

Le générateur principal et le secours se trouvent au −2, dans deux pièces distinctes. Le secours démarre automatiquement si le principal tombe. Chaque étage, toit compris, possède un générateur local. L’action « armer le secours local » prépare son fonctionnement indépendant. Arrêter un générateur d’étage isole aussi son relais, ce qui explique qu’un arrêt local coupe cet étage même si le principal fonctionne.

Le Core reste défendable sans courant ; sa restauration passive ralentit. Les escaliers restent mécaniques. Une cabine en mouvement termine son trajet même si une panne survient. Le retour du courant anime progressivement l’éclairage sur une seconde.

## Appareils et dépendances

| Système | Fonction réelle |
| --- | --- |
| 48 caméras | Cône de 90°, portée 700, scan 0,5 s, murs et portes opaques. 40 PV. Capture du contrôle sécurité : changement de camp. |
| 24 tourelles | Recherche à 0,25 s, rotation, sélection distance/danger/proximité Core, tir avec ligne de vue. 250 PV, 19 dégâts, cadence 0,48 s. |
| Sécurité | Réseau caméra, alarmes et portes électriques de l’étage. Terminal caméra 2D centré sur l’appareil sélectionné, avec validation continue des accès. |
| Contrôle tourelles | Arrêt/redémarrage du réseau de trois tourelles ; faction issue de la salle de contrôle. |
| Portes électriques | Commandes distantes depuis la sécurité ; modes ouvert, réservé au camp ou verrouillé pour tous. Types normal/sécurité/blindé/Core et modes FAIL_OPEN/FAIL_CLOSED. Une porte mécanique indépendante par pièce fermée. |
| Communications | Partage des observations du camp. Sans réseau : portée locale, marqueurs raccourcis et décisions d’officiers espacées. |
| Serveurs | Flux caméra et détection rapide. Hors service : flux indisponibles et caméras à 1 s ; renseignements moins durables. |
| Radar | Avertissement dix secondes avant une arrivée sur le toit, une grande vague ou une infiltration +2. Pas d’avertissement précoce s’il est perdu ou coupé. |
| Brouilleur | Perturbe les transmissions adverses à l’étage et aux étages adjacents. |
| Anti-incendie | Convertit les incendies en fumée après quatre secondes. |
| Ventilation | Dissipe plus rapidement la fumée. |
| Ascenseurs | Contrôle par étage, respect de l’alimentation ; les cabines secondaires peuvent être refusées au camp adverse. L’escalier demeure une alternative. |
| Armureries | +120 munitions au joueur, recharge de 40 s ; ravitaillement des PNJ proches. |
| Stations médicales | +10 PV/s à proximité et en ligne de vue, après trois secondes sans blessure, selon le camp propriétaire. |
| Ravitaillement | Soins progressifs, munitions, contrôle de faction et alimentation. |
| Facility Control +2 | Supervision des générateurs, étages, factions et appareils, sans pouvoir absolu à distance. |

Les contacts durent huit secondes avec radio et serveur, cinq sans serveur, deux sans radio. Leurs coordonnées sont figées à la dernière observation. Une caméra ennemie signale les alliés aux unités ennemies, jamais au joueur comme s’il s’agissait d’une caméra alliée.

## Dégâts et réparations

Les appareils sont touchés par les tirs et les grenades. Les équipements au sol bloquent le déplacement et les lignes de vue ; les caméras en hauteur n’obstruent pas les couloirs. Un équipement détruit ne réapparaît pas automatiquement.

Sous la moitié des PV, une caméra perd 40 % de portée ; une tourelle perd 30 % de cadence. Les réparations prennent cinq secondes pour les petits appareils, huit pour tourelles/portes, douze pour serveurs et quinze pour générateurs. Les anciennes trousses de porte restent utilisables.

## Bataille autonome

Environ 26 % des nouvelles escouades reçoivent une mission technique, les autres poursuivant les objectifs militaires existants. Les spécialistes capturent puis coupent une alimentation, réactivent les défenses capturées ou sabotent en dix secondes. Les sapeurs alliés cherchent les appareils endommagés et les générateurs arrêtés de leur étage, puis les remettent en service si leur camp sécurise la pièce.

Les officiers accordent des scores aux menaces techniques et gardent deux défenseurs sur les contrôles tourelles/générateurs, quatre sur le principal. L’urgence Core conserve sa logique dédiée. Les grades, priorités et ordres du joueur restent applicables aux spécialistes.

## Vérification et limites

Tests de simulation couvrant énergie, captures, contacts, reprise des tourelles, tirs bloqués, dégâts, accès aux consoles, réparations, portes, transport, soins, radar, brouillage, incendies, techniciens et sapeurs, plus les tests de régression du jeu. Les tests anciens de capture instantanée des salles stratégiques et de soin immédiat ont été adaptés au nouveau cahier des charges.

La simulation autonome est enregistrée dans `docs/qa/tech-autonomous.json`. Les états électriques sont recalculés sur changement ; captures à 4 Hz, caméras à 2 Hz, acquisition tourelles à 4 Hz. Les sélections de cibles utilisent la grille spatiale existante. Le contrôle visuel dans un navigateur n’a pas été possible dans cette session : aucune capture d’écran n’est présentée comme vérifiée.
