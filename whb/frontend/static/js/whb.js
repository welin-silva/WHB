// ==========================================
// CONTROLADOR PRINCIPAL (Botones y Backend)
// ==========================================

const btnSelfie = document.getElementById("btnSelfie");
const btnModelo = document.getElementById("btnModelo");
const fileInput = document.getElementById("fileInput");
const resultadoDiv = document.getElementById("resultado");
const productButtons = document.querySelectorAll(".product-pill");

// ---- 1. Gestión de productos (Botones de cremas) ----
productButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        // Gestión visual de los botones (clase active)
        productButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // 1. Decirle al comparador visual que cambie el filtro
        const pid = btn.dataset.productId;
        if (window.cambiarProductoVisual) {
            cambiarProductoVisual(pid);
        }
    });
});

// ---- 2. Envío a backend para análisis ----
async function enviarImagenParaAnalisis(dataUrl) {
    resultadoDiv.textContent = "Analizando tu piel con IA...";
    console.log("Enviando imagen al backend…");

    try {
        const res = await fetch("/analizar_piel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl })
        });

        const data = await res.json();
        
        if (!res.ok) {
            resultadoDiv.textContent = "Error: " + (data.error || "No se pudo analizar la imagen.");
            return;
        }

        // Construir HTML de respuesta
        let html = "";
        if (data.problemas && data.problemas.length > 0) {
            html += "<strong>Puntos detectados:</strong><ul>";
            data.problemas.forEach(p => html += `<li>${p}</li>`);
            html += "</ul>";
        } else {
            html += "No se han detectado problemas relevantes.";
        }

        if (data.recomendaciones && data.recomendaciones.length > 0) {
            html += "<br><strong>Cremas recomendadas:</strong><ul>";
            data.recomendaciones.forEach(p => {
                html += `<li>${p.nombre} – ${p.beneficio}</li>`;
            });
            html += "</ul>";
            
            // Si la IA recomienda algo, activamos esa crema automáticamente en el visualizador
            const recommendedId = data.recomendaciones[0].id;
            
            // Actualizar botones UI
            productButtons.forEach(btn => {
                if(btn.dataset.productId === recommendedId) btn.classList.add("active");
                else btn.classList.remove("active");
            });

            // Actualizar visualizador
            if(window.cambiarProductoVisual) cambiarProductoVisual(recommendedId);
        }

        resultadoDiv.innerHTML = html;

    } catch (err) {
        console.error(err);
        resultadoDiv.textContent = "Error de conexión con el servidor.";
    }
}

// ---- 3. Botón Modo Selfie ----
btnSelfie.addEventListener("click", async () => {
    resultadoDiv.textContent = "Activa la cámara y haz clic en el vídeo para capturar tu rostro.";
    
    // Llamamos a la función del otro archivo para iniciar la webcam
    // Le pasamos una "callback": qué hacer cuando el usuario haga clic en el video (sacar foto)
    if (window.iniciarCamaraYCapturar) {
        window.iniciarCamaraYCapturar((dataUrl) => {
            // Esta función se ejecuta cuando se hace la foto
            enviarImagenParaAnalisis(dataUrl);
        });
    } else {
        console.error("Falta el archivo comparador.js");
    }
});

// ---- 4. Botón Subir Foto ----
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        const dataUrl = e.target.result;
        
        // 1. Mostrar en el comparador
        if(window.cargarImagenEnComparador) window.cargarImagenEnComparador(dataUrl);
        
        // 2. Enviar a analizar
        enviarImagenParaAnalisis(dataUrl);
    };
    reader.readAsDataURL(file);
});

// ---- 5. Botón Usar Modelo (Demo) ----
btnModelo.addEventListener("click", () => {
    // Generar imagen dummy (canvas gris)
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 500;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#666"); grad.addColorStop(1, "#444");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL("image/png");

    // 1. Mostrar en comparador
    if(window.cargarImagenEnComparador) window.cargarImagenEnComparador(dataUrl);
    
    // 2. Analizar
    enviarImagenParaAnalisis(dataUrl);
});