import { auth } from "@clerk/nextjs/server";
import { SimClient } from "./SimClient";

export default async function SimPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  // Demo mode is publicly accessible — skip auth so unauthenticated users (and e2e tests) can try it
  if (demo !== "1") {
    await auth.protect();
  }

  return <SimClient demoMode={demo === "1"} />;
}
