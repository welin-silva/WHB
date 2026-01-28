// ==========================================
// LÓGICA VISUAL: COMPARADOR, VIDEO Y SLIDER
// ==========================================

// 1. Referencias al DOM (Solo elementos visuales)
const videoEl = document.getElementById("video");
const compareWrapper = document.getElementById("compareWrapper");
const imgOriginal = document.getElementById("imgOriginal");
const imgFiltered = document.getElementById("imgFiltered");
const divider = document.getElementById("divider");
const noImageText = document.getElementById("noImageText");
const compareSlider = document.getElementById("compareSlider");

// Estado interno visual
let visualLastDataUrl = null;
let visualCurrentPid = null;
let streamActivo = null;

// ==========================================
// FUNCIONES DEL SLIDER (Deslizar antes/después)
// ==========================================
function updateSliderPosition(val) {
    const percent = Number(val);
    // Recorta la imagen superior (con filtro) desde la derecha
    imgFiltered.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
    // Mueve la línea
    divider.style.left = `${percent}%`;
}

// Escuchar movimiento del slider
if (compareSlider) {
    compareSlider.addEventListener("input", (e) => {
        updateSliderPosition(e.target.value);
    });
    // Inicializar al 50%
    updateSliderPosition(50);
}

// ==========================================
// APLICACIÓN DE FILTROS (Simulación de Crema)
// ==========================================
function aplicarFiltroInterno() {
    if (!visualLastDataUrl) return;

    imgOriginal.src = visualLastDataUrl;
    imgFiltered.src = visualLastDataUrl;

    let filterCss = "none";
    
    // Diccionario de filtros según ID del producto
    switch (visualCurrentPid) {
        case "piel_apagada":
            filterCss = "brightness(1.12) contrast(1.05) saturate(1.08)";
            break;
        case "manchas":
            filterCss = "contrast(1.08) saturate(1.1)";
            break;
        case "arrugas":
            filterCss = "blur(0.4px) contrast(1.03)";
            break;
        case "firmeza":
            filterCss = "contrast(1.12)";
            break;
        case "acne":
            filterCss = "blur(0.35px) contrast(1.05)";
            break;
        default:
            filterCss = "brightness(1.05)"; // Filtro base suave
    }
    
    imgFiltered.style.filter = filterCss;
    
    // Mostrar modo imagen, ocultar video
    videoEl.style.display = "none";
    noImageText.style.display = "none";
    compareWrapper.style.display = "block";
}

// ==========================================
// FUNCIONES PÚBLICAS (Para usar desde whb.js)
// ==========================================

/**
 * Recibe la imagen en base64 y la muestra en el comparador
 */
window.cargarImagenEnComparador = function(dataUrl) {
    visualLastDataUrl = dataUrl;
    // Si el video estaba encendido, apagarlo para ahorrar recursos (opcional)
    if(streamActivo) {
        // streamActivo.getTracks().forEach(track => track.stop());
    }
    aplicarFiltroInterno();
};

/**
 * Cambia el filtro visual según el producto seleccionado
 */
window.cambiarProductoVisual = function(productId) {
    visualCurrentPid = productId;
    aplicarFiltroInterno();
};

/**
 * Inicia la webcam y configura el evento de "click" para capturar
 * @param {Function} onCaptureCallback - Función que se ejecuta al tener la foto
 */
window.iniciarCamaraYCapturar = async function(onCaptureCallback) {
    // UI Setup
    compareWrapper.style.display = "none";
    noImageText.style.display = "block";
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Tu navegador no soporta acceso a cámara");
        return;
    }

    try {
        streamActivo = await navigator.mediaDevices.getUserMedia({ video: true });
        videoEl.srcObject = streamActivo;
        videoEl.style.display = "block";
        
        // Definir qué pasa al hacer click en el video
        videoEl.onclick = () => {
            if (!videoEl.videoWidth) return;

            // Dibujar frame en canvas invisible
            const canvas = document.createElement("canvas");
            canvas.width = videoEl.videoWidth;
            canvas.height = videoEl.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            
            const dataUrl = canvas.toDataURL("image/png");
            
            // Guardar imagen y mostrarla
            visualLastDataUrl = dataUrl;
            aplicarFiltroInterno();

            // Devolver la imagen al controlador principal (whb.js)
            if (onCaptureCallback) onCaptureCallback(dataUrl);
        };

    } catch (err) {
        console.error("Error cámara:", err);
        alert("No se pudo acceder a la cámara.");
    }
};

// ==========================================
// PANTALLA COMPLETA (FULLSCREEN)
// ==========================================
const btnFullscreen = document.getElementById("btnFullscreen");
const cardElement = document.getElementById("cardToFullscreen");

if (btnFullscreen && cardElement) {
    btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            // Entrar en pantalla completa
            cardElement.requestFullscreen().catch(err => {
                console.error(`Error al intentar pantalla completa: ${err.message}`);
            });
        } else {
            // Salir de pantalla completa
            document.exitFullscreen();
        }
    });
}