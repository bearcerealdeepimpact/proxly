const fs = require('fs');
const path = require('path');

/**
 * Simple PNG color replacement utility
 * This script creates color variations of character sprites by modifying RGB values
 */

// Helper function to read PNG file as buffer
function readPNG(filePath) {
    return fs.readFileSync(filePath);
}

// Helper function to write PNG buffer to file
function writePNG(filePath, buffer) {
    fs.writeFileSync(filePath, buffer);
}

/**
 * Replace colors in a PNG file buffer
 * @param {Buffer} pngBuffer - Original PNG file buffer
 * @param {Object} colorMap - Map of old RGB to new RGB colors
 * @returns {Buffer} - Modified PNG file buffer
 */
function replaceColors(pngBuffer, colorMap) {
    // Create a copy of the buffer
    const newBuffer = Buffer.from(pngBuffer);

    // PNG files have IDAT chunks containing the image data
    // For a simple approach, we'll scan through and replace color byte sequences
    // Note: This is a simplified approach for small sprite sheets

    for (let i = 0; i < newBuffer.length - 3; i++) {
        // Check each color mapping
        for (const [oldColor, newColor] of Object.entries(colorMap)) {
            const [oldR, oldG, oldB] = oldColor.split(',').map(Number);
            const [newR, newG, newB] = newColor.split(',').map(Number);

            // Check if current position matches old color (with tolerance)
            if (Math.abs(newBuffer[i] - oldR) <= 10 &&
                Math.abs(newBuffer[i + 1] - oldG) <= 10 &&
                Math.abs(newBuffer[i + 2] - oldB) <= 10) {

                // Replace with new color
                newBuffer[i] = newR;
                newBuffer[i + 1] = newG;
                newBuffer[i + 2] = newB;
            }
        }
    }

    return newBuffer;
}

// Base sprite path
const spritesDir = path.join(__dirname, 'public', 'assets', 'sprites');
const baseSprite = path.join(spritesDir, 'character-1-spritesheet.png');

// Color variations for each character
// Format: 'oldR,oldG,oldB': 'newR,newG,newB'
const variations = [
    {
        name: 'character-2-spritesheet.png',
        colorMap: {
            '66,134,244': '220,50,50',      // Blue -> Red
            '33,100,200': '180,30,30',      // Dark blue -> Dark red
            '50,117,222': '200,40,40',      // Medium blue -> Medium red
            '82,145,255': '240,70,70',      // Light blue -> Light red
            '41,108,211': '33,33,33',       // Pants -> Black
            '25,83,166': '20,20,20',        // Dark pants -> Dark black
        }
    },
    {
        name: 'character-3-spritesheet.png',
        colorMap: {
            '66,134,244': '50,180,50',      // Blue -> Green
            '33,100,200': '30,140,30',      // Dark blue -> Dark green
            '50,117,222': '40,160,40',      // Medium blue -> Medium green
            '82,145,255': '70,200,70',      // Light blue -> Light green
            '41,108,211': '101,67,33',      // Pants -> Brown
            '25,83,166': '80,52,25',        // Dark pants -> Dark brown
        }
    },
    {
        name: 'character-4-spritesheet.png',
        colorMap: {
            '66,134,244': '150,50,200',     // Blue -> Purple
            '33,100,200': '110,30,150',     // Dark blue -> Dark purple
            '50,117,222': '130,40,175',     // Medium blue -> Medium purple
            '82,145,255': '170,70,220',     // Light blue -> Light purple
            '41,108,211': '120,120,120',    // Pants -> Gray
            '25,83,166': '90,90,90',        // Dark pants -> Dark gray
        }
    },
    {
        name: 'character-5-spritesheet.png',
        colorMap: {
            '66,134,244': '255,215,0',      // Blue -> Yellow
            '33,100,200': '200,170,0',      // Dark blue -> Dark yellow
            '50,117,222': '230,192,0',      // Medium blue -> Medium yellow
            '82,145,255': '255,235,50',     // Light blue -> Light yellow
            '41,108,211': '50,100,200',     // Pants -> Blue
            '25,83,166': '30,75,160',       // Dark pants -> Dark blue
        }
    },
    {
        name: 'character-6-spritesheet.png',
        colorMap: {
            '66,134,244': '255,140,0',      // Blue -> Orange
            '33,100,200': '200,100,0',      // Dark blue -> Dark orange
            '50,117,222': '230,120,0',      // Medium blue -> Medium orange
            '82,145,255': '255,160,50',     // Light blue -> Light orange
            '41,108,211': '34,139,34',      // Pants -> Forest green
            '25,83,166': '25,100,25',       // Dark pants -> Dark green
        }
    }
];

// Read the base sprite
const baseSpriteBuffer = readPNG(baseSprite);

// Create variations
console.log('Creating sprite variations...');
variations.forEach((variation, index) => {
    const outputPath = path.join(spritesDir, variation.name);
    const modifiedBuffer = replaceColors(baseSpriteBuffer, variation.colorMap);
    writePNG(outputPath, modifiedBuffer);
    console.log(`✓ Created ${variation.name}`);
});

console.log('\n✓ All sprite variations created successfully!');
console.log('Total sprite sheets: 6 (including character-1)');
