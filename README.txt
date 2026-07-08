WEB APP "FLOWER COWGIRL CAMERA" - LAUREA GIULIA & VALENTINA

Configurazione attuale:
- Cloud name: wlpujejk
- Upload preset: wmrzqarx
- Scatti massimi per dispositivo/browser: 20
- Titolo: Laurea di Giulia & Valentina
- Cartella Cloudinary: laurea-giulia-valentina
- Stile: floreale, country, rosa/crema, dettagli hip hop/swag

Cosa fa:
- ogni ospite apre il link/QR dal telefono;
- inserisce il nome;
- può scattare massimo 20 foto dallo stesso browser/dispositivo;
- le foto vengono caricate su Cloudinary.

IMPORTANTE:
Il limite è lato telefono/browser tramite localStorage. Per una festa privata va bene, ma non è un blocco anti-furbo: se una persona cancella i dati del browser o usa un altro telefono può ripartire.

PUBBLICAZIONE RAPIDA CON GITHUB PAGES

1) Estrai questo ZIP.
2) Apri GitHub e crea un repository pubblico, ad esempio:
   Laurea-di-Giulia-e-Valentina
3) Carica nella root del repository questi file, NON la cartella intera:
   - index.html
   - style.css
   - app.js
   - config.js
   - README.txt
4) Vai in Settings > Pages.
5) In Build and deployment seleziona:
   Source: Deploy from a branch
   Branch: main
   Folder: / root
6) Salva.
7) Dopo la pubblicazione avrai un link tipo:
   https://tuonome.github.io/Laurea-di-Giulia-e-Valentina/
8) Apri il link da telefono e fai una foto di test.
9) Se funziona, genera un QR code con quel link.

DOVE TROVI LE FOTO
- Vai su Cloudinary > Media Library.
- Cerca la cartella laurea-giulia-valentina oppure controlla gli upload più recenti.

COME CAMBIARE IL NUMERO DI FOTO
Apri config.js e modifica:
  maxShots: 20,

COME CAMBIARE IL TITOLO
Apri config.js e modifica:
  eventTitle: "Laurea di Giulia & Valentina",
