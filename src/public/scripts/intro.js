const introController = function ($scope, $location, $window) {
  $window.document.title = "Ticks and Crosses";
  $scope.room = {};

  $scope.learner = function() {
    $location.url('/' + $scope.room.code.toLowerCase());
  };

  $scope.tutor = function() {
    $location.url('/' + $scope.room.code.toLowerCase() + '/tutor');
  };
}

app.controller('intro-controller', introController);