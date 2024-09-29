import { Component, hello, x } from "./another-file";

const y = hello + x.hi;

new Component({
  handler: "packages/functions/api.handler",
  another: "woo hooo",
});

console.log(y);
