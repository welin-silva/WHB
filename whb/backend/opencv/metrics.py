import cv2
import numpy as np

def compute_metrics_opencv(frame):
    """
    Analiza un frame de OpenCV y devuelve métricas cosméticas.
    """
    results = {
        "metrics": {},
        "qualityWarnings": [],
        "problemas": [],
        "recomendaciones": []
    }

    # 1. Convertir a Grises y HSV para diferentes análisis
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    
    # --- VALIDACIÓN DE CALIDAD ---
    # Blur (Varianza de Laplacian)
    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    results["metrics"]["blurScore"] = round(blur_score, 2)
    if blur_score < 100:
        results["qualityWarnings"].append("Imagen borrosa")

    # Brillo (Media)
    brightness = np.mean(gray)
    results["metrics"]["brightness"] = round(brightness, 2)
    if brightness < 50:
        results["qualityWarnings"].append("Muy oscura")
    elif brightness > 200:
        results["qualityWarnings"].append("Demasiada luz")

    # Contraste
    contrast = gray.std()
    results["metrics"]["contrast"] = round(contrast, 2)

    # --- MÉTRICAS COSMÉTICAS ---
    # Redness (Rojeces) - Usando el canal Rojo en BGR
    # Una forma simple: (R - G) en zonas donde R es alto
    b, g, r = cv2.split(frame)
    red_mask = cv2.subtract(r, g)
    redness_score = np.mean(red_mask)
    results["metrics"]["rednessScore"] = round(float(redness_score), 2)

    # Tone Variance (Uniformidad)
    tone_variance = np.std(hsv[:, :, 0]) # Desviación del Hue (Tono)
    results["metrics"]["toneVariance"] = round(float(tone_variance), 2)

    # Texture Score (Poros/Textura mediante Canny)
    edges = cv2.Canny(gray, 50, 150)
    texture_score = (np.sum(edges > 0) / gray.size) * 100
    results["metrics"]["textureScore"] = round(float(texture_score), 2)

    # --- LÓGICA DE RECOMENDACIONES ---
    if redness_score > 20:
        results["problemas"].append("Inflamación o irritación leve")
        results["recomendaciones"].append("Usar productos con Niacinamida o Aloe Vera")
    
    if texture_score > 5:
        results["problemas"].append("Textura irregular")
        results["recomendaciones"].append("Considerar exfoliante químico suave (AHA/BHA)")

    return results