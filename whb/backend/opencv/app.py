from flask import Flask, request, jsonify, render_template
import cv2
import numpy as np
import base64
import os
from metrics import compute_metrics_opencv

app = Flask(__name__, template_folder='../frontend/templates', static_folder='../frontend/static')

def decode_base64_image(base64_string):
    # Eliminar el encabezado data:image/jpeg;base64, si existe
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    
    img_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analizar_piel', methods=['POST'])
def analizar_piel():
    try:
        data = request.json
        image_b64 = data.get('image')
        
        if not image_b64:
            return jsonify({"error": "No image data"}), 400

        # Decodificar y procesar
        frame = decode_base64_image(image_b64)
        if frame is None:
            return jsonify({"error": "Invalid image"}), 400

        # Llamar a la función del archivo metrics.py
        analisis = compute_metrics_opencv(frame)

        analisis = compute_metrics_opencv(frame)
    
        # IMPORTANTE: Mapear los IDs de metrics.py a los productos de MartiDerm
        # Supongamos que tienes la lista MARTIDERM_PRODUCTS definida arriba
        productos_encontrados = []
        for recom_id in analisis["recomendaciones"]:
            # Busca el producto en tu lista de objetos
            p = next((item for item in MARTIDERM_PRODUCTS if item["id"] == recom_id), None)
            if p:
                productos_encontrados.append(p)
        
        analisis["recomendaciones"] = productos_encontrados
        
        return jsonify(analisis)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)