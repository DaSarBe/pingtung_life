/* 屏東人生的小遊戲。
 * 超商比對、外送閃避、檳榔園抓準、漁港分類、夜市套圈。
 * 玩完把分數交回去。放棄不算這一趟。
 */
(function () {
  'use strict';

  var onDone = null;
  var onCancel = null;
  var settled = true;
  var cleanups = [];

  function $(id) { return document.getElementById(id); }
  function cleanup() {
    cleanups.splice(0).forEach(function (fn) { try { fn(); } catch (err) { /* 收尾 */ } });
  }
  function finish(score, total) {
    if (settled) return;
    settled = true;
    cleanup();
    var done = onDone;
    onDone = null;
    onCancel = null;
    if (done) done(score, total);
  }
  function cancel() {
    if (settled) return;
    settled = true;
    cleanup();
    var cb = onCancel;
    onDone = null;
    onCancel = null;
    if (cb) cb();
  }
  function stop() {
    settled = true;
    cleanup();
    onDone = null;
    onCancel = null;
  }
  function button(label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost';
    btn.textContent = label;
    return btn;
  }

  function startClerk() {
    var items = ['飯糰', '咖啡', '茶葉蛋', '關東煮'];
    var prompt = $('shift-prompt'), stage = $('shift-stage'), meta = $('shift-meta');
    var round = 0, score = 0, total = 6, timer = 0, locked = false;
    function showRound() {
      if (settled) return;
      if (round >= total) { finish(score, total); return; }
      locked = false;
      var want = items[Math.floor(Math.random() * items.length)];
      var order = items.slice().sort(function () { return Math.random() - 0.5; });
      prompt.textContent = '客人要：' + want;
      meta.textContent = '第 ' + (round + 1) + ' / ' + total + ' 筆 · 對了 ' + score;
      stage.textContent = '';
      var list = document.createElement('div');
      list.className = 'shift-choices';
      order.forEach(function (name) {
        var choice = button(name);
        choice.addEventListener('click', function () { pick(name === want); });
        list.appendChild(choice);
      });
      stage.appendChild(list);
      timer = window.setTimeout(function () { pick(false); }, 2200);
    }
    function pick(ok) {
      if (locked || settled) return;
      locked = true;
      window.clearTimeout(timer);
      if (ok) score += 1;
      round += 1;
      showRound();
    }
    cleanups.push(function () { window.clearTimeout(timer); });
    showRound();
  }

  function startCourier() {
    var prompt = $('shift-prompt'), stage = $('shift-stage'), meta = $('shift-meta');
    var lane = 1, score = 0, total = 8, passed = 0, spawned = 0, obstacles = [];
    var spawnIn = 0.3, running = true, last = 0, frameId = 0;
    prompt.textContent = '左右躲開前面的箱子。';
    stage.textContent = '';
    var board = document.createElement('div');
    board.className = 'dodge';
    var rider = document.createElement('div');
    rider.className = 'dodge-rider';
    board.appendChild(rider);
    function placeRider() { rider.style.left = (lane * 33.33 + 3.5) + '%'; }
    function move(dir) { lane = Math.max(0, Math.min(2, lane + dir)); placeRider(); }
    var left = button('左'), right = button('右');
    left.id = 'shift-left';
    right.id = 'shift-right';
    left.addEventListener('click', function () { move(-1); });
    right.addEventListener('click', function () { move(1); });
    var controls = document.createElement('div');
    controls.className = 'row-btns';
    controls.appendChild(left);
    controls.appendChild(right);
    stage.appendChild(board);
    stage.appendChild(controls);
    placeRider();
    function onKey(event) {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') { move(-1); event.preventDefault(); }
      else if (event.code === 'ArrowRight' || event.code === 'KeyD') { move(1); event.preventDefault(); }
    }
    window.addEventListener('keydown', onKey);
    function frame(now) {
      if (!running || settled) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      spawnIn -= dt;
      if (spawnIn <= 0 && spawned < total) {
        spawnIn = 0.78;
        spawned += 1;
        var which = Math.floor(Math.random() * 3);
        var el = document.createElement('div');
        el.className = 'dodge-block';
        el.style.left = (which * 33.33 + 6) + '%';
        board.appendChild(el);
        obstacles.push({ lane: which, y: -12, el: el });
      }
      obstacles.forEach(function (ob) { ob.y += dt * 48; ob.el.style.top = ob.y + '%'; });
      obstacles = obstacles.filter(function (ob) {
        if (ob.y < 82) return true;
        ob.el.remove();
        passed += 1;
        if (ob.lane !== lane) score += 1;
        return false;
      });
      meta.textContent = '躲過 ' + score + ' / ' + passed;
      if (passed >= total) { finish(score, total); return; }
      frameId = window.requestAnimationFrame(frame);
    }
    frameId = window.requestAnimationFrame(frame);
    cleanups.push(function () {
      running = false;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKey);
    });
  }

  function startFarm() {
    var prompt = $('shift-prompt'), stage = $('shift-stage'), meta = $('shift-meta');
    var pos = 0, dir = 1, score = 0, round = 0, total = 6, running = true, frameId = 0, last = 0;
    prompt.textContent = '葉子進綠框就按「採」。';
    stage.textContent = '';
    var track = document.createElement('div');
    track.className = 'farm-track';
    var zone = document.createElement('div');
    zone.className = 'farm-zone';
    var marker = document.createElement('div');
    marker.className = 'farm-marker';
    track.appendChild(zone);
    track.appendChild(marker);
    var hit = button('採');
    hit.className = 'btn btn-primary';
    stage.appendChild(track);
    stage.appendChild(hit);
    function layout() { marker.style.left = pos + '%'; }
    hit.addEventListener('click', function () {
      if (settled) return;
      if (Math.abs(pos - 50) < 16) score += 1;
      round += 1;
      meta.textContent = '採到 ' + score + ' / ' + round;
      if (round >= total) finish(score, total);
    });
    function frame(now) {
      if (!running || settled) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      pos += dir * dt * 62;
      if (pos > 100) { pos = 100; dir = -1; }
      if (pos < 0) { pos = 0; dir = 1; }
      layout();
      frameId = window.requestAnimationFrame(frame);
    }
    meta.textContent = '採到 0 / 0';
    frameId = window.requestAnimationFrame(frame);
    cleanups.push(function () { running = false; window.cancelAnimationFrame(frameId); });
  }

  function startPort() {
    var kinds = ['魚', '蝦', '蟹'];
    var prompt = $('shift-prompt'), stage = $('shift-stage'), meta = $('shift-meta');
    var round = 0, score = 0, total = 6, timer = 0, locked = false;
    function showRound() {
      if (settled) return;
      if (round >= total) { finish(score, total); return; }
      locked = false;
      var want = kinds[Math.floor(Math.random() * kinds.length)];
      prompt.textContent = '這一簍是：' + want;
      meta.textContent = '第 ' + (round + 1) + ' / ' + total + ' 簍 · 分對 ' + score;
      stage.textContent = '';
      var list = document.createElement('div');
      list.className = 'shift-choices';
      kinds.forEach(function (name) {
        var choice = button('放到' + name + '籃');
        choice.addEventListener('click', function () { pick(name === want); });
        list.appendChild(choice);
      });
      stage.appendChild(list);
      timer = window.setTimeout(function () { pick(false); }, 2400);
    }
    function pick(ok) {
      if (locked || settled) return;
      locked = true;
      window.clearTimeout(timer);
      if (ok) score += 1;
      round += 1;
      showRound();
    }
    cleanups.push(function () { window.clearTimeout(timer); });
    showRound();
  }

  function startRing() {
    var prompt = $('shift-prompt'), stage = $('shift-stage'), meta = $('shift-meta');
    var round = 0, score = 0, total = 5, timer = 0, locked = false;
    prompt.textContent = '套中亮起來的那個攤。';
    function showRound() {
      if (settled) return;
      if (round >= total) { finish(score, total); return; }
      locked = false;
      var lit = Math.floor(Math.random() * 3);
      meta.textContent = '第 ' + (round + 1) + ' / ' + total + ' 圈 · 套中 ' + score;
      stage.textContent = '';
      var row = document.createElement('div');
      row.className = 'row-btns';
      for (var i = 0; i < 3; i += 1) {
        var choice = button(i === lit ? '這裡' : '攤子');
        if (i === lit) choice.className = 'btn btn-primary';
        choice.dataset.lit = i === lit ? '1' : '0';
        (function (good) {
          choice.addEventListener('click', function () { pick(good); });
        })(i === lit);
        row.appendChild(choice);
      }
      stage.appendChild(row);
      timer = window.setTimeout(function () { pick(false); }, 1400);
    }
    function pick(ok) {
      if (locked || settled) return;
      locked = true;
      window.clearTimeout(timer);
      if (ok) score += 1;
      round += 1;
      showRound();
    }
    cleanups.push(function () { window.clearTimeout(timer); });
    showRound();
  }

  function start(kind, done, cancelCb) {
    stop();
    onDone = done;
    onCancel = cancelCb;
    settled = false;
    var title = $('shift-title');
    var names = { clerk: '8-12 超商', courier: '外送', farm: '檳榔園', port: '漁港', ring: '夜市套圈' };
    if (title) title.textContent = names[kind] || '做事';
    if (kind === 'courier') startCourier();
    else if (kind === 'farm') startFarm();
    else if (kind === 'port') startPort();
    else if (kind === 'ring') startRing();
    else startClerk();
  }

  window.PingShift = { start: start, cancel: cancel, stop: stop };
})();
