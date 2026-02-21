# Character Sprite Sheets

This directory contains pixel-art sprite sheets for player characters in the Music Club game.

## Sprite Sheet Specifications

Each character sprite sheet must follow these exact specifications:

### File Format
- **Format**: PNG with transparency (alpha channel)
- **Color Mode**: RGBA
- **Naming**: `character-N-spritesheet.png` where N is 1-6

### Dimensions
- **Frame Size**: 32x32 pixels per frame
- **Grid Layout**: 4 rows × 4 columns
- **Total Size**: 128x128 pixels (32 × 4 = 128)

### Layout Structure

```
┌────────┬────────┬────────┬────────┐
│ N-Idle │ N-Walk1│ N-Walk2│ N-Walk3│  Row 0: North (back view, -Y)
├────────┼────────┼────────┼────────┤
│ S-Idle │ S-Walk1│ S-Walk2│ S-Walk3│  Row 1: South (front view, +Y)
├────────┼────────┼────────┼────────┤
│ E-Idle │ E-Walk1│ E-Walk2│ E-Walk3│  Row 2: East (right side, +X)
├────────┼────────┼────────┼────────┤
│ W-Idle │ W-Walk1│ W-Walk2│ W-Walk3│  Row 3: West (left side, -X)
└────────┴────────┴────────┴────────┘
```

### Direction Mapping
- **Row 0 (North)**: Character facing away (back view), moving up (-Y direction)
- **Row 1 (South)**: Character facing toward camera (front view), moving down (+Y direction)
- **Row 2 (East)**: Character facing right, moving right (+X direction)
- **Row 3 (West)**: Character facing left, moving left (-X direction)

### Animation Frames
- **Column 0**: Idle/Standing animation frame
- **Columns 1-3**: Walk cycle animation frames
- **Animation Speed**: 8 FPS (frames per second)
- **Walk Cycle**: 3 frames that loop when character is moving

## Character Design Guidelines

### Visual Style
- **Art Style**: Pixel art with clean lines and limited color palette
- **Aesthetic**: Isometric club/casual theme - think of characters you'd see at a music club
- **Diversity**: Each of the 6 characters should be visually distinct

### Design Considerations
1. **Readable at Small Size**: Characters will be rendered at sprite size, so keep designs simple
2. **Clear Silhouettes**: Each character should be recognizable by silhouette alone
3. **Color Palette**: Use 4-8 colors per character for clean pixel art look
4. **Consistency**: All 6 characters should feel like they belong in the same game world

### Character Variation Ideas
- Different hair styles/colors
- Different clothing (casual club attire)
- Different body types
- Different accessories (hats, glasses, etc.)
- Different skin tones

## Animation Guidelines

### Idle Animation
- Column 0 of each row
- Can be a simple standing pose
- Should face the correct direction for the row

### Walk Animation
- Columns 1-3 of each row
- Should show a walking motion (legs alternating)
- Frame 2 (column 1) typically shows a neutral/middle pose
- Frames 1 and 3 (columns 0 and 2) show left and right leg forward
- Keep upper body relatively stable, animate legs primarily

### Animation Timing
- Each frame displays for 125ms (8 FPS)
- Walk cycle loops: Frame 1 → Frame 2 → Frame 3 → Frame 1...
- Idle frame displays continuously when not moving

## Required Sprite Sheets

You must create all 6 character sprite sheets:

1. ✅ `character-1-spritesheet.png` - Character 1 design
2. ⏳ `character-2-spritesheet.png` - Character 2 design
3. ⏳ `character-3-spritesheet.png` - Character 3 design
4. ⏳ `character-4-spritesheet.png` - Character 4 design
5. ⏳ `character-5-spritesheet.png` - Character 5 design
6. ⏳ `character-6-spritesheet.png` - Character 6 design

## Creating Sprite Sheets

### Recommended Tools
- **Aseprite** (paid, best for pixel art): https://www.aseprite.org/
- **Piskel** (free, web-based): https://www.piskelapp.com/
- **GraphicsGale** (free): https://graphicsgale.com/
- **LibreSprite** (free, Aseprite fork): https://libresprite.github.io/

### Workflow
1. Create a new 128×128 canvas with transparency
2. Enable grid overlay with 32×32 grid
3. Draw idle pose for south (front) direction first
4. Create 3 walk frames for south direction
5. Duplicate and modify for other 3 directions (north, east, west)
6. Export as PNG with transparency
7. Verify file is exactly 128×128 pixels

### Quality Checklist
- [ ] File is 128×128 pixels exactly
- [ ] PNG format with transparency
- [ ] All 16 frames (4 rows × 4 columns) are drawn
- [ ] Each frame is centered in its 32×32 grid cell
- [ ] Walk animation shows clear leg movement
- [ ] All 4 directions face the correct way
- [ ] Character is visually distinct from other characters
- [ ] Color palette is cohesive and readable

## Technical Integration

These sprite sheets are loaded by `public/js/sprites.js` using Three.js TextureLoader:

```javascript
// The sprite system will:
1. Load all 6 sprite sheets on game init
2. Assign random character ID (0-5) to each player on join
3. Use texture.offset to select the correct frame
4. Update frame based on player direction and movement state
```

### UV Coordinate Calculation
```javascript
// Each frame is 32/128 = 0.25 of the texture
const frameSize = 0.25;
const offsetX = animationFrame * frameSize;  // Column 0-3
const offsetY = directionRow * frameSize;    // Row 0-3 (N/S/E/W)
```

## Examples and References

### Pixel Art Character References
- **Stardew Valley**: Great example of simple but expressive pixel art characters
- **Celeste**: Clean pixel art with good animation
- **Enter the Gungeon**: Distinct character silhouettes

### Color Palette Resources
- **Lospec**: https://lospec.com/palette-list (find 8-color palettes)
- **DawnBringer's 16 Palette**: Classic pixel art palette

---

**Note**: Sprite creation requires pixel art tools. This README serves as the specification for creating the required sprite sheets. Once created, place all PNG files in this directory following the naming convention above.
