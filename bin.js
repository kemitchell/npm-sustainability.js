#!/usr/bin/env node
var docopt = require('docopt')

var USAGE = [
  'Collect sustainability data for your npm dependencies.',
  '',
  'Usage:',
  '  npm-sustainability [options]',
  '',
  'Options:',
  '  --production          Do not check devDependencies.',
  '  --ndjson              Print newline-delimited JSON objects.',
  '  -h, --help            Print this screen to standard output.',
  '  -v, --version         Print version to standard output.'
].join('\n')

var options = docopt.docopt(USAGE, {
  version: require('./package.json').version
})

var cwd = process.cwd()
var configuration = { productionOnly: options['--production'] }
require('./')(configuration, cwd, function (error, projects, errors) {
  if (error) {
    process.stderr.write(error.message + '\n')
    process.exit(1)
  } else {
    var ndjson = !!options['--ndjson']
    projects.forEach(function (project) {
      print(project, ndjson)
    })
    errors.forEach(function (uri) {
      process.sterr.write('Error: ' + uri + '\n')
    })
    process.exit(0)
  }
})

function print (data, ndjson) {
  if (ndjson) {
    process.stdout.write(JSON.stringify(data) + '\n')
  } else {
    process.stdout.write(data.project + ':\n')
    var firstProperties = [
      'name', 'type', 'homepage', 'updated'
    ]
    process.stdout.write(
      data.contributors
        .map(function (contributor) {
          return (
            '- ' +
            []
              .concat(firstProperties.map(function (key) {
                return contributor[key]
              }))
              .concat()
              .join('\n  ')
          )
        })
        .join('\n\n') +
      '\n'
    )
  }
}
