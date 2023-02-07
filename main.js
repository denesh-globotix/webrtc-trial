import './style.css';

// Import firebase tools
import firebase from 'firebase/app';
import 'firebase/firestore';

// These are the configurations provided
const firebaseConfig = {
  apiKey           : "AIzaSyAjspmK896MDV1pPzxIgEfQk2ammQVETro",
  authDomain       : "webrtc-trial-307c5.firebaseapp.com",
  projectId        : "webrtc-trial-307c5",
  storageBucket    : "webrtc-trial-307c5.appspot.com",
  messagingSenderId: "740496896685",
  appId            : "1:740496896685:web:15dd62fb050b55b396cc24",
  measurementId    : "G-RNEHVLQQC1"
};

// Check if there are apps running, if not initialise the config above
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialise firestore to communicate with the database later
const firestore = firebase.firestore();

// Create a couple of stun servers. Use the default google servers
const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Start a new RTC connection using the stun servers
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo  = document.getElementById('webcamVideo');
const callButton   = document.getElementById('callButton');
const callInput    = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo  = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

// 1. Setup media sources when clicking on start webcam
webcamButton.onclick = async () => {
  // Connect to the local device's media
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

  // Initiate the remote stream
  remoteStream = new MediaStream();

  // A media stream consists of at least one media track so push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

// 2. Create an offer and add it to offer candidates
// Set local description 
// Set remote description
callButton.onclick = async () => {

  // Reference Firestore collections for signaling
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');
  
  callInput.value = callDoc.id;

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  // Update the database to include a field called offer with the data from const offer above
  await callDoc.set({ offer });

  // Listen for remote answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add ICE candidate to peer connection
  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
};

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  // Add an answer candidate here
  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  // Updating the calls document
  await callDoc.update({ answer });

  // If someone has updated the offer candidates listen to it here and add a new ICE candidate
  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};
