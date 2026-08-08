// CARD SCANNER
// Point the camera at a real Pokemon card (or upload a photo of one), read the
// name off it with OCR, look the Pokemon up on PokeAPI and drop the finished
// card straight into My Deck.

(function () {

    // Tesseract is loaded from a CDN the first time a scan runs, so the page
    // costs nothing extra until somebody actually scans something.
    const TESS_VERSION = '5.1.1';
    const TESS_SCRIPT = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/tesseract.min.js`;
    const TESS_WORKER = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/worker.min.js`;
    const TESS_CORE = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0';
    const TESS_LANG = 'https://tessdata.projectnaptha.com/4.0.0';

    const SPECIES_URL = 'https://pokeapi.co/api/v2/pokemon-species?limit=100000';
    const SPRITE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

    // words printed on every card that must never be matched against a name
    const CARD_NOISE = new Set([
        'pokemon', 'basic', 'stage', 'trainer', 'energy', 'weakness', 'resistance',
        'retreat', 'illus', 'ability', 'attack', 'evolves', 'from', 'put', 'this',
        'card', 'your', 'the', 'and', 'for', 'you', 'may', 'each', 'damage',
        'counter', 'counters', 'active', 'bench', 'benched', 'opponent', 'turn',
        'deck', 'hand', 'discard', 'pile', 'coin', 'flip', 'heads', 'tails',
        'nintendo', 'creatures', 'gamefreak', 'holo', 'rare', 'promo', 'edition',
        'hp', 'no', 'of', 'to', 'in', 'is', 'it', 'if', 'up', 'lv'
    ]);

    // grab elements, bail out quietly if the markup is not there
    const openTriggers = document.querySelectorAll('[data-scan-open]');
    const floatingButton = document.getElementById('scan-open');
    const modal = document.getElementById('scan-pop-up');
    const closeButton = document.querySelector('[data-scan-close]');
    const video = document.getElementById('scan-video');
    const preview = document.getElementById('scan-preview');
    const placeholder = document.getElementById('scan-placeholder');
    const guide = document.getElementById('scan-guide');
    const startButton = document.getElementById('scan-start');
    const captureButton = document.getElementById('scan-capture');
    const fileInput = document.getElementById('scan-file');
    const statusBox = document.getElementById('scan-status');
    const progressBox = document.getElementById('scan-progress');
    const progressBar = document.querySelector('.scan-progress-bar');
    const resultsBox = document.getElementById('scan-results');
    const manualInput = document.getElementById('scan-manual-input');
    const manualButton = document.getElementById('scan-manual-go');
    const deckModal = document.getElementById('pop-up');

    if (!openTriggers.length || !modal) {return}

    let stream = null;
    let tesseract = null;
    let worker = null;
    let speciesList = null;
    let busy = false;


    // HELPERS

    function setStatus(message, isError) {
        statusBox.textContent = message;
        statusBox.classList.toggle('error', !!isError);
    }

    function showProgress(value) {
        progressBox.hidden = false;
        progressBar.style.width = `${Math.round(value * 100)}%`;
    }

    function hideProgress() {
        progressBox.hidden = true;
        progressBar.style.width = '0';
    }

    function prettify(name) {
        return name.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    }

    function normalize(text) {
        return (text || '').toLowerCase().replace(/[^a-z]/g, '');
    }

    function clean(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
    }

    function padId(id) {
        return `${id}`.padStart(3, '0');
    }


    // OCR

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const tag = document.createElement('script');
            tag.src = src;
            tag.onload = resolve;
            tag.onerror = () => reject(new Error(`could not load ${src}`));
            document.head.appendChild(tag);
        });
    }

    async function getWorker() {
        if (worker) {return worker}

        if (!tesseract) {
            if (!window.Tesseract) {await loadScript(TESS_SCRIPT)}
            tesseract = window.Tesseract;
        }

        worker = await tesseract.createWorker('eng', 1, {
            workerPath: TESS_WORKER,
            corePath: TESS_CORE,
            langPath: TESS_LANG,
            logger: (message) => {
                if (message.status === 'recognizing text') {showProgress(message.progress)}
                else if (typeof message.progress === 'number') {showProgress(message.progress * 0.3)}
            }
        });

        await worker.setParameters({
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'-. "
        });

        return worker;
    }

    // crop a horizontal band out of the shot, scale it up and boost the contrast,
    // which is most of the battle for OCR on a photographed card
    function preprocess(source, topRatio, bottomRatio) {
        const sy = Math.round(source.height * topRatio);
        const sh = Math.round(source.height * (bottomRatio - topRatio));
        const scale = Math.min(3, Math.max(1, 1400 / source.width));

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(source.width * scale);
        canvas.height = Math.round(sh * scale);

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, sy, source.width, sh, 0, 0, canvas.width, canvas.height);

        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = image.data;
        const histogram = new Array(256).fill(0);

        for (let i = 0; i < pixels.length; i += 4) {
            const grey = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
            pixels[i] = pixels[i + 1] = pixels[i + 2] = grey;
            histogram[grey]++;
        }

        // stretch between the 5th and 95th percentile so glare and dark borders
        // stop eating the usable range
        const total = pixels.length / 4;
        let low = 0;
        let high = 255;
        let seen = 0;

        for (let value = 0; value < 256; value++) {
            seen += histogram[value];
            if (seen >= total * 0.05) {low = value; break}
        }

        seen = 0;
        for (let value = 255; value >= 0; value--) {
            seen += histogram[value];
            if (seen >= total * 0.05) {high = value; break}
        }

        const span = Math.max(1, high - low);
        for (let i = 0; i < pixels.length; i += 4) {
            const stretched = Math.min(255, Math.max(0, ((pixels[i] - low) / span) * 255));
            pixels[i] = pixels[i + 1] = pixels[i + 2] = stretched;
        }

        ctx.putImageData(image, 0, 0);
        return canvas;
    }

    async function runOcr(canvas) {
        const activeWorker = await getWorker();
        const result = await activeWorker.recognize(canvas);
        return (result && result.data && result.data.text) || '';
    }


    // NAME MATCHING

    async function getSpeciesList() {
        if (speciesList) {return speciesList}

        const response = await fetch(SPECIES_URL);
        if (!response.ok) {throw new Error('pokedex list unavailable')}

        const payload = await response.json();
        speciesList = payload.results.map((entry) => {
            const id = parseInt(entry.url.split('/').filter(Boolean).pop(), 10);
            return { name: entry.name, key: normalize(entry.name), display: prettify(entry.name), id };
        });

        return speciesList;
    }

    function levenshtein(a, b) {
        if (a === b) {return 0}
        if (!a.length) {return b.length}
        if (!b.length) {return a.length}

        let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

        for (let i = 1; i <= a.length; i++) {
            const current = [i];
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
            }
            previous = current;
        }

        return previous[b.length];
    }

    function similarity(a, b) {
        const longest = Math.max(a.length, b.length);
        if (!longest) {return 0}
        return 1 - levenshtein(a, b) / longest;
    }

    // every word OCR found, plus neighbouring pairs so split names such as
    // "HO OH" or "MR MIME" still line up with a pokedex entry. Words near the
    // top of the read count for more, that is where the card prints its name,
    // and it keeps "evolves from Charmeleon" from outranking Charizard.
    function tokenize(text) {
        const tokens = new Map();

        const remember = (token, weight) => {
            if (!tokens.has(token) || tokens.get(token) < weight) {tokens.set(token, weight)}
        };

        text.split('\n').filter((line) => line.trim()).forEach((line, index) => {
            const weight = Math.max(0.75, 1 - index * 0.08);
            const words = line.split(/[^A-Za-z]+/).map(normalize)
                .filter((word) => word.length > 1 && !CARD_NOISE.has(word));

            words.forEach((word, position) => {
                if (word.length > 2) {remember(word, weight)}
                if (words[position + 1]) {remember(word + words[position + 1], weight)}
            });
        });

        return [...tokens].slice(0, 80);
    }

    async function matchText(text) {
        const tokens = tokenize(text);
        if (!tokens.length) {return []}

        const list = await getSpeciesList();
        const hits = [];

        for (const species of list) {
            let best = 0;
            for (const [token, weight] of tokens) {
                const score = similarity(token, species.key) * weight;
                if (score > best) {best = score}
            }
            if (best >= 0.6) {hits.push({ species, score: best })}
        }

        return hits.sort((a, b) => b.score - a.score).slice(0, 4);
    }


    // BUILDING THE CARD

    async function abilityText(url) {
        try {
            const response = await fetch(url);
            const data = await response.json();

            const flavor = (data.flavor_text_entries || []).filter((entry) => entry.language.name === 'en');
            if (flavor.length) {return clean(flavor[flavor.length - 1].flavor_text)}

            const effect = (data.effect_entries || []).find((entry) => entry.language.name === 'en');
            if (effect) {return clean(effect.short_effect || effect.effect)}
        } catch (error) {
            console.log(error);
        }

        return 'No data available.';
    }

    async function resolvePokemon(species) {
        const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${species.name}`);
        if (!speciesResponse.ok) {throw new Error(`could not find ${species.display}`)}

        const speciesData = await speciesResponse.json();
        const variety = (speciesData.varieties || []).find((entry) => entry.is_default) || speciesData.varieties[0];

        const pokemonResponse = await fetch(variety.pokemon.url);
        if (!pokemonResponse.ok) {throw new Error(`could not find ${species.display}`)}

        return pokemonResponse.json();
    }

    async function addToDeck(species) {
        setStatus(`Catching ${species.display}...`);
        resultsBox.innerHTML = '';

        const data = await resolvePokemon(species);
        const type = data.types[0].type.name;
        const artwork = (data.sprites.other && data.sprites.other['official-artwork'] && data.sprites.other['official-artwork'].front_default) || data.sprites.front_default || '';

        const markup = cardMarkup({
            pokeName: data.name,
            type,
            hp: data.stats[0].base_stat,
            id: padId(data.id),
            height: data.height,
            weight: data.weight,
            abilityName: data.abilities.length ? data.abilities[0].ability.name : 'unknown',
            effect: data.abilities.length ? await abilityText(data.abilities[0].ability.url) : 'No data available.',
            damage: Math.floor(Math.random() * 7) + 3,
            image: `https://assets.pokemon.com/assets/cms2/img/pokedex/full/${padId(data.id)}.png`,
            imageFallback: artwork
        });

        const holder = document.createElement('div');
        holder.innerHTML = markup.trim();

        const card = holder.firstElementChild;
        card.classList.remove('poke-item');
        card.classList.add('poke-item-small');
        card.dataset.scanned = 'true';

        deckGrid.appendChild(card);
        updateDeckCard();
        bumpTypeCount(type, 1);

        // show off the catch
        closeScanner();
        if (deckModal) {deckModal.classList.add('is-visible')}
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
    }


    // RESULTS

    function renderResults(hits) {
        resultsBox.innerHTML = '';

        hits.forEach((hit, index) => {
            const row = document.createElement('div');
            row.className = index === 0 ? 'scan-result best' : 'scan-result';

            const thumb = document.createElement('img');
            thumb.src = `${SPRITE_URL}/${hit.species.id}.png`;
            thumb.alt = hit.species.display;
            thumb.onerror = () => {thumb.style.visibility = 'hidden'};

            const name = document.createElement('div');
            name.className = 'scan-result-name';
            name.textContent = hit.species.display;

            const score = document.createElement('span');
            score.className = 'scan-result-score';
            score.textContent = `${Math.round(hit.score * 100)}% match`;
            name.appendChild(score);

            const button = document.createElement('button');
            button.type = 'button';
            button.className = index === 0 ? 'scan-btn primary' : 'scan-btn';
            button.textContent = 'Add to Deck';
            button.addEventListener('click', () => {
                addToDeck(hit.species).catch((error) => {
                    console.log(error);
                    setStatus(`Could not add ${hit.species.display}. Check your connection and try again.`, true);
                });
            });

            row.append(thumb, name, button);
            resultsBox.appendChild(row);
        });
    }


    // SCAN PIPELINE

    async function scan(source) {
        if (busy) {return}
        busy = true;
        captureButton.disabled = true;
        resultsBox.innerHTML = '';

        try {
            setStatus('Warming up the scanner...');
            showProgress(0);

            // the name sits along the top of the card, so read that band first
            let text = await runOcr(preprocess(source, 0.02, 0.38));
            let hits = await matchText(text);

            if (!hits.length) {
                setStatus('No name found up top, reading the whole card...');
                text = `${text}\n${await runOcr(preprocess(source, 0, 1))}`;
                hits = await matchText(text);
            }

            if (hits.length) {
                setStatus(hits.length === 1 ? 'Found a match. Add it to your deck:' : 'Best matches, pick the right one:');
                renderResults(hits);
            } else {
                const readable = clean(text).slice(0, 60);
                setStatus(readable
                    ? `No Pokemon matched that scan (I read "${readable}"). Try better light, or type the name below.`
                    : 'Could not read any text. Try filling the frame with the card name, or type it below.', true);
            }
        } catch (error) {
            console.log(error);
            setStatus('The scanner could not start (it needs internet access for the text reader). You can still add a card by name below.', true);
        } finally {
            hideProgress();
            busy = false;
            captureButton.disabled = !stream;
        }
    }

    function showPreview(canvas) {
        preview.src = canvas.toDataURL('image/jpeg', 0.9);
        preview.hidden = false;
        video.hidden = true;
        guide.hidden = true;
        if (placeholder) {placeholder.hidden = true}
    }


    // CAMERA

    async function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('This browser will not give a page camera access. Upload a photo of the card instead.', true);
            return;
        }

        try {
            setStatus('Asking for the camera...');
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
                audio: false
            });

            video.srcObject = stream;
            video.hidden = false;
            preview.hidden = true;
            guide.hidden = false;
            if (placeholder) {placeholder.hidden = true}

            await video.play();

            captureButton.disabled = false;
            startButton.textContent = 'Restart Camera';
            setStatus('Line the card up so its name sits inside the dashed box, then capture.');
        } catch (error) {
            console.log(error);
            setStatus('No camera available (a page needs https and your permission to use one). Upload a photo instead.', true);
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            stream = null;
        }
        video.srcObject = null;
        captureButton.disabled = true;
    }

    function capture() {
        if (!stream || !video.videoWidth) {return}

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

        showPreview(canvas);
        scan(canvas);
    }

    function loadFile(file) {
        const reader = new FileReader();

        reader.onload = () => {
            const image = new Image();

            image.onload = () => {
                // cap the size so a 12 megapixel phone photo does not stall the reader
                const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(image.width * scale);
                canvas.height = Math.round(image.height * scale);
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

                showPreview(canvas);
                scan(canvas);
            };

            image.onerror = () => setStatus('That file could not be opened as an image.', true);
            image.src = reader.result;
        };

        reader.onerror = () => setStatus('That file could not be read.', true);
        reader.readAsDataURL(file);
    }


    // MANUAL FALLBACK

    async function addByName(input) {
        const key = normalize(input);
        if (!key) {return}

        setStatus('Looking that one up...');

        try {
            const list = await getSpeciesList();
            let best = null;

            for (const species of list) {
                const score = similarity(key, species.key);
                if (!best || score > best.score) {best = { species, score }}
            }

            if (!best || best.score < 0.6) {
                setStatus(`No Pokemon called "${clean(input)}" in the Pokedex.`, true);
                return;
            }

            await addToDeck(best.species);
        } catch (error) {
            console.log(error);
            setStatus('Could not reach the Pokedex. Check your connection and try again.', true);
        }
    }


    // OPEN / CLOSE

    function openScanner() {
        modal.classList.add('is-visible');
        resultsBox.innerHTML = '';
        setStatus('Start the camera and point it at a card, or upload a photo of one.');

        // the name list is small, fetch it now so the scan itself feels instant
        getSpeciesList().catch((error) => console.log(error));
    }

    function closeScanner() {
        modal.classList.remove('is-visible');
        stopCamera();
        hideProgress();

        preview.hidden = true;
        preview.removeAttribute('src');
        video.hidden = false;
        guide.hidden = false;
        if (placeholder) {placeholder.hidden = false}
        startButton.textContent = 'Start Camera';
    }


    // WIRING

    openTriggers.forEach((trigger) => trigger.addEventListener('click', openScanner));
    closeButton.addEventListener('click', closeScanner);

    // the floating button would sit on top of whatever modal is open
    if (floatingButton && deckModal) {
        const syncFloatingButton = () => {
            const modalUp = modal.classList.contains('is-visible') || deckModal.classList.contains('is-visible');
            floatingButton.classList.toggle('is-hidden', modalUp);
        };

        const watcher = new MutationObserver(syncFloatingButton);
        watcher.observe(modal, { attributes: true, attributeFilter: ['class'] });
        watcher.observe(deckModal, { attributes: true, attributeFilter: ['class'] });
        syncFloatingButton();
    }

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {closeScanner()}
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('is-visible')) {closeScanner()}
    });

    startButton.addEventListener('click', startCamera);
    captureButton.addEventListener('click', capture);

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
            stopCamera();
            loadFile(fileInput.files[0]);
        }
        fileInput.value = '';
    });

    manualButton.addEventListener('click', () => addByName(manualInput.value));

    manualInput.addEventListener('keydown', (event) => {
        // the carousel steers off the arrow keys, keep typing out of it
        event.stopPropagation();

        if (event.key === 'Enter') {addByName(manualInput.value)}
        else if (event.key === 'Escape') {closeScanner()}
    });

})();
