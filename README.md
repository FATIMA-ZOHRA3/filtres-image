# JS contre WebAssembly : filtres image sur mobile

Démo du module Web mobile. Quatre filtres (flou gaussien, contours Sobel, sépia, niveaux de gris) sont écrits **deux fois** : en JavaScript (`src/filters.js`) et en AssemblyScript compilé en WebAssembly (`assembly/index.ts`). La page applique le même filtre à la même image et chronomètre chaque version avec `performance.now()`.

## Lancer la démo

```bash
npm install        # installe le compilateur AssemblyScript
npm run build      # compile assembly/index.ts -> build/filtre.wasm (déjà fourni)
npm test           # vérifie que JS et Wasm donnent exactement les mêmes pixels
npm start          # sert la page sur http://localhost:8080
```

`npm start` affiche aussi une adresse du type `http://192.168.x.x:8080` : ouvrez-la sur votre téléphone (même Wi-Fi) pour mesurer sur un vrai mobile.

## Structure

| Fichier | Rôle |
|---|---|
| `assembly/index.ts` | Filtres en AssemblyScript (source du `.wasm`) |
| `build/filtre.wasm` | Module compilé, chargé par la page |
| `src/filters.js` | Mêmes filtres en JavaScript |
| `src/wasm.js` | Chargement du `.wasm` et gestion de la mémoire |
| `src/app.js` | Interface : image, chronométrage, historique |
| `test/test.mjs` | Test d'égalité JS/Wasm + chronométrage sous Node |
| `server.mjs` | Serveur statique sans dépendance |

## Comment ça marche

1. L'image est dessinée dans un `<canvas>`, puis lue avec `getImageData` (tableau RGBA).
2. **JS** : la fonction travaille directement sur le tableau.
3. **Wasm** : les pixels sont copiés dans la mémoire linéaire du module, la fonction exportée est appelée avec des pointeurs, puis le résultat est recopié.
4. Les deux versions utilisent la même arithmétique entière : les résultats sont identiques pixel par pixel (affiché dans l'interface et vérifié par `npm test`).
5. Un tour d'échauffement est exécuté avant la mesure, puis la moyenne de N répétitions est affichée.

## Conseils pour la présentation

- Utilisez le **flou gaussien** avec un grand rayon : c'est le filtre le plus lourd, donc celui où l'écart est le plus net.
- Les filtres simples (gris, sépia) montrent un écart faible : c'est normal, le coût est surtout la copie des pixels. C'est un bon exemple de « n'utiliser Wasm que pour les parties lourdes ».
- Notez le modèle du téléphone, la taille de l'image et le navigateur à côté de vos chiffres. Les résultats varient d'un appareil à l'autre : annoncez ceux que vous mesurez, pas ceux d'un autre.
- Prévoyez une vidéo de secours de la démo.

## Déployer (GitHub Pages ou Netlify)

Le dossier est un site statique : publiez-le tel quel (le fichier `build/filtre.wasm` doit être inclus). Le HTTPS est fourni par l'hébergeur ; générez un QR code vers l'URL pour que le public teste sur son téléphone.
