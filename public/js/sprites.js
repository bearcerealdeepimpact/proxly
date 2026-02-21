import * as THREE from 'three';

// Sprite configuration - defines frame layout and animation timing
var SPRITE_CONFIG = {
  // Frame dimensions
  frameWidth: 32,
  frameHeight: 32,
  textureWidth: 128,
  textureHeight: 128,

  // Direction mappings (row indices in sprite sheet)
  directions: {
    N: 0,  // North (back view, -Y)
    S: 1,  // South (front view, +Y)
    E: 2,  // East (right side, +X)
    W: 3   // West (left side, -X)
  },

  // Animation frame indices (column indices)
  animations: {
    idle: 0,          // Column 0: idle/standing frame
    walk: [1, 2, 3]   // Columns 1-3: walk cycle frames
  },

  // Animation timing
  animationSpeed: 8  // 8 FPS (125ms per frame)
};

// Storage for loaded textures
var characterTextures = [];
var texturesLoaded = false;
var loadPromise = null;

/**
 * Load all character sprite sheet textures
 * @returns {Promise} Promise that resolves when all textures are loaded
 */
function loadSprites() {
  // Return existing promise if already loading
  if (loadPromise) {
    return loadPromise;
  }

  var loader = new THREE.TextureLoader();
  var loadPromises = [];

  // Load all 6 character sprite sheets
  for (var i = 1; i <= 6; i++) {
    (function(charIndex) {
      var path = '/assets/sprites/character-' + charIndex + '-spritesheet.png';
      var promise = new Promise(function(resolve, reject) {
        loader.load(
          path,
          function(texture) {
            // Configure texture for sprite sheet usage
            texture.magFilter = THREE.NearestFilter;  // Pixel-perfect rendering
            texture.minFilter = THREE.NearestFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;

            // Set up UV repeat for single frame display
            var frameU = SPRITE_CONFIG.frameWidth / SPRITE_CONFIG.textureWidth;
            var frameV = SPRITE_CONFIG.frameHeight / SPRITE_CONFIG.textureHeight;
            texture.repeat.set(frameU, frameV);

            resolve(texture);
          },
          undefined,
          function(error) {
            reject(new Error('Failed to load sprite: ' + path));
          }
        );
      });
      loadPromises.push(promise);
    })(i);
  }

  // Store promise and wait for all textures to load
  loadPromise = Promise.all(loadPromises).then(function(textures) {
    characterTextures = textures;
    texturesLoaded = true;
    return textures;
  });

  return loadPromise;
}

/**
 * Get the texture for a specific character
 * @param {number} characterId - Character ID (0-5)
 * @returns {THREE.Texture|null} The character's texture, or null if not loaded
 */
function getCharacterTexture(characterId) {
  if (!texturesLoaded || characterId < 0 || characterId >= characterTextures.length) {
    return null;
  }
  return characterTextures[characterId];
}

/**
 * Check if sprites are loaded
 * @returns {boolean} True if all textures are loaded
 */
function areSpritesLoaded() {
  return texturesLoaded;
}

/**
 * Get total number of character sprites
 * @returns {number} Number of available character sprites
 */
function getCharacterCount() {
  return characterTextures.length;
}

// Export public API
export default {
  loadSprites: loadSprites,
  getCharacterTexture: getCharacterTexture,
  areSpritesLoaded: areSpritesLoaded,
  getCharacterCount: getCharacterCount,
  SPRITE_CONFIG: SPRITE_CONFIG
};

export { loadSprites, getCharacterTexture, areSpritesLoaded, getCharacterCount, SPRITE_CONFIG };
