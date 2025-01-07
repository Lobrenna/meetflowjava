<script>
  // Define base URL
  const base_url = "https://meetflow2-288093225591.europe-west1.run.app";

  // Generate a unique client ID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0,
          v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  let clientId = generateUUID(); // Changed from const to let
  console.log('Generated clientId:', clientId);

  // Rest of your global variables
  let languages = []; // Will be set from user settings in Memberstack
  let primary_language = ''; // The first language in the list
  let selectedMicDeviceName = null; // Will be set from Memberstack (store device label)
  let selectedAudioDeviceName = null; // Will be set from Memberstack (store device label)
  let summaryType = ''; // Will be set from Memberstack


  // **Declare screenStream as a global variable**
  let screenStream = null;

  // Build specific endpoints based on base URL (ws_url will be updated later)
  let ws_url = ''; // Will be constructed after getting user settings
  const initialize_session_url = `${base_url}/initialize_session`;
  const referat_url = `${base_url}/referat`;
  const status_url = `${base_url}/status`;

  // Define plan types and their corresponding plan IDs
  const planTypes = {
    sales_plans: ['pln_demosales-dzgl0895'],
    demo_plans: [
      'pln_demo-g6i601oz',
      'pln_full-demo-069p06i6',
    ],
    special_plans: [
      'pln_monthly-special-nk9306q6',
      'pln_weekly-special-ki9c0w4k',
      'pln_yearly-special-et9a0wqz'
    ],
    business_plans: {
      referatkode_mapping: {
        'Generic Meeting Summary': 2,
        'Board Meeting': 3,
        'Webinar/Seminar': 5,
        'B2B Sales': 7
      },
      summaryOptions: [
        'Generic Meeting Summary',
        'Board Meeting',
        'Webinar/Seminar',
        'B2B Sales'
      ]
    },
    student_plans: {
      referatkode_mapping: {
        'Generic Meeting Summary': 2,
        'Webinar/Seminar': 5
      },
      summaryOptions: [
        'Generic Meeting Summary',
        'Webinar/Seminar'
      ]
    }
  };

  // Define configurations for each plan type
  const planConfigurations = {
    sales_plans: {
      referatkode_mapping: {
        'Cold call': 10,
        'Book meeting': 11,
        'B2B generic': 12,
        'B2B technical': 13,
        'Service product': 14,
        'Consumer product': 15,
        'Sales Manager Meeting': 16
      },
      summaryOptions: [
        'Cold call',
        'Book meeting',
        'B2B generic',
        'B2B technical',
        'Service product',
        'Consumer product',
        'Sales Manager Meeting'
      ]
    },
    demo_plans: {
      referatkode_mapping: {
        'Generic Meeting Summary': 2,
        'Podcast Summary': 1,
        'Board Meeting': 3,
        'Patient Journal': 4,
        'Webinar/Seminar': 5,
        'Lecture Summary': 6,
        'B2B Sales': 7
      },
      summaryOptions: [
        'Generic Meeting Summary',
        'Podcast Summary',
        'Board Meeting',
        'Patient Journal',
        'Webinar/Seminar',
        'Lecture Summary',
        'B2B Sales'
      ]
    },
    special_plans: {
      referatkode_mapping: {
        'Generic Meeting Summary': 2,
        'Podcast Summary': 1,
        'Board Meeting': 3,
        'Patient Journal': 4,
        'Webinar/Seminar': 5,
        'Lecture Summary': 6,
        'B2B Sales': 7
      },
      summaryOptions: [
        'Generic Meeting Summary',
        'Podcast Summary',
        'Board Meeting',
        'Patient Journal',
        'Webinar/Seminar',
        'Lecture Summary',
        'B2B Sales'
      ]
    },
    business_plans: {
      referatkode_mapping: {
        'Generic Meeting Summary': 2,
        'Board Meeting': 3,
        'Webinar/Seminar': 5,
        'B2B Sales': 7
      },
      summaryOptions: [
        'Generic Meeting Summary',
        'Board Meeting',
        'Webinar/Seminar',
        'B2B Sales'
      ]
    },
    student_plans: {
      referatkode_mapping: {
        'Generic Meeting Summary': 2,
        'Webinar/Seminar': 5
      },
      summaryOptions: [
        'Generic Meeting Summary',
        'Webinar/Seminar'
      ]
    }
  };

  // Global variables for referatkode_mapping and summaryOptions
  let referatkode_mapping = {};
  let summaryOptions = [];

  // Other global variables
  let isRecording = false;
  let mediaRecorder = null;
  let websocket = null;
  let finalTranscriptionText = "";
  let interimTranscriptionText = "";
  let referatText = "";
  let suggestionsText = "";
  let transcriptionText = ""; // Initialize transcriptionText

  // To store all active audio streams
  let activeStreams = [];

  // To store AudioContext
  let audioContext = null;

  // Retry configuration
  let retryCount = 0;
  const maxRetries = 5;
  const retryDelay = 1000; // 1 second

  // Minimum transcription length
  const MIN_TRANSCRIPTION_LENGTH = 100; // Adjust this number as needed

  // Legg til disse globale variablene øverst i filen
  let userScrolling = false;
  let scrollTimeout;

  // Doble initialverdiene
  let transcriptionLengths = [1500]; // Økt fra 300 til 600 karakterer
  let averageTranscriptionLength = 1500; // Økt fra 300 til 600
  let currentMeterLength = 0;
  let trafficDots = 1;
  let trafficDirection = 'up';
  let lastTranscriptionLength = 0;
  let trafficInterval;
  let meterInterval;

  // Forenklet trafikk-indikator variabler
  let receivedCharCount = 0;
  const CHAR_THRESHOLD = 250; // Antall tegn som tilsvarer 3 punktum
  const MAX_DOTS = 3; // Redusert fra 10 til 3 punktum

  // Forenklet trafikk-indikator funksjon
  function updateTrafficIndicator(messageSize) {
    receivedCharCount += messageSize;
    
    // Beregn antall punktum (1-3) basert på mottatte tegn
    const dots = Math.max(1, Math.min(MAX_DOTS, Math.floor((receivedCharCount / CHAR_THRESHOLD) * MAX_DOTS)));
    
    // Oppdater visningen/
    const trafficElement = document.getElementById("text_stream");
    if (trafficElement) {
        trafficElement.textContent = '_'.repeat(dots);
    }
    
    // Reset telleren når vi når terskelen
    if (receivedCharCount >= CHAR_THRESHOLD) {
        receivedCharCount = 0;
    }
  }

  // Oppdatert funksjon for meter-indikatoren med 150% av snitt som maks
  function updateMeterIndicator(currentLength) {
    if (averageTranscriptionLength === 0) return;
    
    // Bruker 150% av snittet som maksverdi
    const adjustedMax = averageTranscriptionLength * 1.5;
    const percentage = (currentLength / adjustedMax) * 100;
    const meterLength = Math.floor((percentage / 100) * 120); // Fortsatt max 120 tegn
    
    const meterElement = document.getElementById("text_meter");
    if (meterElement) {
        meterElement.textContent = '_'.repeat(Math.min(120, Math.max(1, meterLength)));
    }
  }

  // Function to ensure unique languages
  function ensureUniqueLanguages(languages) {
    // console.log('Ensuring unique languages...');
    if (languages.length >= 2 && languages[0] === languages[1]) {
      // console.log('Duplicate found: language2 is same as language1');
      if (languages.length >= 3) {
        languages[1] = languages[2];
        languages.pop();
        // console.log('Shifted language3 to language2 and removed language3');
      } else {
        languages.pop();
        // console.log('Removed language2 as it was duplicate');
      }
    }

    if (languages.length >= 3 && (languages[0] === languages[2] || languages[1] === languages[2])) {
      // console.log('Duplicate found: language3 is same as language1 or language2');
      languages.pop();
      // console.log('Removed language3 as it was duplicate');
    }

    // console.log('Languages after ensuring uniqueness:', languages);
    return languages;
  }

  async function initializeSession() {
      const payload = {
          client_id: clientId, // Retains the same clientId
          languages: languages.join(','),
          transcription_text: transcriptionText, // Pass existing transcription
          is_continuation: true // Optional: Add a flag to indicate continuation
      };

      try {
          const response = await fetch(initialize_session_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          if (response.ok) {
              const data = await response.json();
              console.log('Session initialized/continued:', data);
              return true;
          } else {
              const errorData = await response.json();
              console.error('Failed to initialize session:', errorData.detail || errorData);
              alert(`Failed to initialize session: ${errorData.detail || 'Unknown error'}`);
              return false;
          }
      } catch (error) {
          console.error('Error initializing session:', error);
          alert(`Error initializing session: ${error}`);
          return false;
      }
  }


  // Connect to WebSocket with retry mechanism
  async function connectWebSocket(onSuccess, onFailure) {
    if (websocket) {
        websocket.close();
    }

    // Construct WebSocket URL using /ws/{client_id}
    const ws_url = `wss://${base_url.replace(/^https?:\/\//, "")}/ws/${clientId}`;
    websocket = new WebSocket(ws_url);
    websocket.binaryType = 'arraybuffer';

    websocket.onopen = () => {
        console.log('WebSocket connected');
        if (onSuccess) onSuccess();
    };

    websocket.onclose = (event) => {
        console.log('WebSocket disconnected', event);
        if (onFailure) onFailure();
        isWebSocketClosing = false; // Reset flag when WebSocket is closed
    };

    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onFailure) onFailure();
    };

    // Korrigert onmessage-handler
    websocket.onmessage = (event) => {
        console.log('WebSocket message received:', event);
        console.log('Type of event.data:', typeof event.data);
        processMessage(event.data); // Sender bare meldingen som en streng
    };
  }

  // Global flag to prevent multiple WebSocket closures
  let isWebSocketClosing = false;
    // Updated processMessage function
  async function processMessage(message) {
      if (!isRecording) return;

      // Validate message type
      if (typeof message !== 'string') {
          console.error(`Expected message to be a string but received type: ${typeof message}`);
          console.warn(`Message content:`, message);
          return;
      }

      // Parse message type and content
      const separatorIndex = message.indexOf(':');
      if (separatorIndex === -1) {
          console.warn(`Invalid message format: ${message}`);
          return;
      }

      const messageType = message.substring(0, separatorIndex).trim();
      const messageContent = message.substring(separatorIndex + 1).trim();

      console.log(`Received message type: ${messageType}, content length: ${messageContent.length}`);

      // Add new case for handling maximum restarts error
      if (messageType === 'ERROR' && messageContent.includes('Maximum streaming restarts reached')) {
          console.log('Maximum restarts reached. Initiating graceful shutdown...');
          await stopRecording(); // This will handle the referat request and cleanup
          return;
      }

      // Update traffic indicator based on message content length
      updateTrafficIndicator(messageContent.length);

      // Handle different message types
      switch(messageType) {
          case 'CLOUD_LIMIT_REACHED':
              console.log('Cloud limit reached, starting new session');
              try {
                  await startNewSession();
              } catch (error) {
                  console.error('Error starting new session:', error);
              }
              break;

          case 'FINAL':
              // Fjern spinner hvis dette er første transkripsjon
              if (finalTranscriptionText.length === 0) {
                  const transcriptionElement = document.getElementById("par_transcription");
                  if (transcriptionElement) {
                      transcriptionElement.innerHTML = "";
                  }
              }
              
              const newLength = messageContent.length;
              
              // Calculate average transcription length
              transcriptionLengths.push(newLength);
              if (transcriptionLengths.length > 10) transcriptionLengths.shift();
              
              averageTranscriptionLength = transcriptionLengths.reduce((a, b) => a + b, 0) / transcriptionLengths.length;
              
              // Reset meter indicator immediately to '_'
              const meterElement = document.getElementById("text_meter");
              if (meterElement) {
                  meterElement.textContent = '_';
              }
              
              // Update transcription texts
              finalTranscriptionText += messageContent + " ";
              transcriptionText += messageContent + " ";
              interimTranscriptionText = "";
              lastTranscriptionLength = finalTranscriptionText.length;
              
              console.log(`Updated finalTranscriptionText: ${finalTranscriptionText}`);
              break;

          case 'INTERIM':
              // Fjern spinner hvis dette er første transkripsjon
              if (interimTranscriptionText.length === 0) {
                  const transcriptionElement = document.getElementById("par_transcription");
                  if (transcriptionElement) {
                      transcriptionElement.innerHTML = "";
                  }
              }
              
              interimTranscriptionText = messageContent;
              const currentLength = messageContent.length;
              updateMeterIndicator(currentLength);
              
              console.log(`Updated interimTranscriptionText: ${interimTranscriptionText}`);
              break;

          case 'GEMINI_FEEDBACK':
              const currentTime = new Date().toLocaleTimeString();
              suggestionsText = `______\nTime: ${currentTime}\n${messageContent}\n\n${suggestionsText}`;
              
              console.log(`Updated suggestionsText: ${suggestionsText}`);
              break;

          case 'ERROR':
              console.error(`WebSocket error: ${messageContent}`);
              alert(`WebSocket error: ${messageContent}`);
              break;

          case 'STOP':
              console.log(`Received STOP message from server: ${messageContent}`);
              try {
                  await stopRecording(); // Assuming stopRecording is asynchronous
              } catch (error) {
                  console.error('Error stopping recording:', error);
              }
              break;

          default:
              console.warn(`Unknown message type: ${messageType}`);
      }

      // Update the UI after processing the message
      updateWebflowUI();
  }

  // Send summary request
  async function sendReferatRequest() {
    const referatkode = referatkode_mapping[summaryType] || 2;
    const transcription = transcriptionText.trim() !== "" ? transcriptionText : interimTranscriptionText;

    if (transcription.trim() === "") {
        alert("No transcription available to generate summary.");
        return;
    }

    const payload = {
        client_id: clientId,
        referatkode: referatkode,
        transcription_text: transcription,
        additional_context_path: null
    };

    // Sett ventebeskjed med spinner
    const summaryElement = document.getElementById("par_summary");
    if (summaryElement) {
        summaryElement.innerHTML = `
            <div class="spinner-container">
                <div class="summary-spinner"></div>
                <span>Generating summary and takeaways, please wait...</span>
            </div>
        `;
    }

    try {
        const response = await fetch(referat_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        console.log('Received response from summary API:', response);

        if (response.ok) {
            const enrichedResult = await response.text();
            referatText = enrichedResult || "No summary received from the server.";
            console.log(`Referat received: ${referatText}`);
        } else {
            referatText = `Could not generate summary: ${await response.text()}`;
            console.error(`Could not generate summary: ${referatText}`);
        }
    } catch (e) {
        referatText = `Error generating summary: ${e}`;
        console.error(`Error generating summary: ${e}`);
    } finally {
        // Reaktiver knappene etter at referatet er generert
        const startLink = document.getElementById("link_start");
        const stopLink = document.getElementById("link_stop");
        
        if (startLink) {
            startLink.style.pointerEvents = "auto";
            startLink.style.opacity = "1";
        }
        if (stopLink) {
            stopLink.style.pointerEvents = "none";
            stopLink.style.opacity = "0.3";
        }
        
        // Oppdater UI kun etter at vi har fått svar fra backend
        updateWebflowUI();
    }
  }

    // Stop recording
  async function stopRecording() {
    if (!isRecording) return;
    
    isRecording = false;
    
    try {
        // 1. Stoppe MediaRecorder hvis den er aktiv
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            console.log('Stopping MediaRecorder...');
            mediaRecorder.stop();
            
            // Vente på at mediaRecorder stopper fullstendig
            await new Promise((resolve) => {
                mediaRecorder.onstop = () => {
                    console.log('MediaRecorder stopped.');
                    resolve();
                };
            });
        }
        
        // 2. Stopp alle aktive media streams
        if (activeStreams.length > 0) {
            console.log('Stopping all active media streams...');
            activeStreams.forEach(stream => {
                stream.getTracks().forEach(track => track.stop());
            });
            activeStreams = [];
            console.log('All media streams stopped.');
        }
        
        // 3. Send referat request og vent på respons
        console.log('Sending referat request...');
        await sendReferatRequest();
        console.log('Referat request completed.');

    } catch (error) {
        console.error('Error during stopRecording:', error);
    } finally {
        // 4. Lukke WebSocket etter at referat er mottatt, hvis ikke allerede lukket
        try {
            if (websocket && websocket.readyState === WebSocket.OPEN && !isWebSocketClosing) {
                console.log('Closing WebSocket connection...');
                isWebSocketClosing = true; // Sett flagget
                websocket.close();
                
                // Vente på at WebSocket lukkes
                await new Promise((resolve) => {
                    websocket.onclose = () => {
                        console.log('WebSocket connection closed.');
                        resolve();
                    };
                });
            }
        } catch (wsError) {
            console.error('Error closing WebSocket:', wsError);
        }
        
        // 5. Oppdatere UI knapper
        const startLink = document.getElementById("link_start");
        const stopLink = document.getElementById("link_stop");
        
        if (startLink) {
            startLink.style.pointerEvents = "auto";
            startLink.style.opacity = "1";
        }
        
        if (stopLink) {
            stopLink.style.pointerEvents = "none";
            stopLink.style.opacity = "0.3";
        }
        
        // Logge final transkripsjonslengde
        console.log(`Final transcription length: ${transcriptionText.length}`);
    }
  }


  // Function to get screen stream
  async function getScreenStream() {
      try {
          // Stopp eksisterende screenStream hvis den finnes
          if (screenStream) {
              screenStream.getTracks().forEach(track => track.stop());
              screenStream = null;
          }

          // Be om skjermdeling med systemlyd
          screenStream = await navigator.mediaDevices.getDisplayMedia({
              video: true, // Sett til true hvis du trenger video
              audio: true   // Inkluderer systemlyd
          });

          console.log('Screen stream obtained.');
      } catch (error) {
          console.error('Error getting screen stream:', error);
          alert('Could not access screen or tab for recording.');
          screenStream = null; // Sikre at screenStream er null hvis vi ikke fikk tilgang
      }
  }


  // Start recording
  async function startRecording() {
      console.log("Start recording triggered...");

      // Reset text variables
      transcriptionText = "";
      interimTranscriptionText = "";
      finalTranscriptionText = "";
      suggestionsText = "";
      referatText = "";

      // Legg til spinner i transcription-elementet
      const transcriptionElement = document.getElementById("par_transcription");
      if (transcriptionElement) {
          transcriptionElement.innerHTML = `
              <div class="spinner-container">
                  <div class="summary-spinner"></div>
                  <span>Waiting for first transcription...</span>
              </div>
          `;
      }

      // Generate a new clientId for each new stream
      clientId = generateUUID();

      // Check if user is logged in and has an active plan
      const activePlanType = await checkUserPlan();
      if (!activePlanType) {
          console.error("User has no active plan. Aborting recording.");
          return;
      }

      // Check if summaryType is set
      if (!summaryType) {
          alert("Please select a summary type in your settings.");
          console.error("Summary type not selected. Aborting recording.");
          return;
      }

      // Clear UI text elements
      const summaryElement = document.getElementById("par_summary");
      const runElement = document.getElementById("par_run");
      const transcriptionElement = document.getElementById("par_transcription");
      const suggestionsElement = document.getElementById("par_suggestions");

      if (summaryElement) summaryElement.innerHTML = "";
      if (runElement) runElement.innerHTML = "";
      if (transcriptionElement) transcriptionElement.innerHTML = "";
      if (suggestionsElement) suggestionsElement.innerHTML = "";

      // Check the current status
      const currentStatus = await updateStatus();
      if (currentStatus === "running") {
          console.warn("Recording is already in progress.");
          return;
      }

      // **Be om skjermdeling hvis ingen lydkilde er valgt**
      if (!selectedAudioDeviceName) {
          console.log("No audio device selected. Requesting screen sharing with audio...");
          await getScreenStream();
          if (!screenStream) {
              console.error('Screen stream not available. Cannot start recording.');
              alert('Screen sharing was not started or audio was not shared. Recording cannot proceed.');
              return;
          }
      } else {
          // Nullstill screenStream hvis den finnes fra før
          if (screenStream) {
              screenStream.getTracks().forEach(track => track.stop());
              screenStream = null;
          }
      }

      // Initialize session with backend
      const initializationSuccess = await initializeSession();
      if (!initializationSuccess) {
          console.error("Session initialization failed. Aborting recording.");
          return;
      }

      // Connect WebSocket
      if (!websocket || websocket.readyState !== WebSocket.OPEN) {
          console.log("WebSocket not connected. Connecting...");
          await new Promise((resolve, reject) => {
              connectWebSocket(
                  resolve,
                  () => {
                      console.error("WebSocket failed to connect.");
                      reject();
                  }
              );
          });
      }

      // Start media recording
      const success = await initiateMediaRecording();
      if (!success) {
          console.error("Failed to initiate media recording.");
          return;
      }

      console.log("Recording successfully started.");

      // Set recording status
      isRecording = true;

      // Update UI for buttons
      const startLink = document.getElementById("link_start");
      const stopLink = document.getElementById("link_stop");
      if (startLink) {
          startLink.style.pointerEvents = "none";
          startLink.style.opacity = "0.3";
      }
      if (stopLink) {
          stopLink.style.pointerEvents = "auto";
          stopLink.style.opacity = "1";
      }
  }



  // Function to find deviceId based on device label
  async function getDeviceIdByLabel(label) {
    const devices = await navigator.mediaDevices.enumerateDevices();
    // console.log('Available audio input devices:', devices.filter(d => d.kind === 'audioinput'));
    const device = devices.find(device => device.kind === 'audioinput' && device.label === label);
    if (device) {
      console.log(`Found device '${label}' with deviceId: ${device.deviceId}`);
      return device.deviceId;
    } else {
      console.warn(`Device with label '${label}' not found.`);
      return null;
    }
  }

    // Initiate MediaRecorder with selected devices
  async function initiateMediaRecording() {
    try {
        // Reset mediaRecorder and audioContext
        mediaRecorder = null;
        audioContext = null;

        const payload = { client_id: clientId };
        const response = await fetch(`${base_url}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.status === 'running') {
            console.log('Recording started.');

            let streams = [];

            // Inkluder screenStream hvis tilgjengelig
            if (screenStream) {
                streams.push(screenStream);
                console.log('Using screen stream obtained earlier.');
            } else {
                console.warn('No screen stream available.');
            }

            // Legg til mikrofonstream hvis valgt
            if (selectedMicDeviceName) {
                const micDeviceId = await getDeviceIdByLabel(selectedMicDeviceName);
                if (micDeviceId) {
                    try {
                        const micStream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                                deviceId: { exact: micDeviceId },
                                echoCancellation: false,
                                noiseSuppression: false,
                                autoGainControl: false
                            }
                        });
                        streams.push(micStream);
                        activeStreams.push(micStream);
                        console.log('Microphone stream obtained:', selectedMicDeviceName);
                    } catch (err) {
                        console.error('Could not access selected microphone', err);
                    }
                } else {
                    console.warn(`Could not find device ID for microphone: ${selectedMicDeviceName}`);
                }
            }

            // Legg til BlackHole hvis valgt og hvis brukeren har valgt det eksplisitt
            if (selectedAudioDeviceName && selectedAudioDeviceName.toLowerCase().includes('blackhole')) {
                try {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const audioDevices = devices.filter(device => device.kind === 'audioinput');

                    // Finn enheten som matcher selectedAudioDeviceName
                    const blackholeDevice = audioDevices.find(device =>
                        device.label === selectedAudioDeviceName
                    );

                    if (blackholeDevice) {
                        const audioStream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                                deviceId: { exact: blackholeDevice.deviceId },
                                echoCancellation: false,
                                noiseSuppression: false,
                                autoGainControl: false
                            }
                        });
                        streams.push(audioStream);
                        activeStreams.push(audioStream);
                        console.log('BlackHole audio stream obtained:', blackholeDevice.label);
                    } else {
                        console.warn('Selected BlackHole device not found in available devices');
                    }
                } catch (err) {
                    console.error('Could not access BlackHole device:', err);
                }
            }

            // Hvis ingen streams er tilgjengelige, bruk standard mikrofon
            if (streams.length === 0) {
                try {
                    const defaultStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    streams.push(defaultStream);
                    activeStreams.push(defaultStream);
                    console.log('Default microphone stream obtained.');
                } catch (err) {
                    console.error('Could not access default microphone', err);
                    alert('Could not access microphone. Please check your device settings and permissions.');
                    return false;
                }
            }

            // Kombiner alle streams
            if (streams.length > 0) {
                // Sett opp Web Audio API for å kombinere lydstrømmer
                audioContext = new (window.AudioContext || window.webkitAudioContext)();

                // **Resumer AudioContext**
                await audioContext.resume();

                const destination = audioContext.createMediaStreamDestination();

                for (const stream of streams) {
                    const sourceNode = audioContext.createMediaStreamSource(stream);

                    // Opprett en GainNode hvis du ønsker å justere volumet
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 1.0; // Juster gain hvis nødvendig

                    // Koble kildene til destinasjonen
                    sourceNode.connect(gainNode).connect(destination);
                }

                // Bruk destinasjonsstrømmen for MediaRecorder
                try {
                    mediaRecorder = new MediaRecorder(destination.stream, {
                        mimeType: 'audio/webm;codecs=opus'
                    });
                    console.log('MediaRecorder created with MIME type:', mediaRecorder.mimeType);
                } catch (e) {
                    console.error('Could not create MediaRecorder:', e);
                    alert('Could not start recording. MediaRecorder not supported or failed to initialize.');
                    return false;
                }

                mediaRecorder.ondataavailable = async (event) => {
                    if (event.data.size > 0 && websocket && websocket.readyState === WebSocket.OPEN) {
                        try {
                            websocket.send(event.data);
                            console.log('Sent audio chunk, size:', event.data.size);
                        } catch (error) {
                            console.error('Error sending audio data:', error);
                        }
                    } else {
                        console.warn('WebSocket not ready or empty data. Size:', event.data.size, 'WebSocket state:', websocket?.readyState);
                    }
                };

                mediaRecorder.onstart = () => {
                    console.log('MediaRecorder started.');
                };

                mediaRecorder.onerror = (event) => {
                    console.error('MediaRecorder error:', event.error);
                };

                // Start opptak med 125 ms timeslice
                mediaRecorder.start(100);
                console.log('MediaRecorder started with 100ms timeslice');

                return true;
            } else {
                console.error('No audio streams available for recording.');
                alert('No audio streams available for recording.');
                return false;
            }

        } else {
            console.error('Could not start recording');
            return false;
        }
    } catch (error) {
        console.error('Error in initiateMediaRecording:', error);
        throw error;
    }
  }


  // Update UI
  function updateWebflowUI() {
    try {
        console.log('Updating UI with:', {
            finalTranscriptionLength: finalTranscriptionText.length,
            interimTranscriptionLength: interimTranscriptionText.length,
            suggestionsLength: suggestionsText.length,
            referatLength: referatText.length
        });

        const transcriptionElement = document.getElementById("par_transcription");
        if (transcriptionElement) {
            const content = finalTranscriptionText.trim() !== "" 
                ? finalTranscriptionText 
                : (transcriptionText.trim() !== "" 
                    ? transcriptionText 
                    : "Please wait for live transcription...");
            transcriptionElement.innerHTML = marked.parse(content) + "<div style='margin-bottom: 2rem'></div>";
            
            if (!userScrolling) {
                transcriptionElement.scrollTop = transcriptionElement.scrollHeight;
            }
        } else {
            console.warn('Transcription element not found');
        }

        const runElement = document.getElementById("par_run");
        if (runElement) {
            runElement.innerHTML = interimTranscriptionText ? 
                marked.parse(interimTranscriptionText) : 
                "Interim transcription has not started yet...";
        } else {
            console.warn('Run element not found');
        }

        const suggestionsElement = document.getElementById("par_suggestions");
        if (suggestionsElement) {
            suggestionsElement.innerHTML = suggestionsText ? 
                marked.parse(suggestionsText) : 
                "Feedback suggestions are updated at regular intervals, please wait...";
        }

        const summaryElement = document.getElementById("par_summary");
        if (summaryElement) {
            summaryElement.innerHTML = referatText ? 
                marked.parse(referatText) + "<br><br><br><br><br>" : 
                "";
        }

        // Update recording status buttons
        const startLink = document.getElementById("link_start");
        const stopLink = document.getElementById("link_stop");
        
        if (startLink) {
            startLink.style.pointerEvents = isRecording ? "none" : "auto";
            startLink.style.opacity = isRecording ? "0.3" : "1";
        }
        
        if (stopLink) {
            stopLink.style.pointerEvents = !isRecording ? "none" : "auto";
            stopLink.style.opacity = !isRecording ? "0.3" : "1";
        }
    } catch (error) {
        console.error('Error updating UI:', error);
    }
  }

  // Stop recording
  async function stopRecording() {
    if (!isRecording) return;
    
    isRecording = false;
    
    try {
        // 1. Stoppe MediaRecorder hvis den er aktiv
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            console.log('Stopping MediaRecorder...');
            mediaRecorder.stop();
            
            // Vente på at mediaRecorder stopper fullstendig
            await new Promise((resolve) => {
                mediaRecorder.onstop = () => {
                    console.log('MediaRecorder stopped.');
                    resolve();
                };
            });
        }
        
        // 2. Stopp alle aktive media streams
        if (activeStreams.length > 0) {
            console.log('Stopping all active media streams...');
            activeStreams.forEach(stream => {
                stream.getTracks().forEach(track => track.stop());
            });
            activeStreams = [];
            console.log('All media streams stopped.');
        }
        
        // 3. Send referat request og vent på respons
        console.log('Sending referat request...');
        await sendReferatRequest();
        console.log('Referat request completed.');

    } catch (error) {
        console.error('Error during stopRecording:', error);
    } finally {
        // 4. Lukke WebSocket etter at referat er mottatt, hvis ikke allerede lukket
        try {
            if (websocket && websocket.readyState === WebSocket.OPEN && !isWebSocketClosing) {
                console.log('Closing WebSocket connection...');
                isWebSocketClosing = true; // Sett flagget
                websocket.close();
                
                // Vente på at WebSocket lukkes
                await new Promise((resolve) => {
                    websocket.onclose = () => {
                        console.log('WebSocket connection closed.');
                        resolve();
                    };
                });
            }
        } catch (wsError) {
            console.error('Error closing WebSocket:', wsError);
        }
        
        // 5. Oppdatere UI knapper
        const startLink = document.getElementById("link_start");
        const stopLink = document.getElementById("link_stop");
        
        if (startLink) {
            startLink.style.pointerEvents = "auto";
            startLink.style.opacity = "1";
        }
        
        if (stopLink) {
            stopLink.style.pointerEvents = "none";
            stopLink.style.opacity = "0.3";
        }
        
        // Logge final transkripsjonslengde
        console.log(`Final transcription length: ${transcriptionText.length}`);
    }
  }

  // Update status
  async function updateStatus() {
    try {
      const response = await fetch(status_url);
      if (response.ok) {
        const data = await response.json();
        const status = data.status || "unknown";
        console.log(`Current system status: ${status}`);
        return status;
      } else {
        console.error("Failed to fetch status.");
        return "unknown";
      }
    } catch (e) {
      console.error(`Error fetching status: ${e}`);
      return "unknown";
    }
  }

  // Function to set up device lists
  async function setupDeviceLists() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      // Vi kan lagre enheter eller bruke dem direkte når det trengs
      window.availableAudioInputDevices = devices.filter(device => device.kind === 'audioinput');
      console.log('Available audio input devices:', window.availableAudioInputDevices);
    } catch (error) {
      console.error('Error getting audio devices:', error);
    }
  }

  // Check if the device is mobile (iOS or Android)
  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  // StartNewSession funksjon
  async function startNewSession() {
      console.log("Cloud limit reached. Continuing the same session.");

      // Lagre eksisterende transkripsjon
      const existingTranscription = finalTranscriptionText;

      // Stopp eksisterende MediaRecorder
      if (mediaRecorder) {
          if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
              await new Promise(resolve => {
                  mediaRecorder.onstop = () => {
                      console.log('MediaRecorder stopped.');
                      resolve();
                  };
              });
          }
          mediaRecorder = null;
      }

      // Rydd opp i gamle streams
      if (activeStreams.length > 0) {
          activeStreams.forEach(stream => {
              stream.getTracks().forEach(track => track.stop());
          });
          activeStreams = [];
      }

      // Lukke WebSocket
      if (websocket && websocket.readyState === WebSocket.OPEN) {
          console.log('Closing WebSocket connection...');
          isWebSocketClosing = true; // Sett flagget
          websocket.close();
          await new Promise((resolve) => {
              websocket.onclose = () => {
                  console.log('WebSocket closed successfully');
                  resolve();
              };
          });
      }

      // **IKKE** generer ny klient-ID
      // clientId = generateUUID(); // Kommentert ut

      // Initialize session with existing transcription
      const initializationSuccess = await initializeSession();
      if (!initializationSuccess) {
          console.error('Failed to initialize the session.');
          return;
      }

      console.log(`Continuing session with client ID: ${clientId}`);
      console.log(`Continuing with existing transcription length: ${existingTranscription.length}`);

      try {
          // Koble til WebSocket først
          await new Promise((resolve, reject) => {
              connectWebSocket(resolve, reject);
          });

          // Vent litt før vi starter nytt opptak
          await new Promise(resolve => setTimeout(resolve, 500));

          const success = await initiateMediaRecording();
          if (!success) {
              throw new Error('Failed to initiate media recording');
          }

          console.log('Session successfully continued');
      } catch (error) {
          console.error('Failed to continue session:', error);
          stopRecording();
      }
  }


  // Event listeners when the window loads
  window.onload = async () => {
    console.log('Window loaded');

    // Check if MediaRecorder is supported
    if (typeof MediaRecorder === 'undefined') {
      alert('Streaming is not supported in this browser. Please use Chrome or Firefox for full functionality.');
      return; // Stop the function if MediaRecorder is not supported
    }

    // Check if the desired MIME type is supported
    const mimeType = 'audio/webm;codecs=opus'; // Example of desired MIME type
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      alert(`The MIME type ${mimeType} is not supported in this browser. Please use a browser that supports this MIME type (Chrome or Firefox preferably).`);
      return; // Stop the function if the MIME type is not supported
    }

    // Handle Webflow Editor errors to prevent interference with custom scripts
    window.Webflow ||= [];
    window.Webflow.push = window.Webflow.push || function() {};
    window.Webflow.ready = function() {};
    window.Webflow.design = function() {};
    window.Webflow.preview = function() {};

    // If the device is a mobile device, show an error message and disable buttons
    if (isMobileDevice()) {
      alert("We are sorry, LYT MEETFLOW is not yet supported on this device. Please contact lob@lyt.no for more information.");

      // Deaktiver lenker
      const startLink = document.getElementById("link_start");
      const stopLink = document.getElementById("link_stop");
      if (startLink) {
        startLink.style.pointerEvents = "none";
        startLink.style.opacity = "0.5";
      }
      if (stopLink) {
        stopLink.style.pointerEvents = "none";
        stopLink.style.opacity = "0.5";
      }

      return; // Exit the function early for mobile
    }

    // Set up device lists (if needed)
    await setupDeviceLists();

    // Check user's plan and set configurations
    const activePlanType = await checkUserPlan();

    if (!activePlanType) {
      // Hvis ingen aktiv plan, deaktiver start-lenken
      const startLink = document.getElementById("link_start");
      if (startLink) {
        startLink.style.pointerEvents = "none";
        startLink.style.opacity = "0.5";
      }
    }

    // Update UI
    updateWebflowUI();

    // Legg til event listeners for lenkene
    const startLink = document.getElementById("link_start");
    const stopLink = document.getElementById("link_stop");
    if (startLink) {
      startLink.addEventListener("click", startRecording);
    }
    if (stopLink) {
      stopLink.addEventListener("click", stopRecording);
    }

    //const transcriptionElement = document.getElementById("par_transcription");
    if (transcriptionElement) {
        // Når brukeren begynner å scrolle
        transcriptionElement.addEventListener('scroll', () => {
            userScrolling = true;
            // Clear existing timeout
            clearTimeout(scrollTimeout);
            
            // Sett en ny timeout for å gjenoppta auto-scroll
            scrollTimeout = setTimeout(() => {
                userScrolling = false;
            }, 10000); // Gjenoppta auto-scroll etter 10 sekunder med inaktivitet
        });
    }

    // Legg til CSS for spinner-animasjonen (én gang)
    if (!document.querySelector('#spinner-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-style';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .summary-spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid rgba(0, 0, 0, 0.1);
                border-radius: 50%;
                border-top-color: #000;
                animation: spin 1s ease-in-out infinite;
                margin-right: 10px;
                vertical-align: middle;
            }
            .spinner-container {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 20px;
            }
        `;
        document.head.appendChild(style);
    }
  };
</script>
