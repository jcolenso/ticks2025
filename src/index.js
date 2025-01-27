const path = require('path');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
app.use(express.json());

// Setup debug
const debug = require('debug')('ticks');
debug('DEBUG=ticks is set');

// Write to a file that can be read from the browser
const fs = require('fs');
const logFile = path.join(__dirname, 'server.log'); // Log file in the root directory

// Set timeout values in minutes
const activeTimeoutInMinutes = 3;  // If no comms from learner for this long, grey them out
const removalTimeoutInMinutes = 5; // If no comms from learner for this long, delete them

// Initialise the database
const db = {};

// Special case: if ask for index.html, redirect to / (else looks like trying to join the room 'index.html'!)
app.get('/index.html', function (req, res) {
  res.redirect('/');
});

// Serve the server log as plain text in the browser
app.get('/server.log', (req, res) => {
  const logFile = path.join(__dirname, 'server.log'); // Adjust the filename if different
  fs.readFile(logFile, 'utf8', (err, data) => {
      if (err) {
          res.status(500).send('Error reading log file');
          return;
      }
      res.type('text/plain').send(data); // Display logs as plain text
  });
});

// If requested static file is found, return it (no caching)
app.use('/', express.static(path.join(__dirname, 'public'), {
  index: false,
  cacheControl: true,
  maxAge: 0,
  etag: false,
  lastModified: false,
  redirect: false,
  dotfiles: "deny"
}));

// If request looks like an unfound file, i.e. contains a dot, then return 404 page not found
app.get('*.*', function (req, res) {
  res.sendStatus(404).end();
});

// For every other request, need to return index.html (no caching)
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/index.html'), {
    cacheControl: true,
    maxAge: 0,
    etag: false,
    lastModified: false
   });
});

function getRoom(code) {
  return db[code] || {
    code: code,
    learners: {}
  };
}

function saveRoom(room) {
  db[room.code] = room;
}

function tidyRoom(room) {
  for (const client in room.learners) {
    const learner = room.learners[client];
    const minutesSinceLastCommunication = Math.trunc((new Date() - learner.lastCommunication) / 1000 / 60);
    if (minutesSinceLastCommunication >= removalTimeoutInMinutes) {
      debug(`tidy room: delete - ${learner.name}`);
      delete room.learners[client];
    } else {
      learner.isActive = (minutesSinceLastCommunication < activeTimeoutInMinutes);
    }
  };
  saveRoom(room);
}

function compareLearners(a, b) {
  // if (a.isActive != b.isActive) {
  //   return a.isActive? -1  : +1;
  // }
  if (a.name.toLowerCase() != b.name.toLowerCase()) {
    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : +1;
  } else {
    return 0;
  }
}

io.on('connection', function(socket) {
  function associateSocketWithTutorRoom(roomCode) {
    socket.rooms.forEach(r => {
      socket.leave(r);
    });
    socket.join(`tutor-${roomCode.toUpperCase()}`);
  }

  function associateSocketWithLearnerRoom(roomCode) {
    socket.rooms.forEach(r => {
      socket.leave(r);
    });
    socket.join(roomCode.toUpperCase());    
  }

  function refreshTutor(roomCode) {
    roomCode = roomCode.toUpperCase();
    const room = getRoom(roomCode);
    const beep = room.beep;
    delete room.beep;
    tidyRoom(room);
    const learnersIncludingClient = Object.entries(room.learners).map(e => ({client: e[0], ...e[1]}));
    const data = {
      room: room.code,
      beep: beep,
      learners: learnersIncludingClient.filter(l => l.name).sort(compareLearners)
    };
    io.to(`tutor-${roomCode}`).emit('refresh-tutor', data);
    if (data.beep) {
      debug(`beep: ${roomCode}`);
    }
  }
  
  function refreshLearner(roomCode, client) {
    roomCode = roomCode.toUpperCase(); // ADDED
    const room = getRoom(roomCode);
    const learner = room.learners[client] || {};
    const data = {
      room: room.code,
      client: client,
      name: learner.name || "",
      status: learner.status || ""
    };
    socket.emit('refresh-learner', data);
  }

  socket.on('join-as-learner', (roomCode, client) => {
    roomCode = roomCode.toUpperCase();
    console.log(`[${new Date().toISOString()}] join-as-learner: ${roomCode} - ${client}`);
    associateSocketWithLearnerRoom(roomCode);
    refreshLearner(roomCode, client);
    refreshTutor(roomCode);
  });

  socket.on('join-as-tutor', (roomCode) => {
    roomCode = roomCode.toUpperCase();
    const logMessage = `[${new Date().toISOString()}] join-as-tutor: ${roomCode}\n`;
    console.log(logMessage); // Log to console
    fs.appendFileSync(logFile, logMessage); // Log to file
    associateSocketWithTutorRoom(roomCode);
    refreshTutor(roomCode);
  });

  socket.on('ping-from-tutor', (roomCode) => {
    roomCode = roomCode.toUpperCase(); // ADDED
    debug(`ping-from-tutor: ${roomCode}`);

    debug(`Current DB State: ${JSON.stringify(db, null, 2)}`);    

    associateSocketWithTutorRoom(roomCode);
    refreshTutor(roomCode);
  });

  socket.on('clear', (roomCode) => {
    roomCode = roomCode.toUpperCase(); // ADDED
    debug(`clear: ${roomCode}`);
    associateSocketWithTutorRoom(roomCode);
    const room = getRoom(roomCode);
    for (const client in room.learners) {
      const learner = room.learners[client];
      learner.status = "";
      learner.handUpRank = undefined;
    }
    saveRoom(room);
    io.to(roomCode).emit('clear');
    refreshTutor(roomCode);
  });

  socket.on('kick-learner', (roomCode, client) => {
    roomCode = roomCode.toUpperCase(); // ADDED
    debug(`kick-learner: ${roomCode} - ${client}`);
    associateSocketWithTutorRoom(roomCode);
    const room = getRoom(roomCode);
    delete room.learners[client];
    saveRoom(room);
    refreshTutor(roomCode);
  });

  socket.on('kick-all-learners', (roomCode) => {
    roomCode = roomCode.toUpperCase(); // ADDED
    debug(`kick-all-learners: ${roomCode}`);
    console.log(`[${new Date().toISOString()}] kick-all-learners: ${roomCode}`);
    associateSocketWithTutorRoom(roomCode);
    const room = getRoom(roomCode);
    room.learners = { };
    saveRoom(room);
    refreshTutor(roomCode);
  });

  socket.on('status', (data) => {
    try {
      debug(`status: ${data.room} - ${data.name} ~ ${data.status}`);
      const { client, name, status } = data;
      const roomCode = data.room.toUpperCase(); // ADDED
      associateSocketWithLearnerRoom(roomCode);
      const room = getRoom(roomCode);
      const learner = room.learners[client] || {};
      if (name != undefined) {
        learner.name = name;
      }
      if (status != undefined) {
        const oldStatus = learner.status;
        learner.status = status;
        if (learner.status == 'hand-up') {
          if (learner.status != oldStatus) {
            // If hand was already up, just leave everything alone
            // Else for new hand up, decide the rank number to show next to it
            const existingRanks = Object.values(room.learners).map(lnr => lnr.handUpRank || 0);
            if (existingRanks.length == 0) {
              learner.handUpRank = 1;
            } else {
              const maxExistingRank = Math.max(...existingRanks);
              learner.handUpRank = maxExistingRank + 1;
            }
            room.beep = true;
          }
        } else {
          learner.handUpRank = undefined;
        }
      }
      learner.lastCommunication = new Date();
      room.learners[client] = learner;
      saveRoom(room);
      refreshTutor(roomCode);
    } catch (error) {
      const logMessage = `ERROR: socket.on(status - ${error}\n`;
      console.log(logMessage); // Log to console
      fs.appendFileSync(logFile, logMessage); // Log to console.log
      fs.appendFileSync(logFile, `${JSON.stringify(data, null, 2)}\n`);
    }
  });

  socket.on('ping-from-learner', (data) => {
    try {
      debug(`ping-from-learner: ${data.room} - ${data.name}`);
      const { client, name, status } = data;
      const roomCode = data.room.toUpperCase(); // ADDED
      associateSocketWithLearnerRoom(roomCode);
      const room = getRoom(roomCode);
      const learner = room.learners[client] || {};
      if (name != undefined) {
        learner.name = name;
      }
      learner.lastCommunication = new Date();
      room.learners[client] = learner;
      saveRoom(room);
      refreshTutor(roomCode);
      refreshLearner(roomCode, client);
    } catch (error) {
      const logMessage = `ERROR: socket.on('ping-from-learner - ${error}\n`;
      console.log(logMessage); // Log to console
      fs.appendFileSync(logFile, logMessage); // Log to console.log
      fs.appendFileSync(logFile, `${JSON.stringify(data, null, 2)}\n`);
    }
  });
});

const port = process.env.PORT || 8080;
http.listen(port, () => {
  console.log(`[${new Date().toISOString()}] Server started on port ${port}`);
});
