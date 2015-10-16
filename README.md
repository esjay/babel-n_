# babel-n\_
A REPL for Babel that allows binding to the `_` variable. In a typical REPL, `_` is bound to the previous input. Out of the box, babel-n\_ binds lodash to `_`.


## Installing
```
npm install -g babel-n_
```

## Accessing the REPL
After installing, the `babel-n_` REPL is accessible via the `bn_` global command.
```
$ bn_
bn_> var {hello} = {name: 'me!', hello: 'Is it me you\'re lookin\' for?'};
'use strict'
bn_> hello
'Is it me you\'re lookin\' for?'
bn_> _.contains(hello, 'lookin');
true
```

## Using Other Libraries
Currently, there is no API for binding alternatives to lodash to `_`, such as lodash-fp or underscore. Keep in mind, you can always `require` a library into the REPL, so long as node can see it and you don't mind using another variable. Pull requests are also welcome for an API that doesn't require modifying the code to use any given library for `_`;

## Acknowledgements
This project is simply a hack-up of [babel-node](https://github.com/babel/babel/) from the babel project and [n_](https://github.com/borisdiakur/n_/).
