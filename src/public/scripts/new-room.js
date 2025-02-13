const newroomController = function ($scope, $location, $window) {
  $window.document.title = "Ticks and Crosses";
  $scope.room = {};

  $scope.learner = function() {
    $location.url('/' + $scope.room.code.toLowerCase());
  };

  // Tutor enters a room description
  const roomDesc = $scope.room.code;

  // Automatically generate a room code
  function generateRoomCode() {
    const letters = 'abcdefghijklmnopqrstuvwxyz'; // Letters to choose from
    const digits = '0123456789'; // Digits to choose from

    // Randomly choose a letter, a number, and another letter
    const randomCode = 
      letters.charAt(Math.floor(Math.random() * letters.length)) + // Random letter
      digits.charAt(Math.floor(Math.random() * digits.length)) + // Random digit
      letters.charAt(Math.floor(Math.random() * letters.length)); // Random letter

    return randomCode;
  }

  // Call the function to generate room code
  const roomCode = generateRoomCode();

  // Create the record in the database (db)
  // #TODO

  // Call the URL using the new room code
  $scope.tutor = function() {
    $location.url('/' + roomCode + '/tutor');
  };
}

app.controller('newroom-controller', newroomController);