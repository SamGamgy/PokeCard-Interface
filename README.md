# PokeCard Interface

Each card is dynamically rendered from JSON data from the REST API.

The interface is designed to be fun and interactive.

This project is built with HTML, CSS, and JavaScript.

The API that is utilized is located here:
https://pokeapi.co/

## Card Scanner

The **Scan Card** button (top right of the page, and in the My Deck header) opens a
scanner that adds a real card to your deck:

1. Start the camera and line the card up so its name sits inside the dashed box,
   then hit **Capture & Scan**. On a phone you can also **Upload Photo** to shoot
   the card with the native camera.
2. The captured frame is cropped to the name band, contrast boosted and read with
   [Tesseract.js](https://tesseract.projectnaptha.com/), which is pulled from a CDN
   the first time you scan.
3. The text is matched against the Pokedex with a fuzzy comparison, so a slightly
   misread name still finds its Pokemon. The closest matches are listed, and picking
   one builds the card from PokeAPI and drops it straight into My Deck.

If OCR cannot make out the name, the same panel lets you add the card by typing the
name instead.

Notes:

- Browsers only hand out the camera on `https://` or `localhost`, so open the page
  through a local server rather than `file://` if you want the live preview. Uploading
  a photo works either way.
- Scanned Pokemon can be any type. Types without their own emblem artwork get a
  generated one and are tallied under "Other Types".


Sources

Card Background images:
 PokéBeach scans
 
Emblems Type images:
https://www.pngitem.com/middle/ioimRJ_pokemon-symbol-png-transparent-pokemon-type-symbols-png/
