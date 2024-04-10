const express = require('express')
const video = express.Router()
const ss = require('socket.io-stream')
const fs = require('fs')
const path = require('path')

module.exports = (io) => {
  video.post('/video', (req, res) => {
    io.on('connection', (socket) => {
      ss(socket).on('video', (stream, data) => {
        const fileName = path.basename('test')
        stream.pipe(fs.createWriteStream(fileName))
      })
    })
  })
  return video
}
