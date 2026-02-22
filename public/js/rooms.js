(function () {
  'use strict';

  var ROOMS = {
    main: {
      name: 'Main Club',
      width: 800,
      height: 600,
      spawnX: 400,
      spawnY: 520,
      doors: [
        {
          id: 'backstage',
          x: 30, y: 80, w: 40, h: 60,
          label: 'BACKSTAGE',
          target: 'backstage',
          targetSpawnX: 500, targetSpawnY: 340,
          color: '#ff8c00'
        },
        {
          id: 'releases',
          x: 730, y: 280, w: 40, h: 60,
          label: 'RELEASES',
          target: 'releases',
          targetSpawnX: 80, targetSpawnY: 200,
          color: '#FFD700'
        },
        {
          id: 'vip',
          x: 680, y: 500, w: 60, h: 40,
          label: 'VIP',
          target: 'vip',
          targetSpawnX: 80, targetSpawnY: 200,
          color: '#e94560'
        },
        {
          id: 'rooftop',
          x: 400, y: 30, w: 60, h: 40,
          label: 'ROOFTOP',
          target: 'rooftop',
          targetSpawnX: 350, targetSpawnY: 400,
          color: '#FFD700'
        },
      ],
      interactables: [],
      npcs: 'crowd', // use the main crowd NPC system
      hasBar: true,
      hasDJ: true,
      hasLightshow: true
    },

    backstage: {
      name: 'Backstage',
      width: 600,
      height: 400,
      spawnX: 500,
      spawnY: 340,
      doors: [
        {
          id: 'back_to_club',
          x: 510, y: 320, w: 40, h: 60,
          label: 'BACK TO CLUB',
          target: 'main',
          targetSpawnX: 60, targetSpawnY: 120,
          color: '#f0f0f0'
        }
      ],
      interactables: [
        {
          id: 'bookings',
          x: 350, y: 80, w: 70, h: 50,
          label: 'Bookings',
          type: 'bookings',
          promptText: 'Press E for booking info'
        }
      ],
      npcs: [
        { id: 'bs_npc_0', x: 100, y: 250, color: '#a070d0', state: 'idle', facingDx: 1, facingDy: 0 },
        { id: 'bs_npc_1', x: 130, y: 270, color: '#60b080', state: 'idle', facingDx: -1, facingDy: 0.5 },
        { id: 'bs_npc_2', x: 400, y: 300, color: '#e0a050', state: 'idle', facingDx: 0, facingDy: -1 }
      ],
      hasBar: false,
      hasDJ: false,
      hasLightshow: false,
      theme: 'industrial'
    },

    releases: {
      name: 'Releases',
      width: 600,
      height: 400,
      spawnX: 80,
      spawnY: 200,
      doors: [
        {
          id: 'back_to_club_r',
          x: 20, y: 170, w: 40, h: 60,
          label: 'BACK TO CLUB',
          target: 'main',
          targetSpawnX: 720, targetSpawnY: 310,
          color: '#f0f0f0'
        }
      ],
      interactables: [
        {
          id: 'release_1',
          x: 120, y: 40, w: 60, h: 60,
          label: 'Telling Me EP',
          type: 'release',
          promptText: 'Press E to view release',
          releaseData: {
            title: 'Telling Me EP',
            artist: 'Revilo & Longfield',
            date: '2025',
            artwork: null,
            isReal: true,
            links: {
              spotify: 'https://open.spotify.com',
              youtube: 'https://youtube.com',
              soundcloud: 'https://soundcloud.com'
            }
          }
        },
        {
          id: 'release_2',
          x: 260, y: 40, w: 60, h: 60,
          label: 'Electric Dreams',
          type: 'release',
          promptText: 'Press E to view release',
          releaseData: {
            title: 'Electric Dreams',
            artist: 'Revilo & Longfield',
            date: '2024',
            artwork: null,
            isReal: false,
            links: {
              spotify: 'https://open.spotify.com',
              youtube: 'https://youtube.com',
              soundcloud: 'https://soundcloud.com'
            }
          }
        },
        {
          id: 'release_3',
          x: 400, y: 40, w: 60, h: 60,
          label: 'Late Night Dub',
          type: 'release',
          promptText: 'Press E to view release',
          releaseData: {
            title: 'Late Night Dub',
            artist: 'Revilo & Longfield',
            date: '2024',
            artwork: null,
            isReal: false,
            links: {
              spotify: 'https://open.spotify.com',
              youtube: 'https://youtube.com',
              soundcloud: 'https://soundcloud.com'
            }
          }
        },
        {
          id: 'release_4',
          x: 120, y: 300, w: 60, h: 60,
          label: 'Euphoria',
          type: 'release',
          promptText: 'Press E to view release',
          releaseData: {
            title: 'Euphoria',
            artist: 'Revilo & Longfield',
            date: '2023',
            artwork: null,
            isReal: false,
            links: {
              spotify: 'https://open.spotify.com',
              youtube: 'https://youtube.com',
              soundcloud: 'https://soundcloud.com'
            }
          }
        },
        {
          id: 'release_5',
          x: 260, y: 300, w: 60, h: 60,
          label: 'Deep State',
          type: 'release',
          promptText: 'Press E to view release',
          releaseData: {
            title: 'Deep State',
            artist: 'Revilo & Longfield',
            date: '2023',
            artwork: null,
            isReal: false,
            links: {
              spotify: 'https://open.spotify.com',
              youtube: 'https://youtube.com',
              soundcloud: 'https://soundcloud.com'
            }
          }
        }
      ],
      npcs: [],
      hasBar: false,
      hasDJ: false,
      hasLightshow: false,
      theme: 'record_shop'
    },

    vip: {
      name: 'VIP Lounge',
      width: 500,
      height: 400,
      spawnX: 80,
      spawnY: 200,
      doors: [
        {
          id: 'back_to_club_v',
          x: 20, y: 170, w: 40, h: 60,
          label: 'BACK TO CLUB',
          target: 'main',
          targetSpawnX: 670, targetSpawnY: 490,
          color: '#f0f0f0'
        }
      ],
      interactables: [
        {
          id: 'social_spotify',
          x: 140, y: 30, w: 50, h: 50,
          label: 'Spotify',
          type: 'social_link',
          promptText: 'Press E to open Spotify',
          url: 'https://open.spotify.com',
          neonColor: '#1DB954'
        },
        {
          id: 'social_instagram',
          x: 230, y: 30, w: 50, h: 50,
          label: 'Instagram',
          type: 'social_link',
          promptText: 'Press E to open Instagram',
          url: 'https://instagram.com',
          neonColor: '#E1306C'
        },
        {
          id: 'social_soundcloud',
          x: 320, y: 30, w: 50, h: 50,
          label: 'SoundCloud',
          type: 'social_link',
          promptText: 'Press E to open SoundCloud',
          url: 'https://soundcloud.com',
          neonColor: '#FF5500'
        },
        {
          id: 'social_youtube',
          x: 410, y: 30, w: 50, h: 50,
          label: 'YouTube',
          type: 'social_link',
          promptText: 'Press E to open YouTube',
          url: 'https://youtube.com',
          neonColor: '#FF0000'
        },
        {
          id: 'mailing_list',
          x: 250, y: 280, w: 80, h: 50,
          label: 'Guest Book',
          type: 'mailing_list',
          promptText: 'Press E to sign the guest book'
        }
      ],
      npcs: [],
      hasBar: false,
      hasDJ: false,
      hasLightshow: false,
      theme: 'vip'
    },

    rooftop: {
      name: 'Rooftop',
      width: 700,
      height: 500,
      spawnX: 350,
      spawnY: 400,
      doors: [
        {
          id: 'back_to_club_roof',
          x: 320, y: 460, w: 60, h: 40,
          label: 'BACK TO CLUB',
          target: 'main',
          targetSpawnX: 400, targetSpawnY: 300,
          color: '#f0f0f0'
        }
      ],
      interactables: [
        {
          id: 'bio',
          x: 150, y: 80, w: 80, h: 50,
          label: 'Bio',
          type: 'bio',
          promptText: 'Press E to read bio'
        },
        {
          id: 'photos',
          x: 350, y: 80, w: 80, h: 50,
          label: 'Photos',
          type: 'photo_gallery',
          promptText: 'Press E to view photos'
        },
        {
          id: 'epk',
          x: 550, y: 80, w: 80, h: 50,
          label: 'EPK',
          type: 'epk',
          promptText: 'Press E to view EPK'
        }
      ],
      npcs: [
        { id: 'rf_npc_0', x: 200, y: 250, color: '#c0a0e0', state: 'idle', facingDx: 1, facingDy: 0 },
        { id: 'rf_npc_1', x: 500, y: 300, color: '#80d0b0', state: 'idle', facingDx: -1, facingDy: 0 }
      ],
      hasBar: false,
      hasDJ: false,
      hasLightshow: false,
      theme: 'rooftop'
    }
  };

  function getRoom(roomId) {
    return ROOMS[roomId] || ROOMS.main;
  }

  function getRoomDoors(roomId) {
    var room = getRoom(roomId);
    return room.doors || [];
  }

  function getRoomInteractables(roomId) {
    var room = getRoom(roomId);
    return room.interactables || [];
  }

  function getAllRoomIds() {
    return Object.keys(ROOMS);
  }

  window.Rooms = {
    ROOMS: ROOMS,
    getRoom: getRoom,
    getRoomDoors: getRoomDoors,
    getRoomInteractables: getRoomInteractables,
    getAllRoomIds: getAllRoomIds
  };
})();
