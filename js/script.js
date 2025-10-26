const video = document.getElementById('video');
const MODEL_URL = '/models';
const overlayGuide = document.getElementById('face-overlay-guide');
const countdownMessage = document.getElementById('countdown-message');
const photoContainer = document.getElementById('final-photo-container');
const finalPhoto = document.getElementById('final-photo');
const GUIDE_CENTER_X = 50;  
const GUIDE_CENTER_Y = 50;  
const GUIDE_WIDTH_PERCENT = 35; 
const TOLERANCE_CENTER_PERCENT = 8; 
const TOLERANCE_SIZE = 1.2;          
let isCountingDown = false; // Flag para evitar que el proceso se reinicie

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

    detectFaces(canvas, displaySize);
});

async function detectFaces(canvas, displaySize) {
    if (isCountingDown) {
        requestAnimationFrame(() => detectFaces(canvas, displaySize));
        return;
    }

    const detections = await faceapi.detectAllFaces(
      video, 
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceExpressions();
    
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    if (resizedDetections.length > 0) {
        const isAligned = checkAlignment(resizedDetections[0].detection, displaySize);
        if (isAligned && !isCountingDown) {
            isCountingDown = true;
            overlayGuide.classList.add('aligned');
            startCountdown();
        } else if (!isAligned) {
            overlayGuide.classList.remove('aligned');
        }
    } else {
        overlayGuide.classList.remove('aligned');
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
    const faceCenterX_Percent = ((box.x + box.width / 2) / videoDimensions.width) * 100;
    const faceCenterY_Percent = ((box.y + box.height / 2) / videoDimensions.height) * 100;
    const faceWidth_Percent = (box.width / videoDimensions.width) * 100;
    const isMirrored = true; 
    const finalFaceCenterX_Percent = isMirrored 
        ? (100 - faceCenterX_Percent) 
        : faceCenterX_Percent;
    const diffX_Percent = Math.abs(finalFaceCenterX_Percent - GUIDE_CENTER_X);
    const diffY_Percent = Math.abs(faceCenterY_Percent - GUIDE_CENTER_Y);
    const isCentered = diffX_Percent < TOLERANCE_CENTER_PERCENT && 
                       diffY_Percent < TOLERANCE_CENTER_PERCENT;
    const isSized = faceWidth_Percent > (GUIDE_WIDTH_PERCENT / TOLERANCE_SIZE) && 
                    faceWidth_Percent < (GUIDE_WIDTH_PERCENT * TOLERANCE_SIZE);
                    
    return isCentered && isSized;
}
function startCountdown() {
    let count = 3;
    countdownMessage.innerText = "¡No te muevas!";
    countdownMessage.classList.add('visible');

    const interval = setInterval(() => {
        if (count > 0) {
            // Muestra el número de cuenta atrás
            countdownMessage.innerText = count;
            count--;
        } else {
            clearInterval(interval);
            countdownMessage.classList.remove('visible');
            countdownMessage.innerText = '';
            
            takePhoto();
        }
    }, 1000);
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
    document.querySelector('canvas').style.display = 'none';
    overlayGuide.style.display = 'none';
    finalPhoto.src = imageDataURL;
    photoContainer.classList.add('show');
}
