#!/usr/bin/env python3
"""
Generate character sprite sheets with different color variations
"""
from PIL import Image
import os

def create_color_variation(base_image_path, output_path, color_map):
    """
    Create a color variation of a sprite sheet by replacing specific colors

    Args:
        base_image_path: Path to the base sprite sheet
        output_path: Path to save the new sprite sheet
        color_map: Dictionary mapping old RGB tuples to new RGB tuples
    """
    # Open the base image
    img = Image.open(base_image_path).convert('RGBA')
    pixels = img.load()

    width, height = img.size

    # Process each pixel
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]

            # Check if this pixel color should be replaced
            for old_color, new_color in color_map.items():
                # Allow for slight variations in color matching
                if (abs(r - old_color[0]) <= 5 and
                    abs(g - old_color[1]) <= 5 and
                    abs(b - old_color[2]) <= 5 and
                    a > 0):  # Only replace non-transparent pixels
                    pixels[x, y] = new_color + (a,)
                    break

    # Save the new image
    img.save(output_path)
    print(f"Created {output_path}")

# Base sprite sheet
base_sprite = './public/assets/sprites/character-1-spritesheet.png'

# Define color variations for each character
# Character 1: Blue shirt, blue pants (original)
# Character 2: Red shirt, black pants
# Character 3: Green shirt, brown pants
# Character 4: Purple shirt, gray pants
# Character 5: Yellow shirt, blue pants
# Character 6: Orange shirt, green pants

color_variations = [
    {
        'output': './public/assets/sprites/character-2-spritesheet.png',
        'colors': {
            (66, 134, 244): (220, 50, 50),    # Blue shirt -> Red shirt
            (33, 100, 200): (180, 30, 30),    # Dark blue -> Dark red
            (50, 117, 222): (200, 40, 40),    # Medium blue -> Medium red
            (82, 145, 255): (240, 70, 70),    # Light blue -> Light red
            (41, 108, 211): (33, 33, 33),     # Pants blue -> Black
            (25, 83, 166): (20, 20, 20),      # Dark pants -> Dark black
        }
    },
    {
        'output': './public/assets/sprites/character-3-spritesheet.png',
        'colors': {
            (66, 134, 244): (50, 180, 50),    # Blue shirt -> Green shirt
            (33, 100, 200): (30, 140, 30),    # Dark blue -> Dark green
            (50, 117, 222): (40, 160, 40),    # Medium blue -> Medium green
            (82, 145, 255): (70, 200, 70),    # Light blue -> Light green
            (41, 108, 211): (101, 67, 33),    # Pants blue -> Brown
            (25, 83, 166): (80, 52, 25),      # Dark pants -> Dark brown
        }
    },
    {
        'output': './public/assets/sprites/character-4-spritesheet.png',
        'colors': {
            (66, 134, 244): (150, 50, 200),   # Blue shirt -> Purple shirt
            (33, 100, 200): (110, 30, 150),   # Dark blue -> Dark purple
            (50, 117, 222): (130, 40, 175),   # Medium blue -> Medium purple
            (82, 145, 255): (170, 70, 220),   # Light blue -> Light purple
            (41, 108, 211): (120, 120, 120),  # Pants blue -> Gray
            (25, 83, 166): (90, 90, 90),      # Dark pants -> Dark gray
        }
    },
    {
        'output': './public/assets/sprites/character-5-spritesheet.png',
        'colors': {
            (66, 134, 244): (255, 215, 0),    # Blue shirt -> Yellow shirt
            (33, 100, 200): (200, 170, 0),    # Dark blue -> Dark yellow
            (50, 117, 222): (230, 192, 0),    # Medium blue -> Medium yellow
            (82, 145, 255): (255, 235, 50),   # Light blue -> Light yellow
            (41, 108, 211): (50, 100, 200),   # Pants blue -> Blue (keep blue)
            (25, 83, 166): (30, 75, 160),     # Dark pants -> Dark blue
        }
    },
    {
        'output': './public/assets/sprites/character-6-spritesheet.png',
        'colors': {
            (66, 134, 244): (255, 140, 0),    # Blue shirt -> Orange shirt
            (33, 100, 200): (200, 100, 0),    # Dark blue -> Dark orange
            (50, 117, 222): (230, 120, 0),    # Medium blue -> Medium orange
            (82, 145, 255): (255, 160, 50),   # Light blue -> Light orange
            (41, 108, 211): (34, 139, 34),    # Pants blue -> Forest green
            (25, 83, 166): (25, 100, 25),     # Dark pants -> Dark green
        }
    },
]

# Create all variations
for variation in color_variations:
    create_color_variation(base_sprite, variation['output'], variation['colors'])

print("\nAll sprite sheets created successfully!")
print("Total sprite sheets: 6 (including character-1)")
