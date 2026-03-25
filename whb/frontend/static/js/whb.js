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
// C. BACKEND (ANÁLISIS POR FOTO)
// ==========================================

async function enviarImagenParaAnalisis(dataUrl) {
    resultadoDiv.textContent = "Analizando tu piel con IA...";

    try {
        const res = await fetch("/analizar_piel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl })
        });

        const data = await res.json();
        if (!res.ok) {
            resultadoDiv.textContent = "Error en el análisis.";
            return;
        }

        let html = "";

        if (data.problemas?.length) {
            html += "<strong>Puntos detectados:</strong><ul>";
            data.problemas.forEach(p => html += `<li>${p}</li>`);
            html += "</ul>";
        }

        if (data.recomendaciones?.length) {
            html += "<br><strong>Cremas recomendadas:</strong><ul>";
            data.recomendaciones.forEach(p => {
                html += `<li>${p.nombre} – ${p.beneficio}</li>`;
            });
            html += "</ul>";

            if (window.cambiarProductoVisual) {
                cambiarProductoVisual(data.recomendaciones[0].id);
            }
        }

        if (data.metrics) {
            html += "<br><strong>Métricas de Piel (OpenCV):</strong><ul>";
            for (const [key, value] of Object.entries(data.metrics)) {
                html += `<li>${key}: ${value}</li>`;
            }
            html += "</ul>";
        }

        if (data.face) {
            html += "<br><strong>Análisis Facial (DeepFace):</strong><ul>";
            html += `<li>Edad estimada: ${data.face.edad_estimada}</li>`;
            html += `<li>Emoción: ${data.face.emocion}</li>`;
            html += "</ul>";
        }

        resultadoDiv.innerHTML = html;

    } catch (err) {
        resultadoDiv.textContent = "Error de conexión con el servidor.";
    }
}

// ==========================================
// D. ACCIONES DE USUARIO Y ESCÁNER AUTOMÁTICO
// ==========================================

function empezarEscaneoAutomatico() {
    isScanning = true;
    scanTimer = 5;

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

    if (window.iniciarCamaraYCapturar) {
        // Mantenemos tu función original que enciende el video
        window.iniciarCamaraYCapturar((dataUrl) => {
            // Esto se ejecuta si el usuario hace click manualmente antes de los 5 segundos
            clearInterval(scanInterval);
            isScanning = false;
            stopMediaPipe();
            enviarImagenParaAnalisis(dataUrl);
        });

        // Retrasamos el inicio del escaneo para darle tiempo a la cámara a encenderse
        setTimeout(() => {
            initMediaPipe();
            empezarEscaneoAutomatico();
        }, 800);
    }
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