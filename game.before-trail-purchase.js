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

document.getElementById("shop-button")?.addEventListener("click", () => {
    openPanel("shop-panel");
});

document.getElementById("leaderboard-button")?.addEventListener("click", () => {
    openPanel("leaderboard-panel");
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
