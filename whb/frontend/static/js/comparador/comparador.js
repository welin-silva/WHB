// ==========================================
// COMPARADOR EN VIVO (REAL TIME)
// ==========================================

const videoOriginal = document.getElementById("video");
const videoFiltered = document.getElementById("videoFiltered");
const imgOriginal = document.getElementById("imgOriginal");
const imgFiltered = document.getElementById("imgFiltered");
const compareWrapper = document.getElementById("compareWrapper");
const divider = document.getElementById("divider");
const noImageText = document.getElementById("noImageText");
const compareSlider = document.getElementById("compareSlider");
const btnFullscreen = document.getElementById("btnFullscreen");
const cardElement = document.getElementById("cardToFullscreen");
const mainSliderRow = document.getElementById("mainSliderRow");

let visualCurrentPid = null;
let isVideoMode = false;

// --- 1. FUNCIÓN DE LA BARRA DESLIZANTE ---
function updateSliderPosition(val) {
    const percent = Number(val);
    const clipStyle = `inset(0 ${100 - percent}% 0 0)`;
    
    if(divider) divider.style.left = `${percent}%`;

    if (isVideoMode) {
        if(videoFiltered) videoFiltered.style.clipPath = clipStyle;
    } else {
        if(imgFiltered) imgFiltered.style.clipPath = clipStyle;
    }
}

if (compareSlider) {
    compareSlider.addEventListener("input", (e) => updateSliderPosition(e.target.value));
    updateSliderPosition(50);
}

// --- 2. APLICAR FILTROS (AL VIDEO O A LA FOTO) ---
function aplicarFiltroInterno() {
    let filterCss = "none";
    
    switch (visualCurrentPid) {
        case "piel_apagada": filterCss = "brightness(1.15) contrast(1.1) saturate(1.1)"; break;
        case "manchas": filterCss = "contrast(1.1) saturate(1.15) brightness(1.05)"; break;
        case "arrugas": filterCss = "blur(0.5px) contrast(1.05) brightness(1.05)"; break;
        case "firmeza": filterCss = "contrast(1.15)"; break;
        case "acne": filterCss = "blur(0.4px) contrast(1.1) sepia(0.1)"; break;
        default: filterCss = "brightness(1.05)";
    }

    if (isVideoMode) {
        if(videoFiltered) videoFiltered.style.filter = filterCss;
    } else {
        if(imgFiltered) imgFiltered.style.filter = filterCss;
    }
    
    if (mainSliderRow) {
        mainSliderRow.style.display = ""; 
        mainSliderRow.style.setProperty("display", "flex", "important");
        mainSliderRow.style.visibility = "visible";
        mainSliderRow.style.opacity = "1";
        mainSliderRow.style.zIndex = "99999";
    }
}

window.cambiarProductoVisual = function(productId) {
    visualCurrentPid = productId;
    aplicarFiltroInterno();
};

// --- 3. INICIAR CÁMARA (MODO EN VIVO) ---
window.iniciarCamaraYCapturar = async function() {
    isVideoMode = true; 

    if(compareWrapper) compareWrapper.style.display = "none";
    if(noImageText) noImageText.style.display = "none";
    if(btnFullscreen) btnFullscreen.style.display = "flex";

    const divider = document.getElementById("divider");
    const mainSliderRow = document.getElementById("mainSliderRow");

    if(divider) divider.style.display = "block";
    
    if(mainSliderRow) {
        mainSliderRow.style.display = "flex";
        mainSliderRow.style.visibility = "visible";
        mainSliderRow.style.opacity = "1";
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Tu navegador no soporta cámara");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        videoOriginal.srcObject = stream;
        videoFiltered.srcObject = stream;
        
        videoOriginal.style.display = "block";
        videoFiltered.style.display = "block";
        
        aplicarFiltroInterno();
        updateSliderPosition(50); 
        if(compareSlider) compareSlider.value = 50;

    } catch (err) {
        console.error("Error cámara:", err);
        alert("No se pudo acceder a la cámara.");
    }
};

// --- 4. CARGAR FOTO (POR SI ELIGEN SUBIR ARCHIVO) ---
window.cargarImagenEnComparador = function(dataUrl) {
    isVideoMode = false;
    
    const videoOriginal = document.getElementById("video");
    const videoFiltered = document.getElementById("videoFiltered");
    if(videoOriginal) videoOriginal.style.display = "none";
    if(videoFiltered) videoFiltered.style.display = "none";
    
    const compareWrapper = document.getElementById("compareWrapper");
    const noImageText = document.getElementById("noImageText");
    const btnFullscreen = document.getElementById("btnFullscreen");
    
    if(compareWrapper) compareWrapper.style.display = "block";
    if(noImageText) noImageText.style.display = "none";
    if(btnFullscreen) btnFullscreen.style.display = "flex";

    // ==========================================================
    // 3. EL ARREGLO: ACTIVAR BARRA Y LÍNEA (Igual que en selfie)
    // ==========================================================
    const divider = document.getElementById("divider");
    const mainSliderRow = document.getElementById("mainSliderRow");

    // Mostramos la línea rosa
    if(divider) {
        divider.style.display = "block"; 
        divider.style.left = "50%";
    }
    
    if(mainSliderRow) {
        mainSliderRow.style.display = "flex"; 
        mainSliderRow.style.visibility = "visible";
        mainSliderRow.style.opacity = "1";
    }

    const imgOriginal = document.getElementById("imgOriginal");
    const imgFiltered = document.getElementById("imgFiltered");

    if(imgOriginal) imgOriginal.src = dataUrl;
    if(imgFiltered) {
        imgFiltered.src = dataUrl;
        imgFiltered.style.clipPath = "inset(0 50% 0 0)";
    }
    
    const compareSlider = document.getElementById("compareSlider");
    if(compareSlider) compareSlider.value = 50;
    
    aplicarFiltroInterno();
};

// Pantalla completa
if (btnFullscreen && cardElement) {
    btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            cardElement.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    });
}