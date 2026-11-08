# Comptes joueurs V6.8.0 — analyse préparatoire

Statut : préparation uniquement ; aucun système de comptes n'est encore actif.

## Données existantes

Le moteur `lib/facility/engine.mjs` conserve localement les clés
`facility-settings-v1` et `facility-records-v1`. Les records comprennent
`best`, `played` et `completed`. Le compteur `completed` indique les parties
terminées volontairement, et ne constitue pas un nombre de victoires. Une
défaite survient lorsque le Core tombe ; le mode actuel est une défense sans
limite et ne prévoit pas de victoire. La vie, les munitions, les positions et
les améliorations de mission ne doivent pas devenir une progression durable.

## Préparation technique

Le manifeste du site ne déclare actuellement ni liaison D1 ni liaison R2.
La documentation Sites prévoit leur provisionnement via le manifeste ; leur
disponibilité effective, les quotas et les migrations restent à vérifier au
déploiement. Les comptes joueurs doivent être séparés de la connexion ChatGPT.
L'accès actuel au site est restreint : sa politique d'accès peut empêcher un
nouveau joueur d'atteindre la page de création de compte.

La simulation solo s'exécute côté navigateur : même avec validation et
identifiants de résultats uniques, les statistiques envoyées par le client ne
peuvent pas être garanties infalsifiables sans simulation faisant autorité côté
serveur. Aucune interface ou statistique fictive ne doit être publiée.
