(function () {
  'use strict';

  var canvas = null;
  var ctx = null;

  // Isometric projection constants
  var ISO_ANGLE = Math.PI / 6; // 30 degrees
  var COS_A = Math.cos(ISO_ANGLE);
  var SIN_A = Math.sin(ISO_ANGLE);
  var BASE_TILE_SCALE = 0.7;
  var TILE_SCALE = BASE_TILE_SCALE;
  var HEIGHT_SCALE = 0.5;

  // Zoom state
  var zoomLevel = 1.0;
  var ZOOM_MIN = 0.4;
  var ZOOM_MAX = 1.5;
  var ZOOM_STEP = 0.1;

  // Auto-calculated centering offsets (set in init / recalcOffsets)
  var OFFSET_X = 0;
  var OFFSET_Y = 0;

  // Pattern cache (pre-rendered offscreen canvases)
  var cachedPatterns = {};

  // Player facing direction tracking
  var playerLastPos = {};
  var playerFacing = {};
  var playerWalkPhase = {};  // pid -> cumulative walk phase (radians)
  var playerSpeed = {};      // pid -> smoothed speed

  // Animation state
  var animTime = 0;
  var playerMoveTime = {};   // pid -> timestamp of last movement
  var DANCE_IDLE_MS = 400;   // ms idle before dancing starts
  var DANCE_RAMP_MS = 600;   // ms to ramp up to full dance intensity
  var DANCE_BPM = 140;       // beats per minute
  var DANCE_BEAT_MS = 60000 / DANCE_BPM;

  // ─── EDM Lightshow state machine ──────────────────────────────────────
  // Phases: intro(16bars) -> breakdown(16bars) -> buildup(8bars) -> drop(16bars) -> outro(8bars)
  // 1 bar = 4 beats at 140bpm = ~1714ms
  var LIGHTSHOW_BAR_MS = DANCE_BEAT_MS * 4;
  var LIGHTSHOW_PHASES = [
    { name: 'intro',     bars: 16 },
    { name: 'breakdown', bars: 16 },
    { name: 'buildup',   bars: 8 },
    { name: 'drop',      bars: 16 },
    { name: 'outro',     bars: 8 }
  ];
  var LIGHTSHOW_TOTAL_MS = 0;
  var LIGHTSHOW_PHASE_STARTS = [];
  (function () {
    var offset = 0;
    for (var i = 0; i < LIGHTSHOW_PHASES.length; i++) {
      LIGHTSHOW_PHASE_STARTS.push(offset);
      offset += LIGHTSHOW_PHASES[i].bars * LIGHTSHOW_BAR_MS;
    }
    LIGHTSHOW_TOTAL_MS = offset;
  })();

  function getLightshowState(time) {
    var pos = time % LIGHTSHOW_TOTAL_MS;
    var phase = LIGHTSHOW_PHASES[0];
    var phaseStart = 0;
    for (var i = LIGHTSHOW_PHASES.length - 1; i >= 0; i--) {
      if (pos >= LIGHTSHOW_PHASE_STARTS[i]) {
        phase = LIGHTSHOW_PHASES[i];
        phaseStart = LIGHTSHOW_PHASE_STARTS[i];
        break;
      }
    }
    var phaseMs = phase.bars * LIGHTSHOW_BAR_MS;
    var phaseProgress = (pos - phaseStart) / phaseMs; // 0..1
    var beatInPhase = (pos - phaseStart) / DANCE_BEAT_MS;
    var barInPhase = (pos - phaseStart) / LIGHTSHOW_BAR_MS;
    var beat = pos / DANCE_BEAT_MS;
    return {
      name: phase.name,
      progress: phaseProgress,
      beat: beat,
      beatInPhase: beatInPhase,
      barInPhase: barInPhase,
      totalBars: phase.bars
    };
  }

  var COLORS = {
    FLOOR: '#1a1a1e',
    FLOOR_EDGE: '#111114',
    WALL_TOP: '#555555',
    WALL_FRONT: '#3a3a3a',
    WALL_SIDE: '#2a2a2a',
    DJ_BOOTH_TOP: '#222222',
    DJ_BOOTH_FRONT: '#1a1a1a',
    DJ_BOOTH_SIDE: '#111111',
    DANCE_FLOOR: '#1e1a22',
    TABLE_TOP: '#333333',
    TABLE_SIDE: '#222222',
    TABLE_HIGHLIGHT: '#444444',
    BAR_TOP: '#2a1a0a',
    BAR_FRONT: '#1a0f05',
    BAR_SIDE: '#120a02',
    BAR_HIGHLIGHT: '#3a2a1a',
    DJ_COLOR: '#ddddcc',
    LOCAL_PLAYER: '#4488ff',
    REMOTE_COLORS: ['#ff6644', '#44cc66', '#cc44cc', '#cccc44', '#44cccc', '#ff8844'],
    NAME_TEXT: '#ffffff',
    NAME_SHADOW: '#000000',
    SHADOW: 'rgba(0,0,0,0.3)'
  };

  var DJ_X = 400;
  var DJ_Y = 35;

  var LAYOUT = {
    WALL_THICKNESS: 10,
    WALL_HEIGHT: 40,
    DJ_BOOTH_X: 300,
    DJ_BOOTH_Y: 15,
    DJ_BOOTH_W: 200,
    DJ_BOOTH_H: 60,
    DJ_BOOTH_ELEVATION: 10,
    DJ_DESK_X: 340,
    DJ_DESK_Y: 30,
    DJ_DESK_W: 120,
    DJ_DESK_H: 30,
    DJ_DESK_ELEVATION: 5,
    SPEAKER_LEFT: { x: 210, y: 20 },
    SPEAKER_RIGHT: { x: 590, y: 20 },
    DANCE_FLOOR_X: 100,
    DANCE_FLOOR_Y: 120,
    DANCE_FLOOR_W: 600,
    DANCE_FLOOR_H: 350,
    BAR_X: 60,
    BAR_Y: 460,
    BAR_W: 180,
    BAR_H: 30,
    BAR_ELEVATION: 18,
    TABLE_RADIUS: 10,
    TABLE_ELEVATION: 20,
    TABLES: [
      { x: 100, y: 300 },
      { x: 700, y: 300 }
    ],
    PIPES: [
      { y: 8, xStart: 50, xEnd: 750 },
      { y: 5, xStart: 100, xEnd: 700 },
      { y: 2, xStart: 150, xEnd: 650 }
    ],
    LED_WALL_X: 240,
    LED_WALL_Y: 10,
    LED_WALL_W: 320,
    LED_WALL_ELEV_BOTTOM: 5,
    LED_WALL_ELEV_TOP: 38,
    LED_WALL_COLS: 12,
    LED_WALL_ROWS: 7
  };

  // ─── Utility functions ────────────────────────────────────────────────

  function darkenColor(hex, factor) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.round(r * factor);
    g = Math.round(g * factor);
    b = Math.round(b * factor);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function lightenColor(hex, factor) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.round(r + (255 - r) * factor));
    g = Math.min(255, Math.round(g + (255 - g) * factor));
    b = Math.min(255, Math.round(b + (255 - b) * factor));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Raw projection without offsets (for offset calculation)
  function worldToScreenRaw(wx, wy) {
    return {
      x: (wx - wy) * COS_A * TILE_SCALE,
      y: (wx + wy) * SIN_A * TILE_SCALE
    };
  }

  function worldToScreen(wx, wy) {
    var sx = (wx - wy) * COS_A * TILE_SCALE + OFFSET_X;
    var sy = (wx + wy) * SIN_A * TILE_SCALE + OFFSET_Y;
    return { x: sx, y: sy };
  }

  function worldRectToIsoDiamond(rx, ry, rw, rh) {
    return [
      worldToScreen(rx, ry),
      worldToScreen(rx + rw, ry),
      worldToScreen(rx + rw, ry + rh),
      worldToScreen(rx, ry + rh)
    ];
  }

  function hashCode(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  // ─── Zoom / offset management ────────────────────────────────────────

  function recalcOffsets(centerWX, centerWY) {
    TILE_SCALE = BASE_TILE_SCALE * zoomLevel;

    if (centerWX !== undefined && centerWY !== undefined) {
      // Center view on this world point
      var rawCenter = worldToScreenRaw(centerWX, centerWY);
      OFFSET_X = canvas.width / 2 - rawCenter.x;
      OFFSET_Y = canvas.height / 2 - rawCenter.y;
    } else {
      // Fit-to-canvas centering (default at zoom 1.0)
      var C = Game.CONSTANTS;
      var corners = [
        worldToScreenRaw(0, 0),
        worldToScreenRaw(C.WORLD_WIDTH, 0),
        worldToScreenRaw(C.WORLD_WIDTH, C.WORLD_HEIGHT),
        worldToScreenRaw(0, C.WORLD_HEIGHT)
      ];

      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (var i = 0; i < corners.length; i++) {
        if (corners[i].x < minX) minX = corners[i].x;
        if (corners[i].x > maxX) maxX = corners[i].x;
        if (corners[i].y < minY) minY = corners[i].y;
        if (corners[i].y > maxY) maxY = corners[i].y;
      }

      var projW = maxX - minX;
      var projH = maxY - minY;
      var extraTop = LAYOUT.WALL_HEIGHT * HEIGHT_SCALE + 20;

      OFFSET_X = (canvas.width - projW) / 2 - minX;
      OFFSET_Y = (canvas.height - projH - extraTop) / 2 - minY + extraTop;
    }
  }

  function setZoom(newLevel, centerWX, centerWY) {
    zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(newLevel * 10) / 10));
    if (Math.abs(zoomLevel - 1.0) < 0.01) {
      zoomLevel = 1.0;
      recalcOffsets();
    } else {
      recalcOffsets(centerWX, centerWY);
    }
  }

  function getZoom() {
    return zoomLevel;
  }

  // ─── Pattern cache ────────────────────────────────────────────────────

  function createConcretePattern() {
    var size = 64;
    var pCanvas = document.createElement('canvas');
    pCanvas.width = size;
    pCanvas.height = size;
    var pCtx = pCanvas.getContext('2d');

    // Gray base
    pCtx.fillStyle = '#1c1c20';
    pCtx.fillRect(0, 0, size, size);

    // Speckle texture (120 random dots)
    for (var i = 0; i < 120; i++) {
      var dx = Math.random() * size;
      var dy = Math.random() * size;
      var brightness = 20 + Math.floor(Math.random() * 16);
      pCtx.fillStyle = 'rgb(' + brightness + ',' + brightness + ',' + (brightness + 2) + ')';
      pCtx.fillRect(dx, dy, 1, 1);
    }

    // 2 subtle crack lines
    pCtx.strokeStyle = 'rgba(0,0,0,0.2)';
    pCtx.lineWidth = 0.5;
    pCtx.beginPath();
    pCtx.moveTo(10, 0);
    pCtx.lineTo(30, 32);
    pCtx.lineTo(20, 64);
    pCtx.stroke();

    pCtx.beginPath();
    pCtx.moveTo(50, 10);
    pCtx.lineTo(55, 40);
    pCtx.lineTo(45, 60);
    pCtx.stroke();

    return pCanvas;
  }

  function createDanceFloorPattern() {
    var size = 64;
    var tileSize = 16;
    var pCanvas = document.createElement('canvas');
    pCanvas.width = size;
    pCanvas.height = size;
    var pCtx = pCanvas.getContext('2d');

    var colors = ['#221133', '#1a2233', '#1a2a1a', '#2a2211'];
    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 4; col++) {
        var ci = (row + col) % colors.length;
        pCtx.fillStyle = colors[ci];
        pCtx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);

        // Subtle inner highlight
        pCtx.strokeStyle = 'rgba(255,255,255,0.04)';
        pCtx.lineWidth = 0.5;
        pCtx.strokeRect(col * tileSize + 1, row * tileSize + 1, tileSize - 2, tileSize - 2);
      }
    }

    return pCanvas;
  }

  function initPatternCache() {
    cachedPatterns.concreteFloor = ctx.createPattern(createConcretePattern(), 'repeat');
    cachedPatterns.danceFloor = ctx.createPattern(createDanceFloorPattern(), 'repeat');
  }

  // ─── Drawing primitives ───────────────────────────────────────────────

  function fillDiamond(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawRaisedBlock(rx, ry, rw, rh, elevation, topColor, frontColor, sideColor) {
    var base = worldRectToIsoDiamond(rx, ry, rw, rh);
    var top = [];
    for (var i = 0; i < base.length; i++) {
      top.push({ x: base[i].x, y: base[i].y - elevation * HEIGHT_SCALE });
    }

    ctx.fillStyle = frontColor;
    ctx.beginPath();
    ctx.moveTo(top[3].x, top[3].y);
    ctx.lineTo(top[2].x, top[2].y);
    ctx.lineTo(base[2].x, base[2].y);
    ctx.lineTo(base[3].x, base[3].y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(top[2].x, top[2].y);
    ctx.lineTo(top[1].x, top[1].y);
    ctx.lineTo(base[1].x, base[1].y);
    ctx.lineTo(base[2].x, base[2].y);
    ctx.closePath();
    ctx.fill();

    fillDiamond(top, topColor);
  }

  function drawRaisedBlockGradient(rx, ry, rw, rh, elevation, topColor, frontColor, sideColor, options) {
    options = options || {};
    var base = worldRectToIsoDiamond(rx, ry, rw, rh);
    var top = [];
    for (var i = 0; i < base.length; i++) {
      top.push({ x: base[i].x, y: base[i].y - elevation * HEIGHT_SCALE });
    }

    // Front face with gradient
    var frontGrad = ctx.createLinearGradient(top[3].x, top[3].y, base[3].x, base[3].y);
    frontGrad.addColorStop(0, lightenColor(frontColor, 0.15));
    frontGrad.addColorStop(1, darkenColor(frontColor, 0.7));
    ctx.fillStyle = frontGrad;
    ctx.beginPath();
    ctx.moveTo(top[3].x, top[3].y);
    ctx.lineTo(top[2].x, top[2].y);
    ctx.lineTo(base[2].x, base[2].y);
    ctx.lineTo(base[3].x, base[3].y);
    ctx.closePath();
    ctx.fill();

    // Right side face with gradient
    var sideGrad = ctx.createLinearGradient(top[1].x, top[1].y, top[2].x, top[2].y);
    sideGrad.addColorStop(0, lightenColor(sideColor, 0.1));
    sideGrad.addColorStop(1, darkenColor(sideColor, 0.8));
    ctx.fillStyle = sideGrad;
    ctx.beginPath();
    ctx.moveTo(top[2].x, top[2].y);
    ctx.lineTo(top[1].x, top[1].y);
    ctx.lineTo(base[1].x, base[1].y);
    ctx.lineTo(base[2].x, base[2].y);
    ctx.closePath();
    ctx.fill();

    // Top face with subtle gradient
    var topGrad = ctx.createLinearGradient(top[0].x, top[0].y, top[2].x, top[2].y);
    topGrad.addColorStop(0, lightenColor(topColor, 0.1));
    topGrad.addColorStop(1, topColor);
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    ctx.lineTo(top[1].x, top[1].y);
    ctx.lineTo(top[2].x, top[2].y);
    ctx.lineTo(top[3].x, top[3].y);
    ctx.closePath();
    ctx.fill();
  }

  function drawIsoEllipse(cx, cy, radiusX, radiusY, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX * TILE_SCALE, radiusY * TILE_SCALE * SIN_A, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSoftShadow(screenX, screenY, radius) {
    var rx = radius * TILE_SCALE;
    var ry = radius * TILE_SCALE * SIN_A;
    var grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, rx);
    grad.addColorStop(0, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Floor drawing ────────────────────────────────────────────────────

  function drawFloor() {
    var C = Game.CONSTANTS;
    var points = worldRectToIsoDiamond(0, 0, C.WORLD_WIDTH, C.WORLD_HEIGHT);

    // Clip to diamond and fill with concrete pattern
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.clip();

    if (cachedPatterns.concreteFloor) {
      ctx.fillStyle = cachedPatterns.concreteFloor;
    } else {
      ctx.fillStyle = COLORS.FLOOR;
    }

    // Fill bounding box of diamond
    var bx = Math.min(points[0].x, points[1].x, points[2].x, points[3].x);
    var by = Math.min(points[0].y, points[1].y, points[2].y, points[3].y);
    var bx2 = Math.max(points[0].x, points[1].x, points[2].x, points[3].x);
    var by2 = Math.max(points[0].y, points[1].y, points[2].y, points[3].y);
    ctx.fillRect(bx, by, bx2 - bx, by2 - by);
    ctx.restore();

    // Floor outline
    ctx.strokeStyle = COLORS.FLOOR_EDGE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var j = 1; j < points.length; j++) {
      ctx.lineTo(points[j].x, points[j].y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawDanceFloor() {
    var L = LAYOUT;
    var points = worldRectToIsoDiamond(L.DANCE_FLOOR_X, L.DANCE_FLOOR_Y, L.DANCE_FLOOR_W, L.DANCE_FLOOR_H);

    // Clip and fill with dance floor pattern
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.clip();

    if (cachedPatterns.danceFloor) {
      ctx.fillStyle = cachedPatterns.danceFloor;
    } else {
      ctx.fillStyle = COLORS.DANCE_FLOOR;
    }

    var bx = Math.min(points[0].x, points[1].x, points[2].x, points[3].x);
    var by = Math.min(points[0].y, points[1].y, points[2].y, points[3].y);
    var bx2 = Math.max(points[0].x, points[1].x, points[2].x, points[3].x);
    var by2 = Math.max(points[0].y, points[1].y, points[2].y, points[3].y);
    ctx.fillRect(bx, by, bx2 - bx, by2 - by);

    // Muted purple glow overlay
    var center = worldToScreen(
      L.DANCE_FLOOR_X + L.DANCE_FLOOR_W / 2,
      L.DANCE_FLOOR_Y + L.DANCE_FLOOR_H / 2
    );
    var glowR = Math.max(bx2 - bx, by2 - by) * 0.6;
    var glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, glowR);
    glow.addColorStop(0, 'rgba(100,40,120,0.12)');
    glow.addColorStop(1, 'rgba(100,40,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(bx, by, bx2 - bx, by2 - by);

    ctx.restore();

    // Border
    ctx.strokeStyle = darkenColor(COLORS.DANCE_FLOOR, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var j = 1; j < points.length; j++) {
      ctx.lineTo(points[j].x, points[j].y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // ─── Wall drawing ─────────────────────────────────────────────────────

  function drawWalls() {
    var C = Game.CONSTANTS;
    var t = LAYOUT.WALL_THICKNESS;
    var w = C.WORLD_WIDTH;
    var h = C.WORLD_HEIGHT;
    var elev = LAYOUT.WALL_HEIGHT;

    // Back wall (top edge) - no brick lines
    drawRaisedBlockGradient(0, 0, w, t, elev, COLORS.WALL_TOP, COLORS.WALL_FRONT, COLORS.WALL_SIDE);

    // Left wall (left edge) - no brick lines
    drawRaisedBlockGradient(0, t, t, h - t, elev, COLORS.WALL_TOP, COLORS.WALL_FRONT, COLORS.WALL_SIDE);
  }

  function drawFrontWalls() {
    var C = Game.CONSTANTS;
    var t = LAYOUT.WALL_THICKNESS;
    var w = C.WORLD_WIDTH;
    var h = C.WORLD_HEIGHT;
    var elev = LAYOUT.WALL_HEIGHT;

    // Right wall - no brick lines
    drawRaisedBlockGradient(w - t, t, t, h - t, elev, COLORS.WALL_TOP, COLORS.WALL_FRONT, COLORS.WALL_SIDE);

    // Bottom wall - no brick lines
    drawRaisedBlockGradient(t, h - t, w - 2 * t, t, elev, COLORS.WALL_TOP, COLORS.WALL_FRONT, COLORS.WALL_SIDE);
  }

  // ─── Exposed pipes (industrial) ────────────────────────────────────────

  function drawExposedPipes() {
    var L = LAYOUT;
    var pipes = L.PIPES;

    for (var p = 0; p < pipes.length; p++) {
      var pipe = pipes[p];
      var pipeElev = LAYOUT.WALL_HEIGHT * (0.4 + p * 0.2);

      var startScreen = worldToScreen(pipe.xStart, pipe.y);
      var endScreen = worldToScreen(pipe.xEnd, pipe.y);
      var liftPx = pipeElev * HEIGHT_SCALE;

      var sy1 = startScreen.y - liftPx;
      var sy2 = endScreen.y - liftPx;

      // Main pipe
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = Math.max(2, 3 * TILE_SCALE);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startScreen.x, sy1);
      ctx.lineTo(endScreen.x, sy2);
      ctx.stroke();

      // Highlight on pipe
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = Math.max(1, 1.5 * TILE_SCALE);
      ctx.beginPath();
      ctx.moveTo(startScreen.x, sy1 - 1);
      ctx.lineTo(endScreen.x, sy2 - 1);
      ctx.stroke();

      // Joint circles at ends and middle
      var joints = [startScreen, endScreen, { x: (startScreen.x + endScreen.x) / 2, y: 0 }];
      var jointYs = [sy1, sy2, (sy1 + sy2) / 2];
      for (var j = 0; j < 3; j++) {
        ctx.fillStyle = '#666666';
        ctx.beginPath();
        ctx.arc(joints[j].x, jointYs[j], Math.max(2, 3.5 * TILE_SCALE), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  // ─── LED Wall (lightshow-driven) ─────────────────────────────────────

  function getLEDPanelColor(col, row, cols, rows, ls) {
    var t = animTime / 1000;
    var beat = ls.beat;
    var beatFrac = beat % 1;
    var onBeat = beatFrac < 0.15 ? 1 : 0;
    var colN = col / (cols - 1);    // 0..1
    var rowN = row / (rows - 1);

    var r, g, b, a;

    switch (ls.name) {
      case 'intro':
        // Gentle blue breathing, panels fade in column by column over the phase
        var fadeIn = Math.min(1, ls.progress * cols - col * 0.8);
        fadeIn = Math.max(0, fadeIn);
        var breathe = 0.4 + Math.sin(t * 1.2 + col * 0.4) * 0.3;
        var bright = fadeIn * breathe;
        r = Math.round(140 * bright);
        g = Math.round(180 * bright);
        b = Math.round(255 * bright);
        a = 1;
        break;

      case 'breakdown':
        // Slow sweeping white/cyan waves, minimal, atmospheric
        var wave = Math.sin(t * 0.8 + colN * Math.PI * 2 - rowN * 1.5);
        var intensity = 0.15 + Math.max(0, wave) * 0.6;
        // Color shifts between white and light blue
        var blueShift = 0.5 + Math.sin(t * 0.3) * 0.5;
        r = Math.round(255 * intensity * (1 - blueShift * 0.4));
        g = Math.round(255 * intensity * (1 - blueShift * 0.2));
        b = Math.round(255 * intensity);
        a = 1;
        break;

      case 'buildup':
        // Accelerating flashes, getting faster and brighter toward end
        // Speed increases from 2Hz to 16Hz
        var speed = 2 + ls.progress * 14;
        var flash = Math.sin(t * speed * Math.PI * 2);
        // Tighten the on-time as we accelerate
        var threshold = 0.5 - ls.progress * 0.4;
        var on = flash > threshold ? 1 : 0;
        // Rising brightness
        var riseB = 0.3 + ls.progress * 0.7;
        // Panels activate from center outward
        var distFromCenter = Math.abs(colN - 0.5) * 2;
        var panelActive = ls.progress > distFromCenter * 0.6 ? 1 : 0;
        var bright2 = on * riseB * panelActive;
        // White with increasing blue
        r = Math.round(255 * bright2 * (0.9 - ls.progress * 0.3));
        g = Math.round(255 * bright2 * (0.9 - ls.progress * 0.2));
        b = Math.round(255 * bright2);
        a = 1;
        break;

      case 'drop':
        // Full energy: bright white/blue/cyan flashing on beat, color sweeps
        var beatPulse = Math.pow(Math.max(0, 1 - beatFrac * 4), 2);
        var sweep = Math.sin(beat * 0.25 + colN * Math.PI * 3);
        var colorMode = Math.floor(beat / 4) % 3;
        var base = 0.25;
        var peak = base + beatPulse * 0.75 + Math.max(0, sweep) * 0.2;
        if (colorMode === 0) {
          // White flash
          r = Math.round(255 * peak);
          g = Math.round(255 * peak);
          b = Math.round(255 * peak);
        } else if (colorMode === 1) {
          // Blue/cyan
          r = Math.round(100 * peak);
          g = Math.round(200 * peak);
          b = Math.round(255 * peak);
        } else {
          // White/light blue alternating columns
          var isBlue = (col + Math.floor(beat / 2)) % 2;
          r = Math.round((isBlue ? 80 : 255) * peak);
          g = Math.round((isBlue ? 160 : 255) * peak);
          b = Math.round(255 * peak);
        }
        a = 1;
        break;

      case 'outro':
        // Fading white/blue glow, panels turn off row by row from top
        var fadeOut = 1 - ls.progress;
        var rowFade = Math.max(0, 1 - (ls.progress * rows - (rows - 1 - row)) * 0.8);
        var glow = fadeOut * rowFade * (0.4 + Math.sin(t * 0.6 + col * 0.3) * 0.2);
        r = Math.round(180 * glow);
        g = Math.round(210 * glow);
        b = Math.round(255 * glow);
        a = 1;
        break;

      default:
        r = 40; g = 60; b = 120; a = 1;
    }

    return { r: Math.min(255, r), g: Math.min(255, g), b: Math.min(255, b), a: a };
  }

  function drawLEDWall() {
    var L = LAYOUT;
    var cols = L.LED_WALL_COLS;
    var rows = L.LED_WALL_ROWS;
    var cellW = L.LED_WALL_W / cols;
    var elevRange = L.LED_WALL_ELEV_TOP - L.LED_WALL_ELEV_BOTTOM;
    var cellElev = elevRange / rows;
    var ls = getLightshowState(animTime);

    // Dark backing panel
    var topLift = L.LED_WALL_ELEV_TOP * HEIGHT_SCALE;
    var botLift = L.LED_WALL_ELEV_BOTTOM * HEIGHT_SCALE;
    var bl = worldToScreen(L.LED_WALL_X, L.LED_WALL_Y + 2);
    var br = worldToScreen(L.LED_WALL_X + L.LED_WALL_W, L.LED_WALL_Y + 2);
    ctx.fillStyle = '#050508';
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y - botLift);
    ctx.lineTo(br.x, br.y - botLift);
    ctx.lineTo(br.x, br.y - topLift);
    ctx.lineTo(bl.x, bl.y - topLift);
    ctx.closePath();
    ctx.fill();

    // Draw grid of LED panels
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var wx = L.LED_WALL_X + col * cellW + cellW * 0.1;
        var panelW = cellW * 0.8;
        var elev = L.LED_WALL_ELEV_BOTTOM + row * cellElev;
        var panelElevH = cellElev * 0.85;

        var pLeft = worldToScreen(wx, L.LED_WALL_Y + 2);
        var pRight = worldToScreen(wx + panelW, L.LED_WALL_Y + 2);
        var liftBot = elev * HEIGHT_SCALE;
        var liftTop = (elev + panelElevH) * HEIGHT_SCALE;

        var c = getLEDPanelColor(col, row, cols, rows, ls);

        // Panel fill
        ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
        ctx.beginPath();
        ctx.moveTo(pLeft.x, pLeft.y - liftBot);
        ctx.lineTo(pRight.x, pRight.y - liftBot);
        ctx.lineTo(pRight.x, pRight.y - liftTop);
        ctx.lineTo(pLeft.x, pLeft.y - liftTop);
        ctx.closePath();
        ctx.fill();

        // Bright bloom per panel (stronger than before)
        var brightness = (c.r + c.g + c.b) / (255 * 3);
        if (brightness > 0.15) {
          var cx = (pLeft.x + pRight.x) / 2;
          var cy = (pLeft.y - liftBot + pLeft.y - liftTop) / 2;
          var glowR = Math.max(6, 14 * TILE_SCALE) * brightness;
          var ga = Math.min(0.4, brightness * 0.5);
          ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + ga.toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Overall wall bloom — big halo behind the wall
    var wallCx = (bl.x + br.x) / 2;
    var wallCy = (bl.y - botLift + bl.y - topLift) / 2;
    var avgColor = getLEDPanelColor(Math.floor(cols / 2), Math.floor(rows / 2), cols, rows, ls);
    var avgBright = (avgColor.r + avgColor.g + avgColor.b) / (255 * 3);
    if (avgBright > 0.1) {
      var haloR = 100 * TILE_SCALE;
      var haloA = avgBright * 0.3;
      var halo = ctx.createRadialGradient(wallCx, wallCy, 0, wallCx, wallCy, haloR);
      halo.addColorStop(0, 'rgba(' + avgColor.r + ',' + avgColor.g + ',' + avgColor.b + ',' + haloA.toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(' + avgColor.r + ',' + avgColor.g + ',' + avgColor.b + ',0)');
      ctx.fillStyle = halo;
      ctx.fillRect(wallCx - haloR, wallCy - haloR, haloR * 2, haloR * 2);
    }
  }

  function drawLEDWallGlow() {
    var L = LAYOUT;
    var ls = getLightshowState(animTime);

    // Get representative colors from the wall
    var cols = L.LED_WALL_COLS;
    var rows = L.LED_WALL_ROWS;
    var cL = getLEDPanelColor(1, 1, cols, rows, ls);
    var cR = getLEDPanelColor(cols - 2, 1, cols, rows, ls);
    var cM = getLEDPanelColor(Math.floor(cols / 2), Math.floor(rows / 2), cols, rows, ls);

    var washR = 180 * TILE_SCALE;

    // Left wash
    var wl = worldToScreen(L.LED_WALL_X + L.LED_WALL_W * 0.25, L.DANCE_FLOOR_Y + L.DANCE_FLOOR_H * 0.3);
    var brightL = (cL.r + cL.g + cL.b) / (255 * 3);
    if (brightL > 0.08) {
      var aL = brightL * 0.25;
      var gL = ctx.createRadialGradient(wl.x, wl.y, 0, wl.x, wl.y, washR);
      gL.addColorStop(0, 'rgba(' + cL.r + ',' + cL.g + ',' + cL.b + ',' + aL.toFixed(3) + ')');
      gL.addColorStop(1, 'rgba(' + cL.r + ',' + cL.g + ',' + cL.b + ',0)');
      ctx.fillStyle = gL;
      ctx.fillRect(wl.x - washR, wl.y - washR, washR * 2, washR * 2);
    }

    // Center wash (strongest)
    var wc = worldToScreen(L.LED_WALL_X + L.LED_WALL_W * 0.5, L.DANCE_FLOOR_Y + L.DANCE_FLOOR_H * 0.4);
    var brightM = (cM.r + cM.g + cM.b) / (255 * 3);
    if (brightM > 0.08) {
      var aM = brightM * 0.35;
      var gM = ctx.createRadialGradient(wc.x, wc.y, 0, wc.x, wc.y, washR * 1.3);
      gM.addColorStop(0, 'rgba(' + cM.r + ',' + cM.g + ',' + cM.b + ',' + aM.toFixed(3) + ')');
      gM.addColorStop(1, 'rgba(' + cM.r + ',' + cM.g + ',' + cM.b + ',0)');
      ctx.fillStyle = gM;
      ctx.fillRect(wc.x - washR * 1.3, wc.y - washR, washR * 2.6, washR * 2);
    }

    // Right wash
    var wr = worldToScreen(L.LED_WALL_X + L.LED_WALL_W * 0.75, L.DANCE_FLOOR_Y + L.DANCE_FLOOR_H * 0.3);
    var brightR = (cR.r + cR.g + cR.b) / (255 * 3);
    if (brightR > 0.08) {
      var aR = brightR * 0.25;
      var gR = ctx.createRadialGradient(wr.x, wr.y, 0, wr.x, wr.y, washR);
      gR.addColorStop(0, 'rgba(' + cR.r + ',' + cR.g + ',' + cR.b + ',' + aR.toFixed(3) + ')');
      gR.addColorStop(1, 'rgba(' + cR.r + ',' + cR.g + ',' + cR.b + ',0)');
      ctx.fillStyle = gR;
      ctx.fillRect(wr.x - washR, wr.y - washR, washR * 2, washR * 2);
    }
  }

  function drawStrobe() {
    var ls = getLightshowState(animTime);
    if (ls.name !== 'buildup') return;

    // Strobe activates in the last 60% of the buildup, getting faster
    if (ls.progress < 0.4) return;

    var strobeProgress = (ls.progress - 0.4) / 0.6; // 0..1 within strobe zone
    // Frequency ramps from 4Hz to 20Hz
    var freq = 4 + strobeProgress * 16;
    var t = animTime / 1000;
    var flash = Math.sin(t * freq * Math.PI * 2);

    // Sharp on/off — tighter threshold as frequency increases
    var threshold = 0.7 - strobeProgress * 0.3;
    if (flash < threshold) return;

    // Intensity ramps up
    var intensity = 0.15 + strobeProgress * 0.45;

    ctx.fillStyle = 'rgba(255,255,255,' + intensity.toFixed(3) + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ─── DJ Booth ──────────────────────────────────────────────────────────

  function drawSpotlight(wx, wy, color, radius, elevation) {
    var screen = worldToScreen(wx, wy);
    var sy = screen.y - (elevation || 0) * HEIGHT_SCALE;
    var rx = radius * TILE_SCALE;
    var ry = radius * TILE_SCALE * SIN_A;

    var grad = ctx.createRadialGradient(screen.x, sy, 0, screen.x, sy, rx);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(screen.x, sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEquipmentRect(wx, wy, ww, wh, liftPx, fill, stroke) {
    var pts = worldRectToIsoDiamond(wx, wy, ww, wh);
    var lifted = [];
    for (var i = 0; i < pts.length; i++) {
      lifted.push({ x: pts[i].x, y: pts[i].y - liftPx });
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(lifted[0].x, lifted[0].y);
    for (var j = 1; j < lifted.length; j++) {
      ctx.lineTo(lifted[j].x, lifted[j].y);
    }
    ctx.closePath();
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  function drawLEDStrip(boothX, boothFrontY, boothW, boothElev) {
    var ledCount = 12;
    var liftPx = boothElev * HEIGHT_SCALE;
    for (var i = 0; i < ledCount; i++) {
      var t = (i + 0.5) / ledCount;
      var wx = boothX + t * boothW;
      var screen = worldToScreen(wx, boothFrontY);
      var sy = screen.y - liftPx;

      // Color-cycling via HSL based on animTime
      var hue = ((animTime / 20) + i * 30) % 360;
      ctx.fillStyle = 'hsl(' + hue + ', 100%, 55%)';
      ctx.beginPath();
      ctx.arc(screen.x, sy, Math.max(1.5, 2.5 * TILE_SCALE), 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.fillStyle = 'hsla(' + hue + ', 100%, 50%, 0.3)';
      ctx.beginPath();
      ctx.arc(screen.x, sy, Math.max(3, 5 * TILE_SCALE), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDJBooth() {
    var L = LAYOUT;

    // Booth platform (gradient block)
    drawRaisedBlockGradient(
      L.DJ_BOOTH_X, L.DJ_BOOTH_Y, L.DJ_BOOTH_W, L.DJ_BOOTH_H,
      L.DJ_BOOTH_ELEVATION,
      COLORS.DJ_BOOTH_TOP, COLORS.DJ_BOOTH_FRONT, COLORS.DJ_BOOTH_SIDE
    );

    // DJ Desk block on top of booth
    var deskTotalElev = L.DJ_BOOTH_ELEVATION + L.DJ_DESK_ELEVATION;
    drawRaisedBlockGradient(
      L.DJ_DESK_X, L.DJ_DESK_Y, L.DJ_DESK_W, L.DJ_DESK_H,
      deskTotalElev,
      '#2a2a2a', '#1e1e1e', '#161616'
    );

    var deskLift = deskTotalElev * HEIGHT_SCALE;

    // 2 CDJs on desk (left and right)
    drawEquipmentRect(L.DJ_DESK_X + 5, L.DJ_DESK_Y + 5, 25, 20, deskLift, '#111111', '#333333');
    drawEquipmentRect(L.DJ_DESK_X + L.DJ_DESK_W - 30, L.DJ_DESK_Y + 5, 25, 20, deskLift, '#111111', '#333333');

    // Mixer in center
    drawEquipmentRect(L.DJ_DESK_X + 40, L.DJ_DESK_Y + 8, 40, 15, deskLift, '#1a1a1a', '#444444');

    // Laptop behind mixer
    drawEquipmentRect(L.DJ_DESK_X + 35, L.DJ_DESK_Y + 2, 50, 10, deskLift + 2, '#222222', '#555555');

    // Laptop screen glow
    var laptopCenter = worldToScreen(L.DJ_DESK_X + 60, L.DJ_DESK_Y + 7);
    var laptopSy = laptopCenter.y - deskLift - 2;
    ctx.fillStyle = 'rgba(100,150,255,0.15)';
    ctx.beginPath();
    ctx.arc(laptopCenter.x, laptopSy, 8 * TILE_SCALE, 0, Math.PI * 2);
    ctx.fill();

    // LED strip along front edge of booth
    drawLEDStrip(L.DJ_BOOTH_X, L.DJ_BOOTH_Y + L.DJ_BOOTH_H, L.DJ_BOOTH_W, L.DJ_BOOTH_ELEVATION);

    // Warm amber spotlight on DJ area
    drawSpotlight(
      L.DJ_BOOTH_X + L.DJ_BOOTH_W / 2, L.DJ_BOOTH_Y + L.DJ_BOOTH_H / 2,
      'rgba(255,180,80,0.2)', 80, L.DJ_BOOTH_ELEVATION
    );
  }

  // ─── Speaker stacks (big PA rig) ─────────────────────────────────────

  function drawSpeakerCone(screenX, screenY, outerR, s) {
    // Outer ring
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.arc(screenX, screenY, outerR, 0, Math.PI * 2);
    ctx.stroke();
    // Mid ring
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = Math.max(0.8, 1 * s);
    ctx.beginPath();
    ctx.arc(screenX, screenY, outerR * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    // Dust cap
    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.arc(screenX, screenY, outerR * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSpeakerStack(wx, wy) {
    var s = TILE_SCALE;

    // Sub bass (bottom) — widest, 2 stacked subs
    drawRaisedBlockGradient(wx - 22, wy - 14, 44, 28, 16, '#141414', '#111111', '#0d0d0d');
    drawRaisedBlockGradient(wx - 22, wy - 14, 44, 28, 32, '#161616', '#121212', '#0e0e0e');

    // Sub woofers on front face (one per sub cab)
    var subFront = worldToScreen(wx, wy + 14);
    drawSpeakerCone(subFront.x, subFront.y - 8 * HEIGHT_SCALE, 8 * s, s);
    drawSpeakerCone(subFront.x, subFront.y - 24 * HEIGHT_SCALE, 8 * s, s);

    // Main cabs (middle) — 2 stacked, slightly narrower
    drawRaisedBlockGradient(wx - 18, wy - 11, 36, 22, 46, '#1a1a1a', '#151515', '#101010');
    drawRaisedBlockGradient(wx - 18, wy - 11, 36, 22, 58, '#1c1c1c', '#161616', '#111111');

    // Main woofers on front
    var mainFront = worldToScreen(wx, wy + 11);
    drawSpeakerCone(mainFront.x, mainFront.y - 39 * HEIGHT_SCALE, 6 * s, s);
    drawSpeakerCone(mainFront.x, mainFront.y - 52 * HEIGHT_SCALE, 6 * s, s);

    // Top cab (HF horn) — smallest on top
    drawRaisedBlockGradient(wx - 14, wy - 8, 28, 16, 68, '#1e1e1e', '#181818', '#121212');

    // Horn / tweeter on top cab
    var topFront = worldToScreen(wx, wy + 8);
    var topLift = 63 * HEIGHT_SCALE;
    // Horn rectangle
    ctx.fillStyle = '#252525';
    ctx.fillRect(topFront.x - 5 * s, topFront.y - topLift - 3 * s, 10 * s, 6 * s);
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = Math.max(0.5, 0.8 * s);
    ctx.strokeRect(topFront.x - 5 * s, topFront.y - topLift - 3 * s, 10 * s, 6 * s);
    // Horn throat
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.arc(topFront.x, topFront.y - topLift, 2 * s, 0, Math.PI * 2);
    ctx.fill();

    // Rigging hardware detail — metal bracket on top
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = Math.max(1, 1.5 * s);
    var rigTop = worldToScreen(wx, wy);
    var rigLift = 68 * HEIGHT_SCALE;
    ctx.beginPath();
    ctx.moveTo(rigTop.x - 3 * s, rigTop.y - rigLift - 2 * s);
    ctx.lineTo(rigTop.x + 3 * s, rigTop.y - rigLift - 2 * s);
    ctx.stroke();
  }

  // ─── Atmospheric lights (lightshow-synced) ─────────────────────────────

  function drawAtmosphericLights() {
    var t = animTime / 1000;
    var ls = getLightshowState(animTime);
    var beatFrac = ls.beat % 1;
    var onBeat = Math.pow(Math.max(0, 1 - beatFrac * 5), 2);

    // Base intensities depend on lightshow phase
    var leftMult, rightMult;
    switch (ls.name) {
      case 'intro':
        leftMult = 0.3 + ls.progress * 0.3;
        rightMult = 0.2 + ls.progress * 0.2;
        break;
      case 'breakdown':
        leftMult = 0.2 + Math.sin(t * 0.5) * 0.15;
        rightMult = 0.2 + Math.sin(t * 0.7 + 1) * 0.15;
        break;
      case 'buildup':
        leftMult = 0.3 + ls.progress * 0.7;
        rightMult = 0.3 + ls.progress * 0.7;
        break;
      case 'drop':
        leftMult = 0.5 + onBeat * 0.5;
        rightMult = 0.5 + onBeat * 0.5;
        break;
      case 'outro':
        leftMult = 0.5 * (1 - ls.progress);
        rightMult = 0.4 * (1 - ls.progress);
        break;
      default:
        leftMult = 0.3;
        rightMult = 0.3;
    }

    var beamR = 100 * TILE_SCALE;

    // Left: blue/cyan beam
    var leftScreen = worldToScreen(200, 280);
    var lA = 0.08 * leftMult + Math.sin(t * 1.5) * 0.03 * leftMult;
    var lgr = ctx.createRadialGradient(leftScreen.x, leftScreen.y, 0, leftScreen.x, leftScreen.y, beamR);
    lgr.addColorStop(0, 'rgba(60,120,255,' + lA.toFixed(3) + ')');
    lgr.addColorStop(1, 'rgba(60,120,255,0)');
    ctx.fillStyle = lgr;
    ctx.fillRect(leftScreen.x - beamR, leftScreen.y - beamR, beamR * 2, beamR * 2);

    // Right: white/light blue beam
    var rightScreen = worldToScreen(600, 280);
    var rA = 0.08 * rightMult + Math.sin(t * 2.0) * 0.03 * rightMult;
    var rgr = ctx.createRadialGradient(rightScreen.x, rightScreen.y, 0, rightScreen.x, rightScreen.y, beamR);
    rgr.addColorStop(0, 'rgba(180,200,255,' + rA.toFixed(3) + ')');
    rgr.addColorStop(1, 'rgba(180,200,255,0)');
    ctx.fillStyle = rgr;
    ctx.fillRect(rightScreen.x - beamR, rightScreen.y - beamR, beamR * 2, beamR * 2);

    // During drop: extra center flash on beat
    if (ls.name === 'drop' && onBeat > 0.3) {
      var centerScreen = worldToScreen(400, 300);
      var cA = onBeat * 0.12;
      var cgr = ctx.createRadialGradient(centerScreen.x, centerScreen.y, 0, centerScreen.x, centerScreen.y, beamR * 1.5);
      cgr.addColorStop(0, 'rgba(220,230,255,' + cA.toFixed(3) + ')');
      cgr.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = cgr;
      ctx.fillRect(centerScreen.x - beamR * 1.5, centerScreen.y - beamR * 1.5, beamR * 3, beamR * 3);
    }
  }

  // ─── Bar drawing ──────────────────────────────────────────────────────

  function drawBottlesOnBar(barX, barY, barW, barH, elevation) {
    var bottleColors = ['#228822', '#cc8800', '#882222', '#2255aa'];
    var spacing = barW / (bottleColors.length + 1);

    for (var i = 0; i < bottleColors.length; i++) {
      var bx = barX + spacing * (i + 1);
      var by = barY + barH * 0.4;
      var screen = worldToScreen(bx, by);
      var sy = screen.y - elevation * HEIGHT_SCALE;
      var s = TILE_SCALE;

      // Bottle body
      ctx.fillStyle = bottleColors[i];
      ctx.fillRect(screen.x - 2 * s, sy - 8 * s, 4 * s, 6 * s);

      // Bottle neck
      ctx.fillRect(screen.x - 1 * s, sy - 12 * s, 2 * s, 4 * s);

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(screen.x - 0.5 * s, sy - 11 * s, 1 * s, 8 * s);
    }
  }

  function drawBarStool(wx, wy) {
    var screen = worldToScreen(wx, wy);
    var s = TILE_SCALE;

    // Shadow
    drawSoftShadow(screen.x, screen.y, 6);

    // Stool leg
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(screen.x, screen.y - 10 * s);
    ctx.stroke();

    // Seat ellipse
    ctx.fillStyle = '#553322';
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - 10 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#332211';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  function drawBar() {
    var L = LAYOUT;

    // Main bar block with gradient
    drawRaisedBlockGradient(
      L.BAR_X, L.BAR_Y, L.BAR_W, L.BAR_H,
      L.BAR_ELEVATION,
      COLORS.BAR_TOP, COLORS.BAR_FRONT, COLORS.BAR_SIDE
    );

    // Highlight strip on top face
    var topPts = worldRectToIsoDiamond(L.BAR_X + 4, L.BAR_Y + 4, L.BAR_W - 8, L.BAR_H - 8);
    var liftedPts = [];
    for (var i = 0; i < topPts.length; i++) {
      liftedPts.push({ x: topPts[i].x, y: topPts[i].y - L.BAR_ELEVATION * HEIGHT_SCALE });
    }
    fillDiamond(liftedPts, COLORS.BAR_HIGHLIGHT);

    // Bottles on top
    drawBottlesOnBar(L.BAR_X, L.BAR_Y, L.BAR_W, L.BAR_H, L.BAR_ELEVATION);

    // 3 bar stools in front
    var stoolY = L.BAR_Y + L.BAR_H + 20;
    var stoolSpacing = L.BAR_W / 4;
    for (var j = 0; j < 3; j++) {
      drawBarStool(L.BAR_X + stoolSpacing * (j + 1), stoolY);
    }
  }

  // ─── Table drawing (standing/cocktail, no chairs) ──────────────────────

  function drawTable(table) {
    var L = LAYOUT;
    var screen = worldToScreen(table.x, table.y);
    var r = L.TABLE_RADIUS;
    var elev = L.TABLE_ELEVATION;
    var liftPx = elev * HEIGHT_SCALE;

    // Soft shadow on ground
    drawSoftShadow(screen.x, screen.y + 2, r + 4);

    // Table leg with gradient - thinner (0.2 multiplier)
    var legWidth = r * TILE_SCALE * 0.2;
    var legTop = screen.y - liftPx;
    var legBot = screen.y;
    var legGrad = ctx.createLinearGradient(screen.x - legWidth, legTop, screen.x + legWidth, legTop);
    legGrad.addColorStop(0, lightenColor(COLORS.TABLE_SIDE, 0.15));
    legGrad.addColorStop(1, darkenColor(COLORS.TABLE_SIDE, 0.7));
    ctx.fillStyle = legGrad;
    ctx.fillRect(screen.x - legWidth, legTop, legWidth * 2, legBot - legTop);

    // Table top with radial gradient
    var topRx = r * TILE_SCALE;
    var topRy = r * TILE_SCALE * SIN_A;
    var topGrad = ctx.createRadialGradient(
      screen.x, screen.y - liftPx, 0,
      screen.x, screen.y - liftPx, topRx
    );
    topGrad.addColorStop(0, lightenColor(COLORS.TABLE_TOP, 0.2));
    topGrad.addColorStop(1, COLORS.TABLE_TOP);
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - liftPx, topRx, topRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight ring
    ctx.strokeStyle = COLORS.TABLE_HIGHLIGHT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - liftPx, topRx, topRy, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ─── Dance system ──────────────────────────────────────────────────────

  function isOnDanceZone(x, y) {
    var L = LAYOUT;
    // Only the expanded dance floor triggers dancing
    if (x >= L.DANCE_FLOOR_X && x <= L.DANCE_FLOOR_X + L.DANCE_FLOOR_W &&
        y >= L.DANCE_FLOOR_Y && y <= L.DANCE_FLOOR_Y + L.DANCE_FLOOR_H) {
      return true;
    }
    return false;
  }

  // 4 dance styles: bounce, wave, sway, robot
  function getDanceParams(beat, styleIndex) {
    var d = {
      bounceY: 0,
      swayX: 0,
      leftArmAngle: 0,
      rightArmAngle: 0,
      leftLegAngle: 0,
      rightLegAngle: 0,
      headBobY: 0
    };

    switch (styleIndex % 4) {
      case 0: // Bounce - pumping up and down, arms pump
        d.bounceY = Math.abs(Math.sin(beat)) * 4.5;
        d.leftArmAngle = 0.4 + Math.sin(beat) * 0.3;
        d.rightArmAngle = 0.4 + Math.sin(beat + Math.PI * 0.5) * 0.3;
        d.leftLegAngle = Math.sin(beat) * 0.2;
        d.rightLegAngle = Math.sin(beat + Math.PI) * 0.2;
        d.headBobY = Math.sin(beat * 2) * 1.5;
        break;
      case 1: // Wave - hands up, waving side to side
        d.bounceY = Math.abs(Math.sin(beat)) * 2.5;
        d.leftArmAngle = 2.3 + Math.sin(beat) * 0.6;
        d.rightArmAngle = 2.3 + Math.sin(beat + Math.PI) * 0.6;
        d.leftLegAngle = Math.sin(beat * 0.5) * 0.12;
        d.rightLegAngle = Math.sin(beat * 0.5 + Math.PI) * 0.12;
        d.headBobY = Math.sin(beat) * 1.2;
        break;
      case 2: // Sway - side to side body movement
        d.bounceY = Math.abs(Math.sin(beat * 0.5)) * 2;
        d.swayX = Math.sin(beat) * 3.5;
        d.leftArmAngle = 0.6 + Math.sin(beat + Math.PI) * 0.45;
        d.rightArmAngle = 0.6 + Math.sin(beat) * 0.45;
        d.leftLegAngle = Math.sin(beat) * 0.28;
        d.rightLegAngle = Math.sin(beat + Math.PI) * 0.28;
        d.headBobY = Math.sin(beat * 0.5) * 1.5;
        break;
      case 3: // Robot - sharp snapping moves
        var snap = Math.sin(beat);
        var s = snap > 0.2 ? 1 : (snap < -0.2 ? -1 : snap / 0.2);
        d.bounceY = (s + 1) * 1.8;
        d.leftArmAngle = 1.2 + s * 0.9;
        d.rightArmAngle = 1.2 - s * 0.9;
        d.leftLegAngle = s * 0.18;
        d.rightLegAngle = -s * 0.18;
        d.headBobY = 0;
        break;
    }

    return d;
  }

  // ─── DJ NPC drawing ─────────────────────────────────────────────────────

  function drawDJ() {
    var L = LAYOUT;
    var color = COLORS.DJ_COLOR;
    var radius = Game.CONSTANTS.PLAYER_RADIUS;

    var screen = worldToScreen(DJ_X, DJ_Y);
    var sx = screen.x;
    var sy = screen.y;

    // Lift by booth elevation
    var boothLift = L.DJ_BOOTH_ELEVATION * HEIGHT_SCALE;
    sy -= boothLift;

    // Subtle bounce animation (intensity 0.4 - half the player dance)
    var beat = (animTime / DANCE_BEAT_MS) * Math.PI * 2;
    var bounceIntensity = 0.4;
    var bounceY = Math.abs(Math.sin(beat)) * 3 * bounceIntensity * TILE_SCALE;
    sy -= bounceY;

    // ── Soft shadow ──
    drawSoftShadow(screen.x, screen.y - boothLift, radius * 1.2);

    // ── Body dimensions ──
    var bodyHeight = radius * 1.8;
    var bodyWidth = radius * 0.7;
    var bodyCenterY = sy - radius * 0.5;
    var bodyBottom = bodyCenterY + bodyHeight * TILE_SCALE * 0.5;

    // ── Legs ──
    var legSpread = 3 * TILE_SCALE;
    var legLength = radius * 0.7 * TILE_SCALE;
    var limbColor = darkenColor(color, 0.6);
    var limbWidth = Math.max(1.5, 2 * TILE_SCALE);

    ctx.strokeStyle = limbColor;
    ctx.lineWidth = limbWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(sx - legSpread * 0.5, bodyBottom);
    ctx.lineTo(sx - legSpread * 0.5, bodyBottom + legLength);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx + legSpread * 0.5, bodyBottom);
    ctx.lineTo(sx + legSpread * 0.5, bodyBottom + legLength);
    ctx.stroke();

    // Shoes
    var shoeSize = Math.max(2, 2.5 * TILE_SCALE);
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(sx - legSpread * 0.5, bodyBottom + legLength, shoeSize, shoeSize * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx + legSpread * 0.5, bodyBottom + legLength, shoeSize, shoeSize * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Body ──
    var bodyGrad = ctx.createLinearGradient(
      sx - bodyWidth * TILE_SCALE, bodyCenterY,
      sx + bodyWidth * TILE_SCALE, bodyCenterY
    );
    bodyGrad.addColorStop(0, lightenColor(color, 0.2));
    bodyGrad.addColorStop(0.5, color);
    bodyGrad.addColorStop(1, darkenColor(color, 0.75));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(sx, bodyCenterY, bodyWidth * TILE_SCALE, bodyHeight * TILE_SCALE * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkenColor(color, 0.4);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // ── Arms reaching down toward decks ──
    var armAttachY = bodyCenterY - bodyHeight * TILE_SCALE * 0.1;
    var armLength = radius * 0.9 * TILE_SCALE;

    // DJ-specific angles: arms reach forward/down toward decks with small oscillation
    var armOsc = Math.sin(beat * 0.5) * 0.1;
    var leftArmA = 0.15 + armOsc;
    var rightArmA = 0.15 - armOsc;

    var lArmAttachX = sx - bodyWidth * TILE_SCALE * 0.85;
    var rArmAttachX = sx + bodyWidth * TILE_SCALE * 0.85;

    var lArmEndX = lArmAttachX - Math.sin(leftArmA) * armLength;
    var lArmEndY = armAttachY + Math.cos(leftArmA) * armLength;
    var rArmEndX = rArmAttachX + Math.sin(rightArmA) * armLength;
    var rArmEndY = armAttachY + Math.cos(rightArmA) * armLength;

    ctx.strokeStyle = limbColor;
    ctx.lineWidth = limbWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(lArmAttachX, armAttachY);
    ctx.lineTo(lArmEndX, lArmEndY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rArmAttachX, armAttachY);
    ctx.lineTo(rArmEndX, rArmEndY);
    ctx.stroke();

    // Hands
    var handSize = Math.max(1.5, 2 * TILE_SCALE);
    ctx.fillStyle = lightenColor(color, 0.35);
    ctx.beginPath();
    ctx.arc(lArmEndX, lArmEndY, handSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rArmEndX, rArmEndY, handSize, 0, Math.PI * 2);
    ctx.fill();

    // ── Head ──
    var headBob = Math.sin(beat * 2) * 0.5 * bounceIntensity * TILE_SCALE;
    var headY = sy - bodyHeight * 0.7 - headBob;
    var headR = radius * 0.55;
    var headGrad = ctx.createRadialGradient(
      sx - headR * TILE_SCALE * 0.25, headY - headR * TILE_SCALE * 0.25, headR * TILE_SCALE * 0.1,
      sx, headY, headR * TILE_SCALE
    );
    headGrad.addColorStop(0, lightenColor(color, 0.45));
    headGrad.addColorStop(1, color);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(sx, headY, headR * TILE_SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkenColor(color, 0.4);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // ── Headphones ──
    var hpRadius = headR * TILE_SCALE * 1.15;
    // Arc over head
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = Math.max(2, 2.5 * TILE_SCALE);
    ctx.beginPath();
    ctx.arc(sx, headY, hpRadius, Math.PI + 0.3, -0.3);
    ctx.stroke();

    // Ear cups
    var cupSize = Math.max(3, 4 * TILE_SCALE);
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.arc(sx - hpRadius * 0.92, headY + 2, cupSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + hpRadius * 0.92, headY + 2, cupSize, 0, Math.PI * 2);
    ctx.fill();

    // ── Eyes (looking slightly down at decks) ──
    var eyeSpread = headR * TILE_SCALE * 0.35;
    var eyeY = headY - headR * TILE_SCALE * 0.1;
    var eyeSize = Math.max(1, 1.3 * TILE_SCALE);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx - eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Pupils looking slightly down
    var pupilSize = eyeSize * 0.55;
    var pupilOffY = eyeSize * 0.35;
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(sx - eyeSpread, eyeY + pupilOffY, pupilSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + eyeSpread, eyeY + pupilOffY, pupilSize, 0, Math.PI * 2);
    ctx.fill();

    // ── Gold "DJ" name tag ──
    var nameY = headY - headR * TILE_SCALE - 4;
    var fontSize = Math.max(9, Math.round(11 * zoomLevel));
    ctx.font = 'bold ' + fontSize + 'px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    ctx.fillStyle = COLORS.NAME_SHADOW;
    ctx.fillText('DJ', sx + 1, nameY + 1);

    ctx.fillStyle = '#ffcc00';
    ctx.fillText('DJ', sx, nameY);
  }

  // ─── Bartender NPC drawing ─────────────────────────────────────────────

  function drawBartender(wx, wy) {
    var color = '#1a1a1a';
    var radius = Game.CONSTANTS.PLAYER_RADIUS;

    var screen = worldToScreen(wx, wy);
    var sx = screen.x;
    var sy = screen.y;

    // Subtle idle sway
    var sway = Math.sin(animTime / 1200 + wx) * 0.5 * TILE_SCALE;
    sx += sway;

    // ── Soft shadow ──
    drawSoftShadow(screen.x, screen.y, radius * 1.0);

    // ── Body dimensions ──
    var bodyHeight = radius * 1.8;
    var bodyWidth = radius * 0.7;
    var bodyCenterY = sy - radius * 0.5;
    var bodyBottom = bodyCenterY + bodyHeight * TILE_SCALE * 0.5;

    // ── Legs ──
    var legSpread = 3 * TILE_SCALE;
    var legLength = radius * 0.7 * TILE_SCALE;
    var limbColor = '#111111';
    var limbWidth = Math.max(1.5, 2 * TILE_SCALE);

    ctx.strokeStyle = limbColor;
    ctx.lineWidth = limbWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(sx - legSpread * 0.5, bodyBottom);
    ctx.lineTo(sx - legSpread * 0.5, bodyBottom + legLength);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx + legSpread * 0.5, bodyBottom);
    ctx.lineTo(sx + legSpread * 0.5, bodyBottom + legLength);
    ctx.stroke();

    // Shoes
    var shoeSize = Math.max(2, 2.5 * TILE_SCALE);
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.ellipse(sx - legSpread * 0.5, bodyBottom + legLength, shoeSize, shoeSize * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx + legSpread * 0.5, bodyBottom + legLength, shoeSize, shoeSize * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Body (black shirt) ──
    var bodyGrad = ctx.createLinearGradient(
      sx - bodyWidth * TILE_SCALE, bodyCenterY,
      sx + bodyWidth * TILE_SCALE, bodyCenterY
    );
    bodyGrad.addColorStop(0, '#2a2a2a');
    bodyGrad.addColorStop(0.5, color);
    bodyGrad.addColorStop(1, '#0d0d0d');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(sx, bodyCenterY, bodyWidth * TILE_SCALE, bodyHeight * TILE_SCALE * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // White apron overlay (rect on lower torso)
    var apronTop = bodyCenterY - bodyHeight * TILE_SCALE * 0.05;
    var apronW = bodyWidth * TILE_SCALE * 1.4;
    var apronH = bodyHeight * TILE_SCALE * 0.45;
    ctx.fillStyle = 'rgba(230,230,230,0.85)';
    ctx.beginPath();
    ctx.moveTo(sx - apronW, apronTop);
    ctx.lineTo(sx + apronW, apronTop);
    ctx.lineTo(sx + apronW * 0.8, apronTop + apronH);
    ctx.lineTo(sx - apronW * 0.8, apronTop + apronH);
    ctx.closePath();
    ctx.fill();
    // Apron string
    ctx.strokeStyle = 'rgba(200,200,200,0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(sx - apronW * 0.5, apronTop);
    ctx.lineTo(sx, apronTop + 2);
    ctx.lineTo(sx + apronW * 0.5, apronTop);
    ctx.stroke();

    // ── Arms (hanging at sides, slight sway) ──
    var armAttachY = bodyCenterY - bodyHeight * TILE_SCALE * 0.1;
    var armLength = radius * 0.9 * TILE_SCALE;
    var armOsc = Math.sin(animTime / 1500 + wx * 2) * 0.08;
    var armAngle = 0.2 + armOsc;

    var lArmAttachX = sx - bodyWidth * TILE_SCALE * 0.85;
    var rArmAttachX = sx + bodyWidth * TILE_SCALE * 0.85;
    var lArmEndX = lArmAttachX - Math.sin(armAngle) * armLength;
    var lArmEndY = armAttachY + Math.cos(armAngle) * armLength;
    var rArmEndX = rArmAttachX + Math.sin(armAngle) * armLength;
    var rArmEndY = armAttachY + Math.cos(armAngle) * armLength;

    ctx.strokeStyle = limbColor;
    ctx.lineWidth = limbWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(lArmAttachX, armAttachY);
    ctx.lineTo(lArmEndX, lArmEndY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rArmAttachX, armAttachY);
    ctx.lineTo(rArmEndX, rArmEndY);
    ctx.stroke();

    // Hands (skin tone)
    var handSize = Math.max(1.5, 2 * TILE_SCALE);
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.arc(lArmEndX, lArmEndY, handSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rArmEndX, rArmEndY, handSize, 0, Math.PI * 2);
    ctx.fill();

    // ── Head ──
    var headY = sy - bodyHeight * 0.7;
    var headR = radius * 0.55;
    var headGrad = ctx.createRadialGradient(
      sx - headR * TILE_SCALE * 0.25, headY - headR * TILE_SCALE * 0.25, headR * TILE_SCALE * 0.1,
      sx, headY, headR * TILE_SCALE
    );
    headGrad.addColorStop(0, '#e8c9a0');
    headGrad.addColorStop(1, '#d4a574');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(sx, headY, headR * TILE_SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b08050';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Eyes
    var eyeSpread = headR * TILE_SCALE * 0.35;
    var eyeY = headY - headR * TILE_SCALE * 0.1;
    var eyeSize = Math.max(1, 1.3 * TILE_SCALE);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx - eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    var pupilSize = eyeSize * 0.55;
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(sx - eyeSpread, eyeY + eyeSize * 0.2, pupilSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + eyeSpread, eyeY + eyeSize * 0.2, pupilSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Ground drink drawing ───────────────────────────────────────────────

  function drawGroundDrink(drink) {
    var screen = worldToScreen(drink.x, drink.y);
    var sx = screen.x;
    var sy = screen.y;
    var a = drink.alpha;

    // Spill puddle behind cup
    ctx.fillStyle = 'rgba(139,90,43,' + (a * 0.25).toFixed(2) + ')';
    ctx.beginPath();
    ctx.ellipse(sx + 2 * TILE_SCALE, sy, 5 * TILE_SCALE, 2.5 * TILE_SCALE * SIN_A, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fallen cup on its side (small rect + ellipse rim)
    var cupW = 4 * TILE_SCALE;
    var cupH = 2.5 * TILE_SCALE;
    ctx.fillStyle = 'rgba(255,255,255,' + (a * 0.8).toFixed(2) + ')';
    ctx.fillRect(sx - cupW / 2, sy - cupH / 2, cupW, cupH);

    // Cup rim (opening)
    ctx.strokeStyle = 'rgba(200,200,200,' + (a * 0.6).toFixed(2) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sx + cupW / 2, sy, cupH * 0.4, cupH / 2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Drink color accent
    ctx.fillStyle = 'rgba(139,90,43,' + (a * 0.5).toFixed(2) + ')';
    ctx.fillRect(sx - cupW / 2 + 1, sy - cupH / 2 + 1, cupW * 0.4, cupH - 2);
  }

  // ─── Drink HUD / prompts ───────────────────────────────────────────────

  function drawDrinkPrompt() {
    var player = Game.localPlayer;
    var state = player.drinkState;

    if (state === 'none' && Game.isNearBar()) {
      // "Press E" prompt above player
      var screen = worldToScreen(player.x, player.y);
      var fontSize = Math.max(10, Math.round(12 * zoomLevel));
      ctx.font = 'bold ' + fontSize + 'px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      var promptY = screen.y - 40 * TILE_SCALE;

      // Background pill
      var textW = ctx.measureText('Press E').width;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(screen.x - textW / 2 - 6, promptY - fontSize - 4, textW + 12, fontSize + 8, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText('Press E', screen.x, promptY);
    }

    if (state === 'ordering') {
      // "Making..." with progress bar above player
      var screen2 = worldToScreen(player.x, player.y);
      var fontSize2 = Math.max(9, Math.round(11 * zoomLevel));
      ctx.font = 'bold ' + fontSize2 + 'px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      var promptY2 = screen2.y - 40 * TILE_SCALE;

      var textW2 = ctx.measureText('Making...').width;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(screen2.x - textW2 / 2 - 6, promptY2 - fontSize2 - 14, textW2 + 12, fontSize2 + 18, 4);
      ctx.fill();

      ctx.fillStyle = '#ffcc44';
      ctx.fillText('Making...', screen2.x, promptY2 - 8);

      // Progress bar
      var barW = textW2 + 4;
      var barH = 4;
      var barX = screen2.x - barW / 2;
      var barY = promptY2 - 6;
      var progress = 1 - (player.drinkOrderTimer / Game.CONSTANTS.DRINK_ORDER_TIME);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#ffcc44';
      ctx.fillRect(barX, barY, barW * Math.max(0, Math.min(1, progress)), barH);
    }

    if (state === 'carrying') {
      // Timer HUD in bottom-right corner
      var hudX = canvas.width - 110;
      var hudY = canvas.height - 40;
      var remaining = Math.max(0, player.drinkTimer);
      var pct = remaining / Game.CONSTANTS.DRINK_CARRY_TIME;

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.roundRect(hudX - 4, hudY - 4, 100, 24, 4);
      ctx.fill();

      // Timer bar background
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(hudX, hudY, 88, 6);
      // Timer bar fill (changes color as time runs out)
      var barColor = pct > 0.3 ? '#44cc66' : '#ff4444';
      ctx.fillStyle = barColor;
      ctx.fillRect(hudX, hudY, 88 * pct, 6);

      // Timer text
      ctx.font = '10px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('\u2615 ' + remaining.toFixed(1) + 's', hudX, hudY + 9);
    }
  }

  // ─── Player drawing ───────────────────────────────────────────────────

  function drawPlayer(player, isLocal) {
    if (!ctx || !player) {
      return;
    }

    var radius = Game.CONSTANTS.PLAYER_RADIUS;
    var color;

    if (isLocal) {
      color = COLORS.LOCAL_PLAYER;
    } else if (player.color) {
      color = player.color;
    } else {
      var colorIndex = Math.abs(hashCode(player.id || '')) % COLORS.REMOTE_COLORS.length;
      color = COLORS.REMOTE_COLORS[colorIndex];
    }

    // ── Facing direction & speed tracking ──
    var pid = player.id || 'local';
    var lastPos = playerLastPos[pid];
    var moved = false;
    var frameDist = 0;
    if (lastPos) {
      var fdx = player.x - lastPos.x;
      var fdy = player.y - lastPos.y;
      frameDist = Math.sqrt(fdx * fdx + fdy * fdy);
      if (frameDist > 0.3) {
        playerFacing[pid] = { dx: fdx / frameDist, dy: fdy / frameDist };
        moved = true;
      }
    }
    playerLastPos[pid] = { x: player.x, y: player.y };

    // NPC facing override: use facingDx/facingDy when standing still
    if (!moved && player.facingDx !== undefined && player.facingDy !== undefined &&
        (player.facingDx !== 0 || player.facingDy !== 0)) {
      playerFacing[pid] = { dx: player.facingDx, dy: player.facingDy };
    }

    // Smooth speed (exponential moving average)
    var prevSpeed = playerSpeed[pid] || 0;
    var rawSpeed = frameDist;
    var smoothFactor = moved ? 0.35 : 0.15;  // ramp up fast, decay slower
    var speed = prevSpeed + (rawSpeed - prevSpeed) * smoothFactor;
    playerSpeed[pid] = speed;

    // Walk phase accumulation — scales with speed for natural stride frequency
    var walkActive = speed > 0.4;
    if (!playerWalkPhase[pid]) playerWalkPhase[pid] = 0;
    if (walkActive) {
      // stride frequency proportional to speed, clamped
      var strideRate = Math.min(speed * 1.8, 12);
      playerWalkPhase[pid] += strideRate * 0.15;
    } else {
      // Decay phase toward nearest rest position (0 or PI) for smooth stop
      var wp = playerWalkPhase[pid] % (Math.PI * 2);
      var restTarget = Math.round(wp / Math.PI) * Math.PI;
      playerWalkPhase[pid] += (restTarget - wp) * 0.2;
    }
    var walkPhase = playerWalkPhase[pid];
    var walkIntensity = Math.min(1, speed / 3);

    // ── Dance detection ──
    if (moved) {
      playerMoveTime[pid] = animTime;
    }
    if (!playerMoveTime[pid]) {
      playerMoveTime[pid] = animTime;
    }
    var idleMs = animTime - playerMoveTime[pid];
    var onDanceZone = isOnDanceZone(player.x, player.y);
    var isDancing = onDanceZone && idleMs > DANCE_IDLE_MS;
    var danceIntensity = 0;
    if (isDancing) {
      danceIntensity = Math.min(1, (idleMs - DANCE_IDLE_MS) / DANCE_RAMP_MS);
    }

    // Dance style & phase (unique per player)
    var pidHash = Math.abs(hashCode(pid));
    var danceStyle = pidHash % 4;
    var phaseOffset = (pidHash % 100) / 100 * Math.PI * 2;
    var beat = (animTime / DANCE_BEAT_MS) * Math.PI * 2 + phaseOffset;
    var dance = getDanceParams(beat, danceStyle);

    // ── Screen position ──
    var screen = worldToScreen(player.x, player.y);
    var sx = screen.x;
    var sy = screen.y;

    // DJ Booth lift
    var L = LAYOUT;
    var onBooth = (player.x >= L.DJ_BOOTH_X && player.x <= L.DJ_BOOTH_X + L.DJ_BOOTH_W &&
                   player.y >= L.DJ_BOOTH_Y && player.y <= L.DJ_BOOTH_Y + L.DJ_BOOTH_H);
    var playerLift = onBooth ? L.DJ_BOOTH_ELEVATION * HEIGHT_SCALE : 0;
    sy -= playerLift;

    // ── Walk cycle bob ──
    var walkBobY = 0;
    var walkLeanX = 0;
    if (walkIntensity > 0.05 && danceIntensity < 0.5) {
      // Vertical bob: double-frequency sine (two bobs per stride cycle)
      walkBobY = Math.abs(Math.sin(walkPhase)) * 2.5 * walkIntensity * TILE_SCALE;
      // Lean into movement direction (screen-space)
      var facing = playerFacing[pid];
      if (facing) {
        var leanDx = (facing.dx - facing.dy) * COS_A;
        var leanDy = (facing.dx + facing.dy) * SIN_A;
        var leanLen = Math.sqrt(leanDx * leanDx + leanDy * leanDy);
        if (leanLen > 0) {
          walkLeanX = (leanDx / leanLen) * walkIntensity * 1.5 * TILE_SCALE;
        }
      }
    }

    // Apply dance body movement (takes over from walk when dancing)
    var bounceY = dance.bounceY * danceIntensity * TILE_SCALE;
    var swayX = dance.swayX * danceIntensity * TILE_SCALE;
    // Blend: walk dominates while moving, dance dominates while idle on dance zone
    var moveBlend = Math.max(0, 1 - danceIntensity);
    sy -= walkBobY * moveBlend + bounceY;
    sx += walkLeanX * moveBlend + swayX;

    // ── Soft shadow ──
    var shadowStretch = 1 + danceIntensity * dance.bounceY * 0.03 + walkIntensity * 0.05;
    drawSoftShadow(screen.x, screen.y, radius * 1.2 * shadowStretch);

    // ── Body dimensions ──
    var bodyHeight = radius * 1.8;
    var bodyWidth = radius * 0.7;
    var bodyCenterY = sy - radius * 0.5;
    var bodyBottom = bodyCenterY + bodyHeight * TILE_SCALE * 0.5;

    // ── Compute leg angles ──
    var legSpread = 3 * TILE_SCALE;
    var legLength = radius * 0.7 * TILE_SCALE;
    var limbColor = darkenColor(color, 0.6);
    var limbWidth = Math.max(1.5, 2 * TILE_SCALE);

    // Walk leg swing: left and right alternate, amplitude scales with speed
    var walkLegSwing = Math.sin(walkPhase) * 0.55 * walkIntensity;
    var walkLegSwingR = Math.sin(walkPhase + Math.PI) * 0.55 * walkIntensity;

    // Dance leg angles
    var danceLegL = danceIntensity * dance.leftLegAngle;
    var danceLegR = danceIntensity * dance.rightLegAngle;

    // Blend walk and dance leg angles
    var leftLegA = walkLegSwing * moveBlend + danceLegL;
    var rightLegA = walkLegSwingR * moveBlend + danceLegR;

    var lLegStartX = sx - legSpread * 0.5;
    var rLegStartX = sx + legSpread * 0.5;
    var legStartY = bodyBottom;

    var lLegEndX = lLegStartX + Math.sin(leftLegA) * legLength;
    var lLegEndY = legStartY + Math.cos(leftLegA) * legLength;
    var rLegEndX = rLegStartX + Math.sin(rightLegA) * legLength;
    var rLegEndY = legStartY + Math.cos(rightLegA) * legLength;

    ctx.strokeStyle = limbColor;
    ctx.lineWidth = limbWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(lLegStartX, legStartY);
    ctx.lineTo(lLegEndX, lLegEndY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rLegStartX, legStartY);
    ctx.lineTo(rLegEndX, rLegEndY);
    ctx.stroke();

    // Shoes
    var shoeSize = Math.max(2, 2.5 * TILE_SCALE);
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(lLegEndX, lLegEndY, shoeSize, shoeSize * 0.6, leftLegA * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rLegEndX, rLegEndY, shoeSize, shoeSize * 0.6, rightLegA * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // ── Body (slight tilt when walking) ──
    var bodyTilt = walkLeanX * moveBlend * 0.015;
    ctx.save();
    ctx.translate(sx, bodyCenterY);
    ctx.rotate(bodyTilt);
    var bodyGrad = ctx.createLinearGradient(
      -bodyWidth * TILE_SCALE, 0,
      bodyWidth * TILE_SCALE, 0
    );
    bodyGrad.addColorStop(0, lightenColor(color, 0.2));
    bodyGrad.addColorStop(0.5, color);
    bodyGrad.addColorStop(1, darkenColor(color, 0.75));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyWidth * TILE_SCALE, bodyHeight * TILE_SCALE * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkenColor(color, 0.4);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Belt line
    ctx.strokeStyle = darkenColor(color, 0.35);
    ctx.lineWidth = Math.max(0.8, 1 * TILE_SCALE);
    ctx.beginPath();
    ctx.ellipse(0, bodyHeight * TILE_SCALE * 0.15, bodyWidth * TILE_SCALE * 0.95, 1, 0, 0, Math.PI);
    ctx.stroke();
    ctx.restore();

    // ── Compute arm angles ──
    var armAttachY = bodyCenterY - bodyHeight * TILE_SCALE * 0.1;
    var armLength = radius * 0.9 * TILE_SCALE;

    // Walk arm swing: opposite to legs (natural gait)
    var walkArmSwingL = Math.sin(walkPhase + Math.PI) * 0.5 * walkIntensity;
    var walkArmSwingR = Math.sin(walkPhase) * 0.5 * walkIntensity;

    // Idle arm angle
    var idleArmAngle = 0.3;

    // Dance arm angles
    var danceArmL = dance.leftArmAngle * danceIntensity;
    var danceArmR = dance.rightArmAngle * danceIntensity;

    // Blend: idle -> walk -> dance
    var idleBlend = Math.max(0, 1 - walkIntensity - danceIntensity);
    idleBlend = Math.max(0, idleBlend);
    var leftArmA = idleArmAngle * idleBlend + (idleArmAngle + walkArmSwingL) * walkIntensity * moveBlend + danceArmL;
    var rightArmA = idleArmAngle * idleBlend + (idleArmAngle + walkArmSwingR) * walkIntensity * moveBlend + danceArmR;

    var lArmAttachX = sx - bodyWidth * TILE_SCALE * 0.85;
    var rArmAttachX = sx + bodyWidth * TILE_SCALE * 0.85;

    var lArmEndX = lArmAttachX - Math.sin(leftArmA) * armLength;
    var lArmEndY = armAttachY + Math.cos(leftArmA) * armLength;
    var rArmEndX = rArmAttachX + Math.sin(rightArmA) * armLength;
    var rArmEndY = armAttachY + Math.cos(rightArmA) * armLength;

    ctx.strokeStyle = limbColor;
    ctx.lineWidth = limbWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(lArmAttachX, armAttachY);
    ctx.lineTo(lArmEndX, lArmEndY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rArmAttachX, armAttachY);
    ctx.lineTo(rArmEndX, rArmEndY);
    ctx.stroke();

    // Hands
    var handSize = Math.max(1.5, 2 * TILE_SCALE);
    ctx.fillStyle = lightenColor(color, 0.35);
    ctx.beginPath();
    ctx.arc(lArmEndX, lArmEndY, handSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rArmEndX, rArmEndY, handSize, 0, Math.PI * 2);
    ctx.fill();

    // ── Carried drink (right hand) ──
    var isCarrying = isLocal ? Game.localPlayer.drinkState === 'carrying' : player.drinkState === 'carrying';
    if (isCarrying) {
      var cupX = rArmEndX;
      var cupY = rArmEndY - 4 * TILE_SCALE;
      var cupW = 3 * TILE_SCALE;
      var cupH = 5 * TILE_SCALE;
      var dColor = (isLocal ? Game.localPlayer.drinkColor : player.drinkColor) || '#c87533';

      // Cup body (white paper cup)
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(cupX - cupW / 2, cupY - cupH, cupW, cupH);

      // Drink fill inside cup
      ctx.fillStyle = dColor;
      ctx.fillRect(cupX - cupW / 2 + 0.5, cupY - cupH * 0.7, cupW - 1, cupH * 0.5);

      // Cup rim
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cupX, cupY - cupH, cupW / 2 + 0.5, 1.5 * TILE_SCALE * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = dColor;
      ctx.beginPath();
      ctx.ellipse(cupX, cupY - cupH, cupW / 2 - 0.5, 1 * TILE_SCALE * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Head ──
    var walkHeadBob = Math.abs(Math.sin(walkPhase)) * 0.8 * walkIntensity * moveBlend * TILE_SCALE;
    var danceHeadBob = dance.headBobY * danceIntensity * TILE_SCALE;
    var headBob = walkHeadBob + danceHeadBob;
    var headY = sy - bodyHeight * 0.7 - headBob;
    var headR = radius * 0.55;
    // Head also leans slightly with body
    var headLeanX = walkLeanX * moveBlend * 0.4;
    var headSx = sx + headLeanX;
    var headGrad = ctx.createRadialGradient(
      headSx - headR * TILE_SCALE * 0.25, headY - headR * TILE_SCALE * 0.25, headR * TILE_SCALE * 0.1,
      headSx, headY, headR * TILE_SCALE
    );
    headGrad.addColorStop(0, lightenColor(color, 0.45));
    headGrad.addColorStop(1, color);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(headSx, headY, headR * TILE_SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkenColor(color, 0.4);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Eye dots
    var eyeSpread = headR * TILE_SCALE * 0.35;
    var eyeY = headY - headR * TILE_SCALE * 0.1;
    var eyeSize = Math.max(1, 1.3 * TILE_SCALE);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(headSx - eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headSx + eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    var pupilSize = eyeSize * 0.55;
    var facing2 = playerFacing[pid];
    var pupilOffX = 0;
    var pupilOffY = 0;
    if (facing2) {
      var sdx = (facing2.dx - facing2.dy) * COS_A;
      var sdy = (facing2.dx + facing2.dy) * SIN_A;
      var slen = Math.sqrt(sdx * sdx + sdy * sdy);
      if (slen > 0) {
        pupilOffX = (sdx / slen) * eyeSize * 0.4;
        pupilOffY = (sdy / slen) * eyeSize * 0.4;
      }
    }
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(headSx - eyeSpread + pupilOffX, eyeY + pupilOffY, pupilSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headSx + eyeSpread + pupilOffX, eyeY + pupilOffY, pupilSize, 0, Math.PI * 2);
    ctx.fill();

    // ── Floating music notes when dancing ──
    if (danceIntensity > 0.3) {
      var noteAlpha = (danceIntensity - 0.3) / 0.7;
      var notePhase = animTime / 800 * Math.PI;
      var notes = ['\u266A', '\u266B'];
      var noteIndex = Math.floor(animTime / 1200 + pidHash) % notes.length;
      var noteFloatY = headY - headR * TILE_SCALE - 6 * TILE_SCALE - Math.sin(notePhase) * 3 * TILE_SCALE;
      var noteFloatX = headSx + Math.sin(notePhase * 0.6 + phaseOffset) * 4 * TILE_SCALE;
      var noteFontSize = Math.max(8, Math.round(11 * zoomLevel));
      ctx.font = noteFontSize + 'px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,' + (noteAlpha * (0.5 + Math.sin(notePhase * 0.7) * 0.3)).toFixed(2) + ')';
      ctx.fillText(notes[noteIndex], noteFloatX, noteFloatY);
    }

    // ── Name above player ──
    var name = player.name || '';
    if (name.length > 0) {
      var nameY = headY - headR * TILE_SCALE - 4;
      if (danceIntensity > 0.3) {
        nameY -= 8 * TILE_SCALE;
      }
      var fontSize = Math.max(9, Math.round(11 * zoomLevel));
      ctx.font = 'bold ' + fontSize + 'px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      ctx.fillStyle = COLORS.NAME_SHADOW;
      ctx.fillText(name, headSx + 1, nameY + 1);

      ctx.fillStyle = COLORS.NAME_TEXT;
      ctx.fillText(name, headSx, nameY);
    }
  }

  // ─── Atmosphere / HUD ─────────────────────────────────────────────────

  function drawVignette() {
    var cx = canvas.width / 2;
    var cy = canvas.height / 2;
    var r = Math.max(canvas.width, canvas.height) * 0.7;
    var grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawZoomIndicator() {
    if (Math.abs(zoomLevel - 1.0) < 0.01) {
      return;
    }
    var text = Math.round(zoomLevel * 100) + '%';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(canvas.width - 60, 8, 52, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(text, canvas.width - 14, 13);
  }

  // ─── Depth sorting & render loop ──────────────────────────────────────

  function buildDrawables() {
    var drawables = [];
    var L = LAYOUT;

    for (var i = 0; i < L.TABLES.length; i++) {
      var t = L.TABLES[i];
      drawables.push({
        type: 'table',
        sortKey: t.x + t.y,
        data: t
      });
    }

    drawables.push({
      type: 'bar',
      sortKey: L.BAR_X + L.BAR_W / 2 + L.BAR_Y + L.BAR_H / 2,
      data: null
    });

    // DJ NPC
    drawables.push({
      type: 'dj',
      sortKey: DJ_X + DJ_Y,
      data: null
    });

    // Bartender NPCs (behind the bar)
    var bt1x = L.BAR_X + L.BAR_W * 0.33;
    var bt1y = L.BAR_Y - 5;
    var bt2x = L.BAR_X + L.BAR_W * 0.67;
    var bt2y = L.BAR_Y - 5;
    drawables.push({
      type: 'bartender',
      sortKey: bt1x + bt1y,
      data: { x: bt1x, y: bt1y }
    });
    drawables.push({
      type: 'bartender',
      sortKey: bt2x + bt2y,
      data: { x: bt2x, y: bt2y }
    });

    // Ground drinks
    var gd = Game.groundDrinks;
    for (var g = 0; g < gd.length; g++) {
      drawables.push({
        type: 'groundDrink',
        sortKey: gd[g].x + gd[g].y,
        data: gd[g]
      });
    }

    var players = Game.getAllPlayers();
    var localPlayer = Game.getLocalPlayer();
    for (var j = 0; j < players.length; j++) {
      var p = players[j];
      drawables.push({
        type: 'player',
        sortKey: p.x + p.y,
        data: { player: p, isLocal: p === localPlayer }
      });
    }

    // Crowd NPCs
    var crowd = Game.crowdNPCs;
    for (var c = 0; c < crowd.length; c++) {
      drawables.push({
        type: 'player',
        sortKey: crowd[c].x + crowd[c].y,
        data: { player: crowd[c], isLocal: false }
      });
    }

    drawables.sort(function (a, b) {
      return a.sortKey - b.sortKey;
    });

    return drawables;
  }

  function drawSubRoomFloor(floorColor) {
    var C = Game.CONSTANTS;
    var points = worldRectToIsoDiamond(0, 0, C.WORLD_WIDTH, C.WORLD_HEIGHT);

    // Clip to diamond and fill with solid color
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = floorColor;

    // Fill bounding box of diamond
    var bx = Math.min(points[0].x, points[1].x, points[2].x, points[3].x);
    var by = Math.min(points[0].y, points[1].y, points[2].y, points[3].y);
    var bx2 = Math.max(points[0].x, points[1].x, points[2].x, points[3].x);
    var by2 = Math.max(points[0].y, points[1].y, points[2].y, points[3].y);
    ctx.fillRect(bx, by, bx2 - bx, by2 - by);
    ctx.restore();

    // Floor outline
    ctx.strokeStyle = darkenColor(floorColor, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var j = 1; j < points.length; j++) {
      ctx.lineTo(points[j].x, points[j].y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawSubRoomWalls(wallTopColor, wallFrontColor, wallSideColor) {
    var C = Game.CONSTANTS;
    var t = LAYOUT.WALL_THICKNESS;
    var w = C.WORLD_WIDTH;
    var h = C.WORLD_HEIGHT;
    var elev = LAYOUT.WALL_HEIGHT;

    // Back wall (top edge)
    drawRaisedBlockGradient(0, 0, w, t, elev, wallTopColor, wallFrontColor, wallSideColor);

    // Left wall (left edge)
    drawRaisedBlockGradient(0, t, t, h - t, elev, wallTopColor, wallFrontColor, wallSideColor);
  }

  function drawSubRoomFrontWalls(wallTopColor, wallFrontColor, wallSideColor) {
    var C = Game.CONSTANTS;
    var t = LAYOUT.WALL_THICKNESS;
    var w = C.WORLD_WIDTH;
    var h = C.WORLD_HEIGHT;
    var elev = LAYOUT.WALL_HEIGHT;

    // Right wall
    drawRaisedBlockGradient(w - t, t, t, h - t, elev, wallTopColor, wallFrontColor, wallSideColor);

    // Bottom wall
    drawRaisedBlockGradient(t, h - t, w - 2 * t, t, elev, wallTopColor, wallFrontColor, wallSideColor);
  }

  function render() {
    if (!ctx) {
      return;
    }

    animTime = Date.now();

    // Recalculate offsets for zoom (follow player when zoomed)
    var localPlayer = Game.getLocalPlayer();
    if (Math.abs(zoomLevel - 1.0) > 0.01 && localPlayer) {
      recalcOffsets(localPlayer.x, localPlayer.y);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Background
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Floor (concrete)
    drawFloor();

    // 3. Walls (back + left, concrete gray, no brick)
    drawWalls();

    // 4. Exposed pipes on back wall
    drawExposedPipes();

    // 5. LED wall behind booth (animated color panels)
    drawLEDWall();

    // 6. DJ Booth (platform + desk + equipment + LEDs + spotlight)
    drawDJBooth();

    // 7. Dance floor (expanded, muted)
    drawDanceFloor();

    // 8. LED wall glow wash onto dance floor
    drawLEDWallGlow();

    // 9. Atmospheric lights (pulsing red/blue)
    drawAtmosphericLights();

    // 8. Speaker stacks at booth flanks
    drawSpeakerStack(LAYOUT.SPEAKER_LEFT.x, LAYOUT.SPEAKER_LEFT.y);
    drawSpeakerStack(LAYOUT.SPEAKER_RIGHT.x, LAYOUT.SPEAKER_RIGHT.y);

    // 9. Depth-sorted: standing tables, bar, DJ NPC, players
    var drawables = buildDrawables();
    for (var i = 0; i < drawables.length; i++) {
      var d = drawables[i];
      if (d.type === 'table') {
        drawTable(d.data);
      } else if (d.type === 'bar') {
        drawBar();
      } else if (d.type === 'dj') {
        drawDJ();
      } else if (d.type === 'bartender') {
        drawBartender(d.data.x, d.data.y);
      } else if (d.type === 'groundDrink') {
        drawGroundDrink(d.data);
      } else if (d.type === 'player') {
        drawPlayer(d.data.player, d.data.isLocal);
      }
    }

    // 10. Front walls (right + bottom)
    drawFrontWalls();

    // 11. Vignette (heavy)
    drawVignette();

    // 11.5. Drink prompts / HUD (after vignette, before strobe)
    drawDrinkPrompt();

    // 12. Strobe (buildup only, screen overlay)
    drawStrobe();

    // 13. Zoom indicator
    drawZoomIndicator();
  }

  function init(canvasElement) {
    if (!canvasElement) {
      return;
    }
    canvas = canvasElement;
    ctx = canvas.getContext('2d');

    recalcOffsets();
    initPatternCache();
  }

  function onRoomChange(roomId) {
    // Recalculate tile scale and centering offsets for the new room
    zoomLevel = 1.0;
    recalcOffsets();

    // Clear player tracking caches
    playerLastPos = {};
    playerFacing = {};
    playerWalkPhase = {};
    playerSpeed = {};
    playerMoveTime = {};
  }

  window.Renderer = {
    init: init,
    render: render,
    drawClub: drawFloor,
    drawPlayer: drawPlayer,
    setZoom: setZoom,
    getZoom: getZoom,
    onRoomChange: onRoomChange
  };
})();
