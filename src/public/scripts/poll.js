const pollController = function($scope, $http, $routeParams, $window) {
  
  $scope.room = {
    room: $routeParams.room.toUpperCase(),
    learners: [],
  };

  $scope.statusCounts = {}; // Stores count of learners per status

  $window.document.title = "Poll - " + $scope.room.room;

  // Register as a tutor
  socket.emit('join-as-tutor', $routeParams.room);

  socket.on('refresh-tutor', function(data) {
    $scope.$applyAsync(function() {
      $scope.room = data;
      $scope.updateStatusCounts(); // Recalculate counts when learners update
    });
  });

  // Function to group learners by status
  $scope.updateStatusCounts = function() {
    const counts = {};
    
    $scope.room.learners.forEach(learner => {
      if (learner.status) {
        counts[learner.status] = (counts[learner.status] || 0) + 1;
      }
    });

    // Find the highest count inside the function
    let highestCount = 0;

    for (const status in counts) {
      if (counts[status] > highestCount) {
        highestCount = counts[status];
      }
    }

    // Store the results
    $scope.statusCounts = counts;
    $scope.highestCount = highestCount; // Save the highest count

  };


};

app.controller('poll-controller', pollController);

