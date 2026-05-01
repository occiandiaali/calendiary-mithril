import * as faceapi from "face-api.js";

// --- Initialization ---
async function initFaceAuth() {
  await faceapi.nets.tinyFaceDetector.loadFromUri("/models/tiny_detector");
  await faceapi.nets.faceRecognitionNet.loadFromUri("/models/face_recognition");
  await faceapi.nets.faceLandmark68Net.loadFromUri("/models/face_landmark68");
}

// --- Camera setup ---
async function startCamera(video) {
  try {
    // console.log("Requesting camera access...");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    //  console.log("Camera stream obtained:", stream);

    video.srcObject = stream;
    await video.play();
    // console.log("Video playback started.");
  } catch (err) {
    console.error("Camera error:", err);
    alert("Unable to access camera. Please check permissions.");
  }
}

// --- Capture face descriptor ---
async function captureFace(videoEl) {
  const detection = await faceapi
    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection ? detection.descriptor : null;
}

// --- Storage helpers ---
function saveUserFace(descriptor) {
  localStorage.setItem("userFace", JSON.stringify(Array.from(descriptor)));
}

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

// --- Matching ---
function matchFace(desc) {
  const stored = getUserFace();
  if (!stored) return false;
  const distance = faceapi.euclideanDistance(desc, stored);
  return distance < 0.4; // adjust threshold as needed
}

// --- Registration flow ---
async function registerFace(videoEl) {
  const descriptor = await captureFace(videoEl);
  if (!descriptor) {
    alert("No face detected. Please try again.");
    return false;
  }
  saveUserFace(descriptor);
  alert("Face registered successfully!");
  return true;
}

// --- Authentication flow ---
async function authenticate(videoEl) {
  const descriptor = await captureFace(videoEl);
  if (!descriptor) {
    alert("No face detected.");
    return false;
  }
  if (matchFace(descriptor)) {
    alert("Access granted!");
    return true;
  } else {
    alert("Access denied. Face does not match. Or, try registering your face.");
    return false;
  }
}

export {
  initFaceAuth,
  startCamera,
  captureFace,
  registerFace,
  authenticate,
  saveUserFace,
  getUserFace,
  matchFace,
};
