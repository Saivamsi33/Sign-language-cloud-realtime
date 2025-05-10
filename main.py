from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from PIL import Image
from ultralytics import YOLO
import websockets
import uvicorn
import torch
from io import BytesIO
import os
import json

# Load YOLOv8 model
model = YOLO('best.pt')  # Default YOLOv8 model

app = FastAPI()

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Get the directory of the current file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.get("/", response_class=HTMLResponse)
async def get_index():
    index_path = os.path.join(BASE_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        return f.read()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connection accepted")
    while True:
        try:
            # Receive image as raw bytes
            data = await websocket.receive_bytes()
            print("Received image data (bytes)")

            # Process the image
            predictions = process_image(data)

            # Send predictions back to the client
            await websocket.send_text(json.dumps(predictions))
        except WebSocketDisconnect:
            print("WebSocket connection closed")
            break
        except Exception as e:
            print(f"Unexpected error: {e}")

def process_image(data):
    try:
        # Load the image from raw bytes
        image = Image.open(BytesIO(data))
        image.verify()
        image = Image.open(BytesIO(data))

        # YOLOv8 inference
        results = model(image)  # This should return a list of Results objects
        print(f"Type of results: {type(results)}")  # Debug: Print the type of the results object

        # Handle the case where results is a list
        if isinstance(results, list):
            results = results[0]  # Extract the first (and only) Results object
        print(f"Type of results after extraction: {type(results)}")  # Debug: Print the type after extraction

        predictions = []
        if hasattr(results, 'boxes') and results.boxes is not None:  # Check if there are any detections
            for box in results.boxes.data:  # Iterate over the data attribute of results.boxes
                # Extract bounding box coordinates
                xmin, ymin, xmax, ymax = map(float, box[:4].tolist())
                # Extract confidence score
                confidence = float(box[4])
                # Extract class label
                label = int(box[5])
                # Map label to class name
                label_name = results.names[label]

                # Append prediction to the list
                predictions.append({
                    'xmin': xmin,
                    'ymin': ymin,
                    'xmax': xmax,
                    'ymax': ymax,
                    'confidence': confidence,
                    'label': label,
                    'label_name': label_name
                })

        print(f"Processed Predictions: {predictions}")  # Debug: Print processed predictions
        return predictions
    except Exception as e:
        print(f"Error processing image: {e}")
        return []

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port)