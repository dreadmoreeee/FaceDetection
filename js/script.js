const video = document.getElementById('video');
const MODEL_URL = '/models';
// Elementos DOM para la alineación
const overlayGuide = document.getElementById('face-overlay-guide');

// --- CONSTANTES DE ALINEACIÓN ---
// Estas deben coincidir con las dimensiones CSS del óvalo en styles.css
const GUIDE_WIDTH = 300; 
const GUIDE_HEIGHT = 400;
const TOLERANCE_CENTER = 30; // Tolerancia en píxeles para el centrado
const TOLERANCE_SIZE = 1.2;  // La cara puede ser 20% más grande o más pequeña que el óvalo

// --- Configuración e Inicialización ---

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
  faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
]).then(startVideo);

async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    console.error("Error al acceder a la cámara:", err);
    alert("No se pudo acceder a la cámara. Revisa los permisos.");
  }
}

// 1. Escucha 'loadedmetadata' para establecer las dimensiones reales del video
video.addEventListener('loadedmetadata', () => {
    video.width = video.videoWidth;
    video.height = video.videoHeight;
});

// 2. Listener principal con 'playing' (Estabilidad móvil)
video.addEventListener('playing', () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    document.body.append(canvas);
    
    // Usamos las dimensiones REALES del video para el display size
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    detectFaces(canvas, displaySize);
});

// 3. Bucle de Detección (requestAnimationFrame)
async function detectFaces(canvas, displaySize) {
    
    // Obtener las detecciones
    const detections = await faceapi.detectAllFaces(
      video, 
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceExpressions();
    
    // Escalar los resultados
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
    // Lógica de Alineación
    if (resizedDetections.length > 0) {
        checkAlignment(resizedDetections[0].detection);
    } else {
        // No hay rostro detectado, quitar la clase 'aligned'
        overlayGuide.classList.remove('aligned');
    }

    // Dibujar en el canvas
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizedDetections);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

    // Repetir el bucle (rAF para eficiencia)
    requestAnimationFrame(() => detectFaces(canvas, displaySize));
}


// 4. Función de Verificación de Alineación (CORREGIDA PARA MÓVILES)
function checkAlignment(detection) {
    const box = detection.box;
    
    // --- PASO 1: Determinar el centro del video en píxeles del DOM ---
    const videoRect = video.getBoundingClientRect();
    
    // El centro de la guía ovalada en coordenadas de PANTALLA
    const guideScreenCenterX = videoRect.left + videoRect.width / 2;
    const guideScreenCenterY = videoRect.top + videoRect.height / 2;

    // --- PASO 2: Determinar el centro del rostro en píxeles de PANTALLA (Volteo aplicado) ---
    
    // Centro del rostro en píxeles del SOURCE (relativo al video source)
    const faceSourceCenterX = box.x + box.width / 2;
    const faceSourceCenterY = box.y + box.height / 2;

    // Centro del rostro en píxeles de PANTALLA
    const faceScreenX = videoRect.left + faceSourceCenterX * (videoRect.width / video.videoWidth);
    const faceScreenY = videoRect.top + faceSourceCenterY * (videoRect.height / video.videoHeight);
    
    
    // *** CORRECCIÓN CLAVE PARA EFECTO ESPEJO ***
    // Si la cámara tiene efecto espejo (lo más común en móviles), 
    // necesitamos invertir la coordenada X de la detección respecto al centro del video.
    // Calculamos el centro X reflejado.
    const mirroredFaceScreenCenterX = videoRect.left + (videoRect.width - (faceScreenX - videoRect.left));

    // Usamos el centro X reflejado para la comparación
    const diffX = Math.abs(mirroredFaceScreenCenterX - guideScreenCenterX);
    const diffY = Math.abs(faceScreenY - guideScreenCenterY);
    
    // --- PASO 3: Comprobar Centrado (Posición) ---
    const isCentered = diffX < TOLERANCE_CENTER && diffY < TOLERANCE_CENTER;
    
    // --- PASO 4: Comprobar Tamaño (El tamaño no cambia con el volteo) ---
    const faceScreenWidth = box.width * (videoRect.width / video.videoWidth);
    
    const isSized = faceScreenWidth > (GUIDE_WIDTH / TOLERANCE_SIZE) && 
                    faceScreenWidth < (GUIDE_WIDTH * TOLERANCE_SIZE);
                    
    // --- PASO 5: Aplicar Feedback ---
    if (isCentered && isSized) {
        overlayGuide.classList.add('aligned');
    } else {
        overlayGuide.classList.remove('aligned');
    }
}
