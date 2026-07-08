import { notFound } from "next/navigation";
import { getPublicMenu } from "../../../lib/api";
import { PublicMenuClient } from "./public-menu-client";

export const revalidate = 30;

interface PublicMenuPageProps {
  params: {
    slug: string;
  };
}

export default async function PublicMenuPage({ params }: PublicMenuPageProps) {
  const menu = await getPublicMenu(params.slug);

  if (!menu) {
    notFound();
  }

  return <PublicMenuClient menu={menu} />;
}
