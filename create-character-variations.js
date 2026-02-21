#!/usr/bin/env node
/**
 * Character Sprite Variation Generator
 *
 * Creates 5 distinct character sprite variations from character-1-spritesheet.png
 * by replacing colors to create visually distinct characters.
 *
 * QA Fix Session 2 - Fix for duplicate sprite issue
 */

const { Jimp } = require('jimp');
const path = require('path');

// Color replacement schemes for each character
const CHARACTER_VARIATIONS = [
  {
    id: 2,
    name: 'Red/Orange Character',
    description: 'Red hair, orange/warm tones',
    colorMap: {
      // Map blue tones to red/orange tones
      '#4a7ba7': '#d95763', // Blue → Red
      '#6b9dc2': '#e67e87', // Light blue → Light red
      '#2d5a7b': '#b73d47', // Dark blue → Dark red
      '#8bb4d6': '#f29ca4', // Very light blue → Pink
      // Map dark pants to brown
      '#3a3a3a': '#6b4423', // Dark gray → Brown
      '#2a2a2a': '#4a2f1a', // Very dark → Dark brown
    }
  },
  {
    id: 3,
    name: 'Yellow/Blonde Character',
    description: 'Blonde hair, warm tones',
    colorMap: {
      // Map blue tones to yellow/blonde tones
      '#4a7ba7': '#f4d03f', // Blue → Yellow
      '#6b9dc2': '#f9e79f', // Light blue → Light yellow
      '#2d5a7b': '#d4a017', // Dark blue → Dark yellow/gold
      '#8bb4d6': '#fcf3cf', // Very light blue → Cream
      // Map dark pants to green
      '#3a3a3a': '#27ae60', // Dark gray → Green
      '#2a2a2a': '#1e8449', // Very dark → Dark green
    }
  },
  {
    id: 4,
    name: 'Brown Character',
    description: 'Dark brown hair, earthy tones',
    colorMap: {
      // Map blue tones to brown tones
      '#4a7ba7': '#8b4513', // Blue → Saddle brown
      '#6b9dc2': '#a0522d', // Light blue → Sienna
      '#2d5a7b': '#654321', // Dark blue → Dark brown
      '#8bb4d6': '#d2691e', // Very light blue → Chocolate
      // Map dark pants to blue jeans
      '#3a3a3a': '#2e4053', // Dark gray → Blue
      '#2a2a2a': '#1c2833', // Very dark → Dark blue
    }
  },
  {
    id: 5,
    name: 'White/Silver Character',
    description: 'White/silver hair, cool tones',
    colorMap: {
      // Map blue tones to white/silver tones
      '#4a7ba7': '#d5d8dc', // Blue → Light gray
      '#6b9dc2': '#ecf0f1', // Light blue → Very light gray
      '#2d5a7b': '#95a5a6', // Dark blue → Medium gray
      '#8bb4d6': '#f8f9f9', // Very light blue → Almost white
      // Map dark pants to red
      '#3a3a3a': '#c0392b', // Dark gray → Red
      '#2a2a2a': '#922b21', // Very dark → Dark red
    }
  },
  {
    id: 6,
    name: 'Black Character',
    description: 'Black hair, cool tones',
    colorMap: {
      // Map blue tones to black/dark gray tones
      '#4a7ba7': '#34495e', // Blue → Dark slate
      '#6b9dc2': '#5d6d7e', // Light blue → Medium slate
      '#2d5a7b': '#1c2833', // Dark blue → Very dark
      '#8bb4d6': '#85929e', // Very light blue → Light slate
      // Map dark pants to orange/teal
      '#3a3a3a': '#d68910', // Dark gray → Orange
      '#2a2a2a': '#ba6f09', // Very dark → Dark orange
    }
  }
];

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Check if two colors are similar (within threshold)
 */
function colorsSimilar(color1, color2, threshold = 20) {
  const dr = Math.abs(color1.r - color2.r);
  const dg = Math.abs(color1.g - color2.g);
  const db = Math.abs(color1.b - color2.b);
  return dr <= threshold && dg <= threshold && db <= threshold;
}

/**
 * Replace colors in an image based on color map
 */
async function replaceColors(sourceImage, colorMap) {
  const image = sourceImage.clone();

  // Convert color map from hex to RGB
  const rgbColorMap = {};
  for (const [fromHex, toHex] of Object.entries(colorMap)) {
    rgbColorMap[fromHex] = {
      from: hexToRgb(fromHex),
      to: hexToRgb(toHex)
    };
  }

  // Scan all pixels
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
    const red = this.bitmap.data[idx + 0];
    const green = this.bitmap.data[idx + 1];
    const blue = this.bitmap.data[idx + 2];
    const alpha = this.bitmap.data[idx + 3];

    // Skip transparent pixels
    if (alpha < 10) return;

    const currentColor = { r: red, g: green, b: blue };

    // Check each color in the map
    for (const mapping of Object.values(rgbColorMap)) {
      if (colorsSimilar(currentColor, mapping.from, 30)) {
        // Replace with new color
        this.bitmap.data[idx + 0] = mapping.to.r;
        this.bitmap.data[idx + 1] = mapping.to.g;
        this.bitmap.data[idx + 2] = mapping.to.b;
        // Keep alpha unchanged
        break;
      }
    }
  });

  return image;
}

/**
 * Main function to create all character variations
 */
async function createCharacterVariations() {
  console.log('🎨 Character Sprite Variation Generator');
  console.log('======================================\n');

  const sourceFile = path.join(__dirname, 'public/assets/sprites/character-1-spritesheet.png');

  try {
    // Load source image
    console.log(`📂 Loading source: ${sourceFile}`);
    const sourceImage = await Jimp.read(sourceFile);
    console.log(`✓ Loaded: ${sourceImage.bitmap.width}x${sourceImage.bitmap.height} PNG\n`);

    // Create each variation
    for (const variation of CHARACTER_VARIATIONS) {
      console.log(`🎨 Creating Character ${variation.id}: ${variation.name}`);
      console.log(`   ${variation.description}`);

      // Replace colors
      const newImage = await replaceColors(sourceImage, variation.colorMap);

      // Save
      const outputFile = path.join(__dirname, `public/assets/sprites/character-${variation.id}-spritesheet.png`);
      await newImage.write(outputFile);

      const stats = require('fs').statSync(outputFile);
      console.log(`   ✓ Saved: ${outputFile} (${stats.size} bytes)\n`);
    }

    console.log('✅ All character variations created successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify uniqueness: Run comparison checks');
    console.log('2. Visual inspection: Open each PNG to verify distinct appearance');
    console.log('3. Browser test: Start server and verify characters look different\n');

  } catch (error) {
    console.error('❌ Error creating variations:', error);
    process.exit(1);
  }
}

// Run
createCharacterVariations();
