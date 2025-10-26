const video = document.getElementById('video');
const MODEL_URL = '/models';
const overlayGuide = document.getElementById('face-overlay-guide');

// --- CONSTANTES DE ALINEACIÓN ---
// Definimos el área de la guía en PORCENTAJE (más responsive que píxeles fijos)
// Si la guía CSS es 300x400, asumimos que ocupa alrededor del 40-50% del ancho del contenedor.
const GUIDE_CENTER_X = 50;  // Centro del óvalo es el 50% del ancho del video
const GUIDE_CENTER_Y = 50;  // Centro del óvalo es el 50% del alto del video
const GUIDE_WIDTH_PERCENT = 45; // Ancho objetivo de la cara debe ser ~45% del ancho del video.

const TOLERANCE_CENTER_PERCENT = 8; // Tolerancia de centrado (8% del video)
const TOLERANCE_SIZE = 1.2;          // La cara puede ser 20% más grande o más pequeña

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

// 1. Escucha 'loadedmetadata' para establecer las dimensiones reales (Base para el escalado)
video.addEventListener('loadedmetadata', () => {
    // Establecemos las dimensiones internas del elemento video (source size)
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
    
    const detections = await faceapi.detectAllFaces(
      video, 
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceExpressions();
    
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
    // Lógica de Alineación (solo si hay una cara)
    if (resizedDetections.length > 0) {
        // Pasamos la primera detección y las dimensiones del contenedor
        checkAlignment(resizedDetections[0].detection, displaySize);
    } else {
        overlayGuide.classList.remove('aligned');
    }

    // Dibujar en el canvas
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizedDetections);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

    requestAnimationFrame(() => detectFaces(canvas, displaySize));
}


// 4. Función de Verificación de Alineación (MÁS RESPONSIVE)
function checkAlignment(detection, videoDimensions) {
    const box = detection.box;
    
    // --- PASO 1: Transformar Coordenadas a PORCENTAJE ---
    // El 'box' está en las dimensiones internas del video (displaySize)
    
    // Centro del rostro en PORCENTAJE (0 a 100)
    const faceCenterX_Percent = ((box.x + box.width / 2) / videoDimensions.width) * 100;
    const faceCenterY_Percent = ((box.y + box.height / 2) / videoDimensions.height) * 100;
    
    // Ancho del rostro en PORCENTAJE
    const faceWidth_Percent = (box.width / videoDimensions.width) * 100;
    
    
    // --- PASO 2: CORRECCIÓN RESPONSIVE PARA EL VOLTEO ---
    // Si la cámara tiene efecto espejo (lo más común en móviles), 
    // la posición horizontal necesita invertirse.
    // Ej: Si el rostro está en el 10% (izquierda), el espejo es 90% (derecha).
    const isMirrored = true; // Asumimos volteo para cámaras frontales
    const finalFaceCenterX_Percent = isMirrored 
        ? (100 - faceCenterX_Percent) 
        : faceCenterX_Percent;
    

    // --- PASO 3: Comprobar Centrado (en PORCENTAJE) ---
    const diffX_Percent = Math.abs(finalFaceCenterX_Percent - GUIDE_CENTER_X);
    const diffY_Percent = Math.abs(faceCenterY_Percent - GUIDE_CENTER_Y);
    
    const isCentered = diffX_Percent < TOLERANCE_CENTER_PERCENT && 
                       diffY_Percent < TOLERANCE_CENTER_PERCENT;
    
    
    // --- PASO 4: Comprobar Tamaño (en PORCENTAJE) ---
    // Comprueba si el ancho del rostro está en el rango objetivo (ej: entre 37.5% y 56.25%)
    const isSized = faceWidth_Percent > (GUIDE_WIDTH_PERCENT / TOLERANCE_SIZE) && 
                    faceWidth_Percent < (GUIDE_WIDTH_PERCENT * TOLERANCE_SIZE);
                    
    // --- PASO 5: Aplicar Feedback ---
    if (isCentered && isSized) {
        overlayGuide.classList.add('aligned');
    } else {
        overlayGuide.classList.remove('aligned');
    }
}
