const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let wsUrl;

// Check if the app is running in the cloud or locally
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    // Local development
    wsUrl = "ws://localhost:8080/ws"; // Replace 8080 with your local port if different
} else {
    // Cloud or production environment
    wsUrl = `wss://${window.location.host}/ws`; // Use wss:// for secure WebSocket
}

const ws = new WebSocket(wsUrl);
// Store colors for labels
const labelColors = {};

// Function to generate a random color
function getRandomColor() {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Set up the video stream
navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
    .then((stream) => {
        video.srcObject = stream;
        video.play();
    })
    .catch((error) => {
        console.error("Error accessing webcam:", error);
    });

// Adjust canvas size to match video
video.addEventListener("loadedmetadata", () => {
    canvas.width = 640;
    canvas.height = 480;
    console.log("Canvas dimensions set:", canvas.width, canvas.height);
    
    // Draw initial debug rectangle and border
    //ctx.strokeStyle = 'red';
    //ctx.lineWidth = 4;
    //ctx.strokeRect(0, 0, canvas.width, canvas.height); // Draw border around canvas
    //ctx.fillStyle = "rgba(255,0,0,0.2)";
    //ctx.fillRect(100, 100, 200, 200); // Draw semi-transparent red rectangle
});

// WebSocket connection
ws.onopen = () => {
    console.log("WebSocket connection established");

    // Send video frames to the server at regular intervals
    setInterval(() => {
        const offscreenCanvas = document.createElement("canvas");
        const offscreenCtx = offscreenCanvas.getContext("2d");
        offscreenCanvas.width = 640;
        offscreenCanvas.height = 480;
        offscreenCtx.drawImage(video, 0, 0, 640, 480);

        offscreenCanvas.toBlob((blob) => {
            if (blob) {
                ws.send(blob);
            }
        }, "image/jpeg");
    }, 100); // Send a frame every 100ms
};

// Handle incoming predictions
ws.onmessage = (event) => {
    const predictions = JSON.parse(event.data);

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bounding boxes
    predictions.forEach((prediction) => {
        const { xmin, ymin, xmax, ymax, confidence, label } = prediction;

        // Assign a random color to the label if it doesn't already have one
        if (!labelColors[label]) {
            labelColors[label] = getRandomColor();
        }
        const color = labelColors[label];

        // Draw the bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);

        // Draw the label and confidence
        ctx.fillStyle = color;
        ctx.font = "16px Arial";
        ctx.fillText(`${label} (${(confidence * 100).toFixed(1)}%)`, xmin, ymin - 5);
    });
};

// Handle WebSocket errors
ws.onerror = (error) => {
    console.error("WebSocket error:", error);
};

// Handle WebSocket closure
ws.onclose = () => {
    console.log("WebSocket connection closed");
};