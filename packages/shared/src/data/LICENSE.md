# `dtc-generic.json` — codes de défaut OBD-II génériques

Table `code → description` des codes de diagnostic génériques SAE (préfixes **P0/P2/P3**
powertrain, **C0** châssis, **B0** carrosserie, **U0** réseau). ~9 400 entrées.

## Source

Descriptions issues de **[`Wal33D/dtc-database`](https://github.com/Wal33D/dtc-database)**
(fichiers `data/source-data/{p,c,b,u}_codes.txt`), publié sous licence **MIT**.

Généré une fois avec :

```
for f in p_codes c_codes b_codes u_codes; do
  curl -sL "https://raw.githubusercontent.com/Wal33D/dtc-database/main/data/source-data/$f.txt"
done | grep -E '^[PCBU][0-9A-F]{4} *[-–]' \
     | # -> { "CODE": "Description", ... } trié, séparateurs compacts
```

## Réserve

La liste **faisant autorité** des codes P0xxx est la norme **SAE J2012**, sous copyright et
payante. Le fichier ci-dessus contient des descriptions **communautaires** largement
diffusées, à la formulation non identique à J2012. Usage ici : **amorce / repli** — la
description est injectée dans le prompt puis **reformulée par le modèle** pour l'utilisateur,
jamais présentée comme le texte officiel de la norme.
