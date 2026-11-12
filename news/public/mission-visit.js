/**
 * Vote mission visit detector for Music Mundial.
 * Reports ?vmm= tokens to /api/missions/visit so visit_page missions can award points.
 */
(function () {
  try {
    var STORAGE_KEY = 'vmm_mission_visit_token';
    var params = new URLSearchParams(window.location.search || '');
    var tokenFromQuery = params.get('vmm');
    var token = tokenFromQuery;

    try {
      if (tokenFromQuery) {
        window.sessionStorage.setItem(STORAGE_KEY, tokenFromQuery);
      } else {
        token = window.sessionStorage.getItem(STORAGE_KEY) || '';
      }
    } catch (e) {
      token = tokenFromQuery || '';
    }

    if (!token) {
      return;
    }

    var apiBase = (window.VMM_MISSION_API || window.location.origin + '/api').replace(/\/$/, '');
    // Report path without the token query so exact-mode missions match cleanly.
    var cleanParams = new URLSearchParams(window.location.search || '');
    cleanParams.delete('vmm');
    var pageUrl =
      window.location.origin +
      window.location.pathname +
      (cleanParams.toString() ? '?' + cleanParams.toString() : '');

    var img = new Image();
    img.referrerPolicy = 'no-referrer-when-downgrade';
    img.src =
      apiBase +
      '/missions/visit?t=' +
      encodeURIComponent(token) +
      '&u=' +
      encodeURIComponent(pageUrl);

    if (tokenFromQuery) {
      try {
        window.history.replaceState(
          {},
          '',
          window.location.pathname +
            (cleanParams.toString() ? '?' + cleanParams.toString() : '') +
            window.location.hash,
        );
      } catch (e) {}
    }
  } catch (e) {}
})();
