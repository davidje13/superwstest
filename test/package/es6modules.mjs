import defaultImport from 'superwstest';

if (typeof defaultImport !== 'function') {
  throw new Error("import 'superwstest' did not return superwstest function");
}
