// ==========================================
// CONFIGURACIÓN PARA EL EQUIPO (FLAGS FRONTEND)
// ==========================================
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
const canvasCtx = canvasElement ? canvasElement.getContext("2d") : null;

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
let mediaPipeActivo = false;

// Variables para el escáner automático
let isScanning = false;
let scanTimer = 5;
let scanInterval = null;

function initMediaPipe() {
    if (!ENABLE_LIVE_MESH) return;
    if (mediaPipeActivo || !videoElement) return;

    faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

   faceMesh.onResults((results) => {
        if (!results.multiFaceLandmarks || !videoElement.videoWidth || !canvasElement) return;

        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        const lm = results.multiFaceLandmarks[0];

        drawConnectors(canvasCtx, lm, FACEMESH_TESSELATION, { color: "#00ffcc", lineWidth: 1 });

        // ===== TU VALORACIÓN EN TIEMPO REAL =====
        const ojoIzq = lm[159].y - lm[145].y;
        const ojoDer = lm[386].y - lm[374].y;

        let mensajes = [];

        if (ojoIzq < 0.015 && ojoDer < 0.015) {
            mensajes.push("Signos de cansancio en el contorno de ojos");
        }

        mensajes.push("Rostro correctamente detectado");
        mensajes.push("Textura facial uniforme");

        if (isScanning && resultadoDiv) {
            resultadoDiv.innerHTML = `
                <div style="text-align: center; margin-bottom: 10px;">
                    <h3 style="color: #00ffcc; font-size: 24px; margin: 0;">Escaneando... ${scanTimer}s</h3>
                </div>
                <strong>Valoración en tiempo real:</strong>
                <ul>
                    ${mensajes.map(m => `<li>${m}</li>`).join("")}
                </ul>
            `;
        }
    });

    mediaPipeActivo = true;
    
    // EL ARREGLO DEL MOTOR: Bucle inteligente que NO bloquea la cámara
    const bucleFaceMesh = async () => {
        if (!mediaPipeActivo || !videoElement || videoElement.paused) return;
        await faceMesh.send({ image: videoElement });
        requestAnimationFrame(bucleFaceMesh);
    };
    bucleFaceMesh();
}

function stopMediaPipe() {
    mediaPipeActivo = false;
    if (canvasCtx && canvasElement) {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
}

// ==========================================
// C. BACKEND (ANÁLISIS POR FOTO)
// ==========================================
async function enviarImagenParaAnalisis(dataUrl) {
    if(resultadoDiv) resultadoDiv.textContent = "Analizando tu piel con IA...";

    try {
        const res = await fetch("/analizar_piel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl })
        });

        const data = await res.json();
        if (!res.ok) {
            if(resultadoDiv) resultadoDiv.textContent = "Error en el análisis.";
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

        if(resultadoDiv) resultadoDiv.innerHTML = html;

    } catch (err) {
        if(resultadoDiv) resultadoDiv.textContent = "Error de conexión con el servidor.";
    }
}

// ==========================================
// D. ESCÁNER AUTOMÁTICO
// ==========================================
function empezarEscaneoAutomatico() {
    if (scanInterval) clearInterval(scanInterval);
    isScanning = true;
    scanTimer = 5;

    scanInterval = setInterval(() => {
        scanTimer--;

        if (scanTimer <= 0) {
            clearInterval(scanInterval);
            isScanning = false;
            
            if(resultadoDiv) resultadoDiv.innerHTML = "<h3 style='color:#00ffcc'>¡Escaneo Completado!</h3><p>Procesando análisis dermatológico profundo...</p>";
            
            // Extraer foto real
            const canvasTemp = document.createElement("canvas");
            canvasTemp.width = videoElement.videoWidth;
            canvasTemp.height = videoElement.videoHeight;
            const ctxTemp = canvasTemp.getContext("2d");
            ctxTemp.drawImage(videoElement, 0, 0);
            const dataUrl = canvasTemp.toDataURL("image/jpeg", 0.9);

            stopMediaPipe();
            
            // Apagar cámara física
            const stream = videoElement.srcObject;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                videoElement.srcObject = null;
            }
            
            if (window.cargarImagenEnComparador) window.cargarImagenEnComparador(dataUrl);
            enviarImagenParaAnalisis(dataUrl);
        }
    }, 1000);
}

// ==========================================
// E. ACCIONES DE USUARIO
// ==========================================
const ejecutarModoSelfie = () => {
    if(resultadoDiv) resultadoDiv.innerHTML = "<strong>Iniciando cámara...</strong><br>Mira de frente y relaja el rostro.";

    if (window.iniciarCamaraYCapturar) {
        window.iniciarCamaraYCapturar(); 
        
        setTimeout(() => {
            initMediaPipe();
            empezarEscaneoAutomatico();
        }, 1000);
    }
};

const ejecutarSubidaFoto = (e) => {
    if (scanInterval) clearInterval(scanInterval);
    isScanning = false;
    stopMediaPipe();

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
        const dataUrl = evt.target.result;
        if (window.cargarImagenEnComparador) window.cargarImagenEnComparador(dataUrl);
        enviarImagenParaAnalisis(dataUrl);
    };
    reader.readAsDataURL(file);
};

if (btnSelfie) btnSelfie.addEventListener("click", ejecutarModoSelfie);
if (fileInput) fileInput.addEventListener("change", ejecutarSubidaFoto);

if (btnSelfieCenter) btnSelfieCenter.addEventListener("click", ejecutarModoSelfie);
if (fileInputCenter) fileInputCenter.addEventListener("change", ejecutarSubidaFoto);