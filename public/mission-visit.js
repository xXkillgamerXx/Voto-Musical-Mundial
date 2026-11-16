/**
 * Vote mission visit detector for Music Mundial.
 * With ?vmm=: lower a reading panel for 20s, then report the visit.
 */
(function () {
  try {
    var STORAGE_KEY = 'vmm_mission_visit_token';
    var PANEL_ID = 'vmm-mission-dwell';
    var DWELL_SECONDS = 20;
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

    // Only the fresh ?vmm= open starts the curtain here.
    // Later SPA navigations reuse the stored token in missionVisit.ts.
    if (!tokenFromQuery) return;
    token = tokenFromQuery;

    var apiBase = (window.VMM_MISSION_API || window.location.origin + '/api').replace(/\/$/, '');
    var cleanParams = new URLSearchParams(window.location.search || '');
    cleanParams.delete('vmm');
    var pageUrl =
      window.location.origin +
      window.location.pathname +
      (cleanParams.toString() ? '?' + cleanParams.toString() : '');

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

    var key = 't:' + token + ':' + pageUrl;
    if (window.__vmmMissionDwell && window.__vmmMissionDwell.key === key) return;
    if (window.__vmmMissionDwell && window.__vmmMissionDwell.stop) {
      try {
        window.__vmmMissionDwell.stop();
      } catch (e) {}
    }

    var spanish = (window.location.pathname === '/es' || window.location.pathname.indexOf('/es/') === 0);

    function showNotice(update) {
      if (!update || (!update.awarded && !update.isNewPage)) return;
      var path = window.location.pathname || '/';
      var lock = 'vmm_mission_notice:' + path;
      try {
        if (window.sessionStorage.getItem(lock)) return;
        window.sessionStorage.setItem(lock, '1');
      } catch (e) {
        if (document.getElementById('vmm-mission-notice')) return;
      }

      var progress = Math.max(0, Number(update.progress || 0));
      var target = Math.max(1, Number(update.target || 1));
      var done = Boolean(update.awarded) || progress >= target;
      var points = Math.max(0, Number(update.rewardPoints || 0));
      var title = done
        ? spanish
          ? 'Misión completada'
          : 'Mission completed'
        : spanish
          ? 'Misión en progreso'
          : 'Mission progress';
      var text = done
        ? spanish
          ? points > 0
            ? 'Esta nota ya cuenta. Sumaste ' + points + ' puntos.'
            : 'Esta nota ya cuenta para tu misión.'
          : points > 0
            ? 'This page counted. You earned ' + points + ' points.'
            : 'This page counted toward your mission.'
        : spanish
          ? 'Llevas ' + progress + ' de ' + target + ' páginas.'
          : progress + ' of ' + target + ' pages so far.';

      var root = document.createElement('div');
      root.id = 'vmm-mission-notice';
      root.setAttribute('role', 'status');
      root.style.cssText =
        'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100000;width:min(560px,calc(100% - 28px));display:flex;gap:14px;align-items:flex-start;padding:18px 18px 18px 16px;border-radius:22px;color:#fff;background:' +
        (done ? '#064e3b' : '#7c2d12') +
        ';border:3px solid ' +
        (done ? '#34d399' : '#fdba74') +
        ';box-shadow:0 22px 50px rgba(0,0,0,.38);font-family:DM Sans,Manrope,sans-serif';

      var mark = document.createElement('div');
      mark.textContent = done ? '✓' : String(progress);
      mark.style.cssText =
        'flex:0 0 auto;width:46px;height:46px;border-radius:16px;display:grid;place-items:center;font-weight:800;font-size:22px;background:rgba(255,255,255,.14)';

      var body = document.createElement('div');
      body.style.cssText = 'min-width:0;flex:1';
      var heading = document.createElement('p');
      heading.textContent = title;
      heading.style.cssText = 'margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em';
      var detail = document.createElement('p');
      detail.textContent = text;
      detail.style.cssText =
        'margin:4px 0 0;font-size:15px;font-weight:600;line-height:1.35;color:rgba(255,255,255,.88)';
      body.appendChild(heading);
      body.appendChild(detail);

      var close = document.createElement('button');
      close.type = 'button';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Cerrar');
      close.style.cssText =
        'border:0;background:transparent;color:#fff;font-size:28px;line-height:1;cursor:pointer;padding:0 2px';
      close.addEventListener('click', function () {
        root.remove();
      });
      window.setTimeout(function () {
        root.remove();
      }, 8000);

      root.appendChild(mark);
      root.appendChild(body);
      root.appendChild(close);
      document.body.appendChild(root);
    }

    function removePanel() {
      var el = document.getElementById(PANEL_ID);
      if (el) el.remove();
    }

    function mountPanel() {
      removePanel();
      var root = document.createElement('div');
      root.id = PANEL_ID;
      root.setAttribute('role', 'status');
      root.setAttribute('aria-live', 'polite');
      root.style.cssText =
        'position:fixed;left:50%;bottom:0;transform:translateX(-50%) translateY(110%);z-index:99999;width:min(560px,calc(100% - 20px));margin:0 0 16px;padding:16px 18px 14px;border-radius:22px 22px 18px 18px;color:#fff;background:linear-gradient(165deg,#111827 0%,#1e3a5f 55%,#0f766e 140%);border:2px solid rgba(125,211,252,.45);box-shadow:0 18px 48px rgba(0,0,0,.42);font-family:DM Sans,Manrope,sans-serif;transition:transform .45s cubic-bezier(.22,1,.36,1)';

      var title = document.createElement('p');
      title.textContent = spanish ? 'Misión: lee la nota' : 'Mission: read the article';
      title.style.cssText = 'margin:0;font-size:17px;font-weight:800;letter-spacing:-.02em';

      var detail = document.createElement('p');
      detail.setAttribute('data-role', 'detail');
      detail.textContent = spanish
        ? 'Quédate en esta página ' + DWELL_SECONDS + ' segundos para que cuente.'
        : 'Stay on this page for ' + DWELL_SECONDS + ' seconds so it counts.';
      detail.style.cssText =
        'margin:6px 0 12px;font-size:14px;font-weight:600;line-height:1.35;color:rgba(255,255,255,.86)';

      var track = document.createElement('div');
      track.style.cssText =
        'height:10px;border-radius:999px;background:rgba(255,255,255,.16);overflow:hidden';
      var fill = document.createElement('div');
      fill.setAttribute('data-role', 'fill');
      fill.style.cssText =
        'height:100%;width:0%;border-radius:inherit;background:linear-gradient(90deg,#67e8f9,#34d399);transition:width .2s linear';
      track.appendChild(fill);

      var clock = document.createElement('p');
      clock.setAttribute('data-role', 'clock');
      clock.textContent = DWELL_SECONDS + 's';
      clock.style.cssText =
        'margin:10px 0 0;font-size:13px;font-weight:800;letter-spacing:.04em;color:#a5f3fc;text-align:right';

      root.appendChild(title);
      root.appendChild(detail);
      root.appendChild(track);
      root.appendChild(clock);

      var mount = function () {
        if (!document.body) {
          window.setTimeout(mount, 20);
          return;
        }
        document.body.appendChild(root);
        window.requestAnimationFrame(function () {
          root.style.transform = 'translateX(-50%) translateY(0)';
        });
      };
      mount();
      return root;
    }

    var panel = mountPanel();
    var totalMs = DWELL_SECONDS * 1000;
    var visibleMs = 0;
    var lastTick = document.visibilityState === 'visible' ? Date.now() : 0;
    var finished = false;
    var timerId = 0;

    function stop() {
      window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', onVisibility);
      if (window.__vmmMissionDwell && window.__vmmMissionDwell.key === key) {
        window.__vmmMissionDwell = null;
      }
      removePanel();
    }

    function onVisibility() {
      var now = Date.now();
      var detail = panel.querySelector('[data-role="detail"]');
      if (document.visibilityState === 'visible') {
        lastTick = now;
        if (detail) {
          detail.textContent = spanish
            ? 'Quédate en esta página ' + DWELL_SECONDS + ' segundos para que cuente.'
            : 'Stay on this page for ' + DWELL_SECONDS + ' seconds so it counts.';
        }
      } else if (lastTick) {
        visibleMs += now - lastTick;
        lastTick = 0;
        if (detail) {
          detail.textContent = spanish
            ? 'Pausado: vuelve a esta pestaña para seguir contando.'
            : 'Paused: return to this tab to keep counting.';
        }
      }
    }

    function finish() {
      if (finished) return;
      finished = true;
      window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', onVisibility);
      var fill = panel.querySelector('[data-role="fill"]');
      var clock = panel.querySelector('[data-role="clock"]');
      var detail = panel.querySelector('[data-role="detail"]');
      if (fill) fill.style.width = '100%';
      if (clock) clock.textContent = spanish ? 'Listo' : 'Done';
      if (detail) {
        detail.textContent = spanish
          ? 'Gracias. Registrando la visita…'
          : 'Thanks. Saving your visit…';
      }

      fetch(apiBase + '/missions/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, pageUrl: pageUrl }),
        credentials: 'omit',
      })
        .then(function (response) {
          if (!response.ok) return null;
          return response.json();
        })
        .then(function (update) {
          showNotice(update);
        })
        .catch(function () {})
        .then(function () {
          window.setTimeout(function () {
            if (window.__vmmMissionDwell && window.__vmmMissionDwell.key === key) {
              window.__vmmMissionDwell = null;
            }
            removePanel();
          }, 700);
        });
    }

    document.addEventListener('visibilitychange', onVisibility);
    timerId = window.setInterval(function () {
      var now = Date.now();
      if (document.visibilityState === 'visible' && lastTick) {
        visibleMs += now - lastTick;
        lastTick = now;
      }
      var ratio = Math.min(1, visibleMs / totalMs);
      var left = Math.max(0, Math.ceil((totalMs - visibleMs) / 1000));
      var fill = panel.querySelector('[data-role="fill"]');
      var clock = panel.querySelector('[data-role="clock"]');
      if (fill) fill.style.width = Math.round(ratio * 100) + '%';
      if (clock) clock.textContent = left > 0 ? left + 's' : spanish ? 'Listo' : 'Done';
      if (visibleMs >= totalMs) finish();
    }, 200);

    window.__vmmMissionDwell = { key: key, stop: stop };
  } catch (e) {}
})();
