(function () {
  'use strict';

  function postJSON(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) { return res.json(); });
  }

  function submitDemoDrop(artistName, email, demoLink, message) {
    return postJSON('/api/demo-drop', {
      artistName: artistName,
      email: email,
      demoLink: demoLink,
      message: message
    });
  }

  function submitMailingList(email) {
    return postJSON('/api/mailing-list', { email: email });
  }

  window.Network = {
    submitDemoDrop: submitDemoDrop,
    submitMailingList: submitMailingList
  };
})();
