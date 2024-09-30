import { Component, hello, x } from "./another-file";

const y = hello + x.hi;

const db = new Component({
  handler: "packages/functions/api.handler",
  another: "woo hooo",
});

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

console.log(y);
