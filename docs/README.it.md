<p align="center"><img src="../VaultSessions/icons/leaf-128.png" width="64" height="64" alt="VaultSessions"></p>
<h1 align="center">VaultSessions</h1>

<h3 align="center">Riunisci i tuoi assistenti IA.</h3>

<p align="center">
  <a href="../README.md">English</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.id.md">Indonesia</a> |
  <a href="README.pt-BR.md">Português</a> |
  <a href="README.hi.md">हिन्दी</a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=SThMHqWE1Go">
    <img src="introduction-compact.gif" alt="VaultSessions Demo" width="700">
  </a>
</p>

<p align="center">
  <a href="https://github.com/VaultFilms/VaultSessions/releases">
    <img src="https://img.shields.io/github/v/release/VaultFilms/VaultSessions?color=blue" alt="GitHub Release">
  </a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/manifest-v3-orange" alt="Manifest v3">
</p>

**Un’app per riunioni open source in cui le persone e i loro assistenti IA personali — ChatGPT, Gemini e Claude — possono pensare e collaborare insieme, sfruttando la personalizzazione esistente.**

## Funzionalità

- **Porta con te la personalità delle tue IA.** Collega le chat web ufficiali che usi già, con le conversazioni e le personalizzazioni esistenti. Non servono chiavi API per le IA.
- **Discussioni di gruppo naturali.** Le IA connesse intervengono a turno, offrono nuovi punti di vista e passano se non hanno nulla da aggiungere. Con una sola IA connessa viene fornita una sola risposta.
- **Scegli naturalmente chi risponde per primo.** Usa `@GPT`, `@ChatGPT`, `@Gemini`, `@Claude` o `To Gemini`. In assenza di indicazioni, la prima IA viene scelta casualmente.
- **Condividi il contesto visivo.** Allega o incolla fino a quattro immagini e discutine usando i loro numeri.
- **Continua a parlare mentre ChatGPT o Gemini genera immagini.** Quando viene rilevata la generazione nativa, l’IA che genera diventa temporaneamente non disponibile e puoi parlare con le altre IA connesse. Le anteprime completate appaiono accanto alla richiesta originale, senza avviare un altro giro di discussione. VS mostra anteprime compresse; gli originali sono nella chat ufficiale. Errori di generazione o recupero e timeout appaiono nel registro; l’IA torna automaticamente quando la sua chat è pronta. Tieni aperta la scheda ufficiale; l’avanzamento in background dipende dal fornitore e dal browser. Sono supportati anche codice e file SVG di Claude: VS rimuove script e riferimenti esterni e li converte in anteprime raster.
- **Condividi la pagina attuale.** Se lo desideri, fornisci il testo leggibile di una pagina come materiale di riferimento.
- **Riassumi e copia.** Genera un riepilogo da rileggere o utilizzare in una riunione futura.
- **Pannello laterale e vista estesa.** Cambia disposizione, nascondi i controlli dei partecipanti e regola il testo del registro.
- **Nove lingue dell’interfaccia.** Inglese, giapponese, francese (Francia), tedesco (Germania), spagnolo (Stati Uniti), italiano, indonesiano, portoghese (Brasile) e hindi. La scelta iniziale segue le preferenze del browser, con l’inglese come ripiego; le scelte manuali vengono ricordate. La modalità scura segue le impostazioni del browser o del sistema.

VaultSessions è una prova di fattibilità di un’interfaccia per riunioni che combina contesti e personalità di IA diversi con prospettive umane. Non è affiliato a OpenAI, Google o Anthropic e non è approvato da queste aziende.

## Installazione

```text
VaultSessions/
├── README.md
├── LICENSE
├── SECURITY.md
├── docs/
└── VaultSessions/       ← Carica questa cartella in Chrome
    ├── manifest.json
    ├── meeting.html
    ├── start.command
    ├── start.bat
    ├── serve.py
    ├── icons/
    ├── i18n/
    └── ...
```

1. Scarica o clona il repository in una cartella da conservare stabilmente.
2. Apri `chrome://extensions/` e attiva la **Modalità sviluppatore**.
3. Fai clic su **Carica estensione non pacchettizzata** e seleziona la cartella interna **`VaultSessions/`** che contiene `manifest.json`, non la radice del repository.
4. Apri i siti ufficiali di ChatGPT, Gemini e/o Claude ed effettua personalmente l’accesso.
5. Fai clic sull’icona dell’estensione VaultSessions nella scheda in cui vuoi mostrare il pannello della riunione.

Usa una versione recente di Chrome. Il minimo dichiarato nel manifest è Chrome 116, ma la compatibilità delle API del browser e delle interfacce dei fornitori può variare. Per le normali riunioni non servono compilazione né server.

Dopo un aggiornamento, ricarica l’estensione, le schede ufficiali delle IA e la vista della riunione.

**Supporto Windows:** Sono inclusi istruzioni e uno script di avvio per Windows, ma VaultSessions non è ancora stato testato su un computer Windows. Il focus delle finestre, l’input IME, l’inserimento di immagini dagli appunti e il passaggio tra pannello laterale e schermo intero devono ancora essere verificati su Windows.

### Vista estesa senza server

1. Nei **Dettagli** dell’estensione, attiva **Consenti l’accesso agli URL dei file**.
2. Apri `VaultSessions/meeting.html` in Chrome.
3. Fai clic su **Registra questa pagina della riunione** per salvarne l’URL locale esatto nello spazio di archiviazione locale dell’estensione.
4. Usa i controlli dell’intestazione per passare dal pannello laterale alla vista estesa e viceversa.

Se sposti la cartella, apri e registra nuovamente il nuovo `meeting.html`. Il passaggio dal pannello laterale riutilizza la scheda attuale; il pulsante Indietro del browser riporta al sito precedente. Il registro viene trasferito, ma potrebbe essere necessario riconnettere le IA.

### Modalità localhost opzionale

Alcuni pannelli IA del browser non possono interagire con pagine `file://`. Per queste integrazioni, installa Python 3 e avvia il server loopback opzionale:

| Piattaforma | Avvio | Alternativa da terminale, nella cartella interna `VaultSessions/` |
| --- | --- | --- |
| macOS | Doppio clic su `VaultSessions/start.command` | `python3 serve.py` |
| Windows | Doppio clic su `VaultSessions/start.bat` | `py -3 serve.py` oppure `python serve.py` |

Se lo script macOS ha perso il permesso di esecuzione, usa `chmod +x start.command` o il comando da terminale indicato sopra. Lascia aperta la finestra del terminale; Ctrl+C ferma il server. La porta 8766 deve essere libera.

Nella riunione aperta come file, fai clic su **?**, quindi usa il pulsante di verifica e apertura del server nella finestra di aiuto. Verifica il server e salva il registro corrente prima del cambio di vista. L’indirizzo è `http://127.0.0.1:8766/meeting.html`.

Il server distribuisce i file della cartella interna `VaultSessions/` solo tramite loopback. Non conservare segreti o file personali in tale cartella. L’estensione deve rimanere attiva in entrambe le modalità.

## Utilizzo

### Avviare una riunione

Le schede IA disponibili si connettono automaticamente. Se un fornitore ha più schede aperte, scegli la conversazione desiderata. Puoi disconnettere un’IA senza chiuderne la scheda; la riconnessione automatica resta sospesa nella vista attuale finché non la riconnetti.

Scrivi un argomento e premi Invio. Maiusc+Invio inserisce una nuova riga; durante la composizione con un IME non viene inviato alcun messaggio. Con più IA connesse, gli altri partecipanti seguono in ordine il primo a rispondere. Puoi indicare il primo destinatario in qualsiasi punto del messaggio; non si distingue tra maiuscole e minuscole e viene usata la prima indicazione esplicita.

I limiti predefiniti sono **3 interventi** e **6 richieste**. PASS conta come richiesta, non come intervento. La discussione termina anche se tutti i partecipanti connessi passano consecutivamente. **Interrompi discussione** impedisce i turni successivi; una risposta in corso potrebbe dover essere recuperata prima che l’input venga sbloccato.

Le schede IA vengono portate in primo piano durante l’invio e il recupero delle risposte. Evita di modificare o cambiare quelle conversazioni durante un turno. La protezione dell’input aiuta a evitare digitazioni accidentali dopo i cambi di focus. Le istruzioni di ruolo sono messaggi di chat normali, non ruoli di sistema; non sono garantiti il mantenimento della personalità e il rispetto delle istruzioni.

### Immagini e riepiloghi

Allega fino a quattro immagini PNG, JPEG o WebP: **5 MB ciascuna, 10 MB in totale**. Incollale nel campo del messaggio o usa il pulsante per gli allegati. Se i dati incollati contengono un’immagine, la sua elaborazione ha precedenza sul testo. Controlla l’anteprima e rimuovi gli allegati indesiderati prima di inviare.

VaultSessions passa le immagini alla scheda IA ufficiale all’interno del browser, senza un server di inoltro gestito dal progetto. Il sito ufficiale le carica quindi sul servizio del fornitore al momento dell’invio. La numerazione ricomincia per ogni nuovo messaggio umano con immagini.

**Riassumi discussione** seleziona casualmente un’IA connessa disponibile. Non avvia un altro giro di discussione e non applica la raccomandazione dei 300 caratteri. In caso di successo, il riepilogo sostituisce il registro visualizzato e la normale cronologia dell’app. Copialo se vuoi conservarlo. Un errore lascia intatto il registro precedente. I riepiloghi sono esclusi dalle successive cronologie di discussione generate dall’app e dagli input dei riepiloghi futuri; i messaggi già inviati restano nella conversazione del fornitore.

### Visualizzazione e archiviazione temporanea

Il menu dell’intestazione nasconde i controlli dei partecipanti e delle impostazioni. **A−**, **A＋** e **Dimensione predefinita** regolano il testo del registro, riepiloghi inclusi, dal 75% al 175%. L’impostazione è condivisa tra le viste e resta memorizzata dopo il riavvio del browser.

Le istantanee temporanee usano `chrome.storage.session`, con un massimo di 500 voci visualizzate e 500 voci di cronologia normale per salvataggio. La vista attiva può contenerne di più. Non è un archivio permanente. Lingua, dimensione del testo, preferenza di condivisione pagina e URL del file registrato usano lo spazio locale del browser. Le immagini selezionate ma non inviate non vengono conservate nei cambi di vista.

### Privacy, permessi e compatibilità

**Questa non è un’applicazione offline o limitata al loopback.** Il coordinamento dell’estensione e il passaggio delle immagini avvengono nel browser, ma i siti IA ufficiali inviano messaggi, immagini e testo delle pagine condivise ai propri servizi. VaultSessions non usa direttamente endpoint API IA e non richiede un server di inoltro gestito dal progetto.

L’ispezione statica del codice ha trovato un solo `fetch` esplicito: il controllo opzionale di `http://127.0.0.1:8766/meeting.html`. Non sono stati identificati client di analisi separati, caricamenti di script remoti o CDN, né client diretti per API IA esterne. È un risultato dell’esame del codice, **non un audit con traffico di rete registrato**, né un’affermazione di assenza di comunicazioni esterne.

La condivisione di una pagina può includere informazioni private visibili nelle pagine con accesso effettuato. Disattivala sulle pagine che non vuoi condividere. Rimuovere i parametri dell’URL non elimina i dati privati dal testo. Consulta [SECURITY.md](../SECURITY.md) per permessi, flussi di dati e segnalazioni di sicurezza.

**VaultSessions automatizza siti IA ufficiali con sessioni attive. Ciò può essere in contrasto con termini o regole dell’account di un fornitore. Verifica i termini applicabili e usalo a tuo rischio. Modifiche alle interfacce, alle API del browser, alle funzionalità o ai termini possono impedirne il funzionamento o richiedere di interromperne l’uso.** L’app non aggira CAPTCHA o limiti di utilizzo. Essere open source non implica un audit indipendente né una sicurezza garantita.

### Contribuire

I contributi sono benvenuti!

Crea un fork del repository, migliora VaultSessions e invia una Pull Request.

Costruiamo un modo migliore per pensare insieme, esseri umani e IA.

Questa distribuzione non include la suite di test interna. Descrivi le verifiche eseguite quando proponi una modifica, soprattutto agli adattatori DOM dei fornitori. Consulta [VaultSessions/i18n/README.md](../VaultSessions/i18n/README.md) per aggiungere una lingua.

## Licenza

[MIT](../LICENSE) — Copyright (c) 2026 VaultFilms.

Il software è fornito **COSÌ COM’È, SENZA GARANZIA**. Mantieni gli avvisi di copyright, autorizzazione ed esclusione di garanzia quando lo ridistribuisci. La licenza non autorizza a ignorare i termini dei servizi di terze parti.

Creato da [VaultFilms](https://www.youtube.com/channel/UCmiLs19uM0in4ubeyvPHLIQ).
