// ==========================================
// COMPARADOR EN VIVO (REAL TIME)
// ==========================================

const videoOriginal  = document.getElementById("video");
const imgOriginal    = document.getElementById("imgOriginal");
const compareWrapper = document.getElementById("compareWrapper");
const divider        = document.getElementById("divider");
const noImageText    = document.getElementById("noImageText");
const compareSlider  = document.getElementById("compareSlider");
const btnFullscreen  = document.getElementById("btnFullscreen");
const cardElement    = document.getElementById("cardToFullscreen");
const mainSliderRow  = document.getElementById("mainSliderRow");
const filteredCanvas = document.getElementById("filteredCanvas");

let visualCurrentPid   = null;
let isVideoMode        = false;
let videoAnimFrame     = null;
let transitionRafId    = null;
let transitionStart    = null;
const TRANSITION_MS    = 420;

// Contorno oval facial — MediaPipe Face Mesh
// Incluye todos los puntos del hairline (fila superior: 10,67,103,54,21,162,127,338,297,332,284,251)
const FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323,
    361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
    176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
    162, 21, 54, 103, 67, 109
];

// Índices de la fila superior (hairline) que extenderemos hacia arriba
const HAIRLINE_IDX = new Set([10, 67, 103, 54, 21, 162, 127, 234,
                               338, 297, 332, 284, 251, 389, 109]);

// --- 1. BARRA DESLIZANTE ---
function updateSliderPosition(val) {
    const percent = Number(val);
    if (divider)        divider.style.left             = `${percent}%`;
    if (filteredCanvas) filteredCanvas.style.clipPath  = `inset(0 ${100 - percent}% 0 0)`;
}

if (compareSlider) {
    compareSlider.addEventListener("input", (e) => updateSliderPosition(e.target.value));
    updateSliderPosition(50);
}

// --- 2. FILTROS CSS POR PRODUCTO ---
// Los parámetros son dictados por app.py vía ui_config.filter_params.
// window.productFilterParams se popula en whb.js cuando llega el JSON del backend.
window.productFilterParams = window.productFilterParams || {};

function filtroCss(pid) {
    const p = window.productFilterParams[pid];
    if (!p) return "brightness(1.05)";
    const partes = [];
    if (p.blur        > 0)  partes.push(`blur(${p.blur}px)`);
    if (p.brightness)       partes.push(`brightness(${p.brightness})`);
    if (p.contrast)         partes.push(`contrast(${p.contrast})`);
    if (p.saturate)         partes.push(`saturate(${p.saturate})`);
    if (p.sepia       > 0)  partes.push(`sepia(${p.sepia})`);
    if (p.hue_rotate  !== 0 && p.hue_rotate != null)
                            partes.push(`hue-rotate(${p.hue_rotate}deg)`);
    return partes.length ? partes.join(" ") : "brightness(1.05)";
}

// --- 3. RECT DE AJUSTE (object-fit emulado en canvas) ---
// Calcula dónde se dibuja la fuente dentro del canvas en modo 'contain' o 'cover'
function calcFitRect(srcW, srcH, dstW, dstH, fit) {
    const scale = fit === "cover"
        ? Math.max(dstW / srcW, dstH / srcH)
        : Math.min(dstW / srcW, dstH / srcH); // contain
    const w = srcW * scale;
    const h = srcH * scale;
    return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

// --- 4. NÚCLEO: DIBUJO EN CANVAS SIN ESCALADO ABERRANTE ---
// Buffer interno = tamaño CSS del elemento → clip-path CSS-space y canvas-space son 1:1.
// La fuente se dibuja con contain/cover para NO estirar la imagen.
function dibujarFiltroEnCanvas(fuente, pid, fit) {
    if (!filteredCanvas) return;
    const ctx = filteredCanvas.getContext("2d");

    // Dimensiones del contenedor CSS (lo que el usuario ve)
    // En modo vídeo comprobamos ambos para mayor robustez
    const displayW = filteredCanvas.offsetWidth  || filteredCanvas.parentElement?.offsetWidth  || 640;
    const displayH = filteredCanvas.offsetHeight || filteredCanvas.parentElement?.offsetHeight || 480;

    // Si el contenedor todavía no tiene dimensiones (cámara no iniciada), esperamos
    if (displayW === 0 || displayH === 0) return;

    // Reajustar buffer solo cuando cambia el tamaño (evita parpadeo en vídeo)
    if (filteredCanvas.width !== displayW || filteredCanvas.height !== displayH) {
        filteredCanvas.width  = displayW;
        filteredCanvas.height = displayH;
    }

    // Dimensiones nativas de la fuente (stream real de la cámara o imagen)
    const srcW = fuente.videoWidth  || fuente.naturalWidth  || fuente.width  || displayW;
    const srcH = fuente.videoHeight || fuente.naturalHeight || fuente.height || displayH;

    // Si el vídeo todavía no tiene resolución, esperamos al siguiente frame
    if (srcW === 0 || srcH === 0) return;

    // Rectángulo de dibujo con el mismo ajuste que el elemento fuente
    const { x: dx, y: dy, w: dw, h: dh } = calcFitRect(srcW, srcH, displayW, displayH, fit || "contain");

    ctx.clearRect(0, 0, displayW, displayH);

    // Máscara facial si tenemos landmarks válidos
    const lm = window.faceLandmarks;
    if (lm && lm.length > 0) {
        // Calcular extensión de frente: 15% de la altura facial hacia arriba
        const faceTopY    = Math.min(...FACE_OVAL.map(i => lm[i].y));
        const faceBotY    = lm[152].y; // mentón
        const foreheadExt = (faceBotY - faceTopY) * 0.15; // en coordenadas normalizadas

        ctx.save();
        ctx.beginPath();
        const px = (n, idx) => dx + n.x * dw;
        // Para puntos del hairline, subimos el y el extra de frente
        const py = (n, idx) => dy + (HAIRLINE_IDX.has(idx) ? n.y - foreheadExt : n.y) * dh;

        ctx.moveTo(px(lm[FACE_OVAL[0]], FACE_OVAL[0]),
                   py(lm[FACE_OVAL[0]], FACE_OVAL[0]));
        FACE_OVAL.slice(1).forEach(i => ctx.lineTo(px(lm[i], i), py(lm[i], i)));
        ctx.closePath();
        ctx.clip();
    }

    // Dibuja fuente → destino, píxel a píxel, sin estirado extra
    ctx.filter = filtroCss(pid);
    ctx.drawImage(fuente, 0, 0, srcW, srcH, dx, dy, dw, dh);

    if (lm && lm.length > 0) ctx.restore();
}

// --- 5. APLICAR FILTRO (foto o vídeo) ---
function aplicarFiltroInterno() {
    if (!visualCurrentPid) return;

    if (isVideoMode) {
        if (videoAnimFrame) cancelAnimationFrame(videoAnimFrame);
        const loop = () => {
            if (!isVideoMode || !videoOriginal.srcObject) return;
            // Vídeo usa object-fit: cover → usamos "cover" en el cálculo
            dibujarFiltroEnCanvas(videoOriginal, visualCurrentPid, "cover");
            videoAnimFrame = requestAnimationFrame(loop);
        };
        loop();
    } else {
        // Foto usa object-fit: contain
        const renderFoto = (src) => dibujarFiltroEnCanvas(src, visualCurrentPid, "contain");
        if (!imgOriginal.src || !imgOriginal.complete) {
            imgOriginal.onload = () => renderFoto(imgOriginal);
        } else {
            renderFoto(imgOriginal);
        }
    }

    if (mainSliderRow) {
        mainSliderRow.style.display    = "flex";
        mainSliderRow.style.visibility = "visible";
        mainSliderRow.style.opacity    = "1";
    }
}

window.cambiarProductoVisual = function(productId) {
    if (productId === visualCurrentPid) return;

    if (!filteredCanvas) { visualCurrentPid = productId; aplicarFiltroInterno(); return; }

    // En modo vídeo no hay transición (el loop ya es continuo); cambiar pid y seguir
    if (isVideoMode) { visualCurrentPid = productId; return; }

    // En modo foto: fade canvas a 0, cambiar filtro, fade a 1
    if (transitionRafId) cancelAnimationFrame(transitionRafId);
    transitionStart = null;

    function fadeOut(ts) {
        if (!transitionStart) transitionStart = ts;
        var p = Math.min((ts - transitionStart) / (TRANSITION_MS / 2), 1);
        filteredCanvas.style.opacity = (1 - p).toFixed(3);
        if (p < 1) {
            transitionRafId = requestAnimationFrame(fadeOut);
        } else {
            filteredCanvas.style.opacity = '0';
            visualCurrentPid = productId;
            aplicarFiltroInterno();
            transitionStart = null;
            transitionRafId = requestAnimationFrame(fadeIn);
        }
    }

    function fadeIn(ts) {
        if (!transitionStart) transitionStart = ts;
        var p = Math.min((ts - transitionStart) / (TRANSITION_MS / 2), 1);
        filteredCanvas.style.opacity = p.toFixed(3);
        if (p < 1) {
            transitionRafId = requestAnimationFrame(fadeIn);
        } else {
            filteredCanvas.style.opacity = '1';
        }
    }

    transitionRafId = requestAnimationFrame(fadeOut);
};

// --- 6. CARGAR FOTO ---
window.cargarImagenEnComparador = function(dataUrl) {
    isVideoMode = false;
    if (videoAnimFrame) { cancelAnimationFrame(videoAnimFrame); videoAnimFrame = null; }

    if (videoOriginal) videoOriginal.style.display = "none";
    if (compareWrapper) compareWrapper.style.display = "block";
    if (noImageText)    noImageText.style.display    = "none";
    if (btnFullscreen)  btnFullscreen.style.display  = "flex";
    if (divider) { divider.style.display = "block"; divider.style.left = "50%"; }
    if (compareSlider)  compareSlider.value = 50;
    updateSliderPosition(50);

    if (imgOriginal) imgOriginal.src = dataUrl;

    // Renderizar canvas con la foto ya cargada
    const img = new Image();
    img.onload = () => {
        filteredCanvas.width  = filteredCanvas.offsetWidth  || img.naturalWidth;
        filteredCanvas.height = filteredCanvas.offsetHeight || img.naturalHeight;
        if (visualCurrentPid) dibujarFiltroEnCanvas(img, visualCurrentPid, "contain");
    };
    img.src = dataUrl;

    if (mainSliderRow) {
        mainSliderRow.style.display    = "flex";
        mainSliderRow.style.visibility = "visible";
        mainSliderRow.style.opacity    = "1";
    }
};

// --- 7. RECALCULAR CANVAS AL REDIMENSIONAR VENTANA ---
// Necesario para que el modo selfie se adapte cuando el contenedor cambia de tamaño.
window.addEventListener('resize', () => {
    if (visualCurrentPid) aplicarFiltroInterno();
});

// --- 8. PANTALLA COMPLETA ---
if (btnFullscreen && cardElement) {
    btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            cardElement.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    });
}
