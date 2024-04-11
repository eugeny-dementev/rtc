const express = require('express')
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const cors = require('cors');
const serveStatic = require('serve-static');

const app = express()
const server = createServer(app);
const io = new Server(server);

app.use(cors())
app.use(serveStatic('.'));

app.get('/ip', (req, res) => {
  console.log('/ip:', req.ip);
  res.json({ ip: req.ip });
});

io.on('connection', (socket) => {
  console.log('user connected:', socket.id);

  socket.on('message', (message) => {
    // console.log('message received:', typeof message === 'string' ? message : message.type);
    console.log('message:', message)
    socket.broadcast.emit('message', message)
  });

  socket.on('create or join', (room) => {
    const clientsNum = io.sockets.sockets.size;

    console.log('create or join, client length', clientsNum)

    if (clientsNum === 1) {
      console.log('first client joined the room', room);
      socket.join(room);
      socket.emit('created', room, socket.id)
    } else {
      console.log('guest client joined the room', room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnect:', socket.id, socket);
    io.sockets.emit('drop-client', socket.id);
  });
})

const PORT = 3000;
server.listen(PORT, () => {
  console.log('Server lanuched on', PORT);
})
