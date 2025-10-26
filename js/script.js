const video = document.getElementById('video');
const MODEL_URL = '/models';
const overlayGuide = document.getElementById('face-overlay-guide');
const countdownMessage = document.getElementById('countdown-message');
const photoContainer = document.getElementById('final-photo-container');
const finalPhoto = document.getElementById('final-photo');

// --- CONSTANTES DE ALINEACIÓN ---
// Ajustadas al óvalo de 200x300px (Ancho objetivo: 28%)
const GUIDE_CENTER_X = 50;  
const GUIDE_CENTER_Y = 50;  
const GUIDE_WIDTH_PERCENT = 28; 

// CAMBIO: Tolerancia de centrado reducida a 5% (más estricto)
const TOLERANCE_CENTER_PERCENT = 5; 

// CAMBIO: Tolerancia de tamaño (más estricto en el límite inferior)
const TOLERANCE_SIZE_MIN = 1.1; // La cara debe ser al menos ~90% del óvalo (28% / 1.1 ≈ 25.4%)
const TOLERANCE_SIZE_MAX = 1.2; // La cara puede ser máximo ~120% del óvalo

// --- CONTROL DE FLUJO DE CAPTURA ---
let isCountingDown = false; 
let countdownInterval = null;
let currentCount = 0;
const INITIAL_COUNT = 3; 

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

// 1. Manejo de Metadata (Esencial para dimensiones correctas en móviles)
video.addEventListener('loadedmetadata', () => {
    video.width = video.videoWidth;
    video.height = video.videoHeight;
});

// 2. Manejo del Evento 'playing' (Estabilidad móvil)
video.addEventListener('playing', () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    document.body.append(canvas);
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    detectFaces(canvas, displaySize);
});


// 3. Bucle de Detección (requestAnimationFrame)
async function detectFaces(canvas, displaySize) {
    
    // Si la foto ya fue tomada, detener el proceso
    if (photoContainer.classList.contains('show')) {
        requestAnimationFrame(() => detectFaces(canvas, displaySize));
        return;
    }
    
    const detections = await faceapi.detectAllFaces(
      video, 
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceExpressions();
    
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
    // Lógica de Alineación y Control de Flujo CRÍTICO
    if (resizedDetections.length > 0) {
        const isAligned = checkAlignment(resizedDetections[0].detection, displaySize);
        
        if (isAligned) {
            overlayGuide.classList.add('aligned');
            if (!isCountingDown) {
                // Iniciar la cuenta atrás solo si está alineado y no ha comenzado
                isCountingDown = true;
                startCountdown();
            }
        } else {
            overlayGuide.classList.remove('aligned');
            if (isCountingDown) {
                // BUG FIX: Abortar la cuenta atrás si el rostro se sale del óvalo
                abortCountdown(); 
            }
        }
    } else {
        // No hay rostro detectado
        overlayGuide.classList.remove('aligned');
        if (isCountingDown) {
            // BUG FIX: Abortar la cuenta atrás si el rostro desaparece
            abortCountdown(); 
        }
    }

    // Dibujar en el canvas
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizedDetections);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

    requestAnimationFrame(() => detectFaces(canvas, displaySize));
}

// 4. Función de Verificación de Alineación (Responsive y Estricta)
function checkAlignment(detection, videoDimensions) {
    const box = detection.box;
    
    // Transformar Coordenadas a PORCENTAJE (Base Responsive)
    const faceCenterX_Percent = ((box.x + box.width / 2) / videoDimensions.width) * 100;
    const faceCenterY_Percent = ((box.y + box.height / 2) / videoDimensions.height) * 100;
    const faceWidth_Percent = (box.width / videoDimensions.width) * 100;
    
    // Corrección para el Volteo (Cámara Frontal)
    const isMirrored = true; 
    const finalFaceCenterX_Percent = isMirrored 
        ? (100 - faceCenterX_Percent) 
        : faceCenterX_Percent;
    
    // Comprobar Centrado (Tolerancia: 5%)
    const diffX_Percent = Math.abs(finalFaceCenterX_Percent - GUIDE_CENTER_X);
    const diffY_Percent = Math.abs(faceCenterY_Percent - GUIDE_CENTER_Y);
    
    const isCentered = diffX_Percent < TOLERANCE_CENTER_PERCENT && 
                       diffY_Percent < TOLERANCE_CENTER_PERCENT;
    
    // Comprobar Tamaño (Uso de TOLERANCE_SIZE_MIN y MAX)
    const isSized = faceWidth_Percent > (GUIDE_WIDTH_PERCENT / TOLERANCE_SIZE_MIN) && 
                    faceWidth_Percent < (GUIDE_WIDTH_PERCENT * TOLERANCE_SIZE_MAX);
                    
    return isCentered && isSized;
}

// 5. Lógica de Cuenta Atrás
function startCountdown() {
    currentCount = INITIAL_COUNT;
    
    countdownMessage.innerText = "¡No te muevas!";
    countdownMessage.classList.add('visible');

    countdownInterval = setInterval(() => {
        if (currentCount > 0) {
            countdownMessage.innerText = currentCount;
            currentCount--;
        } else {
            // FINALIZACIÓN EXITOSA: Limpiar y Capturar
            clearInterval(countdownInterval);
            countdownInterval = null;
            countdownMessage.classList.remove('visible');
            countdownMessage.innerText = '';
            
            takePhoto();
        }
    }, 1000);
}

// 6. Abortar la Cuenta Atrás (Función de Interrupción)
function abortCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    // Resetear flags y elementos visuales
    isCountingDown = false;
    currentCount = 0;
    countdownMessage.classList.remove('visible');
    countdownMessage.innerText = '';
}

// 7. Tomar y Mostrar Foto
function takePhoto() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const ctx = tempCanvas.getContext('2d');
    
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    
    const imageDataURL = tempCanvas.toDataURL('image/jpeg');
    
    showPhoto(imageDataURL);
}

function showPhoto(imageDataURL) {
    // Detiene el video
    video.pause();
    
    // Oculta los elementos de detección con una animación suave
    const detectionCanvas = document.querySelector('canvas');
    if (detectionCanvas) {
        detectionCanvas.style.transition = 'opacity 0.5s';
        detectionCanvas.style.opacity = '0';
    }
    overlayGuide.style.transition = 'opacity 0.5s';
    overlayGuide.style.opacity = '0';
    
    // Muestra la foto en pantalla completa
    finalPhoto.src = imageDataURL;
    photoContainer.classList.add('show');
}
