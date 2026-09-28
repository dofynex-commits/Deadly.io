const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');

const TILE = 40;
const MAP_W = 120;
const MAP_H = 120;

let W, H;
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const camera = { x: 0, y: 0 };
const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

let mouse = { x: 0, y: 0, down: false, worldX: 0, worldY: 0 };
canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
canvas.addEventListener('mousedown', () => mouse.down = true);
canvas.addEventListener('mouseup', () => mouse.down = false);

const player = {
  x: MAP_W * TILE / 2,
  y: MAP_H * TILE / 2,
  radius: 16,
  speed: 3.2,
  hp: 100,
  maxHp: 100,
  armor: 0,
  xp: 0,
  xpMax: 100,
  level: 1,
  angle: 0,
  inv: { wood: 0, stone: 0, iron: 0, crystal: 0 },
  attackCooldown: 0,
  attackRange: 55,
  damage: 18
};

const tiles = [];
const resources = [];
const buildings = [];

function generateMap() {
  for (let y = 0; y < MAP_H; y++) {
    tiles[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      const n = Math.sin(x * 0.07) * Math.cos(y * 0.09) + Math.sin(x * 0.13 + y * 0.11);
      if (n < -0.65) tiles[y][x] = 1;
      else if (n > 0.55) tiles[y][x] = 2;
      else tiles[y][x] = 0;
    }
  }

  const count = Math.floor(MAP_W * MAP_H * 0.035);
  for (let i = 0; i < count; i++) {
    const tx = Math.floor(Math.random() * MAP_W);
    const ty = Math.floor(Math.random() * MAP_H);
    if (tiles[ty][tx] === 1) continue;

    const r = Math.random();
    let type, color, size, hp, drop;
    if (r < 0.45) {
      type = 'tree'; color = '#2d8a2d'; size = 18 + Math.random() * 8; hp = 40; drop = 'wood';
    } else if (r < 0.7) {
      type = 'rock'; color = '#888'; size = 14 + Math.random() * 6; hp = 55; drop = 'stone';
    } else if (r < 0.88) {
      type = 'iron'; color = '#a0a0b0'; size = 12 + Math.random() * 5; hp = 70; drop = 'iron';
    } else {
      type = 'crystal'; color = '#c060ff'; size = 11 + Math.random() * 4; hp = 90; drop = 'crystal';
    }

    resources.push({
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
      type, color, size, hp, maxHp: hp, drop,
      amount: type === 'tree' ? 3 + Math.floor(Math.random()*3) : 2 + Math.floor(Math.random()*2)
    });
  }
}
generateMap();

let selectedBuild = null;
const buildCosts = {
  wall:   { wood: 5 },
  door:   { wood: 8 },
  chest:  { wood: 10 },
  turret: { stone: 15, iron: 5 },
  farm:   { wood: 12 }
};

document.querySelectorAll('.build-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('active'));
    if (selectedBuild === btn.dataset.type) {
      selectedBuild = null;
    } else {
      selectedBuild = btn.dataset.type;
      btn.classList.add('active');
    }
  });
});

window.addEventListener('keydown', e => {
  const map = { '1': 'wall', '2': 'door', '3': 'chest', '4': 'turret', '5': 'farm' };
  if (map[e.key]) {
    selectedBuild = selectedBuild === map[e.key] ? null : map[e.key];
    document.querySelectorAll('.build-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === selectedBuild);
    });
  }
  if (e.key.toLowerCase() === 'e') tryHarvest();
});

function canAfford(type) {
  const cost = buildCosts[type];
  for (const k in cost) if ((player.inv[k] || 0) < cost[k]) return false;
  return true;
}

function payCost(type) {
  const cost = buildCosts[type];
  for (const k in cost) player.inv[k] -= cost[k];
}

function tryBuild(wx, wy) {
  if (!selectedBuild || !canAfford(selectedBuild)) return;
  const gx = Math.floor(wx / TILE) * TILE + TILE / 2;
  const gy = Math.floor(wy / TILE) * TILE + TILE / 2;

  for (const b of buildings) {
    if (Math.hypot(b.x - gx, b.y - gy) < 30) return;
  }
  const tx = Math.floor(gx / TILE), ty = Math.floor(gy / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || tiles[ty][tx] === 1) return;

  payCost(selectedBuild);
  buildings.push({
    x: gx, y: gy,
    type: selectedBuild,
    hp: selectedBuild === 'turret' ? 120 : 80,
    maxHp: selectedBuild === 'turret' ? 120 : 80,
    angle: 0,
    cooldown: 0
  });
  updateUI();
}

function tryHarvest() {
  for (let i = resources.length - 1; i >= 0; i--) {
    const r = resources[i];
    const d = Math.hypot(r.x - player.x, r.y - player.y);
    if (d < player.radius + r.size + 12) {
      r.hp -= 25;
      if (r.hp <= 0) {
        player.inv[r.drop] = (player.inv[r.drop] || 0) + r.amount;
        player.xp += r.amount * 2;
        checkLevelUp();
        resources.splice(i, 1);
        updateUI();
      }
      return;
    }
  }
}

function checkLevelUp() {
  while (player.xp >= player.xpMax) {
    player.xp -= player.xpMax;
    player.level++;
    player.xpMax = Math.floor(player.xpMax * 1.35);
    player.maxHp += 10;
    player.hp = player.maxHp;
    player.damage += 2;
  }
  updateUI();
}

function tryAttack() {
  if (player.attackCooldown > 0) return;
  player.attackCooldown = 18;
}

function update() {
  let dx = 0, dy = 0;
  if (keys['z'] || keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['q'] || keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    const nx = player.x + dx * player.speed;
    const ny = player.y + dy * player.speed;
    const tx = Math.floor(nx / TILE), ty = Math.floor(ny / TILE);
    if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && tiles[ty][tx] !== 1) {
      player.x = nx;
      player.y = ny;
    }
  }

  mouse.worldX = mouse.x + camera.x;
  mouse.worldY = mouse.y + camera.y;
  player.angle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);

  if (mouse.down) {
    if (selectedBuild) {
      tryBuild(mouse.worldX, mouse.worldY);
      mouse.down = false;
    } else {
      tryAttack();
    }
  }

  if (player.attackCooldown > 0) player.attackCooldown--;

  const targetCamX = player.x - W / 2;
  const targetCamY = player.y - H / 2;
  camera.x += (targetCamX - camera.x) * 0.12;
  camera.y += (targetCamY - camera.y) * 0.12;

  camera.x = Math.max(0, Math.min(camera.x, MAP_W * TILE - W));
  camera.y = Math.max(0, Math.min(camera.y, MAP_H * TILE - H));
}

function drawCircle(x, y, r, color, stroke = null) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawRect(x, y, w, h, color, stroke = null) {
  ctx.fillStyle = color;
  ctx.fillRect(x - w/2, y - h/2, w, h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - w/2, y - h/2, w, h);
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);

  const startX = Math.max(0, Math.floor(camera.x / TILE) - 1);
  const endX = Math.min(MAP_W, Math.ceil((camera.x + W) / TILE) + 1);
  const startY = Math.max(0, Math.floor(camera.y / TILE) - 1);
  const endY = Math.min(MAP_H, Math.ceil((camera.y + H) / TILE) + 1);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const px = x * TILE - camera.x;
      const py = y * TILE - camera.y;
      if (tiles[y][x] === 0) ctx.fillStyle = '#3a8a35';
      else if (tiles[y][x] === 1) ctx.fillStyle = '#2a6aaa';
      else ctx.fillStyle = '#6b5a3a';
      ctx.fillRect(px, py, TILE + 1, TILE + 1);

      if (tiles[y][x] === 0 && (x + y) % 3 === 0) {
        ctx.fillStyle = '#34802f';
        ctx.fillRect(px + 4, py + 4, 8, 8);
      }
    }
  }

  for (const r of resources) {
    const px = r.x - camera.x;
    const py = r.y - camera.y;
    if (px < -40 || py < -40 || px > W + 40 || py > H + 40) continue;

    if (r.type === 'tree') {
      drawRect(px, py + 6, 8, 14, '#5a3a1a');
      drawCircle(px, py - 6, r.size, r.color, '#1a5a1a');
    } else if (r.type === 'rock') {
      drawCircle(px, py, r.size, r.color, '#555');
      ctx.beginPath();
      ctx.arc(px - 4, py - 4, r.size * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();
    } else if (r.type === 'iron') {
      ctx.beginPath();
      ctx.moveTo(px, py - r.size);
      ctx.lineTo(px + r.size * 0.9, py - r.size * 0.3);
      ctx.lineTo(px + r.size * 0.6, py + r.size * 0.8);
      ctx.lineTo(px - r.size * 0.7, py + r.size * 0.7);
      ctx.lineTo(px - r.size * 0.9, py - r.size * 0.2);
      ctx.closePath();
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (r.type === 'crystal') {
      ctx.beginPath();
      ctx.moveTo(px, py - r.size);
      ctx.lineTo(px + r.size * 0.7, py);
      ctx.lineTo(px, py + r.size);
      ctx.lineTo(px - r.size * 0.7, py);
      ctx.closePath();
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.strokeStyle = '#80f';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, r.size * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,150,255,0.5)';
      ctx.fill();
    }

    if (r.hp < r.maxHp) {
      const bw = 28, bh = 4;
      ctx.fillStyle = '#333';
      ctx.fillRect(px - bw/2, py - r.size - 12, bw, bh);
      ctx.fillStyle = '#4c4';
      ctx.fillRect(px - bw/2, py - r.size - 12, bw * (r.hp / r.maxHp), bh);
    }
  }

  for (const b of buildings) {
    const px = b.x - camera.x;
    const py = b.y - camera.y;
    if (px < -50 || py < -50 || px > W + 50 || py > H + 50) continue;

    if (b.type === 'wall') {
      drawRect(px, py, 34, 34, '#8a6a4a', '#5a3a2a');
    } else if (b.type === 'door') {
      drawRect(px, py, 34, 34, '#6a4a2a', '#3a2a1a');
      ctx.fillStyle = '#c8a060';
      ctx.fillRect(px - 6, py - 14, 12, 28);
    } else if (b.type === 'chest') {
      drawRect(px, py, 28, 22, '#c8a040', '#8a6020');
      ctx.fillStyle = '#5a3a10';
      ctx.fillRect(px - 14, py - 4, 28, 5);
    } else if (b.type === 'turret') {
      drawCircle(px, py, 16, '#555', '#333');
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(b.angle);
      ctx.fillStyle = '#888';
      ctx.fillRect(0, -4, 22, 8);
      ctx.restore();
    } else if (b.type === 'farm') {
      drawRect(px, py, 36, 36, '#5a8a3a', '#3a5a1a');
      for (let i = 0; i < 4; i++) {
        drawCircle(px - 10 + (i%2)*20, py - 8 + Math.floor(i/2)*16, 5, '#7c4');
      }
    }

    if (b.hp < b.maxHp) {
      const bw = 30, bh = 4;
      ctx.fillStyle = '#333';
      ctx.fillRect(px - bw/2, py - 28, bw, bh);
      ctx.fillStyle = '#c44';
      ctx.fillRect(px - bw/2, py - 28, bw * (b.hp / b.maxHp), bh);
    }
  }

  const px = player.x - camera.x;
  const py = player.y - camera.y;

  drawCircle(px, py, player.radius, '#4a9eff', '#2a6acc');

  // =========================
  // IDENTITÉ DU JOUEUR
  // =========================
  if (typeof window.DeadlyLeaderboard !== "undefined") {
    ctx.save();

    const nickname =
      localStorage.getItem("surviveio_nickname") || "Player";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "700 10px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,.9)";
    ctx.shadowBlur = 4;
    ctx.fillText(
      nickname,
      px,
      py + player.radius + 10
    );

    const titles =
      window.DeadlyLeaderboard.getPlayerRankTitlesForGame?.() || [];

    titles.forEach((title, index) => {
      ctx.font = "800 7px Arial";
      ctx.fillStyle = title.color || "#f1c40f";
      ctx.shadowColor = title.shadow || "rgba(0,0,0,.9)";
      ctx.shadowBlur = 3;

      ctx.fillText(
        title.text,
        px,
        py + player.radius + 19 + (index * 8)
      );
    });

    ctx.restore();
  }

  const ex = Math.cos(player.angle) * 6;
  const ey = Math.sin(player.angle) * 6;
  drawCircle(px + ex - 4, py + ey - 3, 3.5, '#fff');
  drawCircle(px + ex + 4, py + ey - 3, 3.5, '#fff');
  drawCircle(px + ex - 4, py + ey - 3, 1.8, '#111');
  drawCircle(px + ex + 4, py + ey - 3, 1.8, '#111');

  if (player.attackCooldown > 10) {
    ctx.beginPath();
    ctx.arc(px, py, player.attackRange, player.angle - 0.6, player.angle + 0.6);
    ctx.strokeStyle = 'rgba(255,100,50,0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  if (selectedBuild) {
    const gx = Math.floor(mouse.worldX / TILE) * TILE + TILE / 2 - camera.x;
    const gy = Math.floor(mouse.worldY / TILE) * TILE + TILE / 2 - camera.y;
    ctx.globalAlpha = 0.45;
    if (selectedBuild === 'wall' || selectedBuild === 'door') {
      drawRect(gx, gy, 34, 34, canAfford(selectedBuild) ? '#6f6' : '#f66');
    } else if (selectedBuild === 'turret') {
      drawCircle(gx, gy, 16, canAfford(selectedBuild) ? '#6f6' : '#f66');
    } else {
      drawRect(gx, gy, 30, 30, canAfford(selectedBuild) ? '#6f6' : '#f66');
    }
    ctx.globalAlpha = 1;
  }

  renderMinimap();
}

function renderMinimap() {
  const scale = 120 / (MAP_W * TILE);
  mctx.fillStyle = '#1a3a18';
  mctx.fillRect(0, 0, 120, 120);

  for (let y = 0; y < MAP_H; y += 3) {
    for (let x = 0; x < MAP_W; x += 3) {
      if (tiles[y][x] === 1) mctx.fillStyle = '#2a6aaa';
      else if (tiles[y][x] === 2) mctx.fillStyle = '#5a4a2a';
      else mctx.fillStyle = '#2d6a28';
      mctx.fillRect(x * TILE * scale, y * TILE * scale, 4, 4);
    }
  }

  mctx.fillStyle = '#4af';
  mctx.beginPath();
  mctx.arc(player.x * scale, player.y * scale, 3, 0, Math.PI * 2);
  mctx.fill();

  mctx.strokeStyle = 'rgba(255,255,255,0.5)';
  mctx.lineWidth = 1;
  mctx.strokeRect(camera.x * scale, camera.y * scale, W * scale, H * scale);
}

function updateUI() {
  document.getElementById('hp').textContent = Math.floor(player.hp);
  document.getElementById('armor').textContent = player.armor;
  document.getElementById('xp').textContent = Math.floor(player.xp);
  document.getElementById('xp-max').textContent = player.xpMax;
  document.getElementById('level').textContent = player.level;
  document.getElementById('wood').textContent = player.inv.wood || 0;
  document.getElementById('stone').textContent = player.inv.stone || 0;
  document.getElementById('iron').textContent = player.inv.iron || 0;
  document.getElementById('crystal').textContent = player.inv.crystal || 0;
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

updateUI();
loop();


/* =========================
   MENU SURVIVEIO
========================= */

const mainMenu = document.getElementById("main-menu");
const gameContainer = document.getElementById("game-container");
const playButton = document.getElementById("play-button");

if (playButton) {
    playButton.addEventListener("click", () => {
        mainMenu.style.display = "none";
        gameContainer.style.display = "block";

        if (typeof resizeCanvas === "function") {
            resizeCanvas();
        }

        if (typeof updateUI === "function") {
            updateUI();
        }
    });
}


/* =========================
   PANNEAUX DU MENU
========================= */

function openPanel(id) {
    const panel = document.getElementById(id);
    if (panel) {
        panel.classList.add("open");
    }
}

function closeAllPanels() {
    document.querySelectorAll(".overlay-panel").forEach(panel => {
        panel.classList.remove("open");
    });
}

document.getElementById("profile-button")?.addEventListener("click", () => {
    openPanel("profile-panel");
});

document.getElementById("skins-button")?.addEventListener("click", () => {
    openPanel("skins-panel");
});

document.getElementById("shop-button")?.addEventListener("click", function () {
    document.querySelectorAll(".overlay-panel").forEach(p => p.classList.remove("open"));
    document.getElementById("shop-panel")?.classList.add("open");
});

document.getElementById("leaderboard-button")?.addEventListener("click", function () {
    document.querySelectorAll(".overlay-panel").forEach(p => p.classList.remove("open"));
    document.getElementById("leaderboard-panel")?.classList.add("open");
});


const leaderboardTabs = document.querySelectorAll("#leaderboard-panel .leaderboard-tabs button");
const leaderboardValueTitle = document.querySelector("#leaderboard-panel .leader-row.header span:last-child");

leaderboardTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
        leaderboardTabs.forEach(button => button.classList.remove("active"));
        tab.classList.add("active");

        if (leaderboardValueTitle) {
            leaderboardValueTitle.textContent =
                index === 0 ? "SCORE" :
                index === 1 ? "VAGUES" :
                "ZOMBIES";
        }
    });
});

document.getElementById("clans-button")?.addEventListener("click", () => {
    openPanel("clans-panel");
});

document.querySelectorAll(".close-panel").forEach(button => {
    button.addEventListener("click", closeAllPanels);
});


/* =========================
   PSEUDO
========================= */

const nicknameInput = document.getElementById("nickname-input");
const saveNickname = document.getElementById("save-nickname");
const playerName = document.getElementById("player-name");
const profilePanel = document.getElementById("profile-panel");

let savedNickname = localStorage.getItem("surviveio_nickname") || "Player";

function resetNicknameInput() {
    if (nicknameInput) {
        nicknameInput.value = savedNickname;
    }
}

if (nicknameInput) {
    nicknameInput.value = savedNickname;
}

if (playerName) {
    playerName.textContent = savedNickname;
}

saveNickname?.addEventListener("click", () => {
    const nickname = nicknameInput.value.trim().slice(0, 16);

    if (!nickname) {
        resetNicknameInput();
        return;
    }

    savedNickname = nickname;

    localStorage.setItem("surviveio_nickname", savedNickname);

    if (playerName) {
        playerName.textContent = savedNickname;
    }

    if (profilePanel) {
        profilePanel.classList.remove("open");
    }
});

profilePanel?.querySelector(".close-panel")?.addEventListener("click", () => {
    resetNicknameInput();
});

/* =========================
   SKINS
========================= */

/* =========================
   SKINS — APERÇU + VALIDATION
========================= */

let selectedSkin =
    localStorage.getItem("deadlyio_skin") || "#f1c27d";

let previewSkin = selectedSkin;

function updateSkinPreview(color) {
    const profile = document.querySelector(".player-character");
    const preview = document.getElementById("skin-character");

    if (profile) {
        profile.style.backgroundColor = color;
    }

    if (preview) {
        preview.style.backgroundColor = color;
    }
}

document.querySelectorAll(".skin-color").forEach(button => {

    button.addEventListener("click", () => {

        previewSkin = button.dataset.skin;

        // Aperçu immédiat, sans sauvegarder
        updateSkinPreview(previewSkin);

    });

});

document.getElementById("save-skin")?.addEventListener("click", () => {

    selectedSkin = previewSkin;

    localStorage.setItem("deadlyio_skin", selectedSkin);

    updateSkinPreview(selectedSkin);

    const panel = document.getElementById("skins-panel");

    if (panel) {
        panel.classList.remove("open");
    }

});

updateSkinPreview(selectedSkin);

/* =========================
   STATISTIQUES MENU
========================= */

function updateMenuStats() {

    const score =
        Number(localStorage.getItem("surviveio_score")) || 0;

    const waves =
        Number(localStorage.getItem("surviveio_waves")) || 0;

    const kills =
        Number(localStorage.getItem("surviveio_kills")) || 0;

    const coins =
        Number(localStorage.getItem("surviveio_coins")) || 0;

    document.querySelectorAll(
        "#menu-score, #profile-score"
    ).forEach(element => {
        element.textContent = score;
    });

    document.querySelectorAll(
        "#menu-waves, #profile-waves"
    ).forEach(element => {
        element.textContent = waves;
    });

    document.querySelectorAll(
        "#menu-kills, #profile-kills"
    ).forEach(element => {
        element.textContent = kills;
    });

    document.querySelectorAll(
        "#menu-coins, #shop-coins"
    ).forEach(element => {
        element.textContent = coins;
    });
}

updateMenuStats();


/* SKINS — APERÇU FINAL */
document.querySelectorAll(".skin-color").forEach(button => {
    button.addEventListener("click", () => {
        const color = button.dataset.skin;
        const profile = document.querySelector(".player-character");
        const preview = document.getElementById("skin-character");

        if (profile) {
            profile.style.setProperty("background", color, "important");
        }

        if (preview) {
            preview.style.setProperty("background", color, "important");
        }
    });
});


/* SKINS — VALIDATION FINALE */
document.getElementById("save-skin")?.addEventListener("click", () => {
    const selectedButton = document.querySelector(".skin-color.selected");

    let color = selectedButton
        ? selectedButton.dataset.skin
        : previewSkin;

    if (!color) {
        color = "#f1c27d";
    }

    selectedSkin = color;

    localStorage.setItem("deadlyio_skin", color);

    const profile = document.querySelector(".player-character");
    const preview = document.getElementById("skin-character");

    if (profile) {
        profile.style.setProperty("background", color, "important");
    }

    if (preview) {
        preview.style.setProperty("background", color, "important");
    }

    const panel = document.getElementById("skins-panel");

    if (panel) {
        panel.classList.remove("open");
    }
});

/* =========================
   BOUTIQUE — APERÇU RGB
========================= */

document.querySelectorAll(".rgb-color").forEach(button => {
    button.addEventListener("click", () => {
        const color = button.dataset.rgb;
        const preview = document.getElementById("rgb-test-character");

        if (preview && color) {
            preview.style.background = color;
        }

        document.querySelectorAll(".rgb-color").forEach(item => {
            item.classList.remove("selected");
        });

        button.classList.add("selected");
    });
});


/* =========================
   TRAÎNÉE 1 — COMMUN
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[0];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const particles = [];

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    function createParticle() {
        particles.push({
            x: player.x - player.radius,
            y: player.y + (Math.random() - 0.5) * 14,
            size: Math.random() * 4 + 2,
            speed: Math.random() * 1.2 + 0.7,
            life: 1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (Math.random() < 0.5) {
            createParticle();
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];

            p.x -= p.speed;
            p.life -= 0.018;
            p.size *= 0.985;

            if (p.life <= 0 || p.size < 0.5) {
                particles.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = "#9a9a9a";
            ctx.fill();
        }

        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* BOUTIQUE — FOND APERÇU RGB */

document.querySelectorAll(".rgb-color").forEach(button => {
    button.addEventListener("click", () => {
        const color = button.dataset.rgb;
        const area = document.querySelector(".rgb-test-area");

        if (area && color) {
            area.style.setProperty("--rgb-preview-color", color);
        }
    });
});

/* =========================
   TRAÎNÉE 2 — COMMUN
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[1];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const particles = [];

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    function createParticle() {
        particles.push({
            x: player.x - player.radius,
            y: player.y + (Math.random() - 0.5) * 16,
            size: Math.random() * 2.5 + 1,
            speed: Math.random() * 1.8 + 1,
            life: 1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < 2; i++) {
            if (Math.random() < 0.8) {
                createParticle();
            }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];

            p.x -= p.speed;
            p.life -= 0.022;
            p.size *= 0.985;

            if (p.life <= 0 || p.size < 0.4) {
                particles.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.life * 0.8;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size + 1, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,255,255,0.15)";
            ctx.fill();

            ctx.globalAlpha = p.life;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = "#d8d8d8";
            ctx.fill();
        }

        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();

/* =========================
   TRAÎNÉE 3 — COMMUN
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[2];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const particles = [];

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    function createParticle() {
        particles.push({
            x: player.x - player.radius,
            y: player.y + (Math.random() - 0.5) * 20,
            size: Math.random() * 5 + 1,
            speed: Math.random() * 1.1 + 0.5,
            life: 1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (Math.random() < 0.65) {
            createParticle();
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];

            p.x -= p.speed;
            p.life -= 0.016;
            p.size *= 0.97;

            if (p.life <= 0 || p.size < 0.5) {
                particles.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.life * 0.7;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = "#707070";
            ctx.fill();
        }

        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();

/* =========================
   TRAÎNÉE 4 — COMMUN — RECTANGLE
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[3];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        /* RECTANGLE PLAT ET COURT */
        ctx.fillStyle = "#9a9a9a";
        ctx.fillRect(
            player.x - player.radius - 42,
            player.y - 5,
            42,
            10
        );

        /* JOUEUR FIXE */
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();

/* =========================
   TRAÎNÉE 5 — COMMUN — RECTANGLE COUPÉ
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[4];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#9a9a9a";

        /* PARTIE HAUTE */
        ctx.fillRect(
            player.x - player.radius - 42,
            player.y - 8,
            42,
            5
        );

        /* PARTIE BASSE */
        ctx.fillRect(
            player.x - player.radius - 42,
            player.y + 3,
            42,
            5
        );

        /* JOUEUR FIXE */
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();

/* =========================
   TRAÎNÉE 6 — COMMUN — TRIANGLE
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[5];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const edge = player.x - player.radius;

        /* TRIANGLE — BASE COLLÉE AU PERSONNAGE */
        ctx.beginPath();
        ctx.moveTo(edge, player.y - 15);
        ctx.lineTo(edge, player.y + 15);
        ctx.lineTo(edge - 38, player.y);
        ctx.closePath();

        ctx.fillStyle = "#9a9a9a";
        ctx.fill();

        /* JOUEUR FIXE */
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();

/* =========================
   TRAÎNÉE 1 — PEU COMMUN — FRAGMENTS ÉNERGÉTIQUES
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[6];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    const fragments = [];
    let timer = 0;

    function createFragment() {
        const edge = player.x - player.radius;

        fragments.push({
            x: edge - Math.random() * 8,
            y: player.y + (Math.random() - 0.5) * 22,
            size: Math.random() * 7 + 4,
            rotation: Math.random() * Math.PI,
            rotationSpeed: (Math.random() - 0.5) * 0.12,
            speed: Math.random() * 1.4 + 0.8,
            life: 1,
            hue: 185 + Math.random() * 70
        });
    }

    function drawFragment(f) {
        ctx.save();

        ctx.translate(f.x, f.y);
        ctx.rotate(f.rotation);
        ctx.globalAlpha = f.life;

        const gradient = ctx.createLinearGradient(
            -f.size,
            -f.size,
            f.size,
            f.size
        );

        gradient.addColorStop(0, `hsla(${f.hue}, 100%, 65%, 0)`);
        gradient.addColorStop(0.5, `hsla(${f.hue}, 100%, 65%, 1)`);
        gradient.addColorStop(1, `hsla(${f.hue}, 100%, 70%, 0)`);

        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(-f.size, 0);
        ctx.lineTo(0, -f.size * 0.55);
        ctx.lineTo(f.size, 0);
        ctx.lineTo(0, f.size * 0.55);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        timer++;

        if (timer % 4 === 0) {
            createFragment();
        }

        for (let i = fragments.length - 1; i >= 0; i--) {
            const f = fragments[i];

            f.x -= f.speed;
            f.rotation += f.rotationSpeed;
            f.life -= 0.018;
            f.size *= 0.995;

            if (f.life <= 0) {
                fragments.splice(i, 1);
                continue;
            }

            drawFragment(f);
        }

        const glow = ctx.createRadialGradient(
            player.x - player.radius,
            player.y,
            0,
            player.x - player.radius,
            player.y,
            25
        );

        glow.addColorStop(0, "rgba(70, 240, 255, 0.65)");
        glow.addColorStop(0.45, "rgba(70, 180, 255, 0.18)");
        glow.addColorStop(1, "rgba(70, 180, 255, 0)");

        ctx.fillStyle = glow;

        ctx.beginPath();
        ctx.arc(
            player.x - player.radius,
            player.y,
            25,
            0,
            Math.PI * 2
        );
        ctx.fill();

        /* JOUEUR FIXE */
        ctx.beginPath();
        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* =========================
   TRAÎNÉE 2 — PEU COMMUN — SPIRALE LUMINEUSE
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[7];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    let time = 0;

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        time += 0.055;

        const edge = player.x - player.radius;

        /* HALO DE DÉPART */
        const glow = ctx.createRadialGradient(
            edge,
            player.y,
            0,
            edge,
            player.y,
            25
        );

        glow.addColorStop(0, "rgba(180, 80, 255, 0.8)");
        glow.addColorStop(0.45, "rgba(80, 180, 255, 0.35)");
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(edge, player.y, 25, 0, Math.PI * 2);
        ctx.fill();

        /* SPIRALE */
        ctx.beginPath();

        for (let i = 0; i <= 70; i++) {
            const progress = i / 70;
            const x = edge - progress * 62;

            const wave =
                Math.sin(progress * Math.PI * 4 - time * 3) *
                (4 + progress * 9);

            const y = player.y + wave;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        const gradient = ctx.createLinearGradient(
            edge,
            0,
            edge - 65,
            0
        );

        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.25, "#b85cff");
        gradient.addColorStop(0.55, "#4ddcff");
        gradient.addColorStop(1, "rgba(70, 160, 255, 0)");

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#7c5cff";
        ctx.stroke();

        ctx.shadowBlur = 0;

        /* DEUXIÈME SPIRALE PLUS FINE */
        ctx.beginPath();

        for (let i = 0; i <= 55; i++) {
            const progress = i / 55;
            const x = edge - progress * 55;

            const wave =
                Math.sin(progress * Math.PI * 4 + time * 2) *
                (2 + progress * 6);

            const y = player.y + wave;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        /* JOUEUR FIXE */
        ctx.beginPath();
        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* =========================
   TRAÎNÉE 3 — PEU COMMUN — FLAMME PRISMATIQUE
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[8];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    let time = 0;

    /* Décalage léger vers la droite */
    const trailOffset = 5;

    function drawFlame() {
        const edge =
            player.x -
            player.radius +
            trailOffset;

        ctx.beginPath();

        for (let i = 0; i <= 90; i++) {
            const t = i / 90;

            const x = edge - t * 72;

            const wave =
                Math.sin(
                    t * 14 -
                    time * 3.2
                ) *
                (1.5 + t * 5.5);

            const width =
                12 *
                Math.pow(1 - t, 0.62);

            const y = player.y + wave;

            if (i === 0) {
                ctx.moveTo(
                    x,
                    y - width
                );
            } else {
                ctx.lineTo(
                    x,
                    y - width
                );
            }
        }

        for (let i = 90; i >= 0; i--) {
            const t = i / 90;

            const x = edge - t * 72;

            const wave =
                Math.sin(
                    t * 14 -
                    time * 3.2
                ) *
                (1.5 + t * 5.5);

            const width =
                12 *
                Math.pow(1 - t, 0.62);

            const y = player.y + wave;

            ctx.lineTo(
                x,
                y + width
            );
        }

        ctx.closePath();

        const gradient =
            ctx.createLinearGradient(
                edge,
                0,
                edge - 72,
                0
            );

        gradient.addColorStop(
            0,
            "#ffffff"
        );

        gradient.addColorStop(
            0.18,
            "#5df6ff"
        );

        gradient.addColorStop(
            0.42,
            "#4f8cff"
        );

        gradient.addColorStop(
            0.68,
            "#b84cff"
        );

        gradient.addColorStop(
            0.86,
            "#ff4fd8"
        );

        gradient.addColorStop(
            1,
            "rgba(255,70,210,0)"
        );

        ctx.fillStyle = gradient;

        ctx.shadowBlur = 14;
        ctx.shadowColor =
            "rgba(100,170,255,0.8)";

        ctx.fill();

        ctx.shadowBlur = 0;
    }

    function animate() {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        time += 0.035;

        const edge =
            player.x -
            player.radius +
            trailOffset;

        /* FUSION AVEC LE PERSONNAGE */
        const fusion =
            ctx.createRadialGradient(
                edge,
                player.y,
                0,
                edge,
                player.y,
                18
            );

        fusion.addColorStop(
            0,
            "rgba(255,255,255,0.95)"
        );

        fusion.addColorStop(
            0.35,
            "rgba(95,240,255,0.8)"
        );

        fusion.addColorStop(
            0.7,
            "rgba(150,70,255,0.35)"
        );

        fusion.addColorStop(
            1,
            "rgba(150,70,255,0)"
        );

        ctx.fillStyle = fusion;

        ctx.beginPath();

        ctx.arc(
            edge,
            player.y,
            18,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /* FLAMME */
        drawFlame();

        /* PERSONNAGE */
        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* =========================
   TRAÎNÉE 1 — RARE — VORTEX RGB
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[9];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    let time = 0;

    function drawVortex() {
        const edge =
            player.x -
            player.radius +
            4;

        /* AXE DU VORTEX */
        for (let ring = 0; ring < 8; ring++) {
            const progress = ring / 8;

            const centerX =
                edge -
                progress * 68;

            const radius =
                4 +
                progress * 15;

            const rotation =
                time * (2.8 - progress) +
                ring * 0.8;

            const hue =
                (time * 110 +
                ring * 48) % 360;

            ctx.save();

            ctx.translate(
                centerX,
                player.y
            );

            ctx.rotate(rotation);

            ctx.beginPath();

            ctx.ellipse(
                0,
                0,
                radius,
                radius * 0.28,
                0,
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                `hsla(${hue},100%,65%,${0.85 - progress * 0.07})`;

            ctx.lineWidth =
                2.2 - progress * 0.8;

            ctx.shadowBlur = 9;

            ctx.shadowColor =
                `hsla(${hue},100%,65%,0.9)`;

            ctx.stroke();

            ctx.restore();
        }

        /* FRAGMENTS QUI TOURNENT AUTOUR */
        for (let i = 0; i < 18; i++) {
            const progress = i / 18;

            const centerX =
                edge -
                progress * 72;

            const orbit =
                5 +
                progress * 14;

            const angle =
                time * 4 +
                i * 1.7;

            const x =
                centerX +
                Math.cos(angle) * orbit;

            const y =
                player.y +
                Math.sin(angle) *
                orbit *
                0.42;

            const hue =
                (time * 120 + i * 25) % 360;

            const size =
                1.5 +
                (1 - progress) * 2;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                size,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `hsla(${hue},100%,70%,${1 - progress * 0.65})`;

            ctx.shadowBlur = 8;

            ctx.shadowColor =
                `hsla(${hue},100%,65%,0.9)`;

            ctx.fill();
        }

        ctx.shadowBlur = 0;
    }

    function animate() {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        time += 0.025;

        const edge =
            player.x -
            player.radius +
            4;

        /* NOYAU RGB */
        const hue =
            (time * 110) % 360;

        const core =
            ctx.createRadialGradient(
                edge,
                player.y,
                0,
                edge,
                player.y,
                18
            );

        core.addColorStop(
            0,
            "#ffffff"
        );

        core.addColorStop(
            0.25,
            `hsla(${hue},100%,70%,0.9)`
        );

        core.addColorStop(
            0.6,
            `hsla(${hue + 80},100%,60%,0.35)`
        );

        core.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        ctx.fillStyle = core;

        ctx.beginPath();

        ctx.arc(
            edge,
            player.y,
            18,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /* VORTEX */
        drawVortex();

        /* JOUEUR FIXE */
        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* =========================
   TRAÎNÉE 2 — RARE — FLAMME
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[10];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    let time = 0;

    function flamePart(offset, scale, alpha) {
        const edge = player.x - player.radius + 3;

        ctx.beginPath();

        for (let i = 0; i <= 55; i++) {
            const t = i / 55;

            const x = edge - t * 68;

            const wave =
                Math.sin(
                    t * 11 -
                    time * 5 +
                    offset
                ) *
                (2 + t * 7);

            const height =
                scale *
                (1 - t * 0.78) *
                (
                    0.65 +
                    0.35 *
                    Math.sin(
                        t * 8 +
                        time * 3 +
                        offset
                    )
                );

            const y = player.y + wave;

            if (i === 0) {
                ctx.moveTo(x, y - height);
            } else {
                ctx.lineTo(x, y - height);
            }
        }

        for (let i = 55; i >= 0; i--) {
            const t = i / 55;

            const x = edge - t * 68;

            const wave =
                Math.sin(
                    t * 11 -
                    time * 5 +
                    offset
                ) *
                (2 + t * 7);

            const height =
                scale *
                (1 - t * 0.78) *
                (
                    0.65 +
                    0.35 *
                    Math.sin(
                        t * 8 +
                        time * 3 +
                        offset
                    )
                );

            const y = player.y + wave;

            ctx.lineTo(x, y + height);
        }

        ctx.closePath();

        const gradient = ctx.createLinearGradient(
            edge,
            0,
            edge - 68,
            0
        );

        gradient.addColorStop(
            0,
            `rgba(255,255,210,${alpha})`
        );

        gradient.addColorStop(
            0.2,
            `rgba(255,210,45,${alpha})`
        );

        gradient.addColorStop(
            0.48,
            `rgba(255,105,15,${alpha * 0.9})`
        );

        gradient.addColorStop(
            0.75,
            `rgba(245,45,10,${alpha * 0.55})`
        );

        gradient.addColorStop(
            1,
            "rgba(150,20,5,0)"
        );

        ctx.fillStyle = gradient;
        ctx.fill();
    }

    function animate() {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        time += 0.035;

        const edge =
            player.x -
            player.radius +
            3;

        /* HALO DE CHALEUR */
        const heat = ctx.createRadialGradient(
            edge,
            player.y,
            0,
            edge,
            player.y,
            22
        );

        heat.addColorStop(
            0,
            "rgba(255,245,180,0.9)"
        );

        heat.addColorStop(
            0.4,
            "rgba(255,100,20,0.4)"
        );

        heat.addColorStop(
            1,
            "rgba(255,30,0,0)"
        );

        ctx.fillStyle = heat;

        ctx.beginPath();
        ctx.arc(
            edge,
            player.y,
            22,
            0,
            Math.PI * 2
        );
        ctx.fill();

        /* FLAMMES */
        ctx.save();

        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(255,70,10,0.75)";

        flamePart(0, 13, 0.9);
        flamePart(2.2, 8, 0.95);
        flamePart(4.5, 5, 0.8);

        ctx.restore();

        /* PETITES BRAISES */
        for (let i = 0; i < 12; i++) {
            const t =
                (i / 12 + time * 0.18) % 1;

            const x =
                edge -
                8 -
                t * 62;

            const y =
                player.y +
                Math.sin(
                    t * 18 +
                    i
                ) * 12 -
                t * 5;

            const size =
                1 +
                (1 - t) * 1.5;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                size,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `rgba(255,${130 + i * 5},40,${1 - t})`;

            ctx.fill();
        }

        /* JOUEUR */
        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* =========================
   TRAÎNÉE 3 — RARE — EAU
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[11];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    let time = 0;

    function drawWaterWave(offset, amplitude, alpha) {
        const edge =
            player.x -
            player.radius +
            4;

        ctx.beginPath();

        for (let i = 0; i <= 80; i++) {
            const t = i / 80;

            const x =
                edge -
                t * 76;

            const wave =
                Math.sin(
                    t * 15 -
                    time * 3.5 +
                    offset
                ) *
                amplitude *
                (0.4 + t * 0.8);

            const width =
                8 *
                Math.pow(1 - t, 0.45);

            const y =
                player.y +
                wave;

            if (i === 0) {
                ctx.moveTo(
                    x,
                    y - width
                );
            } else {
                ctx.lineTo(
                    x,
                    y - width
                );
            }
        }

        for (let i = 80; i >= 0; i--) {
            const t = i / 80;

            const x =
                edge -
                t * 76;

            const wave =
                Math.sin(
                    t * 15 -
                    time * 3.5 +
                    offset
                ) *
                amplitude *
                (0.4 + t * 0.8);

            const width =
                8 *
                Math.pow(1 - t, 0.45);

            const y =
                player.y +
                wave;

            ctx.lineTo(
                x,
                y + width
            );
        }

        ctx.closePath();

        const gradient = ctx.createLinearGradient(
            edge,
            0,
            edge - 76,
            0
        );

        gradient.addColorStop(
            0,
            `rgba(190,250,255,${alpha})`
        );

        gradient.addColorStop(
            0.25,
            `rgba(50,190,255,${alpha})`
        );

        gradient.addColorStop(
            0.55,
            `rgba(20,100,220,${alpha * 0.8})`
        );

        gradient.addColorStop(
            0.8,
            `rgba(20,60,180,${alpha * 0.4})`
        );

        gradient.addColorStop(
            1,
            "rgba(10,50,150,0)"
        );

        ctx.fillStyle = gradient;
        ctx.fill();
    }

    function animate() {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        time += 0.04;

        const edge =
            player.x -
            player.radius +
            4;

        /* FUSION LIQUIDE */
        const glow = ctx.createRadialGradient(
            edge,
            player.y,
            0,
            edge,
            player.y,
            20
        );

        glow.addColorStop(
            0,
            "rgba(220,255,255,0.95)"
        );

        glow.addColorStop(
            0.35,
            "rgba(40,200,255,0.6)"
        );

        glow.addColorStop(
            1,
            "rgba(0,100,255,0)"
        );

        ctx.fillStyle = glow;

        ctx.beginPath();
        ctx.arc(
            edge,
            player.y,
            20,
            0,
            Math.PI * 2
        );
        ctx.fill();

        /* VAGUES */
        drawWaterWave(
            0,
            5,
            0.8
        );

        drawWaterWave(
            2.8,
            3,
            0.55
        );

        /* GOUTTES */
        for (let i = 0; i < 14; i++) {
            const progress =
                (i / 14 + time * 0.16) % 1;

            const x =
                edge -
                progress * 70;

            const y =
                player.y +
                Math.sin(
                    progress * 20 +
                    i * 1.7
                ) *
                (5 + progress * 11);

            const radius =
                1.2 +
                (1 - progress) * 1.8;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                radius,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `rgba(90,220,255,${1 - progress * 0.7})`;

            ctx.fill();
        }

        /* PETITES ÉCLABOUSSURES */
        for (let i = 0; i < 5; i++) {
            const angle =
                time * 2 +
                i * 1.25;

            const distance =
                9 +
                Math.sin(time * 3 + i) * 4;

            const x =
                edge -
                8 +
                Math.cos(angle) * distance;

            const y =
                player.y +
                Math.sin(angle) *
                distance *
                0.45;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                1.5,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                "rgba(180,245,255,0.8)";

            ctx.fill();
        }

        /* JOUEUR */
        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* =========================
   TRAÎNÉE 1 — ÉPIQUE — LUMIÈRE
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[12];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    let time = 0;

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        time += 0.025;

        const edge = player.x - player.radius + 3;

        /* HALO */
        const halo = ctx.createRadialGradient(
            edge, player.y, 0,
            edge, player.y, 30
        );

        halo.addColorStop(0, "rgba(255,255,255,1)");
        halo.addColorStop(0.2, "rgba(255,255,255,0.85)");
        halo.addColorStop(0.5, "rgba(235,245,255,0.4)");
        halo.addColorStop(1, "rgba(255,255,255,0)");

        ctx.fillStyle = halo;

        ctx.beginPath();
        ctx.arc(edge, player.y, 30, 0, Math.PI * 2);
        ctx.fill();

        /* TRAÎNÉE BLANCHE */
        const light = ctx.createLinearGradient(
            edge, 0,
            edge - 80, 0
        );

        light.addColorStop(0, "rgba(255,255,255,0.95)");
        light.addColorStop(0.25, "rgba(255,255,255,0.7)");
        light.addColorStop(0.55, "rgba(235,245,255,0.3)");
        light.addColorStop(1, "rgba(255,255,255,0)");

        ctx.save();

        ctx.shadowBlur = 24;
        ctx.shadowColor = "rgba(255,255,255,1)";
        ctx.fillStyle = light;

        ctx.beginPath();
        ctx.moveTo(edge, player.y - 8);
        ctx.lineTo(edge - 80, player.y);
        ctx.lineTo(edge, player.y + 8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        /* PETITES PARTICULES */
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        for (let i = 0; i < 55; i++) {
            const progress = (i / 55 + time * 0.14) % 1;

            const x = edge - progress * 88;

            const spread = 3 + progress * 19;

            const y =
                player.y +
                Math.sin(i * 2.4 + time * 3.2) * spread;

            const size =
                0.5 + ((i * 13) % 5) * 0.4;

            const alpha = 1 - progress * 0.9;

            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);

            ctx.fillStyle =
                `rgba(255,255,255,${alpha})`;

            ctx.shadowBlur = 8;
            ctx.shadowColor = "#ffffff";

            ctx.fill();
        }

        ctx.restore();

        /* GROS PARTICULES */
        for (let i = 0; i < 9; i++) {
            const progress = (i / 9 + time * 0.08) % 1;

            const x = edge - progress * 78;

            const y =
                player.y +
                Math.sin(time * 2 + i * 2.1) *
                (8 + progress * 9);

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                1.5 + (i % 3) * 0.7,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `rgba(255,255,255,${0.8 - progress * 0.5})`;

            ctx.fill();
        }

        /* JOUEUR */
        ctx.beginPath();
        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* =========================
   TRAÎNÉE 2 — ÉPIQUE — OMBRE PLUME
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[13];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    let time = 0;

    function drawFeather() {
        const edge = player.x - player.radius + 4;

        /* CORPS DE LA PLUME */
        ctx.beginPath();

        for (let i = 0; i <= 80; i++) {
            const t = i / 80;

            const x = edge - t * 82;

            const curve =
                Math.sin(t * 5 - time * 1.4) *
                (2 + t * 5);

            const width =
                16 *
                Math.sin(Math.PI * Math.pow(t, 0.72));

            const y = player.y + curve;

            if (i === 0) {
                ctx.moveTo(x, y - width);
            } else {
                ctx.lineTo(x, y - width);
            }
        }

        for (let i = 80; i >= 0; i--) {
            const t = i / 80;

            const x = edge - t * 82;

            const curve =
                Math.sin(t * 5 - time * 1.4) *
                (2 + t * 5);

            const width =
                16 *
                Math.sin(Math.PI * Math.pow(t, 0.72));

            const y = player.y + curve;

            ctx.lineTo(x, y + width);
        }

        ctx.closePath();

        const shadow = ctx.createLinearGradient(
            edge,
            player.y - 20,
            edge - 82,
            player.y + 20
        );

        shadow.addColorStop(0, "rgba(65,65,75,0.98)");
        shadow.addColorStop(0.3, "rgba(35,35,45,0.95)");
        shadow.addColorStop(0.65, "rgba(15,15,22,0.8)");
        shadow.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = shadow;

        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(0,0,0,0.9)";

        ctx.fill();

        ctx.shadowBlur = 0;

        /* NERVURE */
        ctx.beginPath();

        ctx.moveTo(edge, player.y);

        ctx.lineTo(
            edge - 77,
            player.y +
            Math.sin(time * 1.4) * 4
        );

        ctx.strokeStyle = "rgba(100,100,110,0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();

        /* BARBES */
        for (let i = 0; i < 15; i++) {
            const t = i / 15;

            const x = edge - 5 - t * 68;

            const y =
                player.y +
                Math.sin(t * 5 - time * 1.4) *
                (2 + t * 5);

            const length =
                5 +
                Math.sin(t * Math.PI) * 12;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 11, y - length);

            ctx.strokeStyle =
                `rgba(55,55,65,${0.9 - t * 0.5})`;

            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 11, y + length);

            ctx.strokeStyle =
                `rgba(8,8,12,${0.85 - t * 0.45})`;

            ctx.stroke();
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        time += 0.025;

        drawFeather();

        /* PLUMES QUI SE DÉTACHENT */
        for (let i = 0; i < 10; i++) {
            const progress = (i / 10 + time * 0.09) % 1;

            const x =
                player.x -
                player.radius -
                progress * 78;

            const y =
                player.y +
                Math.sin(time * 2 + i * 2.4) *
                (8 + progress * 10);

            ctx.save();

            ctx.translate(x, y);
            ctx.rotate(time * 2 + i);

            ctx.beginPath();
            ctx.moveTo(0, -4);
            ctx.lineTo(7, 0);
            ctx.lineTo(0, 4);
            ctx.lineTo(-3, 0);
            ctx.closePath();

            ctx.fillStyle =
                `rgba(25,25,32,${0.75 - progress * 0.6})`;

            ctx.fill();

            ctx.restore();
        }

        /* JOUEUR */
        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* =========================
   TRAÎNÉE 1 — LÉGENDAIRE — ANGE
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[14];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    let time = 0;

    function drawWing(side, flap) {
        const x = player.x - player.radius + 2;
        const y = player.y;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(side, 1);

        ctx.beginPath();

        ctx.moveTo(0, -2);

        ctx.bezierCurveTo(
            -12, -12 + flap,
            -28, -20 + flap,
            -43, -12 + flap
        );

        ctx.bezierCurveTo(
            -56, -5 + flap,
            -68, 8 + flap,
            -78, 19 + flap
        );

        ctx.bezierCurveTo(
            -59, 14 + flap,
            -43, 9 + flap,
            -28, 5 + flap
        );

        ctx.bezierCurveTo(
            -15, 2 + flap,
            -7, 1 + flap,
            0, 4
        );

        ctx.closePath();

        const gradient = ctx.createLinearGradient(
            0, -20,
            -80, 20
        );

        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.35, "#f9fbff");
        gradient.addColorStop(0.7, "#dce5f0");
        gradient.addColorStop(1, "rgba(170,185,205,0)");

        ctx.fillStyle = gradient;

        ctx.shadowBlur = 18;
        ctx.shadowColor = "rgba(255,255,255,0.95)";

        ctx.fill();

        ctx.shadowBlur = 0;

        /* PLUMES */
        for (let i = 0; i < 11; i++) {
            const t = i / 11;

            const px = -10 - t * 62;
            const py = -3 + t * 20 + flap * t * 0.5;

            const length =
                8 + Math.sin(t * Math.PI) * 11;

            ctx.beginPath();

            ctx.moveTo(px, py);

            ctx.quadraticCurveTo(
                px - length * 0.5,
                py - 4,
                px - length,
                py - 6
            );

            ctx.strokeStyle =
                `rgba(255,255,255,${0.95 - t * 0.35})`;

            ctx.lineWidth = 2;

            ctx.stroke();
        }

        ctx.restore();
    }

    function drawHalo() {
        const x = player.x;
        const y =
            player.y -
            31 +
            Math.sin(time * 2) * 1.5;

        ctx.save();

        ctx.translate(x, y);

        ctx.rotate(
            Math.sin(time * 1.4) * 0.08
        );

        /* LUMIÈRE DE L'ANNEAU */
        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            17,
            5.5,
            0,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle = "#fff7b0";
        ctx.lineWidth = 5;

        ctx.shadowBlur = 20;
        ctx.shadowColor = "#fff4a0";

        ctx.stroke();

        /* CENTRE BLANC */
        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            14,
            4,
            0,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;

        ctx.stroke();

        ctx.restore();
    }

    function drawLightTrail() {
        const edge =
            player.x -
            player.radius +
            3;

        const gradient = ctx.createLinearGradient(
            edge,
            0,
            edge - 105,
            0
        );

        gradient.addColorStop(
            0,
            "rgba(255,255,255,0.95)"
        );

        gradient.addColorStop(
            0.2,
            "rgba(255,250,210,0.75)"
        );

        gradient.addColorStop(
            0.5,
            "rgba(255,235,150,0.4)"
        );

        gradient.addColorStop(
            0.8,
            "rgba(255,255,255,0.1)"
        );

        gradient.addColorStop(
            1,
            "rgba(255,255,255,0)"
        );

        ctx.save();

        ctx.shadowBlur = 24;
        ctx.shadowColor =
            "rgba(255,245,170,0.9)";

        ctx.fillStyle = gradient;

        ctx.beginPath();

        ctx.moveTo(
            edge,
            player.y - 8
        );

        ctx.quadraticCurveTo(
            edge - 40,
            player.y - 3 +
            Math.sin(time * 2) * 5,
            edge - 105,
            player.y
        );

        ctx.quadraticCurveTo(
            edge - 40,
            player.y + 3 +
            Math.sin(time * 2) * 5,
            edge,
            player.y + 8
        );

        ctx.closePath();

        ctx.fill();

        ctx.restore();
    }

    function drawFeathers() {
        const edge =
            player.x -
            player.radius;

        for (let i = 0; i < 14; i++) {
            const progress =
                (i / 14 + time * 0.07) % 1;

            const x =
                edge -
                progress * 100;

            const y =
                player.y +
                Math.sin(
                    time * 1.8 +
                    i * 2.1
                ) *
                (7 + progress * 15);

            const alpha =
                0.9 -
                progress * 0.8;

            ctx.save();

            ctx.translate(x, y);

            ctx.rotate(
                Math.sin(time * 2 + i) * 0.8
            );

            const size =
                2.8 -
                progress * 1.2;

            ctx.beginPath();

            ctx.moveTo(0, -size * 2.2);

            ctx.quadraticCurveTo(
                -size * 2,
                0,
                0,
                size * 2.2
            );

            ctx.quadraticCurveTo(
                size * 2,
                0,
                0,
                -size * 2.2
            );

            ctx.closePath();

            ctx.fillStyle =
                `rgba(255,255,255,${alpha})`;

            ctx.shadowBlur = 8;
            ctx.shadowColor =
                "rgba(255,255,255,0.9)";

            ctx.fill();

            ctx.restore();
        }
    }

    function animate() {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        time += 0.025;

        const flap =
            Math.sin(time * 2.2) * 8;

        /* TRAÎNÉE */
        drawLightTrail();

        /* PLUMES */
        drawFeathers();

        /* AILES */
        drawWing(1, flap);
        drawWing(-1, flap);

        /* HALO */
        drawHalo();

        /* GLOW DU PERSONNAGE */
        const glow = ctx.createRadialGradient(
            player.x,
            player.y,
            0,
            player.x,
            player.y,
            28
        );

        glow.addColorStop(
            0,
            "rgba(255,255,255,0.85)"
        );

        glow.addColorStop(
            0.35,
            "rgba(255,245,180,0.4)"
        );

        glow.addColorStop(
            1,
            "rgba(255,255,255,0)"
        );

        ctx.fillStyle = glow;

        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            28,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /* JOUEUR */
        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();

/* =========================
   TRAÎNÉE 2 — LÉGENDAIRE — DÉMON
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[15];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    let time = 0;

    /* =========================
       AILES DÉMONIAQUES
    ========================= */

    function drawDemonWing(side, flap) {
        const x =
            player.x -
            player.radius +
            2;

        const y = player.y;

        ctx.save();

        ctx.translate(x, y);
        ctx.scale(side, 1);

        ctx.beginPath();

        ctx.moveTo(0, -2);

        ctx.bezierCurveTo(
            -13,
            -12 + flap,
            -25,
            -25 + flap,
            -39,
            -23 + flap
        );

        ctx.lineTo(
            -52,
            -13 + flap
        );

        ctx.lineTo(
            -67,
            -25 + flap
        );

        ctx.lineTo(
            -61,
            -7 + flap
        );

        ctx.lineTo(
            -78,
            -13 + flap
        );

        ctx.lineTo(
            -65,
            4 + flap
        );

        ctx.bezierCurveTo(
            -48,
            13 + flap,
            -25,
            8 + flap,
            0,
            5
        );

        ctx.closePath();

        const wingGradient =
            ctx.createLinearGradient(
                0,
                -25,
                -80,
                15
            );

        wingGradient.addColorStop(
            0,
            "#351018"
        );

        wingGradient.addColorStop(
            0.35,
            "#180b10"
        );

        wingGradient.addColorStop(
            0.7,
            "#080609"
        );

        wingGradient.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        ctx.fillStyle = wingGradient;

        ctx.shadowBlur = 18;
        ctx.shadowColor =
            "rgba(255,20,30,0.65)";

        ctx.fill();

        ctx.shadowBlur = 0;

        /* MEMBRANES */
        for (let i = 0; i < 5; i++) {
            const px =
                -10 -
                i * 13;

            const py =
                -4 +
                i * 3 +
                flap * 0.3;

            ctx.beginPath();

            ctx.moveTo(
                px,
                py
            );

            ctx.lineTo(
                px - 20,
                py - 18
            );

            ctx.strokeStyle =
                `rgba(120,20,30,${0.8 - i * 0.1})`;

            ctx.lineWidth = 1.5;

            ctx.stroke();
        }

        /* BORD ROUGE */
        ctx.beginPath();

        ctx.moveTo(0, 1);

        ctx.bezierCurveTo(
            -22,
            -13 + flap,
            -45,
            -8 + flap,
            -78,
            -13 + flap
        );

        ctx.strokeStyle =
            "rgba(255,35,45,0.75)";

        ctx.lineWidth = 2;

        ctx.shadowBlur = 8;
        ctx.shadowColor =
            "rgba(255,20,30,0.9)";

        ctx.stroke();

        ctx.restore();
    }

    /* =========================
       CORNES
    ========================= */

    function drawHorns() {
        ctx.save();

        ctx.translate(
            player.x,
            player.y
        );

        /* CORNE GAUCHE */
        ctx.beginPath();

        ctx.moveTo(-10, -12);

        ctx.quadraticCurveTo(
            -18,
            -24,
            -13,
            -31
        );

        ctx.quadraticCurveTo(
            -6,
            -23,
            -5,
            -11
        );

        ctx.closePath();

        ctx.fillStyle = "#13070a";

        ctx.shadowBlur = 8;
        ctx.shadowColor =
            "rgba(255,30,40,0.7)";

        ctx.fill();

        /* CORNE DROITE */
        ctx.beginPath();

        ctx.moveTo(10, -12);

        ctx.quadraticCurveTo(
            18,
            -24,
            13,
            -31
        );

        ctx.quadraticCurveTo(
            6,
            -23,
            5,
            -11
        );

        ctx.closePath();

        ctx.fill();

        ctx.restore();
    }

    /* =========================
       AURA DÉMONIAQUE
    ========================= */

    function drawAura() {
        const gradient =
            ctx.createRadialGradient(
                player.x,
                player.y,
                4,
                player.x,
                player.y,
                32
            );

        gradient.addColorStop(
            0,
            "rgba(255,60,50,0.4)"
        );

        gradient.addColorStop(
            0.35,
            "rgba(180,15,25,0.25)"
        );

        gradient.addColorStop(
            0.7,
            "rgba(70,0,10,0.15)"
        );

        gradient.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        ctx.fillStyle = gradient;

        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            32,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    /* =========================
       TRAÎNÉE NOIRE / ROUGE
    ========================= */

    function drawDemonTrail() {
        const edge =
            player.x -
            player.radius +
            3;

        const gradient =
            ctx.createLinearGradient(
                edge,
                0,
                edge - 105,
                0
            );

        gradient.addColorStop(
            0,
            "rgba(255,45,40,0.85)"
        );

        gradient.addColorStop(
            0.18,
            "rgba(180,15,25,0.75)"
        );

        gradient.addColorStop(
            0.45,
            "rgba(70,5,15,0.55)"
        );

        gradient.addColorStop(
            0.75,
            "rgba(15,5,10,0.3)"
        );

        gradient.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        ctx.save();

        ctx.shadowBlur = 22;
        ctx.shadowColor =
            "rgba(255,20,25,0.8)";

        ctx.fillStyle = gradient;

        ctx.beginPath();

        ctx.moveTo(
            edge,
            player.y - 9
        );

        ctx.bezierCurveTo(
            edge - 25,
            player.y - 3 +
            Math.sin(time * 3) * 6,

            edge - 55,
            player.y + 8 +
            Math.sin(time * 2.4) * 9,

            edge - 105,
            player.y +
            Math.sin(time * 2) * 8
        );

        ctx.bezierCurveTo(
            edge - 60,
            player.y + 15 +
            Math.sin(time * 2.4) * 9,

            edge - 25,
            player.y + 5,

            edge,
            player.y + 9
        );

        ctx.closePath();

        ctx.fill();

        ctx.restore();
    }

    /* =========================
       BRAISES
    ========================= */

    function drawEmbers() {
        const edge =
            player.x -
            player.radius;

        for (let i = 0; i < 24; i++) {
            const progress =
                (i / 24 + time * 0.16) % 1;

            const x =
                edge -
                progress * 105;

            const y =
                player.y +
                Math.sin(
                    time * 3 +
                    i * 2.1
                ) *
                (5 + progress * 16);

            const size =
                1 +
                (1 - progress) * 2;

            const alpha =
                1 -
                progress * 0.85;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                size,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `rgba(255,${45 + i * 3},${20 + i},${alpha})`;

            ctx.shadowBlur = 9;
            ctx.shadowColor =
                "rgba(255,30,20,0.9)";

            ctx.fill();
        }

        ctx.shadowBlur = 0;
    }

    /* =========================
       FUMÉE
    ========================= */

    function drawSmoke() {
        const edge =
            player.x -
            player.radius;

        for (let i = 0; i < 10; i++) {
            const progress =
                (i / 10 + time * 0.05) % 1;

            const x =
                edge -
                progress * 85;

            const y =
                player.y +
                Math.sin(
                    time +
                    i * 1.7
                ) *
                (8 + progress * 10);

            const radius =
                3 +
                progress * 6;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                radius,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `rgba(10,5,8,${0.18 - progress * 0.12})`;

            ctx.fill();
        }
    }

    /* =========================
       ANIMATION
    ========================= */

    function animate() {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        time += 0.025;

        const flap =
            Math.sin(time * 2.1) * 8;

        /* FUMÉE */
        drawSmoke();

        /* TRAÎNÉE */
        drawDemonTrail();

        /* BRAISES */
        drawEmbers();

        /* AILES */
        drawDemonWing(1, flap);
        drawDemonWing(-1, flap);

        /* AURA */
        drawAura();

        /* CORNES */
        drawHorns();

        /* JOUEUR */
        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";

        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* =========================
   TRAÎNÉE 1 — MYTHIQUE — ENTITÉ COSMIQUE
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[16];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    let time = 0;

    /* =========================
       ÉTOILES FIXES / PROFONDEUR
    ========================= */

    const stars = [];

    for (let i = 0; i < 42; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: 0.5 + Math.random() * 1.6,
            speed: 0.2 + Math.random() * 0.7,
            phase: Math.random() * Math.PI * 2
        });
    }

    function drawStars() {
        for (const star of stars) {
            const twinkle =
                0.45 +
                Math.sin(
                    time * star.speed * 3 +
                    star.phase
                ) * 0.35;

            ctx.beginPath();

            ctx.arc(
                star.x,
                star.y,
                star.size,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `rgba(220,235,255,${twinkle})`;

            ctx.fill();
        }
    }

    /* =========================
       NÉBULEUSE
    ========================= */

    function drawNebula() {
        const edge =
            player.x -
            player.radius +
            5;

        const gradient =
            ctx.createLinearGradient(
                edge,
                player.y,
                edge - 125,
                player.y
            );

        gradient.addColorStop(
            0,
            "rgba(170,80,255,0.28)"
        );

        gradient.addColorStop(
            0.25,
            "rgba(70,100,255,0.22)"
        );

        gradient.addColorStop(
            0.5,
            "rgba(190,30,255,0.15)"
        );

        gradient.addColorStop(
            0.75,
            "rgba(20,60,180,0.08)"
        );

        gradient.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        ctx.save();

        ctx.globalCompositeOperation =
            "lighter";

        ctx.fillStyle = gradient;

        ctx.beginPath();

        ctx.moveTo(
            edge,
            player.y - 15
        );

        ctx.bezierCurveTo(
            edge - 35,
            player.y - 25 +
            Math.sin(time * 1.2) * 8,

            edge - 80,
            player.y + 22 +
            Math.sin(time * 1.5) * 10,

            edge - 125,
            player.y +
            Math.sin(time) * 12
        );

        ctx.bezierCurveTo(
            edge - 80,
            player.y + 28,

            edge - 35,
            player.y + 17,

            edge,
            player.y + 15
        );

        ctx.closePath();

        ctx.fill();

        ctx.restore();
    }

    /* =========================
       TROU NOIR
    ========================= */

    function drawBlackHole() {
        const x =
            player.x -
            player.radius -
            5;

        const y = player.y;

        /* HALO GRAVITATIONNEL */
        const halo =
            ctx.createRadialGradient(
                x,
                y,
                5,
                x,
                y,
                34
            );

        halo.addColorStop(
            0,
            "rgba(0,0,0,1)"
        );

        halo.addColorStop(
            0.28,
            "rgba(20,5,35,1)"
        );

        halo.addColorStop(
            0.48,
            "rgba(150,40,255,0.55)"
        );

        halo.addColorStop(
            0.7,
            "rgba(70,80,255,0.22)"
        );

        halo.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        ctx.save();

        ctx.globalCompositeOperation =
            "lighter";

        ctx.fillStyle = halo;

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            34,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();

        /* SINGULARITÉ */
        ctx.beginPath();

        ctx.arc(
            x,
            y,
            9,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#000000";

        ctx.shadowBlur = 15;
        ctx.shadowColor =
            "rgba(120,50,255,0.9)";

        ctx.fill();

        ctx.shadowBlur = 0;
    }

    /* =========================
       ANNEAUX D'ACCRÉTION
    ========================= */

    function drawAccretionRing() {
        const x =
            player.x -
            player.radius -
            5;

        const y = player.y;

        ctx.save();

        ctx.translate(x, y);

        ctx.rotate(
            Math.sin(time * 0.8) * 0.15
        );

        ctx.scale(
            1,
            0.35
        );

        for (let i = 0; i < 3; i++) {
            ctx.beginPath();

            ctx.ellipse(
                0,
                0,
                15 + i * 4,
                15 + i * 4,
                0,
                0,
                Math.PI * 2
            );

            const hue =
                265 +
                i * 25;

            ctx.strokeStyle =
                `hsla(${hue},100%,70%,${0.8 - i * 0.18})`;

            ctx.lineWidth =
                2.5 -
                i * 0.5;

            ctx.shadowBlur = 12;

            ctx.shadowColor =
                `hsla(${hue},100%,65%,0.9)`;

            ctx.stroke();
        }

        ctx.restore();
    }

    /* =========================
       PARTICULES ASPIRÉES
    ========================= */

    function drawGravityParticles() {
        const holeX =
            player.x -
            player.radius -
            5;

        const holeY =
            player.y;

        for (let i = 0; i < 32; i++) {
            const progress =
                (i / 32 + time * 0.22) % 1;

            const distance =
                105 -
                progress * 88;

            const angle =
                i * 1.9 +
                time * 2.8 +
                progress * 5;

            const x =
                holeX -
                distance * Math.cos(angle);

            const y =
                holeY +
                distance *
                Math.sin(angle) *
                0.38;

            const size =
                0.7 +
                (1 - progress) * 2;

            const hue =
                250 +
                Math.sin(
                    i * 1.5 +
                    time
                ) * 45;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                size,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `hsla(${hue},100%,70%,${0.85 - progress * 0.3})`;

            ctx.shadowBlur = 8;

            ctx.shadowColor =
                `hsla(${hue},100%,65%,0.9)`;

            ctx.fill();
        }

        ctx.shadowBlur = 0;
    }

    /* =========================
       ÉTOILES ASPIRÉES
    ========================= */

    function drawOrbitingStars() {
        const holeX =
            player.x -
            player.radius -
            5;

        const holeY =
            player.y;

        for (let i = 0; i < 10; i++) {
            const angle =
                time * (1.2 + i * 0.04) +
                i * 0.63;

            const distance =
                22 +
                (i % 4) * 7;

            const x =
                holeX +
                Math.cos(angle) * distance;

            const y =
                holeY +
                Math.sin(angle) *
                distance *
                0.42;

            const size =
                1.2 +
                (i % 3) * 0.7;

            ctx.save();

            ctx.translate(x, y);

            ctx.rotate(angle);

            ctx.beginPath();

            for (let p = 0; p < 4; p++) {
                const a =
                    p *
                    Math.PI /
                    2;

                const px =
                    Math.cos(a) *
                    size *
                    2.5;

                const py =
                    Math.sin(a) *
                    size *
                    2.5;

                if (p === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }

            ctx.closePath();

            ctx.fillStyle =
                "rgba(255,255,255,0.9)";

            ctx.shadowBlur = 8;
            ctx.shadowColor =
                "rgba(180,200,255,1)";

            ctx.fill();

            ctx.restore();
        }
    }

    /* =========================
       FILAMENTS COSMIQUES
    ========================= */

    function drawFilaments() {
        const edge =
            player.x -
            player.radius;

        ctx.save();

        ctx.globalCompositeOperation =
            "lighter";

        for (let i = 0; i < 7; i++) {
            ctx.beginPath();

            for (let j = 0; j <= 70; j++) {
                const t = j / 70;

                const x =
                    edge -
                    t * 105;

                const y =
                    player.y +
                    Math.sin(
                        t * 8 +
                        time * (1.5 + i * 0.12) +
                        i
                    ) *
                    (4 + i * 1.5) *
                    t;

                if (j === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            const hue =
                240 +
                i * 18;

            ctx.strokeStyle =
                `hsla(${hue},100%,70%,${0.16 + i * 0.025})`;

            ctx.lineWidth =
                0.8 +
                i * 0.12;

            ctx.shadowBlur = 7;

            ctx.shadowColor =
                `hsla(${hue},100%,65%,0.8)`;

            ctx.stroke();
        }

        ctx.restore();

        ctx.shadowBlur = 0;
    }

    /* =========================
       DISTORSION VISUELLE
    ========================= */

    function drawDistortion() {
        const edge =
            player.x -
            player.radius;

        ctx.save();

        ctx.globalCompositeOperation =
            "lighter";

        for (let i = 0; i < 5; i++) {
            const progress =
                (i / 5 + time * 0.08) % 1;

            const x =
                edge -
                progress * 105;

            const y =
                player.y +
                Math.sin(
                    time * 2 +
                    i
                ) *
                10;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                5 + progress * 8,
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                `rgba(120,160,255,${0.18 - progress * 0.12})`;

            ctx.lineWidth = 1;

            ctx.stroke();
        }

        ctx.restore();
    }

    /* =========================
       ANIMATION
    ========================= */

    function animate() {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        time += 0.025;

        drawStars();

        drawNebula();

        drawFilaments();

        drawDistortion();

        drawGravityParticles();

        drawOrbitingStars();

        drawAccretionRing();

        drawBlackHole();

        /* JOUEUR */
        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";

        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* =========================
   TRAÎNÉE 2 — MYTHIQUE — APOCALYPSE
========================= */

(() => {
    const canvases = document.querySelectorAll(".trail-mini-canvas");
    const canvas = canvases[17];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 18
    };

    let time = 0;

    const fragments = [];

    for (let i = 0; i < 28; i++) {
        fragments.push({
            angle: Math.random() * Math.PI * 2,
            distance: 20 + Math.random() * 80,
            size: 1.5 + Math.random() * 3.5,
            rotation: Math.random() * Math.PI,
            speed: 0.3 + Math.random() * 0.8
        });
    }

    /* =========================
       FAILLE APOCALYPTIQUE
    ========================= */

    function drawRift() {
        const edge =
            player.x -
            player.radius +
            3;

        const gradient =
            ctx.createLinearGradient(
                edge,
                0,
                edge - 115,
                0
            );

        gradient.addColorStop(
            0,
            "rgba(255,55,35,0.9)"
        );

        gradient.addColorStop(
            0.2,
            "rgba(180,15,25,0.75)"
        );

        gradient.addColorStop(
            0.45,
            "rgba(80,5,15,0.55)"
        );

        gradient.addColorStop(
            0.75,
            "rgba(25,3,8,0.25)"
        );

        gradient.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        ctx.save();

        ctx.shadowBlur = 28;
        ctx.shadowColor =
            "rgba(255,20,15,0.9)";

        ctx.fillStyle = gradient;

        ctx.beginPath();

        ctx.moveTo(
            edge,
            player.y - 11
        );

        ctx.bezierCurveTo(
            edge - 25,
            player.y - 22 +
            Math.sin(time * 3) * 8,

            edge - 65,
            player.y + 17 +
            Math.sin(time * 2.4) * 12,

            edge - 115,
            player.y +
            Math.sin(time * 2) * 14
        );

        ctx.bezierCurveTo(
            edge - 70,
            player.y + 27 +
            Math.sin(time * 2.4) * 10,

            edge - 25,
            player.y + 12,

            edge,
            player.y + 11
        );

        ctx.closePath();

        ctx.fill();

        ctx.restore();
    }

    /* =========================
       FISSURES
    ========================= */

    function drawCracks() {
        const edge =
            player.x -
            player.radius;

        for (let i = 0; i < 9; i++) {
            const startX =
                edge -
                8 -
                i * 11;

            const startY =
                player.y +
                Math.sin(
                    time * 1.8 +
                    i
                ) * 9;

            ctx.beginPath();

            ctx.moveTo(
                startX,
                startY
            );

            let x = startX;
            let y = startY;

            for (let j = 0; j < 4; j++) {
                x -=
                    5 +
                    Math.sin(
                        i + j + time
                    ) * 4;

                y +=
                    (j % 2 === 0 ? -1 : 1) *
                    (5 + Math.sin(time + i) * 3);

                ctx.lineTo(x, y);
            }

            ctx.strokeStyle =
                `rgba(255,${35 + i * 3},20,${0.7 - i * 0.035})`;

            ctx.lineWidth =
                1 +
                (i % 3) * 0.5;

            ctx.shadowBlur = 9;

            ctx.shadowColor =
                "rgba(255,30,10,0.9)";

            ctx.stroke();
        }

        ctx.shadowBlur = 0;
    }

    /* =========================
       ÉCLAIRS
    ========================= */

    function drawLightning() {
        const edge =
            player.x -
            player.radius;

        for (let i = 0; i < 7; i++) {
            const progress =
                (i / 7 + time * 0.13) % 1;

            const x =
                edge -
                progress * 105;

            const y =
                player.y +
                Math.sin(
                    time * 4 +
                    i * 2.3
                ) *
                (10 + progress * 14);

            ctx.beginPath();

            ctx.moveTo(
                x,
                y
            );

            ctx.lineTo(
                x - 5,
                y - 7
            );

            ctx.lineTo(
                x - 1,
                y - 5
            );

            ctx.lineTo(
                x - 8,
                y + 6
            );

            ctx.lineTo(
                x - 4,
                y + 3
            );

            ctx.lineTo(
                x - 11,
                y + 12
            );

            ctx.strokeStyle =
                `rgba(255,${70 + i * 8},45,${0.9 - progress * 0.6})`;

            ctx.lineWidth =
                1 +
                Math.sin(time * 8 + i) * 0.5;

            ctx.shadowBlur = 12;

            ctx.shadowColor =
                "rgba(255,40,20,1)";

            ctx.stroke();
        }

        ctx.shadowBlur = 0;
    }

    /* =========================
       FRAGMENTS DE ROCHE
    ========================= */

    function drawFragments() {
        const edge =
            player.x -
            player.radius;

        for (let i = 0; i < fragments.length; i++) {
            const f = fragments[i];

            const progress =
                ((time * f.speed * 0.08) +
                i / fragments.length) % 1;

            const x =
                edge -
                progress * 105 +
                Math.cos(
                    f.angle +
                    time * f.speed
                ) *
                f.distance *
                0.35;

            const y =
                player.y +
                Math.sin(
                    f.angle +
                    time * f.speed
                ) *
                f.distance *
                0.28;

            const alpha =
                0.9 -
                progress * 0.75;

            ctx.save();

            ctx.translate(
                x,
                y
            );

            ctx.rotate(
                f.rotation +
                time * f.speed
            );

            ctx.beginPath();

            ctx.moveTo(
                -f.size,
                -f.size * 0.5
            );

            ctx.lineTo(
                f.size * 0.8,
                -f.size
            );

            ctx.lineTo(
                f.size,
                f.size * 0.7
            );

            ctx.lineTo(
                -f.size * 0.5,
                f.size
            );

            ctx.closePath();

            ctx.fillStyle =
                `rgba(35,30,35,${alpha})`;

            ctx.strokeStyle =
                `rgba(255,65,35,${alpha * 0.8})`;

            ctx.lineWidth = 1;

            ctx.shadowBlur = 7;

            ctx.shadowColor =
                "rgba(255,35,20,0.8)";

            ctx.fill();
            ctx.stroke();

            ctx.restore();
        }

        ctx.shadowBlur = 0;
    }

    /* =========================
       FLAMMES SOMBRES
    ========================= */

    function drawDarkFlames() {
        const edge =
            player.x -
            player.radius +
            2;

        for (let i = 0; i < 5; i++) {
            const offset =
                i * 1.4;

            ctx.beginPath();

            for (let j = 0; j <= 40; j++) {
                const t = j / 40;

                const x =
                    edge -
                    t * (60 + i * 8);

                const wave =
                    Math.sin(
                        t * 10 -
                        time * 5 +
                        offset
                    ) *
                    (2 + t * 7);

                const width =
                    (10 - i * 1.2) *
                    Math.pow(
                        1 - t,
                        0.6
                    );

                const y =
                    player.y +
                    wave;

                if (j === 0) {
                    ctx.moveTo(
                        x,
                        y - width
                    );
                } else {
                    ctx.lineTo(
                        x,
                        y - width
                    );
                }
            }

            for (let j = 40; j >= 0; j--) {
                const t = j / 40;

                const x =
                    edge -
                    t * (60 + i * 8);

                const wave =
                    Math.sin(
                        t * 10 -
                        time * 5 +
                        offset
                    ) *
                    (2 + t * 7);

                const width =
                    (10 - i * 1.2) *
                    Math.pow(
                        1 - t,
                        0.6
                    );

                const y =
                    player.y +
                    wave;

                ctx.lineTo(
                    x,
                    y + width
                );
            }

            ctx.closePath();

            const flame =
                ctx.createLinearGradient(
                    edge,
                    0,
                    edge - 70,
                    0
                );

            flame.addColorStop(
                0,
                "rgba(255,80,30,0.75)"
            );

            flame.addColorStop(
                0.3,
                "rgba(150,15,20,0.65)"
            );

            flame.addColorStop(
                0.7,
                "rgba(40,5,10,0.5)"
            );

            flame.addColorStop(
                1,
                "rgba(0,0,0,0)"
            );

            ctx.fillStyle = flame;

            ctx.fill();
        }
    }

    /* =========================
       EXPLOSIONS
    ========================= */

    function drawExplosions() {
        const edge =
            player.x -
            player.radius;

        for (let i = 0; i < 6; i++) {
            const progress =
                (i / 6 + time * 0.11) % 1;

            const x =
                edge -
                progress * 95;

            const y =
                player.y +
                Math.sin(
                    time * 2.5 +
                    i * 3
                ) *
                (10 + progress * 14);

            const radius =
                2 +
                Math.sin(
                    progress * Math.PI
                ) *
                7;

            const glow =
                ctx.createRadialGradient(
                    x,
                    y,
                    0,
                    x,
                    y,
                    radius
                );

            glow.addColorStop(
                0,
                "rgba(255,230,150,0.95)"
            );

            glow.addColorStop(
                0.25,
                "rgba(255,80,25,0.85)"
            );

            glow.addColorStop(
                0.7,
                "rgba(150,10,20,0.3)"
            );

            glow.addColorStop(
                1,
                "rgba(0,0,0,0)"
            );

            ctx.fillStyle = glow;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                radius,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }
    }

    /* =========================
       AURA DU CHAOS
    ========================= */

    function drawAura() {
        const aura =
            ctx.createRadialGradient(
                player.x,
                player.y,
                3,
                player.x,
                player.y,
                32
            );

        aura.addColorStop(
            0,
            "rgba(255,70,35,0.45)"
        );

        aura.addColorStop(
            0.35,
            "rgba(180,15,20,0.28)"
        );

        aura.addColorStop(
            0.7,
            "rgba(70,0,10,0.16)"
        );

        aura.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        ctx.fillStyle = aura;

        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            32,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    /* =========================
       ANIMATION
    ========================= */

    function animate() {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        time += 0.025;

        drawRift();

        drawDarkFlames();

        drawCracks();

        drawFragments();

        drawLightning();

        drawExplosions();

        drawAura();

        /* NOYAU ROUGE */
        const core =
            ctx.createRadialGradient(
                player.x - 4,
                player.y,
                0,
                player.x - 4,
                player.y,
                22
            );

        core.addColorStop(
            0,
            "rgba(255,220,180,0.8)"
        );

        core.addColorStop(
            0.25,
            "rgba(255,60,30,0.5)"
        );

        core.addColorStop(
            0.65,
            "rgba(120,0,15,0.2)"
        );

        core.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        ctx.fillStyle = core;

        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            22,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /* JOUEUR */
        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            player.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f1c27d";

        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
})();


/* =========================================================
   BOUTIQUE — NAVIGATION PERSONNAGE / TRAÎNÉES
========================================================= */

(() => {
    const mainPage =
        document.getElementById("shop-main-page");

    const trailsPage =
        document.getElementById("trail-shop-page");

    const trailsButton =
        document.getElementById("shop-trails-button");

    const trailsBack =
        document.getElementById("trail-shop-back");

    if (!mainPage || !trailsPage || !trailsButton) {
        return;
    }

    trailsButton.addEventListener("click", () => {
        mainPage.classList.add("hidden");
        trailsPage.classList.add("open");
    });

    trailsBack?.addEventListener("click", () => {
        trailsPage.classList.remove("open");
        mainPage.classList.remove("hidden");
    });
})();





/* =========================================================
   BOUTIQUE — NAVIGATION INDÉPENDANTE PERSONNAGE / TRAÎNÉES
========================================================= */

(() => {
    const characterShop = document.querySelector(".shop-rgb");
    const trailsPage = document.getElementById("trail-shop-page");
    const trailsButton = document.getElementById("shop-trails-button");
    const trailsBack = document.getElementById("trail-shop-back");

    if (!characterShop || !trailsPage || !trailsButton) {
        console.log("❌ Navigation boutique introuvable");
        return;
    }

    trailsPage.classList.remove("open");
    characterShop.classList.remove("shop-hidden");

    trailsButton.addEventListener("click", () => {
        characterShop.classList.add("shop-hidden");
        trailsPage.classList.add("open");
    });

    trailsBack?.addEventListener("click", () => {
        trailsPage.classList.remove("open");
        characterShop.classList.remove("shop-hidden");
    });

    console.log("✅ Boutique indépendante activée");
})();

/* =========================================================
   TRAÎNÉES — ACHAT / INVENTAIRE / ÉQUIPEMENT
   PREVIEW HAUTE QUALITÉ
========================================================= */

(() => {
    const OWNED_KEY = "deadlyio_owned_trails";
    const EQUIPPED_KEY = "deadlyio_equipped_trail";

    let currentIndex = null;
    let currentCanvas = null;
    let previewFrame = null;

    const getOwned = () => {
        try {
            const data = JSON.parse(localStorage.getItem(OWNED_KEY) || "[]");
            return Array.isArray(data) ? data.map(Number) : [];
        } catch {
            return [];
        }
    };

    const saveOwned = (owned) => {
        localStorage.setItem(
            OWNED_KEY,
            JSON.stringify([...new Set(owned)])
        );
    };

    const getEquipped = () => {
        const value = localStorage.getItem(EQUIPPED_KEY);
        return value === null ? null : Number(value);
    };

    const setEquipped = (index) => {
        if (index === null) {
            localStorage.removeItem(EQUIPPED_KEY);
        } else {
            localStorage.setItem(EQUIPPED_KEY, String(index));
        }
    };

    const modal = document.createElement("div");
    modal.id = "trail-purchase-modal";

    modal.innerHTML = `
        <div class="trail-purchase-backdrop"></div>

        <div class="trail-purchase-card">

            <button
                type="button"
                class="trail-purchase-close"
            >
                FERMER
            </button>

            <div
                class="trail-purchase-title"
                id="trail-purchase-name"
            >
                TRAÎNÉE
            </div>

            <div class="trail-purchase-preview">

                <canvas
                    id="trail-purchase-preview"
                    width="1320"
                    height="780"
                ></canvas>

                <div class="trail-sold-badge">
                    SOLD
                </div>

            </div>

            <div
                class="trail-purchase-price"
                id="trail-purchase-price"
            ></div>

            <div
                class="trail-purchase-question"
                id="trail-purchase-question"
            >
                Êtes-vous sûr de vouloir acheter cet article ?
            </div>

            <div
                class="trail-purchase-status"
                id="trail-purchase-status"
            ></div>

            <div class="trail-purchase-actions">

                <button
                    type="button"
                    id="trail-purchase-pay"
                >
                    PASSER LE PAIEMENT
                </button>

                <button
                    type="button"
                    id="trail-purchase-equip"
                >
                    EQUIPER
                </button>

                <button
                    type="button"
                    id="trail-purchase-cancel"
                >
                    ANNULER
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    const preview = document.getElementById(
        "trail-purchase-preview"
    );

    const previewCtx = preview.getContext("2d", {
        alpha: true
    });

    const nameElement =
        document.getElementById("trail-purchase-name");

    const priceElement =
        document.getElementById("trail-purchase-price");

    const questionElement =
        document.getElementById("trail-purchase-question");

    const statusElement =
        document.getElementById("trail-purchase-status");

    const payButton =
        document.getElementById("trail-purchase-pay");

    const equipButton =
        document.getElementById("trail-purchase-equip");

    const cancelButton =
        document.getElementById("trail-purchase-cancel");

    const closeButton =
        modal.querySelector(".trail-purchase-close");

    const soldBadge =
        modal.querySelector(".trail-sold-badge");

    function stopPreview() {
        if (previewFrame !== null) {
            cancelAnimationFrame(previewFrame);
            previewFrame = null;
        }
    }

    function drawHighQualityPreview() {
        if (
            !modal.classList.contains("open") ||
            !currentCanvas
        ) {
            previewFrame = null;
            return;
        }

        const sourceWidth =
            currentCanvas.width || 220;

        const sourceHeight =
            currentCanvas.height || 130;

        /*
         * On conserve le ratio exact du canvas original.
         * Le canvas de la modale est en 3× pour éviter
         * le flou visuel.
         */
        const targetWidth = preview.width;
        const targetHeight = preview.height;

        previewCtx.clearRect(
            0,
            0,
            targetWidth,
            targetHeight
        );

        previewCtx.imageSmoothingEnabled = false;

        /*
         * Fond propre et neutre.
         */
        previewCtx.fillStyle =
            "rgba(255,255,255,0.018)";

        previewCtx.fillRect(
            0,
            0,
            targetWidth,
            targetHeight
        );

        /*
         * Le canvas source reste inchangé.
         * On adapte seulement son affichage.
         */
        const scale = Math.min(
            targetWidth / sourceWidth,
            targetHeight / sourceHeight
        );

        const drawWidth =
            sourceWidth * scale;

        const drawHeight =
            sourceHeight * scale;

        const offsetX =
            (targetWidth - drawWidth) / 2;

        const offsetY =
            (targetHeight - drawHeight) / 2;

        previewCtx.drawImage(
            currentCanvas,
            0,
            0,
            sourceWidth,
            sourceHeight,
            offsetX,
            offsetY,
            drawWidth,
            drawHeight
        );

        previewFrame =
            requestAnimationFrame(
                drawHighQualityPreview
            );
    }

    function startPreview() {
        stopPreview();

        /*
         * Rend le preview immédiatement,
         * puis le maintient synchronisé avec
         * la traînée de la boutique.
         */
        drawHighQualityPreview();
    }

    function closeModal() {
        stopPreview();

        modal.classList.remove("open");

        currentIndex = null;
        currentCanvas = null;
    }

    function updateModal() {
        if (currentIndex === null) return;

        const owned =
            getOwned().includes(currentIndex);

        const equipped =
            getEquipped() === currentIndex;

        soldBadge.style.display =
            owned ? "flex" : "none";

        if (owned) {

            questionElement.style.display =
                "none";

            payButton.style.display =
                "none";

            cancelButton.style.display =
                "none";

            equipButton.style.display =
                "block";

            equipButton.textContent =
                equipped
                    ? "DÉSÉQUIPER"
                    : "EQUIPER";

            statusElement.textContent =
                equipped
                    ? "Cette traînée est actuellement équipée."
                    : "Cette traînée est disponible dans votre collection.";

        } else {

            questionElement.style.display =
                "block";

            payButton.style.display =
                "block";

            cancelButton.style.display =
                "block";

            equipButton.style.display =
                "none";

            statusElement.textContent =
                "";
        }
    }

    function openTrail(item) {
        const canvas =
            item.querySelector(
                ".trail-mini-canvas"
            );

        if (!canvas) return;

        const canvases = [
            ...document.querySelectorAll(
                ".trail-mini-canvas"
            )
        ];

        const index =
            canvases.indexOf(canvas);

        if (index < 0) return;

        currentIndex = index;
        currentCanvas = canvas;

        const strong =
            item.querySelector("strong");

        const price =
            item.querySelector("span");

        nameElement.textContent =
            strong?.textContent?.trim() ||
            `TRAÎNÉE ${index + 1}`;

        priceElement.textContent =
            price?.textContent?.trim() ||
            "";

        modal.classList.add("open");

        updateModal();
        startPreview();
    }

    document.addEventListener(
        "click",
        (event) => {

            const item =
                event.target.closest(
                    ".trail-shop-item"
                );

            if (
                item &&
                !event.target.closest("button")
            ) {
                openTrail(item);
            }
        }
    );

    payButton.addEventListener(
        "click",
        () => {

            if (currentIndex === null)
                return;

            statusElement.textContent =
                "PAIEMENT NON CONNECTÉ — aucun débit réel n'est effectué.";

            statusElement.classList.add(
                "payment-warning"
            );
        }
    );

    equipButton.addEventListener(
        "click",
        () => {

            if (currentIndex === null)
                return;

            const owned = getOwned();

            if (!owned.includes(currentIndex))
                return;

            if (
                getEquipped() ===
                currentIndex
            ) {
                setEquipped(null);
            } else {
                setEquipped(
                    currentIndex
                );
            }

            updateModal();
        }
    );

    cancelButton.addEventListener(
        "click",
        closeModal
    );

    closeButton.addEventListener(
        "click",
        closeModal
    );

    modal
        .querySelector(
            ".trail-purchase-backdrop"
        )
        .addEventListener(
            "click",
            closeModal
        );

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                modal.classList.contains("open")
            ) {
                closeModal();
            }
        }
    );

    console.log(
        "✅ Système d'achat des traînées — preview HD chargé"
    );
})();



/* =========================================================
   NETTOYAGE ANCIEN TEST ACHAT
========================================================= */

try {
    localStorage.removeItem("deadlyio_owned_trails");
    localStorage.removeItem("deadlyio_equipped_trail");
} catch (e) {}

/* =========================================================
   NAVIGATION BOUTIQUE — HELMETS
========================================================= */

function drawPetaseTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.clearRect(-70, -70, 140, 140);

    /* Ombre */
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(0, 4, 31, 0, Math.PI * 2);
    ctx.fill();

    /* CHAPEAU ROND */
    ctx.fillStyle = "#4A3421";
    ctx.strokeStyle = "#24170D";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Couronne */
    const gradient = ctx.createRadialGradient(-7, -8, 2, 0, 0, 25);
    gradient.addColorStop(0, "#80603D");
    gradient.addColorStop(1, "#3B291A");

    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.arc(0, -3, 21, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#24170D";
    ctx.lineWidth = 2;
    ctx.stroke();

    /* Creux central */
    ctx.fillStyle = "#2B1B10";
    ctx.beginPath();
    ctx.arc(0, -6, 8, 0, Math.PI * 2);
    ctx.fill();

    /* Bande */
    ctx.strokeStyle = "#C09552";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -3, 21, 0, Math.PI * 2);
    ctx.stroke();

    /* =====================================================
       AILES — FIXÉES DIRECTEMENT AU CHAPEAU
    ===================================================== */

    ctx.fillStyle = "#D7D7D7";
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 2;

    /* Aile gauche attachée au bord supérieur */
    ctx.beginPath();
    ctx.moveTo(-10, -22);
    ctx.quadraticCurveTo(-22, -38, -35, -31);
    ctx.quadraticCurveTo(-28, -20, -12, -16);
    ctx.quadraticCurveTo(-8, -18, -10, -22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    /* Aile droite attachée au bord supérieur */
    ctx.beginPath();
    ctx.moveTo(10, -22);
    ctx.quadraticCurveTo(22, -38, 35, -31);
    ctx.quadraticCurveTo(28, -20, 12, -16);
    ctx.quadraticCurveTo(8, -18, 10, -22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

window.addEventListener("DOMContentLoaded", () => {
    const characterShop = document.querySelector(".shop-rgb");
    const trailsPage = document.getElementById("trail-shop-page");
    const helmetsPage = document.getElementById("helmet-shop-page");

    const trailsButton = document.getElementById("shop-trails-button");
    const helmetsButton = document.getElementById("shop-helmets-button");

    const trailsBack = document.getElementById("trail-shop-back");
    const helmetsBack = document.getElementById("helmet-shop-back");

    if (!characterShop || !trailsPage || !helmetsPage || !trailsButton || !helmetsButton) {
        console.log("❌ Navigation HELMETS introuvable");
        return;
    }

    helmetsButton.addEventListener("click", () => {
        characterShop.classList.add("shop-hidden");
        trailsPage.classList.remove("open");
        helmetsPage.classList.add("open");
    });

    helmetsBack?.addEventListener("click", () => {
        helmetsPage.classList.remove("open");
        characterShop.classList.remove("shop-hidden");
    });

    console.log("✅ HELMETS accessible");
});

/* =========================================================
   CASQUE — PÉTASE
   COMMUN — +30 % VITESSE D'ATTAQUE
========================================================= */

const HELMET_PETASE = {
    id: "petase",
    name: "PÉTASE",
    rarity: "common",
    price: 2.99,
    attackSpeedBonus: 0.30
};

function drawPetase(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    /* Ombre du chapeau */
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 3, 25, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Aile gauche */
    ctx.fillStyle = "#D8D8D8";
    ctx.strokeStyle = "#8A8A8A";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(-17, -5);
    ctx.quadraticCurveTo(-30, -14, -38, -7);
    ctx.quadraticCurveTo(-30, -3, -18, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    /* Aile droite */
    ctx.beginPath();
    ctx.moveTo(17, -5);
    ctx.quadraticCurveTo(30, -14, 38, -7);
    ctx.quadraticCurveTo(30, -3, 18, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    /* Dessus du pétase */
    const gradient = ctx.createLinearGradient(0, -22, 0, 0);
    gradient.addColorStop(0, "#6F5437");
    gradient.addColorStop(1, "#3F2D1D");

    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#24180F";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(0, -10, 21, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Creux central */
    ctx.fillStyle = "#2C1D12";
    ctx.beginPath();
    ctx.ellipse(0, -13, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Bord du chapeau */
    ctx.fillStyle = "#4C3622";
    ctx.beginPath();
    ctx.ellipse(0, -3, 29, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Bande */
    ctx.strokeStyle = "#B58A4A";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -7, 20, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

/* Bonus du PÉTASE */
function getHelmetAttackSpeedMultiplier() {
    return HELMET_PETASE.attackSpeedBonus;
}


/* =========================================================
   AFFICHAGE PÉTASE — PREMIER HELMET COMMUN
========================================================= */

window.addEventListener("DOMContentLoaded", () => {
    const firstHelmetCanvas = document.querySelector(
        "#helmet-shop-page .helmet-mini-canvas"
    );

    if (!firstHelmetCanvas) {
        console.log("❌ Canvas PÉTASE introuvable");
        return;
    }

    const ctx = firstHelmetCanvas.getContext("2d");
    if (!ctx) return;

    const w = firstHelmetCanvas.width;
    const h = firstHelmetCanvas.height;

    ctx.clearRect(0, 0, w, h);

    /* Petit personnage de présentation */
    const cx = w / 2;
    const cy = h * 0.63;
    const r = 27;

    ctx.fillStyle = "#353535";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    /* PÉTASE */
    drawPetase(ctx, cx, cy - 28, 1.35);

    console.log("✅ PÉTASE affiché dans le premier emplacement");
});


/* =========================================================
   PÉTASE — PREVIEW 2D VUE DU DESSUS
========================================================= */




/* Remplace le personnage par le chapeau seul */
window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.querySelector(
        "#helmet-shop-page .helmet-mini-canvas"
    );

    if (!canvas) {
        console.log("❌ Preview PÉTASE introuvable");
        return;
    }

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPetaseTopDown(
        ctx,
        canvas.width / 2,
        canvas.height / 2,
        1.25
    );

    console.log("✅ PÉTASE affiché en vue 2D top-down");
});


/* =========================================================
   PÉTASE — FORME RONDE / TAILLE PERSONNAGE
========================================================= */




/* =========================================================
   CASQUE DE SOLDAT — APERÇU ROMAIN MÉTALLIQUE
========================================================= */

function drawSoldierHelmetTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.clearRect(-70, -70, 140, 140);

    /* Ombre */
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(0, 4, 31, 0, Math.PI * 2);
    ctx.fill();

    /* Corps rond du casque */
    const metal = ctx.createRadialGradient(-8, -10, 2, 0, 0, 30);
    metal.addColorStop(0, "#D9DDE0");
    metal.addColorStop(0.65, "#858B90");
    metal.addColorStop(1, "#4A4F53");

    ctx.fillStyle = metal;
    ctx.strokeStyle = "#292D30";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Partie supérieure */
    ctx.fillStyle = "#AEB3B7";

    ctx.beginPath();
    ctx.arc(0, -5, 21, 0, Math.PI * 2);
    ctx.fill();

    /* Visière simple */
    ctx.fillStyle = "#3C4145";

    ctx.beginPath();
    ctx.arc(0, 9, 16, 0, Math.PI);
    ctx.fill();

    /* Protège-joues simples */
    ctx.fillStyle = "#72787D";

    ctx.beginPath();
    ctx.moveTo(-21, 5);
    ctx.quadraticCurveTo(-28, 16, -21, 24);
    ctx.quadraticCurveTo(-15, 21, -13, 12);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(21, 5);
    ctx.quadraticCurveTo(28, 16, 21, 24);
    ctx.quadraticCurveTo(15, 21, 13, 12);
    ctx.closePath();
    ctx.fill();

    /* Petit renfort central */
    ctx.strokeStyle = "#656B70";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(0, 4);
    ctx.stroke();

    ctx.restore();
}


/* Affichage du deuxième HELMET */
window.addEventListener("DOMContentLoaded", () => {
    const canvases = document.querySelectorAll(
        "#helmet-shop-page .helmet-mini-canvas"
    );

    const canvas = canvases[1];

    if (!canvas) {
        console.log("❌ Preview Casque de Soldat introuvable");
        return;
    }

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawSoldierHelmetTopDown(
        ctx,
        canvas.width / 2,
        canvas.height / 2,
        1.15
    );

    console.log("✅ Casque de Soldat affiché");
});



/* =========================================================
   SOIGNEUR — CASQUE DE SOINS
========================================================= */

function drawHealerHelmetTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.clearRect(-70, -70, 140, 140);

    /* Ombre légère */
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.arc(0, 3, 28, 0, Math.PI * 2);
    ctx.fill();

    /* CASQUE MÉDICAL */
    ctx.fillStyle = "#F4F4F4";
    ctx.strokeStyle = "#B7B7B7";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Surface centrale légèrement différente */
    ctx.fillStyle = "#FFFFFF";

    ctx.beginPath();
    ctx.arc(0, -2, 22, 0, Math.PI * 2);
    ctx.fill();

    /* CROIX ROUGE — BRANCHES CARRÉES */
    ctx.fillStyle = "#E3262E";

    /* Vertical : 10 × 26 */
    ctx.fillRect(-5, -13, 10, 26);

    /* Horizontal : 26 × 10 */
    ctx.fillRect(-13, -5, 26, 10);

    /* Petit contour de la croix */
    ctx.strokeStyle = "#B8141B";
    ctx.lineWidth = 1;

    ctx.strokeRect(-5, -13, 10, 26);
    ctx.strokeRect(-13, -5, 26, 10);

    ctx.restore();
}

/* Aperçu du 3e HELMET */
window.addEventListener("DOMContentLoaded", () => {
    const canvases = document.querySelectorAll(
        "#helmet-shop-page .helmet-mini-canvas"
    );

    const canvas = canvases[2];

    if (!canvas) {
        console.log("❌ Canvas Soigneur introuvable");
        return;
    }

    const ctx = canvas.getContext("2d");

    drawHealerHelmetTopDown(
        ctx,
        canvas.width / 2,
        canvas.height / 2,
        1.15
    );

    console.log("✅ Soigneur affiché avec son casque");
});

/* =========================================================
   CASQUE BÛCHERON — PREVIEW TOP-DOWN
   ========================================================= */

function drawLumberjackHelmetTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.clearRect(-70, -70, 140, 140);

    /* Ombre */
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, 6, 30, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Casque en bois */
    ctx.fillStyle = "#8B5A2B";
    ctx.strokeStyle = "#5A3518";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Planches de bois */
    ctx.strokeStyle = "#6E431F";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-18, -20);
    ctx.lineTo(-18, 20);
    ctx.moveTo(-6, -26);
    ctx.lineTo(-6, 26);
    ctx.moveTo(7, -26);
    ctx.lineTo(7, 26);
    ctx.moveTo(19, -20);
    ctx.lineTo(19, 20);
    ctx.stroke();

    /* Bandeau */
    ctx.fillStyle = "#4A2A12";
    ctx.fillRect(-27, -4, 54, 8);

    /* Petit symbole de hache */
    ctx.strokeStyle = "#D8D8D8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -16);
    ctx.lineTo(8, 16);
    ctx.stroke();

    ctx.fillStyle = "#C8C8C8";
    ctx.beginPath();
    ctx.moveTo(-12, -18);
    ctx.lineTo(-2, -22);
    ctx.lineTo(1, -13);
    ctx.lineTo(-9, -10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}



/* =========================================================
   BÛCHERON — SKIN
   ========================================================= */

function drawLumberjackSkinTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.clearRect(-70, -70, 140, 140);

    /* PERSONNAGE ORIGINAL */
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    /* VESTE PAR-DESSUS LE PERSONNAGE */
    ctx.save();

    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.clip();

    /* côté gauche */
    ctx.fillStyle = "#B51F2A";
    ctx.fillRect(-22, -22, 8, 44);

    /* côté droit */
    ctx.fillRect(14, -22, 8, 44);

    /* carreaux noirs */
    ctx.strokeStyle = "#171717";
    ctx.lineWidth = 2;

    for (let y = -18; y <= 18; y += 7) {
        ctx.beginPath();
        ctx.moveTo(-20, y);
        ctx.lineTo(-13, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(13, y);
        ctx.lineTo(20, y);
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(-16.5, -20);
    ctx.lineTo(-16.5, 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(16.5, -20);
    ctx.lineTo(16.5, 20);
    ctx.stroke();

    ctx.restore();

    ctx.restore();
}

window.addEventListener("DOMContentLoaded", () => {
    const canvases = document.querySelectorAll(".helmet-mini-canvas");
    const canvas = canvases[3];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    canvas.width = 220;
    canvas.height = 130;

    drawLumberjackSkinTopDown(
        ctx,
        canvas.width / 2,
        canvas.height / 2,
        1.15
    );
});

/* =========================================================
   MINEUR — SKIN
   ========================================================= */

function drawMinerSkinTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.clearRect(-70, -70, 140, 140);

    /* Personnage beige classique */
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    /* Casque de mineur vu du dessus */
    ctx.fillStyle = "#D9A51B";
    ctx.strokeStyle = "#8A6810";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Bord du casque */
    ctx.fillStyle = "#B78312";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    /* Partie centrale jaune */
    ctx.fillStyle = "#E6B522";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    /* Halo de la lampe */
    const glow = ctx.createRadialGradient(0, -17, 1, 0, -17, 14);
    glow.addColorStop(0, "rgba(255,255,220,0.95)");
    glow.addColorStop(0.35, "rgba(255,245,150,0.55)");
    glow.addColorStop(1, "rgba(255,230,80,0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -17, 14, 0, Math.PI * 2);
    ctx.fill();

    /* Lampe */
    ctx.fillStyle = "#FFFDE0";
    ctx.strokeStyle = "#B9A94A";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(0, -17, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

window.addEventListener("DOMContentLoaded", () => {
    const canvases = document.querySelectorAll(".helmet-mini-canvas");
    const canvas = canvases[4];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    canvas.width = 220;
    canvas.height = 130;

    drawMinerSkinTopDown(
        ctx,
        canvas.width / 2,
        canvas.height / 2,
        1.15
    );
});

function drawGardenerSkinTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.clearRect(-70, -70, 140, 140);

    /* Personnage beige classique */
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    /* Chapeau de paille parfaitement rond */
    ctx.fillStyle = "#D9A441";
    ctx.strokeStyle = "#8F681F";
    ctx.lineWidth = 2;

    /* Bord extérieur */
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Partie centrale */
    ctx.fillStyle = "#E8B956";
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Bande du chapeau */
    ctx.strokeStyle = "#9A7025";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();

    /* Petit sommet */
    ctx.fillStyle = "#C99735";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

window.addEventListener("DOMContentLoaded", () => {
    const canvases = document.querySelectorAll(".helmet-mini-canvas");
    const canvas = canvases[5];

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    canvas.width = 220;
    canvas.height = 130;

    drawGardenerSkinTopDown(
        ctx,
        canvas.width / 2,
        canvas.height / 2,
        1.15
    );
});

function drawAngelRingTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.clearRect(-70, -70, 140, 140);

    /* PNJ beige classique */
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    /* Anneau ange posé au centre du PNJ */
    ctx.shadowColor = "rgba(255, 220, 50, 0.9)";
    ctx.shadowBlur = 8;

    ctx.strokeStyle = "#FFD83D";
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;

    /* Petit reflet */
    ctx.strokeStyle = "#FFF2A3";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

function drawBarbarianHelmetTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.clearRect(-70, -70, 140, 140);

    /* Casque métallique */
    ctx.fillStyle = "#555555";
    ctx.strokeStyle = "#242424";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Bande centrale */
    ctx.strokeStyle = "#8A8A8A";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(0, 25);
    ctx.stroke();

    /* Cornes */
    ctx.fillStyle = "#D8D0B8";
    ctx.strokeStyle = "#5E5848";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-17, -16);
    ctx.quadraticCurveTo(-35, -28, -29, -6);
    ctx.quadraticCurveTo(-23, -13, -17, -16);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(17, -16);
    ctx.quadraticCurveTo(35, -28, 29, -6);
    ctx.quadraticCurveTo(23, -13, 17, -16);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

function drawPlagueTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.clearRect(-70, -70, 140, 140);

    /* Masque de peste */
    ctx.fillStyle = "#26352C";
    ctx.strokeStyle = "#101712";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Bec du masque */
    ctx.fillStyle = "#384A3D";

    ctx.beginPath();
    ctx.moveTo(-8, 4);
    ctx.lineTo(0, 22);
    ctx.lineTo(8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    /* Yeux */
    ctx.fillStyle = "#B8D66A";

    ctx.beginPath();
    ctx.arc(-9, -7, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(9, -7, 4, 0, Math.PI * 2);
    ctx.fill();

    /* Marques de peste */
    ctx.fillStyle = "#73834A";

    ctx.beginPath();
    ctx.arc(-15, 11, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(15, 11, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

window.addEventListener("DOMContentLoaded", () => {
    const canvases = document.querySelectorAll(".helmet-mini-canvas");

    if (canvases[6]) {
        const ctx = canvases[6].getContext("2d");
        canvases[6].width = 220;
        canvases[6].height = 130;
        drawAngelRingTopDown(ctx, 110, 65, 1.15);
    }

    if (canvases[7]) {
        const ctx = canvases[7].getContext("2d");
        canvases[7].width = 220;
        canvases[7].height = 130;
        drawBarbarianHelmetTopDown(ctx, 110, 65, 1.15);
    }

    if (canvases[8]) {
        const ctx = canvases[8].getContext("2d");
        canvases[8].width = 220;
        canvases[8].height = 130;
        drawPlagueTopDown(ctx, 110, 65, 1.15);
    }
});

function drawTurretTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.clearRect(-70, -70, 140, 140);

    /* Base de la tourelle */
    ctx.fillStyle = "#555B63";
    ctx.strokeStyle = "#22262B";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Axe central */
    ctx.fillStyle = "#777D85";
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Canon animé */
    const now = performance.now();
    const angle = now / 900;

    ctx.save();
    ctx.rotate(angle);

    ctx.fillStyle = "#34383D";
    ctx.strokeStyle = "#17191C";
    ctx.lineWidth = 2;

    ctx.fillRect(4, -5, 30, 10);
    ctx.strokeRect(4, -5, 30, 10);

    /* Boulet */
    const shotProgress = (now % 3000) / 3000;

    if (shotProgress > 0.82) {
        const distance = (shotProgress - 0.82) / 0.18 * 35;

        ctx.fillStyle = "#181818";
        ctx.beginPath();
        ctx.arc(35 + distance, 0, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    /* Petit flash lors du tir */
    if ((now % 3000) > 2460 && (now % 3000) < 2550) {
        ctx.fillStyle = "#FFD45A";
        ctx.shadowColor = "#FF9D00";
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(36, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

function drawGoldChestTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.clearRect(-70, -70, 140, 140);

    /* Coffre doré */
    ctx.fillStyle = "#D9A51B";
    ctx.strokeStyle = "#805D0A";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(-24, -18, 48, 36, 7);
    ctx.fill();
    ctx.stroke();

    /* Couvercle */
    ctx.fillStyle = "#F0C52E";
    ctx.beginPath();
    ctx.arc(0, -8, 20, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Serrure */
    ctx.fillStyle = "#FFF1A1";
    ctx.beginPath();
    ctx.arc(0, 3, 5, 0, Math.PI * 2);
    ctx.fill();

    /* Éclat */
    ctx.fillStyle = "#FFF7C2";
    ctx.beginPath();
    ctx.arc(-12, -10, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawTankTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.clearRect(-70, -70, 140, 140);

    /* Corps du tank */
    ctx.fillStyle = "#4C6044";
    ctx.strokeStyle = "#20291D";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Chenilles */
    ctx.fillStyle = "#252A24";

    ctx.fillRect(-28, -18, 8, 36);
    ctx.fillRect(20, -18, 8, 36);

    /* Tourelle */
    ctx.fillStyle = "#65785A";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Canon */
    ctx.fillStyle = "#30382C";
    ctx.fillRect(4, -4, 28, 8);

    ctx.restore();
}

window.addEventListener("DOMContentLoaded", () => {
    const canvases = document.querySelectorAll(".helmet-mini-canvas");

    if (canvases[9]) {
        const ctx = canvases[9].getContext("2d");
        canvases[9].width = 220;
        canvases[9].height = 130;

        function animateTurret() {
            drawTurretTopDown(ctx, 110, 65, 1.05);
            requestAnimationFrame(animateTurret);
        }

        animateTurret();
    }

    if (canvases[10]) {
        const ctx = canvases[10].getContext("2d");
        canvases[10].width = 220;
        canvases[10].height = 130;
        drawGoldChestTopDown(ctx, 110, 65, 1.05);
    }

    if (canvases[11]) {
        const ctx = canvases[11].getContext("2d");
        canvases[11].width = 220;
        canvases[11].height = 130;
        drawTankTopDown(ctx, 110, 65, 1.05);
    }
});

function drawThiefTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.clearRect(-70, -70, 140, 140);

    /* Personnage beige */
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    /* Capuche sombre */
    ctx.fillStyle = "#292929";
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, -3, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Visage visible */
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(0, 3, 13, 0, Math.PI * 2);
    ctx.fill();

    /* Bandeau */
    ctx.fillStyle = "#171717";
    ctx.fillRect(-13, -2, 26, 6);

    /* Petit symbole doré */
    ctx.fillStyle = "#D9A51B";
    ctx.beginPath();
    ctx.arc(0, -17, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawGrandSamuraiTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.clearRect(-70, -70, 140, 140);

    /* Armure sombre */
    ctx.fillStyle = "#292C33";
    ctx.strokeStyle = "#101216";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Plaques d'armure */
    ctx.strokeStyle = "#626872";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.stroke();

    /* Kabuto */
    ctx.fillStyle = "#17191D";

    ctx.beginPath();
    ctx.arc(0, -5, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Ornement doré */
    ctx.fillStyle = "#D9A51B";

    ctx.beginPath();
    ctx.moveTo(0, -27);
    ctx.lineTo(-7, -16);
    ctx.lineTo(0, -12);
    ctx.lineTo(7, -16);
    ctx.closePath();
    ctx.fill();

    /* Deux sabres stylisés */
    ctx.strokeStyle = "#D8D8D8";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(-20, -18);
    ctx.lineTo(-31, -29);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(20, -18);
    ctx.lineTo(31, -29);
    ctx.stroke();

    ctx.restore();
}

window.addEventListener("DOMContentLoaded", () => {
    const canvases = document.querySelectorAll(".helmet-mini-canvas");

    if (canvases[12]) {
        const ctx = canvases[12].getContext("2d");
        canvases[12].width = 220;
        canvases[12].height = 130;
        drawThiefTopDown(ctx, 110, 65, 1.05);
    }

    if (canvases[13]) {
        const ctx = canvases[13].getContext("2d");
        canvases[13].width = 220;
        canvases[13].height = 130;
        drawGrandSamuraiTopDown(ctx, 110, 65, 1.05);
    }
});

function drawAssassinTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    /* Aura d'invisibilité */
    ctx.shadowColor = "rgba(120, 80, 255, 0.8)";
    ctx.shadowBlur = 14;

    /* Capuche sombre */
    ctx.fillStyle = "#17151F";
    ctx.strokeStyle = "#5B4A78";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Visage masqué */
    ctx.fillStyle = "#292431";

    ctx.beginPath();
    ctx.arc(0, 5, 13, 0, Math.PI * 2);
    ctx.fill();

    /* Yeux */
    ctx.fillStyle = "#B88CFF";

    ctx.beginPath();
    ctx.arc(-6, 2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(6, 2, 2, 0, Math.PI * 2);
    ctx.fill();

    /* Effet furtif */
    ctx.strokeStyle = "rgba(190,160,255,0.65)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawCollectorTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    /* Personnage */
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    /* Sac de collecte */
    ctx.fillStyle = "#6E4B2A";
    ctx.strokeStyle = "#3A2717";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Sac intérieur */
    ctx.fillStyle = "#8E6336";

    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();

    /* Ressources */
    ctx.fillStyle = "#6DBE45";
    ctx.beginPath();
    ctx.arc(-10, -8, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#8C8C8C";
    ctx.beginPath();
    ctx.arc(10, -7, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#E34A3B";
    ctx.beginPath();
    ctx.arc(0, 10, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

window.addEventListener("DOMContentLoaded", () => {
    const canvases = document.querySelectorAll(".helmet-mini-canvas");

    if (canvases[14]) {
        const ctx = canvases[14].getContext("2d");
        canvases[14].width = 220;
        canvases[14].height = 130;
        drawAssassinTopDown(ctx, 110, 65, 1.05);
    }

    if (canvases[15]) {
        const ctx = canvases[15].getContext("2d");
        canvases[15].width = 220;
        canvases[15].height = 130;
        drawCollectorTopDown(ctx, 110, 65, 1.05);
    }
});

/* AURA ASSASSIN — effet furtif */
function drawAssassinAura(ctx, x, y, time) {
    const pulse = 1 + Math.sin(time / 420) * 0.08;

    ctx.save();
    ctx.translate(x, y);

    /* Halo extérieur */
    const gradient = ctx.createRadialGradient(0, 0, 8, 0, 0, 40 * pulse);
    gradient.addColorStop(0, "rgba(190, 120, 255, 0.42)");
    gradient.addColorStop(0.35, "rgba(125, 55, 230, 0.24)");
    gradient.addColorStop(0.7, "rgba(75, 20, 160, 0.10)");
    gradient.addColorStop(1, "rgba(40, 0, 80, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 40 * pulse, 0, Math.PI * 2);
    ctx.fill();

    /* Anneaux d'énergie */
    ctx.shadowColor = "rgba(190, 120, 255, 0.9)";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(215, 170, 255, 0.9)";
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.arc(0, 0, 30 * pulse, time / 900, time / 900 + Math.PI * 1.35);
    ctx.stroke();

    ctx.strokeStyle = "rgba(105, 60, 190, 0.5)";
    ctx.beginPath();
    ctx.arc(0, 0, 35 * pulse, -time / 1100, -time / 1100 + Math.PI);
    ctx.stroke();

    /* Petites particules */
    for (let i = 0; i < 6; i++) {
        const a = time / 900 + i * Math.PI / 3;
        const r = 32 + Math.sin(time / 300 + i) * 3;

        ctx.fillStyle = "rgba(205, 165, 255, 0.8)";
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
}

/* AURA COLLECTEUR — richesse / ressources */
function drawCollectorAura(ctx, x, y, time) {
    const pulse = 1 + Math.sin(time / 380) * 0.07;

    ctx.save();
    ctx.translate(x, y);

    /* Halo doré */
    const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 42 * pulse);
    gradient.addColorStop(0, "rgba(255, 230, 100, 0.48)");
    gradient.addColorStop(0.35, "rgba(180, 220, 65, 0.27)");
    gradient.addColorStop(0.7, "rgba(110, 150, 30, 0.10)");
    gradient.addColorStop(1, "rgba(80, 120, 20, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 42 * pulse, 0, Math.PI * 2);
    ctx.fill();

    /* Anneaux dorés */
    ctx.shadowColor = "rgba(255, 220, 80, 0.95)";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(255, 235, 130, 0.95)";
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.arc(0, 0, 31 * pulse, -time / 1000, -time / 1000 + Math.PI * 1.5);
    ctx.stroke();

    ctx.strokeStyle = "rgba(130, 210, 80, 0.55)";
    ctx.beginPath();
    ctx.arc(0, 0, 36 * pulse, time / 1200, time / 1200 + Math.PI);
    ctx.stroke();

    /* Particules bois / pierre / nourriture */
    const particles = [
        { color: "#6DBE45", angle: 0 },
        { color: "#929292", angle: Math.PI * 2 / 3 },
        { color: "#E34A3B", angle: Math.PI * 4 / 3 }
    ];

    particles.forEach((particle, i) => {
        const a = time / 1000 + particle.angle;
        const r = 31 + Math.sin(time / 300 + i) * 3;

        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.shadowBlur = 0;
    ctx.restore();
}

/* Animation Assassin + Collecteur */
(function startLegendaryAnimations() {
    function start() {
        const legendary = document.querySelectorAll("#helmet-shop-page .helmet-rarity-section.legendary .helmet-shop-item");

        if (legendary.length < 2) {
            console.log("❌ Cartes légendaires introuvables");
            return;
        }

        const assassinCanvas = legendary[0].querySelector(".helmet-mini-canvas");
        const collectorCanvas = legendary[1].querySelector(".helmet-mini-canvas");

        function animate(canvas, aura, skin) {
            if (!canvas) return;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            canvas.width = 220;
            canvas.height = 130;

            function frame(time) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const x = canvas.width / 2;
                const y = canvas.height / 2;

                aura(ctx, x, y, time);
                skin(ctx, x, y, 1.05);

                requestAnimationFrame(frame);
            }

            requestAnimationFrame(frame);
        }

        animate(
            assassinCanvas,
            drawAssassinAura,
            drawAssassinTopDown
        );

        animate(
            collectorCanvas,
            drawCollectorAura,
            drawCollectorTopDown
        );

        console.log("✅ Auras Assassin + Collecteur animées");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();

/* ==========================================
   MYTHIQUE — ANGE DÉCHU
   ========================================== */


/* Aura rouge extrêmement rapide */


/* ==========================================
   ANGE DÉCHU — VISUEL MYTHIQUE
   ========================================== */

function drawFallenAngelTopDown(ctx, x, y, scale = 1) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const time = performance.now();
    const flap = Math.sin(time / 620) * 0.10;

    function drawWing(side) {
        ctx.save();
        ctx.scale(side, 1);
        ctx.rotate(-0.18 - flap);

        const gradient = ctx.createLinearGradient(0, 0, 48, -35);

        if (side < 0) {
            gradient.addColorStop(0, "#292929");
            gradient.addColorStop(0.45, "#111111");
            gradient.addColorStop(1, "#000000");
            ctx.strokeStyle = "#050505";
        } else {
            gradient.addColorStop(0, "#FFFFFF");
            gradient.addColorStop(0.45, "#F0F0F0");
            gradient.addColorStop(1, "#BDBDBD");
            ctx.strokeStyle = "#D5D5D5";
        }

        ctx.fillStyle = gradient;
        ctx.lineWidth = 1.8;

        /* Silhouette identique des deux ailes */
        ctx.beginPath();
        ctx.moveTo(5, 7);
        ctx.bezierCurveTo(15, 2, 22, -8, 26, -19);
        ctx.bezierCurveTo(30, -31, 39, -40, 51, -45);
        ctx.bezierCurveTo(47, -36, 48, -28, 53, -20);
        ctx.bezierCurveTo(43, -23, 36, -20, 29, -15);
        ctx.bezierCurveTo(40, -14, 48, -9, 54, -1);
        ctx.bezierCurveTo(43, -5, 35, -3, 28, 2);
        ctx.bezierCurveTo(38, 6, 43, 12, 47, 19);
        ctx.bezierCurveTo(34, 14, 22, 11, 10, 11);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        /* Grandes plumes détaillées */
        for (let i = 0; i < 7; i++) {
            const px = 14 + i * 5.3;
            const py = 5 - i * 5.2;

            ctx.beginPath();
            ctx.moveTo(7, 7);
            ctx.quadraticCurveTo(
                px - 2,
                py - 5,
                px,
                py
            );
            ctx.stroke();
        }

        /* Contours internes */
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 0.9;

        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(12 + i * 3, 5 - i * 2);
            ctx.lineTo(29 + i * 3, -13 - i * 4);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    /* Deux ailes parfaitement identiques */
    drawWing(-1);
    drawWing(1);

    /* PNJ beige */
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    /* Anneau centré */
    ctx.save();

    const ringPulse = 1 + Math.sin(time / 260) * 0.04;
    ctx.scale(ringPulse, ringPulse);

    ctx.shadowColor = "rgba(255,255,255,0.75)";
    ctx.shadowBlur = 7;
    ctx.lineWidth = 4;

    ctx.strokeStyle = "#050505";
    ctx.beginPath();
    ctx.arc(0, 0, 12, Math.PI * 0.05, Math.PI * 0.98);
    ctx.stroke();

    ctx.strokeStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(0, 0, 12, Math.PI * 1.05, Math.PI * 1.98);
    ctx.stroke();

    ctx.shadowBlur = 0;

    /* RGB très fin */
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#00FFFF";
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#FF00FF";
    ctx.beginPath();
    ctx.arc(0, 0, 15, time / 500, time / 500 + Math.PI);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
}

/* AURA ROUGE — FLUX UNIQUE */
function drawFallenAngelAura(ctx, x, y, time) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);

    const pulse = 1 + Math.sin(time / 145) * 0.08;
    const glowPulse = 0.65 + Math.sin(time / 110) * 0.35;

    /* GLOW LUMINEUX PRINCIPAL */
    ctx.shadowColor = `rgba(255,35,25,${0.75 + glowPulse * 0.2})`;
    ctx.shadowBlur = 18;

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 27 * pulse);
    glow.addColorStop(0, "rgba(255,255,255,0.28)");
    glow.addColorStop(0.18, "rgba(255,110,90,0.25)");
    glow.addColorStop(0.42, "rgba(255,30,20,0.18)");
    glow.addColorStop(0.72, "rgba(180,0,0,0.08)");
    glow.addColorStop(1, "rgba(70,0,0,0)");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 27 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    /* COURONNE DE LUMIÈRE */
    ctx.save();
    ctx.rotate(time / 800);

    ctx.shadowColor = "rgba(255,255,255,0.95)";
    ctx.shadowBlur = 10;

    ctx.strokeStyle = `rgba(255,255,255,${0.65 + glowPulse * 0.3})`;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(0, 0, 22 * pulse, -0.7, 0.7);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,40,25,${0.75 + glowPulse * 0.2})`;

    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, Math.PI - 0.7, Math.PI + 0.7);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();

    /* PARTICULES TRÈS LUMINEUSES */
    for (let i = 0; i < 24; i++) {
        const angle = i * 2.399 + time / (850 + i * 12);
        const radius = 17 + (i % 5) * 2.4;

        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;

        const brightness = 0.65 + Math.sin(time / 90 + i * 2) * 0.35;
        const size = 0.8 + (i % 3) * 0.5;

        ctx.shadowColor = i % 4 === 0
            ? "rgba(255,255,255,1)"
            : "rgba(255,25,15,1)";

        ctx.shadowBlur = 9;

        ctx.fillStyle = i % 4 === 0
            ? `rgba(255,255,255,${brightness})`
            : `rgba(255,45,30,${brightness})`;

        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    /* FLAMMES LUMINEUSES */
    for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI * 2 / 12 + time / 900;
        const r1 = 17;
        const r2 = 25 + Math.sin(time / 100 + i) * 3;

        const x1 = Math.cos(angle) * r1;
        const y1 = Math.sin(angle) * r1;
        const x2 = Math.cos(angle) * r2;
        const y2 = Math.sin(angle) * r2;

        ctx.shadowColor = i % 2
            ? "rgba(255,20,10,1)"
            : "rgba(255,255,255,1)";

        ctx.shadowBlur = 8;

        ctx.strokeStyle = i % 2
            ? "rgba(255,45,25,0.95)"
            : "rgba(255,255,255,0.9)";

        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(
            (x1 + x2) / 2 + Math.sin(time / 90 + i) * 3,
            (y1 + y2) / 2 + Math.cos(time / 90 + i) * 3,
            x2,
            y2
        );
        ctx.stroke();

        ctx.shadowBlur = 0;
    }

    /* ÉTINCELLES BLANCHES */
    for (let i = 0; i < 8; i++) {
        const phase = time / (150 + i * 12) + i * 1.7;
        const radius = 13 + ((time / 30 + i * 11) % 17);

        const px = Math.cos(phase) * radius;
        const py = Math.sin(phase) * radius;

        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 10;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(px - 2.5, py);
        ctx.lineTo(px + 2.5, py);
        ctx.moveTo(px, py - 2.5);
        ctx.lineTo(px, py + 2.5);
        ctx.stroke();

        ctx.shadowBlur = 0;
    }

    /* ÉCLAIRS ROUGES LUMINEUX */
    for (let i = 0; i < 5; i++) {
        const phase = time / 120 + i * 2.8;

        if (Math.sin(phase) > 0.78) {
            const angle = phase * 1.4;
            const r = 19;

            const sx = Math.cos(angle) * r;
            const sy = Math.sin(angle) * r;

            ctx.shadowColor = "rgba(255,0,0,1)";
            ctx.shadowBlur = 12;

            ctx.strokeStyle = "rgba(255,70,45,1)";
            ctx.lineWidth = 1.4;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(
                sx + Math.cos(angle + 0.5) * 6,
                sy + Math.sin(angle + 0.5) * 6
            );
            ctx.lineTo(
                sx + Math.cos(angle - 0.2) * 11,
                sy + Math.sin(angle - 0.2) * 11
            );
            ctx.lineTo(
                sx + Math.cos(angle + 0.3) * 15,
                sy + Math.sin(angle + 0.3) * 15
            );
            ctx.stroke();

            ctx.shadowBlur = 0;
        }
    }

    /* FLASH BLANC + ROUGE DU PERSONNAGE */
    const flash = Math.max(0, Math.sin(time / 180));

    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = 16;

    ctx.fillStyle = `rgba(255,255,255,${flash * 0.10})`;

    ctx.beginPath();
    ctx.arc(0, 0, 20 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.restore();
}


/* =========================================================
   MYTHIQUE — NÉCROPOLIS
   ========================================================= */

function drawNecropolisTopDown(ctx, x, y, scale = 1, time = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const t = time * 0.001;

    /* 4 TENTACULES VERTS TRANSPARENTS */
    function tentacle(angle, phase, length) {
        const sway = Math.sin(t * 1.35 + phase) * 0.38;

        ctx.save();
        ctx.rotate(angle + sway);

        const wave1 = Math.sin(t * 1.8 + phase) * 13;
        const wave2 = Math.sin(t * 2.1 + phase + 1) * 19;
        const wave3 = Math.sin(t * 1.5 + phase + 2) * 14;

        ctx.beginPath();
        ctx.moveTo(8, 5);
        ctx.bezierCurveTo(
            length * .25, wave1,
            length * .48, wave2,
            length * .72, wave3
        );
        ctx.bezierCurveTo(
            length * .84, wave1 * .7,
            length * .94, wave2 * .45,
            length, Math.sin(t * 2.6 + phase) * 8
        );

        ctx.strokeStyle = "rgba(0,255,100,0.38)";
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.shadowColor = "#00ff66";
        ctx.shadowBlur = 15;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(8, 5);
        ctx.bezierCurveTo(
            length * .25, wave1,
            length * .48, wave2,
            length * .72, wave3
        );
        ctx.bezierCurveTo(
            length * .84, wave1 * .7,
            length * .94, wave2 * .45,
            length, Math.sin(t * 2.6 + phase) * 8
        );

        ctx.strokeStyle = "rgba(170,255,200,0.55)";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 5;
        ctx.stroke();

        ctx.fillStyle = "rgba(120,255,170,0.9)";
        ctx.shadowColor = "#00ff66";
        ctx.shadowBlur = 18;

        ctx.beginPath();
        ctx.arc(
            length,
            Math.sin(t * 2.6 + phase) * 8,
            4,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
    }

    tentacle(-2.65, 0, 39);
    tentacle(-0.65, 1.8, 44);
    tentacle(0.55, 3.5, 42);
    tentacle(2.65, 5.2, 38);

    /* CAPE NOIRE DÉCHIRÉE */
    const cape = Math.sin(t * 1.15) * 3;

    ctx.save();
    ctx.translate(0, 9 + cape);

    ctx.fillStyle = "rgba(3,3,6,0.98)";
    ctx.shadowColor = "rgba(0,255,100,0.35)";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(-15,5);
    ctx.quadraticCurveTo(-25,19,-26,34);
    ctx.lineTo(-21,32);
    ctx.lineTo(-18,39);
    ctx.lineTo(-12,33);
    ctx.lineTo(-8,41);
    ctx.lineTo(-2,34);
    ctx.lineTo(5,39);
    ctx.lineTo(9,32);
    ctx.lineTo(16,35);
    ctx.quadraticCurveTo(24,19,15,5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    /* PEAU BLANCHE */
    ctx.shadowColor = "rgba(0,255,120,0.45)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#f4f4f4";

    ctx.beginPath();
    ctx.arc(0,0,22,0,Math.PI*2);
    ctx.fill();

    /* YEUX */
    ctx.fillStyle = "#00ff66";
    ctx.shadowColor = "#00ff66";
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.arc(-8,-3,3,0,Math.PI*2);
    ctx.arc(8,-3,3,0,Math.PI*2);
    ctx.fill();

    /* COURONNE DE CRÂNES */
    function skull(x,y,r) {
        ctx.fillStyle="#e7ece8";

        ctx.beginPath();
        ctx.arc(x,y,r,0,Math.PI*2);
        ctx.fill();

        ctx.fillStyle="#111514";

        ctx.beginPath();
        ctx.arc(x-r*.38,y-r*.1,r*.24,0,Math.PI*2);
        ctx.arc(x+r*.38,y-r*.1,r*.24,0,Math.PI*2);
        ctx.fill();

        ctx.fillRect(x-r*.24,y+r*.25,r*.48,r*.25);
    }

    skull(-13,-19,5);
    skull(0,-23,5.5);
    skull(13,-19,5);

    ctx.restore();
}


function drawNecropolisAura(ctx, x, y, time) {
    if (!ctx) return;

    ctx.save();
    ctx.translate(x, y);

    const pulse = 1 + Math.sin(time / 180) * 0.08;

    /* Brume compacte */
    const mist = ctx.createRadialGradient(0, 0, 3, 0, 0, 31 * pulse);
    mist.addColorStop(0, "rgba(120,255,100,0.16)");
    mist.addColorStop(0.3, "rgba(45,190,65,0.14)");
    mist.addColorStop(0.65, "rgba(20,70,30,0.08)");
    mist.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = mist;
    ctx.beginPath();
    ctx.arc(0, 0, 31 * pulse, 0, Math.PI * 2);
    ctx.fill();

    /* Âmes qui tournent */
    for (let i = 0; i < 10; i++) {
        const angle = time / (850 + i * 35) + i * 2.2;
        const radius = 18 + (i % 4) * 2.2;

        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;

        const size = 1.5 + (i % 2) * 0.7;

        ctx.shadowColor = "rgba(100,255,110,0.95)";
        ctx.shadowBlur = 7;

        ctx.fillStyle = i % 3 === 0
            ? "rgba(210,255,210,0.9)"
            : "rgba(70,255,90,0.85)";

        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    /* Petits crânes stylisés */
    for (let i = 0; i < 5; i++) {
        const phase = time / (1000 + i * 80) + i * 1.7;
        const radius = 22 + Math.sin(time / 250 + i) * 3;

        const px = Math.cos(phase) * radius;
        const py = Math.sin(phase) * radius;

        ctx.save();
        ctx.translate(px, py);

        ctx.shadowColor = "rgba(150,255,150,0.9)";
        ctx.shadowBlur = 5;

        ctx.fillStyle = "rgba(205,255,205,0.82)";

        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(20,45,25,0.9)";

        ctx.beginPath();
        ctx.arc(-1, -0.5, 0.7, 0, Math.PI * 2);
        ctx.arc(1, -0.5, 0.7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillRect(-1.5, 2, 3, 1);

        ctx.restore();
    }

    /* Flammes vertes */
    for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4 + time / 1100;

        const r1 = 18;
        const r2 = 25 + Math.sin(time / 130 + i) * 3;

        const x1 = Math.cos(angle) * r1;
        const y1 = Math.sin(angle) * r1;

        const x2 = Math.cos(angle) * r2;
        const y2 = Math.sin(angle) * r2;

        ctx.shadowColor = "rgba(70,255,80,0.9)";
        ctx.shadowBlur = 8;

        ctx.strokeStyle = i % 2
            ? "rgba(65,255,85,0.8)"
            : "rgba(190,255,190,0.75)";

        ctx.lineWidth = 1.4;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(
            (x1 + x2) / 2 + Math.sin(time / 100 + i) * 2,
            (y1 + y2) / 2 + Math.cos(time / 100 + i) * 2,
            x2,
            y2
        );
        ctx.stroke();

        ctx.shadowBlur = 0;
    }

    /* Fissures d'énergie */
    for (let i = 0; i < 4; i++) {
        const phase = time / 170 + i * 2.5;

        if (Math.sin(phase) > 0.75) {
            const angle = phase * 1.4;
            const r = 20;

            const sx = Math.cos(angle) * r;
            const sy = Math.sin(angle) * r;

            ctx.shadowColor = "rgba(90,255,90,1)";
            ctx.shadowBlur = 8;

            ctx.strokeStyle = "rgba(100,255,110,0.95)";
            ctx.lineWidth = 1.1;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(
                sx + Math.cos(angle + 0.5) * 5,
                sy + Math.sin(angle + 0.5) * 5
            );
            ctx.lineTo(
                sx + Math.cos(angle - 0.2) * 9,
                sy + Math.sin(angle - 0.2) * 9
            );
            ctx.stroke();

            ctx.shadowBlur = 0;
        }
    }

    ctx.restore();
}


/* =========================================================
   ANIMATION DES DEUX SKINS MYTHIQUES
   ========================================================= */

(function () {

    function animateMythics(time) {

        /* ANGE DÉCHU */
        document.querySelectorAll(".mythic-angel-canvas").forEach((canvas) => {
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const x = canvas.width / 2;
            const y = canvas.height / 2;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (typeof drawFallenAngelAura === "function") {
                drawFallenAngelAura(ctx, x, y, time);
            }

            if (typeof drawFallenAngelTopDown === "function") {
                drawFallenAngelTopDown(ctx, x, y, 1);
            }
        });

        /* NÉCROPOLIS */
        document.querySelectorAll(".necropolis-canvas").forEach((canvas) => {
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const x = canvas.width / 2;
            const y = canvas.height / 2 + 8;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (typeof drawNecropolisAura === "function") {
                drawNecropolisAura(ctx, x, y, time);
            }

            if (typeof drawNecropolisTopDown === "function") {
                drawNecropolisTopDown(ctx, x, y, 1, time);
            }
        });

        requestAnimationFrame(animateMythics);
    }

    requestAnimationFrame(animateMythics);

})();

/* =========================
   CLASSEMENT — 100 PLACES
========================= */
(function () {
    const rows = document.getElementById("leaderboard-rows");
    if (!rows) return;

    rows.innerHTML = "";

    for (let i = 1; i <= 100; i++) {
        const row = document.createElement("div");
        row.className = "leader-row";

        row.innerHTML = `
            <span>${i}</span>
            <span>---</span>
            <strong>0</strong>
        `;

        rows.appendChild(row);
    }
})();
