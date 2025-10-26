const video = document.getElementById('video')
const MODEL_URL = '/models' 

// --- Configuración e Inicialización ---

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
  faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
]).then(startVideo)

// Función para iniciar la cámara
async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    console.error("Error al acceder a la cámara:", err);
    alert("No se pudo acceder a la cámara. Revisa los permisos.");
  }
}

// 1. EVENTO CORREGIDO: Usamos 'loadedmetadata' para obtener el tamaño REAL del video
video.addEventListener('loadedmetadata', () => {
    // 2. CORRECCIÓN: Definir el tamaño del elemento <video> al tamaño real
    // Esto asegura que las dimensiones CSS y las dimensiones reales del video coincidan.
    video.width = video.videoWidth;
    video.height = video.videoHeight;
});

// Listener principal (Asegura que el video esté reproduciéndose)
video.addEventListener('playing', () => {
    
    // El canvas se crea SOLO cuando el video está reproduciéndose
    const canvas = faceapi.createCanvasFromMedia(video)
    document.body.append(canvas)

    // CORRECCIÓN CLAVE: Usamos las dimensiones REALES del video (videoWidth/videoHeight)
    const displaySize = { width: video.videoWidth, height: video.videoHeight }
    faceapi.matchDimensions(canvas, displaySize)

    // Inicia el bucle de detección optimizado
    detectFaces(canvas, displaySize);
})

// Función de Bucle de Detección (Optimizada con requestAnimationFrame)
async function detectFaces(canvas, displaySize) {
    
    // Detección y Extracción
    const detections = await faceapi.detectAllFaces(
      video, 
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceExpressions()
    
    // Escalar los resultados al tamaño REAL
    const resizedDetections = faceapi.resizeResults(detections, displaySize)
    
    // Limpiar y dibujar
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height)
    faceapi.draw.drawDetections(canvas, resizedDetections)
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

    // Repetir el bucle
    requestAnimationFrame(() => detectFaces(canvas, displaySize));
}
