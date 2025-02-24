const learnerController = function($scope, $http, $routeParams, $localStorage, $sessionStorage, $interval, $timeout, $window, $document) {

  const pingIntervalInMilliseconds = 1 * 60 * 1000; // 1 minute

  $scope.timeMessage = "";

  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getStorage() {
    return $localStorage.useSession ? $sessionStorage : $localStorage;
  }

  function getClient() {
    const storage = getStorage();
    if (storage.client == undefined) {
      storage.client = uuidv4();
    }
    return storage.client;
  }

  function submitStatus() {
    const data = {
      client: getClient(),
      room: $routeParams.room.toLowerCase(),
      name: $scope.learner.name,
      status: $scope.learner.status,
      answer: $scope.learner.answer || ""
    };
    // $scope.timeMessage = $scope.learner.status; // Show status name
    socket.emit('status', data);
  }

  function submitAnswer() {
    const data = {
      client: getClient(),
      room: $routeParams.room.toLowerCase(),
      name: $scope.learner.name,
      answer: $scope.learner.answer || ""
    };
    socket.emit('status', data);
  }

  function submitName() {
    const data = {
      client: getClient(),
      room: $routeParams.room.toLowerCase(),
      name: $scope.learner.name
    };
    socket.emit('status', data);
  }

  $scope.send = function(status) {
    $scope.learner.status = status;
    if (status === "") {
      $scope.learner.answer = "";
    }
    submitStatus();
  }

  function setTitle() {
    $window.document.title = ($scope.learner.name || "Learner")  + " - " + $scope.room.code.toUpperCase();
  }

  // Learner changes their name ~ submit after 500 milliseconds
  let delay = undefined;

  $scope.nameChanged = function() {
    setTitle();
    getStorage().name = $scope.learner.name;
    if (delay) {
      $timeout.cancel(delay);
    }
    delay = $timeout(submitName, 500);
  }

  // Learner enters an answer
  let answerDelay = undefined;

  $scope.answerChanged = function() {
    $scope.learner.answer = $scope.learner.answer.replace(/[^a-zA-Z0-9. ]/g, '').trim();
    getStorage().answer = $scope.learner.answer;
    if (answerDelay) {
      $timeout.cancel(answerDelay);
    }
    answerDelay = $timeout(submitAnswer, 2000); // 2 seconds delay
  };
  
  $scope.room = {
    code: $routeParams.room
  };

  $scope.learner = {
    name: getStorage().name || "",
    status: "",
    answer: ""
  };

  socket.on('clear', function() {
    $scope.$applyAsync(function() {
      $scope.learner.status = "";
      $scope.learner.answer = ""
    });
  });

  socket.on('refresh-learner', function (data) {
    $scope.$applyAsync(function() {
      $scope.room.code = data.room;
      $scope.room.description = data.description;
      $scope.learner.name = data.name || $scope.learner.name || "";
      $scope.learner.status = data.status || "";
      $scope.learner.answer = data.answer || "";
      //submitName();
      setTitle();
    });
  });

  function sendPing() {
    const data = {
      client: getClient(),
      room: $routeParams.room.toLowerCase(),
      name: $scope.learner.name
    };
    socket.emit('ping-from-learner', data);
  }

  let pingTimer = $interval(sendPing, pingIntervalInMilliseconds);

  function onVisibilityChange() {
    if (!$document[0].hidden) {
      sendPing();
    }
  }

  // When user comes back to this page in browser, send in case connection lost in meantime
  $document[0].addEventListener('visibilitychange', onVisibilityChange);

  $scope.$on('$destroy', function() {
    socket.off('refresh-learner');
    socket.off('clear');
    $document[0].removeEventListener('visibilitychange', onVisibilityChange);
    if (delay) {
      $timeout.cancel(delay);
      delay = undefined;
    }
    if (pingTimer) {
      $interval.cancel(pingTimer);
      pingTimer = undefined;
    }
  });

  // In event of F5 refresh, or re-opening this page
  // re-synchronise with the server's view...
  const roomCode = $routeParams.room;
  const client = getClient();
  socket.emit('join-as-learner', roomCode, client);
  setTitle();  
};

app.controller('learner-controller', learnerController);