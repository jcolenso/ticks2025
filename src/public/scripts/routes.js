app.config(function($routeProvider) {
  $routeProvider
  .when("/about", {
    templateUrl : "pages/about.html",
    caseInsensitiveMatch: true
  })
  .when("/api", {
    templateUrl : "pages/api.html",
    caseInsensitiveMatch: true
  })
  .when("/settings", {
    templateUrl : "pages/settings.html",
    controller: "settings",
    caseInsensitiveMatch: true
  })
  .when("/browser-check", {
    templateUrl : "pages/browser-check.html",
    controller: "browser-check",
    caseInsensitiveMatch: true
  })
  .when("/intro", {
    templateUrl : "pages/intro.html",
    controller: 'intro-controller',
    caseInsensitiveMatch: true
  })
  .when("/:room/tutor", {
    templateUrl : "pages/tutor.html",
    controller: "tutor-controller",
    caseInsensitiveMatch: true
  })
  .when("/:room/poll", {
    templateUrl : "pages/poll.html",
    controller: "poll-controller",
    caseInsensitiveMatch: true
  })
  .when("/:room", {
    templateUrl : "pages/learner.html",
    controller: "learner-controller",
    caseInsensitiveMatch: true
  })
  .otherwise({
    templateUrl : "pages/intro.html",
    controller: 'intro-controller',
  })

});