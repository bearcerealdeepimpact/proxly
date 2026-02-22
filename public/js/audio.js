(function () {
  'use strict';

  var audio = null;
  var audioAlt = null;
  var currentAudio = null;
  var currentTrack = null;
  var nextTrack = null;
  var trackDuration = 0;
  var trackStartedAt = 0;
  var nextTrackPreloaded = false;
  var isMuted = true; // Start muted
  var volumeBeforeMute = 50;
  var tabFocused = true;
  var unlocked = false;

  function init() {
    if (audio) return;
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

    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      var savedVolume = localStorage.getItem('audioVolume');
      if (savedVolume !== null) {
        var volumeValue = parseInt(savedVolume, 10);
        volumeSlider.value = volumeValue;
        volumeBeforeMute = volumeValue;
      }
      // Start with volume 0 (muted)
      audio.volume = 0;
      audioAlt.volume = 0;

      volumeSlider.addEventListener('input', function () {
        var val = parseInt(volumeSlider.value, 10);
        if (val > 0) {
          isMuted = false;
          updateMuteIcon();
        }
        setVolumeInternal(val);
        localStorage.setItem('audioVolume', val.toString());
      });
    }

    // Mute toggle button
    var muteBtn = document.getElementById('muteToggle');
    if (muteBtn) {
      muteBtn.addEventListener('click', function () {
        toggleMute();
      });
    }

    window.addEventListener('focus', function () {
      tabFocused = true;
      handleTabFocus();
    });

    window.addEventListener('blur', function () {
      tabFocused = false;
    });

    updateMuteIcon();
  }

  // Called from entrance click (user gesture)
  function unlockAndPlay() {
    unlocked = true;

    // Load and play the track
    fetch('/api/playlist')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.tracks && data.tracks.length > 0) {
          var track = data.tracks[0];
          playTrack({
            url: '/audio/' + track.filename,
            title: track.title,
            artist: track.artist,
            duration: track.duration
          });
        }
      })
      .catch(function () {
        // Silently fail — audio is optional
      });
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
    if (!audio) init();
    if (!trackInfo || !trackInfo.url) return;
    if (!unlocked) return;

    nextTrackPreloaded = false;
    nextTrack = null;
    currentTrack = trackInfo;
    trackDuration = trackInfo.duration || 0;
    trackStartedAt = Date.now();
    currentAudio.src = trackInfo.url;

    var targetVolume = isMuted ? 0 : getStoredVolume() / 100;
    var playPromise = currentAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(function () {
        if (!isMuted) {
          fadeInAudio(currentAudio, targetVolume, 1500);
        }
      }).catch(function () {
        currentTrack = null;
      });
    }
  }

  function getStoredVolume() {
    var slider = document.getElementById('volumeSlider');
    return slider ? parseInt(slider.value, 10) : 50;
  }

  function setVolumeInternal(value) {
    var v = Math.min(100, Math.max(0, value)) / 100;
    if (audio) audio.volume = v;
    if (audioAlt) audioAlt.volume = v;
  }

  function setVolume(value) {
    if (!audio) init();
    var volumeValue = Math.min(100, Math.max(0, value));
    setVolumeInternal(volumeValue);
    localStorage.setItem('audioVolume', volumeValue.toString());
    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      volumeSlider.value = volumeValue;
    }
  }

  function increaseVolume() {
    if (!audio) init();
    var current = getStoredVolume();
    var newVol = Math.min(100, current + 5);
    isMuted = false;
    setVolume(newVol);
    updateMuteIcon();
  }

  function decreaseVolume() {
    if (!audio) init();
    var current = getStoredVolume();
    var newVol = Math.max(0, current - 5);
    setVolume(newVol);
    if (newVol === 0) {
      isMuted = true;
    }
    updateMuteIcon();
  }

  function toggleMute() {
    if (!audio) init();

    if (isMuted) {
      isMuted = false;
      var vol = volumeBeforeMute || 50;
      setVolume(vol);
    } else {
      volumeBeforeMute = getStoredVolume();
      isMuted = true;
      setVolumeInternal(0);
    }
    updateMuteIcon();
  }

  function updateMuteIcon() {
    var icon = document.getElementById('muteToggle');
    if (!icon) return;
    icon.textContent = isMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
    icon.title = isMuted ? 'Unmute' : 'Mute';
  }

  function updateNowPlayingUI() {
    var trackTitleEl = document.querySelector('.track-title');
    var trackArtistEl = document.querySelector('.track-artist');
    var progressBarEl = document.querySelector('.progress-bar');

    if (!currentTrack) return;

    if (trackTitleEl) {
      trackTitleEl.textContent = currentTrack.title || 'Unknown Track';
    }
    if (trackArtistEl) {
      trackArtistEl.textContent = currentTrack.artist || '';
    }
    if (progressBarEl && currentAudio && currentAudio.duration) {
      var pct = Math.min(100, Math.max(0, (currentAudio.currentTime / currentAudio.duration) * 100));
      progressBarEl.style.width = pct + '%';
    }
  }

  function handleSeamlessLoop() {
    if (!currentAudio || !currentTrack) return;
    var timeRemaining = currentAudio.duration - currentAudio.currentTime;
    if (timeRemaining < 3 && !nextTrackPreloaded && currentTrack) {
      preloadNextTrack();
    }
  }

  function preloadNextTrack() {
    if (nextTrackPreloaded || !currentTrack) return;
    nextTrackPreloaded = true;
    nextTrack = currentTrack; // Loop the same track
    var nextAudio = (currentAudio === audio) ? audioAlt : audio;
    nextAudio.src = currentTrack.url;
    nextAudio.load();
  }

  function handleTrackTransition() {
    if (!nextTrack || !nextTrackPreloaded) {
      // Loop the current track
      if (currentTrack && currentAudio) {
        currentAudio.currentTime = 0;
        currentAudio.play().catch(function () {});
      }
      return;
    }

    var nextAudio = (currentAudio === audio) ? audioAlt : audio;
    currentAudio = nextAudio;

    var targetVolume = isMuted ? 0 : getStoredVolume() / 100;
    var playPromise = currentAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(function () {
        if (!isMuted) {
          fadeInAudio(currentAudio, targetVolume, 1500);
        }
      }).catch(function () {
        currentTrack = null;
      });
    }

    nextTrackPreloaded = false;
    nextTrack = null;
  }

  function handleTabFocus() {
    if (!currentAudio || !currentTrack) return;
    if (currentAudio.paused && unlocked) {
      var targetVolume = isMuted ? 0 : getStoredVolume() / 100;
      var playPromise = currentAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(function () {
          if (!isMuted) {
            fadeInAudio(currentAudio, targetVolume, 1500);
          }
        }).catch(function () {});
      }
    }
  }

  // Legacy stubs (no longer used but prevent errors)
  function handleMusicState() {}
  function handleMusicSync() {}

  window.MusicPlayer = {
    init: init,
    playTrack: playTrack,
    unlockAndPlay: unlockAndPlay,
    updateNowPlayingUI: updateNowPlayingUI,
    setVolume: setVolume,
    increaseVolume: increaseVolume,
    decreaseVolume: decreaseVolume,
    toggleMute: toggleMute,
    handleMusicState: handleMusicState,
    handleMusicSync: handleMusicSync
  };
})();
