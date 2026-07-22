import { RunsClient } from "./RunsClient";

export const metadata = {
  title: "My year archive · LivingThere",
};

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ highlight?: string }>;
}) {
  const { highlight } = await searchParams;
  return <RunsClient highlightId={highlight} />;
}
