// Module shim for @stoplight/elements.
//
// The package ships type declarations at node_modules/@stoplight/elements/
// index.d.ts, but its package.json `exports` map does not list a "types"
// condition, so TypeScript with `moduleResolution: bundler` cannot resolve
// them. We declare the (small) surface we actually use here.
declare module "@stoplight/elements" {
  import * as React from "react";

  interface CommonAPIProps {
    layout?: "sidebar" | "stacked" | "responsive";
    logo?: string;
    hideTryIt?: boolean;
    hideSamples?: boolean;
    hideTryItPanel?: boolean;
    hideSecurityInfo?: boolean;
    hideServerInfo?: boolean;
    hideSchemas?: boolean;
    hideInternal?: boolean;
    hideExport?: boolean;
    router?: "history" | "hash" | "memory" | "static";
    basePath?: string;
    staticRouterPath?: string;
  }

  type APIPropsWithUrl = { apiDescriptionUrl: string } & CommonAPIProps;
  type APIPropsWithDocument = {
    apiDescriptionDocument: string | object;
    apiDescriptionUrl?: string;
  } & CommonAPIProps;
  export type APIProps = APIPropsWithUrl | APIPropsWithDocument;

  export const API: React.FC<APIProps>;
  export const APIWithStackedLayout: React.FC<APIProps>;
}

declare module "@stoplight/elements/styles.min.css";
