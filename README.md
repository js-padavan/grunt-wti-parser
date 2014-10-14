# grunt-wti-parser

> Grunt task for simplification adding of translations

## Getting Started
This plugin requires Grunt `~0.4.5`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-wti-parser --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-wti-parser');
```

## The "wtiParser" task

### Overview
In your project's Gruntfile, add a section named `wtiParser` to the data object passed into `grunt.initConfig()`.

```js
  grunt.initConfig({
    wtiParser: {
      views: {
        options: {
          prefix: '{{ $root.',
          postfix: ' }}',
          apiKey: 'your_api_key',
          re: /\[\[(.+?)\]\]/g 
        },
    
        files: [
          {
            expand: true,
            cwd: 'test/fixtures',
            src: ['*.html'],
            dest: 'test/translated'
          }
        ]
      }
    }
  });
```

### Options

#### options.apiKey
Type: `String`
Default value: `',  '`

WebTranslateIn api key.

#### options.prefix
Type: `String`
Default value: `{{ $root.`

Prefix witch will be added to instead parsed string. Instead [[привет мир]] using expressing ```js options.prefix + file.prefix + '.' + input + options.postfix ``` will be replaced to ```js {{ $root.common.welcome }} ```

#### options.postfix
Type: `String`
Default value: ` }}.`

Postfix witch will be added to instead parsed string. Instead [[привет мир]] using expressing ```js options.prefix + file.prefix + '.' + input + options.postfix ``` will be replaced to ```js {{ $root.common.welcome }} ```

#### options.re
Type: `RegExp`
Default value: `/\[\[(.+?)\]\]/g.`

Regular expression which will be used for detection placeholders.

### Usage Examples

#### Default Options
In this example, throw all file we are looking for [[placeholders]], add it to WebTranslateIt and replace it in file for suitable placeholder
[[привет мир]] -> ```js {{ $root.i18n.common.welcome }} ``` 

```js
  grunt.initConfig({
    wtiParser: {
      views: {
        options: {
          prefix: '{{ $root.i18n',
          postfix: ' }}',
          apiKey: 'your_api_key',
          re: /\[\[(.+?)\]\]/g 
        },
    
        files: [
          {
            expand: true,
            cwd: 'test/fixtures',
            src: ['*.html'],
            dest: 'test/translated'
          }
        ]
      }
    }
  });
```


## The "wtiAddSegment" task

### Overview
Easy way fir inputting segments to WebTranslateIt. Program ask to which file add new segment, ask segment key and translation

```js
  grunt.initConfig({
     wtiAddSegment: {
        add: {
          options: {
            apiKey: 'your_api_key',
            translationLocale: 'ru'
          }
        }
      }
  });
```

### Options

#### options.apiKey
Type: `String`
Default value: `',  '`

WebTranslateIn api key.

#### options.translationLocale
Type: `String`
Default value: `ru`

Main locale in your webTranslateIt project



## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_
