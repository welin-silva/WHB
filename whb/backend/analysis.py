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
    Analiza el frame con DeepFace y convierte edad + emoción en
    boosts de puntuación por condición de piel.
    face_boosts: {pid -> puntos_extra} que app.py fusiona con el análisis HSV.
    """
    respuesta = {
        "face_detected": False,
        "problemas":     [],
        "face":          None,
        "face_boosts":   {},   # merged into HSV scores in app.py
        "warnings":      [],
    }

    if frame is None:
        return respuesta

    if HAS_DEEPFACE:
        try:
            datos = analyze_face(frame)
            if not datos:
                respuesta["warnings"].append("Cara no detectada con claridad")
                return respuesta

            respuesta["face"]          = datos
            respuesta["face_detected"] = True

            age     = datos.get("age", 30)
            emotion = datos.get("dominant_emotion", "neutral")
            emap    = datos.get("emotion_map", {})

            # ── AGE SIGNALS ────────────────────────────────────────────
            if age > 45:
                respuesta["face_boosts"]["arrugas"] = min(int((age - 40) * 2.2), 40)
                respuesta["problemas"].append("Marcas de expresión y envejecimiento avanzado detectados")
            elif age > 35:
                respuesta["face_boosts"]["arrugas"] = min(int((age - 32) * 1.5), 25)
                respuesta["face_boosts"]["firmeza"]  = min(int((age - 32) * 1.0), 18)
                respuesta["problemas"].append("Primeras líneas de expresión y pérdida de firmeza detectadas")
            elif age > 25:
                respuesta["face_boosts"]["firmeza"]  = 12
                respuesta["problemas"].append("Leve pérdida de tonicidad en contorno facial")

            # ── EMOTION / FATIGUE SIGNALS ──────────────────────────────
            fatigue = (emap.get("sad", 0) * 1.0
                       + emap.get("fear", 0) * 0.7
                       + emap.get("neutral", 0) * 0.15)
            if fatigue > 0.38 or emotion in ("sad", "fear"):
                boost = int(fatigue * 35 + 10)
                respuesta["face_boosts"]["piel_apagada"] = max(
                    respuesta["face_boosts"].get("piel_apagada", 0), boost)
                respuesta["problemas"].append("Fatiga facial y falta de vitalidad detectadas")

            anger = emap.get("angry", 0)
            if anger > 0.28 or emotion == "angry":
                respuesta["face_boosts"]["acne"] = int(anger * 30 + 8)
                respuesta["problemas"].append("Tensión e inflamación facial detectadas")

            happy = emap.get("happy", 0)
            if happy > 0.55 and age < 32:
                # Healthy, young, happy face → mild maintenance: manchas check
                respuesta["face_boosts"]["manchas"] = 8

        except Exception as e:
            print(f"❌ Error DeepFace: {e}")
            respuesta["warnings"].append(f"Motor de rasgos: {str(e)}")

    return respuesta