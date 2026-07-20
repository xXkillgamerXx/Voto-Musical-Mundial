/**
 * Music Mundial Voting — mission visit detector
 *
 * Install once on musicmundial.com (site-wide footer / header):
 *   <script src="https://vote.musicmundial.com/mission-visit.js" async></script>
 *
 * Supports multi-page missions: keeps the session token and reports every page view.
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

    var apiBase = (window.VMM_MISSION_API || 'https://vote.musicmundial.com/api').replace(/\/$/, '');
    var pageUrl = window.location.href.split('#')[0];

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
        params.delete('vmm');
        var clean =
          window.location.pathname +
          (params.toString() ? '?' + params.toString() : '') +
          window.location.hash;
        window.history.replaceState({}, '', clean);
      } catch (e) {}
    }
  } catch (e) {}
})();
