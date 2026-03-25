import cv2
import numpy as np

def get_cosmetic_metrics(frame):
    """
    Analiza un frame de OpenCV y devuelve métricas de calidad y cosméticas.
    """
    # 1. Preparación: Convertir a Grises y HSV
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    
    # --- CALIDAD DE IMAGEN ---
    # Variación del Laplaciano para enfoque (Blur)
    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    
    # Luminancia (Brillo y Contraste)
    brightness = np.mean(gray)
    contrast = np.std(gray)
    
    # --- MÉTRICAS COSMÉTICAS ---
    # Rojeces (Redness): Filtramos el canal Rojo en el espacio LAB para mayor precisión
    # o usamos el canal H (Hue) entre rangos de rojo (0-10 y 160-180)
    lower_red1 = np.array([0, 50, 50])
    upper_red1 = np.array([10, 255, 255])
    mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    redness_score = (np.sum(mask1 > 0) / mask1.size) * 100

    # Uniformidad de Tono (Tone Variance)
    # Una desviación estándar baja en el canal de color indica tono uniforme
    _, _, v_channel = cv2.split(hsv)
    tone_variance = np.std(v_channel)

    # Textura / Poros (Texture Score)
    # Usamos Canny para detectar irregularidades superficiales
    edges = cv2.Canny(gray, 100, 200)
    texture_score = (np.sum(edges > 0) / edges.size) * 100

    return {
        "blurScore": round(blur_score, 2),
        "brightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "rednessScore": round(redness_score, 2),
        "toneVariance": round(tone_variance, 2),
        "textureScore": round(texture_score, 2)
    }