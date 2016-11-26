//jshint strict: false
module.exports = function(config) {
  config.set({

    basePath: './app',

    files: [
      '../thirdparty/angular/angular.js',
      '../thirdparty/angular-ui-router/release/angular-ui-router.js',
      '../thirdparty/angular-mocks/angular-mocks.js',
      '../thirdparty/angular-touch/angular-touch.js',
      '../thirdparty/dirPagination/dirPagination.js',
      '../thirdparty/requirejs/require.js',
      '*.js',
      'meta/**/*.js',
      'services/**/*.js',
      'util/**/*.js',
      '../scripts/*.js'
    ],

    autoWatch: true,

    frameworks: ['jasmine'],

    browsers: ['Chrome'],

    plugins: [
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-jasmine'
    ]
  });
};
