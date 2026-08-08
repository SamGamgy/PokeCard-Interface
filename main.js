// DATA AND API

let dataArray = [];
let secondData =[];
// ids of desired pokemon
pokeDexIds= [1, 4, 7, 25, 35, 39, 37, 54, 58, 60, 63, 66, 72, 77, 79, 81, 100, 102, 106, 109, 120, 133, 143, 150];

// Fetch data points for all Pokemon in the pokeDevIds Array and push to dataArray
function grabPokeByIndex(idArray, pushArray) {
 idArray.map((id) => {
    const poke = fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
    poke
    .then((data) => data.json())

    .then((data) => 
    pushArray.push(Array(data.name, data.types[0].type.name, data.stats[0].base_stat, data.id, data.height, data.weight, data.abilities[0].ability.name, data.abilities[0].ability.url)))

    .catch((err) => console.log(err)); 
})
};

const timingFunction = () => {

    grabPokeByIndex(pokeDexIds,dataArray);


    setTimeout( () =>{grabSecondData();},1000)
    
    // SecondData at times taking this long to fully push into array
    setTimeout( () =>{createCards();},4000)




    // grabSecondaryData();
};

function grabSecondData () {
    for (let i=0; i < dataArray.length; i++) {
        const [pokeName, type, hp, id, height, weight, abilityName, abilityURL] = dataArray[i];
       
        let abilityEffect = fetch(abilityURL)

        abilityEffect
        .then((data) => data.json())
        .then((data) => {
            // not every ability carries four English entries, fall back to the newest
            const entries = (data.flavor_text_entries || []).filter((entry) => entry.language.name === 'en');
            const chosen = entries[3] || entries[entries.length - 1];
            secondData.push(chosen ? chosen.flavor_text.replace(/\s+/g, ' ') : 'No data available.');
        })
        .catch((err) => console.log(err));
        
    }    
}    

timingFunction();




const cardParent = document.querySelector('.poke-carousel');
let pokeCard = '';

// types that ship with their own emblem and their own counter row
const SUPPORTED_TYPES = ['water', 'fire', 'electric', 'grass', 'normal', 'fighting', 'fairy', 'poison', 'psychic'];

// colours used to draw a stand in emblem for a type we have no artwork for
const TYPE_COLORS = {
    bug: '#a8b820', dark: '#705848', dragon: '#7038f8', flying: '#a890f0',
    ghost: '#705898', ground: '#e0c068', ice: '#98d8d8', rock: '#b8a038',
    steel: '#b8b8d0', unknown: '#68a090'
};

// emblem for a type: the real artwork when we have it, otherwise a generated one
function typeIcon(type) {
    if (SUPPORTED_TYPES.includes(type)) {return `./assests/icons/${type}.png`}

    const color = TYPE_COLORS[type] || TYPE_COLORS.unknown;
    const letter = (type || '?').charAt(0).toUpperCase();
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
        `<circle cx="32" cy="32" r="32" fill="${color}"/>` +
        `<text x="32" y="45" font-family="Arial, sans-serif" font-size="38" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text>` +
        `</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// card markup, shared by the carousel and the scanner
function cardMarkup({ pokeName, type, hp, id, height, weight, abilityName, effect, image, imageFallback, damage }) {
    const icon = typeIcon(type);
    const onError = imageFallback ? ` onerror="this.onerror=null;this.src='${imageFallback}'"` : '';

    return `
        <div class="poke-item " data-type="${type}">
            <div class="card-header">
                <div class="poke-name">${pokeName}</div>
                <div class="right-side">
                    <div class="poke-hp">${hp} HP</div>
                    <div class="poke-type"><img src="${icon}" alt="icon"></div>
                </div>
            </div>
            <div class='poke-img'>
                <img src="${image}" alt="pokemon img"${onError}>
            </div>
            <div class="img-subhead">
                <div class="species">${type} Pokemon.</div>
                <div class="length">Height: ${height} </div>
                <div class="weight">Weight: ${weight} </div>
            </div>
            <div class="ability">
                <div class="poke-type"><img src="${icon}" alt="icon"></div>
                <div class="ability-descript"><h4 class="ability-name">${abilityName}</h4> <br>Effect: ${effect} </div>
                <div class="damage-amt"> ${damage} </div>
            </div>
        </div>
        `;
}

// counter row for a type, falling back to the catch all row
function bumpTypeCount(type, delta) {
    const counter = document.getElementById(SUPPORTED_TYPES.includes(type) ? type : 'other');
    if (!counter) {return}

    const next = parseInt(counter.textContent, 10) + delta;
    counter.textContent = next > 0 ? next : 0;
}

function createCards () {

    for (let i=0; i < dataArray.length; i++) {
        // grab data
        let [pokeName, type, hp, id, height, weight, abilityName] = dataArray[i];
    
        let effect = secondData[i]

        // change single and double digit id to three digit id
        id = `${id}`;
        if (id.length === 1) {id= '00' + id}
        else if (id.length === 2) {id= '0' + id};
    
        // generate random damage number between 3-10
        let damage = Math.floor(Math.random() * 7) + 3;

        // HTML
        pokeCard = cardMarkup({
            pokeName, type, hp, id, height, weight, abilityName, effect, damage,
            image: `https://assets.pokemon.com/assets/cms2/img/pokedex/full/${id}.png`
        });

        // insert into DOM
        cardParent.insertAdjacentHTML('beforeend',pokeCard);
    }

}






                





// CAROUSEL
let cards =[];

// grab testimonial cards

setTimeout(() =>{cards = document.querySelectorAll('.poke-item')},4100)

setTimeout(() =>{update();},4200)

// grab buttons
const buttons = document.querySelectorAll('.slide-ctrl-container div');



function next2logic(current) {
    if (current == cards.length - 1) {return 1} 
    else if (current == cards.length - 2) {return 0}
    else {return current + 2};
    };


function prev2logic(current) {
    if(current === 1) { return cards.length -1}
    else if(current == 0) {return cards.length -2}
    else {return current - 2}
}

function next3logic(current) {
    if (current == cards.length - 1) {return 2} 
    else if (current == cards.length - 2) {return 1} 
    else if (current == cards.length - 3) {return 0}
    else {return current + 3};
    };


function prev3logic(current) {
    if(current === 2) { return cards.length -1}
    else if(current === 1) { return cards.length -2}
    else if(current == 0) {return cards.length -3}
    else {return current - 3}
}

// set random starting card
let current = setTimeout(() => randomNum() ,4200) ;

function randomNum() {Math.floor(Math.random() * cards.length)};

const update = () => {
    if (!cards.length) {return}
    if (current >= cards.length || current < 0 || isNaN(current)) {current = 0}

    let next = current < cards.length - 1 ? current + 1 : 0;
    let prev = current > 0 ? current - 1 : cards.length - 1;
    let next2 = next2logic(current);
    let prev2 = prev2logic(current);
    let next3 = next3logic(current);
    let prev3 = prev3logic(current);


    cards.forEach((card) => {
        card.classList.remove('active', 'previous', 'next', 'next2' ,'previous2','previous3','next3');
    })

    cards[current].classList.add('active');

    if (cards.length > 2) {
    cards[prev].classList.add('previous');
    cards[next].classList.add('next');}

    if (cards.length > 4){
    cards[next2].classList.add('next2');
    cards[prev2].classList.add('previous2');}

    if (cards.length > 6) {
    cards[next3].classList.add('next3');
    cards[prev3].classList.add('previous3');}
}

const goToNum = (num) => {
    current = num;
    next = current < cards.length - 1 ? current + 1 : 0;
    prev = current > 0 ? current - 1 : cards.length - 1;
    next2 = next2logic(current);
    prev2 = prev2logic(current);
    update();
}

const goToNext = () => current < cards.length - 1 ? goToNum(current + 1) : goToNum(0); 
const goToPrev = () => current > 0 ? goToNum(current - 1) : goToNum( cards.length - 1) ;

for (let i = 0; i < buttons.length ; i++) {
    buttons[i].addEventListener('click', () => i === 0 ? goToPrev() : goToNext());
}


document.addEventListener('keydown', (right) => {
    if (right.key === 'ArrowRight') {
        goToNext();
    }
});

document.addEventListener('keydown', (right) => {
    if (right.key === 'ArrowLeft') {
        goToPrev();
    }

});
// END CAROUSEL


// POP UP MODAL

const closeModal = document.querySelector('[data-close]');


closeModal.addEventListener('click', function() {
            this.parentElement.parentElement.classList.remove('is-visible');
    })

const openModal = document.querySelector ('[data-open]');

openModal.addEventListener('click', function(){
            document.getElementById('pop-up').classList.add('is-visible');
    })


// const sortModal = document.querySelector ('[data-sort]');
// const sortIcons = document.querySelectorAll('.sort-icon')

// sortModal.addEventListener('click', function () {
//             for(const elm of sortIcons) {
//                 if (elm.classList.includes('is-visible')) {
//                     elm.classList.remove('is-visible')
//                 } else {
//                     elm.classList.add('is-visible');
//                 }
//             }
// })

//  add to deck button
const pokeButton = document.getElementById('add-to');
const deckGrid = document.querySelector('.grid-container');

// move card and update cards/class
pokeButton.addEventListener('click', () => {
    let active = document.querySelector('.active')
    
    // animations
    active.classList.add('fly-to-ball')
    openModal.classList.add('deck-bloop')

    setTimeout( () => {
        deckGrid.appendChild(active)
        active.classList.remove('poke-item')
        cards = document.querySelectorAll('.poke-item')

        active.classList.add('poke-item-small')
        deckCards = document.querySelectorAll('.poke-item-small');
        updateDeckCard();
        
        // animations remove
        openModal.classList.remove('deck-bloop')
        active.classList.remove('fly-to-ball')

        active.classList.remove('previous')
        active.classList.remove('active')


        update();
        

        // update counter
            bumpTypeCount(active.dataset.type, 1);

    },2000)
    
})

// reset cards


const resetButton = document.querySelector('[data-reset]');

resetButton.addEventListener('click', () => {
    let deckCards = document.querySelectorAll('.poke-item-small');
    for(const card of deckCards) {
        cardParent.appendChild(card)
        card.classList.remove('poke-item-small')
        card.classList.add('poke-item')
        cards = document.querySelectorAll('.poke-item')
        let counters= document.querySelectorAll('.type-count')
        // reset counter
        for(const counter of counters) {counter.textContent = 0}
        update();
    }
})

// remove deck card button

const cardOverlay = 
`
<div data-hover class="remove-overlay">
<div><i data-remove class="bi bi-x-circle-fill"></i></div>
</div>
`;

let deckCards = document.querySelectorAll('.poke-item-small');

function updateDeckCard() {

    deckCards = document.querySelectorAll('.poke-item-small');

    for(const card of deckCards){

        // only wire a card up once, otherwise every call stacks another overlay
        if (card.dataset.hoverReady) {continue}
        card.dataset.hoverReady = 'true';

        card.addEventListener('mouseenter', () => {
            // the same element travels back to the carousel, no overlay there
            if (!card.classList.contains('poke-item-small')) {return}
            if (card.querySelector('[data-hover]')) {return}
            card.insertAdjacentHTML('afterbegin', cardOverlay);

            let removeButton = card.querySelector('[data-remove]');
            addButtonListener(removeButton)
        })

        card.addEventListener('mouseleave', () => {
            let overlayElm = card.querySelector('[data-hover]');
            if (overlayElm) {overlayElm.remove()}
        })

    }

}

// deck card button
function addButtonListener(elm) {

    elm.addEventListener('click', () => {
        let deckCard = elm.parentElement.parentElement.parentElement;
        let overlay = deckCard.querySelector('[data-hover]');
        if (overlay) {overlay.remove()}

        deckCard.classList.remove('poke-item-small')
        deckCard.classList.add('poke-item')
        cardParent.appendChild(deckCard)
        cards = document.querySelectorAll('.poke-item')
        update();

        // update counter
        bumpTypeCount(deckCard.dataset.type, -1);
    } )

}


// sorting function

function sortCards(dir) {
    let orderedCards = [];
    let deckCardsName = document.querySelectorAll('.poke-item-small .card-header .poke-name');
    let sortedNameArray = []
    let card = ''
    for (const cardName of deckCardsName) {
        card = cardName.parentElement.parentElement;

        let nameString = cardName.innerText;
        sortedNameArray.push(nameString);

        sortedNameArray.sort()
         if( dir === -1 ) {sortedNameArray.reverse()}

        for (let i = 0; i <sortedNameArray.length; i++){
            console.log(sortedNameArray[i]);
            if (nameString === sortedNameArray[i]) {
                let indexOrder = i
                orderedCards.splice(i, 0, card)
            }
        }

    }

    orderedCards.forEach((card) => {
        deckGrid.appendChild(card)
    })
    
}

// sort button
let sortButton = document.querySelector('[data-sort]')

sortButton.addEventListener('click', () => {
    let visibleIcon = sortButton.querySelector('.is-visible');
    let abcIcon = document.querySelector('.sort-abc')
    let cbaIcon = document.querySelector('.sort-cba')


    if (visibleIcon.classList.contains('sort-abc')) {
        sortCards(-1);
        visibleIcon.classList.remove('is-visible')
        cbaIcon.classList.add('is-visible')
    }
    else if (visibleIcon.classList.contains('sort-cba')) {
        sortCards();
        visibleIcon.classList.remove('is-visible')
        abcIcon.classList.add('is-visible')
    }

})



