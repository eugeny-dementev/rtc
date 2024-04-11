'use strict';

/**
 * Open peer.html?room=<room_name>
 */

const pcConfig = {
  iceServer: [{
    urls: 'stun:stun.l.google.com:19302',
  }],
};

const showIp = document.getElementById('showIP');

const localVideo = document.getElementById('localVideo');

const streamsContainer = document.getElementById('streams');

showIp.onclick = () => {
  fetch('/ip').then((response) => {
    response.text().then((text) => {
      console.log('ip response:', JSON.parse(text));
    })
  }).catch(console.error);
};

/*
{
  [from socket.id]: {
    tag: HTMLVideoElement,
    peer: RTCPeerConnection,
    isStarted: boolean,
  }
}
*/
const remotes = {};

let localStream;

const room = getRoomName();
const socket = io.connect();

setTimeout(() => {
  console.log('socket:', socket.id);

  socket.emit('create or join', room);
}, 200);

let roomExists = false;

socket.on('created', (room) => {
  console.log('on.created', 'room created:', room);
})

socket.on('join', (room) => {
  console.log('on.join', 'Another peer made a request to join room', room);
  roomExists = true;
});

socket.on('joined', (room) => {
  console.log('on.joined', 'room joined:', room)
  roomExists = true;
});

socket.on('drop-client', (from) => {
  const remote = remotes[from];

  if (!remote) console.log('No remote found for:', from);

  remote.tag.remove();
  remote.peer.close();

  delete remotes[from];

  console.log('Client disconected:', from);
});

function writeMessage(message) {
  console.log('writeMessage', 'Client sending message', message);
  socket.emit('message', message);
}

socket.on('message', filterMessages((message, ...args) => {
  console.log('on.message', 'Client received message', message, args);
  if (message.type === 'new') {
    setUpConnection(message);
  } else if (message.type === 'offer') {
    const peer = getSavedPeer(message)
    if (!peer) {
      setUpConnection(message);
    }
  } else if (message.type === 'answer' && isStarted(message)) {
    const peer = getSavedPeer(message);
    peer.setRemoteDescription(new RTCSessionDescription(message))
  } else if (message.type === 'candidate' && isStarted(message)) {
    const peer = getSavedPeer(message);
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });
    peer.addIceCandidate(candidate);
  }
}));

function isStarted(message) {
  const remote = remotes[message.from]
  if (remote) return remote.isStarted;

  return false;
}

function getSavedPeer(message) {
  const remote = remotes[message.from]
  if (remote) return remote.peer;

  return null;
}

function setUpConnection(message) {
  const { type, from } = message;

  if (type === 'new') {
    const peer = createPeerConnection(message);
    peer.addStream(localStream);
    remotes[from] = {
      peer,
      isStarted: true,
    };

    offerTo(from);
  }

  if (type === 'offer') {
    let peer = getSavedPeer(message);
    if (!peer) {
      peer = createPeerConnection(message);
      peer.addStream(localStream);
      remotes[from] = {
        peer,
        isStarted: true,
      };
    }
    peer.setRemoteDescription(new RTCSessionDescription(message))

    answerTo(from);
  }
}

function createPeerConnection({ from }) {
  let peer;
  try {
    peer = new RTCPeerConnection(pcConfig);
    peer.onicecandidate = findIceCandidate({ from });
    peer.ontrack = addRemoteVideo(from);

    return peer;
  } catch (e) {
    console.log('createPeerConnection', 'Failed to create peer connection', `${socket.id} <=> ${from}`)
    console.error(e);
  }
}

function findIceCandidate({ from }) {
  return (e) => {
    console.log('findIceCandidate', 'icecandidate event:', e);
    if (e.candidate) {
      writeMessage({
        type: 'candidate',
        from: socket.id,
        to: from,
        label: e.candidate.sdpMLineIndex,
        id: e.candidate.sdpMid,
        candidate: e.candidate.candidate,
      });
    } else {
      console.log('findIceCandidate', 'End of candidates');
    }
  }
}

function offerTo(from) {
  const peer = getSavedPeer({ from });
  peer.createOffer().then((offer) => {
    const enrichedOffer = Object.assign({}, { type: 'offer', to: from, from: socket.id }, resolveGetter(offer));
    console.log('offer to', from, enrichedOffer);
    setLocalAndSendMessage(from, enrichedOffer);
  })
}

function answerTo(from) {
  const peer = getSavedPeer({ from });
  peer.createAnswer().then((answer) => {
    const enrichedAnswer = Object.assign({}, { type: 'answer', to: from, from: socket.id }, resolveGetter(answer));
    console.log('answer to', from, enrichedAnswer);
    setLocalAndSendMessage(from, enrichedAnswer);
  })
}

function resolveGetter(sessionDescription) {
  return JSON.parse(JSON.stringify(sessionDescription))
}

function setLocalAndSendMessage(from, sessionDescription) {
  const peer = getSavedPeer({ from });

  peer.setLocalDescription(sessionDescription);

  console.log('setLocalAndSendMessage is set', sessionDescription);

  writeMessage(sessionDescription);
}

function addRemoteVideo(from) {
  console.log('addRemoteVideo', 'prepare ontrack callback');
  return function gotRemoteStream(e) {
    const stream = e.streams[0];
    console.log('gotRemoteStream', 'Remote stream added', stream);

    const video = document.createElement('video')
    video.autoplay = true;
    video.muted = true;
    video.srcObject = stream;

    console.log('gotRemoteStream', 'Add new remote vides stream to remotes array');
    remotes[from].tag = video;
    remotes[from].isStarted = true;

    console.log('gotRemoteStream', 'append video tag');
    streamsContainer.appendChild(video);
  }
}

navigator
  .mediaDevices
  .getUserMedia({
    audio: false,
    video: true
  })
  .then(handleSuccess)
  .catch(handleError)

function handleSuccess(stream) {
  console.log('handleSuccess', 'Adding local stream', stream);

  localVideo.srcObject = stream;
  localStream = stream;

  writeMessage({
    type: 'new',
    from: socket.id,
    to: 'all',
  });
}

function filterMessages(eventHandler) {
  return (message) => {
    validateMessage(message);

    if ([socket.id, 'all'].includes(message.to)) {
      eventHandler(message);
    }
  }
}

function validateMessage(message) {
  if (!message.type) {
    console.log('validation error:', message);
    throw new Error('message.type is missing');
  }
  if (!message.from) {
    console.log('validation error:', message);
    throw new Error('message.from is missing');
  }
  if (!message.to) {
    console.log('validation error:', message);
    throw new Error('message.to is missing');
  }
}

function handleError(error) {
  console.log('navigator.mediaDevices.getUserMedia error: ', error);
}

function getRoomName() {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  const name = urlParams.get('room')

  if (!name) throw new Error('Room name is not specified: ?room=name');

  return name;
}
