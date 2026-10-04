const BUILD = '12'
const WORLD = { w: 900, h: 560, ground: 505 }
const FIXED_DT = 1 / 120
const GRAVITY = 900
const MAX_PULL = 118
const LAUNCH_SCALE = 6.25
const SHOT_SETTLE_SECONDS = 0.6
const SHOT_MAX_SECONDS = 5
const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')

const State = Object.freeze({
  AIMING: 'aiming',
  FLYING: 'flying',
  SETTLING: 'settling',
  CONFIRM: 'confirm',
  WON: 'won',
  LOST: 'lost'
})

let dpr = 1
let view = { scale: 1, ox: 0, oy: 0, cssW: 0, cssH: 0 }
let accumulator = 0
let previous = performance.now()
let dragging = false
let pointerId = null
let updating = false
let state = State.AIMING
let score = 0
let critters = 3
let shotClock = 0
let quietClock = 0
let winBonusApplied = false
let message = ''
let messageUntil = 0
let shake = 0
let particles = []
let anchor = { x: 150, y: 390 }
let projectile = null
let blocks = []
let targets = []

function levelOne() {
  return {
    anchor: { x: 150, y: 390 },
    blocks: [
      { id: 'weak', x: 650, y: 438, w: 24, h: 118, hp: 1, weak: true, material: 'wood', vx: 0, vy: 0, angle: 0, omega: 0, dynamic: false, broken: false },
      { id: 'right', x: 790, y: 438, w: 24, h: 118, hp: 2, weak: false, material: 'wood', vx: 0, vy: 0, angle: 0, omega: 0, dynamic: false, broken: false },
      { id: 'beam', x: 720, y: 372, w: 170, h: 22, hp: 2, weak: false, material: 'wood', vx: 0, vy: 0, angle: 0, omega: 0, dynamic: false, broken: false },
      { id: 'glass', x: 720, y: 334, w: 88, h: 18, hp: 1, weak: false, material: 'glass', vx: 0, vy: 0, angle: 0, omega: 0, dynamic: false, broken: false },
      { id: 'upperL', x: 688, y: 292, w: 20, h: 82, hp: 1, weak: false, material: 'wood', vx: 0, vy: 0, angle: 0, omega: 0, dynamic: false, broken: false },
      { id: 'upperR', x: 752, y: 292, w: 20, h: 82, hp: 1, weak: false, material: 'wood', vx: 0, vy: 0, angle: 0, omega: 0, dynamic: false, broken: false },
      { id: 'roof', x: 720, y: 245, w: 112, h: 20, hp: 2, weak: false, material: 'wood', vx: 0, vy: 0, angle: 0, omega: 0, dynamic: false, broken: false }
    ],
    targets: [
      { id: 't1', x: 698, y: 470, r: 19, alive: true },
      { id: 't2', x: 758, y: 470, r: 19, alive: true }
    ]
  }
}

function resetLevel() {
  const l = levelOne()
  anchor = { ...l.anchor }
  blocks = l.blocks.map(b => ({ ...b }))
  targets = l.targets.map(t => ({ ...t }))
  score = 0
  critters = 3
  state = State.AIMING
  dragging = false
  pointerId = null
  shotClock = 0
  quietClock = 0
  winBonusApplied = false
  particles = []
  shake = 0
  message = 'Break the cracked support'
  messageUntil = performance.now() + 2200
  resetProjectile()
}

function resetProjectile() {
  projectile = { x: anchor.x, y: anchor.y, vx: 0, vy: 0, r: 20, active: false, stopped: false }
  shotClock = 0
  quietClock = 0
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cssW = window.innerWidth
  const cssH = window.innerHeight
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.width = cssW + 'px'
  canvas.style.height = cssH + 'px'
  view.cssW = cssW
  view.cssH = cssH
  view.scale = Math.min(cssW / WORLD.w, cssH / WORLD.h)
  view.ox = (cssW - WORLD.w * view.scale) / 2
  view.oy = (cssH - WORLD.h * view.scale) / 2
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function screenToWorld(e) {
  return {
    x: (e.clientX - view.ox) / view.scale,
    y: (e.clientY - view.oy) / view.scale
  }
}

function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

const updateButton = { x: 777, y: 18, w: 103, h: 38 }
const restartButton = { x: 785, y: 516, w: 95, h: 30 }
const confirmButton = { x: 335, y: 419, w: 230, h: 54 }

canvas.addEventListener('pointerdown', e => {
  const p = screenToWorld(e)
  if (inRect(p, updateButton)) {
    forceUpdate()
    return
  }
  if (inRect(p, restartButton)) {
    resetLevel()
    return
  }
  if ((state === State.CONFIRM || state === State.LOST) && inRect(p, confirmButton)) {
    confirmShot()
    return
  }
  if (state !== State.AIMING) return
  if (Math.hypot(p.x - projectile.x, p.y - projectile.y) <= 55) {
    dragging = true
    pointerId = e.pointerId
    canvas.setPointerCapture?.(e.pointerId)
    e.preventDefault()
  }
}, { passive: false })

canvas.addEventListener('pointermove', e => {
  if (!dragging || e.pointerId !== pointerId) return
  const p = screenToWorld(e)
  const dx = p.x - anchor.x
  const dy = p.y - anchor.y
  const d = Math.hypot(dx, dy) || 1
  const pull = Math.min(MAX_PULL, d)
  projectile.x = anchor.x + dx / d * pull
  projectile.y = anchor.y + dy / d * pull
  e.preventDefault()
}, { passive: false })

function release(e) {
  if (!dragging || e.pointerId !== pointerId) return
  dragging = false
  pointerId = null
  const dx = anchor.x - projectile.x
  const dy = anchor.y - projectile.y
  const pull = Math.hypot(dx, dy)
  if (pull < 8) {
    resetProjectile()
    return
  }
  projectile.vx = dx * LAUNCH_SCALE
  projectile.vy = dy * LAUNCH_SCALE
  projectile.active = true
  projectile.stopped = false
  critters--
  state = State.FLYING
  shotClock = 0
  quietClock = 0
  e.preventDefault()
}

canvas.addEventListener('pointerup', release, { passive: false })
canvas.addEventListener('pointercancel', release, { passive: false })
window.addEventListener('resize', resize)

function showMessage(text, ms = 900) {
  message = text
  messageUntil = performance.now() + ms
}

function addScore(points, x, y, label = '+' + points) {
  score += points
  for (let i = 0; i < 8; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 160,
      vy: -80 - Math.random() * 130,
      life: 0.65,
      maxLife: 0.65,
      label: i === 0 ? label : ''
    })
  }
}

function killTarget(target, cause = 'hit') {
  if (!target.alive) return
  target.alive = false
  addScore(1000, target.x, target.y, '+1000')
  shake = Math.max(shake, 8)
  try { navigator.vibrate?.(30) } catch (_) {}
  showMessage(cause === 'crush' ? 'CRUSHED!' : 'DIRECT HIT!', 850)
}

function breakBlock(block, force = 1) {
  if (block.broken) return
  block.broken = true
  block.dynamic = true
  block.vx += force * 45
  block.vy -= 40
  block.omega += force * 0.65
  addScore(block.material === 'glass' ? 50 : 30, block.x, block.y)
  shake = Math.max(shake, block.material === 'glass' ? 9 : 6)

  if (block.id === 'weak') triggerWeakPointCollapse()
}

function triggerWeakPointCollapse() {
  const beam = blocks.find(b => b.id === 'beam')
  const glass = blocks.find(b => b.id === 'glass')
  const upperL = blocks.find(b => b.id === 'upperL')
  const upperR = blocks.find(b => b.id === 'upperR')
  const roof = blocks.find(b => b.id === 'roof')

  const cascade = [
    [beam, -55, 10, -0.85],
    [glass, -15, -15, 0.6],
    [upperL, 25, -10, 1.0],
    [upperR, -30, -5, -0.8],
    [roof, -20, -5, -0.45]
  ]
  cascade.forEach(([b, vx, vy, omega], i) => {
    if (!b || b.dynamic) return
    b.dynamic = true
    b.vx = vx
    b.vy = vy
    b.omega = omega
    b.releaseDelay = i * 0.045
  })
  showMessage('WEAK POINT!', 1000)
}

function circleRectCollision(cx, cy, r, b) {
  const halfW = b.w / 2
  const halfH = b.h / 2
  const nearestX = Math.max(b.x - halfW, Math.min(cx, b.x + halfW))
  const nearestY = Math.max(b.y - halfH, Math.min(cy, b.y + halfH))
  const dx = cx - nearestX
  const dy = cy - nearestY
  return dx * dx + dy * dy <= r * r
}

function projectileHitsStructure() {
  const speed = Math.hypot(projectile.vx, projectile.vy)
  for (const b of blocks) {
    if (b.broken) continue
    if (!circleRectCollision(projectile.x, projectile.y, projectile.r, b)) continue

    const impact = speed
    if (impact > 170) {
      b.hp--
      if (b.hp <= 0) breakBlock(b, Math.sign(projectile.vx) || 1)
    }

    const horizontal = Math.abs(projectile.vx) > Math.abs(projectile.vy)
    if (horizontal) projectile.vx *= -0.32
    else projectile.vy *= -0.32
    projectile.vx *= 0.82
    projectile.vy *= 0.82
    shake = Math.max(shake, Math.min(7, impact / 80))
    return
  }
}

function projectileHitsTargets() {
  const speed = Math.hypot(projectile.vx, projectile.vy)
  if (speed < 120) return
  for (const t of targets) {
    if (!t.alive) continue
    if (Math.hypot(projectile.x - t.x, projectile.y - t.y) <= projectile.r + t.r) {
      killTarget(t, 'hit')
      projectile.vx *= 0.42
      projectile.vy *= 0.42
    }
  }
}

function updateBlocks(dt) {
  let moving = false
  for (const b of blocks) {
    if (!b.dynamic) continue
    if (b.releaseDelay > 0) {
      b.releaseDelay -= dt
      moving = true
      continue
    }
    b.vy += GRAVITY * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.angle += b.omega * dt
    b.vx *= Math.pow(0.992, dt * 60)
    b.omega *= Math.pow(0.988, dt * 60)

    const bottom = b.y + b.h / 2
    if (bottom >= WORLD.ground) {
      b.y = WORLD.ground - b.h / 2
      if (Math.abs(b.vy) > 60) b.vy *= -0.16
      else b.vy = 0
      b.vx *= 0.76
      b.omega *= 0.62
    }

    for (const t of targets) {
      if (!t.alive) continue
      const hit = Math.abs(t.x - b.x) < b.w / 2 + t.r &&
                  Math.abs(t.y - b.y) < b.h / 2 + t.r
      if (hit && (Math.abs(b.vy) > 85 || Math.abs(b.vx) > 85 || Math.abs(b.omega) > 0.45)) {
        killTarget(t, 'crush')
      }
    }

    if (Math.abs(b.vx) > 8 || Math.abs(b.vy) > 8 || Math.abs(b.omega) > 0.08) moving = true
  }
  return moving
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 420 * dt
    p.life -= dt
  }
  particles = particles.filter(p => p.life > 0)
}

function update(dt) {
  updateParticles(dt)
  if (shake > 0) shake = Math.max(0, shake - dt * 24)

  let structureMoving = updateBlocks(dt)

  if (state === State.FLYING || state === State.SETTLING) {
    shotClock += dt
  }

  if (state === State.FLYING) {
    projectile.vy += GRAVITY * dt
    projectile.x += projectile.vx * dt
    projectile.y += projectile.vy * dt
    projectile.vx *= Math.pow(0.999, dt * 60)

    projectileHitsStructure()
    projectileHitsTargets()

    if (projectile.y + projectile.r >= WORLD.ground) {
      projectile.y = WORLD.ground - projectile.r
      if (Math.abs(projectile.vy) > 70) projectile.vy *= -0.3
      else projectile.vy = 0
      projectile.vx *= 0.72
    }

    const out = projectile.x > WORLD.w + 90 || projectile.x < -90 || projectile.y > WORLD.h + 90
    const slow = Math.hypot(projectile.vx, projectile.vy) < 32 && projectile.y >= WORLD.ground - projectile.r - 1

    if (out || slow || shotClock >= SHOT_MAX_SECONDS) {
      projectile.active = false
      projectile.stopped = true
      state = State.SETTLING
      quietClock = 0
    }
  }

  if (state === State.SETTLING) {
    if (structureMoving) quietClock = 0
    else quietClock += dt

    if (targets.every(t => !t.alive) && quietClock >= SHOT_SETTLE_SECONDS) {
      if (!winBonusApplied) {
        score += critters * 500
        winBonusApplied = true
      }
      state = State.WON
      showMessage('LEVEL CLEARED!', 1800)
      return
    }

    if (quietClock >= SHOT_SETTLE_SECONDS || shotClock >= SHOT_MAX_SECONDS) {
      state = critters > 0 ? State.CONFIRM : State.LOST
    }
  }
}

function confirmShot() {
  if (state === State.CONFIRM) {
    resetProjectile()
    state = State.AIMING
    showMessage('Next critter', 650)
  } else if (state === State.LOST) {
    resetLevel()
  }
}

function trajectoryPoints() {
  const dx = anchor.x - projectile.x
  const dy = anchor.y - projectile.y
  const vx = dx * LAUNCH_SCALE
  const vy = dy * LAUNCH_SCALE
  const pts = []
  for (let i = 1; i <= 10; i++) {
    const t = i * 0.11
    pts.push({
      x: projectile.x + vx * t,
      y: projectile.y + vy * t + 0.5 * GRAVITY * t * t
    })
  }
  return pts
}

function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function cloud(cx, cy, s) {
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(cx, cy, 24 * s, 0, Math.PI * 2)
  ctx.arc(cx + 25 * s, cy - 8 * s, 31 * s, 0, Math.PI * 2)
  ctx.arc(cx + 55 * s, cy, 23 * s, 0, Math.PI * 2)
  ctx.fill()
}

function drawBlock(b) {
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(b.angle)
  if (b.material === 'glass') {
    ctx.fillStyle = 'rgba(185,235,255,.55)'
    ctx.strokeStyle = '#7fc8df'
  } else {
    ctx.fillStyle = b.weak ? '#d69349' : '#b97836'
    ctx.strokeStyle = '#77471f'
  }
  ctx.lineWidth = 3
  ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h)
  ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h)

  if (b.weak && !b.broken) {
    ctx.strokeStyle = '#5b3217'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-4, -22)
    ctx.lineTo(5, -9)
    ctx.lineTo(-5, 5)
    ctx.lineTo(6, 20)
    ctx.stroke()
  }
  ctx.restore()
}

function drawTarget(t) {
  if (!t.alive) return
  ctx.fillStyle = '#754bd1'
  ctx.beginPath()
  ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(t.x - 6, t.y - 5, 5, 0, Math.PI * 2)
  ctx.arc(t.x + 6, t.y - 5, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.arc(t.x - 5, t.y - 4, 2, 0, Math.PI * 2)
  ctx.arc(t.x + 7, t.y - 4, 2, 0, Math.PI * 2)
  ctx.fill()
}

function drawCritter() {
  ctx.fillStyle = '#ef5b45'
  ctx.beginPath()
  ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(projectile.x - 7, projectile.y - 6, 5, 0, Math.PI * 2)
  ctx.arc(projectile.x + 7, projectile.y - 6, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#17202b'
  ctx.beginPath()
  ctx.arc(projectile.x - 6, projectile.y - 5, 2, 0, Math.PI * 2)
  ctx.arc(projectile.x + 8, projectile.y - 5, 2, 0, Math.PI * 2)
  ctx.fill()
}

function drawWorld() {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.h)
  gradient.addColorStop(0, '#72c9ff')
  gradient.addColorStop(1, '#d9f2ff')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WORLD.w, WORLD.h)

  cloud(100, 90, .8)
  cloud(420, 120, .55)
  cloud(760, 70, .7)

  ctx.fillStyle = '#6fb84f'
  ctx.fillRect(0, WORLD.ground, WORLD.w, WORLD.h - WORLD.ground)
  ctx.fillStyle = '#4b8d37'
  ctx.fillRect(0, WORLD.ground, WORLD.w, 8)

  roundRect(14, 14, 872, 58, 18, '#101827dd')
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.font = '900 24px system-ui,-apple-system,sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('CRITTER CRASH', 32, 43)

  ctx.font = '700 16px system-ui,-apple-system,sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('Score ' + score + '  •  Critters ' + critters, 755, 43)

  roundRect(updateButton.x, updateButton.y, updateButton.w, updateButton.h, 12, '#f6b73c')
  ctx.fillStyle = '#251600'
  ctx.font = '900 12px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText(updating ? 'UPDATING…' : '↻ UPDATE', updateButton.x + updateButton.w / 2, 38)

  ctx.strokeStyle = '#75451f'
  ctx.lineWidth = 16
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(anchor.x - 25, WORLD.ground)
  ctx.lineTo(anchor.x - 10, anchor.y - 8)
  ctx.moveTo(anchor.x + 25, WORLD.ground)
  ctx.lineTo(anchor.x + 10, anchor.y - 8)
  ctx.stroke()

  if (dragging) {
    ctx.strokeStyle = '#3a2518'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.moveTo(anchor.x - 10, anchor.y - 8)
    ctx.lineTo(projectile.x, projectile.y)
    ctx.lineTo(anchor.x + 10, anchor.y - 8)
    ctx.stroke()

    for (const p of trajectoryPoints()) {
      ctx.fillStyle = '#ffffffc8'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  blocks.forEach(drawBlock)
  targets.forEach(drawTarget)
  drawCritter()

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
    ctx.fillStyle = '#8b5cf6'
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6)
    if (p.label) {
      ctx.fillStyle = '#101827'
      ctx.font = '900 15px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText(p.label, p.x, p.y - 14)
    }
  }
  ctx.globalAlpha = 1

  roundRect(14, 516, 872, 34, 12, '#101827cc')
  ctx.fillStyle = '#dbe7f5'
  ctx.font = '600 14px system-ui'
  ctx.textAlign = 'left'
  const help = state === State.AIMING
    ? 'Pull back • Aim for the cracked support • Release'
    : state === State.FLYING || state === State.SETTLING
      ? 'Watch the destruction settle'
      : 'Review the result before continuing'
  ctx.fillText(help, 28, 533)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#f6b73c'
  ctx.font = '800 14px system-ui'
  ctx.fillText('RESTART', 870, 533)

  if (message && performance.now() < messageUntil) {
    ctx.font = '800 18px system-ui'
    const mw = Math.max(180, ctx.measureText(message).width + 34)
    roundRect((WORLD.w - mw) / 2, 86, mw, 40, 20, '#101827e8', '#ffffff44')
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(message, WORLD.w / 2, 106)
  }

  if (state === State.CONFIRM || state === State.LOST || state === State.WON) {
    roundRect(260, 350, 380, 130, 22, '#101827eb', '#ffffff55')
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = '900 25px system-ui'
    const alive = targets.filter(t => t.alive).length
    ctx.fillText(state === State.WON ? 'LEVEL CLEARED!' : state === State.LOST ? 'OUT OF CRITTERS' : alive + ' TARGET' + (alive === 1 ? '' : 'S') + ' LEFT', 450, 382)

    ctx.font = '700 14px system-ui'
    ctx.fillStyle = '#cdd8e7'
    ctx.fillText(state === State.WON ? 'Score ' + score : 'Take a look, then choose when to continue.', 450, 408)

    if (state !== State.WON) {
      roundRect(confirmButton.x, confirmButton.y, confirmButton.w, confirmButton.h, 16, '#f6b73c')
      ctx.fillStyle = '#251600'
      ctx.font = '900 16px system-ui'
      ctx.fillText(state === State.LOST ? 'RETRY LEVEL' : 'NEXT CRITTER', 450, 446)
    }
  }

  ctx.fillStyle = '#10182799'
  ctx.font = '700 11px ui-monospace,monospace'
  ctx.textAlign = 'left'
  ctx.fillText('BUILD ' + BUILD, 22, 500)
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, view.cssW, view.cssH)
  ctx.fillStyle = '#101827'
  ctx.fillRect(0, 0, view.cssW, view.cssH)

  const sx = shake ? (Math.random() - 0.5) * shake : 0
  const sy = shake ? (Math.random() - 0.5) * shake : 0

  ctx.save()
  ctx.translate(view.ox + sx, view.oy + sy)
  ctx.scale(view.scale, view.scale)
  drawWorld()
  ctx.restore()
}

function frame(now) {
  let delta = Math.min(0.05, (now - previous) / 1000)
  previous = now
  accumulator += delta
  while (accumulator >= FIXED_DT) {
    update(FIXED_DT)
    accumulator -= FIXED_DT
  }
  draw()
  requestAnimationFrame(frame)
}

async function forceUpdate() {
  if (updating) return
  updating = true
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) {
        try { await reg.update() } catch (_) {}
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    }
    const keys = await caches.keys()
    await Promise.all(keys.map(k => caches.delete(k)))
    const url = new URL(location.href)
    url.searchParams.set('_build', BUILD + '-' + Date.now())
    location.replace(url.href)
  } catch (_) {
    location.reload()
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    await reg.update()
  } catch (_) {}
}

resize()
resetLevel()
registerServiceWorker()
requestAnimationFrame(frame)
