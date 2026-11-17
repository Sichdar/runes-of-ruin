/* Runes of Ruin - optional image overrides for the code-drawn art.
   Leave a key out (or empty) to keep the code art. Give a path relative to index.html, e.g.
     tile0: 'assets/img/tile0.png'
   Once the image has loaded, G.Art.get / G.Art.background / G.Art.title draw it instead,
   G.Art.version goes up by one and the renderer drops its caches.

   Pieces: square PNG, transparent background, 256 px or more (512 px is ideal), the object
   centred with a little margin. Drawn "contain"-fit into the square.
     tile0   blood vial: round red flask with a cork
     tile1   frost sapphire: blue rhombus gem, faceted
     tile2   venom emerald: green pointy-top hexagon gem, faceted
     tile3   cursed gold coin: round, embossed rune
     tile4   soul shard: tall purple crystal
     tile5   skull: bone-white, faintly glowing red eye sockets
     jh      double-headed javelin lying horizontal, on a dark disc with a glowing rim (clears a row)
     jv      the same javelin, vertical (clears a column)
     bomb    black iron fire bomb with glowing cracks and a lit fuse, on a dark disc
     raven   black raven with spread wings and a red eye, on a dark disc
     chaos   dark orb with swirling purple/green energy (the game rotates it: keep it round)
     relic   golden chalice / reliquary (collectible that falls to the bottom)
     bone1   crossed bones on a stone slab, fills the whole square (1 hit)
     bone2   skull on crossed bones on a darker slab, fills the whole square (2 hits)
     bone3   skull and bones in front of a cracked tombstone, fills the whole square (3 hits)
     chain   two crossed iron chains with a padlock; transparent everywhere else (drawn over a tile)
     ground1 cursed ground under a tile: dark crimson with veins, opaque, fills the whole square
     ground2 stronger cursed ground: deeper red plus a faint glowing rune circle, opaque

   Backgrounds: portrait image, about 1290 x 2796 px (iPhone), PNG or JPG, drawn "cover"-fit
   (edges may be cropped). Keep them fairly dark: the board sits on top.
     bg-moors  bg-desert  bg-jungle  bg-hell  bg-frost  bg-abyss
     title     title screen: keep the top third plain (title text) and the bottom quarter calm (buttons)
*/
window.ART_OVERRIDES = {
  // tile0: 'assets/img/tile0.png',
};
