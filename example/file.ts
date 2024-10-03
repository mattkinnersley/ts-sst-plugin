import { Dynamo, Function, hello, StaticSite, x } from "./another-file";

const y = hello + x.hi;

const api = new Function({
  handler: "packages/functions/something.with.dots/api.handler",
  another: "woo hooo",
});

const db = new Dynamo();

db.subscribe("packages/functions/dynamo.handler", {
  filters: [
    {
      eventName: ["INSERT"],
      dynamodb: {
        Keys: {
          pk: {
            S: [{ prefix: "pk" }],
          },
          sk: {
            S: [{ prefix: "sk" }],
          },
        },
      },
    },
  ],
});

const site = new StaticSite({
  path: "packages/web.with.dots",
  another: "woo hooo",
});

console.log(y);
