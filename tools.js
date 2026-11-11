/* VentroHosting tools: RAM calculator, server.properties, MOTD and color generators, whitelist generator, status check, circle/sphere
   generator, Nether calculator, server icon maker. Plain JavaScript,
   no libraries, no cookies; only the UUID lookup and the status check ask the shop's API, everything else stays in the browser. The RAM rule is the same as AdvisorService::minecraftRam (PHP). */
(function () {
  'use strict';

  var BASE = { vanilla: 1024, plugins: 1536, mods: 3072 };
  var PER = { vanilla: 60, plugins: 85, mods: 140 };
  var FACTOR = { klein: 1.0, mittel: 1.2, gross: 1.5 };

  function gb(mb) {
    var v = mb / 1024;
    return (Math.round(v * 10) / 10).toString().replace('.', ',') + ' GB';
  }

  function initRam(root) {
    var plans = [];
    try { plans = JSON.parse(root.getAttribute('data-plans') || '[]'); } catch (e) { plans = []; }
    var players = root.querySelector('#vh-players');
    var style = root.querySelector('#vh-style');
    var size = root.querySelector('#vh-size');
    var outPlayers = root.querySelector('#vh-players-out');
    var out = root.querySelector('#vh-ram-out');
    var range = root.querySelector('#vh-ram-range');
    var planOut = root.querySelector('#vh-plan-out');
    if (!players || !style || !size || !out) { return; }

    function update() {
      var n = parseInt(players.value, 10) || 1;
      var mb = Math.ceil(((BASE[style.value] + n * PER[style.value]) * FACTOR[size.value]) / 512) * 512;
      var top = Math.ceil((mb * 1.25) / 512) * 512;
      outPlayers.textContent = n;
      out.firstChild.nodeValue = gb(mb);
      range.textContent = 'Mit Reserve bis ' + gb(top);
      var fit = null;
      for (var i = 0; i < plans.length; i++) { if (plans[i].ram >= mb) { fit = plans[i]; break; } }
      if (!plans.length) { planOut.textContent = ''; return; }
      if (fit) {
        planOut.textContent = 'Passender Tarif: ' + fit.name + ' mit ' + fit.label + ' für ' + fit.price + ' € pro ' + (fit.days || 30) + ' Tage. ';
        if (fit.url) {
          var a = document.createElement('a');
          a.href = fit.url; a.textContent = fit.name + ' bestellen →'; a.className = 'vht-order';
          if (window.top !== window.self) { a.target = '_blank'; a.rel = 'noopener'; }
          planOut.appendChild(a);
        }
      } else {
        var last = plans[plans.length - 1];
        planOut.textContent = 'Dein Bedarf liegt über dem größten Tarif (' + last.name + ', ' + last.label + '). Auf der Minecraft-Seite stellst du mit dem RAM-Regler eine größere Größe ein.';
      }
    }

    [players, style, size].forEach(function (el) { el.addEventListener('input', update); el.addEventListener('change', update); });
    update();
  }

  /* server.properties: only keys that exist in all current versions; non-ASCII as \uXXXX (Java properties) */
  function esc(value) {
    var out = '';
    for (var i = 0; i < value.length; i++) {
      var c = value.charCodeAt(i);
      var ch = value.charAt(i);
      if (ch === '\\') { out += '\\\\'; }
      else if (ch === '\n' || ch === '\r') { out += ' '; }
      else if (c > 126 || c < 32) { out += '\\u' + ('0000' + c.toString(16)).slice(-4); }
      else { out += ch; }
    }
    return out;
  }

  function initProps(root) {
    var fields = [].slice.call(root.querySelectorAll('[data-prop]'));
    var area = root.querySelector('#p-out');
    var status = root.querySelector('#p-status');
    if (!area) { return; }

    function build() {
      var lines = ['#Minecraft server properties', '#Erstellt mit dem server.properties-Generator von VentroHosting'];
      fields.forEach(function (f) {
        var key = f.getAttribute('data-prop');
        var value = f.type === 'checkbox' ? (f.checked ? 'true' : 'false') : f.value;
        if (f.type === 'number') {
          var min = parseInt(f.min, 10), max = parseInt(f.max, 10), n = parseInt(value, 10);
          if (isNaN(n)) { n = parseInt(f.defaultValue, 10); }
          value = String(Math.min(isNaN(max) ? n : max, Math.max(isNaN(min) ? n : min, n)));
        }
        if (key === 'level-name' && value.trim() === '') { value = 'world'; }
        lines.push(key + '=' + esc(String(value).trim()));
        var o = root.querySelector('[data-out="' + key + '"]');
        if (o) { o.textContent = value; }
      });
      area.value = lines.join('\n') + '\n';
    }

    function say(text) { if (status) { status.textContent = text; } }

    fields.forEach(function (f) { f.addEventListener('input', build); f.addEventListener('change', build); });
    var copy = root.querySelector('[data-copy]');
    if (copy) {
      copy.addEventListener('click', function () {
        area.focus(); area.select();
        var done = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(area.value).then(function () { say('In die Zwischenablage kopiert.'); }, function () { say('Kopieren nicht möglich, markiere den Text von Hand.'); });
          return;
        }
        try { done = document.execCommand('copy'); } catch (e) { done = false; }
        say(done ? 'In die Zwischenablage kopiert.' : 'Kopieren nicht möglich, markiere den Text von Hand.');
      });
    }
    var dl = root.querySelector('[data-download]');
    if (dl) {
      dl.addEventListener('click', function () {
        var blob = new Blob([area.value], { type: 'text/plain;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'server.properties';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        say('Datei server.properties heruntergeladen.');
      });
    }
    build();
  }


  /* MOTD: "&" codes typed by the visitor become the section sign (U+00A7); line break is \n; output is a .properties line */
  var COLORS = [['0', '#000000', 'Schwarz'], ['1', '#0000AA', 'Dunkelblau'], ['2', '#00AA00', 'Dunkelgrün'], ['3', '#00AAAA', 'Dunkeltürkis'], ['4', '#AA0000', 'Dunkelrot'], ['5', '#AA00AA', 'Violett'], ['6', '#FFAA00', 'Gold'], ['7', '#AAAAAA', 'Grau'], ['8', '#555555', 'Dunkelgrau'], ['9', '#5555FF', 'Blau'], ['a', '#55FF55', 'Hellgrün'], ['b', '#55FFFF', 'Türkis'], ['c', '#FF5555', 'Hellrot'], ['d', '#FF55FF', 'Pink'], ['e', '#FFFF55', 'Gelb'], ['f', '#FFFFFF', 'Weiß']];
  var FORMATS = [['l', 'Fett'], ['o', 'Kursiv'], ['n', 'Unterstrichen'], ['m', 'Durchgestrichen'], ['k', 'Zauber-Effekt'], ['r', 'Zurücksetzen']];

  function motdProp(line1, line2) {
    // & codes, &#RRGGBB and &x&R&R… become section-sign codes (hex as §x§r§r§g§g§b§b, read by Paper since 1.16)
    function conv(t) { return esc(toLegacy(mcSegments(t), '\u00a7', false)); }
    var s = conv(line1), a = mcSegments(line1), b = mcSegments(line2);
    // the second line would inherit the last style of the first one: reset it, as the preview shows each line on its own
    var reset = a.length && JSON.stringify(a[a.length - 1].s) !== '{}' && b.length && JSON.stringify(b[0].s) === '{}' ? esc('\u00a7r') : '';
    if (line2.trim() !== '') { s += '\\n' + reset + conv(line2); }
    return 'motd=' + s;
  }

  function initMotd(root) {
    var l1 = root.querySelector('#m-l1'), l2 = root.querySelector('#m-l2');
    var prev = root.querySelector('#m-prev'), out = root.querySelector('#m-out'), status = root.querySelector('#m-status');
    var colors = root.querySelector('#m-colors'), formats = root.querySelector('#m-formats');
    if (!l1 || !l2 || !prev || !out) { return; }
    var active = l1;
    [l1, l2].forEach(function (el) { el.addEventListener('focus', function () { active = el; }); el.addEventListener('input', render); });

    function insert(code) {
      var el = active, a = el.selectionStart == null ? el.value.length : el.selectionStart, b = el.selectionEnd == null ? a : el.selectionEnd;
      el.value = el.value.slice(0, a) + '&' + code + el.value.slice(b);
      var pos = a + 2; el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
      render();
    }
    function button(parent, code, label, color) {
      var bt = document.createElement('button'); bt.type = 'button';
      bt.setAttribute('aria-label', label + ' (&' + code + ')');
      bt.title = label + ' (&' + code + ')';
      if (color) { var sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = color; bt.appendChild(sw); bt.appendChild(document.createTextNode('&' + code)); }
      else { bt.textContent = label; }
      bt.addEventListener('click', function () { insert(code); });
      parent.appendChild(bt);
    }
    COLORS.forEach(function (c) { button(colors, c[0], c[2], c[1]); });
    FORMATS.forEach(function (f) { button(formats, f[0], f[1], null); });

    function renderLine(text) {
      var div = document.createElement('div');
      renderSegments(div, mcSegments(text));
      return div;
    }
    function render() {
      prev.textContent = '';
      prev.appendChild(renderLine(l1.value));
      prev.appendChild(renderLine(l2.value));
      out.value = motdProp(l1.value, l2.value);
    }
    var copy = root.querySelector('[data-copy]');
    if (copy) {
      copy.addEventListener('click', function () {
        out.focus(); out.select();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(out.value).then(function () { status.textContent = 'In die Zwischenablage kopiert.'; }, function () { status.textContent = 'Kopieren nicht möglich, markiere den Text von Hand.'; });
          return;
        }
        var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        status.textContent = ok ? 'In die Zwischenablage kopiert.' : 'Kopieren nicht möglich, markiere den Text von Hand.';
      });
    }
    render();
  }


  /* ---- shared: copy a field to the clipboard ---- */
  function copyField(field, status) {
    field.focus(); field.select();
    function say(t) { if (status) { status.textContent = t; } }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(field.value).then(function () { say('In die Zwischenablage kopiert.'); }, function () { say('Kopieren nicht möglich, markiere den Text von Hand.'); });
      return;
    }
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    say(ok ? 'In die Zwischenablage kopiert.' : 'Kopieren nicht möglich, markiere den Text von Hand.');
  }

  /* ---- Minecraft formatted text: & or § codes, &#RRGGBB and &x&R&R&G&G&B&B (hex, since 1.16) → segments ---- */
  var NAMES = { '0': 'black', '1': 'dark_blue', '2': 'dark_green', '3': 'dark_aqua', '4': 'dark_red', '5': 'dark_purple', '6': 'gold', '7': 'gray', '8': 'dark_gray', '9': 'blue', a: 'green', b: 'aqua', c: 'red', d: 'light_purple', e: 'yellow', f: 'white' };
  function colorOf(code) { for (var j = 0; j < COLORS.length; j++) { if (COLORS[j][0] === code) { return COLORS[j][1]; } } return null; }
  function mcSegments(text) {
    var segs = [], st = {}, buf = '';
    function flush() { if (buf) { segs.push({ t: buf, s: JSON.parse(JSON.stringify(st)) }); buf = ''; } }
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if ((ch === '&' || ch === '§') && i + 1 < text.length) {
        var nx = text.charAt(i + 1), code = nx.toLowerCase(), m;
        if (nx === '#' && (m = /^#([0-9a-fA-F]{6})/.exec(text.slice(i + 1)))) { flush(); st = { hex: '#' + m[1].toUpperCase() }; i += 7; continue; }
        if (code === 'x' && (m = /^[x]((?:[&§][0-9a-fA-F]){6})/i.exec(text.slice(i + 1)))) { flush(); st = { hex: '#' + m[1].replace(/[&§]/g, '').toUpperCase() }; i += 13; continue; }
        if (colorOf(code)) { flush(); st = { code: code }; i++; continue; }
        if ('lonmk'.indexOf(code) >= 0) { flush(); st[code] = true; i++; continue; }
        if (code === 'r') { flush(); st = {}; i++; continue; }
      }
      buf += ch;
    }
    flush();
    return segs;
  }
  function segColor(s) { return s.hex || (s.code ? colorOf(s.code) : null); }
  function renderSegments(target, segs) {
    target.textContent = '';
    segs.forEach(function (seg) {
      var sp = document.createElement('span');
      sp.textContent = seg.s.k ? seg.t.replace(/[^ \n]/g, '▒') : seg.t;
      sp.style.color = segColor(seg.s) || '#FFFFFF';
      if (seg.s.l) { sp.style.fontWeight = '800'; }
      if (seg.s.o) { sp.style.fontStyle = 'italic'; }
      var deco = []; if (seg.s.n) { deco.push('underline'); } if (seg.s.m) { deco.push('line-through'); }
      if (deco.length) { sp.style.textDecoration = deco.join(' '); }
      target.appendChild(sp);
    });
  }
  /* legacy string with a marker character: & or § ; hex as &#RRGGBB (ampHex) or §x§R§R… */
  function toLegacy(segs, mark, ampHex) {
    var out = '', prev = null;
    segs.forEach(function (seg) {
      var s = seg.s, key = JSON.stringify(s);
      if (key !== prev) {
        var col = '';
        if (s.hex) { col = ampHex ? mark + s.hex : mark + 'x' + s.hex.slice(1).split('').map(function (d) { return mark + d.toLowerCase(); }).join(''); }
        else if (s.code) { col = mark + s.code; }
        else if (prev !== null) { col = mark + 'r'; }
        out += col + ['l', 'o', 'n', 'm', 'k'].filter(function (f) { return s[f]; }).map(function (f) { return mark + f; }).join('');
        prev = key;
      }
      out += seg.t;
    });
    return out;
  }
  function toMini(segs) {
    var tags = { l: 'bold', o: 'italic', n: 'underlined', m: 'strikethrough', k: 'obfuscated' };
    return segs.map(function (seg) {
      var open = [], s = seg.s;
      if (s.hex) { open.push(s.hex.toLowerCase()); } else if (s.code) { open.push(NAMES[s.code]); }
      ['l', 'o', 'n', 'm', 'k'].forEach(function (f) { if (s[f]) { open.push(tags[f]); } });
      var t = seg.t.replace(/\\/g, '\\\\').replace(/</g, '\\<');
      return open.map(function (o) { return '<' + (o.charAt(0) === '#' ? o : o) + '>'; }).join('') + t + open.slice().reverse().map(function (o) { return '</' + (o.charAt(0) === '#' ? o : o) + '>'; }).join('');
    }).join('');
  }
  function toJson(segs) {
    var parts = segs.map(function (seg) {
      var o = { text: seg.t }, s = seg.s;
      if (s.hex) { o.color = s.hex; } else if (s.code) { o.color = NAMES[s.code]; }
      if (s.l) { o.bold = true; } if (s.o) { o.italic = true; } if (s.n) { o.underlined = true; } if (s.m) { o.strikethrough = true; } if (s.k) { o.obfuscated = true; }
      return o;
    });
    return 'tellraw @a ' + JSON.stringify([''].concat(parts));
  }
  function hexOf(n) { return ('0' + Math.round(n).toString(16)).slice(-2); }
  function gradient(segs, a, b) {
    var chars = [];
    segs.forEach(function (seg) { for (var i = 0; i < seg.t.length; i++) { chars.push({ c: seg.t.charAt(i), s: seg.s }); } });
    var vis = chars.filter(function (x) { return x.c !== ' '; }).length, k = 0;
    var A = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)], B = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    var out = '', last = '';
    chars.forEach(function (x) {
      if (x.c === ' ') { out += ' '; return; }
      var f = vis > 1 ? k / (vis - 1) : 0; k++;
      var hx = ('#' + hexOf(A[0] + (B[0] - A[0]) * f) + hexOf(A[1] + (B[1] - A[1]) * f) + hexOf(A[2] + (B[2] - A[2]) * f)).toUpperCase();
      var fm = ['l', 'o', 'n', 'm', 'k'].filter(function (q) { return x.s[q]; }).map(function (q) { return '&' + q; }).join('');
      out += (hx + fm !== last ? '&' + hx + fm : '') + x.c; last = hx + fm;
    });
    return out;
  }

  function initColors(root) {
    var text = root.querySelector('#c-text'), prev = root.querySelector('#c-prev'), out = root.querySelector('#c-out'), fmt = root.querySelector('#c-format');
    var hint = root.querySelector('#c-hint'), status = root.querySelector('#c-status');
    if (!text || !prev || !out || !fmt) { return; }
    function insert(code) {
      var a = text.selectionStart == null ? text.value.length : text.selectionStart, b = text.selectionEnd == null ? a : text.selectionEnd;
      text.value = text.value.slice(0, a) + code + text.value.slice(b);
      var pos = a + code.length; text.focus(); try { text.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
      render();
    }
    function button(parent, code, label, color) {
      var bt = document.createElement('button'); bt.type = 'button';
      bt.setAttribute('aria-label', label + ' (&' + code + ')'); bt.title = label + ' (&' + code + ')';
      if (color) { var sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = color; bt.appendChild(sw); bt.appendChild(document.createTextNode('&' + code)); } else { bt.textContent = label; }
      bt.addEventListener('click', function () { insert('&' + code); });
      parent.appendChild(bt);
    }
    COLORS.forEach(function (c) { button(root.querySelector('#c-colors'), c[0], c[2], c[1]); });
    FORMATS.forEach(function (f) { button(root.querySelector('#c-formats'), f[0], f[1], null); });
    var hexIn = root.querySelector('#c-hex');
    root.querySelector('#c-hex-add').addEventListener('click', function () { insert('&' + hexIn.value.toUpperCase()); });
    root.querySelector('#c-grad').addEventListener('click', function () {
      text.value = gradient(mcSegments(text.value).map(function (s) { var c = JSON.parse(JSON.stringify(s)); delete c.s.hex; delete c.s.code; return c; }), root.querySelector('#c-g1').value, root.querySelector('#c-g2').value);
      render();
    });
    function render() {
      var segs = mcSegments(text.value), hasHex = segs.some(function (s) { return !!s.s.hex; }), f = fmt.value;
      renderSegments(prev, segs);
      if (f === 'props') { out.value = 'motd=' + esc(toLegacy(segs, '§', false)); }
      else if (f === 'amp') { out.value = toLegacy(segs, '&', true); }
      else if (f === 'section') { out.value = toLegacy(segs, '§', false); }
      else if (f === 'mini') { out.value = toMini(segs); }
      else { out.value = toJson(segs); }
      var h = '';
      if (f === 'props') { h = 'Fertige Zeile für die server.properties: ersetzt den Eintrag motd=. Das Paragraphenzeichen steht dort als \\u00a7.' + (hasHex ? ' Hexfarben in der MOTD haben wir mit Paper 1.21.11 geprüft; Spieler mit Versionen vor 1.16 sehen sie nicht.' : ''); }
      else if (f === 'amp') { h = 'Für Plugins, die &-Codes lesen.' + (hasHex ? ' Die Hex-Schreibweise &#RRGGBB verstehen nicht alle Plugins, prüfe die Anleitung des Plugins.' : ''); }
      else if (f === 'section') { h = 'Für Konfigurationen, die das Paragraphenzeichen direkt erwarten. Hexfarben stehen in der Form §x§R§R§G§G§B§B (ab 1.16).'; }
      else if (f === 'mini') { h = 'MiniMessage-Format, zum Beispiel für Paper-Plugins auf Basis von Adventure.'; }
      else { h = 'Befehl für die Konsole oder den Chat (im Chat mit / davor). Hexfarben in Text-Komponenten gibt es seit Java Edition 1.16.'; }
      hint.textContent = h;
    }
    text.addEventListener('input', render); fmt.addEventListener('change', render);
    var copy = root.querySelector('[data-copy]'); if (copy) { copy.addEventListener('click', function () { copyField(out, status); }); }
    render();
  }

  /* ---- Whitelist generator: names → UUIDs (POST /api/tools/minecraft-uuid) → whitelist.json ---- */
  function initWhitelist(root) {
    var form = root.querySelector('#w-form'), names = root.querySelector('#w-names'), rows = root.querySelector('#w-rows'), out = root.querySelector('#w-out');
    var status = root.querySelector('#w-status'), missing = root.querySelector('#w-missing'), go = root.querySelector('#w-go');
    if (!form || !names || !rows || !out) { return; }
    function cell(tr, text, code) { var td = document.createElement('td'); if (code) { var c = document.createElement('code'); c.textContent = text; td.appendChild(c); } else { td.textContent = text; } tr.appendChild(td); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var mode = (form.querySelector('input[name="w-mode"]:checked') || {}).value || 'online';
      status.textContent = mode === 'online' ? 'Frage Mojang an …' : 'Berechne Offline-UUIDs …';
      go.disabled = true; missing.hidden = true;
      fetch('https://ventrohosting.com/api/tools/minecraft-uuid', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ names: names.value, mode: mode }) })
        .then(function (r) { return r.json().catch(function () { return { ok: false, message: 'Der Server hat nicht wie erwartet geantwortet.' }; }); })
        .then(function (d) {
          go.disabled = false;
          if (!d.ok) { status.textContent = d.message || 'Das hat nicht geklappt.'; return; }
          rows.textContent = '';
          d.players.forEach(function (p) { var tr = document.createElement('tr'); cell(tr, p.name, false); cell(tr, p.uuid, true); rows.appendChild(tr); });
          if (!d.players.length) { var tr = document.createElement('tr'); var td = document.createElement('td'); td.colSpan = 2; td.className = 'vht-note'; td.textContent = 'Kein Name gefunden.'; tr.appendChild(td); rows.appendChild(tr); }
          out.value = JSON.stringify(d.players.map(function (p) { return { uuid: p.uuid, name: p.name }; }), null, 2);
          var notes = [];
          if (d.missing && d.missing.length) { notes.push('Kein Minecraft-Konto gefunden: ' + d.missing.join(', ') + '.'); }
          if (d.invalid && d.invalid.length) { notes.push('Ungültige Namen übersprungen: ' + d.invalid.join(', ') + '.'); }
          missing.textContent = notes.join(' '); missing.hidden = notes.length === 0;
          status.textContent = d.players.length + (d.players.length === 1 ? ' Spieler' : ' Spieler') + ' in der whitelist.json' + (d.mode === 'offline' ? ' (Offline-Modus).' : '.');
        }, function () { go.disabled = false; status.textContent = 'Keine Verbindung. Bitte versuche es noch einmal.'; });
    });
    var copy = root.querySelector('[data-copy]'); if (copy) { copy.addEventListener('click', function () { copyField(out, status); }); }
    var dl = root.querySelector('[data-download]');
    if (dl) {
      dl.addEventListener('click', function () {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([out.value + '\n'], { type: 'application/json' }));
        a.download = 'whitelist.json'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        status.textContent = 'Datei whitelist.json heruntergeladen.';
      });
    }
  }

  /* ---- Server status check (GET /api/tools/minecraft-status) + badge embed codes ---- */
  function initStatus(root) {
    var form = root.querySelector('#s-form'), input = root.querySelector('#s-addr'), status = root.querySelector('#s-status'), box = root.querySelector('#s-result');
    var embed = root.querySelector('#s-embed'), go = root.querySelector('#s-go');
    if (!form || !input || !box) { return; }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text != null) { e.textContent = text; } return e; }
    function kv(parent, label, value) { var d = el('div'); d.appendChild(el('b', null, label)); d.appendChild(el('span', null, value)); parent.appendChild(d); }
    function segsOf(motd) { var out = []; (motd || []).forEach(function (line, i) { if (i > 0) { out.push({ t: '\n', s: {} }); } line.forEach(function (s) { out.push({ t: s.t, s: { hex: s.c || null, l: s.b, o: s.i, n: s.u, m: s.s, k: s.o } }); }); }); return out; }
    function show(d, addr) {
      box.textContent = ''; box.hidden = false;
      var head = el('div', 'vhs-res');
      if (d.online && d.favicon && /^data:image\/png;base64,/.test(d.favicon)) { var img = el('img'); img.src = d.favicon; img.alt = 'Server-Icon von ' + d.address; img.width = 64; img.height = 64; head.appendChild(img); }
      else { var ph = el('div'); ph.setAttribute('aria-hidden', 'true'); ph.style.cssText = 'width:64px;height:64px;border-radius:6px;background:#0d0d10;border:1px solid #3a3a42'; head.appendChild(ph); }
      var right = el('div');
      var dot = el('span', 'vhs-dot ' + (d.online ? 'vhs-on' : 'vhs-off')); dot.appendChild(el('i')); dot.appendChild(document.createTextNode(d.online ? 'Online' : 'Offline'));
      right.appendChild(dot);
      right.appendChild(el('h2', null, d.address)).style.cssText = 'margin:10px 0 4px;font-size:22px;overflow-wrap:anywhere';
      if (!d.online) { right.appendChild(el('p', 'vht-note', d.message || '')); }
      head.appendChild(right); box.appendChild(head);
      var g = el('div', 'vhs-kv');
      if (d.online) {
        kv(g, 'Spieler', (d.players != null ? d.players : '–') + ' / ' + (d.max != null ? d.max : '–'));
        kv(g, 'Version', d.version || '–');
        kv(g, 'Antwortzeit', d.latencyMs + ' ms');
      }
      kv(g, 'IP und Port', (d.ip.indexOf(':') >= 0 ? '[' + d.ip + ']' : d.ip) + ':' + d.port);
      kv(g, 'SRV-Eintrag', d.srv ? 'ja' : 'nein');
      kv(g, 'Geprüft', new Date(d.checkedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + (d.cached ? ' (zwischengespeichert)' : ''));
      box.appendChild(g);
      if (d.online) { box.appendChild(el('span', 'vht-l', 'MOTD')).style.cssText = 'display:block;font-weight:700;margin:6px 0'; var pv = el('div', 'vht-prev'); renderSegments(pv, segsOf(d.motd)); box.appendChild(pv); }
      // badge + embed codes (addresses without IPv6 brackets)
      if (embed && /^[A-Za-z0-9.:\-]{3,270}$/.test(d.address)) {
        var base = 'https://ventrohosting.com', badge = base + '/badge/' + d.address + '.svg', page = base + '/tools/minecraft-server-status?adresse=' + encodeURIComponent(d.address), alt = 'Minecraft-Server ' + d.address + ': Status';
        var link = root.querySelector('#s-badge-link'), bimg = root.querySelector('#s-badge');
        link.href = page; bimg.src = badge + '?t=' + Date.now(); bimg.alt = alt;
        root.querySelector('#s-code-html').value = '<a href="' + page + '"><img src="' + badge + '" alt="' + alt.replace(/"/g, '&quot;') + '" height="20"></a>';
        root.querySelector('#s-code-md').value = '[![' + alt.replace(/[\[\]]/g, '') + '](' + badge + ')](' + page + ')';
        root.querySelector('#s-code-bb').value = '[url=' + page + '][img]' + badge + '[/img][/url]';
        embed.hidden = false;
      } else if (embed) { embed.hidden = true; }
    }
    function check(addr) {
      addr = addr.trim(); if (!addr) { status.textContent = 'Gib eine Serveradresse ein.'; input.focus(); return; }
      status.textContent = 'Prüfe ' + addr + ' …'; go.disabled = true;
      fetch('https://ventrohosting.com/api/tools/minecraft-status?adresse=' + encodeURIComponent(addr), { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { ok: false, message: 'Der Server hat nicht wie erwartet geantwortet.' }; }); })
        .then(function (d) {
          go.disabled = false;
          if (!d.ok) { status.textContent = d.message || 'Das hat nicht geklappt.'; box.hidden = true; if (embed) { embed.hidden = true; } return; }
          status.textContent = d.online ? 'Der Server ist online.' : 'Der Server ist nicht erreichbar.';
          try { history.replaceState(null, '', location.pathname + '?adresse=' + encodeURIComponent(addr)); } catch (e) { /* ignore */ }
          show(d, addr);
        }, function () { go.disabled = false; status.textContent = 'Keine Verbindung. Bitte versuche es noch einmal.'; });
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); check(input.value); });
    root.querySelectorAll('[data-copy-from]').forEach(function (b) { b.addEventListener('click', function () { copyField(root.querySelector('#' + b.getAttribute('data-copy-from')), root.querySelector('#s-copy-status')); }); });
    var q = new URLSearchParams(location.search).get('adresse');
    if (q) { input.value = q.slice(0, 270); check(input.value); }
  }


  /* Circle and sphere generator (2026-11-11): block (i, j) is inside when the distance of its centre from the shape's centre is at most
     the radius. Outline: an inside block with an outside neighbour (thin = 4 sides, the line connects diagonally; thick = 8 sides,
     the line connects at the edges). Sphere: same in 3D, one layer at a time; shell = an inside block with an outside 6-neighbour. */
  function initCircle(root) {
    var shape = root.querySelector('#c-shape'), w = root.querySelector('#c-w'), h = root.querySelector('#c-h'), fill = root.querySelector('#c-fill');
    var layer = root.querySelector('#c-layer'), layerOut = root.querySelector('#c-layer-out'), layerBox = root.querySelector('#c-layer-box'), hBox = root.querySelector('#c-h-box');
    var canvas = root.querySelector('#c-canvas'), stats = root.querySelector('#c-stats'), rows = root.querySelector('#c-rows');
    if (!shape || !w || !canvas) { return; }
    var totalCache = {};
    function num(el, min, max) { var v = parseInt(el.value, 10); if (isNaN(v)) { v = min; } return Math.max(min, Math.min(max, v)); }
    function inside2(x, y, a, b) { var dx = (x + 0.5 - a / 2) / (a / 2), dy = (y + 0.5 - b / 2) / (b / 2); return dx * dx + dy * dy <= 1; }
    function inside3(x, y, z, d) { var r = d / 2, dx = x + 0.5 - r, dy = y + 0.5 - r, dz = z + 0.5 - r; return dx * dx + dy * dy + dz * dz <= r * r; }
    function grid() {
      var sphere = shape.value !== 'kreis', mode = fill.value;
      var a = num(w, 1, sphere ? 128 : 256), b = sphere ? a : num(h, 1, 256);
      hBox.style.display = sphere ? 'none' : ''; layerBox.style.display = sphere ? '' : 'none';
      var g = [], total = 0;
      if (sphere) {
        // layer 1 = top layer; a dome (Kuppel) is the upper half of the sphere
        var half = shape.value === 'kuppel', depth = half ? Math.ceil(a / 2) : a;
        layer.min = 1; layer.max = depth;
        var L = Math.max(1, Math.min(depth, parseInt(layer.value, 10) || 1)); layer.value = L;
        var key = a + mode + half;
        if (totalCache[key] === undefined) { var t = 0; for (var zz = 0; zz < depth; zz++) { for (var yy = 0; yy < a; yy++) { for (var xx = 0; xx < a; xx++) { if (cell3(xx, yy, zz, a, mode)) { t++; } } } } totalCache[key] = t; }
        total = totalCache[key];
        for (var y = 0; y < a; y++) { var row = []; for (var x = 0; x < a; x++) { row.push(cell3(x, y, L - 1, a, mode)); } g.push(row); }
        layerOut.textContent = L + ' von ' + depth + ' (von oben gezählt)';
      } else {
        for (var y2 = 0; y2 < b; y2++) { var r2 = []; for (var x2 = 0; x2 < a; x2++) { r2.push(cell2(x2, y2, a, b, mode)); } g.push(r2); }
      }
      return { g: g, a: a, b: b, sphere: sphere, total: total };
    }
    function cell2(x, y, a, b, mode) {
      if (!inside2(x, y, a, b)) { return false; }
      if (mode === 'voll') { return true; }
      var n = mode === 'duenn' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (var i = 0; i < n.length; i++) { var nx = x + n[i][0], ny = y + n[i][1]; if (nx < 0 || ny < 0 || nx >= a || ny >= b || !inside2(nx, ny, a, b)) { return true; } }
      return false;
    }
    function cell3(x, y, z, d, mode) {
      if (!inside3(x, y, z, d)) { return false; }
      if (mode === 'voll') { return true; }
      var n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      if (mode === 'dick') { n = []; for (var i = -1; i <= 1; i++) { for (var j = -1; j <= 1; j++) { for (var k = -1; k <= 1; k++) { if (i || j || k) { n.push([i, j, k]); } } } } }
      for (var m = 0; m < n.length; m++) { var nx = x + n[m][0], ny = y + n[m][1], nz = z + n[m][2]; if (nx < 0 || ny < 0 || nz < 0 || nx >= d || ny >= d || nz >= d || !inside3(nx, ny, nz, d)) { return true; } }
      return false;
    }
    function stacks(n) { var st = Math.floor(n / 64), r = n % 64; return n + ' Blöcke' + (st ? ' (' + st + ' Stack' + (st > 1 ? 's' : '') + (r ? ' + ' + r : '') + ')' : ''); }
    function draw() {
      var r = grid(), g = r.g, a = r.a, b = r.b;
      var avail = Math.min(canvas.parentElement.clientWidth || 600, 900);
      var cs = Math.max(2, Math.floor(avail / Math.max(a, b)));
      var dpr = window.devicePixelRatio || 1;
      canvas.width = a * cs * dpr; canvas.height = b * cs * dpr; canvas.style.width = a * cs + 'px'; canvas.style.height = b * cs + 'px';
      var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, a * cs, b * cs);
      var n = 0, lines = [];
      for (var y = 0; y < b; y++) {
        var cnt = 0;
        for (var x = 0; x < a; x++) {
          if (g[y][x]) { n++; cnt++; ctx.fillStyle = ((x + y) % 2) ? '#19d3b6' : '#14b89f'; ctx.fillRect(x * cs, y * cs, cs, cs); }
        }
        lines.push(cnt);
      }
      if (cs >= 6) {
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.beginPath();
        for (var i = 0; i <= a; i++) { ctx.moveTo(i * cs + .5, 0); ctx.lineTo(i * cs + .5, b * cs); }
        for (var j = 0; j <= b; j++) { ctx.moveTo(0, j * cs + .5); ctx.lineTo(a * cs, j * cs + .5); }
        ctx.stroke();
      }
      // centre line(s): one block wide for odd sizes, between two blocks for even sizes
      ctx.strokeStyle = 'rgba(255,90,90,.85)'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(a * cs / 2, 0); ctx.lineTo(a * cs / 2, b * cs); ctx.moveTo(0, b * cs / 2); ctx.lineTo(a * cs, b * cs / 2); ctx.stroke();
      stats.textContent = (r.sphere ? 'Diese Ebene: ' + stacks(n) + '. Ganze ' + (shape.value === 'kuppel' ? 'Kuppel' : 'Kugel') + ': ' + stacks(r.total) + '.' : 'Gesamt: ' + stacks(n) + '.') + ' Größe ' + a + ' × ' + b + ' Blöcke.';
      rows.textContent = '';
      lines.forEach(function (c, i) { if (c) { var li = document.createElement('li'); li.textContent = 'Reihe ' + (i + 1) + ': ' + c + ' Blöcke'; rows.appendChild(li); } });
      canvas.setAttribute('aria-label', (r.sphere ? 'Ebene ' + layer.value + ' der ' + (shape.value === 'kuppel' ? 'Kuppel' : 'Kugel') : 'Kreis') + ' mit ' + n + ' Blöcken, Breite ' + a + ', Höhe ' + b);
    }
    [shape, w, h, fill, layer].forEach(function (el) { el.addEventListener('input', draw); el.addEventListener('change', draw); });
    window.addEventListener('resize', function () { clearTimeout(root.__t); root.__t = setTimeout(draw, 150); });
    draw();
  }

  /* Nether calculator: Overworld -> Nether = floor(X / 8), Y unchanged, floor(Z / 8); Nether -> Overworld = X * 8 (minecraft.wiki, Nether portal). */
  function initNether(root) {
    var f = {}; ['ox', 'oy', 'oz', 'nx', 'ny', 'nz'].forEach(function (k) { f[k] = root.querySelector('#n-' + k); });
    var note = root.querySelector('#n-note');
    if (!f.ox) { return; }
    var LIMIT = 29999984;
    function val(el) { var v = parseFloat(String(el.value).replace(',', '.')); return isNaN(v) ? null : Math.max(-LIMIT, Math.min(LIMIT, v)); }
    function fromOver() {
      var x = val(f.ox), y = val(f.oy), z = val(f.oz);
      f.nx.value = x === null ? '' : Math.floor(x / 8); f.nz.value = z === null ? '' : Math.floor(z / 8); f.ny.value = y === null ? '' : Math.floor(y);
      hint(y);
    }
    function fromNether() {
      var x = val(f.nx), y = val(f.ny), z = val(f.nz);
      f.ox.value = x === null ? '' : Math.floor(x) * 8; f.oz.value = z === null ? '' : Math.floor(z) * 8; f.oy.value = y === null ? '' : Math.floor(y);
      hint(y);
    }
    function hint(y) {
      if (!note) { return; }
      note.textContent = y !== null && y >= 128 ? 'Achtung: Ab Y 128 bist du im Nether über dem Grundgestein-Dach. Baue das Portal darunter.' : '';
    }
    ['ox', 'oy', 'oz'].forEach(function (k) { f[k].addEventListener('input', fromOver); });
    ['nx', 'ny', 'nz'].forEach(function (k) { f[k].addEventListener('input', fromNether); });
    var paste = root.querySelector('#n-paste');
    if (paste) {
      paste.addEventListener('input', function () {
        var m = paste.value.match(/(-?\d+(?:[.,]\d+)?)[\s,;/]+(-?\d+(?:[.,]\d+)?)[\s,;/]+(-?\d+(?:[.,]\d+)?)/);
        if (!m) { return; }
        var target = root.querySelector('input[name="n-from"]:checked');
        var pre = target && target.value === 'nether' ? 'n' : 'o';
        f[pre + 'x'].value = m[1].replace(',', '.'); f[pre + 'y'].value = m[2].replace(',', '.'); f[pre + 'z'].value = m[3].replace(',', '.');
        if (pre === 'n') { fromNether(); } else { fromOver(); }
      });
    }
    fromOver();
  }

  /* Server icon: everything stays in the browser (FileReader + canvas); the result is a 64 x 64 PNG named server-icon.png. */
  function initIcon(root) {
    var file = root.querySelector('#i-file'), zoom = root.querySelector('#i-zoom'), mx = root.querySelector('#i-x'), my = root.querySelector('#i-y');
    var smooth = root.querySelector('#i-smooth'), text = root.querySelector('#i-text'), c1 = root.querySelector('#i-c1'), c2 = root.querySelector('#i-c2');
    var big = root.querySelector('#i-big'), small = root.querySelector('#i-small'), list = root.querySelector('#i-list'), dl = root.querySelector('#i-dl');
    var status = root.querySelector('#i-status'), name = root.querySelector('#i-name');
    if (!big || !small) { return; }
    var img = null;
    function say(t) { if (status) { status.textContent = t; } }
    function paint(ctx, size) {
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = !smooth || smooth.checked; ctx.imageSmoothingQuality = 'high';
      if (img) {
        var z = parseFloat(zoom.value) || 1, side = Math.min(img.width, img.height) / z;
        var sx = (img.width - side) * (parseFloat(mx.value) / 100), sy = (img.height - side) * (parseFloat(my.value) / 100);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      } else {
        var gr = ctx.createLinearGradient(0, 0, size, size); gr.addColorStop(0, c1.value); gr.addColorStop(1, c2.value);
        ctx.fillStyle = gr; ctx.fillRect(0, 0, size, size);
        var t = (text.value || '').trim().slice(0, 3);
        if (t) {
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = '800 ' + Math.round(size * (t.length > 2 ? 0.36 : t.length > 1 ? 0.46 : 0.62)) + 'px Inter, system-ui, sans-serif';
          ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowOffsetY = size / 32; ctx.shadowBlur = size / 16;
          ctx.fillText(t, size / 2, size / 2 + size * 0.03); ctx.shadowColor = 'transparent';
        }
      }
    }
    function render() {
      // the file itself is always drawn at 64 x 64; the large preview scales that result up, so it shows what the game shows
      paint(small.getContext('2d'), 64);
      var b = big.getContext('2d'); b.imageSmoothingEnabled = false; b.clearRect(0, 0, big.width, big.height); b.drawImage(small, 0, 0, big.width, big.height);
      if (list) { var l = list.getContext('2d'); l.imageSmoothingEnabled = true; l.clearRect(0, 0, list.width, list.height); l.drawImage(small, 0, 0, list.width, list.height); }
      root.querySelectorAll('[data-i-img]').forEach(function (el) { el.disabled = !img; });
      root.querySelectorAll('[data-i-txt]').forEach(function (el) { el.disabled = !!img; });
      if (name) { root.querySelector('#i-prev-name').textContent = name.value || 'Mein Minecraft-Server'; }
    }
    if (file) {
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) { return; }
        if (!/^image\//.test(f.type)) { say('Bitte wähle ein Bild (PNG, JPG, GIF oder WebP).'); return; }
        var url = URL.createObjectURL(f), im = new Image();
        im.onload = function () { img = im; zoom.value = 1; mx.value = 50; my.value = 50; render(); say('Bild geladen. Ausschnitt mit Zoom und Position wählen.'); };
        im.onerror = function () { say('Das Bild konnte nicht gelesen werden.'); };
        im.src = url;
      });
    }
    var reset = root.querySelector('#i-reset');
    if (reset) { reset.addEventListener('click', function () { img = null; if (file) { file.value = ''; } render(); say('Bild entfernt, jetzt mit Text und Farben.'); }); }
    [zoom, mx, my, smooth, text, c1, c2, name].forEach(function (el) { if (el) { el.addEventListener('input', render); el.addEventListener('change', render); } });
    if (dl) {
      dl.addEventListener('click', function () {
        small.toBlob(function (blob) {
          if (!blob) { say('Download nicht möglich.'); return; }
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'server-icon.png';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
          say('server-icon.png (64 × 64 Pixel) gespeichert.');
        }, 'image/png');
      });
    }
    render();
  }

  function init() {
    var ram = document.querySelector('[data-vh-ram]');
    if (ram) { initRam(ram); }
    var props = document.querySelector('[data-vh-props]');
    if (props) { initProps(props); }
    var motd = document.querySelector('[data-vh-motd]');
    if (motd) { initMotd(motd); }
    var colors = document.querySelector('[data-vh-colors]');
    if (colors) { initColors(colors); }
    var wl = document.querySelector('[data-vh-whitelist]');
    if (wl) { initWhitelist(wl); }
    var st = document.querySelector('[data-vh-status]');
    if (st) { initStatus(st); }
    var circle = document.querySelector('[data-vh-circle]');
    if (circle) { initCircle(circle); }
    var nether = document.querySelector('[data-vh-nether]');
    if (nether) { initNether(nether); }
    var icon = document.querySelector('[data-vh-icon]');
    if (icon) { initIcon(icon); }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
