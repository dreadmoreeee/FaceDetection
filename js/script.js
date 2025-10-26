const video = document.getElementById('video');
const MODEL_URL = '/models';
const overlayGuide = document.getElementById('face-overlay-guide');

// NUEVOS ELEMENTOS DEL DOM
const instructionBox = document.getElementById('instruction-box');
const instructionText = document.getElementById('instruction-text');

const photoContainer = document.getElementById('final-photo-container');
const finalPhoto = document.getElementById('final-photo');

// --- CONSTANTES DE ALINEACIÓN ---
const GUIDE_CENTER_X = 50;  
const GUIDE_CENTER_Y = 50;  

let guideWidthPercent = 0; 

const TOLERANCE_CENTER_PERCENT = 8; 

const TOLERANCE_SIZE_MIN_FACTOR = 0.8;  
const TOLERANCE_SIZE_MAX_FACTOR = 1.5; 
const PROXIMITY_CENTER_TOLERANCE = 15; // Límite para el mensaje "Centra tu rostro"

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

video.addEventListener('loadedmetadata', () => {
    video.width = video.videoWidth;
    video.height = video.videoHeight;
});

video.addEventListener('playing', () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    document.body.append(canvas);
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);
    
    calculateGuideDimensions();

    detectFaces(canvas, displaySize);
});

function calculateGuideDimensions() {
    const guideComputedStyle = window.getComputedStyle(overlayGuide, '::after');
    const guideDomWidth = parseFloat(guideComputedStyle.width);

    const videoDomWidth = video.getBoundingClientRect().width;
    const videoSourceWidth = video.videoWidth;

    const scaleFactor = videoSourceWidth / videoDomWidth;
    
    const guideWidthInSourcePixels = guideDomWidth * scaleFactor;
    
    guideWidthPercent = (guideWidthInSourcePixels / videoSourceWidth) * 100;

    if (isNaN(guideWidthPercent) || guideWidthPercent === 0) {
        guideWidthPercent = 35; 
    }
}


async function detectFaces(canvas, displaySize) {
    
    if (guideWidthPercent === 0) {
         requestAnimationFrame(() => detectFaces(canvas, displaySize));
         return;
    }

    if (photoContainer.classList.contains('show')) {
        requestAnimationFrame(() => detectFaces(canvas, displaySize));
        return;
    }
    
    const detections = await faceapi.detectAllFaces(
      video, 
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceExpressions();
    
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
    let isAligned = false;
    
    if (resizedDetections.length > 0) {
        // Obtenemos el feedback específico de alineación
        const alignmentFeedback = checkAlignment(resizedDetections[0].detection, displaySize);
        isAligned = alignmentFeedback.isAligned;
        
        if (isAligned) {
            overlayGuide.classList.add('aligned');
            if (!isCountingDown) {
                isCountingDown = true;
                startCountdown();
            }
        } else {
            overlayGuide.classList.remove('aligned');
            if (isCountingDown) {
                abortCountdown(); 
            }
            // NUEVO: Mostrar mensaje de guía cuando NO está alineado
            if (!isCountingDown) {
                showInstruction(alignmentFeedback.message);
            }
        }
    } else {
        // No hay rostro detectado
        overlayGuide.classList.remove('aligned');
        if (isCountingDown) {
            abortCountdown(); 
        }
        showInstruction("Acerca tu rostro al centro del óvalo.");
    }

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizedDetections);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

    requestAnimationFrame(() => detectFaces(canvas, displaySize));
}

function checkAlignment(detection, videoDimensions) {
    const box = detection.box;
    let message = "Centra tu rostro en el óvalo.";
    
    const faceCenterX_Percent = ((box.x + box.width / 2) / videoDimensions.width) * 100;
    const faceCenterY_Percent = ((box.y + box.height / 2) / videoDimensions.height) * 100;
    const faceWidth_Percent = (box.width / videoDimensions.width) * 100;
    
    const isMirrored = true; 
    const finalFaceCenterX_Percent = isMirrored 
        ? (100 - faceCenterX_Percent) 
        : faceCenterX_Percent;
    
    // Comprobar Centrado
    const diffX_Percent = Math.abs(finalFaceCenterX_Percent - GUIDE_CENTER_X);
    const diffY_Percent = Math.abs(faceCenterY_Percent - GUIDE_CENTER_Y);
    
    const isCentered = diffX_Percent < TOLERANCE_CENTER_PERCENT && 
                       diffY_Percent < TOLERANCE_CENTER_PERCENT;
    
    // Comprobar Tamaño
    const minSize = guideWidthPercent * TOLERANCE_SIZE_MIN_FACTOR; 
    const maxSize = guideWidthPercent * TOLERANCE_SIZE_MAX_FACTOR; 

    const isSized = faceWidth_Percent >= minSize && 
                    faceWidth_Percent <= maxSize;
    
    // Lógica de Mensaje de Guía
    if (!isCentered && (diffX_Percent > PROXIMITY_CENTER_TOLERANCE || diffY_Percent > PROXIMITY_CENTER_TOLERANCE)) {
        message = "Centra tu rostro en el óvalo.";
    } else if (!isSized) {
        if (faceWidth_Percent < minSize) {
            message = "Acércate a la cámara para llenar el óvalo.";
        } else if (faceWidth_Percent > maxSize) {
            message = "Aléjate de la cámara, tu rostro es demasiado grande.";
        }
    } else if (!isCentered) {
         // Si el tamaño es correcto pero el centrado está ligeramente desviado
         message = "Mueve tu rostro ligeramente para centrarlo.";
    } else {
         message = "¡Rostro alineado! Preparado para la captura.";
    }

    return { isAligned: isCentered && isSized, message: message };
}

function showInstruction(text, isSuccess = false) {
    instructionText.innerText = text;
    if (isSuccess) {
        instructionBox.classList.add('success');
    } else {
        instructionBox.classList.remove('success');
    }
}

function startCountdown() {
    currentCount = INITIAL_COUNT;
    
    showInstruction("¡No te muevas!", true);

    countdownInterval = setInterval(() => {
        if (currentCount > 0) {
            showInstruction(currentCount.toString(), true);
            currentCount--;
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            
            // Ocultar mensaje antes de mostrar la foto
            instructionBox.style.opacity = '0';
            
            takePhoto();
        }
    }, 1000);
}

function abortCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    isCountingDown = false;
    currentCount = 0;
    
    instructionBox.style.opacity = '1';
    showInstruction("¡Te moviste! Vuelve a centrar tu rostro.", false);
}

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
    video.pause();
    
    const detectionCanvas = document.querySelector('canvas');
    if (detectionCanvas) {
        detectionCanvas.style.transition = 'opacity 0.5s';
        detectionCanvas.style.opacity = '0';
    }
    overlayGuide.style.transition = 'opacity 0.5s';
    overlayGuide.style.opacity = '0';
    
    instructionBox.style.display = 'none'; // Ocultar la caja de instrucciones

    finalPhoto.src = imageDataURL;
    photoContainer.classList.add('show');
}



