var getSustainability = require('get-sustainability')
var parseJSON = require('json-parse-errback')
var readPackageTree = require('read-package-tree')
var runParallel = require('run-parallel')
var runSeries = require('run-series')
var simpleConcat = require('simple-concat')
var spawn = require('child_process').spawn

module.exports = function (configuration, path, callback) {
  if (configuration.productionOnly) {
    // In order to ignore devDependencies, we need to read:
    //
    // 1. the dependencies-only dependency graph, from
    //    `npm ls --json --production`
    //
    // 2. the structure of `node_modules` and `package.json`
    //    files within it, with read-package-tree.
    //
    // `npm ls` calls read-package-tree internally, but does
    // lots of npm-specific post-processing to produce the
    // dependency tree.  Calling read-package-tree twice, at
    // the same time, is far from efficient.  But it works,
    // and doing so helps keep this package small.
    runParallel({
      dependencies: readDependencyList,
      packages: readFilesystemTree
    }, function (error, trees) {
      if (error) callback(error)
      else withTrees(trees.packages, trees.dependencies)
    })
  } else {
    // If we are analyzing _all_ installed dependencies,
    // and don't care whether they're devDependencies
    // or not, just read `node_modules`.  We don't need
    // the dependency graph.
    readFilesystemTree(function (error, packages) {
      if (error) callback(error)
      else withTrees(packages, false)
    })
  }

  function withTrees (packages, dependencies) {
    var results = recurse(
      configuration, packages, dependencies, []
    )
    var projects = []
    var errors = []
    runSeries(results.map(function (result) {
      return function (done) {
        if (!result.sustainability) return done()
        var uri = result.sustainability
        getSustainability({ uri: uri }, function (error, project) {
          if (error) errors.push(uri)
          else addProjectToList(projects, project)
          return done()
        })
      }
    }), function (error) {
      if (error) return callback(error)
      callback(null, projects, errors)
    })
  }

  function readDependencyList (done) {
    var child = spawn(
      'npm', ['ls', '--production', '--json'], { cwd: path }
    )
    var outputError
    var json
    simpleConcat(child.stdout, function (error, buffer) {
      if (error) outputError = error
      else json = buffer
    })
    child.once('close', function (code) {
      if (code !== 0) {
        done(new Error('npm exited with status ' + code))
      } else if (outputError) {
        done(outputError)
      } else {
        parseJSON(json, function (error, graph) {
          if (error) return done(error)
          if (!graph.hasOwnProperty('dependencies')) {
            done(new Error('cannot interpret npm ls --json output'))
          } else {
            var flattened = {}
            flattenDependencyTree(graph.dependencies, flattened)
            done(null, flattened)
          }
        })
      }
    })
  }

  function readFilesystemTree (done) {
    readPackageTree(path, function (error, tree) {
      if (error) return done(error)
      done(null, tree.children)
    })
  }
}

var KEY_PREFIX = '.'

function flattenDependencyTree (graph, object) {
  Object.keys(graph).forEach(function (name) {
    var node = graph[name]
    var version = node.version
    var key = KEY_PREFIX + name
    if (
      object.hasOwnProperty(key) &&
      object[key].indexOf(version) === -1
    ) {
      object[key].push(version)
    } else {
      object[key] = [version]
    }
    if (node.hasOwnProperty('dependencies')) {
      flattenDependencyTree(node.dependencies, object)
    }
  })
}

function recurse (configuration, children, dependencies, results) {
  if (Array.isArray(children)) {
    children.forEach(function (child) {
      if (
        !configuration.productionOnly ||
        appearsIn(child, dependencies)
      ) {
        results.push(resultForPackage(configuration, child))
        recurse(configuration, child, dependencies, results)
      }
      if (child.children) {
        recurse(configuration, child.children, dependencies, results)
      }
    })
    return results
  } else return results
}

function appearsIn (installed, dependencies) {
  var name = installed.package.name
  var key = KEY_PREFIX + name
  var version = installed.package.version
  return (
    dependencies.hasOwnProperty(key) &&
    dependencies[key].indexOf(version) !== -1
  )
}

function resultForPackage (configuration, tree) {
  return {
    name: tree.package.name,
    sustainability: tree.package.sustainability,
    author: tree.package.author,
    contributors: tree.package.contributors,
    repository: tree.package.repository,
    homepage: tree.package.homepage,
    version: tree.package.version,
    parent: tree.parent,
    path: tree.path
  }
}

function addProjectToList (list, newProject) {
  var match = list.find(function (existingProject) {
    return existingProject.uri === newProject.uri
  })
  if (match) return
  list.push(newProject)
}
