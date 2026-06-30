import { getAccessUsers } from "../../../lib/api";
import { UsersClient } from "./users-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const { token, users, options } = await getAccessUsers();

  return <UsersClient options={options} token={token} users={users} />;
}
