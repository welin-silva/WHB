import cv2
import traceback
import mediapipe as mp
import os

# --- FLAGS ---
ENABLE_MEDIAPIPE = True
ENABLE_DEEPFACE = True 

# --- IMPORTACIÓN BLINDADA ---
HAS_DEEPFACE = False
try:
    # Intentamos importar desde la carpeta
    from deep_face.emotions import analyze_face
    HAS_DEEPFACE = True
    print("\033[92m✅ IA Rasgos (DeepFace) CARGADA\033[0m")
except ImportError as e:
    print(f"\033[91m❌ ERROR: No se encuentra emotions.py en deep_face: {e}\033[0m")
    def analyze_face(frame): return None

# Inicializar MediaPipe
mp_face = mp.solutions.face_mesh
face_mesh_detector = mp_face.FaceMesh(static_image_mode=True, max_num_faces=1)

def analyze_frame(frame):
    respuesta = {
        "face_detected": False,
        "problemas": [],
        "recomendaciones": [],
        "warnings": [],
        "face": None 
    }

    if frame is None: return respuesta

    # 1. MEDIAPIPE (Malla)
    if ENABLE_MEDIAPIPE:
        try:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh_detector.process(rgb)
            if results.multi_face_landmarks:
                respuesta["face_detected"] = True
                respuesta["problemas"].extend(["Fatiga facial detectada", "Zonas de sequedad"])
        except Exception as e:
            respuesta["warnings"].append(f"MediaPipe error: {str(e)}")

    # 2. DEEPFACE (Nuestra parte)
    if ENABLE_DEEPFACE and HAS_DEEPFACE:
        try:
            print("🧠 Ejecutando DeepFace...")
            datos = analyze_face(frame)
            if datos:
                print(f"📊 Edad detectada: {datos['age']}")
                respuesta["face"] = datos
                respuesta["face_detected"] = True
            else:
                print("⚠️ DeepFace no devolvió datos (posible cara no clara)")
        except Exception as e:
            print(f"❌ Error ejecución DeepFace: {e}")
            respuesta["warnings"].append(f"DeepFace falló: {str(e)}")

    return respuesta