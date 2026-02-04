// ==========================================
// CONTROLADOR PRINCIPAL (Botones y Backend)
// ==========================================

const btnSelfie = document.getElementById("btnSelfie");
const fileInput = document.getElementById("fileInput");

const btnSelfieCenter = document.getElementById("btnSelfieCenter");
const fileInputCenter = document.getElementById("fileInputCenter");

const resultadoDiv = document.getElementById("resultado");
const productButtons = document.querySelectorAll(".product-pill");


// ==========================================
// A. GESTIÓN DE PRODUCTOS (NUEVO SISTEMA)
// ==========================================
const productThumbs = document.querySelectorAll(".product-thumb");

productThumbs.forEach(thumb => {
    thumb.addEventListener("click", () => {
        productThumbs.forEach(t => t.classList.remove("active"));
        thumb.classList.add("active");

        const pid = thumb.dataset.productId;
        
        console.log("Producto seleccionado:", pid);

        if (window.cambiarProductoVisual) {
            cambiarProductoVisual(pid);
        }
    });
});


// ==========================================
// B. LÓGICA REUTILIZABLE (Funciones comunes)
// ==========================================

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
            
            const recommendedId = data.recomendaciones[0].id;
            
            productButtons.forEach(btn => {
                if(btn.dataset.productId === recommendedId) btn.classList.add("active");
                else btn.classList.remove("active");
            });

            if(window.cambiarProductoVisual) cambiarProductoVisual(recommendedId);
        }

        resultadoDiv.innerHTML = html;

    } catch (err) {
        console.error(err);
        resultadoDiv.textContent = "Error de conexión con el servidor.";
    }
}

// Función 2: Lógica para activar cámara (Sirve para ambos botones)
const ejecutarModoSelfie = async () => {
    resultadoDiv.textContent = "Activa la cámara y haz clic en el vídeo para capturar tu rostro.";
    
    if (window.iniciarCamaraYCapturar) {
        window.iniciarCamaraYCapturar((dataUrl) => {
            enviarImagenParaAnalisis(dataUrl);
        });
    } else {
        console.error("Falta el archivo comparador.js");
    }
};

// Función 3: Lógica para subir foto (Sirve para ambos inputs)
const ejecutarSubidaFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
        const dataUrl = evt.target.result;
        
        if(window.cargarImagenEnComparador) window.cargarImagenEnComparador(dataUrl);
        
        enviarImagenParaAnalisis(dataUrl);
    };
    reader.readAsDataURL(file);
};


// ==========================================
// C. ASIGNACIÓN DE EVENTOS (Listeners)
// ==========================================

if(btnSelfie) btnSelfie.addEventListener("click", ejecutarModoSelfie);
if(fileInput) fileInput.addEventListener("change", ejecutarSubidaFoto);

if(btnSelfieCenter) btnSelfieCenter.addEventListener("click", ejecutarModoSelfie);
if(fileInputCenter) fileInputCenter.addEventListener("change", ejecutarSubidaFoto);