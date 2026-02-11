const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d");
let isTransparentBackground = document.body && document.body.dataset.starfield === "transparent";
window.setStarfieldTransparency = value => {
  isTransparentBackground = value === true || value === "transparent";
};

let stars = [];
const layerCount = 3;
const speeds = [0.025, 0.05, 0.1];
const baseStarCount = 50;
let shootingStar = null;
let rotationAngle = 0;
const rotationSpeed = 0.0000375 * (Math.random() < 0.5 ? -1 : 1);
let fieldSize = 0;


function getRandomGrayColor() {
  const grayValue = Math.floor(Math.random() * 256);
  return `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  fieldSize = Math.hypot(canvas.width, canvas.height);
  createStars();
}

function createStars() {
  stars = [];
  const scalingFactor = fieldSize / 1000;
  for (let i = 0; i < layerCount; i += 1) {
    const starCount = Math.floor(baseStarCount * scalingFactor * (i + 1));
    for (let j = 0; j < starCount; j += 1) {
      stars.push({
        x: Math.random() * fieldSize,
        y: Math.random() * fieldSize,
        size: Math.random() * (i + 1) + 0.5,
        speed: speeds[i],
        opacity: Math.random(),
        baseOpacity: Math.random() * 0.5 + 0.5,
        blinkOffset: Math.random() * Math.PI * 2,
        blinkSpeed: 0.8 + Math.random() * 0.6,
        isBlinker: Math.random() < 0.1,
        layer: i
      });
    }
  }
}

function updateStars() {
  stars.forEach(star => {
    star.y -= star.speed;
    const twinkle = Math.sin(Date.now() * 0.001 * star.speed) * 0.3;
    if (star.isBlinker) {
      const blink = Math.max(0, Math.sin(Date.now() * 0.001 * star.blinkSpeed + star.blinkOffset));
      star.opacity = star.baseOpacity * 0.2 + twinkle + blink * 1.4;
    } else {
      star.opacity = star.baseOpacity + twinkle;
    }

    if (star.y < 0) {
      star.y = fieldSize;
      star.x = Math.random() * fieldSize;
    }
  });
}

function drawStars() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  rotationAngle += rotationSpeed;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotationAngle);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  const offsetX = (canvas.width - fieldSize) / 2;
  const offsetY = (canvas.height - fieldSize) / 2;

  if (!isTransparentBackground) {
    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      fieldSize / 8,
      canvas.width / 2,
      canvas.height / 2,
      fieldSize
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(offsetX, offsetY, fieldSize, fieldSize);
  }

  stars.forEach(star => {
    ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
    ctx.fillRect(star.x + offsetX, star.y + offsetY, star.size, star.size);
  });

  ctx.restore();
}

function createShootingStar() {
  const startX = Math.random() * canvas.width;
  const startY = Math.random() * canvas.height;
  const angle = Math.random() * Math.PI * 2;
  const length = Math.random() * 300 + 100;
  const speed = Math.random() * 4 + 2;

  shootingStar = {
    x: startX,
    y: startY,
    length,
    speed,
    opacity: 1,
    dx: Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed
  };

  const nextAppearance = Math.random() * 20000 + 20000;
  setTimeout(createShootingStar, nextAppearance);
}

function updateShootingStar() {
  if (!shootingStar) return;

  shootingStar.x += shootingStar.dx;
  shootingStar.y += shootingStar.dy;
  shootingStar.opacity -= 0.01;

  if (
    shootingStar.opacity <= 0 ||
    shootingStar.x < 0 ||
    shootingStar.x > canvas.width ||
    shootingStar.y < 0 ||
    shootingStar.y > canvas.height
  ) {
    shootingStar = null;
  }
}

function drawShootingStar() {
  if (!shootingStar) return;

  const gradient = ctx.createLinearGradient(
    shootingStar.x,
    shootingStar.y,
    shootingStar.x - shootingStar.dx * shootingStar.length,
    shootingStar.y - shootingStar.dy * shootingStar.length
  );
  gradient.addColorStop(0, `rgba(255, 255, 255, ${shootingStar.opacity})`);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.beginPath();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2;
  ctx.moveTo(shootingStar.x, shootingStar.y);
  ctx.lineTo(
    shootingStar.x - shootingStar.dx * shootingStar.length,
    shootingStar.y - shootingStar.dy * shootingStar.length
  );
  ctx.stroke();
  ctx.closePath();
}

function animate() {
  updateStars();
  updateShootingStar();
  drawStars();
  drawShootingStar();
  requestAnimationFrame(animate);
}

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
createStars();
setTimeout(createShootingStar, Math.random() * 20000 + 20000);
animate();
