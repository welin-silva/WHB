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
        # Anti-aging: soft diffusion reduces line visibility without beauty-filter blur
        "blur":        0.45,   # fine-line softening — well below smooth-skin threshold
        "brightness":  1.05,
        "contrast":    1.08,   # mild lift — restores apparent firmness
        "saturate":    1.04,
        "sepia":       0.0,
        "hue_rotate":  0,
    },
    "manchas": {
        # Pigment correction: tone-evening lift — vivid but recognizably real
        "blur":        0.0,
        "brightness":  1.10,   # lifts dark zones without blowing highlights
        "contrast":    1.04,
        "saturate":    1.20,   # clear tone improvement, not cartoon-vivid
        "sepia":       0.0,
        "hue_rotate":  0,
    },
    "firmeza": {
        # Firmness: sharpened contours — most distinct signature
        "blur":        0.0,
        "brightness":  1.03,
        "contrast":    1.18,   # noticeable definition; below "HDR" territory
        "saturate":    1.07,
        "sepia":       0.0,
        "hue_rotate":  0,
    },
    "piel_apagada": {
        # Radiance booster: clear luminosity improvement without glow overload
        "blur":        0.0,
        "brightness":  1.16,   # strongest brightness, still believable on screen
        "contrast":    1.04,
        "saturate":    1.18,   # warm healthy skin — not oversaturated
        "sepia":       0.0,
        "hue_rotate":  0,
    },
    "acne": {
        # Redness reduction: shift reds toward neutral, calm without whitening
        # hue-rotate(-12deg) nudges skin reds toward orange/neutral — skin identity preserved
        "blur":        0.35,   # light diffusion — softens inflamed texture
        "brightness":  1.02,   # near-neutral — preserve real skin luminance
        "contrast":    0.96,   # REDUCE slightly — calms visual inflammation
        "saturate":    0.90,   # mild desaturation — keeps skin warm, removes angry tones
        "sepia":       0.0,
        "hue_rotate":  -12,    # key: rotates reds away without graying the face
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

_PROBLEM_LABELS = {
    "piel_apagada": "Piel apagada y falta de luminosidad",
    "manchas":      "Irregularidad de tono y pigmentación",
    "arrugas":      "Líneas de expresión y textura irregular",
    "acne":         "Rojeces e imperfecciones activas",
    "firmeza":      "Pérdida de firmeza y definición del contorno",
}

def analizar_piel_completo(imagen_pil, face_boosts=None):
    """
    Multi-signal HSV + LAB + Laplacian skin analysis.
    Returns metrics (for UI panel) + scored conditions (for recommendation engine).
    face_boosts: optional dict {pid -> extra_score} merged from DeepFace signals.
    """
    face_boosts = face_boosts or {}

    img_rgb = np.array(imagen_pil.resize((256, 256)))
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)

    hsv_f  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    lab_f  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    gray_f = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)

    # Skin tone mask
    hsv_u8   = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    skin_mask = cv2.inRange(hsv_u8,
                            np.array([0, 15, 55], dtype=np.uint8),
                            np.array([25, 220, 255], dtype=np.uint8))
    skin_px = int(cv2.countNonZero(skin_mask))
    if skin_px < 200:                       # no skin detected → use full image
        skin_mask = np.ones((256, 256), dtype=np.uint8) * 255
        skin_px   = 256 * 256

    def masked_mean(ch):
        return float(np.mean(ch[skin_mask > 0]))
    def masked_std(ch):
        return float(np.std(ch[skin_mask > 0]))

    # ── METRIC 1: LUMINOSITY ─────────────────────────────────────
    # Raw V-channel mean in skin zone (0-255). Real selfie faces typically
    # land in 120-210. Map to a 15-90 display scale so "good skin" reads
    # ~55-75 instead of hitting 100 under studio light.
    lum_raw  = masked_mean(hsv_f[:, :, 2])
    lum_norm = round(float(np.clip((lum_raw - 80) / 1.6, 15.0, 90.0)), 1)

    # ── METRIC 2: SATURATION ─────────────────────────────────────
    sat_raw  = masked_mean(hsv_f[:, :, 1])
    sat_norm = round(float(np.clip(sat_raw / 2.9, 8.0, 85.0)), 1)

    # ── METRIC 3: UNIFORMITY (std of L* in LAB) ──────────────────
    # Typical healthy-skin L* std is 8-18; problem skin 18-30+.
    # Floor at 18 so "perfect" never appears; ceil via the * 2.6 factor.
    l_std      = masked_std(lab_f[:, :, 0])
    uniformity = round(float(np.clip(100.0 - l_std * 2.6, 18.0, 88.0)), 1)

    # ── METRIC 4: TEXTURE ROUGHNESS (Laplacian variance) ─────────
    # At 256×256, smooth skin ≈ 60-200 var, normal ≈ 200-500, rough ≈ 500+.
    # Divide by 9 and cap at 78 so JPEG noise alone never reaches maximum.
    lap      = cv2.Laplacian(gray_f, cv2.CV_32F)
    lap_skin = lap[skin_mask > 0]
    tex_var  = float(np.var(lap_skin))
    texture  = round(float(np.clip(tex_var / 9.0, 5.0, 78.0)), 1)

    # ── METRIC 5: REDNESS — lighting-compensated ─────────────────
    # The root problem: warm indoor light makes R-G > 12 for nearly all
    # skin pixels, so a fixed threshold spikes to 100 every time.
    # Fix: use the 65th-percentile R-G of skin as the individual baseline
    # (this adapts to the room's colour temperature), then measure how many
    # pixels exceed that baseline by ≥ 20 points (genuine inflammation).
    _, g_ch, r_ch = cv2.split(img_bgr.astype(np.float32))
    rg_diff   = (r_ch - g_ch)
    rg_skin   = rg_diff[skin_mask > 0]
    # 65th-pct = "warm but normal" skin in this lighting
    baseline  = float(np.percentile(rg_skin, 65))
    red_thresh = max(baseline + 20, 25)             # at least 25 absolute
    red_area  = int(np.sum((rg_diff > red_thresh) & (skin_mask > 0)))
    # Multiplier 160 + cap 72: even heavy acne won't fake 100%
    redness   = round(float(np.clip((red_area / skin_px) * 160, 0.0, 72.0)), 1)

    # ── METRIC 6: HYDRATION ESTIMATE (composite) ─────────────────
    hydration = round(float(np.clip(
        lum_norm * 0.35 + uniformity * 0.40 + (100.0 - texture) * 0.25,
        15.0, 88.0)), 1)

    metrics = {
        "luminosidad":        lum_norm,
        "saturacion":         sat_norm,
        "uniformidad":        uniformity,
        "textura":            texture,
        "rojez":              redness,
        "hidratacion":        hydration,
        # legacy keys kept for backward compat
        "luminosidad_media":  lum_norm,
        "saturacion_media":   sat_norm,
    }

    # ── SCORING → RECOMMENDATION ENGINE ──────────────────────────
    # Each formula fires only when the signal is genuinely pathological.
    # Calibration targets:
    #   lum_norm typical healthy face: 55-75   (dull < 52)
    #   sat_norm typical healthy face: 16-30   (flat skin < 18)
    #   uniformity typical healthy:    65-80   (uneven < 60)
    #   texture   typical healthy:     10-30   (rough > 40)
    #   redness   typical healthy:     0-15    (inflamed > 25)
    scores = {
        # Dull skin / fatigue: fires when luminosity OR saturation are genuinely low
        "piel_apagada": max(0.0,
            max(0.0, (62 - lum_norm)) * 1.3
            + max(0.0, (18 - sat_norm)) * 1.2),

        # Pigmentation / uneven tone: fires on genuinely poor uniformity
        "manchas":      max(0.0, (70 - uniformity) * 1.6),

        # Wrinkles / texture damage: fires on high-texture signal (fine lines)
        "arrugas":      max(0.0, texture * 1.1 - 20),

        # Redness / acne / inflammation: fires only on genuine redness
        "acne":         max(0.0, redness * 1.5 - 14),

        # Firmeza: driven mainly by non-uniformity (sagging contour) not texture,
        # so it diverges from arrugas on different skin profiles
        "firmeza":      max(0.0, (100 - uniformity) * 0.9 + texture * 0.25 - 28),
    }
    for pid, boost in face_boosts.items():
        if pid in scores:
            scores[pid] = scores[pid] + boost

    THRESHOLD = 15
    ranked    = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    problemas, recomendaciones = [], []
    for pid, score in ranked:
        if score >= THRESHOLD and len(recomendaciones) < 3:
            problemas.append(_PROBLEM_LABELS[pid])
            p = buscar_producto(pid)
            if p:
                recomendaciones.append(p)

    if not recomendaciones:                                     # healthy baseline fallback
        top_pid = ranked[0][0] if ranked else "piel_apagada"
        problemas.append("Mantenimiento preventivo recomendado")
        p = buscar_producto(top_pid)
        if p:
            recomendaciones.append(p)

    return {"metrics": metrics, "problemas": problemas, "recomendaciones": recomendaciones}

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

        # 1. DeepFace primero — produce face_boosts que el motor HSV necesita
        analisis_ia = analyze_frame(frame_cv)

        # 2. Análisis multi-señal HSV + LAB + Laplacian, con boosts de DeepFace integrados
        resultado = analizar_piel_completo(imagen_pil,
                                           face_boosts=analisis_ia.get("face_boosts", {}))

        # 3. Adjuntar datos faciales al resultado final
        resultado["face_detected"] = analisis_ia.get("face_detected", False)
        resultado["face"]          = analisis_ia.get("face")
        resultado["warnings"]      = analisis_ia.get("warnings", [])
        # DeepFace surface-level problems (age/emotion labels) appended after HSV ones
        resultado["problemas"].extend(analisis_ia.get("problemas", []))

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