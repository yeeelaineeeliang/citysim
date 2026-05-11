import { auth } from "@clerk/nextjs/server";
import { SimClient } from "./SimClient";

export default async function SimPage() {
  await auth.protect();

  return <SimClient />;
}
