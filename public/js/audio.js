var audio = null;
var currentTrack = null;

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
}

function playTrack(trackInfo) {
  if (!audio) {
    init();
  }

  if (!trackInfo || !trackInfo.url) {
    return;
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

export default {
  init: init,
  playTrack: playTrack,
  getCurrentTrack: getCurrentTrack,
  getAudioElement: getAudioElement
};
