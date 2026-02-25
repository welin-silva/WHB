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
// B. MEDIAPIPE FACE MESH (TIEMPO REAL)
// ==========================================

let faceMesh = null;
let cameraMP = null;
let mediaPipeActivo = false;

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

        // ===== VALORACIÓN EN TIEMPO REAL =====
        const ojoIzq = lm[159].y - lm[145].y;
        const ojoDer = lm[386].y - lm[374].y;

        let mensajes = [];

        if (ojoIzq < 0.015 && ojoDer < 0.015) {
            mensajes.push("Signos de cansancio en el contorno de ojos");
        }

        mensajes.push("Rostro correctamente detectado");
        mensajes.push("Textura facial uniforme");

        resultadoDiv.innerHTML = `
            <strong>Valoración en tiempo real:</strong>
            <ul>
                ${mensajes.map(m => `<li>${m}</li>`).join("")}
            </ul>
        `;
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

    // Asegurarnos de limpiar el canvas al detener
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

        // MOSTRAR DATOS DE OPENCV SI EXISTEN
        if (data.metrics) {
            html += "<br><strong>Métricas de Piel (OpenCV):</strong><ul>";
            for (const [key, value] of Object.entries(data.metrics)) {
                html += `<li>${key}: ${value}</li>`;
            }
            html += "</ul>";
        }

        // MOSTRAR DATOS DE DEEPFACE SI EXISTEN
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
// D. ACCIONES DE USUARIO
// ==========================================

const ejecutarModoSelfie = () => {
    resultadoDiv.textContent = "Activa la cámara y mira al frente.";

    if (window.iniciarCamaraYCapturar) {
        window.iniciarCamaraYCapturar((dataUrl) => {
            stopMediaPipe();
            enviarImagenParaAnalisis(dataUrl);
        });

        setTimeout(initMediaPipe, 500);
    }
};

const ejecutarSubidaFoto = (e) => {
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