# webrtc-trial
A foray into the world of webrtc

## Instructions to replicate:
1. `npm i @vitejs/app` and choose vanilla javascript 

2. `npm i firebase` to install firebase dependency

3. Ensure a firebase account with this project has been initialised. Go ahead and create a Cloud Firestore database to be used as a signalling server. Install `npm i -g firebase-tools` to download the latest Firebase CLI

4. Obtain the credentials for firbase under project settings > SDK Setup and configuration > Config

5. Add the boilerplate code to main.js

6. Remember to create the collection answerCandidates, calls, and offerCandidates on firebase or else the code will not work