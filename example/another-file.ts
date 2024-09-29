export const hello = 123;
export const x = {
  hi: "hi",
};

export class Component {
  protected handler: string;
  protected another: string;
  constructor({ handler, another }: { handler: string; another: string }) {
    this.handler = handler;
    this.another = another;
  }
  public getHandler() {
    return this.handler;
  }
}
