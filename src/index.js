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
const logFileDb = path.join(__dirname,'../logs/db.json'); // Output the contents of the db
const logFile = path.join(__dirname, 'public/server.log'); // Log file in the root directory
debug(logFile);
debug(logFileDb);

// Set timeout values in minutes
const activeTimeoutInMinutes = 3;  // If no comms from learner for this long, grey them out
const removalTimeoutInMinutes = 5; // If no comms from learner for this long, delete them

// Initialise the database
const db = {};

// Special case: if ask for index.html, redirect to / (else looks like trying to join the room 'index.html'!)
app.get('/index.html', function (req, res) {
  res.redirect('/');
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
  debug(`Page not found: ${req.path}`);
  res.sendStatus(404);
});

// Cannot be a single character
app.get(/^\/.$/, function (req, res) {
  debug(`Forbidden [.]: ${req.path}`);
  res.sendStatus(403); // Block paths that are exactly 1 character long
});

// Define your API routes
app.get('/api/rooms', function (req, res) {
  debug(`API call: ${req.path}`);
  // Handle the request to get all rooms
  res.json(db);
  // Get the codes rooms
  //const roomCodes = Object.keys(db);
  //const roomCount = roomCodes.length;
  // Send the result as a JSON response
  //res.json(roomCount);
});

// For pages with letters and/or numbers return index.html
app.get(/^\/([A-Za-z0-9-]+(\/[A-Za-z0-9]+)*)?$/, function (req, res) {
  // Check if there are any query parameters
  if (Object.keys(req.query).length > 0) {
    debug(`Forbidden [?]: ${req.path} ~ ${JSON.stringify(req.query)}`); 
    return res.sendStatus(403);
  }
  // Send the index.html file (or other file) from the public folder
  debug(`URL: ${req.path}`);
  res.sendFile(path.join(__dirname, 'public/index.html'), {
    cacheControl: true,
    maxAge: 0,
    etag: false,
    lastModified: false
   });
});

// Block anything else (including special characters)
app.get('*', function (req, res) {
  debug(`Forbidden [*]: ${req.path}`);
  res.sendStatus(403); // Page Forbidden if it gets this far
});

function getRoom(code) {
  const createdDate = new Date()
  return db[code] || {
    code: code,
    description: "Room " + code.toUpperCase(),  // Default room description
    learners: {},
    createdDate: createdDate
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

// Used when sorting learners to show on Tutor screen
function compareLearners(a, b) {
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

io.on('connection', function(socket) {
  function associateSocketWithTutorRoom(roomCode) {
    socket.rooms.forEach(r => {
      socket.leave(r);
    });
    socket.join(`tutor-${roomCode.toLowerCase()}`);
  }

  function associateSocketWithLearnerRoom(roomCode) {
    socket.rooms.forEach(r => {
      socket.leave(r);
    });
    socket.join(roomCode.toLowerCase());    
  }

  function refreshTutor(roomCode) {
    roomCode = roomCode.toLowerCase();
    const room = getRoom(roomCode);
    const beep = room.beep;
    delete room.beep;
    tidyRoom(room);
    const learnersIncludingClient = Object.entries(room.learners).map(e => ({client: e[0], ...e[1]}));
    const data = {
      room: room.code,
      description: room.description,
      beep: beep,
      learners: learnersIncludingClient.filter(l => l.name).sort(compareLearners)
    };
    io.to(`tutor-${roomCode}`).emit('refresh-tutor', data);
    if (debug.enabled) {
      fs.writeFileSync(logFileDb, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
    }    
  }
  
  function refreshLearner(roomCode, client) {
    roomCode = roomCode.toLowerCase();
    const room = getRoom(roomCode);
    const learner = room.learners[client] || {};
    const data = {
      room: room.code,
      description: room.description,
      client: client,
      name: learner.name || "",
      status: learner.status || "",
      answer: learner.answer || ""
    };
    socket.emit('refresh-learner', data);
    if (debug.enabled) {
      fs.writeFileSync(logFileDb, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
    }    
  }

  socket.on('join-as-learner', (roomCode, client) => {
    roomCode = roomCode.toLowerCase();
    console.log(`[${new Date().toISOString()}] join-as-learner: ${roomCode} - ${client}`);
    associateSocketWithLearnerRoom(roomCode);
    refreshLearner(roomCode, client);
    refreshTutor(roomCode);
  });

  socket.on('join-as-tutor', (roomCode) => {
    roomCode = roomCode.toLowerCase();
    const logMessage = `[${new Date().toISOString()}] join-as-tutor: ${roomCode}\n`;
    console.log(`${logMessage}`);           // Log to console
    fs.appendFileSync(logFile, logMessage); // Log to file
    associateSocketWithTutorRoom(roomCode);
    refreshTutor(roomCode);
  });

  socket.on('ping-from-tutor', (roomCode) => {
    roomCode = roomCode.toLowerCase();
    debug(`ping-from-tutor: ${roomCode}`);
    associateSocketWithTutorRoom(roomCode);
    refreshTutor(roomCode);
  });

  socket.on('clear', (roomCode) => {
    roomCode = roomCode.toLowerCase();
    debug(`clear: ${roomCode}`);
    associateSocketWithTutorRoom(roomCode);
    const room = getRoom(roomCode);
    for (const client in room.learners) {
      const learner = room.learners[client];
      learner.status = "";
      learner.answer = "";
      learner.handUpRank = undefined;
    }
    saveRoom(room);
    io.to(roomCode).emit('clear');
    refreshTutor(roomCode);
  });

  socket.on('kick-learner', (roomCode, client) => {
    roomCode = roomCode.toLowerCase();
    debug(`reset-learner: ${roomCode} - ${client}`);
    associateSocketWithTutorRoom(roomCode);
    const room = getRoom(roomCode);
    delete room.learners[client];
    saveRoom(room);
    refreshTutor(roomCode);
  });

  socket.on('kick-all-learners', (roomCode) => {
    roomCode = roomCode.toLowerCase();
    debug(`reset-all-learners: ${roomCode}`);
    associateSocketWithTutorRoom(roomCode);
    const room = getRoom(roomCode);
    room.learners = { };
    saveRoom(room);
    refreshTutor(roomCode);
  });

  socket.on('status', (data) => {
    try {
      debug(`status: ${data.room} - ${data.name} ~ ${data.status} / ${data.answer}`);
      const { client, name, status, answer } = data;
      const roomCode = data.room.toLowerCase();
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
      if (answer != undefined) {
        learner.answer = answer;
      }
      learner.lastCommunication = new Date();
      room.learners[client] = learner;
      saveRoom(room);
      refreshTutor(roomCode);
    } catch (error) {
      const logMessage = `ERROR: socket.on(status - ${error}\n`;
      console.log(`[${new Date().toISOString()}] ${logMessage}`); // Log to console
      fs.appendFileSync(logFile, logMessage); // Log to console.log
      fs.appendFileSync(logFile, `${JSON.stringify(data, null, 2)}\n`);
    }
  });

  socket.on('ping-from-learner', (data) => {
    try {
      debug(`ping-from-learner: ${data.room} - ${data.name}`);
      const { client, name, status } = data;
      const roomCode = data.room.toLowerCase();
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
      console.log(`[${new Date().toISOString()}] ${logMessage}`); // Log to console
      fs.appendFileSync(logFile, logMessage); // Log to console.log
      fs.appendFileSync(logFile, `${JSON.stringify(data, null, 2)}\n`);
    }
  });
});

const port = process.env.PORT || 8080;
http.listen(port, () => {
  console.log(`[${new Date().toISOString()}] Server started on port ${port}`);
});
