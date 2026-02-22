(function () {
  'use strict';

  var audio = null;
  var audioAlt = null;
  var currentAudio = null;
  var currentTrack = null;
  var nextTrack = null;
  var serverTimeOffset = 0;
  var trackStartTime = 0;
  var trackDuration = 0;
  var autoplayUnlocked = false;
  var pendingTrack = null;
  var ambientAudio = null;
  var ambientVolume = 0.25;
  var nextTrackPreloaded = false;
  var isMuted = false;
  var volumeBeforeMute = 50;
  var tabFocused = true;

  function init() {
    if (audio) {
      return;
    }
    audio = new Audio();
    audio.preload = 'auto';

    audioAlt = new Audio();
    audioAlt.preload = 'auto';

    currentAudio = audio;

    function setupAudioHandlers(audioElement) {
      audioElement.onerror = function () {
        if (currentAudio === audioElement) {
          currentTrack = null;
        }
      };

      audioElement.onended = function () {
        if (currentAudio === audioElement) {
          handleTrackTransition();
        }
      };

      audioElement.ontimeupdate = function () {
        if (currentAudio === audioElement) {
          handleSeamlessLoop();
        }
      };
    }

    setupAudioHandlers(audio);
    setupAudioHandlers(audioAlt);

    // Ambient audio disabled — placeholder file was a duplicate of the music track.
    // To re-enable, replace /audio/ambient-crowd.mp3 with actual crowd noise and uncomment.
    // ambientAudio = new Audio();
    // ambientAudio.preload = 'auto';
    // ambientAudio.loop = true;
    // ambientAudio.src = '/audio/ambient-crowd.mp3';

    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      var savedVolume = localStorage.getItem('audioVolume');
      if (savedVolume !== null) {
        var volumeValue = parseInt(savedVolume, 10);
        volumeSlider.value = volumeValue;
        audio.volume = volumeValue / 100;
        audioAlt.volume = volumeValue / 100;
        ambientAudio.volume = (volumeValue / 100) * ambientVolume;
      } else {
        audio.volume = volumeSlider.value / 100;
        audioAlt.volume = volumeSlider.value / 100;
        ambientAudio.volume = (volumeSlider.value / 100) * ambientVolume;
      }

      volumeSlider.addEventListener('input', function () {
        setVolume(parseInt(volumeSlider.value, 10));
      });
    }

    checkAutoplayUnlock();

    window.addEventListener('focus', function () {
      tabFocused = true;
      handleTabFocus();
    });

    window.addEventListener('blur', function () {
      tabFocused = false;
    });
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

  function fadeInAudio(audioElement, targetVolume, duration) {
    var startTime = Date.now();
    var fadeDuration = duration || 1500;

    function updateVolume() {
      var elapsed = Date.now() - startTime;
      var progress = Math.min(elapsed / fadeDuration, 1);
      audioElement.volume = targetVolume * progress;

      if (progress < 1) {
        requestAnimationFrame(updateVolume);
      }
    }

    audioElement.volume = 0;
    requestAnimationFrame(updateVolume);
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

    nextTrackPreloaded = false;
    nextTrack = null;

    currentTrack = trackInfo;
    currentAudio.src = trackInfo.url;

    var volumeSlider = document.getElementById('volumeSlider');
    var targetVolume = volumeSlider ? parseInt(volumeSlider.value, 10) / 100 : 0.5;

    var playPromise = currentAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(function () {
        fadeInAudio(currentAudio, targetVolume, 1500);
      }).catch(function (error) {
        currentTrack = null;
      });
    }
  }

  function getCurrentTrack() {
    return currentTrack;
  }

  function getAudioElement() {
    return currentAudio;
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

    if (!currentAudio || !currentTrack) {
      return;
    }

    var targetPosition = calculatePlaybackPosition();
    if (targetPosition < 0 || targetPosition > trackDuration) {
      return;
    }

    var currentPosition = currentAudio.currentTime;
    var drift = Math.abs(targetPosition - currentPosition);

    if (drift > 0.5) {
      currentAudio.currentTime = targetPosition;
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
    if (audioAlt) {
      audioAlt.volume = volumeValue / 100;
    }
    if (ambientAudio) {
      ambientAudio.volume = (volumeValue / 100) * ambientVolume;
    }
    localStorage.setItem('audioVolume', volumeValue.toString());

    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      volumeSlider.value = volumeValue;
    }
  }

  function increaseVolume() {
    if (!audio) {
      init();
    }

    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      var currentVolume = parseInt(volumeSlider.value, 10);
      var newVolume = Math.min(100, currentVolume + 5);
      setVolume(newVolume);
    }
  }

  function decreaseVolume() {
    if (!audio) {
      init();
    }

    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      var currentVolume = parseInt(volumeSlider.value, 10);
      var newVolume = Math.max(0, currentVolume - 5);
      setVolume(newVolume);
    }
  }

  function toggleMute() {
    if (!audio) {
      init();
    }

    var volumeSlider = document.getElementById('volumeSlider');
    if (!volumeSlider) {
      return;
    }

    if (isMuted) {
      setVolume(volumeBeforeMute);
      isMuted = false;
    } else {
      volumeBeforeMute = parseInt(volumeSlider.value, 10);
      setVolume(0);
      isMuted = true;
    }
  }

  function updateNowPlayingUI() {
    var nowPlayingEl = document.getElementById('nowPlaying');
    var trackTitleEl = document.querySelector('.track-title');
    var trackArtistEl = document.querySelector('.track-artist');
    var progressBarEl = document.querySelector('.progress-bar');

    if (!currentTrack) {
      return;
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

  function handleSeamlessLoop() {
    if (!currentAudio || !currentTrack) {
      return;
    }

    var timeRemaining = currentAudio.duration - currentAudio.currentTime;

    if (timeRemaining < 3 && !nextTrackPreloaded && currentTrack) {
      preloadNextTrack();
    }
  }

  function preloadNextTrack() {
    if (nextTrackPreloaded || !currentTrack) {
      return;
    }

    nextTrackPreloaded = true;
    nextTrack = currentTrack;

    var nextAudio = (currentAudio === audio) ? audioAlt : audio;
    nextAudio.src = currentTrack.url;
    nextAudio.load();
  }

  function handleTrackTransition() {
    if (!nextTrack || !nextTrackPreloaded) {
      currentTrack = null;
      return;
    }

    var nextAudio = (currentAudio === audio) ? audioAlt : audio;
    currentAudio = nextAudio;

    var volumeSlider = document.getElementById('volumeSlider');
    var targetVolume = volumeSlider ? parseInt(volumeSlider.value, 10) / 100 : 0.5;

    var playPromise = currentAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(function () {
        fadeInAudio(currentAudio, targetVolume, 1500);
      }).catch(function (error) {
        currentTrack = null;
      });
    }

    nextTrackPreloaded = false;
    nextTrack = null;
  }

  function handleTabFocus() {
    if (!currentAudio || !currentTrack) {
      return;
    }

    if (currentAudio.paused && autoplayUnlocked) {
      var volumeSlider = document.getElementById('volumeSlider');
      var targetVolume = volumeSlider ? parseInt(volumeSlider.value, 10) / 100 : 0.5;

      var playPromise = currentAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(function () {
          fadeInAudio(currentAudio, targetVolume, 1500);
        }).catch(function (error) {
        });
      }
    }

    if (ambientAudio && ambientAudio.paused && autoplayUnlocked) {
      var ambientPlayPromise = ambientAudio.play();
      if (ambientPlayPromise !== undefined) {
        ambientPlayPromise.catch(function (error) {
        });
      }
    }
  }

  window.MusicPlayer = {
    init: init,
    playTrack: playTrack,
    getCurrentTrack: getCurrentTrack,
    getAudioElement: getAudioElement,
    calculatePlaybackPosition: calculatePlaybackPosition,
    syncToServer: syncToServer,
    handleMusicState: handleMusicState,
    handleMusicSync: handleMusicSync,
    updateNowPlayingUI: updateNowPlayingUI,
    setVolume: setVolume,
    increaseVolume: increaseVolume,
    decreaseVolume: decreaseVolume,
    toggleMute: toggleMute
  };
})();
