/* VentroHosting tools: RAM calculator, server.properties, MOTD and color generators, whitelist generator, status check, circle/sphere
   generator, Nether calculator, server icon maker, UUID and name checker, banner generator, command generator, enchantment calculator. Plain JavaScript,
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

  /* ---- UUID and name checker (2026-11-18): one name → account UUID (with and without dashes) and offline UUID.
     Both values come from POST /api/tools/minecraft-uuid (same endpoint and rate limits as the whitelist generator). ---- */
  function initUuid(root) {
    var form = root.querySelector('#u-form'), name = root.querySelector('#u-name'), go = root.querySelector('#u-go'), status = root.querySelector('#u-status');
    var box = root.querySelector('#u-result'), state = root.querySelector('#u-state'), dashed = root.querySelector('#u-dashed'), plain = root.querySelector('#u-plain');
    var offline = root.querySelector('#u-offline'), offFor = root.querySelector('#u-offline-for');
    if (!form || !name || !box || !dashed || !plain || !offline) { return; }
    function ask(mode, n) {
      return fetch('https://ventrohosting.com/api/tools/minecraft-uuid', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ names: n, mode: mode }) })
        .then(function (r) { return r.json().catch(function () { return { ok: false, message: 'Der Server hat nicht wie erwartet geantwortet.' }; }); });
    }
    function setCopy(field, on) { var b = root.querySelector('[data-copy-from="' + field.id + '"]'); if (b) { b.disabled = !on; } }
    function fail(text) { go.disabled = false; status.textContent = text; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = name.value.trim();
      if (!n) { status.textContent = 'Gib einen Spielernamen ein.'; name.focus(); return; }
      if (!/^[A-Za-z0-9_]{1,16}$/.test(n)) { status.textContent = 'Ein Name hat höchstens 16 Zeichen: Buchstaben, Ziffern und Unterstrich.'; name.focus(); return; }
      status.textContent = 'Frage Mojang an …'; go.disabled = true;
      ask('online', n).then(function (on) {
        var found = on.ok && on.players && on.players[0] ? on.players[0] : null;
        var shown = found ? found.name : n;
        // the offline UUID depends on the exact spelling: use the account's spelling when Mojang knows the name
        return ask('offline', shown).then(function (off) {
          if (!off.ok || !off.players || !off.players[0]) { fail(off.message || on.message || 'Das hat nicht geklappt.'); box.hidden = true; return; }
          go.disabled = false; box.hidden = false;
          state.className = 'vhu-state ' + (found ? 'vhu-yes' : 'vhu-no');
          if (found) { state.textContent = 'Konto gefunden: Der Name „' + found.name + '“ ist vergeben.'; }
          else if (on.ok) { state.textContent = 'Kein Minecraft-Konto mit dem Namen „' + n + '“ gefunden.'; }
          else { state.textContent = on.message || 'Die Abfrage bei Mojang ist gerade nicht möglich.'; }
          dashed.value = found ? found.uuid : ''; plain.value = found ? found.uuid.replace(/-/g, '') : '';
          dashed.placeholder = plain.placeholder = found ? '' : (on.ok ? 'kein Konto gefunden' : 'gerade nicht abrufbar');
          setCopy(dashed, !!found); setCopy(plain, !!found);
          offline.value = off.players[0].uuid; setCopy(offline, true);
          if (offFor) { offFor.textContent = 'für „' + off.players[0].name + '“'; }
          status.textContent = found ? 'UUID gefunden.' : (on.ok ? 'Die Offline-UUID lässt sich trotzdem berechnen.' : 'Nur die Offline-UUID ist verfügbar.');
        });
      }).catch(function () { fail('Keine Verbindung. Bitte versuche es noch einmal.'); });
    });
    root.querySelectorAll('[data-copy-from]').forEach(function (b) { b.addEventListener('click', function () { copyField(root.querySelector('#' + b.getAttribute('data-copy-from')), root.querySelector('#u-copy-status')); }); });
  }

  /* ---- Banner generator (2026-11-18): base colour + up to six pattern layers → /give command with the banner_patterns item component
     (Java Edition 1.21). The preview draws every pattern as a plain shape on a canvas; no game textures are used. Pattern IDs,
     colour IDs and the command syntax are from minecraft.wiki (Banner/Patterns, Banner) and were parsed by Paper 1.21.11 and Paper 26.3. ---- */
  var DYES = [['white', '#F9FFFE', 'Weiß'], ['light_gray', '#9D9D97', 'Hellgrau'], ['gray', '#474F52', 'Grau'], ['black', '#1D1D21', 'Schwarz'], ['brown', '#835432', 'Braun'], ['red', '#B02E26', 'Rot'], ['orange', '#F9801D', 'Orange'], ['yellow', '#FED83D', 'Gelb'], ['lime', '#80C71F', 'Hellgrün'], ['green', '#5E7C16', 'Grün'], ['cyan', '#169C9C', 'Türkis'], ['light_blue', '#3AB3DA', 'Hellblau'], ['blue', '#3C44AA', 'Blau'], ['purple', '#8932B8', 'Violett'], ['magenta', '#C74EBD', 'Magenta'], ['pink', '#F38BAA', 'Rosa']];
  var BANNER_PATTERNS = [['stripe_top', 'Streifen oben'], ['stripe_bottom', 'Streifen unten'], ['stripe_left', 'Streifen links'], ['stripe_right', 'Streifen rechts'], ['stripe_center', 'Streifen senkrecht'], ['stripe_middle', 'Streifen waagerecht'], ['stripe_downright', 'Schrägstreifen'], ['stripe_downleft', 'Schrägstreifen gespiegelt'], ['small_stripes', 'Schmale Streifen'], ['straight_cross', 'Kreuz'], ['cross', 'Diagonalkreuz'], ['half_horizontal', 'Obere Hälfte'], ['half_horizontal_bottom', 'Untere Hälfte'], ['half_vertical', 'Linke Hälfte'], ['half_vertical_right', 'Rechte Hälfte'], ['diagonal_left', 'Diagonal oben links'], ['diagonal_right', 'Diagonal oben rechts'], ['diagonal_up_left', 'Diagonal unten links'], ['diagonal_up_right', 'Diagonal unten rechts'], ['square_top_left', 'Ecke oben links'], ['square_top_right', 'Ecke oben rechts'], ['square_bottom_left', 'Ecke unten links'], ['square_bottom_right', 'Ecke unten rechts'], ['triangle_top', 'Dreieck oben'], ['triangle_bottom', 'Dreieck unten'], ['triangles_top', 'Zacken oben'], ['triangles_bottom', 'Zacken unten'], ['circle', 'Kreis'], ['rhombus', 'Raute'], ['border', 'Rand'], ['gradient', 'Farbverlauf von oben'], ['gradient_up', 'Farbverlauf von unten']];
  var BANNER_MAX = 6, CHAT_MAX = 256;
  function dyeOf(id) { for (var j = 0; j < DYES.length; j++) { if (DYES[j][0] === id) { return DYES[j]; } } return DYES[0]; }
  function patternName(id) { for (var j = 0; j < BANNER_PATTERNS.length; j++) { if (BANNER_PATTERNS[j][0] === id) { return BANNER_PATTERNS[j][1]; } } return id; }
  /* one pattern as a shape; coordinates are fractions of the banner face (x to the right, y down) */
  function bannerShape(ctx, id, hex, w, h) {
    ctx.fillStyle = hex;
    function r(x, y, a, b) { ctx.fillRect(x * w, y * h, a * w, b * h); }
    function p(pts) { ctx.beginPath(); pts.forEach(function (q, i) { if (i) { ctx.lineTo(q[0] * w, q[1] * h); } else { ctx.moveTo(q[0] * w, q[1] * h); } }); ctx.closePath(); ctx.fill(); }
    function flip(pts) { return pts.map(function (q) { return [q[0], 1 - q[1]]; }); }
    var sq = 0.45 * w / h, t = 0.1, g, teeth = [[0, 1], [0, 0.93], [1 / 6, 0.86], [2 / 6, 0.93], [3 / 6, 0.86], [4 / 6, 0.93], [5 / 6, 0.86], [1, 0.93], [1, 1]];
    var down = [[0, 0], [0.2, 0], [1, 0.9], [1, 1], [0.8, 1], [0, 0.1]], up = [[1, 0], [0.8, 0], [0, 0.9], [0, 1], [0.2, 1], [1, 0.1]];
    switch (id) {
      case 'stripe_top': r(0, 0, 1, 1 / 3); break;
      case 'stripe_bottom': r(0, 2 / 3, 1, 1 / 3); break;
      case 'stripe_left': r(0, 0, 1 / 3, 1); break;
      case 'stripe_right': r(2 / 3, 0, 1 / 3, 1); break;
      case 'stripe_center': r(0.4, 0, 0.2, 1); break;
      case 'stripe_middle': r(0, 0.45, 1, 0.1); break;
      case 'stripe_downright': p(down); break;
      case 'stripe_downleft': p(up); break;
      case 'small_stripes': [0.075, 0.325, 0.575, 0.825].forEach(function (x) { r(x, 0, 0.1, 1); }); break;
      case 'straight_cross': r(0.4, 0, 0.2, 1); r(0, 0.45, 1, 0.1); break;
      case 'cross': p(down); p(up); break;
      case 'half_horizontal': r(0, 0, 1, 0.5); break;
      case 'half_horizontal_bottom': r(0, 0.5, 1, 0.5); break;
      case 'half_vertical': r(0, 0, 0.5, 1); break;
      case 'half_vertical_right': r(0.5, 0, 0.5, 1); break;
      case 'diagonal_left': p([[0, 0], [1, 0], [0, 1]]); break;
      case 'diagonal_right': p([[0, 0], [1, 0], [1, 1]]); break;
      case 'diagonal_up_left': p([[0, 0], [0, 1], [1, 1]]); break;
      case 'diagonal_up_right': p([[1, 0], [1, 1], [0, 1]]); break;
      case 'square_top_left': r(0, 0, 0.45, sq); break;
      case 'square_top_right': r(0.55, 0, 0.45, sq); break;
      case 'square_bottom_left': r(0, 1 - sq, 0.45, sq); break;
      case 'square_bottom_right': r(0.55, 1 - sq, 0.45, sq); break;
      case 'triangle_top': p([[0, 0], [1, 0], [0.5, 0.45]]); break;
      case 'triangle_bottom': p([[0, 1], [1, 1], [0.5, 0.55]]); break;
      case 'triangles_top': p(flip(teeth)); break;
      case 'triangles_bottom': p(teeth); break;
      case 'circle': ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.22, 0, Math.PI * 2); ctx.fill(); break;
      case 'rhombus': p([[0.5, 0.31], [0.76, 0.5], [0.5, 0.69], [0.24, 0.5]]); break;
      case 'border': ctx.fillRect(0, 0, w, t * w); ctx.fillRect(0, h - t * w, w, t * w); ctx.fillRect(0, 0, t * w, h); ctx.fillRect(w - t * w, 0, t * w, h); break;
      case 'gradient': case 'gradient_up':
        g = ctx.createLinearGradient(0, id === 'gradient' ? 0 : h, 0, id === 'gradient' ? h : 0);
        g.addColorStop(0, hex); g.addColorStop(1, hex + '00'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); break;
      default: break;
    }
  }
  function bannerPaint(canvas, base, layers) {
    var ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = dyeOf(base)[1]; ctx.fillRect(0, 0, w, h);
    layers.forEach(function (l) { bannerShape(ctx, l.pattern, dyeOf(l.color)[1], w, h); });
  }
  /* item with components as the game's item argument reads it, e.g. white_banner[banner_patterns=[{pattern:stripe_top,color:red}]] */
  function bannerItem(base, layers, shield) {
    var list = layers.map(function (l) { return '{pattern:' + l.pattern + ',color:' + l.color + '}'; }).join(',');
    if (shield) { return 'shield[base_color=' + base + (list ? ',banner_patterns=[' + list + ']' : '') + ']'; }
    return base + '_banner' + (list ? '[banner_patterns=[' + list + ']]' : '');
  }
  function initBanner(root) {
    var baseSel = root.querySelector('#b-base'), colorSel = root.querySelector('#b-color'), pats = root.querySelector('#b-patterns'), list = root.querySelector('#b-layers');
    var canvas = root.querySelector('#b-canvas'), out = root.querySelector('#b-out'), shield = root.querySelector('#b-shield'), target = root.querySelector('#b-target');
    var len = root.querySelector('#b-len'), status = root.querySelector('#b-status'), clear = root.querySelector('#b-clear');
    if (!baseSel || !colorSel || !pats || !list || !canvas || !out) { return; }
    var layers = [{ pattern: 'triangle_bottom', color: 'yellow' }, { pattern: 'border', color: 'white' }];
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text != null) { e.textContent = text; } return e; }
    function fillColors(sel, value) { DYES.forEach(function (d) { var o = el('option', null, d[2]); o.value = d[0]; sel.appendChild(o); }); sel.value = value; }
    function say(t) { if (status) { status.textContent = t; } }
    function mini(pattern, color) { var c = el('canvas'); c.width = 48; c.height = 96; c.setAttribute('aria-hidden', 'true'); bannerPaint(c, baseSel.value, [{ pattern: pattern, color: color }]); return c; }
    fillColors(baseSel, 'blue'); fillColors(colorSel, 'white');
    BANNER_PATTERNS.forEach(function (bp) {
      var li = el('li'), b = el('button', 'vhb-pat');
      b.type = 'button'; b.setAttribute('data-pattern', bp[0]); b.setAttribute('aria-label', bp[1] + ' hinzufügen');
      b.appendChild(el('canvas')); b.appendChild(el('span', null, bp[1]));
      b.addEventListener('click', function () {
        if (layers.length >= BANNER_MAX) { say('Mehr als ' + BANNER_MAX + ' Ebenen sind am Webstuhl nicht möglich. Entferne zuerst eine Ebene.'); return; }
        layers.push({ pattern: bp[0], color: colorSel.value }); render();
        say('Ebene ' + layers.length + ' hinzugefügt: ' + bp[1] + ', ' + dyeOf(colorSel.value)[2] + '.');
      });
      li.appendChild(b); pats.appendChild(li);
    });
    function paintButtons() {
      // a white pattern on a white banner would be invisible: the thumbnails then use a contrasting colour
      var c = colorSel.value === baseSel.value ? (baseSel.value === 'black' ? 'white' : 'black') : colorSel.value;
      pats.querySelectorAll('button').forEach(function (b) { var cv = b.querySelector('canvas'); cv.width = 48; cv.height = 96; cv.setAttribute('aria-hidden', 'true'); bannerPaint(cv, baseSel.value, [{ pattern: b.getAttribute('data-pattern'), color: c }]); });
    }
    function ico(label, text, act, i, off) { var b = el('button', 'vhb-ico', text); b.type = 'button'; b.setAttribute('aria-label', label); b.setAttribute('data-act', act); b.setAttribute('data-i', i); b.disabled = !!off; return b; }
    function renderLayers(focusAct, focusI) {
      list.textContent = '';
      if (!layers.length) { list.appendChild(el('li', 'vht-note', 'Noch keine Ebene. Wähle links ein Muster.')); }
      layers.forEach(function (l, i) {
        var li = el('li', 'vhb-layer'), txt = el('div'), ctl = el('div', 'vhb-ctl'), sel = el('select');
        li.appendChild(mini(l.pattern, l.color));
        txt.appendChild(el('b', null, (i + 1) + '. ' + patternName(l.pattern))); txt.appendChild(el('code', null, l.pattern)); li.appendChild(txt);
        sel.setAttribute('aria-label', 'Farbe von Ebene ' + (i + 1)); fillColors(sel, l.color);
        sel.addEventListener('change', function () { layers[i].color = sel.value; render('color', i); });
        sel.setAttribute('data-act', 'color'); sel.setAttribute('data-i', i);
        ctl.appendChild(sel);
        ctl.appendChild(ico('Ebene ' + (i + 1) + ' in der Liste nach oben', '↑', 'up', i, i === 0));
        ctl.appendChild(ico('Ebene ' + (i + 1) + ' in der Liste nach unten', '↓', 'down', i, i === layers.length - 1));
        ctl.appendChild(ico('Ebene ' + (i + 1) + ' löschen', '✕', 'del', i, false));
        li.appendChild(ctl); list.appendChild(li);
      });
      if (focusAct != null) {
        var f = list.querySelector('[data-act="' + focusAct + '"][data-i="' + focusI + '"]');
        if (f && f.disabled) { f = list.querySelector('[data-act="' + (focusAct === 'up' ? 'down' : 'up') + '"][data-i="' + focusI + '"]'); }
        if (f && !f.disabled) { f.focus(); } else if (!layers.length) { var first = pats.querySelector('button'); if (first) { first.focus(); } }
      }
    }
    list.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-act]') : null;
      if (!b || b.disabled) { return; }
      var i = parseInt(b.getAttribute('data-i'), 10), act = b.getAttribute('data-act'), moved;
      if (act === 'del') { moved = layers.splice(i, 1)[0]; render('del', Math.min(i, layers.length - 1)); say('Ebene entfernt: ' + patternName(moved.pattern) + '.'); return; }
      var j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= layers.length) { return; }
      moved = layers[i]; layers[i] = layers[j]; layers[j] = moved; render(act, j);
      say(patternName(moved.pattern) + ' ist jetzt Ebene ' + (j + 1) + '.');
    });
    function targetOf() { var t = target ? target.value.trim() : '@p'; return /^(@[pasr]|[A-Za-z0-9_]{1,16})$/.test(t) ? t : null; }
    function render(focusAct, focusI) {
      bannerPaint(canvas, baseSel.value, layers);
      canvas.setAttribute('aria-label', 'Vorschau: Banner in ' + dyeOf(baseSel.value)[2] + ' mit ' + layers.length + (layers.length === 1 ? ' Ebene' : ' Ebenen'));
      paintButtons(); renderLayers(focusAct, focusI);
      var t = targetOf();
      if (!t) { out.value = ''; if (shield) { shield.value = ''; } if (len) { len.className = 'vhb-len vhb-long'; len.textContent = 'Empfänger: @p, @s, @a, @r oder ein Spielername (Buchstaben, Ziffern, Unterstrich).'; } return; }
      out.value = '/give ' + t + ' ' + bannerItem(baseSel.value, layers, false);
      if (shield) { shield.value = '/give ' + t + ' ' + bannerItem(baseSel.value, layers, true); }
      if (len) {
        var long = out.value.length > CHAT_MAX;
        len.className = 'vhb-len' + (long ? ' vhb-long' : '');
        len.textContent = out.value.length + ' Zeichen. ' + (long ? 'Zu lang für die Chat-Zeile (' + CHAT_MAX + ' Zeichen): nutze einen Befehlsblock oder die Serverkonsole.' : 'Passt in die Chat-Zeile.');
      }
    }
    baseSel.addEventListener('change', function () { render(); });
    colorSel.addEventListener('change', paintButtons);
    if (target) { target.addEventListener('input', function () { render(); }); }
    if (clear) { clear.addEventListener('click', function () { layers = []; render(); say('Alle Ebenen entfernt.'); }); }
    root.querySelectorAll('[data-copy-from]').forEach(function (b) { b.addEventListener('click', function () { var f = root.querySelector('#' + b.getAttribute('data-copy-from')); if (!f.value) { say('Trage zuerst einen gültigen Empfänger ein.'); return; } copyField(f, status); }); });
    render();
  }

  /* ---- Command generator and enchantment calculator (2026-11-19). Java Edition with item components (text components as SNBT, 1.21.5+).
     IDs and syntax: minecraft.wiki (Commands/give, /tellraw, /summon, Data component format, Text component format, Entity format,
     Enchantment, Anvil mechanics); German names: de.minecraft.wiki. Every enchantment, creature and option was parsed by Paper 1.21.11
     and Paper 26.3 on 2026-11-19 with the functions below (website-v2/tools/qa-tools.mjs holds the browser checks). ---- */
  /* id: [German name, max level, anvil multiplier from book, from item, incompatible with] (Anvil mechanics, Enchantment) */
  var ENCH = {
    protection: ['Schutz', 4, 1, 1, ['fire_protection', 'blast_protection', 'projectile_protection']],
    fire_protection: ['Feuerschutz', 4, 1, 2, ['protection', 'blast_protection', 'projectile_protection']],
    blast_protection: ['Explosionsschutz', 4, 2, 4, ['protection', 'fire_protection', 'projectile_protection']],
    projectile_protection: ['Schussschutz', 4, 1, 2, ['protection', 'fire_protection', 'blast_protection']],
    feather_falling: ['Federfall', 4, 1, 2, []],
    thorns: ['Dornen', 3, 4, 8, []],
    respiration: ['Atmung', 3, 2, 4, []],
    aqua_affinity: ['Wasseraffinität', 1, 2, 4, []],
    depth_strider: ['Wasserläufer', 3, 2, 4, ['frost_walker']],
    frost_walker: ['Eisläufer', 2, 2, 4, ['depth_strider']],
    soul_speed: ['Seelenläufer', 3, 4, 8, []],
    swift_sneak: ['Huschen', 3, 4, 8, []],
    sharpness: ['Schärfe', 5, 1, 1, ['smite', 'bane_of_arthropods', 'breach', 'density']],
    smite: ['Bann', 5, 1, 2, ['sharpness', 'bane_of_arthropods', 'breach', 'density']],
    bane_of_arthropods: ['Nemesis der Gliederfüßer', 5, 1, 2, ['sharpness', 'smite', 'breach', 'density']],
    knockback: ['Rückstoß', 2, 1, 2, []],
    fire_aspect: ['Verbrennung', 2, 2, 4, []],
    looting: ['Plünderung', 3, 2, 4, []],
    sweeping_edge: ['Schwungkraft', 3, 2, 4, []],
    lunge: ['Ausfallschritt', 3, 1, 2, []],
    density: ['Dichte', 5, 1, 2, ['breach', 'sharpness', 'smite', 'bane_of_arthropods']],
    breach: ['Durchbruch', 4, 2, 4, ['density', 'sharpness', 'smite', 'bane_of_arthropods']],
    wind_burst: ['Windstoß', 3, 2, 4, []],
    efficiency: ['Effizienz', 5, 1, 1, []],
    silk_touch: ['Behutsamkeit', 1, 4, 8, ['fortune']],
    fortune: ['Glück', 3, 2, 4, ['silk_touch']],
    power: ['Stärke', 5, 1, 1, []],
    punch: ['Schlag', 2, 2, 4, []],
    flame: ['Flamme', 1, 2, 4, []],
    infinity: ['Unendlichkeit', 1, 4, 8, ['mending']],
    luck_of_the_sea: ['Glück des Meeres', 3, 2, 4, []],
    lure: ['Köder', 3, 2, 4, []],
    impaling: ['Harpune', 5, 2, 4, []],
    riptide: ['Sog', 3, 2, 4, ['loyalty', 'channeling']],
    loyalty: ['Treue', 3, 1, 1, ['riptide']],
    channeling: ['Entladung', 1, 4, 8, ['riptide']],
    multishot: ['Mehrfachschuss', 1, 2, 4, ['piercing']],
    piercing: ['Durchschuss', 4, 1, 1, ['multishot']],
    quick_charge: ['Schnellladen', 3, 1, 2, []],
    unbreaking: ['Haltbarkeit', 3, 1, 2, []],
    mending: ['Reparatur', 1, 2, 4, ['infinity']],
    binding_curse: ['Fluch der Bindung', 1, 4, 8, []],
    vanishing_curse: ['Fluch des Verschwindens', 1, 4, 8, []]
  };
  var TIERS = [['wooden', 'Holz'], ['stone', 'Stein'], ['copper', 'Kupfer'], ['golden', 'Gold'], ['iron', 'Eisen'], ['diamond', 'Diamant'], ['netherite', 'Netherit']];
  var ARMOR_TIERS = [['leather', 'Leder'], ['chainmail', 'Kette'], ['copper', 'Kupfer'], ['golden', 'Gold'], ['iron', 'Eisen'], ['diamond', 'Diamant'], ['netherite', 'Netherit']];
  var ARMOR_ALL = ['protection', 'fire_protection', 'blast_protection', 'projectile_protection', 'thorns', 'unbreaking', 'mending', 'binding_curse', 'vanishing_curse'];
  var MELEE = ['sharpness', 'smite', 'bane_of_arthropods', 'knockback', 'fire_aspect', 'looting'];
  var DIG = ['efficiency', 'fortune', 'silk_touch', 'unbreaking', 'mending', 'vanishing_curse'];
  var PLAIN = ['unbreaking', 'mending', 'vanishing_curse'];
  /* type: [German name, item suffix or full ID, materials or null, enchantments] (Enchantment: "Summary of enchantments by item", Java Edition) */
  var ENCH_ITEMS = [
    ['sword', 'Schwert', 'sword', TIERS, MELEE.concat(['sweeping_edge'], PLAIN)],
    ['axe', 'Axt', 'axe', TIERS, ['sharpness', 'smite', 'bane_of_arthropods'].concat(DIG)],
    ['pickaxe', 'Spitzhacke', 'pickaxe', TIERS, DIG],
    ['shovel', 'Schaufel', 'shovel', TIERS, DIG],
    ['hoe', 'Hacke', 'hoe', TIERS, DIG],
    ['spear', 'Speer', 'spear', TIERS, MELEE.concat(['lunge'], PLAIN)],
    ['mace', 'Streitkolben', 'mace', null, ['density', 'breach', 'smite', 'bane_of_arthropods', 'fire_aspect', 'wind_burst'].concat(PLAIN)],
    ['bow', 'Bogen', 'bow', null, ['power', 'punch', 'flame', 'infinity', 'unbreaking', 'mending', 'vanishing_curse']],
    ['crossbow', 'Armbrust', 'crossbow', null, ['quick_charge', 'multishot', 'piercing'].concat(PLAIN)],
    ['trident', 'Dreizack', 'trident', null, ['impaling', 'loyalty', 'channeling', 'riptide'].concat(PLAIN)],
    ['helmet', 'Helm', 'helmet', ARMOR_TIERS, ['respiration', 'aqua_affinity'].concat(ARMOR_ALL)],
    ['chestplate', 'Brustpanzer', 'chestplate', ARMOR_TIERS, ARMOR_ALL],
    ['leggings', 'Beinschutz', 'leggings', ARMOR_TIERS, ['swift_sneak'].concat(ARMOR_ALL)],
    ['boots', 'Stiefel', 'boots', ARMOR_TIERS, ['feather_falling', 'depth_strider', 'frost_walker', 'soul_speed'].concat(ARMOR_ALL)],
    ['turtle_helmet', 'Schildkrötenpanzer', 'turtle_helmet', null, ['respiration', 'aqua_affinity'].concat(ARMOR_ALL)],
    ['elytra', 'Elytren', 'elytra', null, ['unbreaking', 'mending', 'binding_curse', 'vanishing_curse']],
    ['shield', 'Schild', 'shield', null, PLAIN],
    ['fishing_rod', 'Angel', 'fishing_rod', null, ['luck_of_the_sea', 'lure'].concat(PLAIN)],
    ['shears', 'Schere', 'shears', null, ['efficiency'].concat(PLAIN)],
    ['flint_and_steel', 'Feuerzeug', 'flint_and_steel', null, PLAIN],
    ['brush', 'Pinsel', 'brush', null, PLAIN]
  ];
  /* suggestions for the item field of /give (IDs from minecraft.wiki, Java Edition data values; each one parsed by Paper 1.21.11 and 26.3); any other ID can be typed */
  var GIVE_ITEMS = ['diamond_sword', 'netherite_sword', 'diamond_pickaxe', 'netherite_pickaxe', 'diamond_axe', 'diamond_shovel', 'diamond_hoe', 'bow', 'crossbow', 'trident', 'mace', 'shield', 'elytra', 'fishing_rod', 'shears', 'flint_and_steel', 'diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots', 'netherite_helmet', 'netherite_chestplate', 'netherite_leggings', 'netherite_boots', 'turtle_helmet', 'golden_apple', 'enchanted_golden_apple', 'totem_of_undying', 'ender_pearl', 'ender_eye', 'diamond', 'emerald', 'netherite_ingot', 'iron_ingot', 'gold_ingot', 'stick', 'apple', 'bread', 'cooked_beef', 'golden_carrot', 'arrow', 'spectral_arrow', 'firework_rocket', 'name_tag', 'saddle', 'lead', 'bucket', 'water_bucket', 'lava_bucket', 'milk_bucket', 'experience_bottle', 'enchanted_book', 'book', 'writable_book', 'compass', 'clock', 'spyglass', 'bone', 'blaze_rod', 'nether_star', 'wind_charge', 'potion', 'snowball', 'egg'];
  var ANVIL_LIMIT = 39, ENCH_LEVEL_MAX = 255;
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  function enchType(type) { for (var j = 0; j < ENCH_ITEMS.length; j++) { if (ENCH_ITEMS[j][0] === type) { return ENCH_ITEMS[j]; } } return null; }
  function enchItemId(type, tier) { var t = enchType(type); if (!t) { return null; } if (!t[3]) { return t[2]; } for (var j = 0; j < t[3].length; j++) { if (t[3][j][0] === tier) { return tier + '_' + t[2]; } } return null; }
  function enchConflict(a, b) { return a !== b && ENCH[a] && ENCH[a][4].indexOf(b) >= 0; }
  function enchLabel(id, level) { return ENCH[id][0] + (ENCH[id][1] > 1 ? ' ' + (ROMAN[level] || level) : ''); }
  function anvilPenalty(work) { return Math.pow(2, work) - 1; }
  /* Enchantment part of one anvil operation, Java Edition (Anvil mechanics, "Costs for combining enchantments"). target/sacrifice:
     {id: level}; sacBook: the sacrifice is a book; type: item type of the target, null when the target is a book. */
  function anvilEnchCost(target, sacrifice, sacBook, type) {
    var out = {}, cost = 0, allowed = type ? enchType(type)[4] : null, k;
    for (k in target) { if (Object.prototype.hasOwnProperty.call(target, k)) { out[k] = target[k]; } }
    Object.keys(sacrifice).forEach(function (id) {
      if (!ENCH[id] || (allowed && allowed.indexOf(id) < 0)) { return; }
      var bad = 0; Object.keys(out).forEach(function (t) { if (enchConflict(id, t)) { bad++; } });
      if (bad) { cost += bad; return; }
      var a = out[id] || 0, b = sacrifice[id], level = a === b ? Math.min(a + 1, Math.max(a, ENCH[id][1])) : Math.max(a, b);
      out[id] = level; cost += level * ENCH[id][sacBook ? 2 : 3];
    });
    return { cost: cost, ench: out };
  }
  /* Whole operation: enchantment cost plus the prior work penalties of both items; the result carries max(work) + 1. */
  function anvilCost(target, sacrifice) {
    var e = anvilEnchCost(target.ench, sacrifice.ench, !!sacrifice.book, target.book ? null : target.type);
    return { cost: e.cost + anvilPenalty(target.work || 0) + anvilPenalty(sacrifice.work || 0), ench: e.ench, work: Math.max(target.work || 0, sacrifice.work || 0) + 1 };
  }
  /* Cheapest way to put one book per enchantment on a new item: every way of pairing books first is tried (subsets), state = (set of
     enchantments, number of earlier anvil uses). list: [[id, level], …]; limit: highest allowed cost of one step (39 in Survival) or 0. */
  function anvilPlan(type, list, limit) {
    var n = list.length, full = (1 << n) - 1, books = [], items = [], m, sub;
    if (!n || n > 12) { return null; }
    function enchOf(mask) { var o = {}; list.forEach(function (e, i) { if (mask & (1 << i)) { o[e[0]] = e[1]; } }); return o; }
    function put(table, mask, work, cost, from) { var row = table[mask] || (table[mask] = {}); if (!row[work] || cost < row[work].cost) { row[work] = { cost: cost, from: from }; } }
    function join(table, mask, left, leftMask, right, base) {
      Object.keys(left).forEach(function (wl) {
        Object.keys(right).forEach(function (wr) {
          var step = base + anvilPenalty(+wl) + anvilPenalty(+wr);
          if (limit && step > limit) { return; }
          put(table, mask, Math.max(+wl, +wr) + 1, left[wl].cost + right[wr].cost + step, { l: leftMask, wl: +wl, r: mask ^ leftMask, wr: +wr, step: step });
        });
      });
    }
    for (m = 1; m <= full; m++) {
      if (!(m & (m - 1))) { put(books, m, 0, 0, null); continue; }
      for (sub = (m - 1) & m; sub > 0; sub = (sub - 1) & m) {
        if (books[sub] && books[m ^ sub]) { join(books, m, books[sub], sub, books[m ^ sub], anvilEnchCost(enchOf(sub), enchOf(m ^ sub), true, null).cost); }
      }
    }
    put(items, 0, 0, 0, null);
    for (m = 1; m <= full; m++) {
      for (sub = m; sub > 0; sub = (sub - 1) & m) {
        if (items[m ^ sub] && books[sub]) { join(items, m, items[m ^ sub], m ^ sub, books[sub], anvilEnchCost(enchOf(m ^ sub), enchOf(sub), true, type).cost); }
      }
    }
    if (!items[full]) { return null; }
    var best = null; Object.keys(items[full]).forEach(function (w) { if (!best || items[full][w].cost < items[full][best].cost) { best = w; } });
    var steps = [];
    function names(mask) { return list.filter(function (e, i) { return mask & (1 << i); }); }
    function walk(table, mask, work, isItem) {
      var f = table[mask][work].from;
      if (!f) { return; }
      walk(table, f.l, f.wl, isItem); walk(books, f.r, f.wr, false);
      steps.push({ item: isItem, left: names(f.l), right: names(f.r), cost: f.step, leftWork: f.wl, rightWork: f.wr });
    }
    walk(items, full, best, true);
    return { steps: steps, total: items[full][best].cost, work: +best };
  }

  /* SNBT string: control characters and § (not allowed in chat) are dropped, backslash and quote escaped */
  function mcClean(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f\u00a7]/g, ''); }
  function mcStr(s) { return '"' + mcClean(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
  var TEXT_COLORS = COLORS.map(function (c) { return [NAMES[c[0]], c[1], c[2]]; });
  function mcColor(c) { c = String(c || ''); if (/^#[0-9a-fA-F]{6}$/.test(c)) { return c.toLowerCase(); } for (var j = 0; j < TEXT_COLORS.length; j++) { if (TEXT_COLORS[j][0] === c) { return c; } } return ''; }
  var TEXT_STYLES = [['bold', 'fett'], ['italic', 'kursiv'], ['underlined', 'unterstrichen'], ['strikethrough', 'durchgestrichen'], ['obfuscated', 'verschleiert']];
  /* click actions offered: [id, field that carries the value, German label] (Text component format, "Click events") */
  var CLICK_ACTIONS = [['open_url', 'url', 'Link öffnen'], ['run_command', 'command', 'Befehl ausführen'], ['suggest_command', 'command', 'Befehl in den Chat schreiben'], ['copy_to_clipboard', 'value', 'Text in die Zwischenablage kopieren']];
  /* one text component as SNBT compound; italic === false is written out (custom names and lore are italic by default) */
  function mcText(o) {
    var s = '{text:' + mcStr(o.text), c = mcColor(o.color);
    if (c) { s += ',color:"' + c + '"'; }
    TEXT_STYLES.forEach(function (st) { if (o[st[0]] === true) { s += ',' + st[0] + ':true'; } else if (st[0] === 'italic' && o.italic === false) { s += ',italic:false'; } });
    if (o.click && o.click.action) {
      CLICK_ACTIONS.forEach(function (a) { if (a[0] === o.click.action) { s += ',click_event:{action:"' + a[0] + '",' + a[1] + ':' + mcStr(o.click.value) + '}'; } });
    }
    if (o.hover) { s += ',hover_event:{action:"show_text",value:' + mcStr(o.hover) + '}'; }
    return s + '}';
  }
  function mcTarget(t) { t = String(t == null ? '' : t).trim(); return /^(@[pasr]|[A-Za-z0-9_]{1,16})$/.test(t) ? t : null; }
  var ERR_TARGET = 'Empfänger: @p, @s, @a, @r oder ein Spielername (Buchstaben, Ziffern, Unterstrich).';
  function mcEnchList(list) { return list.map(function (e) { return e[0] + ':' + e[1]; }).join(','); }
  /* /give with item components. o: target, item, count, name, nameColor, namePlain, lore[], loreColor, lorePlain, ench [[id, level]], unbreakable */
  function cmdGive(o) {
    var t = mcTarget(o.target), item = String(o.item || '').trim().toLowerCase(), count = o.count == null || o.count === '' ? 1 : Number(o.count), parts = [], seen = {}, bad = null;
    if (!t) { return { err: ERR_TARGET }; }
    if (!/^([a-z0-9_.-]+:)?[a-z0-9_./-]+$/.test(item)) { return { err: 'Gegenstand: trage eine Item-ID ein, zum Beispiel diamond_sword.' }; }
    if (!(count >= 1 && count <= 64 && Math.floor(count) === count)) { return { err: 'Anzahl: eine ganze Zahl von 1 bis 64.' }; }
    (o.ench || []).forEach(function (e) {
      if (!ENCH[e[0]] || seen[e[0]]) { bad = 'Verzauberung: jede Verzauberung nur einmal und nur aus der Liste.'; }
      else if (!(e[1] >= 1 && e[1] <= ENCH_LEVEL_MAX && Math.floor(e[1]) === e[1])) { bad = 'Stufe: eine ganze Zahl von 1 bis ' + ENCH_LEVEL_MAX + '.'; }
      seen[e[0]] = true;
    });
    if (bad) { return { err: bad }; }
    var name = mcClean(o.name).trim(), lore = (o.lore || []).map(function (l) { return mcClean(l).trim(); }).filter(function (l) { return l !== ''; });
    if (lore.length > 20) { return { err: 'Lore: höchstens 20 Zeilen.' }; }
    if (name) { parts.push('custom_name=' + mcText({ text: name, color: o.nameColor, italic: o.namePlain ? false : undefined })); }
    if (lore.length) { parts.push('lore=[' + lore.map(function (l) { return mcText({ text: l, color: o.loreColor, italic: o.lorePlain ? false : undefined }); }).join(',') + ']'); }
    if (o.ench && o.ench.length) { parts.push('enchantments={' + mcEnchList(o.ench) + '}'); }
    if (o.unbreakable) { parts.push('unbreakable={}'); }
    return { cmd: '/give ' + t + ' ' + item + (parts.length ? '[' + parts.join(',') + ']' : '') + (count > 1 ? ' ' + count : '') };
  }
  /* /tellraw. o: target, parts [{text, color, bold, italic, underlined, strikethrough, obfuscated, click: {action, value}, hover}] */
  function cmdTellraw(o) {
    var t = mcTarget(o.target), err = null;
    if (!t) { return { err: ERR_TARGET }; }
    var parts = (o.parts || []).filter(function (p) { return mcClean(p.text) !== ''; });
    if (!parts.length) { return { err: 'Trage mindestens in einem Text-Teil einen Text ein.' }; }
    parts.forEach(function (p, i) {
      if (!p.click || !p.click.action) { return; }
      var v = mcClean(p.click.value).trim();
      if (!v) { err = 'Text-Teil ' + (i + 1) + ': trage ein, was der Klick auslösen soll.'; }
      else if (p.click.action === 'open_url' && !/^https?:\/\/[^\s"\\]+$/.test(v)) { err = 'Text-Teil ' + (i + 1) + ': der Link muss mit https:// oder http:// beginnen und darf keine Leerzeichen enthalten.'; }
    });
    if (err) { return { err: err }; }
    var list = parts.map(function (p) { return mcText({ text: p.text, color: p.color, bold: p.bold, italic: p.italic, underlined: p.underlined, strikethrough: p.strikethrough, obfuscated: p.obfuscated, click: p.click && p.click.action ? { action: p.click.action, value: mcClean(p.click.value).trim() } : null, hover: mcClean(p.hover).trim() }); });
    /* the empty first entry keeps the formatting of part 1 away from the parts after it (later list entries inherit from the first) */
    return { cmd: '/tellraw ' + t + ' ' + (list.length === 1 ? list[0] : '["",' + list.join(',') + ']') };
  }
  /* creatures offered by /summon: [id, German name]; every ID summoned on Paper 1.21.11 and 26.3 */
  var MOBS = [['zombie', 'Zombie'], ['skeleton', 'Skelett'], ['creeper', 'Creeper'], ['spider', 'Spinne'], ['cave_spider', 'Höhlenspinne'], ['enderman', 'Enderman'], ['witch', 'Hexe'], ['slime', 'Schleim'], ['magma_cube', 'Magmawürfel'], ['blaze', 'Lohe'], ['ghast', 'Ghast'], ['wither_skeleton', 'Witherskelett'], ['piglin', 'Piglin'], ['zombified_piglin', 'Zombifizierter Piglin'], ['hoglin', 'Hoglin'], ['drowned', 'Ertrunkener'], ['husk', 'Wüstenzombie'], ['stray', 'Eiswanderer'], ['phantom', 'Phantom'], ['pillager', 'Plünderer'], ['vindicator', 'Diener'], ['evoker', 'Magier'], ['ravager', 'Verwüster'], ['vex', 'Plagegeist'], ['guardian', 'Wächter'], ['warden', 'Wärter'], ['silverfish', 'Silberfischchen'], ['endermite', 'Endermite'], ['shulker', 'Shulker'],
    ['villager', 'Dorfbewohner'], ['wandering_trader', 'Fahrender Händler'], ['iron_golem', 'Eisengolem'], ['snow_golem', 'Schneegolem'], ['copper_golem', 'Kupfergolem'], ['allay', 'Hilfsgeist'],
    ['cow', 'Kuh'], ['mooshroom', 'Mooshroom'], ['pig', 'Schwein'], ['sheep', 'Schaf'], ['chicken', 'Huhn'], ['horse', 'Pferd'], ['donkey', 'Esel'], ['mule', 'Maultier'], ['llama', 'Lama'], ['camel', 'Dromedar'], ['wolf', 'Wolf'], ['cat', 'Katze'], ['ocelot', 'Ozelot'], ['fox', 'Fuchs'], ['rabbit', 'Kaninchen'], ['bee', 'Biene'], ['parrot', 'Papagei'], ['panda', 'Panda'], ['polar_bear', 'Eisbär'], ['goat', 'Ziege'], ['frog', 'Frosch'], ['turtle', 'Schildkröte'], ['axolotl', 'Axolotl'], ['dolphin', 'Delfin'], ['squid', 'Tintenfisch'], ['bat', 'Fledermaus'], ['armadillo', 'Gürteltier'], ['sniffer', 'Schnüffler'], ['strider', 'Schreiter'], ['armor_stand', 'Rüstungsständer']];
  /* switches of /summon: [option, NBT tag, German label, hint]; NoAI and PersistenceRequired exist on creatures only, not on the armor stand */
  var SUMMON_FLAGS = [['nameVisible', 'CustomNameVisible', 'Name immer anzeigen', 'Sonst erscheint der Name nur, wenn du die Kreatur ansiehst.'], ['noAi', 'NoAI', 'Ohne KI (NoAI)', 'Die Kreatur bewegt sich nicht und fällt nicht.'], ['silent', 'Silent', 'Stumm', 'Die Kreatur macht keine Geräusche.'], ['invulnerable', 'Invulnerable', 'Unverwundbar', 'Die Kreatur nimmt keinen Schaden.'], ['persistent', 'PersistenceRequired', 'Verschwindet nicht von selbst', 'Die Kreatur wird nicht automatisch entfernt.'], ['glowing', 'Glowing', 'Leuchtender Umriss', 'Die Kreatur bekommt einen leuchtenden Umriss.']];
  function mcCoord(v) { v = String(v == null ? '' : v).trim(); return /^(~(-?\d+(\.\d+)?)?|-?\d+(\.\d+)?)$/.test(v) ? v : null; }
  /* /summon. o: entity, x, y, z, name, nameColor, plus the SUMMON_FLAGS options */
  function cmdSummon(o) {
    var ok = false, x = mcCoord(o.x == null ? '~' : o.x), y = mcCoord(o.y == null ? '~' : o.y), z = mcCoord(o.z == null ? '~' : o.z), tags = [];
    MOBS.forEach(function (m) { if (m[0] === o.entity) { ok = true; } });
    if (!ok) { return { err: 'Wähle eine Kreatur aus der Liste.' }; }
    if (x === null || y === null || z === null) { return { err: 'Position: je Feld eine Zahl oder ~ (aktuelle Position), zum Beispiel ~ ~1 ~ oder 100 64 -20.' }; }
    var name = mcClean(o.name).trim(), stand = o.entity === 'armor_stand';
    if (name) { tags.push('CustomName:' + mcText({ text: name, color: o.nameColor })); }
    SUMMON_FLAGS.forEach(function (f) {
      if (!o[f[0]] || (f[0] === 'nameVisible' && !name) || (stand && (f[1] === 'NoAI' || f[1] === 'PersistenceRequired'))) { return; }
      tags.push(f[1] + ':1b');
    });
    return { cmd: '/summon ' + o.entity + ' ' + x + ' ' + y + ' ' + z + (tags.length ? ' {' + tags.join(',') + '}' : '') };
  }
  /* /give for the enchantment calculator: only enchantments the item takes, levels up to the survival maximum, no incompatible pair */
  function cmdEnchGive(target, type, tier, list) {
    var id = enchItemId(type, tier), t = mcTarget(target), err = null;
    if (!t) { return { err: ERR_TARGET }; }
    if (!id) { return { err: 'Wähle einen Gegenstand aus der Liste.' }; }
    list.forEach(function (e, i) {
      if (!ENCH[e[0]] || enchType(type)[4].indexOf(e[0]) < 0) { err = 'Diese Verzauberung passt nicht auf den Gegenstand.'; return; }
      if (!(e[1] >= 1 && e[1] <= ENCH[e[0]][1] && Math.floor(e[1]) === e[1])) { err = ENCH[e[0]][0] + ': Stufe 1 bis ' + ENCH[e[0]][1] + '.'; }
      list.forEach(function (f, j) { if (j !== i && (f[0] === e[0] || enchConflict(e[0], f[0]))) { err = ENCH[e[0]][0] + ' und ' + (ENCH[f[0]] ? ENCH[f[0]][0] : f[0]) + ' lassen sich nicht kombinieren.'; } });
    });
    if (err) { return { err: err }; }
    return { cmd: '/give ' + t + ' ' + id + (list.length ? '[enchantments={' + mcEnchList(list) + '}]' : '') };
  }

  function lenHint(len, value) {
    if (!len) { return; }
    var long = value.length > CHAT_MAX;
    len.className = 'vhb-len' + (long ? ' vhb-long' : '');
    len.textContent = value.length + ' Zeichen. ' + (long ? 'Zu lang für die Chat-Zeile (' + CHAT_MAX + ' Zeichen): nutze einen Befehlsblock oder die Serverkonsole.' : 'Passt in die Chat-Zeile.');
  }
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text != null) { e.textContent = text; } return e; }
  function fillTextColors(sel, first) {
    var o = mk('option', null, first); o.value = ''; sel.appendChild(o);
    TEXT_COLORS.forEach(function (c) { var op = mk('option', null, c[2]); op.value = c[0]; sel.appendChild(op); });
  }

  function initCmd(root) {
    var out = root.querySelector('#c-out'), len = root.querySelector('#c-len'), status = root.querySelector('#c-status'), tabs = root.querySelectorAll('[data-cmd-tab]');
    if (!out || !tabs.length) { return; }
    var kind = 'give', ench = [['sharpness', 5], ['unbreaking', 3]], parts = [{ text: 'Willkommen auf dem Server!', color: 'gold', bold: true }, { text: ' Klick hier für die Hilfe.', color: 'white', click: { action: 'run_command', value: '/help' } }];
    function q(s) { return root.querySelector(s); }
    function say(t) { if (status) { status.textContent = t; } }
    function val(s) { var e = q(s); return e ? e.value : ''; }
    function on(s) { var e = q(s); return !!(e && e.checked); }

    /* /give */
    var dl = q('#cg-items'), enchSel = q('#cg-ench'), enchList = q('#cg-ench-list');
    if (dl) { GIVE_ITEMS.forEach(function (id) { var o = mk('option'); o.value = id; dl.appendChild(o); }); }
    if (enchSel) { Object.keys(ENCH).sort(function (a, b) { return ENCH[a][0].localeCompare(ENCH[b][0], 'de'); }).forEach(function (id) { var o = mk('option', null, ENCH[id][0] + ' (' + id + ')'); o.value = id; enchSel.appendChild(o); }); enchSel.value = 'sharpness'; }
    ['#cg-name-color', '#cg-lore-color', '#cs-name-color'].forEach(function (s) { var e = q(s); if (e) { fillTextColors(e, 'Standard'); } });
    function renderEnch(focusI) {
      if (!enchList) { return; }
      enchList.textContent = '';
      ench.forEach(function (e, i) {
        var li = mk('li', 'vhc-chip'), b = mk('button', 'vhb-ico', '✕');
        li.appendChild(mk('span', null, ENCH[e[0]][0] + ' ' + e[1])); li.appendChild(mk('code', null, e[0] + ':' + e[1]));
        b.type = 'button'; b.setAttribute('aria-label', ENCH[e[0]][0] + ' entfernen'); b.setAttribute('data-ench-del', i);
        li.appendChild(b); enchList.appendChild(li);
      });
      if (focusI != null) { var f = enchList.querySelector('[data-ench-del="' + Math.min(focusI, ench.length - 1) + '"]') || q('#cg-ench-add'); if (f) { f.focus(); } }
    }
    if (q('#cg-ench-add')) {
      q('#cg-ench-add').addEventListener('click', function () {
        var id = enchSel.value, level = Number(val('#cg-ench-lvl')), found = false;
        if (!(level >= 1 && level <= ENCH_LEVEL_MAX && Math.floor(level) === level)) { say('Stufe: eine ganze Zahl von 1 bis ' + ENCH_LEVEL_MAX + '.'); return; }
        ench.forEach(function (e) { if (e[0] === id) { e[1] = level; found = true; } });
        if (!found) { ench.push([id, level]); }
        renderEnch(); render(); say(ENCH[id][0] + ' ' + level + (found ? ' geändert.' : ' hinzugefügt.'));
      });
    }
    if (enchList) {
      enchList.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-ench-del]') : null; if (!b) { return; }
        var i = parseInt(b.getAttribute('data-ench-del'), 10), gone = ench.splice(i, 1)[0];
        renderEnch(i); render(); say(ENCH[gone[0]][0] + ' entfernt.');
      });
    }

    /* /tellraw */
    var partList = q('#ct-parts'), preview = q('#ct-preview'), PART_MAX = 8;
    function field(labelText, control, id) { var w = mk('div', 'vht-field'), l = mk('label', null, labelText); control.id = id; l.setAttribute('for', id); w.appendChild(l); w.appendChild(control); return w; }
    function renderParts(focusSel) {
      if (!partList) { return; }
      partList.textContent = '';
      parts.forEach(function (p, i) {
        var li = mk('li', 'vhc-part'), fs = mk('fieldset'), n = i + 1, text = mk('input'), color = mk('select'), styles = mk('div', 'vhc-styles'), click = mk('select'), value = mk('input'), hover = mk('input'), del = mk('button', 'vhp-btn vhp-btn--ghost vht-btn', 'Text-Teil ' + n + ' entfernen');
        fs.appendChild(mk('legend', null, 'Text-Teil ' + n));
        text.type = 'text'; text.value = p.text || ''; text.maxLength = 200; text.setAttribute('data-part', i); text.setAttribute('data-k', 'text'); text.autocomplete = 'off';
        fs.appendChild(field('Text', text, 'ct-text-' + i));
        fillTextColors(color, 'Standard'); color.value = p.color || ''; color.setAttribute('data-part', i); color.setAttribute('data-k', 'color');
        fs.appendChild(field('Farbe', color, 'ct-color-' + i));
        styles.setAttribute('role', 'group'); styles.setAttribute('aria-label', 'Schrift von Text-Teil ' + n);
        TEXT_STYLES.forEach(function (st) { var l = mk('label'), c = mk('input'); c.type = 'checkbox'; c.checked = p[st[0]] === true; c.setAttribute('data-part', i); c.setAttribute('data-k', st[0]); l.appendChild(c); l.appendChild(document.createTextNode(' ' + st[1])); styles.appendChild(l); });
        fs.appendChild(styles);
        var none = mk('option', null, 'Kein Klick'); none.value = ''; click.appendChild(none);
        CLICK_ACTIONS.forEach(function (a) { var o = mk('option', null, a[2]); o.value = a[0]; click.appendChild(o); });
        click.value = p.click ? p.click.action : ''; click.setAttribute('data-part', i); click.setAttribute('data-k', 'click');
        fs.appendChild(field('Beim Klick', click, 'ct-click-' + i));
        value.type = 'text'; value.value = p.click ? p.click.value || '' : ''; value.maxLength = 200; value.autocomplete = 'off'; value.spellcheck = false; value.setAttribute('data-part', i); value.setAttribute('data-k', 'value');
        var vf = field('Link, Befehl oder Text für den Klick', value, 'ct-value-' + i); vf.hidden = !p.click; fs.appendChild(vf);
        hover.type = 'text'; hover.value = p.hover || ''; hover.maxLength = 200; hover.autocomplete = 'off'; hover.setAttribute('data-part', i); hover.setAttribute('data-k', 'hover');
        fs.appendChild(field('Text beim Darüberfahren (optional)', hover, 'ct-hover-' + i));
        del.type = 'button'; del.setAttribute('data-part-del', i); del.disabled = parts.length < 2;
        fs.appendChild(del); li.appendChild(fs); partList.appendChild(li);
      });
      var add = q('#ct-add'); if (add) { add.disabled = parts.length >= PART_MAX; }
      if (focusSel) { var f = root.querySelector(focusSel); if (f && !f.disabled) { f.focus(); } }
    }
    function change(e) {
      var el = e.target, i = el.getAttribute ? el.getAttribute('data-part') : null, k = el.getAttribute ? el.getAttribute('data-k') : null;
      if (i == null || !parts[i]) { return; }
      var p = parts[i];
      if (k === 'text' || k === 'color' || k === 'hover') { p[k] = el.value; }
      else if (k === 'click') { p.click = el.value ? { action: el.value, value: p.click ? p.click.value : '' } : null; var vf = q('#ct-value-' + i); if (vf) { vf.parentNode.hidden = !el.value; } }
      else if (k === 'value') { if (p.click) { p.click.value = el.value; } }
      else { p[k] = el.checked; }
      render();
    }
    if (partList) {
      partList.addEventListener('input', change); partList.addEventListener('change', change);
      partList.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-part-del]') : null; if (!b || b.disabled) { return; }
        var i = parseInt(b.getAttribute('data-part-del'), 10); parts.splice(i, 1);
        renderParts('#ct-text-' + Math.min(i, parts.length - 1)); render(); say('Text-Teil ' + (i + 1) + ' entfernt.');
      });
    }
    if (q('#ct-add')) { q('#ct-add').addEventListener('click', function () { if (parts.length >= PART_MAX) { return; } parts.push({ text: '', color: '' }); renderParts('#ct-text-' + (parts.length - 1)); render(); say('Text-Teil ' + parts.length + ' hinzugefügt.'); }); }
    function renderPreview() {
      if (!preview) { return; }
      preview.textContent = '';
      parts.forEach(function (p) {
        if (!mcClean(p.text)) { return; }
        var s = mk('span', null, mcClean(p.text)), c = mcColor(p.color), deco = [];
        TEXT_COLORS.forEach(function (tc) { if (tc[0] === c) { s.style.color = tc[1]; } });
        if (p.bold) { s.style.fontWeight = '700'; } if (p.italic) { s.style.fontStyle = 'italic'; }
        if (p.underlined) { deco.push('underline'); } if (p.strikethrough) { deco.push('line-through'); }
        if (deco.length) { s.style.textDecoration = deco.join(' '); }
        if (p.obfuscated) { s.style.letterSpacing = '.2em'; s.style.opacity = '.6'; }
        preview.appendChild(s);
      });
    }

    /* /summon */
    var mobSel = q('#cs-entity'), flags = q('#cs-flags');
    if (mobSel) { MOBS.forEach(function (m) { var o = mk('option', null, m[1] + ' (' + m[0] + ')'); o.value = m[0]; mobSel.appendChild(o); }); mobSel.value = 'zombie'; }
    if (flags) {
      SUMMON_FLAGS.forEach(function (f) {
        var l = mk('label', 'vht-check'), c = mk('input'), s = mk('span');
        c.type = 'checkbox'; c.id = 'cs-' + f[0]; c.setAttribute('data-flag', f[0]);
        s.appendChild(mk('b', null, f[2])); s.appendChild(mk('small', null, ' ' + f[3]));
        l.appendChild(c); l.appendChild(s); flags.appendChild(l);
      });
    }

    function build() {
      if (kind === 'give') {
        return cmdGive({ target: val('#cg-target'), item: val('#cg-item'), count: val('#cg-count'), name: val('#cg-name'), nameColor: val('#cg-name-color'), namePlain: on('#cg-name-plain'), lore: val('#cg-lore').split('\n'), loreColor: val('#cg-lore-color'), lorePlain: on('#cg-lore-plain'), ench: ench, unbreakable: on('#cg-unbreakable') });
      }
      if (kind === 'tellraw') { return cmdTellraw({ target: val('#ct-target'), parts: parts }); }
      var o = { entity: val('#cs-entity'), x: val('#cs-x'), y: val('#cs-y'), z: val('#cs-z'), name: val('#cs-name'), nameColor: val('#cs-name-color') };
      SUMMON_FLAGS.forEach(function (f) { o[f[0]] = on('#cs-' + f[0]); });
      return cmdSummon(o);
    }
    function render() {
      var r = build();
      renderPreview();
      if (kind === 'summon') {
        var stand = val('#cs-entity') === 'armor_stand';
        ['#cs-noAi', '#cs-persistent'].forEach(function (s) { var e = q(s); if (e) { e.disabled = stand; } });
        var nv = q('#cs-nameVisible'); if (nv) { nv.disabled = !mcClean(val('#cs-name')).trim(); }
      }
      if (r.err) { out.value = ''; if (len) { len.className = 'vhb-len vhb-long'; len.textContent = r.err; } return; }
      out.value = r.cmd; lenHint(len, r.cmd);
    }
    function show(k, focus) {
      kind = k;
      tabs.forEach(function (b) { var is = b.getAttribute('data-cmd-tab') === k; b.setAttribute('aria-pressed', is ? 'true' : 'false'); b.classList.toggle('vhc-on', is); });
      root.querySelectorAll('[data-cmd-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-cmd-pane') !== k; });
      var lab = q('#c-out-label'); if (lab) { lab.textContent = '/' + k + '-Befehl (Java Edition)'; }
      render(); if (focus) { say('Befehl /' + k + ' gewählt.'); }
    }
    tabs.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-cmd-tab'), true); }); });
    root.querySelectorAll('[data-cmd-pane]').forEach(function (p) { p.addEventListener('input', function (e) { if (!e.target.getAttribute || e.target.getAttribute('data-part') == null) { render(); } }); p.addEventListener('change', function (e) { if (!e.target.getAttribute || e.target.getAttribute('data-part') == null) { render(); } }); });
    root.querySelectorAll('[data-copy-from]').forEach(function (b) { b.addEventListener('click', function () { var f = q('#' + b.getAttribute('data-copy-from')); if (!f.value) { say('Der Befehl ist noch nicht vollständig. Der Hinweis unter dem Feld sagt, was fehlt.'); return; } copyField(f, status); }); });
    renderEnch(); renderParts(); show('give', false);
  }

  function initEnch(root) {
    var typeSel = root.querySelector('#v-item'), tierSel = root.querySelector('#v-tier'), tierWrap = root.querySelector('#v-tier-wrap'), list = root.querySelector('#v-list');
    var plan = root.querySelector('#v-plan'), total = root.querySelector('#v-total'), target = root.querySelector('#v-target'), out = root.querySelector('#v-out'), len = root.querySelector('#v-len'), status = root.querySelector('#v-status'), clear = root.querySelector('#v-clear');
    if (!typeSel || !list || !plan || !out) { return; }
    var picked = {};
    function say(t) { if (status) { status.textContent = t; } }
    ENCH_ITEMS.forEach(function (t) { var o = mk('option', null, t[1]); o.value = t[0]; typeSel.appendChild(o); });
    typeSel.value = 'sword';
    function fillTiers() {
      var t = enchType(typeSel.value), keep = tierSel ? tierSel.value : '';
      if (!tierSel) { return; }
      tierSel.textContent = '';
      (t[3] || []).forEach(function (m) { var o = mk('option', null, m[1]); o.value = m[0]; tierSel.appendChild(o); });
      if (t[3]) { tierSel.value = t[3].some(function (m) { return m[0] === keep; }) ? keep : 'diamond'; }
      if (tierWrap) { tierWrap.hidden = !t[3]; }
    }
    function blockedBy(id) { var by = null; Object.keys(picked).forEach(function (p) { if (enchConflict(id, p)) { by = p; } }); return by; }
    function renderList(focusId) {
      var t = enchType(typeSel.value);
      list.textContent = '';
      t[4].forEach(function (id) {
        var li = mk('li', 'vhv-row'), lab = mk('label'), c = mk('input'), sel = mk('select'), by = blockedBy(id), j;
        c.type = 'checkbox'; c.checked = !!picked[id]; c.disabled = !!by; c.setAttribute('data-e', id); c.id = 'v-e-' + id;
        lab.appendChild(c); lab.appendChild(mk('span', null, ENCH[id][0])); lab.setAttribute('for', c.id);
        for (j = 1; j <= ENCH[id][1]; j++) { var o = mk('option', null, ROMAN[j]); o.value = j; sel.appendChild(o); }
        sel.value = picked[id] || ENCH[id][1]; sel.setAttribute('data-l', id); sel.setAttribute('aria-label', 'Stufe für ' + ENCH[id][0]); sel.disabled = !!by || ENCH[id][1] === 1;
        li.appendChild(lab); li.appendChild(sel);
        if (by) { li.appendChild(mk('small', 'vhv-why', 'Nicht zusammen mit ' + ENCH[by][0])); li.classList.add('vhv-off'); }
        list.appendChild(li);
      });
      if (focusId) { var f = list.querySelector('#v-e-' + focusId); if (f) { f.focus(); } }
    }
    function bookName(es) { return (es.length > 1 ? 'Buch mit ' : 'Buch ') + es.map(function (e) { return enchLabel(e[0], e[1]); }).join(' + '); }
    function itemName() { var t = enchType(typeSel.value), tier = ''; (t[3] || []).forEach(function (m) { if (tierSel && m[0] === tierSel.value) { tier = ' (' + m[1] + ')'; } }); return t[1] + tier; }
    function render() {
      var t = enchType(typeSel.value), chosen = t[4].filter(function (id) { return picked[id]; }).map(function (id) { return [id, picked[id]]; });
      plan.textContent = '';
      if (!chosen.length) {
        plan.appendChild(mk('li', 'vht-note', 'Wähle links mindestens eine Verzauberung.'));
        if (total) { total.textContent = ''; }
      } else {
        var p = anvilPlan(typeSel.value, chosen, ANVIL_LIMIT), tooMuch = false;
        if (!p) { p = anvilPlan(typeSel.value, chosen, 0); tooMuch = true; }
        p.steps.forEach(function (s, i) {
          var li = mk('li', 'vhv-step' + (s.cost > ANVIL_LIMIT ? ' vhv-over' : '')), left = s.item ? itemName() + (s.left.length ? ' mit ' + s.left.map(function (e) { return enchLabel(e[0], e[1]); }).join(', ') : '') : bookName(s.left);
          li.appendChild(mk('b', null, 'Schritt ' + (i + 1) + ': ' + s.cost + (s.cost === 1 ? ' Stufe' : ' Stufen')));
          li.appendChild(mk('span', null, 'Links: ' + left)); li.appendChild(mk('span', null, 'Rechts: ' + bookName(s.right)));
          plan.appendChild(li);
        });
        if (total) {
          total.className = 'vhv-total' + (tooMuch ? ' vhb-long' : '');
          total.textContent = (tooMuch ? 'Im Überlebensmodus nicht möglich: Mindestens ein Schritt kostet mehr als ' + ANVIL_LIMIT + ' Stufen, der Amboss meldet „Zu teuer!“. Günstigste Reihenfolge ohne diese Grenze: ' : 'Günstigste Reihenfolge: ') + p.steps.length + (p.steps.length === 1 ? ' Schritt, ' : ' Schritte, ') + 'zusammen ' + p.total + (p.total === 1 ? ' Erfahrungsstufe.' : ' Erfahrungsstufen.');
        }
      }
      var r = cmdEnchGive(target ? target.value : '@p', typeSel.value, tierSel ? tierSel.value : '', chosen);
      if (r.err) { out.value = ''; if (len) { len.className = 'vhb-len vhb-long'; len.textContent = r.err; } return; }
      out.value = r.cmd; lenHint(len, r.cmd);
    }
    typeSel.addEventListener('change', function () { var t = enchType(typeSel.value); Object.keys(picked).forEach(function (id) { if (t[4].indexOf(id) < 0) { delete picked[id]; } }); fillTiers(); renderList(); render(); });
    if (tierSel) { tierSel.addEventListener('change', render); }
    list.addEventListener('change', function (e) {
      var el = e.target, id = el.getAttribute('data-e') || el.getAttribute('data-l'), sel = list.querySelector('[data-l="' + id + '"]');
      if (!id) { return; }
      if (el.getAttribute('data-e')) {
        if (el.checked) { picked[id] = Number(sel.value); say(enchLabel(id, picked[id]) + ' gewählt.'); } else { delete picked[id]; say(ENCH[id][0] + ' abgewählt.'); }
        renderList(id);
      } else if (picked[id]) { picked[id] = Number(el.value); }
      render();
    });
    if (target) { target.addEventListener('input', render); }
    if (clear) { clear.addEventListener('click', function () { picked = {}; renderList(); render(); say('Auswahl geleert.'); }); }
    root.querySelectorAll('[data-copy-from]').forEach(function (b) { b.addEventListener('click', function () { var f = root.querySelector('#' + b.getAttribute('data-copy-from')); if (!f.value) { say('Trage zuerst einen gültigen Empfänger ein.'); return; } copyField(f, status); }); });
    picked = { sharpness: 5, looting: 3, unbreaking: 3, mending: 1 };
    fillTiers(); renderList(); render();
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
    var uuid = document.querySelector('[data-vh-uuid]');
    if (uuid) { initUuid(uuid); }
    var banner = document.querySelector('[data-vh-banner]');
    if (banner) { initBanner(banner); }
    var cmd = document.querySelector('[data-vh-cmd]');
    if (cmd) { initCmd(cmd); }
    var enchRoot = document.querySelector('[data-vh-ench]');
    if (enchRoot) { initEnch(enchRoot); }
  }

  /* Node only (tests): the command builders and anvil functions the pages use. Browsers have no module object. */
  if (typeof module === 'object' && module.exports) {
    module.exports = { ENCH: ENCH, ENCH_ITEMS: ENCH_ITEMS, MOBS: MOBS, GIVE_ITEMS: GIVE_ITEMS, TEXT_COLORS: TEXT_COLORS, TEXT_STYLES: TEXT_STYLES, CLICK_ACTIONS: CLICK_ACTIONS, SUMMON_FLAGS: SUMMON_FLAGS, enchItemId: enchItemId, enchConflict: enchConflict, anvilEnchCost: anvilEnchCost, anvilCost: anvilCost, anvilPlan: anvilPlan, cmdGive: cmdGive, cmdTellraw: cmdTellraw, cmdSummon: cmdSummon, cmdEnchGive: cmdEnchGive };
    return;
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
