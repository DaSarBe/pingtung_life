import { RACE_POINTS, SPOTS } from "./world.js";
import { CLOCK_RATE, skipToHour } from "./shift.js";

export { RACE_POINTS };

const CRATE_DROPS = [
  { x: -100, z: 80 },
  { x: 100, z: 20 },
  { x: -40, z: -150 },
];

export function goalFor(state) {
  const money = Math.max(0, 3200 - state.money);
  switch (state.chapter) {
    case "intro":
      return { title: "去租屋處找房東陳桑", detail: "出車站後往東南方，橘色公寓一樓", x: 30, z: 112 };
    case "findjob":
      return { title: "到屏東夜市找阿霞打一班工", detail: "夜市北口空地，紅色上衣，走到光圈裡按 E", x: SPOTS.axia.x, z: SPOTS.axia.z };
    case "choice":
      return { title: "選擇你的路", detail: "回阿霞那裡走正路，或去南邊找阿龍", x: state.path === "under" ? SPOTS.along.x : SPOTS.axia.x, z: state.path === "under" ? SPOTS.along.z : SPOTS.axia.z };
    case "honest_work":
      return { title: `再打完工班（${Math.min(3, state.shifts)}/3）`, detail: "找阿霞或屏東超商上班", x: SPOTS.axia.x, z: SPOTS.axia.z };
    case "honest_delivery":
      return { title: `完成外送（${Math.min(3, state.deliveries)}/3）`, detail: "夜市北口的外送櫃台", x: SPOTS.delivery.x, z: SPOTS.delivery.z };
    case "honest_shop":
      return { title: money > 0 ? `存到店租，還差 ${money} 元` : "去勝利星村找阿美租店", detail: "外送、上班、夜市小遊戲都能賺錢", x: -100, z: -92 };
    case "honest_open":
      return { title: "進店裡完成一輪營業", detail: "星村店面門口可以進去", x: -100, z: -84 };
    case "honest_festival":
      return { title: "去墾丁贊助黑鮪魚季", detail: "沿著南邊沿海道路開過去", x: 20, z: -968 };
    case "under_race":
      return { title: "在中正路贏過阿志", detail: "報名費 $200，這是一場街頭賽", x: 0, z: -36 };
    case "under_tag": {
      const wall = nearestTag(state);
      return { title: `留下地盤記號（${state.tags.length}/3）`, detail: "三面牆：西邊、後巷、公園口", x: wall.x, z: wall.z };
    }
    case "under_crate":
      return { title: `送出鳳梨酥箱（${Math.min(3, state.crates)}/3）`, detail: "箱子在夜市南邊，送到閃光點", x: state.job?.type === "crate" ? state.job.x : SPOTS.crate.x, z: state.job?.type === "crate" ? state.job.z : SPOTS.crate.z };
    case "under_recruit":
      return { title: `找三個夥伴（${Math.min(3, state.crew)}/3）`, detail: "小蘇在車站、阿財在公園、莉莉在夜市", x: nextRecruit(state).x, z: nextRecruit(state).z };
    case "under_heat":
      return { title: "帶著四顆星回到阿龍身邊", detail: "通緝會維持一陣子，別被抓住", x: SPOTS.along.x, z: SPOTS.along.z };
    case "honest_end":
    case "under_end":
    case "free":
      return { title: "自由探索屏東", detail: "夜市、墾丁、節日、外送都還在", x: 0, z: 148 };
    default:
      return { title: "在屏東逛逛", detail: "", x: 0, z: 148 };
  }
}

function nearestTag(state) {
  const spots = [
    { id: "tag1", x: -70, z: 18 },
    { id: "tag2", x: 22, z: -68 },
    { id: "tag3", x: 58, z: 18 },
  ];
  const left = spots.filter((s) => !state.tags.includes(s.id));
  return left[0] || spots[0];
}

function nextRecruit(state) {
  if (!state.flags.sushi) return { x: 0, z: 122 };
  if (!state.flags.acai) return { x: 86, z: 36 };
  return { x: SPOTS.lili.x, z: SPOTS.lili.z };
}

export function interactItem(game, item) {
  const state = game.state;
  if (!item) return false;
  if (item.type === "door") {
    if (item.to === "shop" && !state.shopOwned) {
      game.toast("這間店還沒租下來");
      return true;
    }
    if (item.to === "home" && state.riding) {
      game.toast("先下車再進門");
      return true;
    }
    game.enter(item.to);
    return true;
  }
  if (item.type === "npc") return talkNpc(game, item.id);
  if (item.type === "work") return startShift(game, "store");
  if (item.type === "delivery") {
    game.startDelivery();
    return true;
  }
  if (item.type === "minigame") {
    if (item.game === "ring") openPaid(game, 50, "ring");
    else openPaid(game, 40, "balloon");
    return true;
  }
  if (item.type === "temple") {
    game.say([
      { name: "廟口", text: "城隍小廟香火很穩。你可以參香，也可以只是坐一下。" },
      {
        name: "廟口",
        text: "要捐一點香油錢嗎？",
        choices: [
          { label: "捐 $100", run: () => {
            if (state.money < 100) { game.toast("錢不太夠"); return; }
            state.money -= 100;
            state.rep += 1;
            game.audio.sfx("coin");
            game.toast("心裡比較定了");
            game.save();
          } },
          { label: "先不用", run: () => {} },
        ],
      },
    ]);
    return true;
  }
  if (item.type === "tag") return tagWall(game, item);
  if (item.type === "crate") {
    game.startCrate();
    return true;
  }
  if (item.type === "tuna") return tunaStall(game);
  if (item.type === "pickup") {
    state.money += item.amount || 0;
    game.audio.sfx("coin");
    game.toast(`撿到紅包 ${item.amount} 元`);
    game.removeInteract(item);
    return true;
  }
  if (item.id === "shop-counter") {
    game.openActivity("shop", {
      onDone: (result) => {
        const pay = 700 + result.correct * 80;
        state.money += pay;
        state.rep += 2;
        state.flags.served = true;
        game.audio.sfx("coin");
        game.toast(`這一輪收了 ${pay} 元`);
        if (state.chapter === "honest_open") {
          state.chapter = "honest_festival";
          game.say([{ name: "阿美", text: "店算開起來了。黑鮪魚季在墾丁，你去擺個贊助攤，屏東人會記住你。" }]);
        }
        game.save();
      },
    });
    return true;
  }
  if (item.id === "bed") {
    game.say([
      {
        name: "你",
        text: "床鋪有點硬，但很安靜。",
        choices: [
          { label: "睡到早上 7:00", run: () => rest(game, 7) },
          { label: "休息到晚上 18:30", run: () => rest(game, 18.5) },
          { label: "再晃一下", run: () => {} },
        ],
      },
    ]);
    return true;
  }
  if (item.id === "exit") {
    game.exitInterior();
    return true;
  }
  return false;
}

function rest(game, hour) {
  skipToHour(game.state, hour);
  game.state.stamina = 100;
  game.toast(hour < 12 ? "你睡到了早上" : "你休息到了晚上");
  game.audio.sfx("click");
  game.save();
}

function openPaid(game, cost, kind) {
  if (game.state.money < cost) {
    game.toast(`要 ${cost} 元`);
    return;
  }
  game.state.money -= cost;
  game.openActivity(kind, {
    onDone: (result) => {
      const pay = result.pay || 0;
      game.state.money += pay;
      if (pay > 0) game.audio.sfx("win");
      else game.audio.sfx("lose");
      game.toast(pay > 0 ? `贏得 ${pay} 元` : "這次空手而歸");
      game.save();
    },
  });
}

function startShift(game, kind) {
  if (game.state.chapter === "intro") {
    game.toast("先去跟陳桑打個招呼");
    return true;
  }
  game.openActivity(kind === "store" ? "store" : "drink", {
    onDone: (result) => {
      const pay = 420 + result.correct * 55;
      game.state.money += pay;
      game.state.shifts += 1;
      game.state.rep += 1;
      game.audio.sfx("coin");
      game.toast(`下班了，日結 ${pay} 元`);
      if (game.state.chapter === "findjob") game.state.chapter = "choice";
      game.save();
    },
  });
  return true;
}

function tagWall(game, item) {
  const state = game.state;
  if (state.path !== "under" || !["under_tag", "under_crate", "under_recruit", "under_heat", "free", "under_end"].includes(state.chapter)) {
    game.toast("這面牆目前不關你的事");
    return true;
  }
  if (state.tags.includes(item.id)) {
    game.toast("這裡已經有記號了");
    return true;
  }
  state.tags.push(item.id);
  state.heat += 1;
  game.addWanted(1);
  game.audio.sfx("spray");
  game.toast("你留下了一個很卡通的地盤記號");
  if (state.tags.length >= 3 && state.chapter === "under_tag") state.chapter = "under_crate";
  game.save();
  return true;
}

function tunaStall(game) {
  const state = game.state;
  if (state.chapter === "honest_festival") {
    if (state.money < 600) {
      game.toast("贊助要 $600，再去賺一點");
      return true;
    }
    state.money -= 600;
    state.flags.sponsored = true;
    state.rep += 5;
    state.chapter = "honest_end";
    game.audio.sfx("win");
    game.showEnding("honest");
    return true;
  }
  game.say([
    { name: "漁販阿海", text: "黑鮪魚季的魚漿丸，涼的、熱的都有。這是遊戲裡的攤，不是真的魚市場。" },
    {
      name: "漁販阿海",
      text: "要吃一碗嗎？八十元，補體力。",
      choices: [
        { label: "吃一碗", run: () => {
          if (state.money < 80) { game.toast("錢不太夠"); return; }
          state.money -= 80;
          state.stamina = Math.min(100, state.stamina + 40);
          game.audio.sfx("coin");
          game.toast("好吃，人醒了");
        } },
        { label: "拍張照就好", run: () => game.toast("你在攤前留了一張很觀光的照片") },
      ],
    },
  ]);
  return true;
}

function talkNpc(game, id) {
  const state = game.state;
  if (id === "landlord") {
    game.say([
      { name: "陳桑", text: "你就是新房客喔？房租我寬限幾天。紅色機車停在這棟公寓門口西側，小地圖上有一顆紅點。" },
      { name: "陳桑", text: "走過去，靠近就會看到提示，按 F 就能騎，不用貼到車邊。想打工就去東南方的屏東夜市，找穿紅衣的阿霞，走到她面前按 E。" },
    ], () => {
      state.flags.metLandlord = true;
      if (state.chapter === "intro") state.chapter = "findjob";
      game.audio.sfx("talk");
      game.save();
    });
    return true;
  }
  if (id === "axia") {
    if (state.chapter === "intro") {
      game.say([{ name: "阿霞", text: "少年仔，先回去跟陳桑報到，再來上班。" }]);
      return true;
    }
    if (!state.path && (state.chapter === "choice" || state.chapter === "findjob")) {
      const choices = [
        { label: "我跟著你做", run: () => choose(game, "honest") },
        { label: "我想先聽聽阿龍", run: () => game.toast("阿龍在夜市南邊的路邊") },
      ];
      if (state.chapter === "findjob") {
        game.say([
          { name: "阿霞", text: "夜市缺人手。一班做幾杯飲料，薪水日結。做不做？" },
          { name: "阿霞", text: "站好，客人要來了。", choices: [{ label: "開始上班", run: () => startShift(game, "drink") }, { label: "等等", run: () => {} }] },
        ]);
      } else {
        game.say([
          { name: "阿霞", text: "手腳可以。你要繼續靠這雙手間吃飯，還是去聽阿龍講那些快錢？" },
          { name: "阿霞", text: "兩條路都是你的人生，我不會替你選。", choices },
        ]);
      }
      return true;
    }
    if (state.path === "under") {
      game.say([{ name: "阿霞", text: "你選了另一邊。夜市還是會賣飲料，人走了，燈還在。" }]);
      return true;
    }
    game.say([
      { name: "阿霞", text: "要上班就說一聲。珍珠奶茶、紅茶、青草茶，看清楚再做。" },
      { name: "阿霞", text: "客人不等太久。", choices: [{ label: "上班", run: () => startShift(game, "drink") }, { label: "先去逛", run: () => {} }] },
    ]);
    return true;
  }
  if (id === "along") {
    if (state.path === "honest") {
      game.say([{ name: "阿龍", text: "你跟阿霞就好。屏東需要會做事的人，不是每個人都該認識我。" }]);
      return true;
    }
    if (!state.path) {
      game.say([
        { name: "阿龍", text: "少年仔，正當班能存多少？贏一場街跑、幫我送幾箱鳳梨酥，夜市這一段以後你說話算數。" },
        { name: "阿龍", text: "警察也會認識你。沒有血，只有很誇張的追逐跟罰單。" },
        {
          name: "阿龍",
          text: "要跟我，還是回去找阿霞？",
          choices: [
            { label: "我跟你", run: () => choose(game, "under") },
            { label: "我走正路", run: () => choose(game, "honest") },
          ],
        },
      ]);
      return true;
    }
    if (state.chapter === "under_heat") {
      if (state.wanted >= 4) {
        state.chapter = "under_end";
        game.showEnding("under");
      } else {
        state.wanted = 4;
        state.wantedLock = state.time + 50 * CLOCK_RATE;
        game.toast("通緝又亮了，騎回這裡");
      }
      return true;
    }
    game.say([{ name: "阿龍", text: "事情做完再來。別在我面前猶豫，屏東的夜晚很短。" }]);
    return true;
  }
  if (id === "azhi") {
    game.say([
      { name: "阿志", text: "中正路這一圈，誰先過完點誰就贏。報名費兩百，贏了拿九百。" },
      { name: "阿志", text: "這是遊戲裡的街頭賽，現實不要學。" },
      {
        name: "阿志",
        text: "現在要跑嗎？",
        choices: [
          { label: "開跑", run: () => game.startRace() },
          { label: "下次", run: () => {} },
        ],
      },
    ]);
    return true;
  }
  if (id === "amei") {
    if (state.path === "under") {
      game.say([{ name: "阿美", text: "店面還在，但你好像不是來繳房租的。" }]);
      return true;
    }
    if (state.chapter === "honest_shop" || (state.path === "honest" && !state.shopOwned && state.deliveries >= 3 && state.shifts >= 3)) {
      game.say([
        { name: "阿美", text: "星村這間小店，月租我算你 $3,200。你自己營業，我不管菜單。" },
        {
          name: "阿美",
          text: state.money >= 3200 ? "錢夠了，要租嗎？" : `你現在有 ${Math.floor(state.money)} 元，還差一點。`,
          choices: [
            { label: "租下來", run: () => rentShop(game) },
            { label: "再存存", run: () => {} },
          ],
        },
      ]);
      return true;
    }
    if (state.shopOwned) {
      game.say([{ name: "阿美", text: "門沒鎖。進去招待客人，肉圓、涼麵、豬血湯，別端錯。" }]);
      return true;
    }
    game.say([{ name: "阿美", text: "想租店可以，先讓阿霞跟外送櫃台知道你靠得住。" }]);
    return true;
  }
  if (id === "vendor") {
    game.say([
      { name: "黑輪伯", text: "黑輪、甜不辣，熱的。四十元，體力補一截。" },
      {
        name: "黑輪伯",
        text: "要不要？",
        choices: [
          { label: "買一份", run: () => {
            if (state.money < 40) { game.toast("差一點"); return; }
            state.money -= 40;
            state.stamina = Math.min(100, state.stamina + 45);
            game.audio.sfx("coin");
            game.toast("吃飽，比較有力");
          } },
          { label: "不用", run: () => {} },
        ],
      },
    ]);
    return true;
  }
  if (id === "sushi" || id === "acai" || id === "lili") return recruit(game, id);
  if (typeof id === "string" && id.startsWith("tourist-")) return talkTourist(game, id);
  if (id === "fisher") return tunaStall(game);
  return false;
}

function talkTourist(game, id) {
  const state = game.state;
  game.say([
    { name: "遊客", text: "不好意思，屏東車站要往哪走？我地圖轉暈了。" },
    {
      name: "遊客",
      text: "你指個方向就好。",
      choices: [
        { label: "往北，過馬路就是", run: () => {
          state.money += 100;
          state.rep += 1;
          game.toast("遊客塞了 100 元給你");
          game.audio.sfx("coin");
          game.world.interactables = game.world.interactables.filter((it) => it.id !== id);
        } },
        { label: "往海邊一直開", run: () => {
          game.toast("遊客走向了完全相反的方向");
          game.world.interactables = game.world.interactables.filter((it) => it.id !== id);
        } },
      ],
    },
  ]);
  return true;
}

function choose(game, path) {
  if (game.state.chapter === "intro" || game.state.chapter === "findjob") {
    game.toast("先打完一班工再選");
    return;
  }
  game.state.path = path;
  game.state.chapter = path === "honest" ? "honest_work" : "under_race";
  game.toast(path === "honest" ? "你決定靠自己的手吃飯" : "你走進夜市的另一側");
  game.audio.sfx("talk");
  game.save();
}

function rentShop(game) {
  const state = game.state;
  if (state.money < 3200) {
    game.toast("錢還不夠");
    return;
  }
  state.money -= 3200;
  state.shopOwned = true;
  state.chapter = "honest_open";
  game.audio.sfx("coin");
  game.toast("鑰匙是你的了");
  game.save();
}

function recruit(game, id) {
  const state = game.state;
  const names = { sushi: "小蘇", acai: "阿財", lili: "莉莉" };
  if (state.path !== "under") {
    game.say([{ name: names[id], text: "哩賀！今天屏東天氣不錯，你也是來逛的喔？" }]);
    return true;
  }
  if (state.flags[id]) {
    game.say([{ name: names[id], text: "我跟著你。別叫我做太誇張的事，我只負責在後面喊哩賀。" }]);
    return true;
  }
  if (!["under_recruit", "under_heat", "free", "under_end"].includes(state.chapter)) {
    game.say([{ name: names[id], text: "你看起來還在找路。等你真的需要人，再來。" }]);
    return true;
  }
  game.say([
    { name: names[id], text: "要我跟著可以，咖啡跟油錢 $300。我不會打架，只會騎車跟把風。" },
    {
      name: names[id],
      text: "要找我嗎？",
      choices: [
        { label: "付 $300", run: () => {
          if (state.money < 300) { game.toast("錢不夠"); return; }
          state.money -= 300;
          state.flags[id] = true;
          state.crew += 1;
          game.audio.sfx("coin");
          game.toast(`${names[id]}加入了`);
          if (state.crew >= 3 && state.chapter === "under_recruit") {
            state.chapter = "under_heat";
            state.wanted = Math.max(4, state.wanted);
            state.wantedLock = state.time + 50 * CLOCK_RATE;
            game.say([{ name: "阿龍", text: "人齊了。現在全城都看得到你，騎回我這邊，別被抓去喝茶。" }]);
          }
          game.save();
        } },
        { label: "再想想", run: () => {} },
      ],
    },
  ]);
  return true;
}

export function updateStory(game, dt) {
  const state = game.state;
  if (state.chapter === "honest_work" && state.shifts >= 3) {
    state.chapter = "honest_delivery";
    game.toast("阿霞說你可以去接外送了");
  }
  if (state.chapter === "honest_delivery" && state.deliveries >= 3) {
    state.chapter = "honest_shop";
    game.toast("勝利星村的阿美願意見你");
  }
  if (!state.kentingVisited && state.z < -830) {
    state.kentingVisited = true;
    game.toast("你開到墾丁了");
  }
  const paradeDay = Math.floor(state.time / 86400);
  if (game.sim?.nearParade && state.flags.paradeDay !== paradeDay) {
    state.flags.paradeDay = paradeDay;
    state.rep += 1;
    game.toast("東港迎王的隊伍經過，鼓聲很近");
    game.audio.sfx("talk");
  }
  game.eventTimer = (game.eventTimer || 5) - dt;
  if (game.eventTimer <= 0 && game.mode === "playing" && !state.inside && !game.race && !state.job) {
    game.eventTimer = 70 + Math.random() * 40;
    rollEvent(game);
  }
}

function clearOfPeople(game, x, z) {
  for (const n of game.world.npcs) {
    if (Math.hypot(n.x - x, n.z - z) < 9) return false;
  }
  for (const it of game.world.interactables) {
    if (Math.hypot(it.x - x, it.z - z) < 4) return false;
  }
  return true;
}

function rollEvent(game) {
  const roll = Math.random();
  if (roll < 0.34) {
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2;
      const x = game.state.x + Math.sin(ang) * 8;
      const z = game.state.z + Math.cos(ang) * 8;
      if (!clearOfPeople(game, x, z)) continue;
      game.world.interactables.push({
        id: "tourist-" + Date.now(),
        type: "npc",
        name: "遊客",
        x,
        z,
        tint: [0.35, 0.55, 0.85],
      });
      game.toast("附近有遊客在問路，走近按 E");
      return;
    }
  } else if (roll < 0.67) {
    game.state.rainUntil = game.state.time + 2 * 3600;
    game.toast("午後雷陣雨，騎慢一點");
  } else {
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2;
      const x = game.state.x + Math.cos(ang) * 7;
      const z = game.state.z + Math.sin(ang) * 7;
      if (!clearOfPeople(game, x, z)) continue;
      game.world.interactables.push({ id: "red-" + Date.now(), type: "pickup", name: "紅包", x, z, amount: 200 });
      game.toast("地上好像有個紅包");
      return;
    }
  }
}

export function createActivities(canvas) {
  const ctx = canvas.getContext("2d");
  let kind = null;
  let data = null;
  let onDone = null;

  function open(next, opts) {
    kind = next;
    onDone = opts.onDone;
    data = setup(next);
  }

  function setup(next) {
    if (next === "ring") {
      return {
        throws: 3, t: 0, flying: null, pay: 0, done: false,
        prizes: [
          { x: 150, y: 210, r: 34, name: "娃娃", pay: 80, hit: false },
          { x: 320, y: 230, r: 26, name: "零食", pay: 40, hit: false },
          { x: 490, y: 200, r: 20, name: "大金魚", pay: 220, hit: false },
        ],
      };
    }
    if (next === "balloon") {
      const balloons = [];
      for (let i = 0; i < 8; i++) {
        balloons.push({ x: 80 + (i % 4) * 140, y: 80 + Math.floor(i / 4) * 110, r: 28, vy: 18 + (i % 3) * 8, hue: i * 40, alive: true });
      }
      return { left: 20, score: 0, cd: 0, balloons, done: false, pay: 0 };
    }
    const menu = next === "shop" ? ["肉圓", "涼麵", "豬血湯"] : next === "store" ? ["飯糰", "茶葉蛋", "牛奶"] : ["珍珠奶茶", "紅茶", "青草茶"];
    const orders = [];
    for (let i = 0; i < 8; i++) orders.push((Math.random() * 3) | 0);
    return { menu, orders, index: 0, correct: 0, left: 4.2, done: false, pay: 0 };
  }

  function finish() {
    if (!data || data.done) return;
    data.done = true;
    const result = { pay: data.pay || 0, correct: data.correct || 0 };
    const cb = onDone;
    kind = null;
    onDone = null;
    if (cb) cb(result);
  }

  function throwRing() {
    if (!data || data.flying || data.throws <= 0 || data.done) return;
    const aim = Math.sin(data.t * 1.4) * 220 + 320;
    data.flying = { x: 320, y: 330, tx: aim + (Math.random() - 0.5) * 36, ty: 180 + Math.random() * 40, p: 0 };
    data.throws -= 1;
  }

  function update(dt) {
    if (!kind || !data) return;
    if (kind === "ring") {
      data.t += dt;
      if (data.flying) {
        data.flying.p += dt * 1.4;
        if (data.flying.p >= 1) {
          const f = data.flying;
          for (const prize of data.prizes) {
            if (!prize.hit && Math.hypot(f.tx - prize.x, f.ty - prize.y) < prize.r + 8) {
              prize.hit = true;
              data.pay += prize.pay;
            }
          }
          data.flying = null;
          if (data.throws <= 0) finish();
        }
      }
    } else if (kind === "balloon") {
      data.left -= dt;
      data.cd = Math.max(0, data.cd - dt);
      for (const b of data.balloons) {
        if (!b.alive) continue;
        b.y -= b.vy * dt;
        if (b.y < 30) b.y = 300;
      }
      if (data.left <= 0) {
        data.pay = data.score * 15;
        finish();
      }
    } else {
      data.left -= dt;
      if (data.left <= 0) missOrder();
    }
  }

  function missOrder() {
    data.index += 1;
    data.left = 4.2;
    if (data.index >= data.orders.length) {
      data.pay = data.correct * 40;
      finish();
    }
  }

  function choose(index) {
    if (!data || data.done || kind === "ring" || kind === "balloon") return;
    if (index === data.orders[data.index]) data.correct += 1;
    data.index += 1;
    data.left = 4.2;
    if (data.index >= data.orders.length) {
      data.pay = data.correct * 40;
      finish();
    }
  }

  function shoot(px, py) {
    if (kind !== "balloon" || !data || data.cd > 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((px - rect.left) / rect.width) * canvas.width;
    const y = ((py - rect.top) / rect.height) * canvas.height;
    data.cd = 0.18;
    for (const b of data.balloons) {
      if (b.alive && Math.hypot(b.x - x, b.y - y) < b.r + 8) {
        b.alive = false;
        data.score += 1;
        break;
      }
    }
  }

  function draw() {
    if (!kind || !data) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#1b1714";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f6f1e7";
    ctx.font = "700 28px 'Microsoft JhengHei', 'PingFang TC', sans-serif";
    if (kind === "ring") {
      ctx.fillText("套圈圈", 28, 46);
      ctx.font = "20px sans-serif";
      ctx.fillText(`剩下 ${data.throws} 圈　目前 $${data.pay}`, 28, 78);
      ctx.fillStyle = "#6b4a32";
      ctx.fillRect(60, 150, 520, 140);
      for (const prize of data.prizes) {
        ctx.beginPath();
        ctx.fillStyle = prize.hit ? "#888" : "#e07a5f";
        ctx.arc(prize.x, prize.y, prize.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff8ea";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(prize.name, prize.x, prize.y + 4);
      }
      ctx.textAlign = "left";
      const aim = Math.sin(data.t * 1.4) * 220 + 320;
      ctx.strokeStyle = "#ffd15c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(aim, 120);
      ctx.lineTo(aim, 300);
      ctx.stroke();
      ctx.strokeStyle = "#f4f1ea";
      ctx.beginPath();
      ctx.arc(data.flying ? data.flying.x + (data.flying.tx - data.flying.x) * data.flying.p : 320, data.flying ? data.flying.y + (data.flying.ty - 330) * data.flying.p : 320, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#f6f1e7";
      ctx.font = "18px sans-serif";
      ctx.fillText("點一下丟出圈圈", 28, 340);
    } else if (kind === "balloon") {
      ctx.fillText("射氣球", 28, 46);
      ctx.font = "20px sans-serif";
      ctx.fillText(`時間 ${Math.ceil(data.left)}　打中 ${data.score}`, 28, 78);
      for (const b of data.balloons) {
        if (!b.alive) continue;
        ctx.beginPath();
        ctx.fillStyle = `hsl(${b.hue} 70% 55%)`;
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#f6f1e7";
      ctx.font = "18px sans-serif";
      ctx.fillText("點氣球", 28, 340);
    } else {
      const title = kind === "shop" ? "店裡營業" : kind === "store" ? "超商輪班" : "飲料攤";
      ctx.fillText(title, 28, 46);
      ctx.font = "22px sans-serif";
      ctx.fillText(`第 ${Math.min(data.orders.length, data.index + 1)} / ${data.orders.length} 單　做對 ${data.correct}`, 28, 86);
      ctx.font = "700 40px sans-serif";
      ctx.fillStyle = "#ffd15c";
      const order = data.menu[data.orders[data.index] ?? 0];
      ctx.fillText(order || "", 28, 170);
      ctx.fillStyle = "#f6f1e7";
      ctx.font = "20px sans-serif";
      ctx.fillText(`剩下 ${Math.ceil(data.left)} 秒`, 28, 210);
      data.menu.forEach((name, i) => {
        ctx.fillStyle = "#2a2622";
        ctx.fillRect(28 + i * 190, 250, 170, 64);
        ctx.fillStyle = "#fff8ea";
        ctx.font = "22px sans-serif";
        ctx.fillText(`${i + 1}. ${name}`, 44, 290);
      });
    }
  }

  function pointer(e) {
    if (!kind || !data) return;
    if (kind === "ring") throwRing();
    else if (kind === "balloon") shoot(e.clientX, e.clientY);
    else {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      if (y > 240 && y < 330) {
        const index = Math.floor((x - 28) / 190);
        if (index >= 0 && index < 3) choose(index);
      }
    }
  }

  function key(code) {
    if (code === "Digit1" || code === "Numpad1") choose(0);
    if (code === "Digit2" || code === "Numpad2") choose(1);
    if (code === "Digit3" || code === "Numpad3") choose(2);
    if (code === "Space" || code === "Enter") {
      if (kind === "ring") throwRing();
    }
  }

  return {
    open,
    close: finish,
    active: () => !!kind,
    snapshot() {
      if (!kind || !data) return null;
      if (kind === "ring" || kind === "balloon") return { kind, throws: data.throws, left: data.left, score: data.score };
      return { kind, menu: data.menu, order: data.menu[data.orders[data.index]], index: data.index };
    },
    update,
    draw,
    pointer,
    key,
    label() {
      if (kind === "ring") return "套圈圈";
      if (kind === "balloon") return "射氣球";
      if (kind === "shop") return "開店營業";
      if (kind === "store") return "超商上班";
      return "飲料攤上班";
    },
  };
}

export function crateDrops() {
  return CRATE_DROPS;
}
