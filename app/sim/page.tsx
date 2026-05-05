// TODO: add auth.protect() once Clerk account + keys are configured
// import { auth } from "@clerk/nextjs/server";

import { SimClient } from "./SimClient";

export default function SimPage() {
  return <SimClient />;
}
