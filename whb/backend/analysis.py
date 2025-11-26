import cv2
import mediapipe as mp

mp_face = mp.solutions.face_mesh

def analyze_frame(frame):
    """Analiza un frame y devuelve puntos clave faciales + conclusiones básicas"""
    face_mesh = mp_face.FaceMesh(static_image_mode=False)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb)

    analysis = {
        "face_detected": False,
        "landmarks": [],
        "issues": []
    }

    if results.multi_face_landmarks:
        analysis["face_detected"] = True
        for lm in results.multi_face_landmarks[0].landmark:
            analysis["landmarks"].append((lm.x, lm.y, lm.z))

        # Ejemplo de "problemas detectados"
        # (esto luego lo hacemos real)
        analysis["issues"] = [
            "Ligeras ojeras detectadas",
            "Textura irregular en zona T",
        ]

    return analysis
