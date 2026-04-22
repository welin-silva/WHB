import os
import logging
import cv2
from deepface import DeepFace

# 1. Configuración de Logs
# Desactivamos los mensajes informativos de TensorFlow para que la consola esté limpia
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' 
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def analyze_face(frame_bgr):
    """
    Recibe un frame en formato BGR (OpenCV).
    Retorna un diccionario con edad y emoción, o None si ocurre un error.
    """
    try:
        # 2. Ejecución de DeepFace.analyze
        # actions: especificamos qué queremos (edad y emociones)
        # enforce_detection: en False permite que analice aunque la cara no sea perfecta
        # detector_backend: 'opencv' es el más rápido para tiempo real
        results = DeepFace.analyze(
            img_path = frame_bgr, 
            actions = ['age', 'emotion'],
            enforce_detection = False, 
            detector_backend = 'opencv',
            silent = True
        )

        # 3. Procesamiento del resultado
        # DeepFace devuelve una lista (por si hay varias caras). Tomamos la primera [0].
        res = results[0] 
        
        # Traducimos los porcentajes de emoción a valores entre 0 y 1 para facilitar el JS
        emociones_normalizadas = {k: round(v / 100, 2) for k, v in res['emotion'].items()}
        
        return {
            "age": int(res['age']),
            "dominant_emotion": res['dominant_emotion'],
            "emotion_map": emociones_normalizadas
        }

    except Exception as e:
        # Usamos logger para avisar sin detener el servidor
        logger.warning(f"Error en el motor DeepFace: {e}")
        return None

# Función de prueba opcional (no se ejecuta al importar)
if __name__ == "__main__":
    print("Módulo emotions.py cargado. Listo para recibir frames.")