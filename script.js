const video = document.getElementById('video')
const MODEL_URL = '/models' 

// --- Configuración e Inicialización ---

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
  faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
]).then(startVideo)

// 1. Función para iniciar la cámara (API Moderna)
async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    console.error("Error al acceder a la cámara:", err);
    alert("No se pudo acceder a la cámara. Revisa los permisos.");
  }
}

// 2. Listener para detección (Evento 'playing' + Bucle rAF)
video.addEventListener('playing', () => {
    
    // Inicialización del Canvas
    const canvas = faceapi.createCanvasFromMedia(video)
    document.body.append(canvas)
    const displaySize = { width: video.width, height: video.height }
    faceapi.matchDimensions(canvas, displaySize)

    // Inicia el bucle de detección optimizado para móviles
    detectFaces(canvas, displaySize);
})

// 3. Función de Bucle de Detección (Optimizada con requestAnimationFrame)
async function detectFaces(canvas, displaySize) {
    
    // 1. Detección y Extracción
    const detections = await faceapi.detectAllFaces(
      video, 
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceExpressions()
    
    // 2. Escalar los resultados
    const resizedDetections = faceapi.resizeResults(detections, displaySize)
    
    // 3. Limpiar y dibujar
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height)
    faceapi.draw.drawDetections(canvas, resizedDetections)
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

    // 4. Repetir el bucle
    // requestAnimationFrame es mucho más eficiente que setInterval para video.
    requestAnimationFrame(() => detectFaces(canvas, displaySize));
}