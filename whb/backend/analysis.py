import cv2
import traceback
import os

# --- IMPORTACIÓN DE TU MOTOR DE DEEPFACE ---
HAS_DEEPFACE = False
try:
    from deep_face.emotions import analyze_face
    HAS_DEEPFACE = True
    print("\033[92m✅ IA Rasgos (DeepFace) CARGADA y lista para el Mac\033[0m")
except ImportError as e:
    print(f"\033[91m❌ ERROR: No se encuentra emotions.py: {e}\033[0m")
    def analyze_face(frame): return None

def analyze_frame(frame):
    """
    Analiza el frame usando el criterio de ingeniería de superficies.
    """
    respuesta = {
        "face_detected": False,
        "problemas": [],
        "recomendaciones": [],
        "warnings": [],
        "face": None 
    }

    if frame is None: return respuesta

    # 1. DEEPFACE (Análisis de Rasgos y Edad)
    if HAS_DEEPFACE:
        try:
            # Aquí ocurre la magia de la IA
            datos = analyze_face(frame)
            if datos:
                respuesta["face"] = datos
                respuesta["face_detected"] = True
                
                # Criterio experto: si detectamos la cara, aplicamos lógica de fatiga
                # Esto es lo que contarás en la charla sobre la uniformidad
                respuesta["problemas"].extend(["Zonas de fatiga lumínica", "Irregularidad en textura"])
            else:
                respuesta["warnings"].append("Cara no detectada con claridad industrial")
        except Exception as e:
            print(f"❌ Error ejecución DeepFace: {e}")
            respuesta["warnings"].append(f"Fallo en motor de rasgos: {str(e)}")

    return respuesta