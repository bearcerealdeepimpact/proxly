(function () {
  'use strict';

  var widget = null;
  var widgetReady = false;
  var currentTrack = null;
  var autoplayUnlocked = false;
  var pendingPlay = false;
  var isMuted = false;
  var volumeBeforeMute = 50;
  var currentProgress = 0;
  var isPlaying = false;
  var tabFocused = true;

  function init() {
    if (widget) {
      return;
    }

    if (typeof SC === 'undefined') {
      hideNowPlaying();
      return;
    }

    var iframeEl = document.getElementById('sc-widget');
    if (!iframeEl) {
      return;
    }

    widget = SC.Widget('sc-widget');

    widget.bind(SC.Widget.Events.READY, function () {
      widgetReady = true;

      var savedVolume = localStorage.getItem('audioVolume');
      if (savedVolume !== null) {
        var vol = parseInt(savedVolume, 10);
        widget.setVolume(vol);
        var volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
          volumeSlider.value = vol;
        }
      } else {
        var volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
          widget.setVolume(parseInt(volumeSlider.value, 10));
        }
      }

      if (pendingPlay) {
        pendingPlay = false;
        widget.play();
      }
    });

    widget.bind(SC.Widget.Events.PLAY, function () {
      isPlaying = true;
    });

    widget.bind(SC.Widget.Events.PAUSE, function () {
      isPlaying = false;
    });

    widget.bind(SC.Widget.Events.FINISH, function () {
      isPlaying = false;
      currentProgress = 0;
    });

    widget.bind(SC.Widget.Events.PLAY_PROGRESS, function (data) {
      currentProgress = data.relativePosition;
      updateProgressBar(currentProgress);
    });

    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', function () {
        setVolume(parseInt(volumeSlider.value, 10));
      });
    }

    checkAutoplayUnlock();

    window.addEventListener('focus', function () {
      tabFocused = true;
    });

    window.addEventListener('blur', function () {
      tabFocused = false;
    });
  }

  function hideNowPlaying() {
    var nowPlaying = document.getElementById('nowPlaying');
    if (nowPlaying) {
      nowPlaying.style.display = 'none';
    }
  }

  function updateProgressBar(relativePosition) {
    var progressBarEl = document.querySelector('.progress-bar');
    if (progressBarEl) {
      var percentage = Math.min(100, Math.max(0, relativePosition * 100));
      progressBarEl.style.width = percentage + '%';
    }
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
        unlockAndPlay();
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

  function unlockAndPlay() {
    if (!widget) {
      init();
    }

    if (!autoplayUnlocked) {
      showAutoplayOverlay();
      return;
    }

    if (widget && widgetReady) {
      widget.play();
    } else {
      pendingPlay = true;
    }
  }

  function setVolume(value) {
    var volumeValue = Math.min(100, Math.max(0, value));

    if (widget && widgetReady) {
      widget.setVolume(volumeValue);
    }

    localStorage.setItem('audioVolume', volumeValue.toString());

    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      volumeSlider.value = volumeValue;
    }
  }

  function increaseVolume() {
    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      var currentVolume = parseInt(volumeSlider.value, 10);
      var newVolume = Math.min(100, currentVolume + 5);
      setVolume(newVolume);
    }
  }

  function decreaseVolume() {
    var volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      var currentVolume = parseInt(volumeSlider.value, 10);
      var newVolume = Math.max(0, currentVolume - 5);
      setVolume(newVolume);
    }
  }

  function toggleMute() {
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

  function getCurrentTrack() {
    return currentTrack;
  }

  function getProgress() {
    return currentProgress;
  }

  function updateNowPlayingUI() {
    updateProgressBar(currentProgress);
  }

  window.MusicPlayer = {
    init: init,
    unlockAndPlay: unlockAndPlay,
    setVolume: setVolume,
    increaseVolume: increaseVolume,
    decreaseVolume: decreaseVolume,
    toggleMute: toggleMute,
    getCurrentTrack: getCurrentTrack,
    getProgress: getProgress,
    updateNowPlayingUI: updateNowPlayingUI,
    handleMusicState: function () {},
    handleMusicSync: function () {}
  };
})();
