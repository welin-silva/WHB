from flask import Flask, render_template, request, jsonify
import base64
import io
from PIL import Image
import numpy as np
      #hola
# IA (para usar más adelante)
# import cv2
# import mediapipe as mp

app = Flask(
    __name__,
    template_folder="../frontend/templates",   # 👈 ruta correcta
    static_folder="../frontend/static"        # 👈 css/js/img
)

# -----------------------------
# Productos MartiDerm (los de tu imagen)
# -----------------------------
MARTIDERM_PRODUCTS = [
    {
        "id": "arrugas",
        "nombre": "Black Diamond Epigence SPF 50+ (Arrugas)",
        "beneficio": "-36% arrugas / líneas de expresión",
        "imagen_url": "/static/img/arrugas.jpeg"  # RUTA DE IMAGEN
    },
    {
        "id": "manchas",
        "nombre": "Pigment Zero - DSP-Cover (DSP-Cream (Manchas))",
        "beneficio": "65% tono más uniforme",
        "imagen_url": "/static/img/manchas.jpeg"
    },
    {
        "id": "firmeza",
        "nombre": "Black Diamond Skin Complex Advanced (Firmeza)",
        "beneficio": "24% piel más firme",
        "imagen_url": "/static/img/firmeza.jpeg"
    },
    {
        "id": "piel_apagada",
        "nombre": "Booster - Serum Ultimate Antiox (Piel apagada)",
        "beneficio": "91% piel más luminosa",
        "imagen_url": "/static/img/piel_apagada.jpeg"
    },
    {
        "id": "acne",
        "nombre": "Acniover - Crema Tratante (Acné / Imperfecciones)",
        "beneficio": "35% imperfecciones",
        "imagen_url": "/static/img/acne.jpeg"
    },
]


# -----------------------------
# Lógica sencilla de “IA” de demo
# -----------------------------
def buscar_producto(pid: str):
    for p in MARTIDERM_PRODUCTS:
        if p["id"] == pid:
            return p
    return None


def analizar_piel_sencillo(imagen_pil: Image.Image) -> dict:
    """
    Análisis sencillo con 'IA ligera' para demo.
    Más adelante aquí conectaremos OpenCV + MediaPipe para:
      - landmarks faciales
      - detección de zonas concretas
    """
    # Redimensionamos y pasamos a array
    img = np.array(imagen_pil.resize((256, 256)))

    # Espacio HSV para mirar brillo y tono
    hsv = Image.fromarray(img).convert("HSV")
    hsv_np = np.array(hsv)

    # Canal de luminosidad (V) y saturación (S)
    luminosidad_media = hsv_np[:, :, 2].mean()
    saturacion_media = hsv_np[:, :, 1].mean()

    problemas = []
    recomendaciones = []

    # Reglas muy simples SOLO para demo visual
    if luminosidad_media < 90:
        problemas.append("Piel apagada / falta de luminosidad")
        recomendaciones.append(buscar_producto("piel_apagada"))
    elif luminosidad_media > 170:
        problemas.append("Brillo elevado en la piel (especialmente zona T)")
        # aquí podrías asociar un producto matificante, si lo hubiera

    if saturacion_media < 65:
        problemas.append("Tono poco uniforme, posible apariencia de manchas suaves")
        recomendaciones.append(buscar_producto("manchas"))

    # Añadimos algunos problemas estándar para enseñar todo el catálogo
    if buscar_producto("arrugas") not in recomendaciones:
        recomendaciones.append(buscar_producto("arrugas"))
        problemas.append("Líneas de expresión en contorno de ojos / frente (estimado)")

    if buscar_producto("firmeza") not in recomendaciones:
        recomendaciones.append(buscar_producto("firmeza"))
        problemas.append("Necesidad de mayor firmeza en óvalo facial (estimado)")

    if buscar_producto("acne") not in recomendaciones:
        recomendaciones.append(buscar_producto("acne"))
        problemas.append("Posibles imperfecciones o textura irregular (estimado)")

    # Eliminamos None y duplicados
    recomendaciones = [p for p in recomendaciones if p]
    unique = []
    seen = set()
    for p in recomendaciones:
        if p["id"] not in seen:
            seen.add(p["id"])
            unique.append(p)

    return {
        "problemas": problemas,
        "recomendaciones": unique,
        "metrics": {
            "luminosidad_media": float(luminosidad_media),
            "saturacion_media": float(saturacion_media),
        }
    }


# -----------------------------
# Rutas Flask
# -----------------------------
@app.route("/")
def index():
    return render_template("index.html", productos=MARTIDERM_PRODUCTS)


@app.route("/analizar_piel", methods=["POST"])
def analizar_piel_api():
    """
    Endpoint que recibe una imagen en base64 (data URL)
    y devuelve el análisis sencillo.
    """
    data = request.get_json() or {}
    image_data = data.get("image")

    if not image_data:
        return jsonify({"error": "No se ha recibido imagen"}), 400

    # Eliminar el prefijo "data:image/xxx;base64," si viene incluido
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_data)
        imagen = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        return jsonify({"error": f"Imagen no válida: {e}"}), 400

    resultado = analizar_piel_sencillo(imagen)
    return jsonify(resultado)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
