from flask import Flask, render_template, request, jsonify
import base64
import io
from PIL import Image
import numpy as np

# IA (para usar más adelante)
# import cv2
# import mediapipe as mp

app = Flask(
    __name__,
    template_folder="../frontend/templates",   # 👈 ruta correcta
    static_folder="../frontend/static"        # 👈 css/js/img
)

# Productos MartiDerm (los de tu imagen)
MARTIDERM_PRODUCTS = [
    {
        "id": "arrugas",
        "nombre": "Black Diamond – Epigence Optima SPF 50+ (Arrugas)",
        "beneficio": "-36% arrugas / líneas de expresión",
        "descripcion": "Ayuda a reducir arrugas en contorno de ojos, frente y boca."
    },
    {
        "id": "manchas",
        "nombre": "Pigment Zero – DSP-Cover / DSP-Cream (Manchas)",
        "beneficio": "65% tono más uniforme",
        "descripcion": "Reduce la apariencia de manchas e iguala el tono de la piel."
    },
    {
        "id": "firmeza",
        "nombre": "Black Diamond – Skin Complex Advanced (Firmeza)",
        "beneficio": "24% piel más firme",
        "descripcion": "Mejora la firmeza y la forma del óvalo facial y pómulos."
    },
    {
        "id": "piel_apagada",
        "nombre": "Booster – Serum Ultimate Antiox (Piel apagada)",
        "beneficio": "91% piel más luminosa",
        "descripcion": "Aporta luminosidad y efecto glow a la piel cansada."
    },
    {
        "id": "acne",
        "nombre": "Acniover – Crema Tratante (Acné / imperfecciones)",
        "beneficio": "-35% imperfecciones",
        "descripcion": "Reduce el acné, las imperfecciones y unifica el tono."
    },
]


def analizar_piel_sencillo(imagen_pil: Image.Image) -> dict:
    """
    Análisis sencillo con 'IA ligera' para demo.
    Más adelante aquí conectaremos OpenCV + MediaPipe para:
      - landmarks faciales
      - detección de zonas concretas
    """

    # Convertimos la imagen a array NumPy
    img = np.array(imagen_pil.resize((256, 256)))
    # pasamos a espacio HSV para mirar brillo y tono
    hsv = Image.fromarray(img).convert("HSV")
    hsv_np = np.array(hsv)

    # Canal de luminosidad (V)
    luminosidad_media = hsv_np[:, :, 2].mean()
    # Canal de saturación (S)
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

    # añadimos algunos problemas estándar para mostrar todos los productos
    # (así enseñamos el potencial aunque la IA todavía sea sencilla)
    if buscar_producto("arrugas") not in recomendaciones:
        recomendaciones.append(buscar_producto("arrugas"))
        problemas.append("Líneas de expresión en contorno de ojos / frente (estimado)")
    if buscar_producto("firmeza") not in recomendaciones:
        recomendaciones.append(buscar_producto("firmeza"))
        problemas.append("Necesidad de mayor firmeza en óvalo facial (estimado)")
    if buscar_producto("acne") not in recomendaciones:
        recomendaciones.append(buscar_producto("acne"))
        problemas.append("Posibles imperfecciones o textura irregular (estimado)")

    # Eliminamos posibles None y duplicados
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


def buscar_producto(pid: str):
    for p in MARTIDERM_PRODUCTS:
        if p["id"] == pid:
            return p
    return None


@app.route("/")
def index():
    return render_template("index.html", productos=MARTIDERM_PRODUCTS)


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "No se ha recibido imagen"}), 400

    image_data = data["image"].split(",")[1]
    image_bytes = base64.b64decode(image_data)
    imagen = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    resultado = analizar_piel_sencillo(imagen)

    return jsonify(resultado)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
