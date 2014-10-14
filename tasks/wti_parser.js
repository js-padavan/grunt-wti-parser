/*
 * grunt-wti-parser
 * https://github.com/sloot14/grunt-wti-parser
 *
 * Copyright (c) 2014 sloot
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks
  var JSON = require('JSON'),
    najax = require('najax'),
    readline = require('readline'),
    q = require('q'),
    _ = require('lodash');


  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });


  function wtiGetFiles(options, result) {
    najax({
      contentType: 'json',
      url: 'https://webtranslateit.com/api/projects/' + options.apiKey + '.json',
      type: 'GET'
    }).success(function (res) {
      res = JSON.parse(res);
      result(res && res.project && res.project.project_files);
    }).error(function (res) {
      grunt.log.writeln(res);
    });
  }

  function enterSegments(file, options, name, translate) {
    var defer = q.defer();

    function askName() {
      rl.question('Enter key: ', askTranslate);
    }

    function askTranslate(name) {
      rl.question('Enter translation: ', function (translate) {
        sendRequest(name, translate);
      });
    }

    function sendRequest(name, translate) {
      console.log('name, translate', name, translate);
      var data = {
        'key': name,
        'plural': false,
        'type': 'String',
        'dev_comment': null,
        'status': 'Current',
        'labels': '',
        'file': {
          'file_name': file.name
        },
        'translations': [
          {
            'text': translate,
            'locale': file.locale_code
          }
        ]
      };

      najax({
        contentType: 'json',
        url: 'https://webtranslateit.com/api/projects/' + options.apiKey + '/strings',
        type: 'POST',
        data: data
      }).success(function (res) {
        grunt.log.writeln('Key "' + name + '" with translation "' + translate + '" was added');
        //askName();
        defer.resolve(res);
      }).error(function (res) {
        grunt.log.writeln('Error: Key "' + name + '" with translation "' + translate + '" was\'t added');
        //askName();
        defer.resolve(res);
      });
    }

    if (_.isUndefined(name) && _.isUndefined(translate)) {
      askName();
    } else if (_.isUndefined(translate)) {
      askTranslate(name);
    } else {
      sendRequest(name, translate);
    }

    return defer.promise;
  }

  function proceedFiles(callback, projectFiles) {
    var mainFiles = _.filter(projectFiles, function (file) {
      return file && _.isNull(file.master_project_file_id);
    });
    if (mainFiles.length === 0) {
      grunt.log.writeln('You should create at least one file');
    } else if (mainFiles.length === 1) {
      callback(mainFiles[0]);
    } else {
      mainFiles.forEach(function (file, i) {
        grunt.log.writeln((i + 1) + ') id: ' + file.id + ', name: ' + file.name + ', locale: ' + file.locale_code);
      });
      rl.question('Choose file: ', function (i) {
        callback(mainFiles[i - 1]);
      });
    }
  }

  grunt.registerMultiTask('wtiParser', 'Grunt task for simplification adding of translations', function () {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
        prefix: '{{ $root.i18n.',
        postfix: ' }}',
        apiKey: '',
        re: /\[\[(.+?)\]\]/gi // find [[placeholders]] in text,
      }),
      prev = this.async(),
      file;


    function replaceHolders(content, dest, callback) {
        function placeholderFactory(value, key, prev) {
          return function () {
            rl.question('Enter key for "' + value + '": ', function (input) {
              content = content.replace(value, options.prefix + file.prefix + '.' + input + options.postfix);

              enterSegments(file, options, input, key.trim()).then(function (){
                prev && prev();
              });
            });
          };
        }

        var res = options.re.exec(content),
          placeholders = [],
          prev = function () {
            // Print a success message.
            grunt.file.write(dest, content);
            grunt.log.writeln('File "' + dest + '" created.');
            callback();
          };

        while (res) {
          prev = placeholderFactory(res[0], res[1], prev);
          placeholders.push(prev);
          res = options.re.exec(content);
        }

        return prev;

    }

    // Iterate over all specified file groups.
    this.files.forEach(function (f) {
      // Concat specified files.
      f.src.filter(function (filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (grunt.file.exists(filepath)) {
          return true;
        } else {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        }
      }).forEach(function (filepath) {
        // Read file source.
        prev = replaceHolders(grunt.file.read(filepath), f.dest, prev);
      });
    });

    wtiGetFiles(options, proceedFiles.bind(null, function (_file_){
      file = _file_;
      if (file) {
        rl.question('Enter javascript prefix for file "' + file.name + '": ', function (input) {
          file.prefix = input;
          prev();
        });
      } else {
        grunt.log.writeln('In your project no files or you use wrong API key');
      }
    }));

  });
  grunt.registerMultiTask('wtiAddSegment', 'Grunt task for simplification adding of translations', function () {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
        apiKey: '',
        translationLocale: 'ru'
      });

    this.async();
    wtiGetFiles(options, proceedFiles.bind(null, function (file){
      function wtiAddSegment(){
        enterSegments(file, options).then(wtiAddSegment);
      }
      wtiAddSegment();
    }));
  });

};
