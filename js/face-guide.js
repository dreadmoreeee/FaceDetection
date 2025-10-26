// face-guide.js

// --- CONFIGURACIÓN DE LA GUÍA ---
// Estas dimensiones deben coincidir con las que definiste en styles.css para el óvalo.
const GUIDE_WIDTH = 300; 
const GUIDE_HEIGHT = 400;
// Tolerancia: margen de error aceptable (en píxeles) para considerar que está "dentro"
const TOLERANCE = 50; 
// --- ELEMENTOS DOM ---
const video = document.getElementById('video');
const overlayGuide = document.getElementById('face-overlay-guide');
let canvasObserver; // Para el observador de mutación

// Esperamos a que el video comience a reproducirse.
// Usamos 'playing' para estar seguros de que los elementos están listos.
video.addEventListener('playing', () => {
    // Es posible que el canvas se cree después, así que usamos un observador
    // o un pequeño retraso para asegurar que el canvas esté en el DOM.
    setTimeout(setupCanvasObserver, 500); 
});

function setupCanvasObserver() {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        console.warn("Canvas aún no está en el DOM, reintentando...");
        return;
    }
    
    // Usaremos MutationObserver para detectar si el canvas se dibuja (lo que indica
    // que la detección de face-api.js ha ocurrido).
    canvasObserver = new MutationObserver(handleDetectionFeedback);
    
    // Observamos los cambios en los atributos del canvas (si se redibuja, etc.)
    // La forma más fiable es observar un atributo que face-api.js cambie o el bucle.
    // Como face-api.js limpia el canvas, comprobaremos si hay detecciones cada 200ms
    // en lugar de depender del DOM, ya que el bucle rAF es mejor.
    
    // Iniciamos un bucle de verificación de detecciones.
    // IMPORTANTE: Este bucle DEBE ejecutarse DESPUÉS de que 'script.js' haya dibujado.
    setInterval(checkAlignment, 200); 
}

function checkAlignment() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Obtener la última detección (esto requiere un ajuste en script.js, ver paso 3)
    // PERO, dado que no podemos modificar script.js para compartir datos,
    // haremos una suposición simplificada basada en el *último dibujo*.

    // Ya que no podemos acceder a las variables internas de script.js,
    // usaremos una forma indirecta: face-api.js usa el contexto para dibujar.
    
    // **NOTA:** La forma MÁS limpia de hacer esto es exponer la variable 'resizedDetections' 
    // globalmente en script.js. Ya que no podemos modificar script.js, este método
    // será una simulación.
    
    // SIMULACIÓN: Asumiendo que face-api.js dibuja una caja con un color específico,
    // la forma correcta es *exponer la data de la detección*. Como no podemos,
    // asumiremos que la detección está activa si hay un rostro en el video, 
    // y revisaremos la posición del centro del rostro en la pantalla.
    
    // **¡ATENCIÓN!** Para obtener la data de detección real, **necesitamos** la información
    // de la variable `resizedDetections` de `script.js`.
    
    // **SOLUCIÓN NECESARIA:** Ya que no puedo acceder a `script.js`, asumo que vas a 
    // modificar `script.js` para exponer la última detección globalmente. 
    // Por ejemplo, añadiendo al principio de script.js: `window.lastDetections = [];`
    // y actualizándola en cada ciclo.
    
    if (window.lastDetections && window.lastDetections.length > 0) {
        // Obtenemos la primera cara detectada
        const detection = window.lastDetections[0].detection;
        const box = detection.box;

        // 1. Obtener el centro del rostro (relativo al canvas)
        const faceCenterX = box.x + box.width / 2;
        const faceCenterY = box.y + box.height / 2;

        // 2. Obtener el centro del área de la guía (relativo al canvas/pantalla)
        // El óvalo está centrado en CSS, así que su centro es el centro de la pantalla.
        // Necesitamos mapear las coordenadas del canvas/video al centro del óvalo en CSS.
        
        // Asumiendo que el video está centrado:
        const screenCenterX = video.offsetLeft + video.clientWidth / 2;
        const screenCenterY = video.offsetTop + video.clientHeight / 2;

        // 3. Mapear la posición de la cara a las coordenadas de la pantalla
        // Necesitamos la posición de la caja de detección en píxeles de pantalla:
        
        // Para simplificar, comparamos el centro del rostro con el centro del video
        const videoRect = video.getBoundingClientRect();
        
        // Coordenadas del centro del rostro en la pantalla (aproximadas)
        const faceScreenX = videoRect.left + faceCenterX * (videoRect.width / video.videoWidth);
        const faceScreenY = videoRect.top + faceCenterY * (videoRect.height / video.videoHeight);
        
        // Centro del óvalo de la guía en la pantalla
        const guideScreenX = videoRect.left + videoRect.width / 2;
        const guideScreenY = videoRect.top + videoRect.height / 2;


        // 4. Comprobar la distancia al centro
        const diffX = Math.abs(faceScreenX - guideScreenX);
        const diffY = Math.abs(faceScreenY - guideScreenY);
        
        // 5. Comprobar si la cara está centrada Y si cabe en el óvalo (aproximado)
        const isAligned = diffX < TOLERANCE && 
                          diffY < TOLERANCE &&
                          box.width < (GUIDE_WIDTH + TOLERANCE) * (video.videoWidth / video.clientWidth) && // Escalamiento de tamaño
                          box.height < (GUIDE_HEIGHT + TOLERANCE) * (video.videoHeight / video.clientHeight);


        if (isAligned) {
            overlayGuide.classList.add('aligned');
        } else {
            overlayGuide.classList.remove('aligned');
        }
    } else {
        // No hay rostros detectados
        overlayGuide.classList.remove('aligned');
    }
}