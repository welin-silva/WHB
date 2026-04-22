// ==========================================
// CONFIGURACIÓN PARA EL EQUIPO (FLAGS FRONTEND)
// ==========================================
// Cambiar a 'false' para apagar la malla verde en pantalla (ideal para trabajar en backend)
const ENABLE_LIVE_MESH = true; 

// ==========================================
// CONTROLADOR PRINCIPAL (Botones y Backend)
// ==========================================

const btnSelfie = document.getElementById("btnSelfie");
const fileInput = document.getElementById("fileInput");

const btnSelfieCenter = document.getElementById("btnSelfieCenter");
const fileInputCenter = document.getElementById("fileInputCenter");

const resultadoDiv = document.getElementById("resultado");

// VIDEO + CANVAS
const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("faceMeshCanvas");
const canvasCtx = canvasElement.getContext("2d");

// ==========================================
// A. GESTIÓN DE PRODUCTOS
// ==========================================

const productThumbs = document.querySelectorAll(".product-thumb");

productThumbs.forEach(thumb => {
    thumb.addEventListener("click", () => {
        productThumbs.forEach(t => t.classList.remove("active"));
        thumb.classList.add("active");

        const pid = thumb.dataset.productId;
        if (window.cambiarProductoVisual) cambiarProductoVisual(pid);
    });
});

// ==========================================
// B. MOTOR BIOMÉTRICO MEDIAPIPE (TIEMPO REAL)
// ==========================================

let faceMesh = null;
let cameraMP = null;
let mediaPipeActivo = false;

// Variables para el escáner automático
let isScanning = false;
let scanTimer = 5;
let scanInterval = null;

// Funciones matemáticas para cálculos 3D
function calcDistancia(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
}

function initMediaPipe() {
    // 🛑 INTERRUPTOR: Si está apagado, salimos de la función y no dibujamos nada
    if (!ENABLE_LIVE_MESH) return;

    if (mediaPipeActivo || !videoElement) return;

    faceMesh = new FaceMesh({
        locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

   faceMesh.onResults((results) => {
        if (!results.multiFaceLandmarks || !videoElement.videoWidth) return;

        // --- CORRECCIÓN 1: RESOLUCIÓN ---
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        const lm = results.multiFaceLandmarks[0];

        // --- CORRECCIÓN 2: DIBUJADO LIMPIO ---
        drawConnectors(
            canvasCtx,
            lm,
            FACEMESH_TESSELATION,
            {
                color: "#00ffcc",
                lineWidth: 1
            }
        );

        // ==========================================
        // CÁLCULOS BIOMÉTRICOS REALES (Normalizados)
        // ==========================================
        
        // 1. Referencia base (Ancho de la cara de pómulo a pómulo)
        const anchoCara = calcDistancia(lm[234], lm[454]);

        // 2. Fatiga Ocular
        const ojoIzq = calcDistancia(lm[159], lm[145]) / anchoCara;
        const ojoDer = calcDistancia(lm[386], lm[374]) / anchoCara;
        const aperturaOjos = (ojoIzq + ojoDer) / 2;
        
        let estadoOjos = "Mirada descansada y abierta";
        if (aperturaOjos < 0.040) estadoOjos = "<span style='color:#ffaa00'>Fatiga ocular (ojos semicerrados)</span>";

        // 3. Tensión del Ceño
        const distanciaCejas = calcDistancia(lm[55], lm[285]) / anchoCara;
        let estadoFrente = "Frente relajada";
        if (distanciaCejas < 0.22) estadoFrente = "<span style='color:#ffaa00'>Tensión detectada en el ceño</span>";

        // 4. Postura (Asimetría)
        const inclinacionY = Math.abs(lm[33].y - lm[263].y); 
        let estadoPostura = "Postura frontal correcta";
        if (inclinacionY > 0.03) estadoPostura = "<span style='color:#ffaa00'>Asimetría postural (cabeza inclinada)</span>";

        // 5. Tensión Labial
        const anchoBoca = calcDistancia(lm[61], lm[291]) / anchoCara;
        let estadoBoca = "Zona peribucal relajada";
        if (anchoBoca < 0.25) estadoBoca = "<span style='color:#ffaa00'>Tensión detectada en zona labial</span>";

        // ==========================================
        // ACTUALIZAR INTERFAZ DURANTE EL ESCÁNER
        // ==========================================
        if (isScanning) {
            resultadoDiv.innerHTML = `
                <div style="text-align: center; margin-bottom: 10px;">
                    <h3 style="color: #00ffcc; font-size: 24px; margin: 0;">Escaneando... ${scanTimer}s</h3>
                    <p style="font-size: 12px; color: #aaa;">Mantén la postura frente a la cámara</p>
                </div>
                <strong>Datos Biométricos en vivo:</strong>
                <ul style="font-size: 14px; line-height: 1.6;">
                    <li>👁️ ${estadoOjos}</li>
                    <li>🤨 ${estadoFrente}</li>
                    <li>📐 ${estadoPostura}</li>
                    <li>👄 ${estadoBoca}</li>
                </ul>
            `;
        }
    });

    cameraMP = new Camera(videoElement, {
        onFrame: async () => {
            if (mediaPipeActivo) {
                await faceMesh.send({ image: videoElement });
            }
        },
        width: 640,
        height: 480
    });

    cameraMP.start();
    mediaPipeActivo = true;
}

function stopMediaPipe() {
    if (!mediaPipeActivo) return;

    mediaPipeActivo = false;

    if (cameraMP) {
        cameraMP.stop();
        cameraMP = null;
    }

    if (canvasCtx && canvasElement) {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
}

// ==========================================
// C. BACKEND (ANÁLISIS POR FOTO) - ACTUALIZADO WHB
// ==========================================

async function enviarImagenParaAnalisis(dataUrl) {
    // 1. Referencias de los tres paneles del HTML
    const resultadoPiel = document.getElementById("resultado");
    const resultadoBio = document.getElementById("resultadoAvanzado");
    const resultadoRasgos = document.getElementById("resultadoDeepFace");
    
    // 2. ESTADOS DE CARGA (Spinners)
    const loader = (msg) => `
        <div style="display: flex; flex-direction: column; align-items: center; padding: 10px; color: #888;">
            <div class="spinner-simple" style="width: 18px; height: 18px; border: 2px solid #333; border-top-color: #00ffcc; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 8px;"></div>
            <p style="font-size: 0.8em; margin:0;">${msg}</p>
        </div>`;

    resultadoPiel.innerHTML = loader("Analizando color...");
    resultadoBio.innerHTML = loader("Calculando biometría...");
    resultadoRasgos.innerHTML = loader("Detectando rasgos...");

    try {
        const res = await fetch("/analizar_piel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl })
        });

        const data = await res.json();
        if (!res.ok) throw new Error("Error en respuesta del servidor");

        // --- 1. PANEL: VALORACIÓN DE TU PIEL (OpenCV / HSV) ---
        if (data.metrics) {
            resultadoPiel.innerHTML = `
                <ul style="font-size: 0.9em; line-height: 1.6;">
                    <li><b>Luminosidad:</b> ${Math.round(data.metrics.luminosidad_media || data.metrics.luminosidad)}</li>
                    <li><b>Saturación:</b> ${Math.round(data.metrics.saturacion_media || data.metrics.saturacion)}</li>
                </ul>
                <p style="font-size: 0.75em; color: #777;">Análisis de pigmentación base completado.</p>
            `;
        }

        // --- 2. PANEL: ANÁLISIS BIOMÉTRICO (Recomendaciones y Gráfico) ---
        let htmlBio = "";
        if (data.problemas?.length) {
            htmlBio += "<b>Puntos detectados:</b><ul style='font-size:0.85em;'>";
            data.problemas.forEach(p => htmlBio += `<li>${p}</li>`);
            htmlBio += "</ul>";
        }

        if (data.recomendaciones?.length) {
            htmlBio += "<b>Tratamiento recomendado:</b><br>";
            data.recomendaciones.forEach(p => {
                htmlBio += `
                    <div style="margin-top: 10px; border-left: 2px solid #f1d592; padding-left: 10px;">
                        <span style="font-size:0.9em; color:#f1d592;">✨ ${p.nombre}</span>
                        <p style="font-size:0.8em; color:#aaa; margin:2px 0;">${p.beneficio}</p>
                    </div>`;
            });
        }
        resultadoBio.innerHTML = htmlBio;

        // --- 3. PANEL: ANÁLISIS DE RASGOS (DeepFace) ---
        if (data.face) {
            const traducir = (emo) => {
                const mapa = {
                    'happy': 'Vital / Radiante', 'neutral': 'Relajado',
                    'sad': 'Fatigado', 'angry': 'Tenso', 'surprise': 'Asombrado', 'fear': 'Estresado'
                };
                return mapa[emo] || emo;
            };

            resultadoRasgos.innerHTML = `
                <div style="background: rgba(209, 179, 255, 0.05); padding: 10px; border-radius: 5px;">
                    <p style="margin: 0 0 5px 0;">📅 <b>Edad estimada:</b> ${data.face.age} años</p>
                    <p style="margin: 0;">🎭 <b>Estado actual:</b> ${traducir(data.face.dominant_emotion)}</p>
                    <p style="font-size: 0.7em; color: #888; margin-top: 8px;">* Basado en micro-expresiones faciales.</p>
                </div>`;
        } else {
            resultadoRasgos.innerHTML = "<p class='small'>No se detectó rostro para el análisis profundo.</p>";
        }

        // AUTO-PRODUCTO: Cambiar la visualización 3D si existe el producto
        if (window.cambiarProductoVisual && data.recomendaciones?.length > 0) {
            window.cambiarProductoVisual(data.recomendaciones[0].id);
        }

    } catch (err) {
        console.error(err);
        resultadoPiel.textContent = "Error de conexión.";
        resultadoBio.textContent = "Error en análisis avanzado.";
        resultadoRasgos.textContent = "Error en motor DeepFace.";
    }
}

// ==========================================
// D. ACCIONES DE USUARIO Y ESCÁNER AUTOMÁTICO
// ==========================================

function empezarEscaneoAutomatico() {
    isScanning = true;
    scanTimer = 6;

    scanInterval = setInterval(() => {
        scanTimer--;

        if (scanTimer <= 0) {
            clearInterval(scanInterval);
            isScanning = false;
            
            resultadoDiv.innerHTML = "<h3 style='color:#00ffcc'>¡Escaneo Completado!</h3><p>Procesando análisis dermatológico profundo...</p>";
            
            // Extraer foto real en secreto
            const canvasTemp = document.createElement("canvas");
            canvasTemp.width = videoElement.videoWidth;
            canvasTemp.height = videoElement.videoHeight;
            const ctxTemp = canvasTemp.getContext("2d");
            ctxTemp.drawImage(videoElement, 0, 0);
            const dataUrl = canvasTemp.toDataURL("image/jpeg", 0.9);

            stopMediaPipe();
            
            if (window.cargarImagenEnComparador) cargarImagenEnComparador(dataUrl);
            enviarImagenParaAnalisis(dataUrl);
        }
    }, 1000);
}

const ejecutarModoSelfie = () => {
    resultadoDiv.innerHTML = "<strong>Iniciando cámara...</strong><br>Mira de frente y relaja el rostro.";

    // --- ¡AQUÍ ESTÁ LA SOLUCIÓN! ---
    // Ocultamos el menú central que tapa el video en directo
    const capaCentral = document.getElementById("noImageText");
    if (capaCentral) capaCentral.style.display = "none";
    
    // Por si acaso, aseguramos que el video esté visible
    if (videoElement) videoElement.style.display = "block";
    // -------------------------------

    // Limpiamos intervalos anteriores
    clearInterval(scanInterval);
    isScanning = false;
    
    // 1. Iniciamos la cámara INMEDIATAMENTE (fuera del setTimeout)
    initMediaPipe();
    
    // Forzamos al navegador a reproducir el video asociándolo a tu clic
    if (videoElement) {
        videoElement.play().catch(err => console.log("Cargando stream..."));
    }
    
    // 2. La cuenta atrás sí la retrasamos un poco para darte tiempo a prepararte
    setTimeout(() => {
        empezarEscaneoAutomatico();
    }, 800);
};
const ejecutarSubidaFoto = (e) => {
    clearInterval(scanInterval);
    isScanning = false;
    stopMediaPipe();

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
        const dataUrl = evt.target.result;
        if (window.cargarImagenEnComparador) cargarImagenEnComparador(dataUrl);
        enviarImagenParaAnalisis(dataUrl);
    };
    reader.readAsDataURL(file);
};

// ==========================================
// E. EVENTOS
// ==========================================

if (btnSelfie) btnSelfie.addEventListener("click", ejecutarModoSelfie);
if (fileInput) fileInput.addEventListener("change", ejecutarSubidaFoto);

if (btnSelfieCenter) btnSelfieCenter.addEventListener("click", ejecutarModoSelfie);
if (fileInputCenter) fileInputCenter.addEventListener("change", ejecutarSubidaFoto);