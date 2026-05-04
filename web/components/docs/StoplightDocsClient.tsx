"use client";

import dynamic from "next/dynamic";

// Wrapper "use client" file. The actual Stoplight Elements module touches
// `window` during init, so we wrap it in next/dynamic with ssr:false. Next 15
// only allows ssr:false from inside a client component, hence the indirection.
const StoplightDocs = dynamic(() => import("./StoplightDocs"), {
  ssr: false,
});

export default function StoplightDocsClient() {
  return <StoplightDocs />;
}
