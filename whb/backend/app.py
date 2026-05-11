import os
import math
import cv2
import base64
import io
import numpy as np
from flask import Flask, render_template, request, jsonify
from PIL import Image

# Importación directa y limpia
from analysis import analyze_frame

app = Flask(
    __name__,
    template_folder="../frontend/templates",
    static_folder="../frontend/static"
)

# Silenciar avisos de TensorFlow para una consola limpia en la presentación
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# --- PRODUCTOS MARTIDERM ---
MARTIDERM_PRODUCTS = [
    {"id": "arrugas", "nombre": "Black Diamond Epigence SPF 50+ (Arrugas)", "beneficio": "-36% arrugas", "imagen_url": "/static/img/arrugas.jpeg"},
    {"id": "manchas", "nombre": "Pigment Zero - DSP-Cover (Manchas)", "beneficio": "65% tono uniforme", "imagen_url": "/static/img/manchas.jpeg"},
    {"id": "firmeza", "nombre": "Black Diamond Skin Complex (Firmeza)", "beneficio": "24% más firme", "imagen_url": "/static/img/firmeza.jpeg"},
    {"id": "piel_apagada", "nombre": "Booster - Serum Antiox (Luminosidad)", "beneficio": "91% más luz", "imagen_url": "/static/img/piel_apagada.jpeg"},
    {"id": "acne", "nombre": "Acniover - Crema Tratante (Acné)", "beneficio": "35% menos imperfecciones", "imagen_url": "/static/img/acne.jpeg"},
]

# --- CONFIG UI CENTRALIZADA EN PYTHON ---
# Toda decisión de estilo reside aquí; el frontend solo renderiza.
#
# CALIBRATED_FILTERS: valores normalizados (0.0-1.0 de intensidad)
# convertidos internamente a unidades CSS-filter.
# blur ≤ 0.4px → no destruye textura diagnóstica.
# brightness en rango 1.04-1.14 → sutileza clínica.
# saturate en rango 0.88-1.20 → diferenciación perceptible sin sobreexposición.
CALIBRATED_FILTERS = {
    "arrugas": {
        # Suavizado de piel sin pérdida de detalle
        "blur":       0.35,
        "brightness": 1.07,
        "contrast":   1.06,
        "saturate":   1.02,
        "sepia":      0.0,
    },
    "manchas": {
        # Homogeneización de tono — saturación elevada pero contenida
        "blur":       0.0,
        "brightness": 1.04,
        "contrast":   1.04,
        "saturate":   1.20,
        "sepia":      0.0,
    },
    "firmeza": {
        # Piel tensa: contraste moderado, sin blur
        "blur":       0.0,
        "brightness": 1.05,
        "contrast":   1.12,
        "saturate":   1.06,
        "sepia":      0.0,
    },
    "piel_apagada": {
        # Luminosidad: brillo y saturación conjuntos
        "blur":       0.0,
        "brightness": 1.14,
        "contrast":   1.06,
        "saturate":   1.18,
        "sepia":      0.0,
    },
    "acne": {
        # Reducción de rojez: desaturación leve + sepia mínimo
        "blur":       0.30,
        "brightness": 1.04,
        "contrast":   1.08,
        "saturate":   0.88,
        "sepia":      0.06,
    },
}

PRODUCT_UI_STYLE = {
    "arrugas":      {"glow_color": "#ff9eb5"},
    "manchas":      {"glow_color": "#7dd4c0"},
    "firmeza":      {"glow_color": "#a78bfa"},
    "piel_apagada": {"glow_color": "#f1d592"},
    "acne":         {"glow_color": "#86efac"},
}

def buscar_producto(pid):
    return next((p for p in MARTIDERM_PRODUCTS if p["id"] == pid), None)

def construir_ui_config(recomendados_ids):
    """
    Calcula posición, color y prioridad de cada producto para el carrusel 3D.
    Los recomendados reciben ángulos frontales (0°, 72°…), los demás van detrás.
    Devuelve (ui_dict, carousel_config) donde carousel_config contiene el radio
    calculado dinámicamente: si se añaden productos, el círculo crece solo.
    """
    total     = len(MARTIDERM_PRODUCTS)
    card_w    = 140   # px — ancho de cada tarjeta 3D
    step      = round(360 / total, 2) if total else 0

    # Radio del cilindro: fórmula que escala con el número de productos
    # R = (card_w/2) / tan(π/n) * factor_espaciado
    radius = max(300, round((card_w / 2) / math.tan(math.pi / total) * 1.9)) if total else 300

    # Orden de aparición: recomendados al frente (ángulos bajos)
    no_rec  = [p["id"] for p in MARTIDERM_PRODUCTS if p["id"] not in recomendados_ids]
    ordered = list(recomendados_ids) + no_rec

    ui = {}
    rec_slot = 0
    for slot, pid in enumerate(ordered):
        is_rec = pid in recomendados_ids
        style = PRODUCT_UI_STYLE[pid]
        ui[pid] = {
            "glow_color":         style["glow_color"],
            "filter_params":      CALIBRATED_FILTERS[pid],
            "is_recommended":     is_rec,
            "is_default_selected": is_rec and rec_slot == 0,
            "z_index":            200 - slot * 10 if is_rec else 50 - slot,
            "rotation_angle":     round(slot * step, 2),
            "viewport_zoom":      1.0,
            "ui_scale":           0.85,
            "layout_mode":        "wide",
        }
        if is_rec:
            rec_slot += 1

    carousel_config = {
        "radius":       radius,
        "radius_z":     radius,
        "focus_offset": 48,
        "card_w":       card_w,
        "card_h":       190,
        "rotate_speed": -60,
        "layout_mode":  "wide",
    }
    return ui, carousel_config

def analizar_piel_sencillo(imagen_pil):
    # Lógica HSV para medir la "luz" de la botella (tu piel)
    img = np.array(imagen_pil.resize((256, 256)))
    hsv = np.array(Image.fromarray(img).convert("HSV"))
    lum = hsv[:, :, 2].mean()
    sat = hsv[:, :, 1].mean()

    problemas, recomendaciones = [], []
    if lum < 90:
        problemas.append("Piel apagada (Falta de reflexión)")
        recomendaciones.append(buscar_producto("piel_apagada"))
    if sat < 65:
        problemas.append("Tono no uniforme (Fallo de matizado)")
        recomendaciones.append(buscar_producto("manchas"))

    return {"problemas": problemas, "recomendaciones": recomendaciones}

@app.route("/")
def index():
    return render_template("index.html", productos=MARTIDERM_PRODUCTS)

@app.route("/analizar_piel", methods=["POST"])
def analizar_piel_api():
    data = request.get_json() or {}
    image_data = data.get("image")
    if not image_data: return jsonify({"error": "No hay imagen"}), 400

    try:
        # Decodificar la imagen del móvil/web
        if "," in image_data: image_data = image_data.split(",", 1)[1]
        image_bytes = base64.b64decode(image_data)
        imagen_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        frame_cv = cv2.cvtColor(np.array(imagen_pil), cv2.COLOR_RGB2BGR)

        # 1. Lógica de Ingeniería de Superficies (HSV)
        resultado = analizar_piel_sencillo(imagen_pil)

        # 2. IA de Rasgos Facial (DeepFace)
        analisis_ia = analyze_frame(frame_cv)
        resultado.update({
            "face_detected": analisis_ia.get("face_detected", False),
            "face": analisis_ia.get("face"),
            "warnings": analisis_ia.get("warnings", [])
        })

        # 3. Mapear problemas de DeepFace a productos estrictos
        if analisis_ia.get("face_detected"):
            face_probs = analisis_ia.get("problemas", [])
            resultado["problemas"].extend(face_probs)
            if "Zonas de fatiga lumínica" in face_probs:
                p = buscar_producto("arrugas")
                if p not in resultado["recomendaciones"]:
                    resultado["recomendaciones"].append(p)
            if "Irregularidad en textura" in face_probs:
                p = buscar_producto("firmeza")
                if p not in resultado["recomendaciones"]:
                    resultado["recomendaciones"].append(p)

        # 4. Calcular ui_config (cerebro Python dicta posición, estilo y radio del carrusel)
        rec_ids              = [r["id"] for r in resultado["recomendaciones"]]
        ui_cfg, carousel_cfg = construir_ui_config(rec_ids)
        resultado["ui_config"]       = ui_cfg
        resultado["carousel_config"] = carousel_cfg

        # Inyectar ui_config dentro de cada objeto de recomendación
        for prod in resultado["recomendaciones"]:
            prod["ui_config"] = ui_cfg.get(prod["id"], {})

        return jsonify(resultado)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Arrancamos el servidor
    app.run(host="127.0.0.1", port=5000, debug=True)