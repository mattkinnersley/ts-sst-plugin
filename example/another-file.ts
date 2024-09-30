export const hello = 123;
export const x = {
  hi: "hi",
};

export class Function {
  protected handler: string;
  protected another: string;
  constructor({ handler, another }: { handler: string; another: string }) {
    this.handler = handler;
    this.another = another;
  }
  public getHandler() {
    return this.handler;
  }
  public subscribe(handler: string, options: { filters: any[] }) {
    return handler;
  }
}

export class Dynamo {
  public subscribe(handler: string, options: { filters: any[] }) {
    return handler;
  }
}

export class StaticSite {
  protected path: string;
  protected another: string;
  constructor({ path, another }: { path: string; another: string }) {
    this.path = path;
    this.another = another;
  }
}
