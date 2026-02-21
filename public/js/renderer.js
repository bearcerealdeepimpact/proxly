import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import SpriteManager from './sprites.js';

var COLORS = {
  LOCAL_PLAYER: '#4488ff',
  REMOTE_COLORS: ['#ff6644', '#44cc66', '#cc44cc', '#cccc44', '#44cccc', '#ff8844']
};

var LAYOUT = {
  WALL_THICKNESS: 10,
  STAGE_HEIGHT: 100,
  STAGE_X: 60,
  STAGE_WIDTH: 680,
  DANCE_FLOOR_X: 200,
  DANCE_FLOOR_Y: 220,
  DANCE_FLOOR_W: 400,
  DANCE_FLOOR_H: 160,
  BAR_X: 60,
  BAR_Y: 460,
  BAR_W: 200,
  BAR_H: 30,
  TABLE_RADIUS: 15,
  TABLES: [
    { x: 120, y: 180 },
    { x: 400, y: 180 },
    { x: 680, y: 180 },
    { x: 120, y: 420 },
    { x: 400, y: 420 },
    { x: 680, y: 420 }
  ]
};

var scene = null;
var camera = null;
var webglRenderer = null;
var css2dRenderer = null;
var players = {};
var container = null;

function toWorld(x2d, y2d) {
  return {
    x: (x2d - 400) / 20,
    z: (y2d - 300) / 20
  };
}

function hashCode(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function createClubGeometry() {
  // Floor plane (40x30 units)
  var floorGeo = new THREE.PlaneGeometry(40, 30);
  var floorMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a });
  var floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Walls
  var wallMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  var wallHeight = 4;
  var wallThick = 0.5;

  // Top wall (north)
  var topWall = new THREE.Mesh(new THREE.BoxGeometry(40, wallHeight, wallThick), wallMat);
  topWall.position.set(0, wallHeight / 2, -15);
  topWall.castShadow = true;
  scene.add(topWall);

  // Bottom wall (south)
  var bottomWall = new THREE.Mesh(new THREE.BoxGeometry(40, wallHeight, wallThick), wallMat);
  bottomWall.position.set(0, wallHeight / 2, 15);
  bottomWall.castShadow = true;
  scene.add(bottomWall);

  // Left wall (west)
  var leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, 30), wallMat);
  leftWall.position.set(-20, wallHeight / 2, 0);
  leftWall.castShadow = true;
  scene.add(leftWall);

  // Right wall (east)
  var rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, 30), wallMat);
  rightWall.position.set(20, wallHeight / 2, 0);
  rightWall.castShadow = true;
  scene.add(rightWall);

  // Stage platform (raised)
  var stagePos = toWorld(LAYOUT.STAGE_X + LAYOUT.STAGE_WIDTH / 2, LAYOUT.WALL_THICKNESS + LAYOUT.STAGE_HEIGHT / 2);
  var stageW = LAYOUT.STAGE_WIDTH / 20;
  var stageD = LAYOUT.STAGE_HEIGHT / 20;
  var stageH = 1.0;
  var stageMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a });
  var stage = new THREE.Mesh(new THREE.BoxGeometry(stageW, stageH, stageD), stageMat);
  stage.position.set(stagePos.x, stageH / 2, stagePos.z);
  stage.receiveShadow = true;
  stage.castShadow = true;
  scene.add(stage);

  // Dance floor (recessed, colored)
  var dfPos = toWorld(LAYOUT.DANCE_FLOOR_X + LAYOUT.DANCE_FLOOR_W / 2, LAYOUT.DANCE_FLOOR_Y + LAYOUT.DANCE_FLOOR_H / 2);
  var dfW = LAYOUT.DANCE_FLOOR_W / 20;
  var dfD = LAYOUT.DANCE_FLOOR_H / 20;
  var danceFloorGeo = new THREE.PlaneGeometry(dfW, dfD);
  var danceFloorMat = new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0x110808, emissiveIntensity: 0.3 });
  var danceFloor = new THREE.Mesh(danceFloorGeo, danceFloorMat);
  danceFloor.rotation.x = -Math.PI / 2;
  danceFloor.position.set(dfPos.x, 0.01, dfPos.z);
  danceFloor.receiveShadow = true;
  scene.add(danceFloor);

  // Bar counter
  var barPos = toWorld(LAYOUT.BAR_X + LAYOUT.BAR_W / 2, LAYOUT.BAR_Y + LAYOUT.BAR_H / 2);
  var barW = LAYOUT.BAR_W / 20;
  var barD = LAYOUT.BAR_H / 20;
  var barH = 1.2;
  var barMat = new THREE.MeshStandardMaterial({ color: 0x1a0f05 });
  var bar = new THREE.Mesh(new THREE.BoxGeometry(barW, barH, barD), barMat);
  bar.position.set(barPos.x, barH / 2, barPos.z);
  bar.castShadow = true;
  bar.receiveShadow = true;
  scene.add(bar);

  // Tables (cylinders)
  var tableMat = new THREE.MeshStandardMaterial({ color: 0x1a0f05 });
  for (var i = 0; i < LAYOUT.TABLES.length; i++) {
    var t = LAYOUT.TABLES[i];
    var tPos = toWorld(t.x, t.y);
    var tableRadius = LAYOUT.TABLE_RADIUS / 20;
    var tableH = 0.9;
    var table = new THREE.Mesh(new THREE.CylinderGeometry(tableRadius, tableRadius, tableH, 16), tableMat);
    table.position.set(tPos.x, tableH / 2, tPos.z);
    table.castShadow = true;
    table.receiveShadow = true;
    scene.add(table);
  }
}

function createLighting() {
  // Ambient light (dim)
  var ambient = new THREE.AmbientLight(0x222244, 0.4);
  scene.add(ambient);

  // Stage spotlights (colored)
  var spotColors = [0xff4466, 0x4466ff, 0x44ff66];
  var stageCenter = toWorld(400, 60);
  for (var i = 0; i < spotColors.length; i++) {
    var spot = new THREE.SpotLight(spotColors[i], 2, 30, Math.PI / 6, 0.5, 1);
    spot.position.set(stageCenter.x + (i - 1) * 6, 10, stageCenter.z);
    spot.target.position.set(stageCenter.x + (i - 1) * 3, 0, stageCenter.z + 2);
    spot.castShadow = true;
    scene.add(spot);
    scene.add(spot.target);
  }

  // Atmospheric point lights throughout club
  var pointPositions = [
    { x: -8, z: 0 },
    { x: 8, z: 0 },
    { x: 0, z: -6 },
    { x: 0, z: 6 }
  ];
  for (var j = 0; j < pointPositions.length; j++) {
    var p = pointPositions[j];
    var point = new THREE.PointLight(0xff8844, 0.6, 20, 2);
    point.position.set(p.x, 5, p.z);
    scene.add(point);
  }
}

function init(containerElement) {
  if (!containerElement) {
    return;
  }
  container = containerElement;

  // Load sprite textures
  SpriteManager.loadSprites().then(function() {
    console.log('Sprite textures loaded successfully');
  }).catch(function(error) {
    console.error('Failed to load sprite textures:', error);
  });

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.02);

  // Camera
  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(0, 30, 25);
  camera.lookAt(0, 0, 0);

  // WebGL Renderer
  webglRenderer = new THREE.WebGLRenderer({ antialias: true });
  webglRenderer.setSize(container.clientWidth, container.clientHeight);
  webglRenderer.setPixelRatio(window.devicePixelRatio);
  webglRenderer.shadowMap.enabled = true;
  webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(webglRenderer.domElement);

  // CSS2D Renderer
  css2dRenderer = new CSS2DRenderer();
  css2dRenderer.setSize(container.clientWidth, container.clientHeight);
  css2dRenderer.domElement.style.position = 'absolute';
  css2dRenderer.domElement.style.top = '0';
  css2dRenderer.domElement.style.left = '0';
  css2dRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(css2dRenderer.domElement);

  createLighting();
  createClubGeometry();
}

function addPlayer(id, name, isLocal, characterId) {
  if (players[id]) {
    return;
  }

  // Default to character 0 if not specified
  var charId = (characterId !== undefined && characterId !== null) ? characterId : 0;

  // Get the sprite texture for this character
  var texture = SpriteManager.getCharacterTexture(charId);

  if (!texture) {
    // Fallback to a placeholder if texture not loaded
    texture = new THREE.Texture();
  }

  // Create sprite material with transparency
  var mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.5
  });

  // Create sprite (billboard - always faces camera)
  var sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 1.6, 1); // Scale to match character size (32px sprite = ~1.6 world units)
  sprite.position.set(0, 0.75, 0); // Position at player height
  scene.add(sprite);

  // Set initial UV coordinates to show idle frame (column 0) facing south (row 1)
  var config = SpriteManager.SPRITE_CONFIG;
  var frameU = config.frameWidth / config.textureWidth;
  var frameV = config.frameHeight / config.textureHeight;

  // South direction (row 1), idle frame (column 0)
  var offsetX = 0 * frameU; // column 0
  var offsetY = 1 * frameV; // row 1 (south)

  texture.offset.set(offsetX, offsetY);

  // CSS2D label
  var labelDiv = document.createElement('div');
  labelDiv.className = 'player-label';
  labelDiv.textContent = name || '';
  labelDiv.style.color = '#ffffff';
  labelDiv.style.fontSize = '12px';
  labelDiv.style.fontFamily = 'Arial, sans-serif';
  labelDiv.style.textShadow = '1px 1px 2px #000000';
  labelDiv.style.pointerEvents = 'none';

  var label = new CSS2DObject(labelDiv);
  label.position.set(0, 1.8, 0);
  sprite.add(label);

  players[id] = {
    mesh: sprite, // Store sprite as 'mesh' for compatibility
    label: label,
    material: mat,
    texture: texture,
    characterId: charId
  };
}

function removePlayer(id) {
  var player = players[id];
  if (!player) {
    return;
  }

  player.mesh.remove(player.label);
  scene.remove(player.mesh);

  // Dispose of material (textures are managed by SpriteManager, don't dispose them)
  player.material.dispose();

  if (player.label.element && player.label.element.parentNode) {
    player.label.element.parentNode.removeChild(player.label.element);
  }

  delete players[id];
}

function updatePlayerPosition(id, x, y, direction, animationFrame) {
  var player = players[id];
  if (!player) {
    return;
  }

  var pos = toWorld(x, y);
  player.mesh.position.set(pos.x, 0.75, pos.z);

  // Update sprite UV coordinates if direction and animationFrame are provided
  if (direction !== undefined && animationFrame !== undefined && player.texture) {
    updatePlayerSprite(id, direction, animationFrame);
  }
}

function updatePlayerSprite(id, direction, animationFrame) {
  var player = players[id];
  if (!player || !player.texture) {
    return;
  }

  // Skip update if direction and frame haven't changed
  if (player.direction === direction && player.animationFrame === animationFrame) {
    return;
  }

  var config = SpriteManager.SPRITE_CONFIG;
  var frameU = config.frameWidth / config.textureWidth;
  var frameV = config.frameHeight / config.textureHeight;

  // Map direction strings to sprite config format
  var directionMap = {
    'down': 'S',
    'up': 'N',
    'right': 'E',
    'left': 'W'
  };
  var mappedDirection = directionMap[direction] || direction;

  // Map direction to row index
  var directionRow = config.directions[mappedDirection];
  if (directionRow === undefined) {
    directionRow = config.directions.S; // Default to South if invalid
  }

  // Calculate UV offset
  var offsetX = animationFrame * frameU; // Column position
  var offsetY = directionRow * frameV;   // Row position

  player.texture.offset.set(offsetX, offsetY);

  // Store current state
  player.direction = direction;
  player.animationFrame = animationFrame;
}

function handleResize() {
  if (!container || !camera || !webglRenderer || !css2dRenderer) {
    return;
  }

  var width = container.clientWidth;
  var height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  webglRenderer.setSize(width, height);
  css2dRenderer.setSize(width, height);
}

function render() {
  if (!webglRenderer || !scene || !camera) {
    return;
  }

  webglRenderer.render(scene, camera);
  css2dRenderer.render(scene, camera);
}

function getRenderer() {
  return webglRenderer;
}

export default {
  init: init,
  render: render,
  addPlayer: addPlayer,
  removePlayer: removePlayer,
  updatePlayerPosition: updatePlayerPosition,
  updatePlayerSprite: updatePlayerSprite,
  getRenderer: getRenderer,
  handleResize: handleResize
};
