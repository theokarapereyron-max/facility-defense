# V6.7.0 — transport aérien des grosses vagues

Les escouades ordinaires de la grosse vague prévues sur le toit passent désormais par un transport lourd à deux rotors. Les commandos infiltrés à l'intérieur, les fronts secondaires, les six hostiles réguliers du toit et les renforts alliés gardent leurs règles. Une seule rotation est active ; les effectifs dépassant 32 places attendent la suivante, sans augmenter le total planifié de la vague.

## Cycle

L'appareil est créé hors du bâtiment, au-delà de la portée de vue depuis tous les points du toit ; la même règle s'applique à sa suppression après le départ. Approche continue de 24 s, stationnaire si la zone est occupée, descente verticale de 8 s, ouverture de la rampe pendant 2 s, sorties espacées de 0,9 s. Chaque soldat descend effectivement la pente, s'écarte, puis rejoint son escouade et les objectifs ordinaires. La rampe reste ouverte tant qu'un passager vivant l'utilise. Fermeture en 2 s, montée en 4 s et éloignement pendant 20 s. La simulation ne dépend pas du mode d'affichage ni de la présence du joueur sur le toit.

## Cohérence

Le manifeste garde les escouades dans la file de vague jusqu'à leur sortie. Une place à bord est réservée dans la limite de population, y compris face aux garnisons et aux autres fronts. Les compteurs de vague changent à la création effective de chaque soldat ; les passagers encore attendus empêchent une victoire prématurée. Les sorties bloquées attendent sans recréer de militaires. Le chef est créé avant ses subordonnés et leurs identifiants d'escouade restent stables. La stase et les étourdissements arrêtent aussi les soldats sur la rampe. Les IA dégagent à pied la zone d'atterrissage ; le joueur peut retenir l'appareil en restant sur cette zone.

## Rendu

Modèle géométrique natif instancié : fuselage, cockpit vitré, fenêtres latérales, moteurs, échappements, pylônes, deux rotors à trois pales, roues et amortisseurs, panneaux latéraux coulissants, rampe articulée avec marches, feux et marquages. Les formes et matériaux sont locaux : aucun téléchargement de modèle ou de texture à l'arrivée. Les buffers sont réutilisés entre les images et les rotations. Les pales et l'air soufflé respectent l'option de réduction des animations. Le son de rotor dépend de la distance, s'arrête pendant la pause et libère ses nœuds au redémarrage. La vue FPS du toit possède une portée et une brume adaptées à l'approche lointaine. La 2D partage le même cycle et les mêmes effectifs.

L'affichage des gaines d'ascenseur est limité au niveau visible, afin que les niveaux souterrains ne traversent pas graphiquement le toit dans le rendu 3D de secours.

## Recette

La suite comporte 13 tests dédiés : réservation et unicité, approche et atterrissage, absence d'apparition/disparition visible aux bords du toit, zone occupée, débarquement et hiérarchie, sortie bloquée, limites de population, collisions, rotations complètes, géométrie finie, stase, audio et stabilité des buffers. Les tests existants des grosses vagues et des compteurs attendent maintenant le transport physique au lieu de supposer une insertion instantanée.

Six rendus de la scène réelle sont générés par `scripts/render-airlift-qa.mjs` : approche lointaine FPS, approche aérienne, débarquement aérien, atterrissage FPS, rampe FPS et départ FPS. Ils utilisent le moteur 3D de secours. La prévisualisation navigateur reste indisponible dans cette session ; ces contrôles ne constituent pas une recette du WebGL matériel en navigateur.
