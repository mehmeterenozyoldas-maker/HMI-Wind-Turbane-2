import React, { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

interface GestureControllerProps {
  orbitControlsRef: React.MutableRefObject<any>;
  onSelect: (id: number) => void;
}

export const GestureController: React.FC<GestureControllerProps> = ({ orbitControlsRef, onSelect }) => {
  const { camera, scene, size } = useThree();
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const cursorRef = useRef<THREE.Mesh>(null);
  const raycaster = useRef(new THREE.Raycaster());
  
  const lastVideoTime = useRef(-1);
  const pinchCooldown = useRef(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Initialize MediaPipe
  useEffect(() => {
    // Ensure video properties for inline playback compatibility
    videoRef.current.playsInline = true;
    videoRef.current.muted = true;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        const newLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        setLandmarker(newLandmarker);
        
        // Setup Webcam
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", () => {
            if(videoRef.current) {
                videoRef.current.play().catch(e => {
                    console.warn("Video play failed:", e);
                });
            }
          });
        } catch (err) {
          console.warn("Camera access denied or unavailable. Gesture control disabled.", err);
          setPermissionDenied(true);
        }
      } catch (err) {
        console.error("Failed to initialize MediaPipe vision tasks:", err);
        setPermissionDenied(true);
      }
    };
    init();
  }, []);

  useFrame((state, delta) => {
    if (permissionDenied || !landmarker || !videoRef.current || videoRef.current.readyState < 2) return;
    
    // Prevent processing if dimensions are invalid (fixes 'undefined or null' internal errors)
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) return;

    // Process frame only if timestamp changed
    if (videoRef.current.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = videoRef.current.currentTime;
      
      let detections;
      try {
        detections = landmarker.detectForVideo(videoRef.current, performance.now());
      } catch (e) {
        // Handle rare runtime errors in detection gracefully
        return;
      }
      
      if (detections && detections.landmarks && detections.handedness && detections.landmarks.length > 0) {
        // Decrease cooldown
        if (pinchCooldown.current > 0) pinchCooldown.current -= delta;

        detections.handedness.forEach((hand: any, index) => {
          if (!hand) return;

          const landmarks = detections.landmarks[index];
          // Safely extract category. handedness is a list of Classifications, so hand has 'categories'.
          const categories = hand.categories || hand; // Fallback for safety
          const topCategory = categories && categories[0];
          
          if (!landmarks || !topCategory) return;

          const label = topCategory.categoryName; // "Left" or "Right" (Note: MediaPipe assumes selfie mode mirrored usually)

          // --- LEFT HAND: Camera Control ---
          if (label === 'Left') {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const wrist = landmarks[0];
            const middleTip = landmarks[12];
            const ringTip = landmarks[16];
            const pinkyTip = landmarks[20];

            // 1. Detect Fist (Stop/Freeze)
            // Simple check: are finger tips close to wrist?
            const isFist = [indexTip, middleTip, ringTip, pinkyTip].every(tip => {
               const d = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
               return d < 0.15; // Threshold
            });

            if (isFist) {
              // Stop rotation
              if (orbitControlsRef.current) {
                orbitControlsRef.current.autoRotate = false;
              }
            } else {
              // 2. Rotate (Open Hand)
              // Use wrist position relative to center of frame (0.5, 0.5)
              const dx = (wrist.x - 0.5) * 2; // -1 to 1
              const dy = (wrist.y - 0.5) * 2; // -1 to 1
              
              if (orbitControlsRef.current) {
                // Apply rotation sensitivity
                orbitControlsRef.current.setAzimuthalAngle(orbitControlsRef.current.getAzimuthalAngle() - dx * 0.05);
                orbitControlsRef.current.setPolarAngle(Math.max(0.1, Math.min(Math.PI / 2, orbitControlsRef.current.getPolarAngle() + dy * 0.05)));
                orbitControlsRef.current.update();
              }

              // 3. Zoom (Pinch Distance)
              const zoomDist = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) + 
                Math.pow(thumbTip.y - indexTip.y, 2)
              );
              
              if (orbitControlsRef.current) {
                 if (zoomDist > 0.15) {
                    orbitControlsRef.current.dollyOut(1.02);
                 } else if (zoomDist < 0.05) {
                    orbitControlsRef.current.dollyIn(1.02);
                 }
                 orbitControlsRef.current.update();
              }
            }
          }

          // --- RIGHT HAND: Interaction/Cursor ---
          if (label === 'Right') {
            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];

            // Map MediaPipe (0,1) to Three.js NDC (-1,1)
            // MediaPipe: 0 is left, 1 is right. Three.js: -1 is left, 1 is right.
            // Formula: x * 2 - 1
            const ndsX = (indexTip.x * 2) - 1; 
            const ndsY = -(indexTip.y * 2) + 1; // Invert Y (0 is top in MP, 1 is top in Three)

            // Update 3D Cursor position
            if (cursorRef.current) {
                const vector = new THREE.Vector3(ndsX, ndsY, 0.5);
                vector.unproject(camera);
                const dir = vector.sub(camera.position).normalize();
                const distance = 100; // Arbitrary distance
                const pos = camera.position.clone().add(dir.multiplyScalar(distance));
                cursorRef.current.position.copy(pos);
                cursorRef.current.visible = true;
            }

            // Detect Pinch (Selection)
            const pinchDist = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) + 
                Math.pow(thumbTip.y - indexTip.y, 2)
            );

            // Trigger selection if pinched and cooldown ready
            if (pinchDist < 0.05 && pinchCooldown.current <= 0) {
                pinchCooldown.current = 1.0; // 1 second cooldown

                // Raycast
                raycaster.current.setFromCamera({ x: ndsX, y: ndsY }, camera); 
                
                // Raycast against scene objects
                const intersects = raycaster.current.intersectObjects(scene.children, true);
                
                // Find first "WindTurbine" group (we need to traverse up to find the group with ID)
                for (const hit of intersects) {
                    let obj: THREE.Object3D | null = hit.object;
                    while (obj) {
                        if (obj.userData && obj.userData.isTurbine) {
                            onSelect(obj.userData.id);
                            return; // Stop after first hit
                        }
                        obj = obj.parent;
                    }
                }
            }
          }
        });
      } else {
        if (cursorRef.current) cursorRef.current.visible = false;
      }
    }
  });

  if (permissionDenied) return null;

  return (
    <>
       {/* Visual Feedback for Hand Cursor */}
       <mesh ref={cursorRef} visible={false}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="red" transparent opacity={0.8} />
       </mesh>
    </>
  );
};