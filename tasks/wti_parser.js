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
    path = require('path'),
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
      var data = {
        'key': name.trim(),
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
            'text': translate.trim(),
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

  function getAlreadyExistedTranslations(files, options) {
    var queue = [];
    var files = _.chain(files).filter({"master_project_file_id": null}).pluck('name').value();
    _.each(files, function(file) {
      queue.push(
        najax({
          contentType: 'json',
          url: 'https://webtranslateit.com/api/projects/' + options.apiKey + '/files/...?file_path=' + file,
          type: 'GET'
        })
        .error(function (res) {
          grunt.log.writeln('Error: downloading translation file:' + file);
        })
      );
    })


    return q.all(queue).then(function(responses) {
      var locales = {};
      _.each(responses, function(res, index) {
        var obj = JSON.parse(res);
        locales[files[index]] =  {
          values: _.values(obj),
          keys: _.keys(obj),
        }
      })
      return locales;
    });
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
      baseLocale,
      newLocalesNumber = 0,
      file;

    var locales;
    wtiGetFiles(options, function(segmentFiles) {
      baseLocale = _.find(segmentFiles, {"master_project_file_id": null}).locale_code;
      console.log('Loading existed locales');
      getAlreadyExistedTranslations(segmentFiles, options).then(function(existedLocales) {
        console.log('looking for translation items')
        prepareTranslations(existedLocales, this.files);
        if (newLocalesNumber) {
          saveTranslations(segmentFiles);
        } else {
          prev();
        }
      }.bind(this))
    }.bind(this))


    function replaceHolders(content, dest, existedLocales,  callback) {
      // checking if such key already in use
      function checkUniqueness(inputKey) {
        var defered = q.defer();
        function validate(input) {
          if (existedLocales[file.name].keys.indexOf(input) !== -1 ) {
            rl.question('Such key alredy in use. Please enter another key', function(input) {
              validate(input);
            })
          } else {
            defered.resolve(input);
          }
        }
        validate(inputKey);
        return defered.promise;
      }


      function placeholderFactory(value, key, prev) {
        return function () {
          var exists = false;
          var existsIn = [];
          // checking if such locale already exists
          _.each(existedLocales, function(localeFile, index) {
            var valueIndex = localeFile.values.indexOf(key);
            if (valueIndex != -1) {
              existsIn.push({path: index + "::" + localeFile.keys[valueIndex], key: localeFile.keys[valueIndex], file: index});
              exists = true;
            }
          })

          if (exists) {
            grunt.log.writeln('locale "' + key +  '" already exists in ' + existsIn.length + ' files:')
            existsIn.forEach(function (file, i) {
              grunt.log.writeln((i + 1) + ') file: ' + file.path);
            });
            rl.question('Choose file or enter new key: ', function (input) {
              var index = parseInt(input);
              if (index != index) {
                checkUniqueness(input).then(function(localeKey) {
                  content = content.replace(value, options.prefix + (file.prefix ?  file.prefix + '.' : '') + localeKey + options.postfix);
                  enterSegments(file, options, localeKey, key.trim()).then(function (){
                    existedLocales[file.name].values.push(key);
                    existedLocales[file.name].keys.push(localeKey);
                    prev && prev();
                  });
                })
              } else {
                var filePrefix = path.basename(existsIn[index - 1].file, '.' + baseLocale + '.json');
                content = content.replace(value, options.prefix + filePrefix + '.' + existsIn[index-1].key + options.postfix);
                console.log('Locale ' + existsIn[index-1].path + ' was used for this item');
                prev();
              }
            });

          } else {
            rl.question('Enter key for "' + value + '": ', function (input) {
              checkUniqueness(input).then(function(localeKey) {
                content = content.replace(value, options.prefix + (file.prefix ?  file.prefix + '.' : '') + localeKey + options.postfix);
                enterSegments(file, options, localeKey, key.trim()).then(function (){
                  existedLocales[file.name].values.push(key);
                  existedLocales[file.name].keys.push(localeKey);
                  prev && prev();
                });
              })
            });
          }
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
        newLocalesNumber++;
        prev = placeholderFactory(res[0], res[1], prev);
        placeholders.push(prev);
        res = options.re.exec(content);
      }

      return prev;

    }


    function prepareTranslations(existedLocales, files) {
      // Iterate over all specified file groups.
      files.forEach(function (f) {
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
          prev = replaceHolders(grunt.file.read(filepath), f.dest, existedLocales, prev);
        });
      });
    }

    function saveTranslations(files) {
      proceedFiles(function (_file_){
        file = _file_;
        var re = /(\w+)\.\w+\.json$/,
          exec = re.exec(file.name);
        if (file) {
          if (exec && exec[1]) {
            file.prefix = exec[1];
            prev();
          } else {
            grunt.log.writeln('Wrong file name in WTI, file name should be named by follow pattern "name.locale.json". Example "landing.en.json". RegExp: /(\w+)\.\w+\.json$/');
          }
        } else {
          grunt.log.writeln('In your project no files or you use wrong API key');
        }
      }, files)
    }

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
