const video = document.getElementById('video')
const MODEL_URL = '/models' 

// --- Configuración e Inicialización ---

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
  faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
]).then(startVideo)

async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    console.error("Error al acceder a la cámara:", err);
    alert("No se pudo acceder a la cámara. Revisa los permisos.");
  }
}

// Escucha 'loadedmetadata' para establecer las dimensiones correctas
video.addEventListener('loadedmetadata', () => {
    // Establece el ancho y alto del elemento <video> al tamaño real de la cámara
    video.width = video.videoWidth;
    video.height = video.videoHeight;
});

// Listener principal (Usa 'playing' para estabilidad móvil)
video.addEventListener('playing', () => {
    
    // El canvas se crea con las dimensiones reales del video
    const canvas = faceapi.createCanvasFromMedia(video)
    document.body.append(canvas)

    // Usamos las dimensiones REALES del video (videoWidth/videoHeight) para el display size
    const displaySize = { width: video.videoWidth, height: video.videoHeight }
    faceapi.matchDimensions(canvas, displaySize)

    // Inicia el bucle de detección optimizado
    detectFaces(canvas, displaySize);
})

// Función de Bucle de Detección (requestAnimationFrame para eficiencia móvil)
async function detectFaces(canvas, displaySize) {
    
    const detections = await faceapi.detectAllFaces(
      video, 
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceExpressions()
    
    const resizedDetections = faceapi.resizeResults(detections, displaySize)
    
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height)
    
    // Dibuja las detecciones
    faceapi.draw.drawDetections(canvas, resizedDetections)
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

    // Repetir el bucle
    requestAnimationFrame(() => detectFaces(canvas, displaySize));
}