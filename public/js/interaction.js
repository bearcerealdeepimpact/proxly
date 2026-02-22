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
      case 'bio':
        showBioModal();
        break;
      case 'photo_gallery':
        showPhotosModal();
        break;
      case 'epk':
        showEPKModal();
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

  function showBioModal() {
    showModal(
      '<div class="modal-box">' +
        '<h2>Revilo &amp; Longfield</h2>' +
        '<p class="modal-subtitle">DJ Duo &middot; The Netherlands</p>' +
        '<div class="bio-text">' +
          '<p>Revilo &amp; Longfield are a DJ duo from the Netherlands who share a deep love for disco and funky house. ' +
          'They first crossed paths at a local record fair, bonding over a shared obsession with rare Italo-disco edits ' +
          'and sun-drenched boogie cuts.</p>' +
          '<p>What started as casual back-to-back sessions in living rooms quickly evolved into a partnership built on ' +
          'groove, energy, and a refusal to take the dancefloor too seriously. Their sound blends warm, vinyl-rooted disco ' +
          'with rolling funky house basslines &mdash; always melodic, always moving.</p>' +
          '<p>From intimate bar sets to festival stages, Revilo &amp; Longfield bring a feel-good energy that keeps crowds ' +
          'dancing well past closing time. Their journey is just getting started, and every set is an invitation to join the ride.</p>' +
        '</div>' +
        '<button class="modal-close" onclick="Interaction.hideModal()">✕</button>' +
      '</div>'
    );
  }

  function showPhotosModal() {
    showModal(
      '<div class="modal-box">' +
        '<h2>Photos</h2>' +
        '<p class="modal-subtitle">Revilo &amp; Longfield</p>' +
        '<div class="photo-grid">' +
          '<div class="photo-placeholder">Photo 1</div>' +
          '<div class="photo-placeholder">Photo 2</div>' +
          '<div class="photo-placeholder">Photo 3</div>' +
          '<div class="photo-placeholder">Photo 4</div>' +
          '<div class="photo-placeholder">Photo 5</div>' +
          '<div class="photo-placeholder">Photo 6</div>' +
        '</div>' +
        '<button class="modal-close" onclick="Interaction.hideModal()">✕</button>' +
      '</div>'
    );
  }

  function showEPKModal() {
    showModal(
      '<div class="modal-box">' +
        '<h2>Electronic Press Kit</h2>' +
        '<p class="modal-subtitle">Revilo &amp; Longfield</p>' +
        '<div class="epk-content">' +
          '<div class="epk-section">' +
            '<h3>Press Bio</h3>' +
            '<p>Revilo &amp; Longfield are a Netherlands-based DJ duo specialising in disco and funky house. ' +
            'Known for their warm, groove-driven sets and infectious energy, they blend vinyl-rooted disco with ' +
            'rolling funky house basslines to keep dancefloors moving all night long.</p>' +
          '</div>' +
          '<div class="epk-section">' +
            '<h3>Details</h3>' +
            '<p><strong>Genres:</strong> Disco / Funky House</p>' +
            '<p><strong>Based in:</strong> The Netherlands</p>' +
          '</div>' +
          '<div class="epk-section">' +
            '<h3>Booking</h3>' +
            '<p class="epk-email">bookings@revilolongfield.nl</p>' +
            '<a href="mailto:bookings@revilolongfield.nl" class="modal-btn" target="_blank">Get in Touch</a>' +
          '</div>' +
          '<div class="epk-section">' +
            '<h3>Downloads</h3>' +
            '<a href="#" class="epk-link">Press Photos (Hi-Res)</a>' +
            '<a href="#" class="epk-link">Tech Rider</a>' +
          '</div>' +
        '</div>' +
        '<button class="modal-close" onclick="Interaction.hideModal()">✕</button>' +
      '</div>'
    );
  }

  function showBookingsModal() {
    showModal(
      '<div class="modal-box">' +
        '<h2>Bookings</h2>' +
        '<p class="modal-subtitle">Want to book Revilo & Longfield?</p>' +
        '<p class="modal-email-large">bookings@revilolongfield.nl</p>' +
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
