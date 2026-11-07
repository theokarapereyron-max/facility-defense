# V6.6.0 — retrait des machines

Les générateurs, réseaux électriques, caméras, tourelles, serveurs, ventilation, extinction automatique, radars, brouilleurs, consoles et automates de distribution sont retirés. Les ordinateurs décoratifs des bureaux et les anciens meubles représentant des machines sont également supprimés. Les anciens systèmes sont récupérables dans l'historique Git, sans module de simulation désactivé laissé dans le jeu.

La capture des salles, les portes locales, les meubles fouillables, les caisses de ravitaillement, les soins des médecins, le Core et les transports restent autonomes. Les ascenseurs utilisent les mêmes cabines, portes, boutons, temporisations et déplacements physiques ; aucune console ni alimentation ne conditionne leur accès. Les portes suivent leur propre salle. Les soldats conservent vue directe, fumée, reconnaissance consommable et rapports radio temporaires, sans caméra ni serveur. Les soins aux caisses sont progressifs et restent interrompus par les dégâts et la présence hostile.

Les consommables exclusivement liés aux machines sont retirés des catalogues, prix, aperçus et distributions : entretien technique, EMP, kit réseau et drone médical. Les trousses collectives, kits de porte et autres objets indépendants restent disponibles.

Les anciens tests qui exigeaient des machines ont été retirés ou remplacés ; les tests de combat, transports, commandes, interface, inventaire, économie et captures sont conservés. La nouvelle suite `tests/machines-removal.mjs` vérifie l'absence de dépendances résiduelles, les collisions sur trois cartes, les objets distribués, les accès aux trois ascenseurs, les portes locales, les durées de capture, les achats, les rapports radio et des batailles prolongées.

Les documents `tech-functional.md`, `specifications/tech-v1.md` et les anciens rapports `qa/tech-*` décrivent une version historique ; ils ne décrivent plus le jeu actif.

Validation : 164 tests réussis ; trois batailles de cinq minutes à graines différentes, avec 3 491 / 4 877 / 4 315 tirs et 589 / 858 / 842 changements d'étage. Quatre rendus 2D natifs et cinq rendus 3D de secours générés. L'inspection du rendu du Core a révélé un défaut d'ordre de dessin des grandes surfaces, corrigé en plaçant les sols avant les volumes ; le Core et les acteurs sont de nouveau visibles. La prévisualisation navigateur a expiré au démarrage : la vérification du DOM/CSS et du WebGL matériel dans un navigateur n'a pas été réalisée pour cette version.
