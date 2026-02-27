(function () {
  'use strict';

  var panel = null;
  var btn = null;
  var previewCanvas = null;
  var previewCtx = null;
  var isOpen = false;

  var OUTFIT_COLORS = [
    '#4488ff', '#ff4466', '#44dd66', '#dd44dd', '#ffaa22',
    '#22dddd', '#ff6644', '#88ff44', '#aa44ff', '#ff44aa',
    '#dddd44', '#4466ff'
  ];

  var HAIR_STYLE_LABELS = {
    spiky: 'Spiky', mohawk: 'Mohawk', bun: 'Bun', curly: 'Curly',
    long: 'Long', buzz: 'Buzz', ponytail: 'Tail', flat: 'Flat', none: 'Bald'
  };

  var ACCESSORY_LABELS = {
    none: 'None', glasses: 'Glasses', cap: 'Cap', headphones: 'Phones'
  };

  function init() {
    btn = document.getElementById('customizeBtn');
    panel = document.getElementById('customizePanel');
    previewCanvas = document.getElementById('previewCanvas');
    if (previewCanvas) {
      previewCtx = previewCanvas.getContext('2d');
    }

    if (btn) {
      btn.style.display = '';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggle();
      });
    }

    buildSwatches();
    drawPreview();

    // Close panel when clicking outside
    document.addEventListener('click', function (e) {
      if (isOpen && panel && !panel.contains(e.target) && e.target !== btn) {
        close();
      }
    });
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  function open() {
    if (panel) {
      panel.style.display = '';
      isOpen = true;
      refreshActiveStates();
      drawPreview();
    }
  }

  function close() {
    if (panel) {
      panel.style.display = 'none';
      isOpen = false;
    }
  }

  function getAppearance() {
    return Game.localPlayer.appearance;
  }

  function setAppearance(key, value) {
    var app = Game.localPlayer.appearance;
    if (app) {
      app[key] = value;
      Game.savePlayerAppearance(app);
      refreshActiveStates();
      drawPreview();
    }
  }

  function buildSwatches() {
    // Skin tones
    var skinRow = document.getElementById('skinSwatches');
    if (skinRow) {
      Game.SKIN_TONES.forEach(function (tone) {
        var sw = createSwatch(tone, 'skinTone', tone);
        skinRow.appendChild(sw);
      });
    }

    // Outfit colors
    var outfitRow = document.getElementById('outfitSwatches');
    if (outfitRow) {
      OUTFIT_COLORS.forEach(function (c) {
        var sw = createSwatch(c, 'outfitColor', c);
        outfitRow.appendChild(sw);
      });
    }

    // Hair styles
    var hairStyleRow = document.getElementById('hairStyleBtns');
    if (hairStyleRow) {
      Game.HAIR_STYLES.forEach(function (style) {
        var b = document.createElement('button');
        b.className = 'style-btn';
        b.textContent = HAIR_STYLE_LABELS[style] || style;
        b.setAttribute('data-key', 'hairStyle');
        b.setAttribute('data-value', style);
        b.addEventListener('click', function () {
          setAppearance('hairStyle', style);
        });
        hairStyleRow.appendChild(b);
      });
    }

    // Hair colors
    var hairColorRow = document.getElementById('hairColorSwatches');
    if (hairColorRow) {
      Game.HAIR_COLORS.forEach(function (c) {
        var sw = createSwatch(c, 'hairColor', c);
        hairColorRow.appendChild(sw);
      });
    }

    // Accessories
    var accRow = document.getElementById('accessoryBtns');
    if (accRow) {
      Game.ACCESSORIES.forEach(function (acc) {
        var b = document.createElement('button');
        b.className = 'style-btn';
        b.textContent = ACCESSORY_LABELS[acc] || acc;
        b.setAttribute('data-key', 'accessory');
        b.setAttribute('data-value', acc);
        b.addEventListener('click', function () {
          setAppearance('accessory', acc);
        });
        accRow.appendChild(b);
      });
    }

    refreshActiveStates();
  }

  function createSwatch(color, key, value) {
    var sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.backgroundColor = color;
    sw.setAttribute('data-key', key);
    sw.setAttribute('data-value', value);
    sw.addEventListener('click', function () {
      setAppearance(key, value);
    });
    return sw;
  }

  function refreshActiveStates() {
    var app = getAppearance();
    if (!app) return;

    // Swatches
    var swatches = document.querySelectorAll('.swatch');
    for (var i = 0; i < swatches.length; i++) {
      var sw = swatches[i];
      var key = sw.getAttribute('data-key');
      var val = sw.getAttribute('data-value');
      if (app[key] === val) {
        sw.classList.add('active');
      } else {
        sw.classList.remove('active');
      }
    }

    // Style buttons
    var btns = document.querySelectorAll('.style-btn');
    for (var j = 0; j < btns.length; j++) {
      var b = btns[j];
      var bKey = b.getAttribute('data-key');
      var bVal = b.getAttribute('data-value');
      if (app[bKey] === bVal) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    }
  }

  // ─── Preview drawing ──────────────────────────────────────────

  function drawPreview() {
    if (!previewCtx || !previewCanvas) return;
    var ctx = previewCtx;
    var w = previewCanvas.width;
    var h = previewCanvas.height;
    var app = getAppearance();
    if (!app) return;

    ctx.clearRect(0, 0, w, h);

    var cx = w / 2;
    var baseY = h * 0.75;
    var scale = 2.2;

    var outfitColor = app.outfitColor;
    var skinTone = app.skinTone;
    var hairStyle = app.hairStyle;
    var hairColor = app.hairColor;
    var accessory = app.accessory;

    // Body
    var bodyW = 5 * scale;
    var bodyH = 9 * scale;
    ctx.fillStyle = outfitColor;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - bodyH * 0.3, bodyW, bodyH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darken(outfitColor, 0.4);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Belt
    ctx.strokeStyle = darken(outfitColor, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - bodyH * 0.15, bodyW * 0.9, 1, 0, 0, Math.PI);
    ctx.stroke();

    // Legs
    var legLen = 7 * scale;
    ctx.strokeStyle = darken(outfitColor, 0.6);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 3 * scale, baseY + bodyH * 0.15);
    ctx.lineTo(cx - 3 * scale, baseY + bodyH * 0.15 + legLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 3 * scale, baseY + bodyH * 0.15);
    ctx.lineTo(cx + 3 * scale, baseY + bodyH * 0.15 + legLen);
    ctx.stroke();

    // Shoes
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(cx - 3 * scale, baseY + bodyH * 0.15 + legLen, 2.5 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 3 * scale, baseY + bodyH * 0.15 + legLen, 2.5 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Arms
    ctx.strokeStyle = darken(outfitColor, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.85, baseY - bodyH * 0.4);
    ctx.lineTo(cx - bodyW * 0.85 - 4 * scale, baseY + 2 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + bodyW * 0.85, baseY - bodyH * 0.4);
    ctx.lineTo(cx + bodyW * 0.85 + 4 * scale, baseY + 2 * scale);
    ctx.stroke();

    // Hands
    ctx.fillStyle = lighten(skinTone, 0.1);
    ctx.beginPath();
    ctx.arc(cx - bodyW * 0.85 - 4 * scale, baseY + 2 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + bodyW * 0.85 + 4 * scale, baseY + 2 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Head
    var headR = 5.5 * scale;
    var headY = baseY - bodyH * 0.65 - headR * 0.3;
    ctx.fillStyle = skinTone;
    ctx.beginPath();
    ctx.arc(cx, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darken(skinTone, 0.3);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Hair on preview
    drawPreviewHair(ctx, cx, headY, headR, hairStyle, hairColor);

    // Accessory on preview
    drawPreviewAccessory(ctx, cx, headY, headR, accessory, outfitColor);

    // Eyes
    var eyeSpread = headR * 0.35;
    var eyeY = headY - headR * 0.1;
    var eyeSize = 1.5 * scale;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeSpread, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(cx - eyeSpread, eyeY, eyeSize * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeSpread, eyeY, eyeSize * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPreviewHair(ctx, cx, headY, hR, style, hc) {
    if (!style || style === 'none') return;
    ctx.fillStyle = hc;

    if (style === 'spiky') {
      for (var i = 0; i < 5; i++) {
        var spikeX = cx + (i - 2) * (hR * 0.4);
        var spikeBaseY = headY - hR * 0.6;
        var spikeH = hR * (0.7 + Math.sin(i * 1.8) * 0.3);
        ctx.beginPath();
        ctx.moveTo(spikeX - hR * 0.15, spikeBaseY);
        ctx.lineTo(spikeX + hR * 0.05, spikeBaseY - spikeH);
        ctx.lineTo(spikeX + hR * 0.15, spikeBaseY);
        ctx.closePath();
        ctx.fill();
      }
    } else if (style === 'mohawk') {
      ctx.beginPath();
      ctx.moveTo(cx - hR * 0.15, headY - hR * 0.5);
      ctx.lineTo(cx - hR * 0.08, headY - hR * 1.5);
      ctx.lineTo(cx + hR * 0.08, headY - hR * 1.5);
      ctx.lineTo(cx + hR * 0.15, headY - hR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, headY - hR * 0.65, hR * 0.2, hR * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 'bun') {
      ctx.beginPath();
      ctx.arc(cx, headY - hR * 1.1, hR * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, headY, hR * 1.05, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.lineWidth = hR * 0.25;
      ctx.strokeStyle = hc;
      ctx.stroke();
      ctx.lineWidth = 0.8;
    } else if (style === 'curly') {
      var curls = [
        { x: -0.4, y: -0.7 }, { x: 0, y: -0.9 }, { x: 0.4, y: -0.7 },
        { x: -0.55, y: -0.35 }, { x: 0.55, y: -0.35 },
        { x: -0.3, y: -0.85 }, { x: 0.3, y: -0.85 }
      ];
      for (var ci = 0; ci < curls.length; ci++) {
        ctx.beginPath();
        ctx.arc(cx + curls[ci].x * hR, headY + curls[ci].y * hR, hR * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === 'long') {
      ctx.beginPath();
      ctx.arc(cx, headY, hR * 1.05, -Math.PI * 0.9, -Math.PI * 0.1);
      ctx.lineWidth = hR * 0.3;
      ctx.strokeStyle = hc;
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.fillStyle = hc;
      ctx.fillRect(cx - hR * 1.05, headY - hR * 0.1, hR * 0.3, hR * 1.2);
      ctx.fillRect(cx + hR * 0.75, headY - hR * 0.1, hR * 0.3, hR * 1.2);
      ctx.beginPath();
      ctx.arc(cx - hR * 0.9, headY + hR * 1.1, hR * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + hR * 0.9, headY + hR * 1.1, hR * 0.15, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 'buzz') {
      ctx.beginPath();
      ctx.arc(cx, headY, hR * 1.04, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.lineWidth = hR * 0.15;
      ctx.strokeStyle = hc;
      ctx.stroke();
      ctx.lineWidth = 0.8;
    } else if (style === 'ponytail') {
      ctx.beginPath();
      ctx.arc(cx, headY, hR * 1.05, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.lineWidth = hR * 0.2;
      ctx.strokeStyle = hc;
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.fillStyle = hc;
      ctx.beginPath();
      ctx.moveTo(cx + hR * 0.6, headY - hR * 0.5);
      ctx.quadraticCurveTo(cx + hR * 1.6, headY - hR * 0.2, cx + hR * 1.4, headY + hR * 0.8);
      ctx.quadraticCurveTo(cx + hR * 1.2, headY + hR * 0.5, cx + hR * 0.5, headY - hR * 0.2);
      ctx.closePath();
      ctx.fill();
    } else if (style === 'flat') {
      ctx.fillStyle = hc;
      var flatW = hR * 1.2;
      var flatH = hR * 0.5;
      ctx.fillRect(cx - flatW, headY - hR - flatH * 0.5, flatW * 2, flatH);
      ctx.beginPath();
      ctx.arc(cx - flatW, headY - hR - flatH * 0.5 + flatH * 0.3, flatH * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + flatW, headY - hR - flatH * 0.5 + flatH * 0.3, flatH * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPreviewAccessory(ctx, cx, headY, hR, acc, outfitColor) {
    if (!acc || acc === 'none') return;

    if (acc === 'glasses') {
      var glassY = headY - hR * 0.1;
      var glassSpread = hR * 0.38;
      var glassR = hR * 0.28;
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx - glassSpread, glassY, glassR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + glassSpread, glassY, glassR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - glassSpread + glassR, glassY);
      ctx.lineTo(cx + glassSpread - glassR, glassY);
      ctx.stroke();
      ctx.fillStyle = 'rgba(100,200,255,0.15)';
      ctx.beginPath();
      ctx.arc(cx - glassSpread, glassY, glassR - 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + glassSpread, glassY, glassR - 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (acc === 'cap') {
      var capY = headY - hR * 0.55;
      ctx.fillStyle = darken(outfitColor, 0.5);
      ctx.beginPath();
      ctx.ellipse(cx, capY, hR * 1.1, hR * 0.5, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = darken(outfitColor, 0.6);
      ctx.beginPath();
      ctx.ellipse(cx + hR * 0.3, capY + hR * 0.05, hR * 0.9, hR * 0.15, 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (acc === 'headphones') {
      var hpY = headY - hR * 0.2;
      ctx.strokeStyle = '#444444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, headY - hR * 0.2, hR * 1.15, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();
      ctx.fillStyle = '#333333';
      ctx.beginPath();
      ctx.ellipse(cx - hR * 1.08, hpY + hR * 0.15, hR * 0.25, hR * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#555555';
      ctx.beginPath();
      ctx.ellipse(cx - hR * 1.08, hpY + hR * 0.15, hR * 0.15, hR * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333333';
      ctx.beginPath();
      ctx.ellipse(cx + hR * 1.08, hpY + hR * 0.15, hR * 0.25, hR * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#555555';
      ctx.beginPath();
      ctx.ellipse(cx + hR * 1.08, hpY + hR * 0.15, hR * 0.15, hR * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Simple color helpers for preview (don't depend on renderer)
  function darken(hex, factor) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.round(r * factor);
    g = Math.round(g * factor);
    b = Math.round(b * factor);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function lighten(hex, factor) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.round(r + (255 - r) * factor));
    g = Math.min(255, Math.round(g + (255 - g) * factor));
    b = Math.min(255, Math.round(b + (255 - b) * factor));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

  window.Customize = {
    toggle: toggle,
    open: open,
    close: close,
    isOpen: function () { return isOpen; }
  };
})();
