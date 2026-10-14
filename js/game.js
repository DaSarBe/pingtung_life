/* 屏東人生
 * 存款、打工、車輛、關係和通緝都在這個檔案。
 * 畫面文字用繁體中文。闖禍只有按鈕和後果，沒有寫實過程。
 */
(function () {
  'use strict';

  var SAVE_KEY = 'pingtung-life-save-v1';
  var BOARD_KEY = 'pingtung-life-board-v1';

  var RULES = {
    startMoney: 1600,
    startStamina: 80,
    startHunger: 62,
    startMood: 70,
    startFame: 10,
    rent: 2800,
    scooter: 2800,
    car: 14000,
    speedCost: 900,
    tankCost: 700,
    gasSmall: 50,
    gasFull: 120,
    gasSmallAdd: 30,
    trainFare: 120,
    busFare: 40,
    fine: [0, 400, 900, 1600, 2400, 3200]
  };

  var JOBS = {
    clerk: { name: '8-12 店員', pay: 700, minutes: 120, stamina: 16, where: '超商' },
    courier: { name: '外送', pay: 1100, minutes: 90, stamina: 22, where: '外送' },
    farm: { name: '檳榔園', pay: 900, minutes: 150, stamina: 20, where: '農場' },
    port: { name: '漁港幫工', pay: 1000, minutes: 140, stamina: 18, where: '漁港' }
  };

  var BUS = [
    { place: 'station', name: '屏東火車站' },
    { place: 'market', name: '屏東夜市' },
    { place: 'park', name: '千禧公園' },
    { place: 'star', name: '勝利星村' },
    { place: 'mall', name: '太平洋百貨' },
    { place: 'gov', name: '縣政府' },
    { place: 'uni', name: '屏東大學' },
    { place: 'river', name: '高屏溪' },
    { place: 'farm', name: '檳榔園' },
    { place: 'port', name: '東港漁港' }
  ];

  var RACE = [[-8, -62], [18, -64], [30, -56], [-22, -56], [-8, -62]];

  var COPY = {
    home: {
      morning: '雅房靠火車站，窗外已經有機車聲。床在左側。',
      afternoon: '房間有點熱，電風扇轉得很慢。',
      evening: '天色轉橘，門縫裡透進路燈。',
      night: '街上還有零星的引擎聲。'
    },
    station: {
      morning: '屏東火車站前人來人往，早餐攤已經開了。',
      afternoon: '月台邊有人等下一班往高雄的車。',
      evening: '車站的燈先亮起來。',
      night: '末班車的氣氛，廣場還是亮的。'
    },
    market: {
      morning: '夜市攤子在收桌子，青草茶倒還買得到。',
      afternoon: '有人在備料，油鍋先響。',
      evening: '燈籠亮了，肉圓和套圈擠在一起。',
      night: '人最多的時候，走路要側著過。巷口茶室亮著暗燈。'
    },
    park: {
      morning: '千禧公園剛醒，有人沿著步道走。',
      afternoon: '椰子樹把太陽切成一塊一塊。',
      evening: '草地變涼，適合坐一下。',
      night: '路燈把步道照成一條暖線。'
    },
    star: {
      morning: '勝利星村的老屋還沒太多人。',
      afternoon: '紅磚和綠樹，很適合拍照。',
      evening: '燈串亮起，巷子變得好走。',
      night: '店家打烊了一半，牆還是好看。'
    },
    mall: {
      morning: '太平洋百貨剛開門，冷氣先湧出來。',
      afternoon: '電梯口很多人，餐廳在樓上。',
      evening: '櫥窗全亮了。',
      night: '快打烊，一樓還進得去。'
    },
    gov: {
      morning: '縣政府這帶開始上班，六堆園區的牌子在旁邊。',
      afternoon: '廣場曬得很亮。',
      evening: '辦公室的燈一格格暗下去。',
      night: '園區靜了，春嬌還坐在門口。'
    },
    uni: {
      morning: '屏東大學的腳踏車很多。',
      afternoon: '自助餐窗口排著短短的隊伍。',
      evening: '圖書館的燈比操場亮。',
      night: '校園幾乎空了，阿德還在。'
    },
    river: {
      morning: '高屏溪的風比街上大。',
      afternoon: '堤防上有人騎車經過。',
      evening: '水面變深，阿龍靠在欄杆邊。',
      night: '溪邊很暗，只有車燈掃過去。'
    },
    farm: {
      morning: '檳榔園的葉子還帶著露水。',
      afternoon: '太陽很大，工寮裡比較涼。',
      evening: '收工的人陸續騎車離開。',
      night: '園子暗了，今晚沒有班。'
    },
    port: {
      morning: '往東港的漁港，魚箱一簍簍上岸。',
      afternoon: '冰水味很重，分類的工作還沒完。',
      evening: '拍賣快結束。',
      night: '碼頭只剩燈，船也不收了。'
    },
    road: {
      morning: '中正路和自由路都醒了，機車比人多。',
      afternoon: '柏油路發燙，椰子樹沿路排開。',
      evening: '路燈和店招一起亮。',
      night: '紅燈和測速照相都還在做事。'
    }
  };

  var state = null;
  var ui = blankUi();
  var toastTimer = 0;
  var lastWanted = -1;
  var appliedHide = {};
  var raceSent = false;
  var heat = 0;
  var bumpAt = 0;
  var stamWarned = false;
  var shownPlace = '';
  var placeTimer = 0;

  function blankUi() {
    return { screen: 'title', help: false, board: false, day: false, card: null, shift: null, confirm: null, naming: false, bust: null };
  }
  function $(id) { return document.getElementById(id); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function formatMoney(n) {
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function formatClock(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    var h = Math.floor(mins / 60), m = Math.floor(mins % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function periodOf(mins) {
    return mins >= 19 * 60 || mins < 5 * 60 ? 'night' : mins < 9 * 60 ? 'morning' : mins < 16 * 60 ? 'afternoon' : 'evening';
  }
  function isNight() { return state.time >= 18 * 60 || state.time < 5 * 60; }
  function cleanName(raw) {
    var name = String(raw || '').replace(/\s+/g, '').slice(0, 8);
    return name || '路人甲';
  }
  function speedMul() { return state && state.upgrades && state.upgrades.speed ? 1.18 : 1; }
  function fuelMax() { return state && state.upgrades && state.upgrades.tank ? 150 : 100; }
  function hasVehicle() { return !!(state && (state.ownsScooter || state.ownsCar || state.hot)); }
  function playing() {
    return !!(state && !state.over && ui.screen === 'play' && !state.pendingSummary && !ui.bust);
  }

  function createGame(name) {
    var pose = window.PingWorld ? window.PingWorld.spawn('home') : { x: -56, z: 16.4, ry: 0 };
    return {
      version: 2,
      name: name,
      day: 1,
      time: 7 * 60,
      money: RULES.startMoney,
      stamina: RULES.startStamina,
      hunger: RULES.startHunger,
      mood: RULES.startMood,
      fame: RULES.startFame,
      street: 0,
      wanted: 0,
      place: 'home',
      pose: { x: pose.x, z: pose.z, ry: pose.ry },
      fuel: 0,
      ownsScooter: false,
      ownsCar: false,
      upgrades: { speed: 0, tank: 0 },
      riding: 'walk',
      hot: false,
      hotKind: '',
      hotFuel: 0,
      rel: { xia: 0, ade: 0, chun: 0, long: 0 },
      jobsToday: { clerk: 0, courier: 0, farm: 0, port: 0 },
      jobCounts: { clerk: 0, courier: 0, farm: 0, port: 0 },
      flags: {
        breakfast: false, firstjob: false, wheels: false, sawMarket: false, sawRiver: false,
        warned: false, metLong: false
      },
      shoplift: { mart: 0, mall: 0 },
      side: { photo: '', deliver: '', ring: '', race: '', box: '' },
      carrying: false,
      hidden: [],
      racing: false,
      gambleBan: 0,
      ateToday: false,
      hintOn: true,
      ledger: freshLedger(RULES.startMoney, RULES.startStamina, RULES.startHunger, RULES.startMood),
      log: ['在火車站旁的雅房醒過來。'],
      pendingSummary: null,
      over: null,
      ranked: false,
      forcePose: true,
      frac: { hunger: 0, stamina: 0, fuel: 0, unseen: 0, event: 40 }
    };
  }
  function freshLedger(money, stamina, hunger, mood) {
    return { earn: 0, spend: 0, notes: [], money: money, stamina: stamina, hunger: hunger, mood: mood };
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.version !== 2 || !data.name) return null;
      data.frac = data.frac || { hunger: 0, stamina: 0, fuel: 0, unseen: 0, event: 40 };
      data.flags = data.flags || {};
      data.upgrades = data.upgrades || { speed: 0, tank: 0 };
      data.rel = data.rel || { xia: 0, ade: 0, chun: 0, long: 0 };
      data.jobsToday = data.jobsToday || { clerk: 0, courier: 0, farm: 0, port: 0 };
      data.jobCounts = data.jobCounts || { clerk: 0, courier: 0, farm: 0, port: 0 };
      data.side = data.side || { photo: '', deliver: '', ring: '', race: '', box: '' };
      data.shoplift = data.shoplift || { mart: 0, mall: 0 };
      data.hidden = data.hidden || [];
      data.log = data.log || [];
      return data;
    } catch (err) { return null; }
  }
  function save() {
    if (!state) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (err) { /* 這台裝置不讓存 */ }
  }
  function loadBoard() {
    try {
      var data = JSON.parse(localStorage.getItem(BOARD_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (err) { return []; }
  }
  function pushBoard() {
    if (!state || state.ranked) return;
    state.ranked = true;
    var board = loadBoard();
    board.push({ name: state.name, money: Math.round(state.money), day: state.day, at: Date.now() });
    board.sort(function (a, b) { return b.money - a.money; });
    try { localStorage.setItem(BOARD_KEY, JSON.stringify(board.slice(0, 10))); } catch (err) { /* 略過 */ }
  }

  function logLine(text) {
    if (!text) return;
    state.log.unshift(text);
    state.log = state.log.slice(0, 12);
  }
  function toast(message) {
    var el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.hidden = true; }, 2400);
  }
  function pop(text, kind) {
    var layer = $('pop-layer');
    if (!layer) return;
    var el = document.createElement('div');
    el.className = 'pop' + (kind ? ' ' + kind : '');
    el.textContent = text;
    el.style.left = (38 + Math.random() * 18) + '%';
    el.style.top = '46%';
    layer.appendChild(el);
    window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
  }
  function note(text) {
    if (state.ledger.notes.length < 8) state.ledger.notes.push(text);
    logLine(text);
  }

  function rememberPose() {
    if (!window.PingWorld) return;
    var pose = window.PingWorld.readPose();
    state.pose = { x: pose.x, z: pose.z, ry: pose.ry };
    if (pose.place) state.place = pose.place;
  }
  function ensureHidden() {
    if (!window.PingWorld) return;
    (state.hidden || []).forEach(function (id) {
      if (appliedHide[id]) return;
      appliedHide[id] = true;
      window.PingWorld.hideProp(id);
    });
  }
  function syncWorld(force) {
    var world = window.PingWorld;
    if (!world || !state) return;
    ensureHidden();
    world.setClock(state.time);
    world.setTired(state.stamina <= 14);
    world.setRide(state.riding === 'walk' ? 'walk' : state.riding, speedMul());
    world.setCarry(!!state.carrying);
    if (state.wanted !== lastWanted) {
      world.setWanted(state.wanted);
      lastWanted = state.wanted;
    }
    if (state.racing && !raceSent) {
      world.setChecks(RACE);
      raceSent = true;
    }
    if (!state.racing && raceSent) {
      world.setChecks([]);
      raceSent = false;
    }
    var pose = state.pose || world.spawn(state.place || 'home');
    world.show(state.place || 'home', periodOf(state.time), pose.x, pose.z, pose.ry || 0, !!(force || state.forcePose));
    state.forcePose = false;
  }

  function addMinutes(mins) {
    if (!state || state.over || state.pendingSummary) return false;
    state.time += mins;
    state.frac.hunger += mins * 0.04;
    while (state.frac.hunger >= 1) {
      state.hunger = Math.max(0, state.hunger - 1);
      state.frac.hunger -= 1;
    }
    if (state.time >= 24 * 60) {
      endDay('midnight');
      return true;
    }
    if (state.hunger <= 0) clinic();
    return false;
  }
  function gain(amount, text) {
    state.money += amount;
    state.ledger.earn += amount;
    if (text) note(text);
    pop('+' + formatMoney(amount), 'good');
  }
  function spend(amount, text) {
    state.money -= amount;
    state.ledger.spend += amount;
    if (text) note(text);
    pop('-' + formatMoney(amount), 'bad');
  }
  function bumpStat(key, delta) { state[key] = clamp(state[key] + delta, 0, 100); }

  function clinic() {
    if (state.hunger > 0 || state.over) return;
    state.hunger = 22;
    if (state.money >= 180) {
      spend(180, '餓到去診所，花了 $180');
      toast('肚子空了，去診所掛了一號');
    } else {
      bumpStat('stamina', -12);
      bumpStat('mood', -8);
      note('餓到站不穩');
      toast('餓到站不穩');
    }
  }
  function setStars(n) {
    state.wanted = clamp(n, 0, 5);
    if (state.wanted === 0) heat = 0;
    if (window.PingWorld && state.wanted !== lastWanted) {
      window.PingWorld.setWanted(state.wanted);
      lastWanted = state.wanted;
    }
  }

  function endDay(kind) {
    if (!state || state.over || state.pendingSummary) return;
    rememberPose();
    var nextHunger = state.hunger;
    var nextStamina = state.stamina;
    var nextMood = state.mood;
    var nextMoney = state.money;
    var notes = state.ledger.notes.slice();
    if (state.hunger < 35) {
      nextStamina = clamp(nextStamina - 14, 0, 100);
      nextMood = clamp(nextMood - 12, 0, 100);
      notes.push(kind === 'midnight' ? '拖過午夜，空著肚子硬撐' : '空著肚子睡，早上很虛');
    } else {
      nextStamina = clamp(nextStamina + 36, 0, 100);
      nextMood = clamp(nextMood + 8, 0, 100);
      nextHunger = clamp(nextHunger - 10, 0, 100);
      notes.push(kind === 'midnight' ? '在外面晃到半夜，人被送回雅房' : '睡了一覺');
    }
    var rentPaid = 0;
    if (state.day % 7 === 0) {
      if (nextMoney >= RULES.rent) {
        nextMoney -= RULES.rent;
        rentPaid = RULES.rent;
        notes.push('繳了房租 ' + formatMoney(RULES.rent));
      } else {
        state.money = nextMoney;
        gameOver('rent');
        return;
      }
    }
    if (nextStamina <= 0) { state.stamina = 0; gameOver('stamina'); return; }
    if (nextMood <= 0) { state.mood = 0; gameOver('mood'); return; }
    state.pendingSummary = {
      kind: kind,
      notes: notes,
      rentPaid: rentPaid,
      net: state.ledger.earn - state.ledger.spend - rentPaid,
      money: nextMoney,
      stamina: nextStamina,
      hunger: nextHunger,
      mood: nextMood,
      from: { money: state.ledger.money, stamina: state.ledger.stamina, hunger: state.ledger.hunger, mood: state.ledger.mood }
    };
    ui.card = null;
    ui.day = false;
    ui.confirm = null;
    ui.shift = null;
    if (window.PingShift) window.PingShift.stop();
    save();
    render();
  }
  function dismissSummary() {
    var next = state.pendingSummary;
    if (!next) return;
    state.money = next.money;
    state.stamina = next.stamina;
    state.hunger = next.hunger;
    state.mood = next.mood;
    state.day += 1;
    state.time = 7 * 60;
    state.jobsToday = { clerk: 0, courier: 0, farm: 0, port: 0 };
    state.ateToday = false;
    state.place = 'home';
    state.riding = 'walk';
    state.hot = false;
    state.hotKind = '';
    state.hotFuel = 0;
    state.carrying = false;
    if (state.side.box === 'carry') state.side.box = 'go';
    state.racing = false;
    if (state.wanted > 0) state.wanted -= 1;
    var spawn = window.PingWorld.spawn('home');
    state.pose = { x: spawn.x, z: spawn.z, ry: spawn.ry };
    state.forcePose = true;
    state.pendingSummary = null;
    state.ledger = freshLedger(state.money, state.stamina, state.hunger, state.mood);
    state.frac.unseen = 0;
    logLine('第 ' + state.day + ' 天，從雅房出門。');
    save();
    render();
  }
  function gameOver(reason) {
    var text = {
      rent: '第 ' + state.day + ' 天繳不出房租 ' + formatMoney(RULES.rent) + '。',
      stamina: '體力在過夜之後撐不住了。',
      mood: '心情在過夜之後掉光了。',
      quit: '你自己把這段日子按停。'
    };
    state.over = { reason: reason, text: text[reason] || '這段日子先停在這裡。' };
    state.pendingSummary = null;
    ui.screen = 'over';
    ui.card = null;
    ui.shift = null;
    ui.bust = null;
    ui.confirm = null;
    pushBoard();
    save();
    render();
  }

  function objectiveText() {
    var flags = state.flags;
    if (!flags.breakfast) return '任務：按住 W 出房門，金光點就是火車站旁的早餐。';
    if (!flags.firstjob) return '任務：去 8-12、檳榔園或漁港，上第一班工。';
    if (!flags.wheels) return '任務：到大順機車買一台，或騎走路邊沒鎖的車。';
    if (!flags.sawMarket) return '任務：去屏東夜市，找阿霞說話。';
    if (!flags.sawRiver) return '任務：沿著高屏溪找阿龍。';
    if (state.day % 7 === 0) return '今天結束要繳房租 ' + formatMoney(RULES.rent) + '。支線在「委託」。';
    var left = 7 - (state.day % 7);
    return '主線先告一段落。再過 ' + left + ' 天繳租。支線在「委託」。';
  }
  function missionLines() {
    var lines = [];
    var side = state.side;
    if (side.photo === 'go') lines.push('勝利星村：幫阿霞拍一張老屋。');
    if (side.deliver === 'have') lines.push('縣政府：把阿德的文件交出去。');
    if (side.ring === 'go') lines.push('夜市：套圈套中三個以上。');
    if (state.flags.metLong && side.race !== 'done') lines.push('高屏溪：騎著車跟阿龍比一場。');
    if (side.box === 'go') lines.push('巷口有一個封好的紙箱，送到溪邊。');
    if (side.box === 'carry') lines.push('紙箱在身上，送到高屏溪的交貨點。');
    if (!lines.length) lines.push('跟阿霞、阿德、春嬌、阿龍多說幾句，會有事找你。');
    return lines;
  }

  function jobBlock(id) {
    var job = JOBS[id];
    if (state.stamina < 12) return '太累了，先休息或吃點東西。';
    if ((state.jobsToday[id] || 0) >= 3) return '這種班今天已經三趟。';
    if (id === 'courier' && state.riding === 'walk' && !state.ownsScooter && !state.ownsCar) return '外送得先有機車或汽車。';
    if ((id === 'farm' || id === 'port') && isNight() && state.time >= 19 * 60) return '這時候收工了。';
    return '';
  }
  function payOf(job, score, total) {
    var ratio = total ? score / total : 0;
    return Math.round(job.pay * (0.6 + 0.6 * ratio));
  }

  function preview(id) {
    if (!state || state.over) return { ok: false, title: '……', reason: '' };
    var map = {
      sleep: function () { return { ok: true, title: '睡覺', detail: '結束今天' }; },
      rest: function () { return { ok: state.stamina < 100, title: '躺一下', detail: '回體力', reason: '體力是滿的' }; },
      breakfast: function () { return foodPreview('吃早餐', 35); },
      bus: function () { return { ok: state.money >= RULES.busFare, title: '公車', detail: formatMoney(RULES.busFare), reason: '車錢不夠' }; },
      train: function () { return { ok: state.money >= RULES.trainFare, title: '火車去高雄', detail: formatMoney(RULES.trainFare), reason: '票錢不夠' }; },
      'bike-shop': function () { return { ok: true, title: '大順機車', detail: '看看車' }; },
      gas: function () { return { ok: hasVehicle(), title: '南油加油', detail: '油箱', reason: '沒有車可加' }; },
      'car-shop': function () { return { ok: true, title: '大發汽車', detail: '看看車' }; },
      mart: function () { return { ok: true, title: '8-12 超商', detail: '買東西或上班' }; },
      photo: function () {
        if (state.side.photo === 'go') return { ok: true, title: '拍照', detail: '給阿霞' };
        return { ok: true, title: '拍老屋', detail: '留個紀念' };
      },
      sit: function () { return { ok: true, title: '坐一下', detail: '心情' }; },
      stroll: function () { return { ok: state.stamina >= 8, title: '散步', detail: '繞公園', reason: '太累了' }; },
      'drop-note': function () {
        return state.side.deliver === 'have'
          ? { ok: true, title: '交文件', detail: '給櫃檯' }
          : { ok: false, title: '縣政府', detail: '沒有文件', reason: '先去找大學的阿德' };
      },
      chun: function () { return { ok: true, title: '春嬌', detail: '六堆的故事' }; },
      ade: function () { return { ok: true, title: '阿德', detail: '大學' }; },
      canteen: function () { return foodPreview('自助餐', 45); },
      mall: function () { return { ok: true, title: '太平洋百貨', detail: '吃或逛' }; },
      meat: function () { return foodPreview('肉圓', 50); },
      tea: function () { return foodPreview('青草茶', 25); },
      ring: function () { return { ok: true, title: '套圈', detail: state.side.ring === 'go' ? '阿霞的委託' : '小遊戲' }; },
      xia: function () { return { ok: true, title: '阿霞', detail: '夜市' }; },
      gamble: function () {
        if (!isNight()) return { ok: false, title: '巷口茶室', detail: '晚上才開', reason: '白天鐵門是拉上的' };
        if (state.day * 1440 + state.time < state.gambleBan) return { ok: false, title: '巷口茶室', detail: '被請出去了', reason: '這陣子別再進去' };
        return { ok: state.money >= 100, title: '巷口茶室', detail: '一注 $100', reason: '沒有 $100' };
      },
      farm: function () { return jobPreview('farm'); },
      port: function () { return jobPreview('port'); },
      long: function () { return { ok: true, title: '阿龍', detail: '溪邊' }; },
      race: function () {
        if (!state.flags.metLong) return { ok: false, title: '比賽', detail: '先找阿龍', reason: '阿龍還沒點頭' };
        if (state.riding === 'walk') return { ok: false, title: '比賽', detail: '要騎著車', reason: '先上車' };
        if (state.racing) return { ok: true, title: '比賽中', detail: '跟著光球' };
        return { ok: true, title: '開始比賽', detail: state.side.race === 'done' ? '再比一場' : '第一場' };
      },
      'box-drop': function () {
        return state.carrying
          ? { ok: true, title: '交出紙箱', detail: '封好的' }
          : { ok: false, title: '交貨點', detail: '手上沒箱子', reason: '先去巷口拿紙箱' };
      },
      'box-take': function () {
        if (state.side.box !== 'go') return { ok: false, title: '紙箱', detail: '還沒有人託', reason: '先跟阿龍說話' };
        if (state.carrying) return { ok: true, title: '紙箱', detail: '已經在身上' };
        return { ok: true, title: '拿起紙箱', detail: '別打開' };
      },
      'hot-1': function () { return hotPreview('機車'); },
      'hot-2': function () { return hotPreview('機車'); },
      'hot-3': function () { return hotPreview('機車'); },
      'hot-car': function () { return hotPreview('汽車'); },
      shove: function () { return { ok: true, title: '推開', detail: '會記一筆' }; }
    };
    var fn = map[id];
    if (!fn) return { ok: false, title: '……', reason: '' };
    var info = fn();
    info.ok = !!info.ok;
    return info;
  }
  function foodPreview(title, cost) {
    if (state.money < cost) return { ok: false, title: title, detail: formatMoney(cost), reason: '錢不夠' };
    if (state.hunger >= 100) return { ok: false, title: title, detail: '吃不下', reason: '肚子是滿的' };
    return { ok: true, title: title, detail: formatMoney(cost) };
  }
  function jobPreview(id) {
    var why = jobBlock(id);
    return { ok: !why, title: JOBS[id].name, detail: '小遊戲', reason: why };
  }
  function hotPreview(label) {
    return { ok: true, title: '騎走' + label, detail: '會有通緝星' };
  }

  function perform(id) {
    if (!playing()) return;
    var info = preview(id);
    if (!info.ok) { if (info.reason) toast(info.reason); return; }
    if (id === 'sleep') { ui.confirm = 'sleep'; render(); return; }
    if (id === 'rest') return doRest();
    if (id === 'breakfast') return eat(35, 28, 4, 6, 20, '早餐', 'breakfast');
    if (id === 'bus') return openCard('bus');
    if (id === 'train') return openCard('train');
    if (id === 'bike-shop') return openCard('bike');
    if (id === 'gas') return openCard('gas');
    if (id === 'car-shop') return openCard('car');
    if (id === 'mart') return openCard('mart');
    if (id === 'photo') return doPhoto();
    if (id === 'sit') return doSit();
    if (id === 'stroll') return doStroll();
    if (id === 'drop-note') return doDropNote();
    if (id === 'chun') return openCard('chun');
    if (id === 'ade') return openCard('ade');
    if (id === 'canteen') return eat(45, 30, 4, 8, 25, '自助餐');
    if (id === 'mall') return openCard('mall');
    if (id === 'meat') return eat(50, 26, 6, 4, 20, '肉圓');
    if (id === 'tea') return eat(25, 8, 12, 2, 15, '青草茶');
    if (id === 'ring') return startRing();
    if (id === 'xia') return openCard('xia');
    if (id === 'gamble') return openCard('gamble');
    if (id === 'farm') return startJob('farm');
    if (id === 'port') return startJob('port');
    if (id === 'long') return openCard('long');
    if (id === 'race') return startRace();
    if (id === 'box-drop') return dropBox();
    if (id === 'box-take') return takeBox();
    if (id === 'hot-1' || id === 'hot-2' || id === 'hot-3') return steal(id, 'scooter');
    if (id === 'hot-car') return steal(id, 'car');
    if (id === 'shove') return doShove();
  }

  function openCard(id) {
    ui.card = id;
    render();
  }
  function eat(cost, hunger, mood, stamina, mins, label, flag) {
    if (addMinutes(mins)) return;
    spend(cost, label + ' ' + formatMoney(cost));
    bumpStat('hunger', hunger);
    bumpStat('mood', mood);
    bumpStat('stamina', stamina);
    state.ateToday = true;
    if (flag === 'breakfast') state.flags.breakfast = true;
    toast(label + '吃完了');
    save();
    render();
  }
  function doRest() {
    if (addMinutes(40)) return;
    bumpStat('stamina', 22);
    bumpStat('mood', 4);
    note('在雅房躺了一下');
    toast('躺了一下');
    save();
    render();
  }
  function doSit() {
    if (addMinutes(30)) return;
    bumpStat('mood', 12);
    bumpStat('stamina', 4);
    toast('在千禧公園坐了一會兒');
    save();
    render();
  }
  function doStroll() {
    if (addMinutes(40)) return;
    bumpStat('mood', 14);
    bumpStat('stamina', -6);
    toast('公園走完一圈');
    save();
    render();
  }
  function doPhoto() {
    if (addMinutes(20)) return;
    bumpStat('mood', 8);
    if (state.side.photo === 'go') {
      state.side.photo = 'done';
      state.fame = clamp(state.fame + 8, 0, 100);
      gain(200, '照片交給阿霞，拿到 $200');
      toast('拍好了，回去找阿霞');
    } else {
      state.fame = clamp(state.fame + 1, 0, 100);
      toast('拍了一張老屋');
    }
    save();
    render();
  }
  function doDropNote() {
    if (addMinutes(15)) return;
    state.side.deliver = 'done';
    state.rel.ade = clamp(state.rel.ade + 1, 0, 5);
    state.fame = clamp(state.fame + 4, 0, 100);
    gain(250, '文件送到縣政府，阿德給了 $250');
    toast('文件交出去了');
    save();
    render();
  }
  function doShove() {
    if (window.PingWorld) window.PingWorld.shove();
    if (addMinutes(2)) return;
    setStars(state.wanted + 1);
    bumpStat('mood', 2);
    state.street = clamp(state.street + 1, 0, 100);
    toast('推了人一把，通緝上升');
    pop('通緝 +1', 'bad');
    save();
    render();
  }
  function steal(id, kind) {
    if (state.hidden.indexOf(id) >= 0) { toast('這台已經不在了'); return; }
    state.hidden.push(id);
    if (window.PingWorld) {
      appliedHide[id] = true;
      window.PingWorld.hideProp(id);
    }
    state.hot = true;
    state.hotKind = kind;
    state.hotFuel = 40;
    state.riding = kind;
    state.flags.wheels = true;
    setStars(state.wanted + (kind === 'car' ? 2 : 1));
    toast(kind === 'car' ? '騎上別人的汽車' : '騎上別人的機車');
    pop('通緝 +' + (kind === 'car' ? 2 : 1), 'bad');
    save();
    render();
  }
  function takeBox() {
    state.carrying = true;
    state.side.box = 'carry';
    if (window.PingWorld) window.PingWorld.setCarry(true);
    toast('紙箱提上了，騎起來會慢一點');
    save();
    render();
  }
  function dropBox() {
    state.carrying = false;
    state.side.box = 'done';
    if (window.PingWorld) window.PingWorld.setCarry(false);
    state.street = clamp(state.street + 3, 0, 100);
    bumpStat('mood', 4);
    gain(700, '紙箱送到溪邊，拿到 $700');
    toast('交貨了');
    if (addMinutes(10)) return;
    save();
    render();
  }
  function startRace() {
    if (state.racing) { toast('光球還在前面'); return; }
    state.racing = true;
    raceSent = false;
    toast('跟著綠色光球，跑完五個點');
    save();
    render();
  }
  function rideBus(place) {
    if (state.money < RULES.busFare) { toast('車錢不夠'); return; }
    if (place === state.place) { toast('人已經在這附近'); return; }
    spend(RULES.busFare, '公車到' + placeLabel(place));
    if (addMinutes(18)) return;
    state.place = place;
    var spawn = window.PingWorld.spawn(place);
    state.pose = { x: spawn.x, z: spawn.z, ry: spawn.ry };
    state.forcePose = true;
    if (place === 'market') state.flags.sawMarket = true;
    if (place === 'river') state.flags.sawRiver = true;
    toast('公車到了');
    ui.card = null;
    save();
    render();
  }
  function rideTrain() {
    if (state.money < RULES.trainFare) { toast('票錢不夠'); return; }
    spend(RULES.trainFare, '火車去高雄晃一圈');
    bumpStat('mood', 10);
    bumpStat('hunger', -8);
    if (addMinutes(90)) return;
    var spawn = window.PingWorld.spawn('station');
    state.place = 'station';
    state.pose = { x: spawn.x, z: spawn.z, ry: spawn.ry };
    state.forcePose = true;
    toast('高雄晃完，人回到屏東火車站');
    ui.card = null;
    save();
    render();
  }
  function buyScooter() {
    if (state.ownsScooter) { toast('已經有機車了'); return; }
    if (state.money < RULES.scooter) { toast('錢不夠'); return; }
    spend(RULES.scooter, '大順機車買了一台');
    state.ownsScooter = true;
    state.flags.wheels = true;
    state.fuel = Math.max(state.fuel, 40);
    toast('機車是你的了，油箱裡有一些油');
    save();
    render();
  }
  function buyUpgrade(kind) {
    if (!state.ownsScooter) { toast('先有自己的機車'); return; }
    var cost = kind === 'speed' ? RULES.speedCost : RULES.tankCost;
    if (state.upgrades[kind]) { toast('這個已經裝過'); return; }
    if (state.money < cost) { toast('錢不夠'); return; }
    spend(cost, kind === 'speed' ? '機車加速' : '加大油箱');
    state.upgrades[kind] = 1;
    toast(kind === 'speed' ? '騎起來比較衝' : '油箱變大了');
    save();
    render();
  }
  function buyCar() {
    if (state.ownsCar) { toast('已經有汽車了'); return; }
    if (state.money < RULES.car) { toast('錢不夠'); return; }
    spend(RULES.car, '大發汽車交車');
    state.ownsCar = true;
    state.flags.wheels = true;
    state.fuel = Math.max(state.fuel, 25);
    toast('汽車是你的了');
    save();
    render();
  }
  function buyFuel(mode) {
    var targetHot = state.hot && state.riding !== 'walk';
    if (!targetHot && !state.ownsScooter && !state.ownsCar) { toast('沒有自己的車可加'); return; }
    var cap = targetHot ? 40 : fuelMax();
    var now = targetHot ? state.hotFuel : state.fuel;
    if (now >= cap) { toast('油是滿的'); return; }
    if (mode === 'small') {
      if (state.money < RULES.gasSmall) { toast('錢不夠'); return; }
      spend(RULES.gasSmall, '南油加了一點');
      if (targetHot) state.hotFuel = clamp(state.hotFuel + RULES.gasSmallAdd, 0, 40);
      else state.fuel = clamp(state.fuel + RULES.gasSmallAdd, 0, fuelMax());
    } else {
      if (state.money < RULES.gasFull) { toast('錢不夠'); return; }
      spend(RULES.gasFull, '南油加滿');
      if (targetHot) state.hotFuel = 40;
      else state.fuel = fuelMax();
    }
    toast('油加好了');
    save();
    render();
  }
  function shoplift(which) {
    if (state.shoplift[which] === state.day) { toast('這裡今天已經被你拿過'); return; }
    state.shoplift[which] = state.day;
    var amount = which === 'mall' ? 280 : 160;
    setStars(state.wanted + 2);
    state.street = clamp(state.street + 1, 0, 100);
    bumpStat('mood', -2);
    gain(amount, which === 'mall' ? '百貨順手拿了東西' : '超商順手拿了東西');
    toast('被看見了，通緝上升');
    pop('通緝 +2', 'bad');
    ui.card = null;
    save();
    render();
  }
  function talk(who) {
    state.rel[who] = clamp((state.rel[who] || 0) + 1, 0, 5);
    bumpStat('mood', 3);
    if (addMinutes(8)) return;
    if (who === 'xia') {
      if (state.side.photo !== 'done' && state.side.photo !== 'go' && state.rel.xia >= 1) state.side.photo = 'go';
      if (state.side.photo === 'done' && state.side.ring !== 'done' && state.side.ring !== 'go') state.side.ring = 'go';
      toast('跟阿霞說了一會兒');
    } else if (who === 'ade') {
      if (state.side.deliver !== 'done' && state.side.deliver !== 'have' && state.rel.ade >= 1) {
        state.side.deliver = 'have';
        toast('阿德把文件塞給你');
      } else toast('跟阿德說了一會兒');
    } else if (who === 'chun') {
      state.fame = clamp(state.fame + 2, 0, 100);
      toast('春嬌講了一段六堆的事');
    } else if (who === 'long') {
      state.flags.metLong = true;
      if ((state.side.race === 'done' || state.street >= 8) && state.side.box !== 'go' && state.side.box !== 'carry') {
        state.side.box = 'go';
        toast('阿龍要你送一個封好的紙箱');
      } else toast('阿龍點點頭');
    }
    save();
    render();
  }
  function gamble(cheat) {
    if (state.money < 100) { toast('沒有 $100'); return; }
    var player = 1 + Math.floor(Math.random() * 13);
    var house = 1 + Math.floor(Math.random() * 13);
    if (cheat) {
      player = 13;
      house = 1;
      setStars(state.wanted + 2);
      state.street = clamp(state.street + 1, 0, 100);
      state.gambleBan = state.day * 1440 + state.time + 180;
      gain(100, '茶室出老千，被趕出來');
      toast('贏了，也被請出茶室');
      pop('通緝 +2', 'bad');
      ui.card = null;
      save();
      render();
      return;
    }
    if (player > house) gain(100, '茶室贏了一把');
    else if (player < house) spend(100, '茶室輸了一把');
    else note('茶室這把平手');
    ui.gambleText = '你 ' + player + ' ，對方 ' + house + (player === house ? '，平手' : player > house ? '，你贏' : '，你輸');
    toast(ui.gambleText);
    save();
    render();
  }

  function startJob(id) {
    var why = jobBlock(id);
    if (why) { toast(why); return; }
    ui.card = null;
    ui.shift = id;
    render();
    window.PingShift.start(id, function (score, total) { finishJob(id, score, total); }, function () {
      ui.shift = null;
      toast('這班不算');
      note(JOBS[id].name + '放棄了');
      save();
      render();
    });
  }
  function finishJob(id, score, total) {
    if (!state || state.over || state.pendingSummary) { ui.shift = null; return; }
    ui.shift = null;
    var job = JOBS[id];
    var pay = payOf(job, score, total);
    state.jobsToday[id] = (state.jobsToday[id] || 0) + 1;
    state.jobCounts[id] = (state.jobCounts[id] || 0) + 1;
    state.flags.firstjob = true;
    state.fame = clamp(state.fame + 1, 0, 100);
    bumpStat('stamina', -job.stamina);
    bumpStat('mood', score >= total ? 4 : -2);
    gain(pay, job.name + ' 到手 ' + formatMoney(pay) + '（' + score + '/' + total + '）');
    toast(job.name + ' 下班，' + formatMoney(pay));
    if (addMinutes(job.minutes)) return;
    save();
    render();
  }
  function startRing() {
    ui.card = null;
    ui.shift = 'ring';
    render();
    window.PingShift.start('ring', function (score, total) {
      ui.shift = null;
      if (!state || state.over || state.pendingSummary) return;
      var prize = Math.round(120 * (total ? score / total : 0));
      if (prize > 0) gain(prize, '套圈拿到 ' + formatMoney(prize));
      bumpStat('mood', 6);
      if (state.side.ring === 'go' && score >= 3) {
        state.side.ring = 'done';
        state.fame = clamp(state.fame + 4, 0, 100);
        toast('套給阿霞看，她請了你');
      } else toast('套完了，中了 ' + score + ' 個');
      if (addMinutes(15)) return;
      save();
      render();
    }, function () {
      ui.shift = null;
      toast('圈沒套完');
      render();
    });
  }

  function mountToggle() {
    if (!playing()) return;
    if (state.riding !== 'walk') {
      var wasHot = state.hot;
      var wasRacing = state.racing;
      state.riding = 'walk';
      state.racing = false;
      if (wasHot) {
        state.hot = false;
        state.hotKind = '';
        state.hotFuel = 0;
        toast(wasRacing ? '棄賽了，車也留在路邊' : '人下來了，那台車留在路邊');
      } else toast(wasRacing ? '下車，這場不算' : '下車了');
      save();
      render();
      return;
    }
    if (state.ownsCar && state.fuel > 0) state.riding = 'car';
    else if (state.ownsScooter && state.fuel > 0) state.riding = 'scooter';
    else if ((state.ownsCar || state.ownsScooter) && state.fuel <= 0) { toast('油箱是空的，去南油'); return; }
    else { toast('還沒有自己的車'); return; }
    toast(state.riding === 'car' ? '坐進汽車' : '坐上機車');
    save();
    render();
  }

  function noteWalk(units) {
    if (!playing()) return;
    var mins = units / 1.6;
    state.time += mins;
    state.frac.hunger += mins * 0.09 + units * 0.012;
    while (state.frac.hunger >= 1) {
      state.hunger = Math.max(0, state.hunger - 1);
      state.frac.hunger -= 1;
    }
    var rate = state.riding === 'car' ? 0.006 : state.riding === 'scooter' ? 0.01 : 0.02;
    state.frac.stamina += units * rate;
    while (state.frac.stamina >= 1) {
      state.stamina = Math.max(0, state.stamina - 1);
      state.frac.stamina -= 1;
    }
    burnFuel(units);
    if (state.wanted > 0 && window.PingWorld && window.PingWorld.policeDistance() > 20) state.frac.unseen += mins;
    else state.frac.unseen = 0;
    if (state.place === 'home' && state.wanted > 0) state.frac.unseen += mins * 2;
    if (state.frac.unseen >= 50 && state.wanted > 0) {
      setStars(state.wanted - 1);
      state.frac.unseen = 0;
      toast(state.wanted ? '星星少了一顆' : '通緝清掉了');
      pop(state.wanted ? '通緝 -1' : '通緝清掉', 'good');
    }
    state.frac.event -= units;
    if (state.frac.event <= 0) {
      state.frac.event = 90 + Math.random() * 40;
      randomEvent();
    }
    if (state.hunger <= 0) clinic();
    if (state.stamina <= 14 && !stamWarned) { stamWarned = true; toast('腿開始沉了'); }
    if (state.stamina > 20) stamWarned = false;
    rememberPose();
    if (state.time >= 24 * 60) { endDay('midnight'); return; }
    save();
    paintHud();
    if (window.PingWorld) {
      window.PingWorld.setClock(state.time);
      window.PingWorld.setTired(state.stamina <= 14);
    }
  }
  function burnFuel(units) {
    if (state.riding === 'walk') return;
    var per = state.riding === 'car' ? 0.09 : 0.06;
    state.frac.fuel += units * per;
    var whole = Math.floor(state.frac.fuel);
    if (whole <= 0) return;
    state.frac.fuel -= whole;
    if (state.hot) {
      state.hotFuel = Math.max(0, state.hotFuel - whole);
      if (state.hotFuel <= 0) {
        state.riding = 'walk';
        state.hot = false;
        state.racing = false;
        toast('這台車沒油了，人被留在路邊');
        if (window.PingWorld) window.PingWorld.setRide('walk', speedMul());
      }
    } else {
      var before = state.fuel;
      state.fuel = Math.max(0, state.fuel - whole);
      if (before > 0 && state.fuel <= 0) {
        state.riding = 'walk';
        state.racing = false;
        toast('油用完了');
        if (window.PingWorld) window.PingWorld.setRide('walk', speedMul());
      }
    }
  }
  function randomEvent() {
    var roll = Math.random();
    if (roll < 0.25) {
      bumpStat('mood', -3);
      toast('忽然下雨，心情濕了一點');
    } else if (roll < 0.5) {
      bumpStat('hunger', 8);
      bumpStat('mood', 4);
      toast('路人請了一杯青草茶');
      pop('青草茶', 'good');
    } else if (roll < 0.7 && state.wanted === 0) {
      gain(30, '路上撿到零錢');
      toast('撿到 $30');
    } else if (roll < 0.85 && state.riding !== 'walk') {
      if (state.hot) state.hotFuel = Math.max(0, state.hotFuel - 6);
      else state.fuel = Math.max(0, state.fuel - 6);
      toast('壓到小石子，油漏了一點');
    } else if (state.wanted >= 2) {
      bumpStat('mood', -2);
      toast('路口有人揮手，你繞了過去');
    }
  }
  function noteDistrict(place) {
    if (!playing()) return;
    state.place = place;
    if (place === 'market') state.flags.sawMarket = true;
    if (place === 'river') state.flags.sawRiver = true;
    var float = $('place-float');
    if (float && place !== shownPlace) {
      shownPlace = place;
      float.hidden = false;
      float.textContent = placeLabel(place);
      window.clearTimeout(placeTimer);
      placeTimer = window.setTimeout(function () { float.hidden = true; }, 1600);
    }
    paintHud();
  }
  function arrive(place) {
    if (!state) return;
    state.place = place;
    rememberPose();
    paintHud();
  }
  function noteRedLight() {
    if (!playing() || state.riding === 'walk') return;
    if (state.fame >= 30 && !state.flags.warned) {
      state.flags.warned = true;
      toast('信用夠，這次闖紅燈先警告');
      return;
    }
    setStars(state.wanted + 1);
    state.fame = clamp(state.fame - 1, 0, 100);
    toast('闖紅燈，通緝上升');
    pop('紅燈', 'bad');
    paintHud();
    save();
  }
  function noteCamera() {
    if (!playing()) return;
    if (state.fame >= 30 && !state.flags.warned) {
      state.flags.warned = true;
      toast('測速照相閃了一下，這次先警告');
      return;
    }
    setStars(state.wanted + 1);
    toast('超速被拍到');
    pop('超速', 'bad');
    paintHud();
    save();
  }
  function noteBump() {
    if (!playing()) return;
    var now = Date.now();
    if (now - bumpAt < 2500) return;
    bumpAt = now;
    bumpStat('mood', -2);
    toast('跟別的車擦到了');
  }
  function policeTouch(dist) {
    if (!playing() || state.wanted <= 0) { heat = 0; return; }
    var flag = $('heat-flag');
    if (flag) flag.hidden = !(dist < 10);
    if (dist < 2.3) heat += 0.25;
    else heat = Math.max(0, heat - 0.2);
    if (heat >= 1.5) bust();
  }
  function bust() {
    if (!state || state.over || ui.bust) return;
    heat = 0;
    var stars = state.wanted;
    var fine = RULES.fine[stars] || 400;
    var paid = false;
    var body;
    if (stars >= 3) {
      if (state.money >= fine) { spend(fine); paid = true; }
      var jump = state.time < 7 * 60 ? (7 * 60 - state.time) : (24 * 60 - state.time + 7 * 60);
      state.time += jump;
      while (state.time >= 24 * 60) {
        state.time -= 24 * 60;
        if (state.day % 7 === 0) {
          if (state.money >= RULES.rent) spend(RULES.rent, '拘留隔夜，房租還是扣了');
          else { setStars(0); gameOver('rent'); return; }
        }
        state.day += 1;
      }
      state.hunger = clamp(state.hunger - 18, 0, 100);
      bumpStat('stamina', -8);
      body = '通緝 ' + stars + ' 顆星。在派出所喝茶、抄資料，待到早上。' + (paid ? '罰了 ' + formatMoney(fine) + '。' : '口袋空的，罰單先掛著。');
    } else if (state.money >= fine) {
      spend(fine, '派出所罰了 ' + formatMoney(fine));
      paid = true;
      body = '通緝 ' + stars + ' 顆星。罰了 ' + formatMoney(fine) + '，人放了。';
    } else {
      if (addMinutes(4 * 60)) {
        setStars(0);
        return;
      }
      body = '錢不夠繳罰單，在裡面喝茶四個小時，看牆上的海報。';
    }
    if (state.carrying || state.side.box === 'carry') {
      state.carrying = false;
      state.side.box = 'go';
      body += '紙箱被扣下，以後還能再送。';
    }
    state.racing = false;
    if (state.hot) { state.hot = false; state.hotKind = ''; state.hotFuel = 0; state.riding = 'walk'; }
    setStars(0);
    bumpStat('mood', -12);
    state.fame = clamp(state.fame - 4, 0, 100);
    ui.bust = { title: '派出所', body: body };
    ui.card = null;
    var flag = $('heat-flag');
    if (flag) flag.hidden = true;
    save();
    render();
  }
  function noteCheck(at, total) {
    if (!playing() || !state.racing) return;
    if (state.riding === 'walk') {
      state.racing = false;
      toast('人下車了，這場不算');
      save();
      render();
      return;
    }
    if (at < total) {
      toast('檢查點 ' + at + ' / ' + total);
      pop(at + '/' + total, 'good');
      return;
    }
    state.racing = false;
    var first = state.side.race !== 'done';
    state.side.race = 'done';
    state.street = clamp(state.street + (first ? 2 : 1), 0, 100);
    bumpStat('mood', 8);
    gain(first ? 500 : 200, first ? '溪邊第一場比賽 $500' : '溪邊又比了一場');
    toast(first ? '第一場跑完了' : '又跑完一場');
    if ((state.street >= 8 || first) && state.side.box !== 'carry' && state.side.box !== 'go') state.side.box = 'go';
    save();
    render();
  }

  function placeLabel(id) {
    return window.PingWorld ? window.PingWorld.placeName(id) : id;
  }
  function peopleText() {
    return '阿霞 ' + state.rel.xia + '　阿德 ' + state.rel.ade + '　春嬌 ' + state.rel.chun + '　阿龍 ' + state.rel.long;
  }
  function rideLabel() {
    if (state.riding === 'car') return (state.hot ? '別人的汽車' : '汽車') + ' · 油 ' + Math.round(state.hot ? state.hotFuel : state.fuel);
    if (state.riding === 'scooter') return (state.hot ? '別人的機車' : '機車') + ' · 油 ' + Math.round(state.hot ? state.hotFuel : state.fuel);
    if (state.ownsCar || state.ownsScooter) return '車停著 · 油 ' + Math.round(state.fuel);
    return '';
  }
  function paintHud() {
    if (!state) return;
    $('hud-name').textContent = state.name;
    $('hud-day').textContent = '第 ' + state.day + ' 天';
    $('hud-time').textContent = formatClock(state.time);
    var ride = $('hud-ride');
    var rideText = rideLabel();
    ride.hidden = !rideText;
    ride.textContent = rideText;
    var stars = '';
    for (var i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    var wanted = $('hud-wanted');
    wanted.textContent = state.wanted ? stars : '';
    wanted.hidden = !state.wanted;
    $('hud-money').textContent = formatMoney(state.money);
    $('hud-stamina').textContent = String(Math.round(state.stamina));
    $('hud-hunger').textContent = String(Math.round(state.hunger));
    $('hud-mood').textContent = String(Math.round(state.mood));
    setBar('stamina', state.stamina);
    setBar('hunger', state.hunger);
    setBar('mood', state.mood);
    $('hud-rep').textContent = '信用 ' + state.fame + '　路子 ' + state.street + (state.carrying ? '　提著紙箱' : '');
    $('objective').textContent = objectiveText();
    var period = periodOf(state.time);
    var place = state.place || 'road';
    var pack = COPY[place] || COPY.road;
    $('place-name').textContent = placeLabel(place);
    $('place-desc').textContent = pack[period] || pack.afternoon;
    $('place-pill').textContent = '屏東';
    var mount = $('btn-mount');
    if (mount) mount.textContent = state.riding === 'walk' ? '上車' : '下車';
    paintRent();
    var hint = $('hint');
    if (hint) hint.hidden = !state.hintOn;
  }
  function setBar(name, value) {
    var bar = $(name + '-bar');
    var meter = $(name + '-meter');
    if (!bar || !meter) return;
    var n = clamp(value, 0, 100);
    bar.style.width = n + '%';
    meter.setAttribute('aria-valuenow', String(Math.round(n)));
    bar.classList.toggle('low', n < 35);
    bar.classList.toggle('critical', n < 15);
    if (name === 'mood') bar.classList.toggle('ok', n >= 35);
  }
  function paintRent() {
    var track = $('rent-track');
    var label = $('rent-label');
    if (!track || !label) return;
    track.textContent = '';
    var into = ((state.day - 1) % 7) + 1;
    for (var i = 1; i <= 7; i += 1) {
      var dot = document.createElement('i');
      dot.className = 'rent-dot' + (i < into ? ' done' : i === into ? ' today' : '');
      if (i === 7) dot.className += ' due';
      track.appendChild(dot);
    }
    label.className = 'rent-label' + (into >= 6 ? ' soon' : '') + (into === 7 ? ' due' : '');
    label.textContent = into === 7 ? '今天結束繳租 ' + formatMoney(RULES.rent) : '第 7 天繳租 ' + formatMoney(RULES.rent);
  }

  function button(label, action, extra) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'btn btn-ghost';
    el.textContent = label;
    el.dataset.action = action;
    if (extra) Object.keys(extra).forEach(function (key) { el.dataset[key] = extra[key]; });
    return el;
  }
  function fillCard() {
    var title = $('card-title');
    var body = $('card-body');
    var box = $('card-actions');
    if (!title || !box || !state) return;
    box.textContent = '';
    var card = ui.card;
    if (card === 'bus') {
      title.textContent = '公車';
      body.textContent = '一趟 ' + formatMoney(RULES.busFare) + '，人會直接到那個地方。';
      BUS.forEach(function (stop) {
        box.appendChild(button(stop.name, 'bus-go', { place: stop.place }));
      });
    } else if (card === 'train') {
      title.textContent = '往高雄';
      body.textContent = '買一張 ' + formatMoney(RULES.trainFare) + ' 的票，去高雄晃九十分鐘再回到屏東火車站。屏東這張地圖還是你的。';
      box.appendChild(button('上車', 'train-go'));
    } else if (card === 'bike') {
      title.textContent = '大順機車';
      body.textContent = state.ownsScooter ? '車已經在你名下。還可以加零件。' : '機車 ' + formatMoney(RULES.scooter) + '，油箱裡附一些油。';
      if (!state.ownsScooter) box.appendChild(button('買機車 ' + formatMoney(RULES.scooter), 'buy-scooter'));
      box.appendChild(button(state.upgrades.speed ? '加速已裝' : '加速 ' + formatMoney(RULES.speedCost), 'buy-speed'));
      box.appendChild(button(state.upgrades.tank ? '油箱已加大' : '加大油箱 ' + formatMoney(RULES.tankCost), 'buy-tank'));
    } else if (card === 'car') {
      title.textContent = '大發汽車';
      body.textContent = state.ownsCar ? '鑰匙在你這裡。' : '一輛 ' + formatMoney(RULES.car) + '。有油的時候，上車會優先開汽車。';
      if (!state.ownsCar) box.appendChild(button('買汽車 ' + formatMoney(RULES.car), 'buy-car'));
    } else if (card === 'gas') {
      title.textContent = '南油加油站';
      var now = state.hot && state.riding !== 'walk' ? state.hotFuel : state.fuel;
      var cap = state.hot && state.riding !== 'walk' ? 40 : fuelMax();
      body.textContent = '現在油量 ' + Math.round(now) + ' / ' + cap + '。小桶 ' + formatMoney(RULES.gasSmall) + '，加滿 ' + formatMoney(RULES.gasFull) + '。';
      box.appendChild(button('加一點', 'fuel-small'));
      box.appendChild(button('加滿', 'fuel-full'));
    } else if (card === 'mart') {
      title.textContent = '8-12 超商';
      body.textContent = '飯糰 ' + formatMoney(40) + '。店員和外送都從這裡出發，外送得有車。每種一天三班。';
      box.appendChild(button('買飯糰 $40', 'buy-rice'));
      box.appendChild(button('上店員的班', 'job-clerk'));
      box.appendChild(button('跑外送', 'job-courier'));
      if (state.shoplift.mart !== state.day) box.appendChild(button('順手拿東西', 'shoplift-mart'));
    } else if (card === 'mall') {
      title.textContent = '太平洋百貨';
      body.textContent = '餐廳一餐 ' + formatMoney(80) + '，吃得比較飽。';
      box.appendChild(button('吃一餐 $80', 'buy-mall'));
      if (state.shoplift.mall !== state.day) box.appendChild(button('順手拿東西', 'shoplift-mall'));
    } else if (card === 'xia') {
      title.textContent = '阿霞';
      body.textContent = xiaLine();
      box.appendChild(button('再聊一下', 'talk-xia'));
    } else if (card === 'ade') {
      title.textContent = '阿德';
      body.textContent = adeLine();
      box.appendChild(button('再聊一下', 'talk-ade'));
    } else if (card === 'chun') {
      title.textContent = '春嬌';
      body.textContent = '春嬌坐在六堆園區門口。關係 ' + state.rel.chun + '。她講客家聚落的事，聽完信用會高一點。';
      box.appendChild(button('聽一段', 'talk-chun'));
    } else if (card === 'long') {
      title.textContent = '阿龍';
      body.textContent = longLine();
      box.appendChild(button('說話', 'talk-long'));
    } else if (card === 'gamble') {
      title.textContent = '巷口茶室';
      body.textContent = (ui.gambleText || '各抽一張牌，點數大的贏 $100。') + ' 路子 ' + state.street + '。出老千會贏，也會被趕出去。';
      box.appendChild(button('下注 $100', 'gamble-bet'));
      box.appendChild(button('出老千', 'gamble-cheat'));
    } else if (card === 'missions') {
      title.textContent = '委託';
      body.textContent = missionLines().join(' ');
      missionLines().forEach(function (line) {
        var p = document.createElement('p');
        p.textContent = line;
        box.appendChild(p);
      });
      body.textContent = '做到會有錢、信用或路子。';
    }
  }
  function xiaLine() {
    if (state.side.photo === 'go') return '阿霞說：勝利星村那排老屋，拍一張給我。';
    if (state.side.ring === 'go') return '阿霞指著套圈攤：套中幾個，我請你喝茶。';
    if (state.rel.xia === 0) return '阿霞在攤子後面擦杯子。「第一次來？肉圓在左邊。」';
    return '阿霞跟你點頭。關係 ' + state.rel.xia + '。';
  }
  function adeLine() {
    if (state.side.deliver === 'have') return '阿德揮揮手：文件送到縣政府門口就好。';
    if (state.side.deliver === 'done') return '阿德終於抬起頭。「謝了，下次自助餐我請。」';
    return '阿德抱著一疊紙。「縣政府那份，我走不開。」關係 ' + state.rel.ade + '。';
  }
  function longLine() {
    if (!state.flags.metLong) return '阿龍靠在高屏溪的欄杆上。「會騎車的話，溪邊可以比一場。」';
    if (state.side.box === 'go' || state.side.box === 'carry') return '阿龍說紙箱封好了，送到溪邊另一個光點，別問裡面。';
    if (state.side.race !== 'done') return '阿龍等你騎上車，去旁邊的比賽光點。';
    return '阿龍看了你一眼。路子 ' + state.street + '。再跟他說話，也許還有紙箱。';
  }

  function renderActions() {
    var box = $('actions');
    if (!box) return;
    box.textContent = '';
    [
      ['sleep', '睡覺'], ['rest', '躺一下'], ['breakfast', '早餐'], ['mart', '8-12'],
      ['bike-shop', '大順機車'], ['gas', '南油'], ['car-shop', '大發汽車'], ['bus', '公車'],
      ['train', '火車去高雄'], ['farm', '檳榔園'], ['port', '漁港'], ['xia', '找阿霞'],
      ['meat', '肉圓'], ['tea', '青草茶'], ['ring', '套圈'], ['gamble', '茶室'],
      ['ade', '找阿德'], ['chun', '找春嬌'], ['long', '找阿龍'], ['photo', '拍照'],
      ['mall', '百貨'], ['canteen', '自助餐']
    ].forEach(function (item) {
      var info = preview(item[0]);
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'btn btn-ghost';
      el.dataset.action = 'fallback';
      el.dataset.pick = item[0];
      el.textContent = info.title || item[1];
      el.disabled = !info.ok;
      box.appendChild(el);
    });
  }
  function renderDay() {
    $('people').textContent = peopleText();
    var lines = $('mini-lines');
    lines.textContent = '';
    missionLines().forEach(function (text) {
      var p = document.createElement('p');
      p.textContent = text;
      lines.appendChild(p);
    });
    var log = $('log');
    log.textContent = '';
    (state.log || []).forEach(function (text) {
      var li = document.createElement('li');
      li.textContent = text;
      log.appendChild(li);
    });
  }
  function renderBoard() {
    var board = loadBoard();
    var empty = $('board-empty');
    var list = $('board-list');
    list.textContent = '';
    empty.hidden = board.length > 0;
    board.forEach(function (row) {
      var li = document.createElement('li');
      li.textContent = row.name + '　' + formatMoney(row.money) + '　第 ' + row.day + ' 天';
      list.appendChild(li);
    });
  }
  function renderSummary() {
    var next = state.pendingSummary;
    $('summary-kicker').textContent = next.kind === 'midnight' ? '拖過午夜' : '一天結束';
    var net = $('summary-net');
    net.textContent = (next.net >= 0 ? '+' : '') + formatMoney(next.net);
    $('summary-money').textContent = '醒來存款 ' + formatMoney(next.money);
    var stats = $('summary-stats');
    stats.textContent = '';
    [['體力', next.from.stamina, next.stamina], ['飢餓', next.from.hunger, next.hunger], ['心情', next.from.mood, next.mood]].forEach(function (row) {
      var p = document.createElement('p');
      var delta = Math.round(row[2] - row[1]);
      p.textContent = row[0] + ' ' + (delta > 0 ? '+' : '') + delta;
      stats.appendChild(p);
    });
    var notes = $('summary-notes');
    notes.textContent = '';
    (next.notes.length ? next.notes : ['這一天很安靜']).forEach(function (text) {
      var li = document.createElement('li');
      li.textContent = text;
      notes.appendChild(li);
    });
  }
  function renderConfirm() {
    var title = $('confirm-title');
    var body = $('confirm-body');
    var yes = $('confirm-yes');
    body.className = '';
    if (ui.confirm === 'sleep') {
      title.textContent = '要睡覺、結束今天嗎？';
      var hungry = state.hunger < 35;
      body.textContent = (hungry ? '肚子還空，過夜會掉體力和心情。' : '今天吃得還行。') + '現在 ' + formatClock(state.time) + '。看完結算才會到隔天。';
      if (hungry) body.className = 'warn-box';
      yes.textContent = '睡了';
      return;
    }
    if (ui.confirm === 'quit') {
      title.textContent = '結束這段日子？';
      body.textContent = '目前存款 ' + formatMoney(state.money) + ' 會記入排行，這份進度就不能再繼續。';
      yes.textContent = '結束並記入排行';
      return;
    }
    title.textContent = '蓋掉目前的進度？';
    body.textContent = state.name + ' 進行到第 ' + state.day + ' 天，存款 ' + formatMoney(state.money) + '。新開一局會刪掉這段日子。';
    yes.textContent = '蓋掉並新開';
  }
  function renderOver() {
    $('over-name').textContent = state.name;
    $('over-reason').textContent = state.over.text;
    $('over-money').textContent = formatMoney(state.money);
    $('over-meta').textContent = '第 ' + state.day + ' 天 · 信用 ' + state.fame + ' · 路子 ' + state.street;
    var board = loadBoard();
    var rank = 0;
    board.forEach(function (row, index) {
      if (!rank && row.name === state.name && row.money === Math.round(state.money)) rank = index + 1;
    });
    $('over-rank').textContent = rank ? '存款排行第 ' + rank + ' 名' : '這筆已在存款排行裡';
  }
  function renderTitle() {
    var saved = state && !ui.naming;
    $('btn-continue').hidden = !saved;
    $('title-actions').hidden = !!ui.naming;
    $('new-form').hidden = !ui.naming;
    var note = $('title-note');
    if (saved && state.over) {
      note.hidden = false;
      note.textContent = state.name + ' 的上一局已結束，存款 ' + formatMoney(state.money) + '。';
    } else if (saved) {
      note.hidden = false;
      note.textContent = state.name + ' 停在第 ' + state.day + ' 天 ' + formatClock(state.time) + '，存款 ' + formatMoney(state.money) + '。';
    } else note.hidden = true;
  }

  function render() {
    if (!state) ui.screen = 'title';
    if (ui.screen === 'over' && !(state && state.over)) ui.screen = 'title';
    $('screen-title').hidden = ui.screen !== 'title';
    $('screen-play').hidden = !(ui.screen === 'play' && state);
    $('screen-over').hidden = !(ui.screen === 'over' && state && state.over);
    renderTitle();
    var showSummary = !!(state && state.pendingSummary && ui.screen === 'play');
    if (ui.screen === 'play' && state) {
      paintHud();
      if (!window.PingWorld || !window.PingWorld.ready()) renderActions();
      syncWorld(false);
    }
    if (ui.screen === 'over' && state && state.over) renderOver();
    $('modal-help').hidden = !ui.help;
    $('modal-board').hidden = !ui.board;
    $('modal-day').hidden = !(ui.day && ui.screen === 'play' && state);
    $('modal-card').hidden = !(ui.card && ui.screen === 'play' && state && !showSummary && !ui.shift && !ui.bust);
    $('modal-shift').hidden = !(ui.shift && ui.screen === 'play' && state && !showSummary);
    $('modal-summary').hidden = !showSummary;
    $('modal-bust').hidden = !ui.bust;
    $('modal-confirm').hidden = !ui.confirm;
    if (ui.board) renderBoard();
    if (ui.day && state) renderDay();
    if (ui.card && state && !showSummary) fillCard();
    if (showSummary) renderSummary();
    if (ui.bust) {
      $('bust-title').textContent = ui.bust.title;
      $('bust-body').textContent = ui.bust.body;
    }
    if (ui.confirm) renderConfirm();
    var modalOn = ui.help || ui.board || ui.day || !!ui.card || !!ui.shift || !!ui.confirm || !!ui.bust || showSummary;
    document.body.classList.toggle('modal-open', modalOn);
    document.body.classList.toggle('has-world', !!(window.PingWorld && window.PingWorld.ready()));
    document.body.dataset.screen = ui.screen;
    if (window.PingWorld) {
      window.PingWorld.setPaused(modalOn || ui.screen !== 'play');
      window.PingWorld.setActive(ui.screen === 'play' && !!state && !state.over);
    }
  }

  function openNaming() {
    ui.confirm = null;
    ui.naming = true;
    ui.screen = 'title';
    $('player-name').value = '';
    render();
    $('player-name').focus();
  }
  function onClick(event) {
    var target = event.target.closest('[data-action]');
    if (!target || !document.body.contains(target) || target.disabled) return;
    var action = target.dataset.action;
    if (action === 'stop') return;
    if (action === 'open-new') {
      if (state && !state.over) { ui.confirm = 'new'; render(); }
      else openNaming();
      return;
    }
    if (action === 'cancel-naming') { ui.naming = false; render(); return; }
    if (action === 'continue') {
      if (!state) return;
      ui.naming = false;
      ui.screen = state.over ? 'over' : 'play';
      state.forcePose = true;
      lastWanted = -1;
      raceSent = false;
      render();
      return;
    }
    if (action === 'to-title') {
      ui = blankUi();
      if (window.PingShift) window.PingShift.stop();
      render();
      return;
    }
    if (action === 'restart') { openNaming(); return; }
    if (action === 'open-help') { ui.help = true; render(); return; }
    if (action === 'close-help') { ui.help = false; render(); return; }
    if (action === 'open-board') { ui.board = true; render(); return; }
    if (action === 'close-board') { ui.board = false; render(); return; }
    if (action === 'open-day') { if (state && ui.screen === 'play') { ui.day = true; render(); } return; }
    if (action === 'close-day') { ui.day = false; render(); return; }
    if (action === 'open-side') { if (playing()) openCard('missions'); return; }
    if (action === 'dismiss-summary') { dismissSummary(); return; }
    if (action === 'dismiss-hint') { if (state) { state.hintOn = false; save(); render(); } return; }
    if (action === 'quit-open') { if (playing()) { ui.confirm = 'quit'; render(); } return; }
    if (action === 'confirm-no') { ui.confirm = null; render(); return; }
    if (action === 'confirm-yes') {
      var which = ui.confirm;
      ui.confirm = null;
      if (which === 'quit') gameOver('quit');
      else if (which === 'sleep') endDay('sleep');
      else if (which === 'new') openNaming();
      else render();
      return;
    }
    if (action === 'bust-ok') { ui.bust = null; render(); return; }
    if (action === 'close-card') { ui.card = null; render(); return; }
    if (action === 'mount') { mountToggle(); return; }
    if (action === 'shift-quit') { if (window.PingShift) window.PingShift.cancel(); return; }
    if (action === 'fallback') { perform(target.dataset.pick); return; }
    if (!playing()) return;
    if (action === 'bus-go') return rideBus(target.dataset.place);
    if (action === 'train-go') return rideTrain();
    if (action === 'buy-scooter') return buyScooter();
    if (action === 'buy-speed') return buyUpgrade('speed');
    if (action === 'buy-tank') return buyUpgrade('tank');
    if (action === 'buy-car') return buyCar();
    if (action === 'fuel-small') return buyFuel('small');
    if (action === 'fuel-full') return buyFuel('full');
    if (action === 'buy-rice') { ui.card = null; return eat(40, 24, 2, 6, 15, '飯糰'); }
    if (action === 'buy-mall') { ui.card = null; return eat(80, 36, 8, 10, 40, '百貨餐廳'); }
    if (action === 'job-clerk') return startJob('clerk');
    if (action === 'job-courier') return startJob('courier');
    if (action === 'shoplift-mart') return shoplift('mart');
    if (action === 'shoplift-mall') return shoplift('mall');
    if (action === 'talk-xia') return talk('xia');
    if (action === 'talk-ade') return talk('ade');
    if (action === 'talk-chun') return talk('chun');
    if (action === 'talk-long') return talk('long');
    if (action === 'gamble-bet') return gamble(false);
    if (action === 'gamble-cheat') return gamble(true);
  }
  function onKey(event) {
    if (event.key !== 'Escape') return;
    if (state && state.pendingSummary && ui.screen === 'play') return;
    if (ui.shift || ui.bust) return;
    if (ui.card) { ui.card = null; render(); return; }
    if (ui.confirm) { ui.confirm = null; render(); return; }
    if (ui.day) { ui.day = false; render(); return; }
    if (ui.help) { ui.help = false; render(); return; }
    if (ui.board) { ui.board = false; render(); return; }
    if (ui.naming) { ui.naming = false; render(); }
  }

  $('new-form').addEventListener('submit', function (event) {
    event.preventDefault();
    appliedHide = {};
    lastWanted = -1;
    raceSent = false;
    heat = 0;
    state = createGame(cleanName($('player-name').value));
    ui = blankUi();
    ui.screen = 'play';
    save();
    render();
  });

  window.PingGame = {
    preview: preview,
    perform: perform,
    noteWalk: noteWalk,
    noteDistrict: noteDistrict,
    arrive: arrive,
    noteRedLight: noteRedLight,
    noteCamera: noteCamera,
    noteBump: noteBump,
    policeTouch: policeTouch,
    noteCheck: noteCheck
  };

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  state = load();
  ui.screen = 'title';
  render();
})();
