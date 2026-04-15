import cv2
import numpy as np

def compute_metrics_opencv(frame):
    # 1. Convertir para procesar
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    b, g, r = cv2.split(frame.astype(np.float32))

    # 2. Máscara de piel mejorada (para ignorar fondo blanco/negro)
    lower_skin = np.array([0, 20, 70], dtype="uint8")
    upper_skin = np.array([25, 255, 255], dtype="uint8")
    skin_mask = cv2.inRange(hsv, lower_skin, upper_skin)
    skin_pixels = cv2.countNonZero(skin_mask)

    if skin_pixels == 0:
        return {"metrics": {"rednessScore": 0, "textureScore": 0, "brightness": 0}, "recomendaciones": [], "problemas": []}

    # 3. DETECCIÓN DE ROJECES (Índice de Eritema simplificado)
    # Buscamos donde el Rojo predomina sobre el Verde de forma clara
    # En piel irritada, R es mucho mayor que G.
    diff_red = r - g
    # Umbral bajo (10) para detectar hasta la rojez más suave
    red_mask = np.where((diff_red > 10) & (skin_mask > 0), 255, 0).astype(np.uint8)
    
    # Calculamos el área afectada respecto a la piel total
    area_roja = cv2.countNonZero(red_mask)
    redness_percent = (area_roja / skin_pixels) * 100

    # MULTIPLICADOR DE VISIBILIDAD: 
    # Para que un 15% real (que es mucho en una cara) se vea como un ~60%
    final_red_score = min(redness_percent * 4, 100)

    # 4. TEXTURA (Canny más sensible)
    edges = cv2.Canny(gray, 20, 60)
    skin_edges = cv2.bitwise_and(edges, edges, mask=skin_mask)
    texture_score = min((cv2.countNonZero(skin_edges) / skin_pixels) * 500, 100)

    # 5. RETORNO DE DATOS
    return {
        "metrics": {
            "rednessScore": round(final_red_score, 1),
            "textureScore": round(texture_score, 1),
            "brightness": round(np.mean(gray), 1),
            # Estos son para engañar a tu app.py si los necesita
            "luminosidad_media": round(np.mean(gray), 1),
            "saturacion_media": round(np.mean(hsv[:,:,1]), 1)
        },
        "problemas": ["Rojeces detectadas" if final_red_score > 10 else "Piel estable"],
        "recomendaciones": ["acne" if final_red_score > 10 else "arrugas"]
    }