collect sustainability data for your npm dependencies

# Command Line Program

To run with `npx`:

```bash
cd your-npm-project
npx npm-sustainability
```

To install and use `npm-sustainability` globally:

```bash
npm install --global npm-sustainability
cd your-npm-project
npm-sustainability
```

To install as a development dependency of your package:

```bash
cd your-npm-project
npm install --save-dev npm-sustainability
```

For output as newline-delimited JSON objects, for further processing:

```bash
cd your-npm-project
npm-sustainability --ndjson
```

# JavaScript Module

The package exports an asynchronous function of three arguments:

1. A configuration object.

2. The path of the package to check.

3. An error-first callback that yields:

   - an array of objects, one per project

   - an array of URIs that failed to download or validate
