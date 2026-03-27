declare module 'screenshot-desktop' {
  function screenshot(options?: { format?: string; filename?: string; screen?: number }): Promise<Buffer>;
  export = screenshot;
}
