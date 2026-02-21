(function () {
  'use strict';

  var audio = null;
  var currentTrack = null;
  var serverTimeOffset = 0;
  var trackStartTime = 0;
  var trackDuration = 0;
  var autoplayUnlocked = false;
  var pendingTrack = null;
  var ambientAudio = null;
  var ambientVolume = 0.25;

  function init() {
    if (audio) {
      return;
    }
    audio = new Audio();
    audio.preload = 'auto';

    audio.onerror = function () {
      currentTrack = null;
    };

    audio.onended = function () {
      currentTrack = null;
    };

    ambientAudio = new Audio();
    ambientAudio.preload = 'auto';
    ambientAudio.loop = true;
    ambientAudio.src = '/audio/ambient-crowd.mp3';

    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      var savedVolume = localStorage.getItem('audioVolume');
      if (savedVolume !== null) {
        var volumeValue = parseInt(savedVolume, 10);
        volumeSlider.value = volumeValue;
        audio.volume = volumeValue / 100;
        ambientAudio.volume = (volumeValue / 100) * ambientVolume;
      } else {
        audio.volume = volumeSlider.value / 100;
        ambientAudio.volume = (volumeSlider.value / 100) * ambientVolume;
      }

      volumeSlider.addEventListener('input', function () {
        setVolume(parseInt(volumeSlider.value, 10));
      });
    }

    checkAutoplayUnlock();
  }

  function checkAutoplayUnlock() {
    var unlocked = localStorage.getItem('autoplayUnlocked');
    if (unlocked === 'true') {
      autoplayUnlocked = true;
    } else {
      setupAutoplayUnlock();
    }
  }

  function setupAutoplayUnlock() {
    var unlockBtn = document.getElementById('autoplayUnlockBtn');
    if (unlockBtn) {
      unlockBtn.addEventListener('click', function () {
        autoplayUnlocked = true;
        localStorage.setItem('autoplayUnlocked', 'true');
        hideAutoplayOverlay();

        if (ambientAudio) {
          var ambientPlayPromise = ambientAudio.play();
          if (ambientPlayPromise !== undefined) {
            ambientPlayPromise.catch(function (error) {
            });
          }
        }

        if (pendingTrack) {
          playTrack(pendingTrack);
          pendingTrack = null;
        }
      });
    }
  }

  function showAutoplayOverlay() {
    var overlay = document.getElementById('autoplayOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }
  }

  function hideAutoplayOverlay() {
    var overlay = document.getElementById('autoplayOverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  function playTrack(trackInfo) {
    if (!audio) {
      init();
    }

    if (!trackInfo || !trackInfo.url) {
      return;
    }

    if (!autoplayUnlocked) {
      pendingTrack = trackInfo;
      showAutoplayOverlay();
      return;
    }

    if (ambientAudio && ambientAudio.paused) {
      var ambientPlayPromise = ambientAudio.play();
      if (ambientPlayPromise !== undefined) {
        ambientPlayPromise.catch(function (error) {
        });
      }
    }

    currentTrack = trackInfo;
    audio.src = trackInfo.url;

    var playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(function (error) {
        currentTrack = null;
      });
    }
  }

  function getCurrentTrack() {
    return currentTrack;
  }

  function getAudioElement() {
    return audio;
  }

  function calculatePlaybackPosition() {
    if (!trackStartTime) {
      return 0;
    }
    var serverNow = Date.now() + serverTimeOffset;
    var elapsed = (serverNow - trackStartTime) / 1000;
    return elapsed;
  }

  function syncToServer(serverTime, newTrackStartTime, newTrackDuration) {
    if (!audio) {
      init();
    }

    serverTimeOffset = serverTime - Date.now();
    trackStartTime = newTrackStartTime;
    trackDuration = newTrackDuration || 0;

    if (!audio || !currentTrack) {
      return;
    }

    var targetPosition = calculatePlaybackPosition();
    if (targetPosition < 0 || targetPosition > trackDuration) {
      return;
    }

    var currentPosition = audio.currentTime;
    var drift = Math.abs(targetPosition - currentPosition);

    if (drift > 0.5) {
      audio.currentTime = targetPosition;
    }
  }

  function handleMusicState(message) {
    if (!message || !message.playlist || message.currentTrackIndex === undefined) {
      return;
    }

    var track = message.playlist[message.currentTrackIndex];
    if (!track) {
      return;
    }

    var trackInfo = {
      url: '/audio/' + track.filename,
      title: track.title,
      artist: track.artist,
      duration: track.duration
    };

    playTrack(trackInfo);
    syncToServer(message.serverTime, message.trackStartTime, track.duration);
  }

  function handleMusicSync(message) {
    if (!message || message.currentTrackIndex === undefined) {
      return;
    }

    var track = message.playlist ? message.playlist[message.currentTrackIndex] : null;
    if (track) {
      syncToServer(message.serverTime, message.trackStartTime, track.duration);
    }
  }

  function setVolume(value) {
    if (!audio) {
      init();
    }

    var volumeValue = Math.min(100, Math.max(0, value));
    audio.volume = volumeValue / 100;
    if (ambientAudio) {
      ambientAudio.volume = (volumeValue / 100) * ambientVolume;
    }
    localStorage.setItem('audioVolume', volumeValue.toString());

    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      volumeSlider.value = volumeValue;
    }
  }

  function updateNowPlayingUI() {
    var nowPlayingEl = document.getElementById('nowPlaying');
    var trackTitleEl = document.querySelector('.track-title');
    var trackArtistEl = document.querySelector('.track-artist');
    var progressBarEl = document.querySelector('.progress-bar');

    if (!currentTrack) {
      if (nowPlayingEl) {
        nowPlayingEl.style.display = 'none';
      }
      return;
    }

    if (nowPlayingEl) {
      nowPlayingEl.style.display = 'block';
    }

    if (trackTitleEl) {
      trackTitleEl.textContent = currentTrack.title || 'Unknown Track';
    }

    if (trackArtistEl) {
      trackArtistEl.textContent = currentTrack.artist || '';
    }

    if (progressBarEl && trackDuration > 0) {
      var position = calculatePlaybackPosition();
      var percentage = Math.min(100, Math.max(0, (position / trackDuration) * 100));
      progressBarEl.style.width = percentage + '%';
    }
  }

  window.Audio = {
    init: init,
    playTrack: playTrack,
    getCurrentTrack: getCurrentTrack,
    getAudioElement: getAudioElement,
    calculatePlaybackPosition: calculatePlaybackPosition,
    syncToServer: syncToServer,
    handleMusicState: handleMusicState,
    handleMusicSync: handleMusicSync,
    updateNowPlayingUI: updateNowPlayingUI,
    setVolume: setVolume
  };
})();
