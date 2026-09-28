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
