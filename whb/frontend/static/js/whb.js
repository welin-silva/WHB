const btnSelfie = document.getElementById("btnSelfie");
const btnModelo = document.getElementById("btnModelo");
const fileInput = document.getElementById("fileInput");
const video = document.getElementById("video");
const compareWrapper = document.getElementById("compareWrapper");
const imgOriginal = document.getElementById("imgOriginal");
const imgFiltered = document.getElementById("imgFiltered");
const divider = document.getElementById("divider");
const noImageText = document.getElementById("noImageText");
const resultadoDiv = document.getElementById("resultado");
const compareSlider = document.getElementById("compareSlider");
const productButtons = document.querySelectorAll(".product-pill");

let stream = null;
let lastCapturedDataUrl = null;
let currentProductId = null;

// ---- Utilidades ----
function setActiveProduct(pid) {
    currentProductId = pid;
    productButtons.forEach(btn => {
        if (btn.dataset.productId === pid) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
    aplicarFiltroCrema();
}

function aplicarFiltroCrema() {
    if (!lastCapturedDataUrl) return;

    // Imagen original siempre sin filtro
    imgOriginal.src = lastCapturedDataUrl;

    // Simulación sencilla de "crema" según producto elegido
    let filterCss = "none";
    switch (currentProductId) {
        case "piel_apagada": // luminosidad
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
            filterCss = "brightness(1.05)";
    }
    imgFiltered.style.filter = filterCss;
    imgFiltered.src = lastCapturedDataUrl;

    showCompare();
}

function showCompare() {
    video.style.display = "none";
    noImageText.style.display = "none";
    compareWrapper.style.display = "block";
}

// slider media cara
function updateSliderPosition(val) {
    const percent = Number(val);
    imgFiltered.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
    divider.style.left = `${percent}%`;
}

compareSlider.addEventListener("input", (e) => {
    updateSliderPosition(e.target.value);
});

// ---- Envío a backend para análisis ----
async function enviarImagenParaAnalisis(dataUrl) {
    resultadoDiv.textContent = "Analizando tu piel con IA...";
    console.log("Enviando imagen al backend…");

    try {
        const res = await fetch("/analizar_piel", {
            // 👈 ahora coincide con la ruta Flask
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl })
        });

        const data = await res.json();
        console.log("Respuesta backend:", data);

        if (!res.ok) {
            resultadoDiv.textContent = "Error: " + (data.error || "No se pudo analizar la imagen.");
            return;
        }

        let html = "";
        if (data.problemas && data.problemas.length > 0) {
            html += "<strong>Puntos que la IA ha detectado en tu piel:</strong><ul>";
            data.problemas.forEach(p => {
                html += `<li>${p}</li>`;
            });
            html += "</ul>";
        } else {
            html += "No se han detectado problemas relevantes en la piel.";
        }

        if (data.recomendaciones && data.recomendaciones.length > 0) {
            html += "<br><strong>Cremas recomendadas:</strong><ul>";
            data.recomendaciones.forEach(p => {
                html += `<li>${p.nombre} – ${p.beneficio}</li>`;
            });
            html += "</ul>";
        }

        resultadoDiv.innerHTML = html;

        // si la IA ha recomendado algo, seleccionamos la primera crema por defecto
        if (data.recomendaciones && data.recomendaciones.length > 0) {
            setActiveProduct(data.recomendaciones[0].id);
        }

    } catch (err) {
        console.error(err);
        resultadoDiv.textContent = "Error de conexión con el servidor.";
    }
}

// ---- Modo selfie ----
btnSelfie.addEventListener("click", async () => {
    compareWrapper.style.display = "none";
    noImageText.style.display = "block";
    resultadoDiv.textContent = "Activa la cámara y haz clic en el vídeo para capturar tu rostro.";

    if (!stream) {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
        } catch (err) {
            console.error(err);
            resultadoDiv.textContent = "No se pudo acceder a la cámara. Comprueba los permisos del navegador.";
            return;
        }
    }

    video.style.display = "block";

    // Captura al hacer clic en el vídeo
    video.onclick = () => {
        if (!video.videoWidth) return;

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");

        lastCapturedDataUrl = dataUrl;
        aplicarFiltroCrema(); // si ya hay crema seleccionada
        enviarImagenParaAnalisis(dataUrl);
    };
});

// ---- Subir foto ----
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        lastCapturedDataUrl = e.target.result;
        aplicarFiltroCrema();
        enviarImagenParaAnalisis(lastCapturedDataUrl);
    };
    reader.readAsDataURL(file);
});

// ---- Usar modelo (demo) ----
btnModelo.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#666");
    grad.addColorStop(1, "#444");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");

    lastCapturedDataUrl = dataUrl;
    aplicarFiltroCrema();
    enviarImagenParaAnalisis(lastCapturedDataUrl);
});

// ---- Selección manual de crema ----
productButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const pid = btn.dataset.productId;
        setActiveProduct(pid);
    });
});

// Posición inicial del slider
updateSliderPosition(compareSlider.value);
