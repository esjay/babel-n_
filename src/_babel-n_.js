import pathIsAbsolute from "path-is-absolute";
import commander from "commander";
import Module from "module";
import { inspect } from "util";
import path from "path";
import repl from "repl";
import { util } from "babel-core";
import * as babel from "babel-core";
import vm from "vm";
import _ from "lodash";

var program = new commander.Command("babel-node");

program.option("-e, --eval [script]", "Evaluate script");
program.option("-p, --print [code]", "Evaluate script and print result");
program.option("-i, --ignore [regex]", "Ignore all files that match this regex when using the require hook");
program.option("-x, --extensions [extensions]", "List of extensions to hook into [.es6,.js,.es,.jsx]");
program.option("-r, --stage [stage]", "Enable support for specific ECMAScript stages");
program.option("-w, --whitelist [whitelist]", "Whitelist of transformers separated by comma to ONLY use", util.list);
program.option("-b, --blacklist [blacklist]", "Blacklist of transformers separated by comma to NOT use", util.list);
program.option("-o, --optional [optional]", "List of optional transformers separated by comma to enable", util.list);


// used as the special var to assign the result of REPL expressions
var specialVar = process.env.SPECIAL_VAR || '$';

var pkg = require("../package.json");
program.version(pkg.version);
program.usage("[options] [ -e script | script.js ] [arguments]");
program.parse(process.argv);

//

babel.register({
  extensions:   program.extensions,
  blacklist:    program.blacklist,
  whitelist:    program.whitelist,
  optional:     program.optional,
  ignore:       program.ignore,
  stage:        program.stage,
});

//

var _eval = function (code, filename) {
  code = code.trim();
  if (!code) return undefined;

  code = babel.transform(code, {
    filename: filename,
    blacklist: program.blacklist,
    whitelist: program.whitelist,
    optional: program.optional,
    stage: program.stage
  }).code;

  return vm.runInThisContext(code, {
    filename: filename
  });
};

if (program.eval || program.print) {
  var code = program.eval;
  if (!code || code === true) code = program.print;

  global.__filename = "[eval]";
  global.__dirname = process.cwd();

  var module = new Module(global.__filename);
  module.filename = global.__filename;
  module.paths    = Module._nodeModulePaths(global.__dirname);

  global.exports = module.exports;
  global.module  = module;
  global.require = module.require.bind(module);

  var result = _eval(code, global.__filename);
  if (program.print) {
    var output = _.isString(result) ? result : inspect(result);
    process.stdout.write(output + "\n");
  }
} else {
  if (program.args.length) {
    // slice all arguments up to the first filename since they're babel args that we handle
    var args = process.argv.slice(2);

    var i = 0;
    var ignoreNext = false;
    _.each(args, function (arg, i2) {
      if (ignoreNext) {
        ignoreNext = false;
        return;
      }

      if (arg[0] === "-") {
        var parsedArg = program[arg.slice(2)];
        if (parsedArg && parsedArg !== true) {
          ignoreNext = true;
        }
      } else {
        i = i2;
        return false;
      }
    });
    args = args.slice(i);

    // make the filename absolute
    var filename = args[0];
    if (!pathIsAbsolute(filename)) args[0] = path.join(process.cwd(), filename);

    // add back on node and concat the sliced args
    process.argv = ["node"].concat(args);
    process.execArgv.unshift(__filename);

    Module.runMain();
  } else {
    replStart();
  }
}

function replStart() {
  var server = repl.start({
    prompt: "bn_> ",
    input: process.stdin,
    output: process.stdout,
    eval: replEval,
    useGlobal: true
  });

  // store method reference in case it is overwritten later
  var getDescriptor = Object.getOwnPropertyDescriptor,
      setDescriptor = Object.defineProperty;

  // create new pristine `lodash` instance
  var _ = require('lodash').runInContext(server.context);

  // state vars
  var prevVal = _,
      currVal = _;

  // inject lodash into the context
  setDescriptor(server.context, '_', {
      'configurable': true,
      'enumerable': false,
      'get': function () {
          return currVal;
      },
      'set': function (val) {
          prevVal = currVal;
          currVal = val;
      }
  });

  // redirect REPL changes of `_` to the new special variable
  _.each(repl._builtinLibs, function (name) {
      var context = server.context,
          descriptor = getDescriptor(context, name);

      setDescriptor(context, name, _.assign(descriptor, {
          'get': _.wrap(descriptor.get, function (get) {
              var context = server.context,
                  result = get();

              context[specialVar] = context._;
              currVal = prevVal;
              return result;
          })
      }));
  });

  var events = server.rli._events;
  events.line = _.wrap(events.line, function (line, cmd) {
      var context = server.context;
      line(cmd);
      context[specialVar] = context._;
      currVal = prevVal;
  });

}

function replEval(code, context, filename, callback) {
  var err;
  var result;

  try {
    if (code[0] === "(" && code[code.length - 1] === ")") {
      code = code.slice(1, -1); // remove "(" and ")"
    }

    result = _eval(code, filename);
  } catch (e) {
    err = e;
  }

  callback(err, result);
}
