(function () {
  'use strict';

  var activePrompt = null;  // { text, type, data } - what to show the player
  var modalOpen = false;
  var INTERACT_DIST = 40;

  function getPlayerCenter() {
    var p = Game.localPlayer;
    return { x: p.x, y: p.y };
  }

  function rectContains(rect, px, py, margin) {
    margin = margin || 0;
    return px >= rect.x - margin && px <= rect.x + rect.w + margin &&
           py >= rect.y - margin && py <= rect.y + rect.h + margin;
  }

  // Check if player is near any door in current room
  function checkDoorProximity() {
    var doors = Rooms.getRoomDoors(Game.currentRoom);
    var pos = getPlayerCenter();

    for (var i = 0; i < doors.length; i++) {
      var door = doors[i];
      if (rectContains(door, pos.x, pos.y, 15)) {
        return {
          type: 'door',
          text: 'Press E to enter ' + door.label,
          data: door
        };
      }
    }
    return null;
  }

  // Check if player is near any interactable in current room
  function checkInteractableProximity() {
    var interactables = Rooms.getRoomInteractables(Game.currentRoom);
    var pos = getPlayerCenter();

    for (var i = 0; i < interactables.length; i++) {
      var obj = interactables[i];
      if (rectContains(obj, pos.x, pos.y, 20)) {
        return {
          type: 'interactable',
          text: obj.promptText || 'Press E to interact',
          data: obj
        };
      }
    }
    return null;
  }

  // Called every frame to update what prompt to show
  function update() {
    if (modalOpen) {
      activePrompt = null;
      return;
    }

    // Check bar proximity in main room
    if (Game.currentRoom === 'main' && Game.localPlayer.drinkState === 'none' && Game.isNearBar()) {
      activePrompt = { type: 'bar', text: 'Press E to order a drink', data: null };
      return;
    }

    var doorPrompt = checkDoorProximity();
    if (doorPrompt) {
      activePrompt = doorPrompt;
      return;
    }

    var interactPrompt = checkInteractableProximity();
    if (interactPrompt) {
      activePrompt = interactPrompt;
      return;
    }

    activePrompt = null;
  }

  // Called when player presses E
  function interact() {
    if (modalOpen) return;

    if (!activePrompt) {
      // Try bar order in main room
      if (Game.currentRoom === 'main') {
        Game.tryOrderDrink();
      }
      return;
    }

    if (activePrompt.type === 'door') {
      Game.transitionToRoom(activePrompt.data.target, activePrompt.data.targetSpawnX, activePrompt.data.targetSpawnY);
      return;
    }

    if (activePrompt.type === 'bar') {
      Game.tryOrderDrink();
      return;
    }

    if (activePrompt.type === 'interactable') {
      handleInteractable(activePrompt.data);
      return;
    }
  }

  function handleInteractable(obj) {
    switch (obj.type) {
      case 'demo_drop':
        showDemoDropModal();
        break;
      case 'bookings':
        showBookingsModal();
        break;
      case 'release':
        showReleaseModal(obj.releaseData);
        break;
      case 'social_link':
        window.open(obj.url, '_blank');
        break;
      case 'mailing_list':
        showMailingListModal();
        break;
    }
  }

  // ─── Modal system ────────────────────────────────────────────────

  function showModal(html) {
    var container = document.getElementById('modalContainer');
    if (!container) return;
    container.innerHTML = html;
    container.style.display = 'flex';
    modalOpen = true;
  }

  function hideModal() {
    var container = document.getElementById('modalContainer');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'none';
    modalOpen = false;
  }

  function showDemoDropModal() {
    showModal(
      '<div class="modal-box">' +
        '<h2>Drop Your Demo</h2>' +
        '<p class="modal-subtitle">Send us your best track</p>' +
        '<form id="demoDropForm">' +
          '<input type="text" id="dd_artist" placeholder="Artist name" required>' +
          '<input type="email" id="dd_email" placeholder="Email" required>' +
          '<input type="text" id="dd_link" placeholder="Demo link (SoundCloud, Dropbox...)" required>' +
          '<textarea id="dd_message" placeholder="Short message (optional)" rows="3"></textarea>' +
          '<button type="submit" class="modal-btn">Submit Demo</button>' +
        '</form>' +
        '<button class="modal-close" onclick="Interaction.hideModal()">\u2715</button>' +
      '</div>'
    );

    var form = document.getElementById('demoDropForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var artist = document.getElementById('dd_artist').value;
        var email = document.getElementById('dd_email').value;
        var link = document.getElementById('dd_link').value;
        var msg = document.getElementById('dd_message').value;

        Network.submitDemoDrop(artist, email, link, msg).then(function (res) {
          showModal(
            '<div class="modal-box">' +
              '<h2>Demo Received!</h2>' +
              '<p class="modal-subtitle">We\'ll have a listen. Thanks!</p>' +
              '<button class="modal-btn" onclick="Interaction.hideModal()">Nice</button>' +
            '</div>'
          );
        }).catch(function () {
          showModal(
            '<div class="modal-box">' +
              '<h2>Oops</h2>' +
              '<p class="modal-subtitle">Something went wrong. Try again later.</p>' +
              '<button class="modal-btn" onclick="Interaction.hideModal()">OK</button>' +
            '</div>'
          );
        });
      });
    }
  }

  function showBookingsModal() {
    showModal(
      '<div class="modal-box">' +
        '<h2>Bookings</h2>' +
        '<p class="modal-subtitle">Want to book Revilo & Longfield?</p>' +
        '<p class="modal-email">bookings@revilolongfield.nl</p>' +
        '<a href="mailto:bookings@revilolongfield.nl" class="modal-btn" target="_blank">Send Email</a>' +
        '<button class="modal-close" onclick="Interaction.hideModal()">\u2715</button>' +
      '</div>'
    );
  }

  function showReleaseModal(release) {
    if (!release) return;
    var linksHTML = '';
    if (release.links) {
      if (release.links.spotify) {
        linksHTML += '<a href="' + release.links.spotify + '" target="_blank" class="release-link release-link-spotify">Spotify</a>';
      }
      if (release.links.youtube) {
        linksHTML += '<a href="' + release.links.youtube + '" target="_blank" class="release-link release-link-youtube">YouTube</a>';
      }
      if (release.links.soundcloud) {
        linksHTML += '<a href="' + release.links.soundcloud + '" target="_blank" class="release-link release-link-soundcloud">SoundCloud</a>';
      }
    }

    showModal(
      '<div class="modal-box">' +
        '<div class="release-artwork"></div>' +
        '<h2>' + (release.title || 'Untitled') + '</h2>' +
        '<p class="modal-subtitle">' + (release.artist || '') + ' &middot; ' + (release.date || '') + '</p>' +
        '<div class="release-links">' + linksHTML + '</div>' +
        '<button class="modal-close" onclick="Interaction.hideModal()">\u2715</button>' +
      '</div>'
    );
  }

  function showMailingListModal() {
    showModal(
      '<div class="modal-box">' +
        '<h2>Guest Book</h2>' +
        '<p class="modal-subtitle">Join the mailing list</p>' +
        '<form id="mailingListForm">' +
          '<input type="email" id="ml_email" placeholder="Your email" required>' +
          '<button type="submit" class="modal-btn">Sign Up</button>' +
        '</form>' +
        '<button class="modal-close" onclick="Interaction.hideModal()">\u2715</button>' +
      '</div>'
    );

    var form = document.getElementById('mailingListForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = document.getElementById('ml_email').value;

        Network.submitMailingList(email).then(function (res) {
          showModal(
            '<div class="modal-box">' +
              '<h2>You\'re on the list!</h2>' +
              '<p class="modal-subtitle">Welcome to the VIP.</p>' +
              '<button class="modal-btn" onclick="Interaction.hideModal()">Nice</button>' +
            '</div>'
          );
        }).catch(function () {
          showModal(
            '<div class="modal-box">' +
              '<h2>Oops</h2>' +
              '<p class="modal-subtitle">Something went wrong. Try again.</p>' +
              '<button class="modal-btn" onclick="Interaction.hideModal()">OK</button>' +
            '</div>'
          );
        });
      });
    }
  }

  function getActivePrompt() {
    return activePrompt;
  }

  function isModalOpen() {
    return modalOpen;
  }

  window.Interaction = {
    update: update,
    interact: interact,
    getActivePrompt: getActivePrompt,
    isModalOpen: isModalOpen,
    hideModal: hideModal,
    showModal: showModal
  };
})();
