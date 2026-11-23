/* Carga servicios y sesiones editados desde el panel admin (/admin).
   Si la API falla, se queda el contenido escrito en el HTML. */
(function () {
  var svcList = document.getElementById('svcList');
  var expGrid = document.getElementById('expGrid');
  var travel = document.getElementById('travelNote');
  if (!svcList && !expGrid) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    var v = Number(n);
    return '$' + (v % 1 ? v.toFixed(2) : v.toLocaleString('en-US'));
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function offerOn(o) {
    return !!(o && o.active && o.price != null && (!o.until || o.until >= today()));
  }
  function safeUrl(u) {
    return /^(https?:\/\/|\/img\/)/.test(u || '') ? u : '';
  }

  function svcHTML(s, i) {
    var o = offerOn(s.offer), price;
    if (s.price == null && !o) {
      price = '<small>' + esc(s.prefix) + '</small>' + esc(s.priceNote || 'Cotización');
    } else {
      var lbl = o ? esc(s.offer.label) + (s.prefix ? ' · ' + esc(s.prefix) : '') : esc(s.prefix);
      price = '<small' + (o ? ' class="is-offer"' : '') + '>' + lbl + '</small>' +
        (o && s.price != null ? '<s>' + money(s.price) + '</s> ' : '') +
        money(o ? s.offer.price : s.price) + ' USD';
    }
    return '<div class="svc"><div class="no">' + String(i + 1).padStart(2, '0') + '</div>' +
      '<div><h3>' + esc(s.name) + '</h3><p class="d">' + esc(s.desc) + '</p></div>' +
      '<div class="pr">' + price + '</div></div>';
  }

  function expHTML(s) {
    var o = offerOn(s.offer), chip = '';
    if (s.price != null || o) {
      chip = '<span class="price">' + (o && s.price != null ? '<s>' + money(s.price) + '</s> ' : '') +
        money(o ? s.offer.price : s.price) + '</span>';
    }
    var tag = o ? '<span class="offer-tag">' + esc(s.offer.label) + (s.offer.until ? ' · hasta ' + esc(fmtDate(s.offer.until)) : '') + '</span>' : '';
    var img = safeUrl(s.image);
    var link = safeUrl(s.bookingUrl);
    return '<article class="exp">' +
      '<div class="ph">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(s.name) + '" loading="lazy">' : '') + chip + tag + '</div>' +
      '<div class="body">' +
      (s.duration ? '<div class="dur">' + esc(s.duration) + '</div>' : '') +
      '<h3>' + esc(s.name) + '</h3>' +
      (s.desc ? '<p class="desc">' + esc(s.desc) + '</p>' : '') +
      (s.features && s.features.length ? '<ul>' + s.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
      (link ? '<div class="book"><a href="' + esc(link) + '" target="_blank" rel="noopener"><span class="t">Reservar sesión</span><span class="ar">→</span></a></div>' : '') +
      '</div></article>';
  }

  function fmtDate(iso) {
    var m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var p = iso.split('-');
    return Number(p[2]) + ' ' + m[Number(p[1]) - 1];
  }

  fetch('/api/services', { headers: { Accept: 'application/json' } })
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (d) {
      if (svcList && Array.isArray(d.services)) {
        svcList.innerHTML = d.services.filter(function (s) { return s.visible !== false; }).map(svcHTML).join('');
      }
      if (expGrid && Array.isArray(d.sessions)) {
        var vis = d.sessions.filter(function (s) { return s.visible !== false; });
        expGrid.innerHTML = vis.map(expHTML).join('');
        expGrid.style.setProperty('--cols', Math.min(Math.max(vis.length, 1), 3));
      }
      if (travel && typeof d.travelNote === 'string') {
        travel.textContent = d.travelNote;
        travel.hidden = !d.travelNote;
      }
    })
    .catch(function () { /* se queda el contenido del HTML */ });
})();
