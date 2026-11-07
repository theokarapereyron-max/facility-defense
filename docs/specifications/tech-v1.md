# FACILITY DEFENSE
## Add-on V1 — TECH FONCTIONNEL
### Salles techniques, énergie, caméras, canons, portes, systèmes de sécurité et infrastructures interactives

---

# 1. OBJECTIF DE L’ADD-ON

Ajouter à FACILITY DEFENSE une véritable couche de simulation technique.

L’installation ne doit plus être simplement composée de :

- pièces ;
- couloirs ;
- escaliers ;
- ascenseurs ;
- soldats.

Elle doit maintenant contenir de nombreux équipements réellement fonctionnels.

Exemples :

- générateurs ;
- ordinateurs ;
- caméras ;
- canons automatiques ;
- consoles de sécurité ;
- systèmes de contrôle des portes ;
- systèmes d’alarme ;
- éclairage ;
- armureries ;
- distributeurs de munitions ;
- infirmeries ;
- salles de communication ;
- serveurs ;
- systèmes anti-incendie ;
- ascenseurs ;
- radars ;
- brouilleurs ;
- salles techniques.

Tous ces systèmes doivent pouvoir influencer réellement la partie.

---

# 2. PRINCIPE FONDAMENTAL

Une salle technique n’est pas seulement un décor.

Elle possède :

- une fonction ;
- éventuellement une faction qui la contrôle ;
- des équipements associés ;
- une alimentation électrique ;
- parfois une console ;
- parfois des conséquences à l’échelle de tout un étage.

Exemple :

**SECURITY CONTROL — FLOOR 1**

Si les alliés contrôlent cette salle :

- les caméras du Floor 1 travaillent pour les alliés ;
- les canons de sécurité contrôlés par cette salle tirent sur les ennemis ;
- certaines portes peuvent être contrôlées par les alliés.

Si les ennemis capturent cette salle :

- les mêmes caméras peuvent révéler les alliés ;
- les canons deviennent hostiles ;
- certaines portes peuvent être ouvertes ou verrouillées contre les défenseurs.

Ainsi, une bataille pour une salle technique peut modifier profondément la situation de tout un étage.

---

# 3. PHILOSOPHIE

Le système doit rester :

**simple techniquement**

mais :

**riche tactiquement.**

Il ne faut pas créer une simulation électrique réaliste extrêmement compliquée.

Il faut créer des règles simples, compréhensibles et cohérentes.

Le joueur doit rapidement comprendre :

> Si nous perdons cette salle, nous perdons aussi certains systèmes.

---

# 4. NOUVEAU SYSTÈME CENTRAL : CONTROL OWNERSHIP

Certaines salles deviennent :

**CONTROL ROOMS**

Elles peuvent appartenir à :

ALLY

ENEMY

NEUTRAL

CONTESTED.

Chaque salle possède :

roomOwner

captureProgress

alliesInside

enemiesInside

linkedSystems.

---

# 5. CAPTURE D’UNE SALLE

Une salle technique change de contrôle lorsque des personnages d’une faction restent à l’intérieur sans opposition.

Exemple :

alliés présents

+

aucun ennemi

→ progression vers ALLY.

Ennemis présents

+

aucun allié

→ progression vers ENEMY.

Les deux présents :

→ CONTESTED.

---

# 6. VITESSE DE CAPTURE

Éviter les captures instantanées.

Exemple :

1 personnage :

20 secondes.

2 personnages :

14 secondes.

3 personnages ou plus :

10 secondes minimum.

Ne jamais descendre sous environ 8 à 10 secondes.

Cela laisse le temps à l’autre camp d’intervenir.

---

# 7. VISUALISATION DE LA CAPTURE

Lorsqu’une salle est en cours de capture :

afficher discrètement :

SECURITY CONTROL

ALLY 68 %

ou :

ENEMY CAPTURING

██████░░░░

La salle peut également changer légèrement de couleur sur la carte tactique.

---

# 8. CONSÉQUENCE DU CONTRÔLE

Lorsqu’une salle passe à :

ALLY

tous ses équipements liés reçoivent :

controllerFaction = ALLY.

Lorsqu’elle passe à :

ENEMY

controllerFaction = ENEMY.

---

# 9. SALLES NON CAPTURABLES

Toutes les pièces n’ont pas besoin d’être capturables.

Exemples :

toilettes ;

dortoirs ;

petits bureaux ;

stockage banal.

Les salles capturables doivent être celles ayant un intérêt stratégique.

---

# 10. TYPES PRINCIPAUX DE SALLES TECHNIQUES

Prévoir notamment :

POWER ROOM

SECURITY CONTROL

CAMERA CONTROL

TURRET CONTROL

DOOR CONTROL

COMMUNICATIONS

SERVER ROOM

ARMORY

MEDICAL CENTER

SUPPLY ROOM

FIRE CONTROL

ELEVATOR CONTROL

RADAR ROOM

JAMMING ROOM.

Certaines fonctions peuvent être regroupées dans une même salle selon l’étage.

---

# 11. ARCHITECTURE TECHNIQUE GÉNÉRALE

Chaque étage doit avoir son propre petit réseau.

Exemple Floor 1 :

FloorPower1

FloorCameraNetwork1

FloorTurretNetwork1

FloorDoorNetwork1

FloorAlarmNetwork1.

Certains systèmes dépendent ensuite d’un système global.

---

# 12. SYSTÈME ÉLECTRIQUE

L’électricité devient une ressource fonctionnelle.

Créer trois niveaux :

### GLOBAL POWER

Électricité générale de toute l’installation.

### FLOOR POWER

Électricité spécifique d’un étage.

### EMERGENCY POWER

Alimentation de secours minimale.

---

# 13. LES DEUX GÉNÉRATEURS PRINCIPAUX

Au Floor -2 Infrastructure :

### MAIN GENERATOR

Générateur principal.

### BACKUP GENERATOR

Générateur général de secours.

Ces deux machines alimentent l’ensemble de la facility.

---

# 14. MAIN GENERATOR

État possible :

ONLINE

OFFLINE

DAMAGED

DESTROYED.

Lorsqu’il est ONLINE :

toute l’installation reçoit normalement son alimentation principale.

---

# 15. BACKUP GENERATOR

Le générateur de secours peut automatiquement démarrer lorsque le générateur principal tombe.

Mais il doit être moins puissant.

Il ne peut pas forcément alimenter tous les équipements.

Il fournit en priorité :

- éclairage d’urgence ;
- Core ;
- portes critiques ;
- systèmes de sécurité essentiels ;
- communications minimales.

---

# 16. PRIORITÉ DU BACKUP GENERATOR

Si seul le générateur de secours fonctionne :

certains systèmes secondaires sont coupés.

Exemple :

décoration lumineuse → OFF.

certaines boutiques → OFF.

certaines caméras → OFF.

certains canons → OFF.

ascenseurs secondaires → OFF.

Cela crée un véritable mode d’urgence.

---

# 17. GÉNÉRATEUR DE CHAQUE ÉTAGE

Chaque étage possède également :

**FLOOR GENERATOR**

Exemple :

GENERATOR FLOOR 0.

GENERATOR FLOOR 1.

GENERATOR FLOOR 2.

Le Roof peut utiliser une petite station électrique dédiée.

---

# 18. LOGIQUE DU FLOOR GENERATOR

Le générateur d’étage agit comme un relais/local backup.

Tant que :

GLOBAL POWER = ON

ou

FLOOR GENERATOR = ON

l’étage peut conserver une partie de ses fonctions.

---

# 19. EXEMPLE

Main Generator :

DESTROYED.

Backup Generator :

OFFLINE.

Floor 1 Generator :

ONLINE.

Résultat :

Floor 1 conserve :

- lumière ;
- caméras ;
- certaines portes ;
- certains canons.

Les autres étages deviennent fortement dégradés.

---

# 20. CONTRÔLE DES GÉNÉRATEURS

Les générateurs possèdent une console.

Les personnes contrôlant la salle peuvent :

START GENERATOR

STOP GENERATOR.

Les ennemis peuvent donc volontairement couper l’électricité.

Les alliés peuvent la remettre.

---

# 21. ACTION DU JOUEUR

Le joueur peut utiliser la console avec :

E.

Menu simple :

GENERATOR

STATUS : ONLINE

[E] SHUT DOWN

ou :

STATUS : OFFLINE

[E] START.

---

# 22. DESTRUCTION D’UN GÉNÉRATEUR

Les générateurs possèdent :

generatorHealth.

Exemple :

500 HP.

Ils peuvent être endommagés par :

- tirs ;
- explosions ;
- événements scénarisés.

À 0 HP :

DESTROYED.

---

# 23. DIFFÉRENCE OFFLINE / DESTROYED

OFFLINE :

peut être rallumé immédiatement depuis la console.

DESTROYED :

impossible de simplement appuyer sur un bouton.

Il faut réparer.

---

# 24. RÉPARATION

Le joueur peut réparer un générateur détruit.

Approcher.

Maintenir :

E.

Afficher :

REPAIRING GENERATOR

██████░░░░

Durée recommandée :

10 à 20 secondes.

Le joueur doit rester proche.

Un tir ou un déplacement peut interrompre l’action.

---

# 25. RÉPARATION PAR IA

Certains PNJ alliés peuvent éventuellement effectuer des réparations.

Créer un rôle simple :

ENGINEER.

Mais ce rôle peut rester rare.

Son IA peut recevoir :

REPAIR_CRITICAL_SYSTEM.

---

# 26. EFFET VISUEL D’UNE COUPURE

Lorsqu’un étage perd son alimentation :

le rendu devient plus sombre.

Ne pas faire un écran complètement noir.

Conserver :

- lumière d’urgence ;
- quelques lampes rouges ;
- panneaux ;
- flashes provenant des tirs.

L’ambiance doit devenir plus inquiétante.

---

# 27. EFFET DE GAMEPLAY DE L’OBSCURITÉ

Une coupure de courant doit réellement modifier l’IA.

Exemple normal :

visionRange = 650.

Étage sans électricité :

visionRange = 350.

Cela s’applique aux :

alliés ;

ennemis.

---

# 28. JOUEUR ET OBSCURITÉ

Le joueur voit également moins bien.

Ajouter éventuellement une petite lampe directionnelle automatique.

Pas besoin d’un système complexe de lampe torche.

---

# 29. CAMÉRAS DE SÉCURITÉ

Chaque étage possède plusieurs caméras.

Une caméra est un objet fixe.

Elle possède :

position

direction

fieldOfView

range

powerState

controllerFaction

destroyed.

---

# 30. CHAMP DE VISION CAMÉRA

Une caméra regarde dans un cône.

Exemple :

90°.

Range :

700 pixels virtuels.

Elle détecte les personnages de la faction ennemie de son propriétaire.

---

# 31. CAMÉRA ALLIÉE

Si :

controllerFaction = ALLY

elle détecte les ennemis.

Les ennemis détectés apparaissent :

- sur la minimap ;
- sur la carte tactique ;
- dans le système de connaissance des alliés.

---

# 32. CAMÉRA ENNEMIE

Si les ennemis capturent la salle de contrôle :

controllerFaction = ENEMY.

Les caméras deviennent alors dangereuses pour les alliés.

Elles peuvent détecter :

- soldats alliés ;
- joueur.

Les ennemis proches obtiennent une information sur leur position.

---

# 33. CONSÉQUENCE DE LA DÉTECTION CAMÉRA

Un ennemi détecté par une caméra alliée peut rester visible sur la carte pendant :

5 à 10 secondes.

Même s’il quitte immédiatement le cône.

Même logique pour les caméras ennemies.

---

# 34. CAMÉRAS DÉTRUISIBLES

Chaque caméra possède peu de vie.

Exemple :

cameraHealth = 40.

Elle peut être détruite.

Une caméra détruite :

ne détecte plus rien.

---

# 35. CAMÉRAS ET ÉLECTRICITÉ

Une caméra nécessite :

power = ON.

Si étage dans le noir :

caméra = OFF

sauf caméra reliée à :

EMERGENCY POWER.

---

# 36. CAMERA CONTROL ROOM

Chaque étage possède idéalement une salle :

CAMERA CONTROL.

Elle contient :

- écrans ;
- ordinateurs ;
- console centrale.

Contrôler cette salle détermine :

controllerFaction

des caméras de l’étage.

---

# 37. TERMINAL CAMÉRA DU JOUEUR

Si les alliés contrôlent la salle :

le joueur peut utiliser un ordinateur.

Appuyer E.

Afficher un écran simplifié :

CAMERA 01

CAMERA 02

CAMERA 03.

Le joueur peut changer de caméra.

Afficher temporairement la vue de cette zone.

Pour rester compatible avec Canva :

ne pas produire une véritable seconde caméra 3D.

Afficher simplement la carte 2D centrée sur la caméra concernée.

---

# 38. CANONS AUTOMATIQUES

Ajouter des tourelles de sécurité.

Nom possible :

AUTOTURRET.

Elles sont fixes.

Elles possèdent :

position

rotation

range

fireRate

damage

health

powerState

controllerFaction.

---

# 39. TOURELLE ALLIÉE

Si :

controllerFaction = ALLY

elle cherche :

ennemis.

Elle tire automatiquement.

---

# 40. TOURELLE ENNEMIE

Si :

controllerFaction = ENEMY

elle cherche :

alliés

+

joueur.

Elle tire automatiquement.

Cela rend la capture de certaines salles extrêmement dangereuse.

---

# 41. ALGORITHME DE LA TOURELLE

Toutes les 0,2 à 0,4 seconde :

chercher les cibles visibles proches.

Filtrer :

targetFaction != controllerFaction.

Calcul :

TargetScore =

proximité

+

danger

+

cibleProcheDuCore.

Choisir meilleur score.

Tourner vers cible.

Si alignée :

tirer.

---

# 42. LIGNE DE VUE DES TOURELLES

Les tourelles ne tirent pas à travers :

murs ;

portes fermées ;

objets solides.

Utiliser le même raycast que les PNJ.

---

# 43. TURRET CONTROL ROOM

Chaque étage peut posséder :

TURRET CONTROL.

Contrôler cette salle détermine la faction des tourelles de l’étage.

---

# 44. DÉSACTIVATION MANUELLE

Depuis la salle de contrôle :

le joueur peut utiliser une console.

Exemple :

TURRET NETWORK

STATUS : ACTIVE

OWNER : ALLIED

[DISABLE NETWORK]

Cela peut être utile si :

une tourelle est compromise ;

le système est instable.

---

# 45. TOURELLES DÉTRUISIBLES

Les tourelles peuvent être détruites.

Exemple :

health = 250.

Une tourelle détruite ne revient pas automatiquement.

Elle peut éventuellement être réparée.

---

# 46. SALLE DE CONTRÔLE DES PORTES

Chaque étage possède :

DOOR CONTROL.

Cette salle contrôle les principales portes sécurisées de l’étage.

---

# 47. CATÉGORIES DE PORTES

### NORMAL DOOR

Fonctionne localement.

### SECURITY DOOR

Reliée au Door Control.

### BLAST DOOR

Grande porte de sécurité.

### CORE DOOR

Très importante.

---

# 48. DOOR CONTROL ALLIÉ

Les alliés contrôlant la salle peuvent maintenir le fonctionnement normal.

Certaines portes stratégiques peuvent être :

LOCKED

UNLOCKED.

---

# 49. DOOR CONTROL ENNEMI

Les ennemis contrôlant la salle peuvent :

déverrouiller certaines portes pour faciliter leur progression ;

verrouiller certaines portes contre les alliés.

---

# 50. LIMITATION IMPORTANTE

Ne pas permettre à une faction de verrouiller absolument toutes les portes et de casser totalement la partie.

Toujours conserver :

- escaliers alternatifs ;
- voies de secours ;
- certaines portes mécaniques.

---

# 51. TERMINAL DE PORTES

Le joueur peut utiliser la console.

Afficher :

DOOR CONTROL — FLOOR 1

WEST SECURITY : LOCKED

EAST SECURITY : OPEN

STAIR ACCESS : OPEN

CORE ROUTE : LOCKED.

Commandes simples.

---

# 52. PORTES ET COUPURE DE COURANT

Selon leur type :

certaines portes passent automatiquement :

OPEN

ou :

LOCKED

lors d'une coupure.

Définir pour chaque porte :

powerFailureMode.

Exemples :

FAIL_OPEN.

FAIL_CLOSED.

---

# 53. SALLE DE SÉCURITÉ GÉNÉRALE

Certains étages peuvent regrouper plusieurs systèmes dans :

SECURITY CONTROL.

Elle peut contrôler :

- caméras ;
- alarmes ;
- une partie des portes ;
- quelques tourelles.

Cela permet d’éviter d’avoir quatre salles techniques sur tous les étages.

---

# 54. SYSTÈME DE COMMUNICATIONS

Créer une salle :

COMMUNICATIONS.

Elle influence la transmission des informations.

---

# 55. COMMUNICATIONS ALLIÉES

Si les alliés contrôlent Communications :

les détections provenant :

- soldats ;
- caméras ;
- officiers

sont rapidement partagées.

La carte tactique fonctionne normalement.

---

# 56. COMMUNICATIONS COUPÉES

Si communications OFFLINE :

un ennemi vu par un soldat n’est pas automatiquement connu de toute la base.

Réduire :

durée des marqueurs ;

portée des alertes ;

précision de la carte tactique.

---

# 57. COMMUNICATIONS ENNEMIES

Si ennemis contrôlent la salle :

ils peuvent obtenir un bonus simple :

meilleure connaissance des positions alliées détectées.

Pas besoin de simuler de vraies communications radio.

---

# 58. SERVER ROOM

Créer une ou plusieurs salles serveurs.

Fonction :

faire fonctionner :

- consoles ;
- caméras avancées ;
- carte tactique ;
- automatisations.

---

# 59. SERVER ROOM DÉTRUITE

Conséquences possibles :

caméras plus lentes ;

certaines consoles indisponibles ;

informations tactiques moins précises.

Ne pas désactiver totalement le jeu.

---

# 60. RADAR / SENSOR ROOM

Créer au Floor 2 ou Roof :

SENSOR CONTROL.

Il détecte certaines arrivées ennemies.

---

# 61. RADAR ALLIÉ

Lorsque fonctionnel :

les attaques sont annoncées plus tôt.

Exemple :

INCOMING HOSTILES — ROOFTOP

10 secondes avant arrivée.

---

# 62. RADAR HORS SERVICE

Sans radar :

l’alerte apparaît seulement lorsque :

ennemi réellement détecté.

Cela rend les attaques surprises plus dangereuses.

---

# 63. JAMMING ROOM

Ajouter éventuellement :

SIGNAL JAMMER.

Contrôlé par une salle technique.

---

# 64. BROUILLAGE ALLIÉ

Lorsque allié :

réduit légèrement la coordination ennemie.

Exemple :

certains ennemis mettent plus longtemps à recevoir un nouvel objectif.

---

# 65. BROUILLAGE ENNEMI

Lorsque contrôlé par l’ennemi :

réduit :

durée d’affichage ennemis ;

efficacité des communications alliées.

---

# 66. FIRE CONTROL

Certaines zones possèdent :

système anti-incendie.

Ajouter une salle ou console :

FIRE CONTROL.

---

# 67. INCENDIES

Certains événements peuvent provoquer :

FIRE ZONE.

Effets :

petits dégâts ;

fumée ;

vision réduite.

---

# 68. SPRINKLERS

Si Fire Control fonctionne :

le système peut automatiquement éteindre les incendies après quelques secondes.

Si système détruit :

les incendies durent davantage.

---

# 69. VENTILATION

Certaines zones techniques possèdent :

VENTILATION SYSTEM.

Fonction principalement atmosphérique mais peut affecter :

fumée ;

visibilité.

---

# 70. ELEVATOR CONTROL

Créer une salle technique permettant de contrôler les ascenseurs d’un étage ou du bâtiment.

---

# 71. CONTRÔLE ASCENSEUR

Si allié :

fonctionnement normal.

Si ennemi :

certains ascenseurs peuvent être désactivés.

Ne PAS permettre aux ennemis de supprimer tous les transports verticaux.

Les escaliers restent toujours utilisables.

---

# 72. ASCENSEUR DE SECOURS

Toujours conserver au moins :

une route verticale fiable.

Le jeu ne doit jamais devenir impossible à cause d’un ascenseur contrôlé par l’ennemi.

---

# 73. ARMURERIE

L’armurerie devient une salle réellement fonctionnelle.

Elle contient :

- munitions ;
- armes ;
- équipements.

---

# 74. ARMURERIE ALLIÉE

Si alliés contrôlent l’armurerie :

le joueur peut se réapprovisionner.

Les alliés peuvent également utiliser symboliquement ce point pour restaurer leurs munitions.

---

# 75. ARMURERIE ENNEMIE

Si ennemis contrôlent la salle :

le joueur ne peut plus utiliser le réapprovisionnement.

Les ennemis peuvent recevoir un petit bonus de ravitaillement.

Pas besoin de simuler leurs chargeurs individuellement.

---

# 76. DISTRIBUTEURS DE MUNITIONS

Ajouter de petits :

AMMO STATIONS.

Appuyer E.

Le joueur récupère une partie de ses munitions.

Cooldown recommandé :

30 à 60 secondes.

---

# 77. MEDICAL CENTER

L’infirmerie possède une fonction réelle.

Le joueur peut récupérer de la santé.

---

# 78. MEDICAL STATION

Console ou zone :

HEAL.

Restauration progressive.

Exemple :

+10 HP par seconde.

Maximum :

100.

Le joueur doit rester dans la zone.

---

# 79. INFIRMERIE CAPTURÉE

Si ennemis contrôlent la salle :

le joueur ne peut plus utiliser le soin.

Les alliés n’y reviennent plus automatiquement.

---

# 80. SUPPLY ROOM

Créer des petites salles de ravitaillement.

Elles peuvent fournir :

munitions ;

santé limitée ;

éventuellement grenades plus tard.

---

# 81. BOUTIQUES / KIOSQUES

Certaines zones de vie peuvent posséder :

SUPPLY KIOSK

CAFETERIA

VENDING AREA.

Pour la V1 Tech :

leur rôle reste simple.

Exemple :

vending machine :

petite récupération de santé.

Supply kiosk :

munitions limitées.

Pas de système économique compliqué.

---

# 82. MAIN CONTROL ROOM

Au Floor 2 :

créer une grande salle :

FACILITY CONTROL.

Elle représente le contrôle global de l’installation.

---

# 83. FACILITY CONTROL

Elle ne doit PAS donner le contrôle absolu de tous les systèmes.

Elle permet surtout :

- voir état des générateurs ;
- voir état des étages ;
- voir propriétaires des salles techniques ;
- état des ascenseurs ;
- état des communications.

---

# 84. CONSOLE GLOBALE

Interface simple :

FACILITY STATUS

MAIN POWER : ONLINE

BACKUP : STANDBY

FLOOR -2 : POWERED

FLOOR -1 : POWERED

FLOOR 0 : POWERED

FLOOR 1 : OFFLINE

FLOOR 2 : POWERED

ROOF : POWERED.

---

# 85. DÉPENDANCES ENTRE SYSTÈMES

Créer un système simple de dépendances.

Exemple :

Turret

nécessite :

POWER

+

TURRET CONTROL.

Camera

nécessite :

POWER

+

CAMERA CONTROL.

Security Door

nécessite :

POWER

+

DOOR CONTROL.

---

# 86. PAS DE DÉPENDANCES INFINIES

Éviter :

A dépend de B

B dépend de C

C dépend de D

D dépend de E.

Maximum recommandé :

2 ou 3 conditions par équipement.

---

# 87. ÉTAT UNIFIÉ D’UN APPAREIL

Chaque appareil possède :

powerAvailable

functional

destroyed

controllerFaction.

Fonction finale :

isOperational =
powerAvailable
AND functional
AND NOT destroyed.

---

# 88. HIÉRARCHIE DES DÉGÂTS

Un équipement peut être :

ONLINE

OFFLINE

DAMAGED

DESTROYED.

DAMAGED peut :

réduire ses performances.

Exemple :

caméra damaged :

range -40 %.

Tourelle damaged :

fireRate -30 %.

---

# 89. RÉPARATION GÉNÉRALE

Le joueur peut réparer certains équipements.

Équipements réparables :

générateur ;

caméra ;

tourelle ;

console ;

porte ;

serveur.

---

# 90. DURÉE DES RÉPARATIONS

Petit équipement :

3 à 6 secondes.

Tourelle :

8 secondes.

Porte :

8 secondes.

Générateur :

15 secondes.

Serveur :

12 secondes.

---

# 91. INTERRUPTION DE RÉPARATION

Réparation interrompue si :

joueur se déplace trop loin ;

joueur tire ;

joueur subit de gros dégâts.

---

# 92. INDICATION DE RÉPARATION

Afficher :

REPAIR TURRET

███████░░░

72 %.

---

# 93. IA ENNEMIE ET SALLES TECHNIQUES

Les ennemis ne doivent pas uniquement courir vers le Core.

Certains groupes peuvent recevoir des objectifs secondaires.

Exemple :

CAPTURE_SECURITY

DISABLE_POWER

CAPTURE_TURRETS

CAPTURE_DOORS.

---

# 94. PROBABILITÉ D’OBJECTIF TECHNIQUE

La majorité des ennemis garde :

CORE

comme objectif final.

Mais certaines escouades spécialisées peuvent cibler :

salle technique.

Exemple :

20 à 30 % des groupes selon la phase de partie.

---

# 95. EXEMPLE D’ATTAQUE INTELLIGENTE

Un groupe ennemi arrive Floor 1.

Objectif initial :

TURRET CONTROL.

Il capture la salle.

Les canons du Floor 1 deviennent rouges.

Ils commencent à tirer sur les alliés.

Un autre groupe ennemi avance ensuite vers le Core.

Le premier groupe reste partiellement dans la salle.

Cela crée une situation tactique émergente.

---

# 96. IA ALLIÉE ET SALLES TECHNIQUES

Les alliés doivent également comprendre la valeur des salles.

Les officiers peuvent recevoir de nouveaux scores.

Exemple :

DEFEND_POWER

RETAKE_SECURITY

DEFEND_TURRETS

REPAIR_CRITICAL_SYSTEM.

---

# 97. VALEUR STRATÉGIQUE DES SALLES

Exemple :

toilettes :

0.

Supply :

2.

Medical :

4.

Camera Control :

6.

Door Control :

7.

Turret Control :

8.

Floor Generator :

9.

Main Generator :

15.

Backup Generator :

12.

Core :

100.

---

# 98. OFFICER AI

Ajouter :

TechnicalThreatScore.

Exemple :

si Floor Generator attaqué :

+40 priorité.

Si Turret Control perdu :

+50.

Si Main Generator attaqué :

+80.

Cela peut provoquer :

REINFORCE_ZONE.

---

# 99. GARDE DES SALLES TECHNIQUES

Un officier ne doit pas envoyer absolument tous ses soldats ailleurs.

Certaines salles critiques gardent :

minimumDefenders.

Exemple :

Turret Control :

2.

Floor Generator :

2.

Main Generator :

4.

---

# 100. SYSTÈME DE CAPTURE PAR PIÈCE

Créer une structure :

ControlRoom {
id,
floor,
owner,
captureProgress,
captureTime,
linkedSystems,
strategicValue
}

Cela permet d’utiliser la même logique partout.

---

# 101. ÉTAT VISUEL DES SALLES

Une salle contrôlée par alliés :

petit indicateur bleu.

Ennemis :

rouge.

Contestée :

orange/clignotant.

Ne pas colorer tout le sol de manière agressive.

---

# 102. CARTE TACTIQUE

Ajouter les salles importantes sur M.

Icônes :

⚡ générateur

📷 caméra

🔫 tourelle

🚪 portes

📡 communications

✚ médical

▣ serveur.

---

# 103. ÉTAT SUR LA CARTE

Exemple :

bleu :

contrôle allié.

rouge :

contrôle ennemi.

gris :

hors ligne.

orange :

contesté.

---

# 104. ALERTES TECHNIQUES

Ajouter des alertes.

Exemples :

FLOOR 1 POWER LOST

TURRET CONTROL COMPROMISED

CAMERA NETWORK LOST

MAIN GENERATOR UNDER ATTACK

BACKUP GENERATOR ONLINE

SECURITY CONTROL RECAPTURED

DOOR NETWORK COMPROMISED.

---

# 105. PRIORITÉ DES ALERTES

Ne pas spammer l’écran.

Créer trois niveaux.

INFO :

CAMERA 4 DESTROYED.

WARNING :

FLOOR 1 SECURITY LOST.

CRITICAL :

MAIN GENERATOR DESTROYED.

---

# 106. AUDIO

Chaque système peut posséder un son simple.

Générateur :

bourdonnement.

Caméra :

petit servo.

Tourelle :

rotation + tir.

Console :

bip.

Coupure :

arrêt brutal + alarme.

Redémarrage :

montée électrique.

---

# 107. AMBIANCE LUMINEUSE

Électricité normale :

éclairage normal.

Power degraded :

éclairage plus faible.

Emergency :

rouge / sombre.

No Power :

très sombre.

---

# 108. MUSIQUE ADAPTATIVE

Conserver le système musical existant.

Les événements techniques peuvent ajouter des couches.

Exemple :

Main Generator perdu :

petite tension sonore.

Core + coupure électrique :

musique très intense.

---

# 109. EXEMPLE COMPLET — FLOOR 1

Floor 1 contient :

BARRACKS

MEDICAL

CAFETERIA

SECURITY CONTROL

CAMERA CONTROL

TURRET CONTROL

FLOOR GENERATOR

DOOR CONTROL.

---

# 110. ÉTAT INITIAL FLOOR 1

Allié :

Security Control.

Allié :

Turret Control.

Allié :

Generator.

Allié :

Door Control.

Résultat :

l’étage fonctionne normalement.

---

# 111. ATTAQUE FLOOR 1

Les ennemis prennent :

Generator.

Ils le coupent.

Résultat :

lumière baisse.

Caméras s’éteignent.

Tourelles arrêtent de tirer.

Portes passent en mode secours.

Vision des PNJ réduite.

---

# 112. SUITE POSSIBLE

Les ennemis prennent :

Turret Control.

Mais les tourelles restent OFF car :

pas de courant.

Puis un ennemi réactive le Generator.

Résultat :

les tourelles redémarrent.

Elles sont maintenant contrôlées par :

ENEMY.

Elles tirent donc sur les alliés.

C’est exactement le type d’interaction recherché.

---

# 113. CONTRE-ATTAQUE

Les alliés reprennent :

Turret Control.

Les tourelles changent de faction.

Elles recommencent à tirer sur les ennemis.

Sans modifier leur position.

---

# 114. EXEMPLE — MAIN POWER

Main Generator détruit.

Backup Generator démarre.

La facility passe :

EMERGENCY POWER.

Certains étages restent partiellement fonctionnels.

Floor 0 possède encore son Floor Generator.

Floor 0 est presque normal.

Floor 2 n’a plus son générateur.

Floor 2 devient sombre.

---

# 115. RÉPARATION DU MAIN GENERATOR

Le joueur atteint Floor -2.

Il maintient E.

15 secondes.

MAIN GENERATOR :

REPAIRED.

Puis :

START.

La lumière revient progressivement dans la facility.

---

# 116. EFFET DE RETOUR DU COURANT

Ne pas faire un changement instantané totalement plat.

Pendant environ 1 seconde :

les lumières se rallument secteur par secteur.

Caméras redémarrent.

Tourelles font une petite animation.

Consoles s’allument.

Excellent effet visuel pour peu de complexité.

---

# 117. RÉPARTITION PROPOSÉE — FLOOR -2

Infrastructure :

MAIN GENERATOR

BACKUP GENERATOR

CORE

SERVER ROOM

CORE SECURITY

COOLING

TECHNICAL CONTROL.

C’est l’étage le plus stratégique.

---

# 118. FLOOR -1

Logistique :

FLOOR GENERATOR

GARAGE CONTROL

DOOR CONTROL

TURRET CONTROL

ARMORY

SUPPLY

ELEVATOR CONTROL.

---

# 119. FLOOR 0

Entrée :

FLOOR GENERATOR

MAIN SECURITY

CAMERA CONTROL

DOOR CONTROL

TURRET CONTROL

CHECKPOINT CONTROL.

---

# 120. FLOOR 1

Vie militaire :

FLOOR GENERATOR

SECURITY

MEDICAL

ARMORY

CAMERA CONTROL

SUPPLY.

---

# 121. FLOOR 2

Commandement :

FLOOR GENERATOR

FACILITY CONTROL

COMMUNICATIONS

SERVER ROOM

RADAR CONTROL

SECURITY CONTROL.

---

# 122. ROOF

Roof :

ROOF POWER

RADAR

COMMUNICATIONS ANTENNA

AIR DEFENSE / TURRET CONTROL

HELIPAD CONTROL.

---

# 123. NOUVEAUX ÉVÉNEMENTS

Ajouter :

GENERATOR SABOTAGE

CAMERA NETWORK COMPROMISED

SECURITY BREACH

TURRET NETWORK HIJACKED

DOOR CONTROL LOST

COMMUNICATIONS DOWN

SERVER FAILURE

RADAR OFFLINE

MEDICAL LOST.

---

# 124. SABOTAGE

Certains groupes ennemis spécialisés peuvent atteindre un équipement.

Au lieu de simplement capturer :

ils commencent :

SABOTAGING.

Une barre apparaît.

Si terminée :

équipement prend de gros dégâts.

---

# 125. SABOTAGE VS CAPTURE

Capture :

réversible rapidement.

Sabotage :

nécessite réparation.

Cela crée deux niveaux de menace.

---

# 126. IA DES ENNEMIS SPÉCIALISÉS

Créer éventuellement :

TECH SOLDIER.

Il n’a pas besoin d’apparence complexe.

Son comportement :

chercher salle technique ;

capturer ;

couper système ;

saboter parfois.

---

# 127. PRIORITÉ DES TECH SOLDIERS

Exemple :

Main Generator

Floor Generator

Turret Control

Door Control

Camera Control.

---

# 128. PROTECTION DES TECH SOLDIERS

Les soldats classiques peuvent accompagner le Tech Soldier.

Cela crée :

petites unités d’assaut spécialisées.

---

# 129. PERFORMANCE

Les systèmes techniques ne doivent pas fonctionner à chaque frame.

Caméras :

scan toutes les 0,5 seconde.

Tourelles :

target scan toutes les 0,25 seconde.

Power :

recalcul uniquement lorsqu’un état change.

Capture room :

mise à jour 4 fois par seconde.

---

# 130. EVENT-DRIVEN POWER

Ne pas recalculer tout le réseau électrique à chaque frame.

Lorsque :

generatorState changes

appeler :

updatePowerNetwork().

Puis mettre à jour les appareils concernés.

---

# 131. EVENT-DRIVEN OWNERSHIP

Lorsque :

roomOwner changes

appeler :

updateLinkedSystems(room).

Exemple :

Turret Control devient ENEMY.

Alors seulement :

changer toutes les tourelles liées.

---

# 132. STRUCTURE D’UN SYSTÈME

Exemple :

SystemDevice {
id,
type,
floor,
position,
controllerFaction,
powerRequired,
powerState,
health,
maxHealth,
destroyed,
controlRoomId
}

---

# 133. STRUCTURE D’UN GÉNÉRATEUR

Generator {
id,
floor,
type,
state,
health,
maxHealth,
owner,
output,
repairProgress
}

---

# 134. STRUCTURE D’UNE CAMÉRA

Camera {
id,
floor,
x,
y,
angle,
fov,
range,
powerState,
owner,
health
}

---

# 135. STRUCTURE D’UNE TOURELLE

Turret {
id,
floor,
x,
y,
angle,
range,
damage,
fireRate,
health,
owner,
powerState,
target
}

---

# 136. MODE DEBUG TECHNIQUE

Ajouter au mode debug :

affichage réseau électrique ;

liens salles → systèmes ;

rayons caméras ;

rayons tourelles ;

owner des salles ;

état POWER ;

état des portes.

---

# 137. DEBUG D’UNE SALLE

Cliquer salle :

SECURITY CONTROL 1

OWNER : ALLY

POWER : ONLINE

LINKED CAMERAS : 8

LINKED TURRETS : 3

LINKED DOORS : 6.

---

# 138. DEBUG D’UN APPAREIL

Exemple :

TURRET T1-03

OWNER : ENEMY

POWER : ONLINE

HEALTH : 143 / 250

TARGET : Soldier 17

CONTROL : TURRET_ROOM_1.

---

# 139. RÈGLE ABSOLUE

Aucun équipement ne doit être uniquement décoratif s’il est présenté comme interactif.

Une caméra doit détecter.

Une tourelle doit tirer.

Un générateur doit fournir du courant.

Une console doit contrôler quelque chose.

Une armurerie doit fournir des munitions.

Une infirmerie doit soigner.

---

# 140. RÈGLE DE LISIBILITÉ

Le joueur ne doit pas avoir besoin de comprendre un système électrique complexe.

La logique doit être :

POWER

↓

CONTROL ROOM

↓

DEVICE.

Exemple :

Power ON

+

Turret Control ALLY

=

Turret ALLY ACTIVE.

---

# 141. RÈGLE DE GAMEPLAY

La couche technique doit créer des choix.

Exemple :

Le Core est attaqué.

Mais Turret Control vient d’être perdu.

Le joueur doit choisir :

aller immédiatement au Core

ou

reprendre Turret Control pour récupérer trois canons automatiques.

Les deux choix doivent pouvoir être valables.

---

# 142. RÈGLE DE BATAILLE AUTONOME

Les PNJ doivent être capables de :

capturer ;

défendre ;

reprendre

les salles techniques sans intervention du joueur.

Le joueur participe au système.

Il ne doit pas être indispensable à son fonctionnement.

---

# 143. RÈGLE POUR LES OFFICIERS

Les officiers doivent tenir compte des équipements techniques.

Exemple :

Main Generator menacé :

priorité très élevée.

Camera Control perdu alors qu’aucun ennemi proche du Core :

priorité moyenne.

Turret Control ennemi sur étage très attaqué :

priorité élevée.

---

# 144. RÈGLE POUR LES ENNEMIS

Tous les ennemis ne doivent PAS automatiquement courir vers la salle technique la plus importante.

Utiliser plusieurs objectifs.

Sinon :

le jeu deviendrait prévisible.

---

# 145. TEST POWER

Couper Floor Generator.

Vérifier :

lumière ;

caméras ;

tourelles ;

portes ;

vision IA.

---

# 146. TEST MAIN GENERATOR

Détruire Main Generator.

Vérifier :

Backup démarre.

Facility passe Emergency Power.

---

# 147. TEST TOTAL BLACKOUT

Désactiver :

Main Generator

+

Backup Generator

+

Floor Generator.

Vérifier :

étage sombre ;

vision réduite ;

appareils OFF ;

jeu toujours jouable.

---

# 148. TEST CAMÉRA

Ennemi entre dans cône caméra alliée.

Il doit :

être détecté ;

apparaître sur carte.

Détruire caméra.

Il ne doit plus être détecté.

---

# 149. TEST TURRET

Tourelle ALLY.

Ennemi entre.

Elle tire.

Capturer Turret Control avec ennemis.

Même tourelle doit maintenant tirer sur les alliés.

---

# 150. TEST DOOR CONTROL

Enemy capture Door Control.

Vérifier :

portes stratégiques changent de comportement.

Mais :

au moins une route alternative doit rester disponible.

---

# 151. TEST RÉPARATION

Détruire générateur.

Joueur maintient E.

Réparation.

Redémarrage.

Systèmes liés se rallument.

---

# 152. TEST BATAILLE AUTONOME TECH

Ne pas toucher au joueur.

Observer pendant plusieurs minutes.

Un groupe ennemi doit pouvoir :

capturer une salle ;

modifier des systèmes ;

provoquer une réaction alliée ;

être contre-attaqué ;

perdre éventuellement la salle.

La simulation doit continuer seule.

---

# 153. ORDRE DE DÉVELOPPEMENT CONSEILLÉ

## PHASE TECH 1

ControlRoom générique.

Capture allié / ennemi.

---

## PHASE TECH 2

Floor Generator.

Éclairage.

Vision réduite.

---

## PHASE TECH 3

Main Generator.

Backup Generator.

Power global.

---

## PHASE TECH 4

Caméras.

Détection.

Carte tactique.

---

## PHASE TECH 5

Tourelles.

Changement de faction.

---

## PHASE TECH 6

Door Control.

Portes de sécurité.

---

## PHASE TECH 7

Réparations.

Destruction.

---

## PHASE TECH 8

Armurerie.

Medical.

Supply.

---

## PHASE TECH 9

Communications.

Radar.

Servers.

---

## PHASE TECH 10

IA ennemie spécialisée.

IA officiers adaptée.

---

## PHASE TECH 11

Ajout massif de salles techniques dans les six niveaux.

---

## PHASE TECH 12

Debug.

Optimisation.

Équilibrage.

---

# 154. RÉSULTAT RECHERCHÉ

Avant l’add-on :

une salle existe principalement parce qu’elle appartient à la carte.

Après l’add-on :

une salle peut devenir un enjeu militaire.

Exemple :

**GENERATOR ROOM**

ce n’est plus seulement une jolie pièce contenant un générateur.

Perdre cette salle peut :

plonger un étage dans le noir ;

désactiver les caméras ;

désactiver les tourelles ;

perturber les portes ;

réduire la vision des deux camps.

---

# 155. VISION FINALE

L’installation doit maintenant donner l’impression d’être une véritable machine.

Chaque étage contient :

électricité ;

sécurité ;

surveillance ;

défenses ;

portes ;

communications ;

logistique.

Les combats doivent pouvoir modifier cette machine.

Une bataille ne doit donc plus seulement être :

**alliés contre ennemis.**

Elle devient aussi :

**qui contrôle l’infrastructure ?**

Un ennemi peut prendre une salle de sécurité.

Les caméras changent de camp.

Une tourelle alliée devient hostile.

Un générateur est saboté.

Le couloir passe dans le noir.

Les soldats voient moins loin.

Une porte blindée se verrouille.

Les alliés changent d’itinéraire.

Un officier décide de lancer une contre-attaque.

Le joueur traverse l’étage sombre.

Il reprend le générateur.

Il le répare.

Il rallume le courant.

Les lumières reviennent.

Les caméras redémarrent.

Les tourelles alliées reprennent le feu.

Et toute la bataille change.

C’est exactement l’objectif de l’add-on :

**transformer la facility elle-même en acteur de la bataille.**