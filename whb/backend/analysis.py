import cv2
import traceback
import mediapipe as mp

# --- FLAGS DE ACTIVACIÓN (INTERRUPTORES PARA TU EQUIPO) ---
# Cada uno activa el suyo en su ordenador local
ENABLE_MEDIAPIPE = True   # Tú (Malla, landmarks y zonas)
ENABLE_OPENCV = False     # Compañero 1 (Análisis de piel)
ENABLE_DEEPFACE = False   # Compañero 2 (Edad y emociones)

# --- IMPORTACIONES DINÁMICAS ---
# Solo importamos el código de tus compañeros si el flag está activo
if ENABLE_OPENCV:
    # Asumiendo que tu compañero crea un archivo llamado 'metrics.py' en su carpeta
    from opencv.metrics import analyze_skin 
if ENABLE_DEEPFACE:
    # Asumiendo que tu compañero crea 'emotions.py' en su carpeta
    from deep_face.emotions import analyze_face

# Inicializar MediaPipe fuera de la función es mejor para el rendimiento
mp_face = mp.solutions.face_mesh
# Usamos static_image_mode=True porque al backend llegan fotos sueltas, no un vídeo continuo
face_mesh_detector = mp_face.FaceMesh(static_image_mode=True, max_num_faces=1)

def analyze_frame(frame):
    """
    Analiza una imagen pasando por todas las IAs activas.
    Siempre devuelve una estructura segura para no romper el frontend.
    """
    # 1. ESTRUCTURA BASE INQUEBRANTABLE (Lo que whb.js siempre espera)
    respuesta = {
        "face_detected": False,
        "problemas": [],
        "recomendaciones": [],
        "warnings": [] # Aquí guardamos errores técnicos silenciosos
    }

    # 2. TU IA: MEDIAPIPE (Geometría y Zonas)
    if ENABLE_MEDIAPIPE:
        try:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh_detector.process(rgb)

            if results.multi_face_landmarks:
                respuesta["face_detected"] = True
                
                # Guardar landmarks
                landmarks = [(lm.x, lm.y, lm.z) for lm in results.multi_face_landmarks[0].landmark]
                respuesta["landmarks"] = landmarks

                # Añadir tus problemas detectados
                respuesta["problemas"].extend([
                    "Ligeras ojeras detectadas",
                    "Textura irregular en zona T"
                ])
                
                # [FUTURO] Aquí crearás la "máscara" de la cara para pasársela a OpenCV
                # mascara_piel = generar_mascara(frame, landmarks)
                
        except Exception as e:
            respuesta["warnings"].append(f"MediaPipe falló: {str(e)}")
            print("Error en MediaPipe:", traceback.format_exc())

    # 3. IA COMPAÑERO 1: OPENCV (Análisis dermatológico)
    if ENABLE_OPENCV and respuesta["face_detected"]:
        try:
            # Tu compañero llamará a su función pasándole el frame
            # metricas = analyze_skin(frame) 
            
            # Simulación de lo que devolvería tu compañero:
            metricas = {"brillo": "alto", "porosidad": "media"} 
            respuesta["metrics"] = metricas
            respuesta["problemas"].append("Exceso de brillo (Detectado por OpenCV)")
        except Exception as e:
            respuesta["warnings"].append(f"OpenCV falló: {str(e)}")
            print("Error en OpenCV:", traceback.format_exc())

    # 4. IA COMPAÑERO 2: DEEPFACE (Edad y emociones)
    if ENABLE_DEEPFACE and respuesta["face_detected"]:
        try:
            # datos_deepface = analyze_face(frame)
            
            # Simulación de lo que devolvería tu compañero:
            datos_deepface = {"edad_estimada": 28, "emocion": "neutral"}
            respuesta["face"] = datos_deepface
        except Exception as e:
            respuesta["warnings"].append(f"DeepFace falló: {str(e)}")
            print("Error en DeepFace:", traceback.format_exc())

    return respuesta