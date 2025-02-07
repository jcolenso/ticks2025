const newroomController = function ($scope, $location, $window) {

  $window.document.title = "Ticks and Crosses";

  // Function to create a room
  const { createRoom } = require('./index');  // Import from index.js
 
  // Function to generate a random 3-character room code
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

  const roomDescription = "#TODO Description"


  // Create the room with the new code and description
  createRoom(roomCode, roomDescription);

  $scope.newroom = function() {
    $location.url('/' + roomCode + '/tutor');
  };
};

app.controller('newroom-controller', newroomController);
