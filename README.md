# WebRTC Vroom

video conference demo

# Usage

- `npm install` or `yarn`
- `node server.js`
  - tested in Node.js@20
- Open http://localhost:3000/index.html?room=default
- Open multiple browser windows to simulate users
  - Tested only in Chrome
- Works for connection in the same local network but requires insecure origin flag

## Insecure http origin as secure

- Open chrome://flags/#unsafely-treat-insecure-origin-as-secure
- Enable flag and restart browser
- Add IP of machine running server. Example http://192.168.0.7:3000
  - Port required

## Implementation

- Most basic
- Focus on making it work
- Filtering of socket messages on client side
- All clients have RTC connection to each other
  - Meaning total amount of connections is n(n-1)/2
- External public STUN server `stun:stun.l.google.com:19302`
- Main learning resource is https://github.com/MartinGer/WebRTC
  - But resulted implementation is even more basic for multi RTC connections
- No coordinator or main host
  - Each new client notifies everyone about
  - Each old client sends offer to the new one
