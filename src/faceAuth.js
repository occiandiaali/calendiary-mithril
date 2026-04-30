import * as faceapi from "face-api.js";

async function initFaceAuth() {
  await faceapi.nets.tinyFaceDetector.loadFromUri("/models/tiny_detector");
  await faceapi.nets.faceRecognitionNet.loadFromUri("/models/face_recognition");
  await faceapi.nets.faceLandmark68Net.loadFromUri("/models/face_landmark68");
}

async function startCamera(videoEl) {
  const constraints = {
    video: {
      facingMode: "user",
    },
  };

  // Detect ambient light
  if ("AmbientLightSensor" in window) {
    try {
      const sensor = new AmbientLightSensor();
      sensor.onreading = () => {
        if (sensor.illuminance < 20) {
          constraints.video.torch = true; // request torch if supported
        }
      };
      sensor.start();
    } catch (e) {
      console.warn("AmbientLightSensor not available", e);
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoEl.srcObject = stream;

  // Try enabling torch manually if supported
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();
  if (capabilities.torch) {
    track.applyConstraints({ advanced: [{ torch: true }] });
  }
}

async function captureFace(videoEl) {
  const detection = await faceapi
    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection ? detection.descriptor : null;
}

// Example: store descriptor in localStorage for demo
function saveUserFace(descriptor) {
  localStorage.setItem("userFace", JSON.stringify(Array.from(descriptor)));
}

// function matchFace(descriptor) {
//   const saved = JSON.parse(localStorage.getItem("userFace"));
//   if (!saved) return false;
//   const distance = faceapi.euclideanDistance(saved, descriptor);
//   return distance < 0.6; // threshold
// }
function getUserFace() {
  const data = localStorage.getItem("userFace");
  try {
    return data ? new Float32Array(JSON.parse(data)) : null;
  } catch (e) {
    console.warn("Corrupted face data, clearing.");
    localStorage.removeItem("userFace");
    return null;
  }
}

function matchFace(desc) {
  const stored = getUserFace();
  if (!stored) return false;
  try {
    const distance = faceapi.euclideanDistance(desc, stored);
    return distance < 0.6; // threshold
  } catch (e) {
    console.error("Descriptor mismatch, clearing stored face.");
    localStorage.removeItem("userFace");

    return false;
  }
}

export { initFaceAuth, captureFace, startCamera, saveUserFace, matchFace };
